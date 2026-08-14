// The constraint solver — Master Spec Part 3.
//
// Turns anchors into resolved time windows. Timing is anchor-based and
// never frame-based: a scene says "start where narration chunk c_04 starts,
// plus 200ms", so re-recording the narration re-times the film correctly
// instead of silently desynchronising it.
//
// Part 3.2's two failure modes are the interesting part, and neither is
// allowed to silently break the film:
//
//   OVERFLOW  — the narration runs longer than a single visual can
//               sustain. The scene is auto-split at sentence boundaries
//               into several blocks, and the split is reported.
//   UNDERFLOW — the narration is shorter than the visual's minimum hold.
//               The visual extends into the next scene's head as a J-cut
//               if the next scene is elastic; otherwise it is compressed
//               and flagged as an underrun.
//
// Every scene carries a plain-language explanation of how its window was
// arrived at (Part 3.3), because a solver whose decisions can't be read
// is indistinguishable from one that's wrong.

import type { EditorialIR, Scene } from "../ir/schema.ts";

/** One aligned chunk of narration. The frozen alignment artifact is an
 *  array of these; `chunkId` is what anchors reference. */
export interface AlignmentChunk {
  chunkId: string;
  startMs: number;
  endMs: number;
  text?: string;
}

/** One word, measured. Lives here rather than in `align.ts` because it is
 *  a TIMING type and `align.ts` already imports this module — and because
 *  it now travels on the Alignment, which is the only way anything
 *  downstream of the freeze can know when a particular word was spoken. */
export interface TimedWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface Alignment {
  sceneId: string;
  chunks: AlignmentChunk[];
  /** THE MEASURED WORDS, scene-local. Present when the ASR gave word
   *  timings — `method: "asr-proportional"` — and absent when it gave only
   *  a duration. The distinction is kept rather than filled in: a word
   *  time that was interpolated is not a measurement. */
  words?: TimedWord[];
}

export type TimingFlag =
  | "auto_split"
  | "underrun"
  | "j_cut"
  | "cascade_shift"
  | "clamped_min"
  | "clamped_max"
  | "missing_alignment";

/** One cut within a scene. A scene is not necessarily one continuous shot:
 *  an aphoristic essay of short declarative lines wants to be cut, and the
 *  cut is a TIMING structure rather than a primitive. Editing is the axis
 *  the palette could not express — you cannot make a fast cut by picking a
 *  primitive, only by subdividing a window. */
export interface Shot {
  index: number;
  startMs: number;
  endMs: number;
  /** Why this cut exists — a deliberate rhythm, or forced by overflow. */
  reason: "rhythm" | "overflow" | "whole";
}

export interface SolvedScene {
  sceneId: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  /** The scene's cut structure. Always at least one shot. */
  shots: Shot[];
  /** Sentence-boundary sub-windows when the scene was auto-split. Empty
   *  when the scene resolved to a single visual. */
  splits: Array<{ startMs: number; endMs: number; text: string }>;
  flags: TimingFlag[];
  /** Human-readable account of how this window was arrived at. */
  explanation: string;
}

export interface SolveResult {
  scenes: SolvedScene[];
  runtimeMs: number;
  /** Film-level problems worth surfacing above the scene list. */
  warnings: string[];
}

/** A single visual can't hold attention indefinitely. Past this, the
 *  solver splits rather than letting one primitive chain carry 40s of
 *  narration on its own. */
const MAX_SINGLE_VISUAL_MS = 12_000;

/** Below this, a visual reads as a flash rather than a shot. */
const MIN_VISUAL_HOLD_MS = 1_800;

/** Below this a cut stops reading as an edit and starts reading as a
 *  flicker. No rhythm setting may produce something unwatchable. */
const MIN_SHOT_MS = 420;
/** Above this the "fast cutting" instruction has stopped meaning anything. */
const MAX_SHOT_MS = 4200;

