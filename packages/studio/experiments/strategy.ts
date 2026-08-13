// COMPOSITIONAL STRATEGY — meaning as a sequence of visual decisions.
//
// THE THING EVERY PREVIOUS LAYER WAS MISSING.
//
// Constructions answered "what should this sentence be built as".
// Visual languages answered "what kind of picture is this".
// The synthesizer answered "what graphs are legal".
//
// All three answer the same question — WHAT DOES THIS SENTENCE LOOK LIKE —
// and all three produce a single static composition per beat. A film is
// not a sequence of compositions. It is a sequence of DECISIONS, and the
// decisions happen in time:
//
//   important word → scale → repetition → collision → fragmentation → cut
//
// That progression is what makes a shot feel authored rather than merely
// type-valid, and nothing in the system could express it. A beat got one
// chain and held it for four seconds.
//
// SO A STRATEGY IS A SEQUENCE OF MOVES.
//
// A MOVE is a visual decision: INTRODUCE, SCALE, REPEAT, FRAGMENT, FIELD,
// COLLIDE, INVERT, RESOLVE. The move names are SHARED across every
// strategy — that is the whole design. TYPOGRAPHIC's REPEAT and
// GEOMETRIC's REPEAT are the same decision realised in different material,
// which is what makes it possible to cross from one strategy to another
// mid-beat without either of them knowing about the other.
//
//   strategy = an ARC (which moves, in what order, for this beat)
//            + a REALISATION (what each move is, in this material)
//
// The arc reads the sentence: a beat with a printed count earns a REPEAT,
// a beat with a relation earns a COLLIDE, an escalating beat ends on
// FRAGMENT rather than RESOLVE. So the same strategy produces different
// editing for different prose — which is the property recipes never had.
//
// Each move becomes its own SHOT with its own window, so a beat is cut
// rather than held. That is where rhythm comes from, and rhythm is most of
// what "want to watch the next thirty seconds" actually means.
//
// Built beside the compiler. Nothing here is wired into production.

import type { PlannedNode } from "../src/compile/construct.ts";
import type { Relation } from "../src/compile/relation.ts";
import type { DetectedSubject } from "../src/compile/subject.ts";
import { type TypeComposition, composeType, significantWords } from "../src/compile/words.ts";

export type MoveKind =
  /** State it plainly. The thing, once, legible. */
  | "INTRODUCE"
  /** Make it monumental. One decision: bigger than the frame expects. */
  | "SCALE"
  /** Multiply it. The count comes off the prose, never chosen for effect. */
  | "REPEAT"
  /** Take it apart into what it is made of. */
  | "FRAGMENT"
  /** Let it stop being an object and become texture. */
  | "FIELD"
  /** Two things at once — the only move that needs a relation. */
  | "COLLIDE"
  /** Flip it. Ground becomes figure. */
  | "INVERT"
  /** Let it settle into something that can be looked at. */
  | "RESOLVE";

export interface MoveCtx {
  words: TypeComposition;
  subjects: DetectedSubject[];
  relation: Relation | null;
  /** A count the prose printed, or null. Never invented. */
  count: number | null;
  place: string | null;
  /** 0..1 through the passage — strategies escalate. */
  progress: number;
  seed: number;
}

export interface Strategy {
  id: string;
  name: string;
  feels: string;
  argument: string;
  /** The temporal spine for THIS beat, read off the sentence. */
  arc(ctx: MoveCtx): MoveKind[];
  /** The move, in this strategy's own material. */
  realise(move: MoveKind, ctx: MoveCtx): PlannedNode[];
}

const n = (
  primitiveId: string,
  params: Record<string, number | string>,
  reason: string,
): PlannedNode => ({ primitiveId, params, reason });

/** Seeded. Standing rule 4 holds in an experiment too. */
function rand(seed: number, salt: number): number {
  let h = (seed * 2654435761 + salt * 40503) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 0xffffffff;
}

/** THE DEFAULT ARC, and the reason a strategy rarely needs its own.
 *
 *  Read off the sentence rather than chosen: a printed count earns a
 *  REPEAT, a relation earns a COLLIDE, a beat late in the passage ends
 *  on FRAGMENT instead of RESOLVE because a passage should not end where
 *  it started. A strategy overrides this only where its material genuinely
 *  wants a different order. */
