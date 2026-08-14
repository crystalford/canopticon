// THE FILM'S NARRATION TIMELINE — the measured spine, in one object.
//
// The architecture was already narration-first: a scene says "start where
// chunk c_04 starts", the solver resolves that against a frozen alignment,
// and re-recording the voice re-times the film. What was missing is that
// the measurement reached exactly ONE consumer — the scene window — and
// nothing else could see it. Everything the recording knows beyond "how
// long is this scene" was computed, frozen in R2, and read by nobody.
//
// So: one derived object, built from the frozen alignments and the solver's
// own windows, that the rest of the compiler may read.
//
//     WINDOW    where a scene sits          (already true; now labelled)
//     PAUSE     the measured silence        the world may move here
//     RATE      how fast it was actually spoken
//     SPINE     which of this is measured and which is invented
//
// Two rules govern it. It is DERIVED — nothing here is a new artifact, a
// new model call or a new source of truth; delete this file and the film
// still compiles, it just gets stupider. And it is HONEST — a film with no
// narration reports `spine: "nominal"` rather than presenting fabricated
// windows as if they were measurements, which is what the compiler did
// silently before.

import type { Alignment } from "../compile/solver.ts";
import type { SolveResult } from "../compile/solver.ts";
import type { EditorialIR } from "../ir/schema.ts";

/** Whether a scene's window came off a recording or out of an estimate.
 *  The distinction the compiler used to erase. */
export type WindowSource = "measured" | "nominal";

export interface TimelineScene {
  sceneId: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  source: WindowSource;
  /** Measured silence at the head of this scene — the gap between the end
   *  of the previous scene's last spoken chunk and the start of this one's
   *  first. Zero when either side is unmeasured. */
  leadPauseMs: number;
  /** Words per minute, measured. Null when unmeasured. */
  wordsPerMin: number | null;
  /** This scene's rate against the film's own median. 1 is the film's
   *  normal pace; >1 is faster than the film usually speaks. Null when
   *  unmeasured, or when the film has nothing to compare against. */
  relativeRate: number | null;
}

export interface TimelinePause {
  atMs: number;
  ms: number;
  /** BREATH within a scene, BEAT between two scenes, ACT at a boundary
   *  the essay's own structure declared. */
  kind: "breath" | "beat" | "act";
  beforeSceneId: string;
}

export interface FilmTimeline {
  totalMs: number;
  /** How much of the runtime rests on a real recording. */
  measuredMs: number;
  scenes: TimelineScene[];
  pauses: TimelinePause[];
  /** The film's own median speech rate, or null if nothing was measured. */
  medianWordsPerMin: number | null;
  spine: "measured" | "mixed" | "nominal";
  /** Plain sentence for the operator. The Compile view prints this. */
  describes: string;
}

/** A pause shorter than this is articulation, not a rest. Below it the
 *  gap between two sentences is the speaker closing their mouth. */
const MIN_PAUSE_MS = 120;
/** Above this it stops being a breath and starts being a hole; the
 *  measurement is more likely wrong than the delivery is that slow. */
const MAX_PAUSE_MS = 2_400;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0
    ? ((s[mid - 1] as number) + (s[mid] as number)) / 2
    : (s[mid] as number);
}

/** BUILD THE TIMELINE.
 *
 *  `alignments` is the map the compiler already holds — scene-local times
 *  from the frozen artifacts, plus nominal stand-ins for scenes that have
 *  not been recorded. `measured` says which sceneIds are the real ones;
 *  without it this could not tell a measurement from an estimate, and
 *  reporting an estimate as measured is the exact dishonesty this file
 *  exists to end. */