export function solveTiming(
  ir: EditorialIR,
  alignments: Map<string, Alignment>,
  /** 0 = one continuous shot per scene. 1 = as fast as MIN_SHOT_MS allows.
   *  Read from the film's creative state by the compile pipeline. */
  cutRhythm = 0,
): SolveResult {
  const warnings: string[] = [];
  const solved: SolvedScene[] = [];

  // Pass 1 — resolve each scene's natural window from its anchors.
  let cursorMs = 0;
  for (const scene of ir.scenes) {
    const alignment = alignments.get(scene.sceneId);
    const flags: TimingFlag[] = [];
    const reasons: string[] = [];

    let startMs: number;
    let endMs: number;

    if (!alignment || alignment.chunks.length === 0) {
      // No narration generated yet. Fall back to a nominal window so the
      // rest of the film still compiles — a missing asset degrades one
      // scene, it does not block the build (standing rule 8).
      startMs = cursorMs;
      endMs = cursorMs + Math.max(scene.timing.minDurationMs, MIN_VISUAL_HOLD_MS);
      flags.push("missing_alignment");
      reasons.push("no alignment asset yet — nominal window pending narration");
    } else {
      const startChunk = findChunk(alignment, scene.timing.startAnchor.chunkId);
      const endChunk = findChunk(alignment, scene.timing.endAnchor.chunkId);
      if (!startChunk || !endChunk) {
        startMs = cursorMs;
        endMs = cursorMs + Math.max(scene.timing.minDurationMs, MIN_VISUAL_HOLD_MS);
        flags.push("missing_alignment");
        reasons.push(
          `anchor chunk "${!startChunk ? scene.timing.startAnchor.chunkId : scene.timing.endAnchor.chunkId}" not present in the alignment`,
        );
      } else {
        startMs = startChunk.startMs + scene.timing.startAnchor.offsetMs;
        endMs = endChunk.endMs + scene.timing.endAnchor.offsetMs;
        reasons.push(
          `anchored to ${scene.timing.startAnchor.chunkId}+${scene.timing.startAnchor.offsetMs}ms → ${scene.timing.endAnchor.chunkId}+${scene.timing.endAnchor.offsetMs}ms`,
        );
      }
    }

    // Anchors can invert if the operator points end before start; treat it
    // as a zero-length window rather than propagating a negative duration
    // through every downstream calculation.
    if (endMs < startMs) {
      warnings.push(`${scene.sceneId}: end anchor resolves before start anchor`);
      endMs = startMs;
    }

    let durationMs = endMs - startMs;

    // Clamp to the scene's declared bounds.
    if (durationMs < scene.timing.minDurationMs) {
      durationMs = scene.timing.minDurationMs;
      flags.push("clamped_min");
      reasons.push(`held to the ${scene.timing.minDurationMs}ms minimum`);
    }
    /* A MEASURED RECORDING IS A FACT; A CAP IS A PREFERENCE.
     *
     * Reported live: the narration crowded on top of itself. This is why —
     * `maxDurationMs` capped a scene BELOW the length of its own recording,
     * so the next scene began, its line started speaking, and the previous
     * one was still talking. Two voices at once.
     *
     * A cap can shorten a scene the film only ESTIMATED. It cannot shorten
     * one that was spoken: the whole premise is that the picture is cut to
     * the voice, and a window shorter than its own audio is the picture
     * overruling it. */
    const spokenMs = measuredDurationOf(alignments.get(scene.sceneId));
    if (durationMs > scene.timing.maxDurationMs) {
      const cap = Math.max(scene.timing.maxDurationMs, spokenMs);
      if (cap > scene.timing.maxDurationMs) {
        reasons.push(`held to ${Math.round(spokenMs)}ms — the length of the recording`);
      } else {
        flags.push("clamped_max");
        reasons.push(`capped at the ${scene.timing.maxDurationMs}ms maximum`);
      }
      durationMs = cap;
    } else if (spokenMs > durationMs) {
      // The window was inside its bounds and still shorter than the line.
      durationMs = spokenMs;
      reasons.push(`held to ${Math.round(spokenMs)}ms — the length of the recording`);
    }

    solved.push({
      sceneId: scene.sceneId,
      startMs,
      endMs: startMs + durationMs,
      durationMs,
      shots: [],
      splits: [],
      flags,
      explanation: reasons.join("; "),
    });
    cursorMs = startMs + durationMs;
  }

  // Pass 2 — Part 3.2 underflow: a window below the minimum hold either
  // borrows from an elastic neighbour (a J-cut) or is flagged as an
  // underrun. Runs after splitting so a split scene's sub-windows are
  // already settled.
  for (let i = 0; i < solved.length; i++) {
    const s = solved[i];
    const scene = ir.scenes[i];
    if (!s || !scene) continue;
    if (s.durationMs >= MIN_VISUAL_HOLD_MS) continue;
    if (s.flags.includes("missing_alignment")) continue;

    const deficitMs = MIN_VISUAL_HOLD_MS - s.durationMs;
    const next = solved[i + 1];
    const nextScene = ir.scenes[i + 1];

    if (next && nextScene && nextScene.timing.elasticity === "elastic") {
      // The visual runs on under the next scene's opening narration.
      s.endMs += deficitMs;
      s.durationMs += deficitMs;
      s.flags.push("j_cut");
      s.explanation += `; J-cut — visual holds ${deficitMs}ms into ${next.sceneId}, which is elastic`;
    } else {
      s.flags.push("underrun");
      s.explanation += `; underrun — ${s.durationMs}ms is below the ${MIN_VISUAL_HOLD_MS}ms hold and the next scene is rigid`;
      warnings.push(
        `${s.sceneId}: underrun (${s.durationMs}ms < ${MIN_VISUAL_HOLD_MS}ms) with no elastic neighbour to absorb it`,
      );
    }
  }

  // Pass 3 — cascade. Walk forward closing gaps and overlaps introduced by
  // clamping and J-cuts. Elastic scenes absorb the slack in place;
  // a rigid scene refuses, so the shift propagates to everything after it.
  //
  // VOICE IS ABSOLUTE. VISUALS ARE DERIVED.
  //
  // Absorbing shortens a scene: it moves the head and keeps the tail. That
  // is exactly right for a procedural visual, which simply runs for less
  // time. It is wrong for narration, which does not compress — so a scene
  // shortened below its own measured audio has the next scene's voice
  // starting before this one has finished speaking, and the film talks
  // over itself. Reported from a real film: "the tts overlaps... a little
  // bit jarring."
  //
  // So a narrated scene has a FLOOR at its measured duration. The cascade
  // may still move it — that is what keeps the film contiguous — but it
  // may not compress it, and the shift propagates instead. This is the
  // absolute/derived distinction made structural rather than documented:
  // the audio is the master clock, and the one pass that could quietly
  // overrule it no longer can.
  for (let i = 1; i < solved.length; i++) {
    const prev = solved[i - 1];
    const cur = solved[i];
    const scene = ir.scenes[i];
    if (!prev || !cur || !scene) continue;

    const deltaMs = prev.endMs - cur.startMs;
    if (deltaMs === 0) continue;

    // What this scene's audio actually measures, when it has any.
    const spoken = alignments.get(cur.sceneId);
    const spokenMs = spoken?.chunks.length
      ? Math.max(...spoken.chunks.map((c) => c.endMs)) -
        Math.min(...spoken.chunks.map((c) => c.startMs))
      : 0;
    const floorMs = Math.max(MIN_VISUAL_HOLD_MS, spokenMs);

    if (scene.timing.elasticity === "elastic" && cur.durationMs - deltaMs >= floorMs) {
      // Absorb: move the head, keep the tail, shorten in place.
      cur.startMs = prev.endMs;
      cur.durationMs = cur.endMs - cur.startMs;
      cur.explanation += `; absorbed ${Math.abs(deltaMs)}ms of slack from ${prev.sceneId}`;
    } else {
      // Refuse: hold duration and push everything downstream.
      cur.startMs = prev.endMs;
      cur.endMs = cur.startMs + cur.durationMs;
      cur.flags.push("cascade_shift");
      cur.explanation += `; shifted ${Math.abs(deltaMs)}ms — ${
        scene.timing.elasticity === "rigid"
          ? "scene is rigid"
          : spokenMs > 0
            ? `absorbing would cut into ${Math.round(spokenMs)}ms of narration`
            : "absorbing would breach the minimum hold"
      }`;
    }
  }

  // Pass 4 — Part 3.2 overflow. Runs LAST, after the cascade has settled
  // every window, so sub-windows always tile the scene's final position.
  // Splitting before the cascade would leave the splits anchored to a
  // window the scene no longer occupies, and the blocks would render at
  // the wrong time — silently, which is the worst way for it to be wrong.
  for (let i = 0; i < solved.length; i++) {
    const s = solved[i];
    const scene = ir.scenes[i];
    if (!s || !scene) continue;
    if (s.durationMs <= MAX_SINGLE_VISUAL_MS) continue;

    const sentences = splitSentences(scene.narration.text);
    if (sentences.length < 2) {
      // Nothing to split on — one very long sentence. Report it rather
      // than inventing a cut in the middle of a clause.
      warnings.push(
        `${s.sceneId}: ${Math.round(s.durationMs / 1000)}s on a single sentence — no boundary to split on`,
      );
      continue;
    }

    // Apportion the window by sentence length. Character count is a crude
    // proxy for speech duration, but it is deterministic and real
    // alignment corrects it as soon as narration exists.
    const totalChars = sentences.reduce((a, t) => a + t.length, 0) || 1;
    let at = s.startMs;
    s.splits = sentences.map((text, idx) => {
      const share = (text.length / totalChars) * s.durationMs;
      const seg = {
        startMs: Math.round(at),
        // Pin the last segment to the scene's end so rounding can never
        // leave a sliver of unpainted time at the tail.
        endMs: idx === sentences.length - 1 ? s.endMs : Math.round(at + share),
        text,
      };
      at += share;
      return seg;
    });
    s.flags.push("auto_split");
    s.explanation += `; auto-split into ${sentences.length} blocks at sentence boundaries (${Math.round(s.durationMs / 1000)}s exceeds the ${MAX_SINGLE_VISUAL_MS / 1000}s single-visual ceiling)`;
  }

  // Pass 5 — the cut. Subdivide each settled window into shots at the
  // film's rhythm. Runs after the cascade for the same reason splitting
  // does: a shot list computed against a window the scene later vacates is
  // silently wrong.
  //
  // A cut is never shorter than MIN_SHOT_MS. Past that it stops reading as
  // an edit and starts reading as a flicker, and no rhythm setting should
  // be able to produce something unwatchable.
  for (const s of solved) {
    const target = cutRhythm > 0 ? MAX_SHOT_MS - cutRhythm * (MAX_SHOT_MS - MIN_SHOT_MS) : 0;
    const count =
      target > 0
        ? Math.max(1, Math.min(12, Math.floor(s.durationMs / Math.max(MIN_SHOT_MS, target))))
        : 1;

    if (count <= 1) {
      s.shots = [{ index: 0, startMs: s.startMs, endMs: s.endMs, reason: "whole" }];
      continue;
    }
    /* CUT WHERE THE SPEAKER BREAKS, NOT WHERE THE ARITHMETIC LANDS.
     *
     * This divided the scene into equal slices — `durationMs / count` — so
     * an edit could land in the middle of a word however carefully the
     * narration had been measured. The whole premise of this system is
     * that the picture is cut TO the voice; dividing by N is cutting
     * beside it.
     *
     * The word times are already here, on the alignment, and were read by
     * exactly one thing: the arrival of a promoted phrase. Each cut is now
     * moved to the nearest gap BETWEEN words — the real silence a speaker
     * leaves — and the ideal position is only the starting guess.
     *
     * A film with no measured words falls back to the even division and
     * says so, which is honest: with nothing recorded there is nothing to
     * cut to. */
    const measuredWords = alignments.get(s.sceneId)?.words ?? [];
    const gaps = measuredWords
      .slice(0, -1)
      .map((w, i) => ({
        at: s.startMs + (w.endMs + (measuredWords[i + 1]?.startMs ?? w.endMs)) / 2,
        rest: (measuredWords[i + 1]?.startMs ?? w.endMs) - w.endMs,
      }))
      .filter((g) => g.at > s.startMs && g.at < s.endMs);

    const each = s.durationMs / count;
    const cutAt = (i: number): number => {
      const ideal = s.startMs + i * each;
      if (gaps.length === 0) return Math.round(ideal);
      /* The nearest real break, preferring a longer rest where two are
       * close — a cut on a breath reads as an edit, a cut on the join
       * between two words in a phrase reads as a glitch. A break more than
       * a second from where the rhythm wanted it is not that beat's break,
       * so the rhythm keeps its position. */
      let best = null as null | { at: number; score: number };
      for (const g of gaps) {
        const away = Math.abs(g.at - ideal);
        if (away > 1000) continue;
        const score = away - Math.min(g.rest, 400) * 0.5;
        if (!best || score < best.score) best = { at: g.at, score };
      }
      return Math.round(best ? best.at : ideal);
    };

    const edges = [
      s.startMs,
      ...Array.from({ length: count - 1 }, (_, i) => cutAt(i + 1)),
      s.endMs,
    ];
    // A break that lands on top of its neighbour would make a zero-length
    // shot, which is a dropped frame rather than an edit.
    for (let i = 1; i < edges.length - 1; i++) {
      const lo = (edges[i - 1] as number) + MIN_SHOT_MS;
      const hi = (edges[i + 1] as number) - MIN_SHOT_MS;
      edges[i] = Math.max(lo, Math.min(hi, edges[i] as number));
    }
    s.shots = Array.from({ length: count }, (_, i) => ({
      index: i,
      startMs: edges[i] as number,
      endMs: edges[i + 1] as number,
      reason: "rhythm" as const,
    }));
    s.explanation += `; cut into ${count} shots at rhythm ${cutRhythm.toFixed(2)}${
      gaps.length ? ", on the breaks in the speech" : " (evenly — no measured words to cut to)"
    }`;
  }

  const last = solved[solved.length - 1];
  return { scenes: solved, runtimeMs: last ? last.endMs : 0, warnings };
}

