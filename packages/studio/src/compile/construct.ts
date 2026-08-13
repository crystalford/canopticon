// THE CONSTRUCTOR — build a visual, do not pick an effect.
//
// The criticism this file answers, and it was correct:
//
//   "Even if there are 113 primitives, it is still a palette... The system
//   should stop asking 'which effect?' and start asking 'what could
//   express this?' Those are completely different search spaces."
//
// It was right about the layer above the palette and wrong about the
// palette itself, and the difference matters for what to build.
//
// THE SUBSTRATE WAS NEVER A MENU. `creature_chain` does not take a
// creature. It takes `segments`, `legPairs`, `wave`, `stride`, `gait`,
// `scale`, `count`, `wander` and `speed` — that is a construction grammar,
// and a centipede is one point in it. So is a swarm of twelve small fast
// things, so is a single slow segmented thing with no legs.
// `mounted_fixture` takes `vents`, `dome`, `led`, `radius`, `depth` and a
// `representation` rung — a smoke detector, a camera housing, a sprinkler
// head, a speaker. The construction grammar the criticism asks for already
// exists at the bottom of this system.
//
// WHAT DID NOT EXIST WAS ANYTHING THAT SET THOSE NUMBERS FROM THE
// SENTENCE. `BODY_PLANS` mapped a subject kind to a primitive ID and
// passed three parameters, none of them read off the prose. So the
// grammar was there, the vocabulary was there, and the layer joining them
// to the essay was a lookup table — which is exactly the "procedural
// effects pack masquerading as a documentary engine" failure, arriving
// through the one door left open for it.
//
// So this file is the join, and it is built in three separable parts, the
// way the criticism proposed:
//
//   CONSTRUCTIONS  ways of building a meaningful thing, PARAMETERISED from
//                  what the sentence says. "Nine numbered companies" is a
//                  nine-segment chain. "Seven thousand people" is a crowd
//                  of many small fast bodies. Same primitive; different
//                  construction.
//
//   OPERATORS      orthogonal things you can do to ANYTHING that has been
//                  constructed. Pixelation is not a kind of scene, it is
//                  something you can do to a fixture, a document, a
//                  chart or a sentence. Chosen from the director's style
//                  state, never from the subject.
//
//   CANDIDATES     several genuinely different programs per beat, so the
//                  answer to "what could express this" is a set the
//                  director chooses from rather than one thing the machine
//                  settled on. The engine proposes; the human ratifies —
//                  standing rule 3, applied to depiction.
//
// TWO PLACES THE CRITICISM HAS TO BE REFUSED, AND WHY.
//
// "There should be randomness." No. Standing rule 4: nothing stochastic is
// unseeded. Determinism is what makes the per-primitive cache, the L2
// claim, and "the same IR always produces the same film" true, and those
// are not decorations — they are why a director can drag a curve and get a
// answer in a second. Divergence is the actual goal and randomness is only
// one way to get it: the candidates below diverge by CONSTRUCTION and by
// OPERATOR STACK, seeded off the scene, which produces genuinely different
// pictures and still compiles the same film twice.
//
// "The LLM should be the creative compiler." At authoring time, yes, and
// that rail already exists — a model proposes, the operator ratifies, the
// result is frozen and hashed. At render time, never: standing rule 1, and
// a film whose appearance depends on a model's mood on a given afternoon
// is not a compiled artifact. What this file does is exactly what an LLM
// would need to emit into: a program, not a primitive id.

import type { Figure, VisualLanguage } from "../ir/schema.ts";
import { PRIMITIVES, canChain, chainCost } from "../primitives/registry.ts";
import { chartFor, serialiseFigures } from "./figures.ts";
import type { SceneKind } from "./scene-kind.ts";
import type { DetectedSubject } from "./subject.ts";

export interface PlannedNode {
  primitiveId: string;
  params: Record<string, number | string>;
  reason: string;
}

/** What the sentence IS, as far as anything checkable can say. Assembled
 *  by the caller from the deterministic readers — figures, route, named
 *  subjects, scene kind — plus the narration itself. */
export interface Beat {
  sentence: string;
  phrase: string;
  subjects: DetectedSubject[];
  figures: Figure[];
  route: string[];
  kind: SceneKind;
  contested: boolean;
  /** Scene index, used as the seed for every deterministic choice below.
   *  Nothing here calls a random number generator. */
  index: number;
}

/** The director's controls, resolved at this point in the film. These
 *  influence the generated program; they never select a preset. */