export function buildTimeline(
  ir: EditorialIR,
  alignments: Map<string, Alignment>,
  timing: SolveResult,
  measured: Set<string>,
): FilmTimeline {
  const scenes: TimelineScene[] = [];
  const pauses: TimelinePause[] = [];

  // Pass one: windows and rates, per scene.
  const rates: number[] = [];
  for (const scene of ir.scenes) {
    const solved = timing.scenes.find((s) => s.sceneId === scene.sceneId);
    if (!solved) continue;
    const isMeasured = measured.has(scene.sceneId);
    const n = words(scene.narration.text);
    const wpm = isMeasured && solved.durationMs > 0 ? n / (solved.durationMs / 60_000) : null;
    if (wpm !== null && Number.isFinite(wpm) && wpm > 0) rates.push(wpm);
    scenes.push({
      sceneId: scene.sceneId,
      startMs: solved.startMs,
      endMs: solved.endMs,
      durationMs: solved.durationMs,
      source: isMeasured ? "measured" : "nominal",
      leadPauseMs: 0,
      wordsPerMin: wpm,
      relativeRate: null,
    });
  }

  const med = median(rates);
  for (const s of scenes) {
    s.relativeRate = med && s.wordsPerMin ? s.wordsPerMin / med : null;
  }

  /* Pass two: the silences.
   *
   * A scene's frozen alignment is SCENE-LOCAL and starts at 0, so the
   * silence at the head of a scene is not visible inside that scene's own
   * artifact — it is the difference between where the solver placed the
   * scene and where the previous scene's speech actually stopped. Which is
   * why this needs both, and why it lives here rather than in `align.ts`.
   *
   * Only counted between two MEASURED scenes. A gap next to an invented
   * window is a fact about the estimate, not about the delivery. */
  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1] as TimelineScene;
    const here = scenes[i] as TimelineScene;
    if (prev.source !== "measured" || here.source !== "measured") continue;
    const prevAlign = alignments.get(prev.sceneId);
    const lastChunk = prevAlign?.chunks[prevAlign.chunks.length - 1];
    const spokeUntil = lastChunk ? prev.startMs + lastChunk.endMs : prev.endMs;
    const gap = here.startMs - spokeUntil;
    if (gap < MIN_PAUSE_MS) continue;
    const ms = Math.min(gap, MAX_PAUSE_MS);
    here.leadPauseMs = ms;
    const irPrev = ir.scenes.find((s) => s.sceneId === prev.sceneId);
    const irHere = ir.scenes.find((s) => s.sceneId === here.sceneId);
    pauses.push({
      atMs: spokeUntil,
      ms,
      kind: irPrev && irHere && irPrev.actId !== irHere.actId ? "act" : "beat",
      beforeSceneId: here.sceneId,
    });
  }

  /* Pass three: the breaths INSIDE a scene. A scene that resolved to
   * several measured chunks has silences between them, and those are the
   * ones a viewer actually hears as the film thinking. */
  for (const s of scenes) {
    if (s.source !== "measured") continue;
    const a = alignments.get(s.sceneId);
    if (!a) continue;
    for (let k = 1; k < a.chunks.length; k++) {
      const before = a.chunks[k - 1] as { endMs: number };
      const at = a.chunks[k] as { startMs: number };
      const gap = at.startMs - before.endMs;
      if (gap < MIN_PAUSE_MS) continue;
      pauses.push({
        atMs: s.startMs + before.endMs,
        ms: Math.min(gap, MAX_PAUSE_MS),
        kind: "breath",
        beforeSceneId: s.sceneId,
      });
    }
  }
  pauses.sort((a, b) => a.atMs - b.atMs);

  const measuredMs = scenes
    .filter((s) => s.source === "measured")
    .reduce((a, s) => a + s.durationMs, 0);
  const measuredCount = scenes.filter((s) => s.source === "measured").length;
  const spine: FilmTimeline["spine"] =
    measuredCount === 0 ? "nominal" : measuredCount === scenes.length ? "measured" : "mixed";

  return {
    totalMs: timing.runtimeMs,
    measuredMs,
    scenes,
    pauses,
    medianWordsPerMin: med,
    spine,
    describes:
      spine === "measured"
        ? `every window measured off the recording — ${pauses.length} pause${pauses.length === 1 ? "" : "s"}, ${med ? Math.round(med) : "?"} wpm`
        : spine === "nominal"
          ? "no narration recorded — every window is an estimate, not a measurement"
          : `${measuredCount} of ${scenes.length} windows measured; the rest are estimates pending narration`,
  };
}

/** How long a scene's world may spend arriving.
 *
 *  THE ONE PLACE THIS IS DECIDED (standing rule 9). A bridge runs in the
 *  measured silence at the head of the scene, because that is the moment a
 *  human editor uses for exactly this and it is the one moment in the film
 *  where a change of picture competes with nothing.
 *
 *  Clamped to a fraction of the window so a long rest cannot swallow the
 *  scene, and floored at nothing: a scene arriving on top of continuous
 *  speech gets no bridge and cuts, which is the honest reading of prose
 *  that does not pause. */
export function bridgeMsFor(scene: TimelineScene, fallbackMs = 0): number {
  const pause = scene.leadPauseMs > 0 ? scene.leadPauseMs : fallbackMs;
  if (pause <= 0) return 0;
  return Math.round(Math.min(pause, scene.durationMs * 0.4));
}