/** How long this scene was actually SPOKEN, from the frozen measurement.
 *  Zero when nothing was recorded, so an un-narrated film is untouched. */
function measuredDurationOf(alignment: Alignment | undefined): number {
  if (!alignment) return 0;
  if (alignment.words?.length) {
    const last = alignment.words[alignment.words.length - 1];
    const first = alignment.words[0];
    if (last && first) return Math.max(0, last.endMs - Math.min(0, first.startMs));
  }
  let span = 0;
  for (const c of alignment.chunks) span = Math.max(span, c.endMs);
  const base = alignment.chunks.reduce((m, c) => Math.min(m, c.startMs), Number.POSITIVE_INFINITY);
  return Number.isFinite(base) ? Math.max(0, span - base) : 0;
}

function findChunk(alignment: Alignment, chunkId: string): AlignmentChunk | undefined {
  return alignment.chunks.find((c) => c.chunkId === chunkId);
}

/** Split on sentence-ending punctuation followed by whitespace. Keeps the
 *  terminator with its sentence so the reconstructed text is lossless. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Build a nominal alignment from a scene's own declared window. Lets a
 *  hand-authored IR resolve to real time windows before any TTS has been
 *  spent — which is what makes the Stage 1 milestone testable without
 *  burning narration credits. */
export function nominalAlignment(scene: Scene, startMs: number, durationMs: number): Alignment {
  const sentences = splitSentences(scene.narration.text);
  const totalChars = sentences.reduce((a, t) => a + t.length, 0) || 1;
  let at = startMs;
  const chunks: AlignmentChunk[] = sentences.map((text, i) => {
    const share = (text.length / totalChars) * durationMs;
    const chunk: AlignmentChunk = {
      chunkId: `${scene.sceneId}_c${i + 1}`,
      startMs: Math.round(at),
      endMs: Math.round(at + share),
      text,
    };
    at += share;
    return chunk;
  });
  if (chunks.length === 0) {
    chunks.push({
      chunkId: `${scene.sceneId}_c1`,
      startMs,
      endMs: startMs + durationMs,
      text: scene.narration.text,
    });
  }
  return { sceneId: scene.sceneId, chunks };
}