function defaultArc(ctx: MoveCtx): MoveKind[] {
  const moves: MoveKind[] = ["INTRODUCE"];
  if (ctx.count !== null) moves.push("REPEAT", "SCALE");
  else if (ctx.relation) moves.push("COLLIDE", "SCALE");
  else moves.push("SCALE");
  if (ctx.progress > 0.55) moves.push("FRAGMENT");
  moves.push(ctx.progress > 0.7 ? "FIELD" : "RESOLVE");
  return moves;
}

const headline = (c: MoveCtx) => c.words.headline?.text ?? c.words.all[0]?.text ?? "THE CITY";
const second = (c: MoveCtx) => c.words.sub?.text ?? c.words.all[1]?.text ?? headline(c);
const repeatWord = (c: MoveCtx) => c.words.repeat?.word.text ?? second(c);
const repeatCount = (c: MoveCtx) =>
  Math.max(2, Math.min(14, Math.round(Math.sqrt(c.count ?? c.words.repeat?.times ?? 36))));

/* ════════════════════════════════════════════════════════════════════
   A · TYPOGRAPHIC — the sentence is the material.
   ═══════════════════════════════════════════════════════════════════ */
const TYPOGRAPHIC: Strategy = {
  id: "TYPOGRAPHIC",
  name: "Typographic",
  feels: "declarative · compressed · editorial",
  argument: "The script's own words, at scale, repeated and cut.",
  arc(ctx) {
    const m: MoveKind[] = ["SCALE", "INTRODUCE"];
    if (ctx.count !== null) m.push("REPEAT", "SCALE");
    if (ctx.relation) m.push("COLLIDE");
    if (ctx.progress > 0.5) m.push("FRAGMENT");
    m.push(ctx.progress > 0.75 ? "FIELD" : "RESOLVE");
    return m;
  },
  realise(move, c) {
    switch (move) {
      case "SCALE":
        return [
          n(
            "text_layout",
            { text: headline(c), mode: 0, tracking: 0.06, scale: 1 },
            "the word, monumental",
          ),
        ];
      case "INTRODUCE":
        return [
          n(
            "text_layout",
            { text: second(c), mode: 2, tracking: 0.55, scale: 0.22 },
            "and the word under it, small",
          ),
        ];
      case "REPEAT":
        return [
          n(
            "text_repeat",
            { text: repeatWord(c), count: repeatCount(c), scatter: 0.06, fade: 0.35 },
            `${repeatWord(c)} × ${repeatCount(c) ** 2} — the prose printed the count`,
          ),
        ];
      case "COLLIDE":
        return [
          n(
            "text_morph",
            {
              from: (c.relation?.agent?.text ?? headline(c)).toUpperCase(),
              to: (c.relation?.patient?.text ?? second(c)).toUpperCase(),
              rate: 0.55,
            },
            "one word becoming another",
          ),
        ];
      case "FRAGMENT":
        return [
          n(
            "glyph_geometry",
            { text: headline(c), sampling: 3, scale: 0.95, rotate: 0 },
            "the word as points",
          ),
          n(
            "geometry_morph",
            { amount: 0.7, mode: 2, turbulence: 0.4, period: 0.7 },
            "coming apart",
          ),
        ];
      case "FIELD":
        return [
          n(
            "text_repeat",
            { text: repeatWord(c), count: 12, scatter: 0.45, fade: 0.75 },
            "the word as texture",
          ),
          // No raster tail. GEOMETRY does not feed a threshold, and this
          // strategy would rather lose the contrast than lose the type.
          n("geometry_morph", { amount: 0.5, mode: 1, turbulence: 0.55, period: 0.9 }, "drifting"),
        ];
      default:
        return [
          n(
            "glyph_to_path",
            { text: headline(c), weight: 0.35, dash: 0.15 },
            "the word, outlined, held",
          ),
        ];
    }
  },
};

/* ════════════════════════════════════════════════════════════════════
   B · GEOMETRIC — meaning as spatial relationship.
   ═══════════════════════════════════════════════════════════════════ */
