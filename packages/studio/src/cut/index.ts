// THE CUT — editorial beats × the spine → a timed film.
//
// This is the last thing the Worker does, and the boundary of its
// authority. It decides WHEN things happen and WHAT KIND of event each one
// is. It never decides a position, a size, a font or a colour — those need
// text metrics the Worker cannot compute, and putting them here is how the
// system ends up with two engines that disagree.
//
// It consumes a `WordSpine` and never asks whether the film has narration.

import type {
  Behavior,
  EditorialBeat,
  EditorialModel,
  Film,
  FilmCut,
  TimedBeat,
  VisualIntent,
  WordSpine,
} from "../film/schema.ts";
import { canonicalJSON, sha256Hex } from "../lib/hash.ts";
import { deriveSeed, mulberry32 } from "../lib/rng.ts";

/** No beat below three frames at 30fps — under that it is a flicker, not a
 *  cut. A montage burst may go to two. */
const FLOOR_MS = 90;
const BURST_FLOOR_MS = 60;

export interface CutInput {
  film: Film;
  spine: WordSpine;
  voice?: FilmCut["voice"];
}

export async function buildCut(input: CutInput): Promise<FilmCut> {
  const { film, spine } = input;
  const { pace, chaos, density } = film.settings;
  const warnings: string[] = [];

  const timed = timeBeats(film.editorial, spine, pace, film.seed, warnings);
  const beats = timed.map((b) => withIntent(b, film, chaos, density));

  const durationMs =
    beats.length > 0 ? (beats[beats.length - 1] as TimedBeat).endMs : spine.totalMs;
  const wordTimedMs = spine.words
    .filter((w) => w.measured)
    .reduce((n, w) => n + (w.endMs - w.startMs), 0);

  const motifs = film.editorial.motifs.map((m) => ({
    id: m.id,
    phrase: m.phrase,
    arc: m.arc,
    beatIds: film.editorial.beats.filter((b) => b.motifRef?.motifId === m.id).map((b) => b.id),
  }));

  // Three.js config derived from film settings
  let threeConfig: { noiseIntensity: number; warpFieldType: "radial" | "linear" | "turbulent"; parallaxDepth: number; includeImageryLayer: boolean } | undefined;
  if (film.renderBackend === "threejs-procedural") {
    const warpType: "radial" | "linear" | "turbulent" =
      film.settings.chaos > 0.6 ? "turbulent" : film.settings.chaos > 0.3 ? "radial" : "linear";
    threeConfig = {
      noiseIntensity: film.settings.density,
      warpFieldType: warpType,
      parallaxDepth: 0.1 + film.settings.density * 0.4,
      includeImageryLayer: false,
    };
  }

  const bodyBase = {
    filmId: film.filmId,
    seed: film.seed,
    rendererContract: "1" as const,
    durationMs,
    fps: 30 as const,
    settings: film.settings,
    renderBackend: film.renderBackend,
    spine: { source: spine.source, wordTimedMs, totalMs: spine.totalMs },
    motifs,
    beats,
    voice: input.voice ?? null,
    warnings,
  };

  const body = threeConfig ? { ...bodyBase, threeConfig } : bodyBase;
  return { ...body, cutHash: await sha256Hex(canonicalJSON(body)) } as FilmCut;
}

/* ── timing ────────────────────────────────────────────────────────── */

interface Staged {
  beat: EditorialBeat;
  startMs: number;
  endMs: number;
  narrated: boolean;
}

