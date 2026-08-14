import { DEFAULT_COLOUR } from "../ir/schema.ts";
// Segmentation — an essay becomes an IR.
//
// This is the door the system did not have. Everything downstream of it was
// built and tested against a hand-authored IR: the solver, the composition
// engine, treatment planning, the cut, the cache. None of it could be
// reached by pasting in prose, which meant the whole compiler was a machine
// with no intake.
//
//   essay text → acts → scenes → figures → a compilable IR
//
// DETERMINISTIC, AND NO MODEL. Not as an optimisation — as the design. The
// segmenter's decisions are all checkable against the text: where the
// headings are, where the sentences end, what character offset each scene
// occupies, which quantities are printed. A model is neither needed nor
// wanted for any of that, and standing rule 1 means anything a model DID
// contribute would have to be frozen, hashed and ratified first.
//
// What this deliberately does NOT do is decide what a sentence is ABOUT.
// That is an interpretation, it belongs to `extract-reading.ts`, and a
// scene without one falls back to the film's own abstraction curve. A
// segmenter that guessed subjects would look far more impressive and would
// quietly take the film's trajectory with it — which is exactly what
// happened the first time, on the abstract essay, when a fallback reading
// hardcoded every subject to `object` and nineteen scenes collapsed to one
// body plan.

import type { Act, EditorialIR, Scene } from "../ir/schema.ts";
import { extractFigures, extractRoute } from "./figures.ts";

/** Reading pace. 380ms per word is a slow, deliberate documentary read —
 *  and it is only a NOMINAL duration anyway: once narration is generated,
 *  the frozen alignment replaces every one of these. */
const MS_PER_WORD = 380;
/** Matches the solver's own floors and ceilings, so segmentation does not
 *  hand the solver a window it will immediately have to split or pad. */
const MIN_SCENE_MS = 1800;
const MAX_SCENE_MS = 12_000;

export interface SegmentOptions {
  projectId: string;
  title?: string;
}

export interface SegmentReport {
  ir: EditorialIR;
  /** What the segmenter noticed and could not act on, in its own words.
   *  Reported rather than silently absorbed — same discipline as the
   *  compile report's warnings. */
  notes: string[];
  stats: {
    acts: number;
    scenes: number;
    scenesWithFigures: number;
    scenesWithRoutes: number;
    runtimeMs: number;
  };
}

/** A heading is a short line with no terminal punctuation. That is the
 *  whole rule, and it is enough: an essay that uses headings marks its own
 *  structure, and an essay that does not gets one act, which is correct
 *  rather than a failure. Inferring section boundaries from meaning would
 *  be the segmenter deciding what the argument is. */
function isHeading(line: string): boolean {
  const t = line.trim();
  if (t.length === 0 || t.length > 90) return false;
  if (t.startsWith("*") || t.startsWith("-")) return false;
  return !/[.!?;:,]$/.test(t) || /^[A-Z0-9][^.!?]*:$/.test(t);
}

/** Split a paragraph into sentences. Abbreviations are the classic trap;
 *  this keeps a period attached when what follows is not a sentence start. */