const GEOMETRIC: Strategy = {
  id: "GEOMETRIC",
  name: "Geometric",
  feels: "constructed · exact · modernist",
  argument: "Shape and arrangement. A circle need not pretend to be a city.",
  arc: defaultArc,
  realise(move, c) {
    const sides = 3 + ((c.words.headline?.text.length ?? 5) % 7);
    switch (move) {
      case "INTRODUCE":
        return [
          n("parametric_curve", { mode: 0, k: 1 + (sides % 8), reveal: 0.95 }, "one figure, drawn"),
        ];
      case "SCALE":
        return [
          n(
            "shape_morph",
            { sides_a: sides, sides_b: 3, rate: 0.35 },
            `${sides} sides becoming three`,
          ),
          n("geometry_draw", { weight: 0.85, halftone: 0, invert: 0, trail: 0.15 }, "held large"),
        ];
      case "REPEAT":
        return [
          n(
            "particle_emitter",
            { rate: Math.min(1, (c.count ?? 40) / 120), life: 0.75, spread: 0.55, gravity: 0.05 },
            `${c.count ?? "many"} marks, counted out`,
          ),
          n("particle_connect", { count: 0.5, radius: 0.28, drift: 0.2 }, "and their adjacencies"),
        ];
      case "COLLIDE":
        return [
          n("parametric_curve", { mode: 1, k: 3, reveal: 1 }, "the first form"),
          n("boolean_ops", { op: 1, offset: 0.3, size: 0.5 }, "intersected with the second"),
        ];
      case "FRAGMENT":
        return [
          n("recursive_geometry", { depth: 7, angle: 0.42, decay: 0.72 }, "the form subdividing"),
        ];
      case "FIELD":
        return [n("voronoi", { cells: 0.62, drift: 0.4, fill: 0.12 }, "the plane, subdivided")];
      case "INVERT":
        return [
          n(
            "geometry_draw",
            { weight: 0.6, halftone: 0.4, invert: 1, trail: 0.3 },
            "figure and ground swapped",
          ),
        ];
      default:
        return [
          n("fractal", { depth: 4, ratio: 0.55, rotate: 0.15 }, "settled into a stable figure"),
        ];
    }
  },
};

/* ════════════════════════════════════════════════════════════════════
   C · DIAGRAMMATIC — meaning as relationship.
   ═══════════════════════════════════════════════════════════════════ */
const series = (c: MoveCtx) =>
  c.words.all
    .filter((w) => w.weight >= 0.3)
    .slice(0, 8)
    .map((w) => `${w.text}@${Math.round(w.weight * 100)}`)
    .join("|") || "TERM@40";

const DIAGRAMMATIC: Strategy = {
  id: "DIAGRAMMATIC",
  name: "Diagrammatic",
  feels: "forensic · explanatory · cold",
  argument: "The argument drawn as a system — nodes, edges, revelation.",
  arc(ctx) {
    const m: MoveKind[] = ["INTRODUCE", "REPEAT"];
    if (ctx.relation) m.push("COLLIDE");
    m.push(ctx.progress > 0.5 ? "FIELD" : "SCALE", "RESOLVE");
    return m;
  },
  realise(move, c) {
    const s = { series: series(c), caption: headline(c), reveal: 0.95 };
    switch (move) {
      case "INTRODUCE":
        return [
          n("data_series", s, "the terms"),
          n("force_layout", { nodes: 0.3, charge: 0.5, link: 0.35 }, "as a topology"),
          n("graph_reveal", { rate: 0.75, order: 0, nodes: 0.3 }, "assembling itself"),
        ];
      case "REPEAT":
        return [
          n("data_series", s, "the terms"),
          n("force_layout", { nodes: 0.85, charge: 0.4, link: 0.7 }, "many more of them"),
          n("graph_reveal", { rate: 0.9, order: 1, nodes: 0.9 }, "the whole graph at once"),
        ];
      case "COLLIDE":
        return [
          n("data_series", s, "the stages"),
          n(
            "sankey_flow",
            {
              nodes: 3,
              thickness: 0.55,
              curve: 0.6,
              route: `${(c.relation?.agent?.text ?? headline(c)).toUpperCase()} → ${(c.relation?.patient?.text ?? second(c)).toUpperCase()}`,
            },
            "flow between stages",
          ),
        ];
      case "SCALE":
        return [
          n("data_series", s, "the terms"),
          n(
            "hierarchy_layout",
            { kind: 1, depth: 4, split: 0.5 },
            "nested — the system contains itself",
          ),
        ];
      case "FIELD":
        return [
          n("data_series", s, "the terms"),
          n("data_to_particles", { perUnit: 0.75, gather: 0.25, jitter: 0.3 }, "as a distribution"),
          n(
            "particle_connect",
            { count: 0.8, radius: 0.3, drift: 0.35 },
            "everything adjacent to everything",
          ),
        ];
      default:
        return [
          n("data_series", s, "the terms"),
          n("chart_radial", { kind: 1, inner: 0.3, spread: 0.8 }, "closed into a figure"),
        ];
    }
  },
};