export interface Style {
  abstraction: number;
  density: number;
  energy: number;
  human: number;
  typography: number;
  archival: number;
  data: number;
  experimentalism: number;
  restraint: number;
  tier: "GROUNDED" | "ANNOTATED" | "DECOMPOSED" | "DISSOLVED";
  /** The film's visual language. A CONSTRAINT on how things may be built
   *  and what may be done to them — never a template with a fixed tail.
   *  See LANGUAGE and PERMITTED below. */
  language: VisualLanguage;
  /** The film's CAPTURED look, when it has one — a set of per-operator
   *  appetites read off a film that already looked right. Applied on top
   *  of the language's own bias, so a grammar sharpens a language rather
   *  than replacing it. This is what makes a look askable-for instead of
   *  something that happened. */
  grammar?: { ops: Record<string, number>; representation?: number | undefined } | undefined;
}

/* ════════════════════════════════════════════════════════════════════
   LANGUAGE AND ABSTRACTION AS CONSTRAINTS
   ═══════════════════════════════════════════════════════════════════

   The second thing the criticism got right:

     "Current: PIXEL → representation 3 → pixelate → dither. That's too
      prescriptive... The language constrains the aesthetic. It shouldn't
      dictate the program."

   And on the ladder:

     "Abstraction should instead influence HOW the compiler constructs the
      shot... The output isn't predetermined. The search space changes."

   Both are implemented here rather than argued with. A language does two
   things: it moves each operator's APPETITE, and it states a preferred
   representation rung for anything built with one. It names no chain and
   no tail. Two films in the same language on the same sentence can come
   out differently, because appetite is only one term in the score.

   Abstraction is a PERMISSION. At the bottom of the ladder the thing must
   stay recognisable, so only operations that preserve it are allowed to
   run at all. Higher up, decomposition becomes available. The set of legal
   programs grows; which one is built is still decided by the sentence. */

interface LanguageBias {
  /** Added to an operator's appetite. Negative discourages. */
  ops: Record<string, number>;
  /** Preferred representation rung for constructions that have one, 0..4.
   *  Blended with abstraction rather than overriding it — the language
   *  says what KIND of picture, the curve says how far from literal. */
  representation: number;
  why: string;
}

const LANGUAGE: Record<VisualLanguage, LanguageBias> = {
  documentary: {
    ops: {
      grade: 0.35,
      scanline: 0.2,
      soften: 0.15,
      halftone: 0.1,
      pixelate: -0.5,
      sort: -0.6,
      split: -0.4,
    },
    representation: 0,
    why: "the thing as a thing in a room",
  },
  technical: {
    ops: { threshold: 0.45, trace: 0.4, halftone: 0.15, grade: -0.1, soften: -0.3, sort: -0.4 },
    representation: 2,
    why: "the thing as a specification",
  },
  pixel: {
    ops: { pixelate: 0.55, quantise: 0.5, dither: 0.45, soften: -0.5, grade: -0.2 },
    representation: 3,
    why: "the thing as a game asset",
  },
  surreal: {
    ops: { fragment: 0.5, sort: 0.45, split: 0.35, trace: 0.15, grade: -0.15, soften: -0.2 },
    representation: 4,
    why: "the thing coming apart into its own structure",
  },
  kinetic: {
    ops: { fragment: 0.3, trace: 0.3, split: 0.2, soften: -0.3 },
    representation: 1,
    why: "the thing in motion, cut fast",
  },
};

/** Which operations the abstraction curve PERMITS at all.
 *
 *  This is the ladder's real job. It used to name four chains, so a film
 *  at abstraction 0.9 was "noise_field → flow_field → particle_flow →
 *  particle_trail" and nothing else — the slider selected a picture. Now
 *  it opens and closes doors, and what walks through them is decided by
 *  the sentence. */
function permitted(style: Style): Set<string> {
  const keep = ["grade", "soften", "scanline", "halftone", "dither"];
  const stylise = ["quantise", "threshold", "trace", "pixelate"];
  const decompose = ["fragment", "sort", "split"];
  if (style.abstraction < 0.32) return new Set(keep);
  if (style.abstraction < 0.62) return new Set([...keep, ...stylise]);
  return new Set([...keep, ...stylise, ...decompose]);
}

/** An operator's appetite, after the language and the film's own captured
 *  grammar have had their say — in that order, because a grammar is a
 *  refinement of a language rather than an alternative to one. */
function appetiteFor(op: Operator, style: Style): number {
  return (
    op.appetite(style) +
    (LANGUAGE[style.language]?.ops[op.id] ?? 0) +
    (style.grammar?.ops[op.id] ?? 0)
  );
}

