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
import { readPassages } from "../read/passage.ts";

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

  // READ THE WRITING FIRST. Timing now depends on each passage's own pace, so
  // the reading cannot come after the cut — a passage's prose decides how long
  // its beats are, which is the whole point of reading it.
  const readings = readPassages(
    film.editorial.beats.map((b) => film.essay.slice(b.range.startChar, b.range.endChar)),
  );
  const byEditorialId = new Map(film.editorial.beats.map((b, i) => [b.id, i]));

  const timed = timeBeats(
    film.editorial,
    spine,
    pace,
    film.seed,
    warnings,
    readings,
    byEditorialId,
  );

  // READ THE WRITING, IN ORDER. Novelty and return are relations between
  // passages, so this cannot be done per beat in isolation — it is exactly the
  // step whose absence made every visual change in the film uncaused.
  // ONE READING PER PASSAGE, NOT PER BEAT. Sub-beats share their parent's
  // character range, so reading them individually made every subdivision
  // "return" to the one before it — 85 returns out of 111 beats, which turns
  // the film's memory into a stutter. A subdivision is the same passage
  // continuing; it inherits the reading rather than earning its own.
  const beats = timed.map((b) => {
    const idx = byEditorialId.get(b.id.split(".")[0] as string) ?? 0;
    return withIntent(b, film, chaos, density, readings[idx], idx);
  });

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

  const body = {
    filmId: film.filmId,
    seed: film.seed,
    rendererContract: "1" as const,
    durationMs,
    fps: 30 as const,
    settings: film.settings,
    spine: { source: spine.source, wordTimedMs, totalMs: spine.totalMs },
    motifs,
    beats,
    voice: input.voice ?? null,
    warnings,
  };
  return { ...body, cutHash: await sha256Hex(canonicalJSON(body)) };
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
  readings: ReturnType<typeof readPassages>,
  byEditorialId: Map<string, number>,
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
    const span = s.endMs - s.startMs;
    const isMontage = s.beat.continuity === "montage" || (pace > 0.65 && s.beat.emphasis > 0.7);

    // A CEILING ON HOW LONG ONE STATE MAY HOLD.
    //
    // Beats are cut to the narration, and a paragraph of speech is eight or
    // nine seconds. Handing the compositor one visual state to hold for nine
    // seconds is the mechanical origin of "it's too slow and barely does
    // anything" — however alive the material is underneath, the composition
    // has not changed its mind in nine seconds.
    //
    // So a long beat is subdivided even when the writing is calm. The
    // sub-beats inherit (they are the same argument, not a montage), but each
    // one re-composes, which is what gives the film an event rate independent
    // of how long the sentence took to say.
    // THE MEASURED TARGET, not an invented one.
    //
    // Modern features run a 4–6s average shot length; The Bourne Supremacy at
    // 2.4s is cited as extremely short, frantic cutting. High-energy montage
    // and title work runs half a second to just under one. This engine was
    // averaging 2.9s a beat — cutting SLOWER than the fastest-cut action film
    // ever made, while trying to be a title sequence. That single number is
    // why forty-seven seconds of it carries about four seconds of film.
    //
    // So a held state now lasts between about 0.45s and 1.6s depending on
    // pace, and a long narration paragraph is cut into as many pieces as that
    // takes rather than a maximum of five.
    // RHYTHM, NOT A RATE.
    //
    // Every beat lasted about the same time, so the film changed by the same
    // amount every second — measured, adjacent frames differed by 0.396 and
    // distant frames by 0.346, almost the same number. Everything equally
    // different from everything is what one texture feels like. A real film
    // has enormous differences at a cut and near-zero within a shot, and its
    // rate of change is itself a shape.
    //
    // So the passage's own prose sets its pace: short sentences and hard
    // stops run quick, long subordinated ones run slow. And a passage the
    // writing weights heavily gets HELD — one long beat where the film stops
    // and looks at a single thing, which is what makes the rush either side
    // of it mean anything.
    const rd = readings[byEditorialId.get(s.beat.id) ?? 0];
    const tempo = rd?.tempo ?? 0.5;
    const weight = rd?.weight ?? 0.4;
    const held = weight > 0.62 && s.beat.emphasis > 0.45;
    const maxHoldMs = held ? 3600 + weight * 2600 : (2100 - pace * 1400) * (1.35 - tempo * 0.95);
    const n = isMontage
      ? 3 + Math.round(pace * 6)
      : span > maxHoldMs
        ? Math.min(20, Math.ceil(span / maxHoldMs))
        : 1;
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
    text: { promotion: "none", phrases: [], hierarchy: [], body: [], legibility: "open" },
    reading: {
      kind: "CLAIM",
      novelty: 1,
      returnsTo: null,
      hasFigure: false,
      isShort: false,
      passage: 0,
      signature: [],
      tempo: 0.5,
      weight: 0.4,
    },
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