/* ════════════════════════════════════════════════════════════════════
   D · SIGNAL — meaning as transmission and interference.
   ═══════════════════════════════════════════════════════════════════ */
const SIGNAL: Strategy = {
  id: "SIGNAL",
  name: "Signal",
  feels: "unstable · transmitted · degraded",
  argument: "The statement as a signal — carried, corrupted, recovered.",
  arc(ctx) {
    return ctx.progress > 0.5
      ? ["INTRODUCE", "FRAGMENT", "FIELD", "INVERT", "RESOLVE"]
      : ["INTRODUCE", "FIELD", "FRAGMENT", "RESOLVE"];
  },
  realise(move, c) {
    switch (move) {
      case "INTRODUCE":
        return [
          n(
            "text_layout",
            { text: headline(c), mode: 0, tracking: 0.1, scale: 0.8 },
            "the statement, transmitted",
          ),
          // GEOMETRY cannot feed a raster stage. `particle_trail` is the
          // one bridge to pixels and it is destructive — which for THIS
          // strategy is the point rather than a cost.
          n("particle_trail", { count: 0.75, decay: 0.22, spread: 0.06 }, "carried as marks"),
          n("scanline", { gap: 3, roll: 0.35, bleed: 0.5 }, "read off a surface"),
        ];
      case "FIELD":
        return [
          n("noise_field", { scale: 0.35, octaves: 4, turbulence: 0.6 }, "the carrier"),
          n("flow_field", { scale: 0.4, turbulence: 0.6, density: 0.7 }, "given direction"),
          n(
            "particle_flow",
            { count: 0.75, speed: 0.6, turbulence: 0.5, trail: 0.18 },
            "and traffic",
          ),
        ];
      case "FRAGMENT":
        return [
          n(
            "glyph_to_points",
            { text: headline(c), sampling: 5, jitter: 0.45 },
            "the statement decomposed",
          ),
          n(
            "geometry_morph",
            { amount: 0.85, mode: 1, turbulence: 0.7, period: 0.45 },
            "scattered by interference",
          ),
          n("particle_trail", { count: 0.8, decay: 0.25, spread: 0.05 }, "leaving a wake"),
        ];
      case "INVERT":
        return [
          n("reaction_diffusion", { feed: 0.55, kill: 0.5, scale: 0.6 }, "the medium taking over"),
          n("feedback", { zoom: 0.12, rotate: 0.05, decay: 0.72 }, "fed back into itself"),
        ];
      default:
        return [
          n(
            "text_layout",
            { text: second(c), mode: 1, tracking: 0.2, scale: 0.45 },
            "partially recovered",
          ),
          n("particle_trail", { count: 0.85, decay: 0.28, spread: 0.03 }, "as marks"),
          n("pixel_sort", { threshold: 0.45, direction: 0 }, "the recovery is imperfect"),
        ];
    }
  },
};

/* ════════════════════════════════════════════════════════════════════
   E · MATERIAL — meaning as physical surface.
   ═══════════════════════════════════════════════════════════════════ */