/** The representation rung for a construction that has one — the language's
 *  preference, pulled toward the curve. Neither wins outright: a
 *  documentary film at high abstraction is still a documentary film, and a
 *  pixel film at low abstraction still has to be recognisable. */
function representationRung(style: Style): number {
  // A captured grammar's rung is what the film ACTUALLY drew, so it
  // outranks the language's preference — but never the curve, which is
  // still the director's.
  const preferred = style.grammar?.representation ?? LANGUAGE[style.language]?.representation ?? 0;
  return Math.max(0, Math.min(4, Math.round(preferred * 0.6 + style.abstraction * 4 * 0.4)));
}

export interface Program {
  /** Readable identity — "fixture · quantise + scanline". Content-derived,
   *  so the same program in two films has the same name. */
  id: string;
  construction: string;
  operators: string[];
  nodes: PlannedNode[];
  why: string;
  costMsPerFrame: number;
  score: number;
}

/* ════════════════════════════════════════════════════════════════════
   CONSTRUCTIONS — build a thing, with its numbers read off the prose.
   ═══════════════════════════════════════════════════════════════════ */

interface Construction {
  id: string;
  /** How well this construction fits the beat, 0..1. Zero means it does
   *  not apply at all and is never considered. */
  fit(beat: Beat): number;
  build(beat: Beat, style: Style): { nodes: PlannedNode[]; why: string };
}

/** A count the prose actually printed, if it printed one. This is what
 *  makes "nine numbered companies" a nine-segment chain rather than the
 *  default twenty-two: the number on screen and the number of things on
 *  screen are the same number. */
function statedCount(beat: Beat): number | null {
  const counted = beat.figures.find((f) => f.kind === "count");
  if (!counted || !Number.isFinite(counted.value)) return null;
  return Math.max(1, Math.round(counted.value));
}

/** Small integers written as words, which regex-based figure extraction
 *  deliberately does not lift — "seven thousand people" is a figure,
 *  "seven companies" written out is not, and a body plan can use it. */
const WORD_NUMBERS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
};

function wordCount(sentence: string): number | null {
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(sentence)) return n;
  }
  return null;
}

/** Nouns that mean "many of them, small, moving" rather than "one of them,
 *  large, inspected". The difference between a crowd and a centipede in
 *  the same construction grammar. */
const MANY =
  /\b(crowd|crowds|queue|queues|swarm|swarms|colony|people|residents|claimants|workers|migration|convoy|procession|dozens|hundreds|thousands|many|several)\b/i;

/** Words that say the thing is MULTIPLYING or FALLING INTO STEP.
 *
 *  "Then there were dozens of them, moving through the streets in strange
 *  synchronized waves" is the sentence that introduced them, escalated:
 *  more of them, and moving together rather than wandering. A film that
 *  builds a creature and then sets type when the creature multiplies has
 *  not understood the paragraph. */
const SWARMING = /\b(synchron\w*|waves?|together|in step|coordinated|unison|formation|columns?)\b/i;
const GROWING = /\b(dozens|hundreds|thousands|more|multiplied|spread|grew|growing|increasingly)\b/i;