function sentencesOf(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+(?=["“'(]?[A-Z0-9$])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Where a scene sits in the essay, found by scanning FORWARD from the last
 *  scene rather than by searching the whole text. A repeated sentence —
 *  "Nothing changed." appears more than once in a shell-game essay — would
 *  otherwise bind every occurrence to the first one, and the IR's promise
 *  that a scene names a real span of the essay would quietly be false. */
function advance(essay: string, needle: string, from: number): [number, number] {
  const at = essay.indexOf(needle, from);
  if (at < 0) return [from, from + needle.length];
  return [at, at + needle.length];
}

/** How long this scene wants to be, before the solver has its say. */
function nominalMs(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(MIN_SCENE_MS, Math.min(MAX_SCENE_MS, words * MS_PER_WORD));
}

/** Openers that mark a reversal. A sentence beginning with one of these is
 *  a turn regardless of what else it contains — which is the one piece of
 *  narrative structure that IS mechanically visible in prose. */
const TURN_OPENERS = [
  "but ",
  "yet ",
  "however",
  "actually",
  "in fact",
  "instead",
  "except",
  "nothing changed",
  "what actually",
  "the reality",
  "the practical reality",
  "this is not",
  "it was not",
];

function narrativeFunction(
  text: string,
  isFirstOfFilm: boolean,
  isFirstOfAct: boolean,
  isLastOfFilm: boolean,
  hasFigures: boolean,
): Scene["narrativeFunction"] {
  if (isFirstOfFilm) return "hook";
  if (isLastOfFilm) return "resolve";
  const lower = text.toLowerCase();
  if (TURN_OPENERS.some((o) => lower.startsWith(o))) return "turn";
  // A figure is evidence by construction — it is the sentence offering a
  // receipt — and that outranks position, because a section that opens with
  // a number is not establishing anything, it is proving something.
  if (hasFigures) return "evidence";
  if (isFirstOfAct) return "establish";
  return "evidence";
}

/** A short label for the Editorial view. The first few strong words, which
 *  is what a human writing a shot list would have written anyway. */
function labelOf(text: string): string {
  const words = text
    // Apostrophes and hyphens are part of the word. Stripping them turned
    // "Ontario's share" into "Ontario s share" — and since the label is what
    // goes on screen as type, that was a rendering error printed at 40px.
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\w\s$,.%'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  // Drop a leading article: "THE PROGRAM WHICH HAD" reads worse than
  // "PROGRAM WHICH HAD COST" on a card, and the article carries nothing.
  if (words.length > 3 && /^(the|a|an)$/i.test(words[0] as string)) words.shift();
  return words.slice(0, 5).join(" ").slice(0, 48);
}

export function segmentEssay(essay: string, options: SegmentOptions): SegmentReport {
  const notes: string[] = [];
  const lines = essay.split("\n");

  // Pass 1: walk the lines, collecting act boundaries and scene texts. The
  // first line is the title when it is a heading — an essay usually names
  // itself, and taking that as an act would open the film on its own title
  // card.
  const acts: Act[] = [];
  /* THE PARAGRAPH SURVIVES.
   *
   * `raw` below IS a paragraph — the loop is over the essay's own lines —
   * and until now only `actId` and `text` came out of it, so every
   * sentence became a peer scene under an act and the paragraph was
   * dropped on the floor.
   *
   * The essay has four levels of structure and the IR kept two:
   *
   *   essay      → film     kept
   *   section    → act      kept — the essay's own headings
   *   paragraph  → —        DISCARDED, here
   *   sentence   → scene    kept
   *
   * The missing one is the level a director works at. "These five
   * sentences are one idea and collectively deserve one visual
   * development" cannot be said about five peers, and nothing downstream
   * could reconstruct the grouping because the only thing tying them
   * together was the loop iteration that had already ended.
   *
   * Carried, not inferred: `sourceRange` still binds every scene to its
   * own span, so the grouping is checkable against the prose. */
  const seeds: { actId: string; passageId: string; text: string }[] = [];
  let passage = 0;
  /** A bullet list is ONE idea enumerated, not N ideas. Consecutive
   *  bullets share a passage; a paragraph after them starts a new one. */
  let lastWasBullet = false;
  let title = options.title ?? "";
  let seenBody = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;

    if (isHeading(line)) {
      if (!seenBody && title === "") {
        title = line;
        continue;
      }
      acts.push({ actId: `act_${acts.length + 1}`, title: line });
      continue;
    }

    seenBody = true;
    if (acts.length === 0) acts.push({ actId: "act_1", title: "" });
    const actId = (acts[acts.length - 1] as Act).actId;

    // A bullet is one scene, whole. Splitting "Peak occupancy: 7,000 people
    // (July 2023)" into fragments would strip the figure of the thing it is
    // a figure OF.
    if (line.startsWith("*") || line.startsWith("-")) {
      if (!lastWasBullet) passage++;
      lastWasBullet = true;
      seeds.push({
        actId,
        passageId: `p${String(passage).padStart(3, "0")}`,
        text: line.replace(/^[*-]\s*/, ""),
      });
      continue;
    }
    lastWasBullet = false;
    passage++;
    const passageId = `p${String(passage).padStart(3, "0")}`;
    for (const s of sentencesOf(line)) seeds.push({ actId, passageId, text: s });
  }

  if (seeds.length === 0) {
    notes.push("no prose found — the essay segmented to zero scenes");
  }
  if (acts.length === 1 && (acts[0] as Act).title === "") {
    notes.push("no headings found — the film is one act, which is the essay's own shape");
  }

  // Pass 2: scenes. Offsets advance monotonically so a repeated sentence
  // binds to its own occurrence.
  const scenes: Scene[] = [];
  let cursor = 0;
  let withFigures = 0;
  let withRoutes = 0;
  let runtimeMs = 0;
  const seenActs = new Set<string>();

  seeds.forEach((seed, i) => {
    const [startChar, endChar] = advance(essay, seed.text, cursor);
    cursor = endChar;

    const figures = extractFigures(seed.text);
    const route = extractRoute(seed.text);
    if (figures.length > 0) withFigures++;
    if (route.length >= 2) withRoutes++;

    const isFirstOfAct = !seenActs.has(seed.actId);
    seenActs.add(seed.actId);

    const durationMs = nominalMs(seed.text);
    const sceneId = `s${String(i + 1).padStart(3, "0")}`;

    scenes.push({
      sceneId,
      actId: seed.actId,
      passageId: seed.passageId,
      label: labelOf(seed.text),
      narrativeFunction: narrativeFunction(
        seed.text,
        i === 0,
        isFirstOfAct,
        i === seeds.length - 1,
        figures.length > 0,
      ),
      status: "draft",
      sourceRange: { startChar, endChar },
      narration: { text: seed.text, alignmentGranularity: "chunk" },
      timing: {
        // Anchors, never frames. Before narration exists these name chunks
        // that do not exist yet, which is exactly right: the solver falls
        // back to nominal windows and flags it, and when the frozen
        // alignment arrives the same anchors resolve to real time.
        startAnchor: { chunkId: `${sceneId}_start`, offsetMs: 0 },
        endAnchor: { chunkId: `${sceneId}_end`, offsetMs: 0 },
        // The READING TIME, not the floor. An earlier version set this to
        // MIN_SCENE_MS and threw the computed duration away, so every scene
        // in an 88-scene film came out 1.8 seconds long, the whole film ran
        // 158 seconds, and no scene was ever long enough for the cut
        // rhythm to fire — the edit silently did not exist.
        minDurationMs: durationMs,
        maxDurationMs: MAX_SCENE_MS,
        // A scene carrying a figure is RIGID. A viewer reading a number off
        // the screen cannot be hurried by a neighbouring scene's overflow,
        // and the solver's cascade will move everything else instead.
        elasticity: figures.length > 0 ? "rigid" : "elastic",
      },
      entities: [],
      blocks: [],
      figures: figures.length > 0 ? figures : undefined,
      route: route.length >= 2 ? route : undefined,
    });
    runtimeMs += durationMs;
  });

  // The creative state. Three control points describing the one trajectory
  // that is true of essays in general — open concrete, end further out —
  // and nothing more. This is a STARTING CURVE, not a reading of the essay:
  // the director drags it, and dragging it is the cheap loop the whole
  // architecture exists to make cheap.
  const firstAct = (acts[0] as Act | undefined)?.actId ?? "act_1";
  const lastAct = (acts[acts.length - 1] as Act | undefined)?.actId ?? firstAct;

  const ir: EditorialIR = {
    $schema: "https://canopticon.dev/schemas/v0/editorial-ir.json",
    projectId: options.projectId,
    title: title || "Untitled",
    irVersion: "0.1.0",
    // The segmenter never guesses how a film should move. CUT is the
    // conventional default and what every film composed before the world
    // existed already was; the Create screen writes the operator's answer.
    continuity: "cut",
    // HYBRID leaves every representation weight alone, so a segmented
    // film composes exactly as it did before the axis existed.
    visualApproach: "hybrid",
    typeRegister: "auto",
    essay,
    acts,
    // THE FULL VOCABULARY, not a subset.
    //
    // An earlier version authored four parameters — restraint, density,
    // motionEnergy, cutRhythm — and a curve carrying only `abstraction`.
    // Every view in the instrument drives nine, so a segmented film opened
    // into a console reading undefined off half its own creative state.
    // The vocabulary is the DESIGN's, and the compiler has to speak all of
    // it or the two halves are not the same product.
    //
    // These values are a STARTING TRAJECTORY, not a reading of the essay:
    // open concrete and archival, end further out and more kinetic, which
    // is true of essays in general and of this one in particular. The
    // director drags them, and dragging them is the cheap loop the whole
    // architecture exists to make cheap — no TTS, no model, no re-render
    // of anything whose inputs did not change.
    creativeState: {
      identity: {
        restraint: 0.55,
        experimentalism: 0.35,
        typographicWeight: 0.45,
        cutRhythm: 0.35,
      },
      controlPoints: [
        {
          at: { actId: firstAct, position: "start" },
          values: {
            abstraction: 0.2,
            archivalWeight: 0.62,
            dataWeight: 0.3,
            visualDensity: 0.42,
            humanPresence: 0.45,
            motionEnergy: 0.28,
          },
        },
        {
          at: { position: 0.5 },
          values: {
            abstraction: 0.42,
            archivalWeight: 0.4,
            dataWeight: 0.55,
            visualDensity: 0.62,
            humanPresence: 0.36,
            motionEnergy: 0.5,
          },
        },
        {
          at: { actId: lastAct, position: "end" },
          values: {
            abstraction: 0.62,
            archivalWeight: 0.22,
            dataWeight: 0.38,
            visualDensity: 0.5,
            humanPresence: 0.55,
            motionEnergy: 0.72,
          },
        },
      ],
      interpolation: "smooth",
      // A floor on human presence and a ceiling on density: the two ways a
      // documentary compiler most easily stops being watchable. They
      // REPORT when they bite rather than silently absorbing the curve.
      invariants: [
        { param: "humanPresence", min: 0.3 },
        { param: "visualDensity", max: 0.92 },
      ],
    },
    motifs: [],
    rules: [],
    overrides: [],
    entities: [],
    assets: [],
    scenes,
    visualLanguage: "documentary",
    cinematography: { colour: DEFAULT_COLOUR },
    renderProfile: "default",
  };

  if (withFigures > 0) {
    notes.push(
      `${withFigures} of ${scenes.length} scenes carry a figure — those plan from the data family without needing a reading`,
    );
  }
  if (withRoutes > 0) {
    notes.push(`${withRoutes} scenes name a route the prose drew explicitly`);
  }
  notes.push("no readings proposed — run extraction to decide what each sentence is ABOUT");

  return {
    ir,
    notes,
    stats: {
      acts: acts.length,
      scenes: scenes.length,
      scenesWithFigures: withFigures,
      scenesWithRoutes: withRoutes,
      runtimeMs,
    },
  };
}