const MATERIAL: Strategy = {
  id: "MATERIAL",
  name: "Material",
  feels: "handled · reproduced · sober",
  argument: "The statement as a document — surface, wear, reproduction, trace.",
  arc(ctx) {
    return ctx.progress > 0.6
      ? ["INTRODUCE", "SCALE", "FRAGMENT", "REPEAT", "RESOLVE"]
      : ["INTRODUCE", "SCALE", "REPEAT", "RESOLVE"];
  },
  realise(move, c) {
    switch (move) {
      case "INTRODUCE":
        return [
          n("document_layout", { kind: 1, columns: 1, age: 0.55, heading: headline(c) }, "a page"),
          n("camera_move", { kind: 0, rate: 0.2, amount: 0.35 }, "read by a moving camera"),
        ];
      case "SCALE":
        return [
          n("document_surface", { age: 0.7, columns: 2, redaction: 0.35 }, "the record, closer"),
          n("halftone", { size: 6, angle: 0.15 }, "printed"),
        ];
      case "REPEAT":
        return [
          n("document_surface", { age: 0.5, columns: 3, redaction: 0.2 }, "another copy"),
          n("tile", { count: 3, mirror: 0, rotate: 0 }, "and another, and another"),
          n("halftone", { size: 4, angle: 0.4 }, "each one printed again"),
        ];
      case "FRAGMENT":
        return [
          n("document_surface", { age: 0.85, columns: 1, redaction: 0.65 }, "mostly withheld"),
          // `redaction` emits ANIMATION and nothing rasters an animation,
          // so the copy-of-a-copy happens on the page BEFORE it is struck
          // through rather than after.
          n("dither", { threshold: 0.5, size: 2 }, "a photocopy of a photocopy"),
          n(
            "redaction",
            { coverage: 0.6, mode: 1, rate: 0.35 },
            "and then what the record does not say",
          ),
        ];
      default:
        return [
          n("document_layout", { kind: 2, columns: 1, age: 0.4, heading: second(c) }, "filed"),
          n("halftone", { size: 8, angle: 0.25 }, "reproduced"),
        ];
    }
  },
};

/* ════════════════════════════════════════════════════════════════════
   F · COMPUTATIONAL — meaning as process.
   ═══════════════════════════════════════════════════════════════════ */
const COMPUTATIONAL: Strategy = {
  id: "COMPUTATIONAL",
  name: "Computational",
  feels: "synthetic · instrumented · emergent",
  argument: "A rule, iterated, until a pattern appears that nobody wrote.",
  arc(ctx) {
    return ctx.progress > 0.5
      ? ["INTRODUCE", "REPEAT", "FIELD", "FRAGMENT", "RESOLVE"]
      : ["INTRODUCE", "SCALE", "REPEAT", "RESOLVE"];
  },
  realise(move, c) {
    switch (move) {
      case "INTRODUCE":
        return [
          n("wireframe", { form: 0, spin: 0.3, subdiv: 5 }, "one solid, described"),
          n("camera_3d", { orbit: 0.25, dolly: 0.2, grid: 0.85 }, "on a grid, at a resolution"),
        ];
      case "SCALE":
        return [
          n("wireframe", { form: 1, spin: 0.5, subdiv: 11 }, "subdivided further"),
          n("camera_3d", { orbit: 0.6, dolly: 0.35, grid: 0.7 }, "seen from inside the system"),
        ];
      case "REPEAT":
        return [
          n("point_cloud", { count: 0.8, spin: 0.35, form: 2 }, "instanced many times"),
          n(
            "particle_connect",
            { count: 0.7, radius: 0.22, drift: 0.15 },
            "and wired to each other",
          ),
        ];
      case "FIELD":
        return [
          n("cellular", { rule: 110, scale: 4, seedmode: 1 }, "rule 110, iterating on itself"),
          n(
            "pixelate",
            { size: 4, quantize: 6 },
            "at a resolution — the raster belongs here, after real pixels",
          ),
        ];
      case "FRAGMENT":
        return [
          n("wireframe", { form: 2, spin: 0.4, subdiv: 8 }, "the solid"),
          n(
            "exploded_view",
            { layers: 6, separation: 0.7, tilt: 0.5 },
            "taken apart into what it is made of",
          ),
        ];
      default:
        return [
          n("data_series", { series: series(c), caption: headline(c), reveal: 1 }, "the readout"),
          n("ui_surface", { kind: 1, items: 7, activity: 0.7 }, "an instrument, running"),
        ];
    }
  },
};

/* ════════════════════════════════════════════════════════════════════
   G · ILLUSTRATIVE — meaning as a world.
   ═══════════════════════════════════════════════════════════════════ */