const CONSTRUCTIONS: Construction[] = [
  /* ── A BODY. Segments, appendages, phase offsets, locomotion.
   *
   * This is the construction the whole argument turns on. The centipede
   * was never a primitive; it was a set of numbers. So the numbers come
   * from the sentence: how many things, how big, how fast, and whether
   * they have legs. */
  {
    id: "body",
    fit: (beat) => {
      const s = beat.subjects[0];
      if (!s) return 0;
      if (s.kind === "creature") return 1;
      if (s.kind === "person") return 0.85;
      return 0;
    },
    build(beat, style) {
      const many = MANY.test(beat.sentence);
      const stated = statedCount(beat) ?? wordCount(beat.sentence);
      // A crowd is many small fast bodies. A named creature is one, large,
      // and worth looking at. The prose decides which; the style decides
      // how far from literal it is drawn.
      const growing = GROWING.test(beat.sentence);
      const swarming = SWARMING.test(beat.sentence);
      const count =
        many || growing
          ? Math.min(12, Math.max(4, stated ?? (growing ? 12 : 8)))
          : Math.min(3, stated ?? 1);
      const segments = many
        ? 6 + Math.round(style.density * 6)
        : Math.min(
            60,
            Math.max(8, stated && !many ? stated * 3 : 18 + Math.round(style.density * 20)),
          );
      // Legs are what makes a thing read as alive rather than as a line.
      // A crowd of people gets one pair; an insect gets two; an abstract
      // chain of companies gets none, and reads as a mechanism.
      const legPairs = beat.subjects[0]?.kind === "person" ? 1 : many ? 1 : 2;
      return {
        nodes: [
          {
            primitiveId: "creature_chain",
            params: {
              segments,
              legPairs,
              count,
              scale: many ? 0.16 + style.density * 0.12 : 0.4 + style.human * 0.3,
              speed: 0.25 + style.energy * 0.6,
              gait: 0.3 + style.energy * 0.5,
              // Synchronised means LOW wander: bodies moving together are
              // bodies that have stopped choosing their own paths. The
              // parameter that expresses "strange synchronized waves" is
              // the ABSENCE of wandering, not the presence of an effect.
              wander: swarming
                ? 0.08 + style.energy * 0.12
                : many
                  ? 0.55 + style.energy * 0.35
                  : 0.2 + style.energy * 0.3,
              wave: 0.3 + style.energy * 0.4,
              stride: 0.35 + style.energy * 0.4,
            },
            reason: swarming
              ? `${count} bodies moving in step — the sentence says synchronised, which is these bodies with the wander taken out of them`
              : many || growing
                ? `${count} bodies of ${segments} segments — the sentence names a crowd, so the construction is many small fast ones`
                : `one body of ${segments} segments with ${legPairs} leg pairs, built from "${beat.subjects[0]?.text ?? "the subject"}"`,
          },
          {
            primitiveId: "entity_render",
            params: {
              exposure: beat.contested ? 0.36 : 0.5 + style.human * 0.2,
              contrast: 0.4 + style.density * 0.3,
              vignette: beat.contested ? 0.6 : 0.3,
            },
            reason: beat.contested
              ? "lit cold and close — the line reports a claim, not a finding"
              : "lit as a thing in a room",
          },
        ],
        why: swarming
          ? "a swarm, moving in step"
          : many || growing
            ? "a crowd, constructed"
            : "a body, constructed",
      };
    },
  },

  /* ── A FIXTURE. The thing on the ceiling.
   *
   * Which fixture is decided by the noun; how it is drawn is decided by
   * the abstraction rung, which is the director's. Same construction,
   * four representations: solid, wireframe, technical, pixel. */
  {
    id: "fixture",
    fit: (beat) => (beat.subjects[0]?.kind === "object" ? 1 : 0),
    build(beat, style) {
      const noun = (beat.subjects[0]?.text ?? "").toLowerCase();
      // A detector vents and blinks. A camera domes and does not. A
      // speaker is all vents and no LED. This is a lookup on the NOUN, not
      // on a category — which is the difference between constructing the
      // thing the sentence named and constructing a generic fixture.
      const isCamera = /camera|dome|surveillance/.test(noun);
      const isSpeaker = /speaker|alarm|siren/.test(noun);
      const isSensor = /detector|sensor|thermostat|sprinkler/.test(noun);
      return {
        nodes: [
          {
            primitiveId: "mounted_fixture",
            params: {
              // The language says what kind of picture; the curve says how
              // far from literal. Neither alone.
              representation: representationRung(style),
              radius: isCamera ? 0.62 : 0.45 + style.density * 0.2,
              depth: isCamera ? 0.7 : isSensor ? 0.32 : 0.5,
              vents: isSpeaker ? 28 : isSensor ? 14 : isCamera ? 0 : 10,
              dome: isCamera ? 0.85 : isSensor ? 0.3 : 0.15,
              led: isSensor ? 1 : 0,
              spin: 0.12 + style.energy * 0.5,
              pitch: 0.35 + style.abstraction * 0.3,
              push: beat.kind === "assertion" ? 0.7 : 0.25 + style.energy * 0.3,
            },
            reason: `built as ${isCamera ? "a camera housing" : isSpeaker ? "a sounder" : isSensor ? "a ceiling sensor" : "a mounted unit"} from the word "${beat.subjects[0]?.text ?? ""}"`,
          },
          {
            primitiveId: "entity_render",
            params: {
              exposure: beat.contested ? 0.34 : 0.52,
              contrast: 0.45 + style.density * 0.3,
              vignette: beat.contested ? 0.62 : 0.28,
            },
            reason: "rendered as a lit object rather than a diagram of one",
          },
        ],
        why: "a fixture, constructed from the noun",
      };
    },
  },

  /* ── PAPER. A document is a thing you can photograph, and an
   *    institutional essay is mostly about documents. */
  {
    id: "paper",
    fit: (beat) => {
      if (beat.subjects[0]?.kind === "document") return 1;
      if (beat.kind === "attribution") return 0.7;
      return 0;
    },
    build(beat, style) {
      const words = beat.sentence.split(/\s+/).length;
      return {
        nodes: [
          {
            primitiveId: "document_surface",
            params: {
              // Long prose sets in columns; a short line does not.
              columns: words > 34 ? 3 : words > 18 ? 2 : 1,
              age: 0.25 + style.archival * 0.6,
              // A contested line is a redacted one. The motif is the
              // publication's own and it is earned by the hedge detector
              // rather than sprinkled.
              redaction: beat.contested ? 0.45 + style.density * 0.3 : 0.08,
            },
            reason: beat.contested
              ? "set as a document with redaction — the sentence reports a claim"
              : `set as a ${words > 34 ? "three" : words > 18 ? "two" : "single"}-column document`,
          },
          {
            primitiveId: "artifact_render",
            params: { exposure: 0.5, vignette: 0.3 },
            reason: "photographed, so the page is a thing rather than a layout",
          },
        ],
        why: "a document, constructed",
      };
    },
  },

  /* ── A QUANTITY. The figure is the finding; the chart is chosen by what
   *    kind of quantity it is, not by a house style. */
  {
    id: "quantity",
    fit: (beat) => {
      // A sentence that draws a ROUTE is handled by the route
      // construction, which knows the stages. Charting its figures instead
      // would answer a smaller question with the same numbers — and it
      // silently did, because both constructions fit perfectly and the
      // list order decided.
      if (beat.route.length >= 2) return 0.4;
      const real = beat.figures.filter((f) => f.kind !== "year");
      if (real.length > 0) return 1;
      return beat.figures.length >= 2 ? 0.8 : 0;
    },
    build(beat, style) {
      const chart = chartFor(beat.figures, beat.route.length >= 2);
      return {
        nodes: [
          {
            primitiveId: "data_series",
            params: {
              series: serialiseFigures(beat.figures),
              caption: beat.phrase,
              reveal: 1,
            },
            reason: `${beat.figures.length} figure${beat.figures.length === 1 ? "" : "s"} carried verbatim out of the prose`,
          },
          {
            primitiveId: chart,
            params: { ...(beat.route.length >= 2 ? { route: beat.route.join(" → ") } : {}) },
            reason: `${chart} — chosen by what the figures are`,
          },
          {
            primitiveId: "particle_trail",
            params: { fade: 0.4 + style.energy * 0.3 },
            reason: "the marks drawn as accumulation rather than as a finished plot",
          },
        ],
        why: "a quantity, charted",
      };
    },
  },

  /* ── A ROUTE. Something travelling through stages, which on an
   *    institutional essay is usually money. */
  {
    id: "route",
    fit: (beat) => (beat.route.length >= 2 ? 1 : 0),
    build(beat, style) {
      return {
        nodes: [
          {
            primitiveId: "data_series",
            params: { series: serialiseFigures(beat.figures), caption: beat.phrase, reveal: 1 },
            reason: `the prose drew the route explicitly, in ${beat.route.length} stages`,
          },
          {
            primitiveId: "sankey_flow",
            params: { route: beat.route.join(" → ") },
            reason: "the stages as widths — the shape of where it went",
          },
          {
            primitiveId: "particle_trail",
            params: { fade: 0.45 + style.energy * 0.3 },
            reason: "drawn as travel rather than as a diagram",
          },
        ],
        why: "a route, constructed from the stages the prose named",
      };
    },
  },

  /* ── A NETWORK. Named parties standing in a relation. */
  {
    id: "network",
    fit: (beat) => {
      const caps = beat.sentence.match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
      return caps.length >= 3 && beat.route.length < 2 ? 0.75 : 0;
    },
    build(beat, style) {
      return {
        nodes: [
          {
            primitiveId: "data_series",
            params: { series: serialiseFigures(beat.figures), caption: beat.phrase, reveal: 1 },
            reason: "the named parties, as the graph's own data",
          },
          {
            primitiveId: "force_layout",
            params: { charge: 0.4 + style.energy * 0.4 },
            reason: "laid out by attraction — the shape is a consequence, not a drawing",
          },
          {
            primitiveId: "particle_trail",
            params: { fade: 0.35 },
            reason: "the graph settling rather than appearing settled",
          },
        ],
        why: "a network, constructed",
      };
    },
  },

  /* ── A SPACE. Somewhere rather than something. */
  {
    id: "space",
    fit: (beat) => {
      if (beat.subjects[0]?.kind === "place") return 0.95;
      return beat.kind === "place" ? 0.8 : 0;
    },
    build(beat, style) {
      return {
        nodes: [
          {
            primitiveId: "plate_scene",
            params: {
              depth: 0.4 + style.density * 0.4,
              haze: 0.2 + style.archival * 0.4,
            },
            reason: `a room rather than a word, from "${beat.subjects[0]?.text ?? "the place named"}"`,
          },
        ],
        why: "a space, constructed",
      };
    },
  },

  /* ── TYPE. The words as the image.
   *
   * Kept, and deliberately last: an essay of ideas has nothing to depict
   * and everything to SET, and that is a legitimate answer rather than a
   * fallback. What it is NOT allowed to be is the answer to everything,
   * which is what it had become. */
  {
    id: "type",
    fit: () => 0.45,
    build(beat, style) {
      const long = beat.phrase.split(/\s+/).length > 2;
      return {
        nodes: [
          {
            primitiveId: long ? "text_layout" : "glyph_geometry",
            params: { text: beat.phrase, weight: 0.4 + style.typography * 0.5 },
            reason: `set as ${long ? "a line" : "a single form"} — the words are the image`,
          },
          {
            primitiveId: "glyph_to_points",
            params: { text: beat.phrase, density: 0.4 + style.density * 0.5 },
            reason: "decomposed to points so it can be acted on rather than only read",
          },
          {
            primitiveId: "particle_trail",
            params: { fade: 0.3 + style.energy * 0.4 },
            reason: "drawn as accumulation",
          },
        ],
        why: "the sentence, set",
      };
    },
  },
];