function withIntent(
  beat: TimedBeat,
  film: Film,
  chaos: number,
  density: number,
  reading?: {
    kind: string;
    novelty: number;
    returnsTo: number | null;
    hasFigure: boolean;
    isShort: boolean;
    signature: number[];
    tempo: number;
    weight: number;
  },
  passageIndex = 0,
): TimedBeat {
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

  const behavior: Behavior =
    beat.visualIntent.continuity === "interrupt" && beat.visualIntent.rhythm === "burst"
      ? "INTERRUPT"
      : (BY_ROLE[beat.editorialRole] ?? "APPEAR");

  // A second operator is earned, not default: only where the beat is loud
  // or the film is chaotic, and never on a rest.
  const wantsSecond = beat.editorialRole !== "rest" && rng() < chaos * 0.25 + beat.emphasis * 0.15;
  const secondary: Behavior | undefined = wantsSecond
    ? beat.emphasis > 0.7
      ? "OVERPRINT"
      : "ECHO"
    : undefined;

  // A SUB-BEAT MUST NOT RE-INTRODUCE ITS PARENT'S PHRASES.
  //
  // Every sub-beat resolves to the same parent, so without this each one
  // introduces the same promoted phrase again and the frame fills with copies
  // of one line — the exact "does one thing over and over" failure, arriving
  // through the mechanism meant to cure slowness.
  //
  // A MONTAGE sub-beat is the deliberate exception: restating the phrase in a
  // burst is what a montage IS. A long-hold subdivision instead re-composes
  // around the phrase already on screen.
  const isSub = beat.id.includes(".");
  const subIndex = isSub ? Number(beat.id.split(".")[1] ?? 0) : 0;
  const restates = !isSub || beat.visualIntent.continuity === "interrupt";
  const body = bodyFragments(film.essay, beat.sourceRange);

  // A SUB-BEAT CARRIES ITS OWN WORDS.
  //
  // It used to carry none, so cutting faster only re-ARRANGED the same
  // promoted phrase — and with nine promoted phrases across a hundred and
  // twelve seconds, a faster cut rate would have made the sameness worse
  // rather than better. There is far more text in the essay than the nine
  // lines worth promoting, and a film moving through the writing is the
  // difference between compression and elongation.
  //
  // The promoted phrase still owns its own beat, at full scale. A
  // subdivision takes the NEXT fragment of the same passage, set smaller —
  // the argument continuing rather than the headline repeating.
  const phrases = restates
    ? (editorial?.phrases ?? []).map((p, i) => ({
        text: p.text,
        role: (i === 0 ? "key" : "support") as "key" | "support" | "fragment" | "texture",
        // The phrase arrives when its own words are spoken, not at the top of
        // the beat. This is the whole reason the spine exists.
        atMs: beat.startMs,
      }))
    : body.length > 0
      ? [
          {
            text: body[(subIndex - 1 + body.length) % body.length] as string,
            role: "support" as const,
            atMs: beat.startMs,
          },
        ]
      : [];

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
      body,
      legibility:
        editorial?.legibility === "denied" ? "denied" : phrases.length > 0 ? "protected" : "open",
    },
    reading: reading
      ? {
          kind: reading.kind,
          // A subdivision is mid-passage: the writing has not moved, so the
          // film must not treat it as if it had.
          novelty: isSub ? 0 : reading.novelty,
          returnsTo: isSub ? null : reading.returnsTo,
          hasFigure: reading.hasFigure,
          isShort: reading.isShort,
          passage: passageIndex,
          signature: reading.signature,
          tempo: reading.tempo,
          weight: reading.weight,
        }
      : {
          kind: "CLAIM",
          novelty: 1,
          returnsTo: null,
          hasFigure: false,
          isShort: false,
          passage: passageIndex,
          signature: [],
          tempo: 0.5,
          weight: 0.4,
        },
    // A MOTIF APPEARS WHEREVER ITS WORDS DO.
    //
    // `motifRef` was only set where the editor PROMOTED a phrase, so eight
    // beats in eighty-one carried a motif and the visual memory had almost
    // nothing to remember with. A motif is present when the passage says it,
    // whether or not that sentence was chosen for the screen — and the test is
    // the same verbatim substring check a figure gets, so it can be checked
    // against the prose by anyone.
    motif: motifIn(film, beat, editorial),
  };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Which motif this beat's own prose contains, if any. Longest phrase wins —
 *  "machine that turns writing" is a more specific claim than "machine that
 *  turns", and the specific one is the one the audience will recognise. */
function motifIn(
  film: Film,
  beat: TimedBeat,
  editorial: EditorialBeat | undefined,
): TimedBeat["motif"] {
  const text = film.essay.slice(beat.sourceRange.startChar, beat.sourceRange.endChar).toLowerCase();
  let best: { id: string; len: number } | null = null;
  for (const m of film.editorial.motifs) {
    const p = m.phrase.toLowerCase();
    if (p.length < 6 || !text.includes(p)) continue;
    if (!best || p.length > best.len) best = { id: m.id, len: p.length };
  }
  if (!best) return null;
  const m = film.editorial.motifs.find((x) => x.id === best?.id);
  return {
    id: best.id,
    // The editor's own treatment when it named one; otherwise the motif's
    // declared arc decides how this appearance reads.
    treatment:
      editorial?.motifRef?.treatment ??
      (m?.arc === "degrade" ? "degrade" : m?.arc === "invert" ? "restate" : "repeat"),
    wearBefore: 0,
    wearAfter: 0,
  };
}

/** The beat's own prose, cut into short verbatim fragments.
 *
 *  This is the compositor's TEXTURE stock. It is the essay's own words at
 *  the essay's own offsets — never paraphrased, never generated — so the
 *  same firewall that protects a promoted phrase covers the small print too.
 *  Capped, because a texture pass wants a handful of fragments, not a
 *  transcript.
 */
function bodyFragments(essay: string, range: { startChar: number; endChar: number }): string[] {
  const words = essay
    .slice(range.startChar, range.endChar)
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length && out.length < 14; ) {
    // Irregular lengths. Equal-length fragments read as a list.
    const n = 2 + ((i * 7 + words.length) % 4);
    out.push(words.slice(i, i + n).join(" "));
    i += n;
  }
  return out;
}