function timeBeats(
  editorial: EditorialModel,
  spine: WordSpine,
  pace: number,
  filmSeed: number,
  warnings: string[],
): TimedBeat[] {
  if (editorial.beats.length === 0) return [];

  // 1 — map each beat's character range onto the spine.
  let staged: Staged[] = editorial.beats.map((beat) => {
    const inside = spine.words.filter(
      (w) => w.char >= beat.range.startChar && w.endChar <= beat.range.endChar,
    );
    const first = inside[0];
    const last = inside[inside.length - 1];
    return {
      beat,
      startMs: first ? first.startMs : 0,
      endMs: last ? last.endMs : 0,
      narrated: inside.some((w) => w.measured),
    };
  });

  // 2 — MERGE. At slow pace a long state is held through several beats; at
  // fast pace almost nothing merges. This is what "pace is editorial
  // density" means concretely — it is not a speed multiplier.
  const mergeThreshold = 0.7 - pace * 0.55;
  const merged: Staged[] = [];
  for (const s of staged) {
    const prev = merged[merged.length - 1];
    const mergeable =
      prev !== undefined &&
      prev.beat.sectionId === s.beat.sectionId &&
      s.beat.continuity === "continue" &&
      s.beat.emphasis < mergeThreshold &&
      s.beat.phrases.length === 0;
    if (mergeable && prev) {
      prev.endMs = s.endMs;
      prev.narrated = prev.narrated || s.narrated;
      continue;
    }
    merged.push({ ...s });
  }
  staged = merged;

  // 3 — SUBDIVIDE a montage into irregular sub-beats. Irregular on purpose:
  // evenly-spaced cuts read as a metronome, which is the opposite of what a
  // montage does.
  const out: TimedBeat[] = [];
  for (const s of staged) {
    const isMontage = s.beat.continuity === "montage" || (pace > 0.65 && s.beat.emphasis > 0.7);
    const span = s.endMs - s.startMs;
    const n = isMontage ? 3 + Math.round(pace * 4) : 1;
    if (n === 1 || span < n * BURST_FLOOR_MS) {
      out.push(shell(s, s.startMs, s.endMs, 0, filmSeed));
      continue;
    }
    const rng = mulberry32(deriveSeed(filmSeed, s.beat.id, "montage"));
    const weights = Array.from({ length: n }, () => 0.4 + rng() * rng() * 2.2);
    const total = weights.reduce((a, b) => a + b, 0);
    let at = s.startMs;
    for (let i = 0; i < n; i++) {
      const dur = (span * (weights[i] as number)) / total;
      const end = i === n - 1 ? s.endMs : at + dur;
      out.push(shell(s, Math.round(at), Math.round(end), i, filmSeed));
      at = end;
    }
  }

  // 4 — SNAP boundaries to real silence. A cut on a breath reads as an
  // edit; a cut between two words of a phrase reads as a fault.
  if (spine.words.some((w) => w.measured)) {
    for (let i = 1; i < out.length; i++) {
      const b = out[i] as TimedBeat;
      const prev = out[i - 1] as TimedBeat;
      const snapped = nearestRest(spine, b.startMs);
      if (snapped !== null && snapped > prev.startMs + FLOOR_MS && snapped < b.endMs - FLOOR_MS) {
        prev.endMs = snapped;
        b.startMs = snapped;
      }
    }
  }

  // 5 — FLOOR. A beat below the floor merges backwards rather than
  // flickering. The measured-duration floor is honoured here too: a beat
  // carrying real audio is never compressed below what was spoken.
  const kept: TimedBeat[] = [];
  for (const b of out) {
    const floor = b.visualIntent.rhythm === "burst" ? BURST_FLOOR_MS : FLOOR_MS;
    const prev = kept[kept.length - 1];
    if (b.endMs - b.startMs < floor && prev) {
      prev.endMs = b.endMs;
      continue;
    }
    kept.push(b);
  }
  if (kept.length < out.length) {
    warnings.push(`${out.length - kept.length} beats were below the cut floor and merged back`);
  }
  return kept;
}

/** The nearest inter-word silence, preferring a longer rest slightly over a
 *  marginally closer one. */
function nearestRest(spine: WordSpine, atMs: number): number | null {
  let best: { at: number; score: number } | null = null;
  for (const p of spine.pauses) {
    const distance = Math.abs(p.atMs - atMs);
    if (distance > 1000) continue;
    const score = distance - Math.min(p.ms, 400) * 0.5;
    if (!best || score < best.score) best = { at: p.atMs, score };
  }
  return best ? best.at : null;
}

function shell(
  s: Staged,
  startMs: number,
  endMs: number,
  sub: number,
  filmSeed: number,
): TimedBeat {
  const id = sub === 0 ? s.beat.id : `${s.beat.id}.${sub}`;
  return {
    id,
    startMs,
    endMs,
    editorialRole: s.beat.role,
    emphasis: s.beat.emphasis,
    narrationRange: s.narrated ? { startMs, endMs } : null,
    sourceRange: s.beat.range,
    // Filled by `withIntent`; the shape is here so the floor pass can read
    // `rhythm` before intent is resolved.
    visualIntent: {
      behavior: "APPEAR",
      intensity: 0.5,
      density: 0.3,
      scale: 0.3,
      rhythm: sub > 0 ? "burst" : "hold",
      continuity: s.beat.continuity === "montage" ? "interrupt" : s.beat.continuity,
      instability: 1 - s.beat.certainty,
    },
    text: { promotion: "none", phrases: [], hierarchy: [], legibility: "open" },
    motif: null,
    seed: deriveSeed(filmSeed, id),
  };
}