/* ════════════════════════════════════════════════════════════════════
   OPERATORS — orthogonal. Applied to whatever was constructed.
   ═══════════════════════════════════════════════════════════════════ */

interface Operator {
  id: string;
  /** The palette primitives that implement it, in order. Several, because
   *  some operations are a round trip: fragmenting an image means turning
   *  it into points and drawing the points. */
  chain: string[];
  /** How much the director's state wants this, 0..1. Nothing about the
   *  SUBJECT appears here — that is the whole point of an operator. */
  appetite(style: Style): number;
  params(style: Style): Record<string, number | string>;
  why: string;
}

const OPERATORS: Operator[] = [
  {
    id: "quantise",
    chain: ["pixel_quantise"],
    appetite: (s) => 0.25 + s.experimentalism * 0.4 + (1 - s.human) * 0.15,
    params: (s) => ({
      grid: Math.round(3 + s.experimentalism * 8),
      levels: Math.round(4 + s.density * 6),
      warmth: 0.3 + s.archival * 0.4,
    }),
    why: "quantised — the image as a limited palette",
  },
  {
    id: "pixelate",
    chain: ["pixelate"],
    appetite: (s) => s.experimentalism * 0.7 + s.abstraction * 0.2,
    params: (s) => ({
      size: Math.round(4 + s.abstraction * 22),
      quantize: Math.round(3 + s.density * 8),
    }),
    why: "resolved down — the object as a game asset",
  },
  {
    id: "dither",
    chain: ["dither"],
    appetite: (s) => s.archival * 0.6 + s.experimentalism * 0.2,
    params: (s) => ({ threshold: 0.4 + s.density * 0.2, size: Math.round(2 + s.archival * 4) }),
    why: "dithered — print rather than screen",
  },
  {
    id: "scanline",
    chain: ["scanline"],
    appetite: (s) => s.archival * 0.7,
    params: (s) => ({ gap: Math.round(2 + s.archival * 5), strength: 0.3 + s.archival * 0.4 }),
    why: "scanned — the image as a recording of an image",
  },
  {
    id: "halftone",
    chain: ["halftone"],
    appetite: (s) => s.archival * 0.5 + s.typography * 0.3,
    params: (s) => ({ dot: 0.3 + s.density * 0.4, angle: 0.25 }),
    why: "halftoned — reproduction, with its own texture",
  },
  {
    id: "threshold",
    chain: ["threshold"],
    appetite: (s) => (1 - s.human) * 0.3 + s.abstraction * 0.25,
    params: (s) => ({ cut: 0.4 + s.density * 0.2 }),
    why: "thresholded — reduced to what is there and what is not",
  },
  {
    id: "sort",
    chain: ["pixel_sort"],
    appetite: (s) => s.experimentalism * 0.8 - s.restraint * 0.4,
    params: (s) => ({ threshold: 0.4 + s.energy * 0.3, direction: 0 }),
    why: "sorted — the frame's own material rearranged",
  },
  {
    id: "split",
    chain: ["chromatic_split"],
    appetite: (s) => s.energy * 0.5 + s.experimentalism * 0.3 - s.restraint * 0.3,
    params: (s) => ({ amount: 0.15 + s.energy * 0.4 }),
    why: "separated — the channels pulled apart",
  },
  {
    id: "fragment",
    // A ROUND TRIP, and the most compositional operator here: anything
    // that has been constructed becomes points, and the points are drawn.
    // It applies identically to a fixture, a document, a chart and a
    // sentence, which is what makes it an operation rather than a look.
    chain: ["image_to_points", "particle_trail"],
    appetite: (s) => s.abstraction * 0.7 + s.energy * 0.2,
    params: (s) => ({ density: 0.35 + s.density * 0.5, fade: 0.3 + s.energy * 0.4 }),
    why: "taken apart into its own points and redrawn",
  },
  {
    id: "trace",
    chain: ["ascii_render", "particle_trail"],
    appetite: (s) => s.typography * 0.6 + s.experimentalism * 0.2,
    params: (s) => ({ cell: Math.round(6 + (1 - s.density) * 10), fade: 0.35 }),
    why: "re-read as characters — the image transcribed",
  },
  {
    id: "grade",
    chain: ["color_transform"],
    appetite: (s) => 0.3 + s.archival * 0.2,
    params: (s) => ({ warmth: 0.35 + s.archival * 0.3, lift: 0.2 + (1 - s.density) * 0.2 }),
    why: "graded",
  },
  {
    id: "soften",
    chain: ["blur"],
    appetite: (s) => s.restraint * 0.5 - s.density * 0.2,
    params: (s) => ({ radius: 0.1 + s.restraint * 0.3, kind: 0 }),
    why: "softened — held back",
  },
];