const ILLUSTRATIVE: Strategy = {
  id: "ILLUSTRATIVE",
  name: "Material world",
  feels: "observational · physical · inhabited",
  argument: "The things the script names — a place, and what moves in it.",
  arc(ctx) {
    return ctx.progress > 0.55
      ? ["INTRODUCE", "SCALE", "REPEAT", "FRAGMENT", "RESOLVE"]
      : ["INTRODUCE", "SCALE", "RESOLVE"];
  },
  realise(move, c) {
    const cars = Math.round(6 + (c.count ?? 20) / 3);
    switch (move) {
      case "INTRODUCE":
        return [
          n(
            "plate_scene",
            { scene: 0, cars: Math.min(30, cars), dusk: 0.55, life: 0.4 },
            `${c.place ?? "the place"}, held`,
          ),
        ];
      case "SCALE":
        return [
          n(
            "plate_scene",
            { scene: 0, cars: Math.min(30, cars * 2), dusk: 0.4, life: 0.7 },
            "closer, and busier",
          ),
          n("drift_parallax", { drift: 0.45, depth: 0.65, sway: 0.3 }, "with depth"),
        ];
      case "REPEAT":
        return [
          n(
            "creature_chain",
            {
              segments: 9,
              legPairs: 2,
              wave: 0.5,
              stride: 0.6,
              gait: 0.6,
              scale: 0.28,
              count: 11,
              wander: 0.18,
              speed: 0.65,
            },
            "many of them, moving in step",
          ),
        ];
      case "FRAGMENT":
        return [
          n("plate_scene", { scene: 1, cars: 18, dusk: 0.3, life: 0.5 }, "the place"),
          n(
            "image_to_points",
            { source: 0, sampling: 6, threshold: 0.35, dissolve: 0.55, drift: 0.4 },
            "coming apart into its own points",
          ),
        ];
      default:
        return [
          n(
            "plate_scene",
            { scene: 0, cars: Math.min(30, cars), dusk: 0.65, life: 0.3 },
            "the same street, later",
          ),
          n("color_transform", { mode: 1, amount: 0.4, shift: 0.15 }, "graded"),
        ];
    }
  },
};

export const STRATEGIES: Record<string, Strategy> = {
  TYPOGRAPHIC,
  GEOMETRIC,
  DIAGRAMMATIC,
  SIGNAL,
  MATERIAL,
  COMPUTATIONAL,
  ILLUSTRATIVE,
};

export const STRATEGY_IDS = Object.keys(STRATEGIES);

/** SYNTHESIS — not a blend of seven recipes.
 *
 *  Because the MOVE NAMES are shared, a passage can be realised move by
 *  move in different material and still be one continuous argument. The
 *  same decision — REPEAT — happens in words, then in geometry, then in a
 *  world; the sentence's meaning is the constant and the medium is what
 *  changes underneath it.
 *
 *  That is what makes this different from cutting between seven films. */
export function synthesise(ids: string[], moveIndex: number, progress: number): Strategy {
  // Cross gradually rather than alternating: the second material appears,
  // is withdrawn, then takes over — which is how a cut sequence actually
  // turns.
  const t = progress;
  const pick = t < 0.3 ? 0 : t > 0.7 ? ids.length - 1 : moveIndex % 2 === 0 ? 0 : ids.length - 1;
  return STRATEGIES[ids[pick] ?? ids[0] ?? "TYPOGRAPHIC"] as Strategy;
}

/** Build the context a move is realised against. */
export function moveCtx(
  sentence: string,
  subjects: DetectedSubject[],
  relation: Relation | null,
  count: number | null,
  progress: number,
  seed: number,
): MoveCtx {
  const words = significantWords(sentence, subjects, relation?.action);
  return {
    words: composeType(words, sentence),
    subjects,
    relation,
    count,
    place: subjects.find((s) => s.kind === "place")?.text ?? null,
    progress,
    seed,
  };
}

/** How long each move holds, in ms.
 *
 *  Not uniform. A film that cuts on a metronome reads as a slideshow, and
 *  the moves are not equally weighted: an INTRODUCE needs to be legible, a
 *  FRAGMENT is over before you have parsed it. Escalation shortens
 *  everything as the passage advances, which is where the sense of
 *  building comes from. */
export function moveDuration(move: MoveKind, progress: number, seed: number): number {
  const base: Record<MoveKind, number> = {
    INTRODUCE: 1400,
    SCALE: 1250,
    REPEAT: 1100,
    COLLIDE: 1300,
    FRAGMENT: 850,
    FIELD: 1500,
    INVERT: 700,
    RESOLVE: 1600,
  };
  const escalation = 1 - progress * 0.4;
  const jitter = 0.9 + rand(seed, 7) * 0.2;
  return Math.round(base[move] * escalation * jitter);
}