/* ── intent ────────────────────────────────────────────────────────── */

/** WHAT KIND OF EVENT this beat is. The editorial role decides; chaos and
 *  emphasis decide how hard it pushes. Note what is absent: no noun is
 *  consulted, and no picture is named. */
const BY_ROLE: Record<EditorialBeat["role"], Behavior> = {
  open: "APPEAR",
  assert: "SLAM",
  develop: "ACCUMULATE",
  complicate: "FRAGMENT",
  turn: "INVERT",
  escalate: "SURGE",
  rest: "FREEZE",
  restate: "REASSEMBLE",
  close: "COLLAPSE",
};

function withIntent(beat: TimedBeat, film: Film, chaos: number, density: number): TimedBeat {
  // SPLIT ON THE SEPARATOR, NEVER `startsWith`.
  //
  // A sub-beat is `b7.2`, so the parent is everything before the dot. The
  // obvious `beat.id.startsWith(b.id)` is wrong in the quiet way this
  // codebase keeps getting caught by: `"b10".startsWith("b1")` is true, so
  // beats 10 through 12 silently inherited beat 1's phrases and rendered
  // with no text at all while the report looked correct.
  const parentId = beat.id.split(".")[0];
  const editorial = film.editorial.beats.find((b) => b.id === parentId) as
    | EditorialBeat
    | undefined;
  const rng = mulberry32(beat.seed);

  // A promoted phrase must never be silenced. FREEZE is the one behaviour
  // that introduces nothing at all — correct for a genuine rest, where the
  // editorial reading gave this beat no text either — but wrong for a beat
  // that scored low-emphasis (hence role "rest") and STILL carries a
  // promoted phrase: those are two independent judgements, and the compiler
  // must not let the quieter one erase the phrase the editor chose to show.
  // Confirmed on a real film: the phrase was present in the record and
  // never appeared on screen, because its beat's role happened to be "rest".
  const hasPhrases = (editorial?.phrases?.length ?? 0) > 0;
  const roleBehavior = BY_ROLE[beat.editorialRole] ?? "APPEAR";
  const behavior: Behavior =
    beat.visualIntent.continuity === "interrupt" && beat.visualIntent.rhythm === "burst"
      ? "INTERRUPT"
      : roleBehavior === "FREEZE" && hasPhrases
        ? "APPEAR"
        : roleBehavior;

  // A second operator is earned, not default: only where the beat is loud
  // or the film is chaotic, and never on a rest.
  const wantsSecond = beat.editorialRole !== "rest" && rng() < chaos * 0.5 + beat.emphasis * 0.25;
  const secondary: Behavior | undefined = wantsSecond
    ? beat.emphasis > 0.7
      ? "OVERPRINT"
      : "ECHO"
    : undefined;

  const phrases = (editorial?.phrases ?? []).map((p, i) => ({
    text: p.text,
    role: (i === 0 ? "key" : "support") as "key" | "support" | "fragment" | "texture",
    // The phrase arrives when its own words are spoken, not at the top of
    // the beat. This is the whole reason the spine exists.
    atMs: beat.startMs,
  }));

  const intent: VisualIntent = {
    behavior,
    ...(secondary ? { secondary } : {}),
    intensity: clamp01(0.25 + beat.emphasis * 0.6 + chaos * 0.15),
    density: clamp01(density * (0.5 + beat.emphasis * 0.7)),
    scale: clamp01(0.18 + beat.emphasis * 0.34),
    rhythm: beat.visualIntent.rhythm,
    continuity: beat.visualIntent.continuity,
    instability: beat.visualIntent.instability,
  };

  return {
    ...beat,
    visualIntent: intent,
    text: {
      promotion: editorial?.promotion ?? "none",
      phrases,
      hierarchy: phrases.map((_, i) => (i === 0 ? 1 : 0.5)),
      legibility:
        editorial?.legibility === "denied" ? "denied" : phrases.length > 0 ? "protected" : "open",
    },
    motif: editorial?.motifRef
      ? {
          id: editorial.motifRef.motifId,
          treatment: editorial.motifRef.treatment,
          wearBefore: 0,
          wearAfter: 0,
        }
      : null,
  };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