/** The motion tail. Not an operator: it re-times what came before rather
 *  than drawing anything, which is why the executor folds it into the
 *  clock instead of running it as a stage. */
const MOTION_TAIL = ["parallax_layers", "ease_profile"];

/* ════════════════════════════════════════════════════════════════════
   CANDIDATES — several programs, not one.
   ═══════════════════════════════════════════════════════════════════ */

/** Generate genuinely different visual programs for one beat.
 *
 *  Divergence comes from two axes, both deterministic: which CONSTRUCTION
 *  is used (a sentence naming a detector inside a contract can be built as
 *  a fixture or as a document, and those are different films), and which
 *  OPERATOR STACK is applied on top. The result is a set the director
 *  chooses from — which is the answer to "why is it always using the same
 *  effects": it is not choosing an effect at all, and when it does choose,
 *  it shows its working.
 *
 *  Sorted best first. The caller takes `[0]` and carries the rest. */
export function constructPrograms(beat: Beat, style: Style, budgetMs: number): Program[] {
  // AN EXPLICITLY DRAWN ROUTE IS THE STRONGEST THING A SENTENCE CAN DO.
  //
  // "Ottawa → IHAP grants → Provincial governments → Hotel contracts" also
  // names a document and a place, so the paper and space constructions fit
  // it perfectly too — and one of them won, on a tiebreak, and charted the
  // stages as a page. The nouns in a route are its STAGES; the sentence is
  // about the movement between them. Stated once here rather than as five
  // edits to five `fit` functions, so the rule can be read.
  const drewRoute = beat.route.length >= 2;
  const applicable = CONSTRUCTIONS.map((c) => ({
    c,
    fit: c.fit(beat) * (drewRoute && c.id !== "route" ? 0.5 : 1),
  }))
    .filter((x) => x.fit > 0)
    .sort((a, b) => b.fit - a.fit)
    // Three is enough to be a real choice and few enough to read.
    .slice(0, 3);

  const stacks = operatorStacks(style, beat.index);
  const programs: Program[] = [];

  for (const { c, fit } of applicable) {
    const built = c.build(beat, style);
    for (const stack of stacks) {
      const program = assemble(c.id, built, stack, style, budgetMs);
      if (!program) continue;
      // FIT DOMINATES. Weighted so that no operator stack can lift a
      // worse-fitting construction over a better one: a sentence that
      // draws a route through four stages is a route, and no amount of
      // appetite for dithering makes it a document. The first version
      // weighted fit at 2 and a well-liked operator pair was worth 1,
      // which was enough to hand a route scene to the paper construction —
      // the style choosing the subject, which is the inversion this whole
      // layer exists to prevent.
      program.score =
        fit * 4 +
        // How much the director's state wanted these operations. Breaks
        // ties BETWEEN stacks; never decides what is being built.
        stack.reduce((a, op) => a + Math.max(0, appetiteFor(op, style)), 0) * 0.5 -
        // A restrained film pays for every extra stage.
        program.nodes.length * style.restraint * 0.15;
      programs.push(program);
    }
  }

  return programs.sort((a, b) => b.score - a.score);
}

/** Operator stacks worth trying, best-appetite first, plus a deliberately
 *  plainer one and a deliberately stronger one.
 *
 *  The three-way split is what stops convergence. Ranking operators by
 *  appetite and always taking the top two produces the same two operators
 *  across a whole film, because the style state moves slowly — which is
 *  precisely the reported symptom. Offering the top pair, the single
 *  strongest, and a rotated pair gives three real alternatives whose
 *  differences a viewer can see. */
function operatorStacks(style: Style, seed: number): Operator[][] {
  const allowed = permitted(style);
  const ranked = [...OPERATORS]
    .filter((op) => allowed.has(op.id))
    .map((op) => ({ op, want: appetiteFor(op, style) }))
    .filter((x) => x.want > 0.15)
    .sort((a, b) => b.want - a.want || (a.op.id < b.op.id ? -1 : 1));

  if (ranked.length === 0) return [[]];

  const top = ranked.slice(0, 2).map((x) => x.op);
  const single = [ranked[0]?.op].filter(Boolean) as Operator[];
  // Rotated by scene index — derived, never random, so the same film
  // always reaches for the same alternative in the same place.
  const rotated = ranked.length > 2 ? [ranked[(seed + 1) % ranked.length]?.op] : [];
  // Deduped: `rotated` can land on an operator already in `top`, and a
  // stack listing the same operator twice is a stack of one wearing a
  // costume.
  const wide = [...new Set([...top, ...rotated].filter(Boolean))] as Operator[];

  // Deduped by identity: `wide` collapses onto `top` whenever the rotation
  // lands inside it, and two identical stacks produce two identical
  // programs — which is a picker offering the same thing twice.
  const seen = new Set<string>();
  const stacks = [top, single, wide].filter((s) => {
    if (s.length === 0) return false;
    const key = s.map((o) => o.id).join("+");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // A restrained film gets the plain option first.
  return style.restraint > 0.6 ? stacks.slice().reverse() : stacks;
}

/** Put a construction and an operator stack together into something that
 *  type-checks, fits the budget, and can be read back as a sentence.
 *
 *  Operators that cannot legally consume what the construction emits are
 *  DROPPED rather than bridged around. A bridge inserted to make an effect
 *  fit is the palette thinking again. */
function assemble(
  constructionId: string,
  built: { nodes: PlannedNode[]; why: string },
  stack: Operator[],
  style: Style,
  budgetMs: number,
): Program | null {
  const nodes = [...built.nodes];
  const applied: string[] = [];

  for (const op of stack) {
    // An operator applied twice is not a richer program, it is the same
    // operation billed twice — and it produced chains reading
    // `scanline → scanline` the first time this ran.
    if (applied.includes(op.id)) continue;
    const candidate = [...nodes];
    let ok = true;
    for (const primitiveId of op.chain) {
      const last = candidate[candidate.length - 1]?.primitiveId;
      if (!last || !canChain(last, primitiveId)) {
        ok = false;
        break;
      }
      candidate.push({
        primitiveId,
        params: op.params(style),
        reason: op.why,
      });
    }
    if (!ok) continue;
    if (chainCost(candidate.map((n) => n.primitiveId)) > budgetMs) continue;
    nodes.length = 0;
    nodes.push(...candidate);
    applied.push(op.id);
  }

  // The motion tail, if it still fits and can legally attach.
  for (const primitiveId of MOTION_TAIL) {
    const last = nodes[nodes.length - 1]?.primitiveId;
    if (!last || !canChain(last, primitiveId)) break;
    const withTail = [...nodes.map((n) => n.primitiveId), primitiveId];
    if (chainCost(withTail) > budgetMs) break;
    nodes.push({
      primitiveId,
      params: { depth: 0.3 + style.density * 0.3 },
      reason: "given depth and eased, so the shot moves like a shot",
    });
  }

  const ids = nodes.map((n) => n.primitiveId);
  if (ids.some((id) => !PRIMITIVES[id])) return null;

  return {
    id: `${constructionId}${applied.length ? ` · ${applied.join(" + ")}` : ""}`,
    construction: constructionId,
    operators: applied,
    nodes,
    why: [built.why, ...applied.map((a) => OPERATORS.find((o) => o.id === a)?.why ?? a)].join(", "),
    costMsPerFrame: chainCost(ids),
    score: 0,
  };
}

/** Every construction this compiler can build, for the Lab's own listing.
 *  Named rather than counted: "seven constructions" is a fact about the
 *  system a director can act on; "128 primitives" is not. */
export const CONSTRUCTION_IDS = CONSTRUCTIONS.map((c) => c.id);
export const OPERATOR_IDS = OPERATORS.map((o) => o.id);
