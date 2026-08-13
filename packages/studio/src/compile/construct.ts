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
import { EMPTY_READING, type IntentReading, bendStyle } from "./intent.ts";
import { type Relation, relationBias } from "./relation.ts";
import { type Representation, realisationFit, representationsFor } from "./represent.ts";
import type { SceneKind } from "./scene-kind.ts";
import type { DetectedSubject } from "./subject.ts";

export interface PlannedNode {
  primitiveId: string;
  params: Record<string, number | string>;
  reason: string;
  /** A compositor's SECOND INPUT, when the planner built one. Present
   *  only on two-input primitives; `language.ts` uses it to nest a
   *  grammar's layers so that a world, a subject and a set of words
   *  compose instead of overwriting each other. */
  ground?: PlannedNode[];
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
  /** What the director asked this beat to do, already read. Absent means
   *  no direction was given, which is not a failure — the film's own curve
   *  decides, exactly as it does for a scene with no ratified reading. */
  intent?: IntentReading | undefined;
  /** WHO ACTS ON WHOM, and whether the sentence claims it happened.
   *
   *  Absent on most beats: a relation needs two named things and most
   *  prose names one. Where it IS present it outranks the noun reading of
   *  the sentence, because "the city watched its residents" and "the
   *  residents watched the city" name exactly the same two things and are
   *  different shots. `subjects` arrives already ordered by it. */
  relation?: Relation | null | undefined;
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
  /** HOW MUCH LIFE EXISTS IN THE WORLD BEYOND THE SUBJECT, 0..1.
   *
   *  Deliberately NOT `density`, which is visual texture — how much is
   *  going on in the picture. This is how much is going on in the WORLD:
   *  people, traffic, storefronts, background activity. The distinction is
   *  the Hopper/Bruegel one, and it matters because the same proposition —
   *  *something strange is happening and nobody has noticed* — has an
   *  almost-empty-street reading and an eighty-micro-events reading, both
   *  correct, and the difference between them is directorial.
   *
   *  0.5 is neutral by construction: at 0.5 the multiplier is exactly 1
   *  and a film that never sets it composes as it always did. */
  population: number;
  /** WHERE THE FRAME'S ENTITLEMENT SITS, 0 environment … 1 subject.
   *
   *  Redistributes weight ACROSS the planes the scene already contains. It
   *  never adds a plane and never removes one, which is what makes it a
   *  change of expression rather than a change of meaning — the
   *  proposition is built from roles, so it is invariant under this by
   *  construction, and that is asserted rather than hoped for.
   *
   *  0.5 is neutral, same as `population`. */
  attention: number;
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

export const LANGUAGE: Record<VisualLanguage, LanguageBias> = {
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

/** WHERE A CONSTRUCTED THING IS ALLOWED TO COME APART.
 *
 *  A construction may only decompose itself into points and particles on
 *  the ladder's own decomposition rungs. Below them, what was built
 *  reaches the frame as the thing that was built.
 *
 *  Gated on the TIER rather than on a threshold against `abstraction`,
 *  because the tier is the ladder's own word for this and a second
 *  numeric cutoff beside it would be a second opinion about the same
 *  question. GROUNDED and ANNOTATED mean you can see the thing. */
function mayDecompose(style: Style): boolean {
  return style.tier === "DECOMPOSED" || style.tier === "DISSOLVED";
}

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

/** An operator's appetite, after the language, the film's own captured
 *  grammar and this beat's direction have had their say — in that order,
 *  widest scope first. A language is the film's dialect, a grammar is the
 *  refinement of it this film actually settled into, and a direction is
 *  one scene asking for something; each may bend the one before it. */
function appetiteFor(op: Operator, style: Style, intent?: IntentReading): number {
  return (
    op.appetite(style) +
    (LANGUAGE[style.language]?.ops[op.id] ?? 0) +
    (style.grammar?.ops[op.id] ?? 0) +
    (intent?.ops[op.id] ?? 0)
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
  /** WHICH KIND OF IMAGE this is — the representation it realises. Six
   *  values, not a treatment: a typographic idea and a literal one are
   *  different pictures of the same sentence, not two gradings of one. */
  mode?: string;
  /** The visual idea in the director's language, from `represent.ts`. */
  idea?: string;
  /** Built against the grain of what the sentence names — a network made
   *  of people, a space standing in for its occupants. Carried so the
   *  Preview can say WHICH KIND of reading this is, because "the city is
   *  the organism" and "the people are insects" are different claims and
   *  a director should not have to infer which one they are looking at. */
  dislocated?: boolean;
}

/* ════════════════════════════════════════════════════════════════════
   CONSTRUCTIONS — build a thing, with its numbers read off the prose.
   ═══════════════════════════════════════════════════════════════════ */

interface Construction {
  id: string;
  /** How well this construction fits what the sentence NAMES, 0..1. Zero
   *  means the prose does not reach it. Deliberately takes only the beat:
   *  semantic fit is a claim about the text and must stay checkable
   *  against the text. The director's influence is a separate, explicit
   *  term in the score, so a `why` can say which of the two moved it. */
  fit(beat: Beat): number;
  /** Can this construction build the sentence AGAINST THE GRAIN of its
   *  noun, and how well — 0..1, and 0 means it refuses.
   *
   *  This is the mechanism that makes candidates different INTERPRETATIONS
   *  rather than the same interpretation wearing different operators.
   *  "They walked around the cities like insects" has one honest
   *  construction — a body — and the interesting alternatives are the ones
   *  that build it as something it is not: a network of nodes, a space
   *  that is itself the organism, a document about people.
   *
   *  Absent means the construction is always available (it has no noun to
   *  be against the grain of). A construction that returns 0 is stating a
   *  reason, not missing a feature — see each site. */
  dislocate?(beat: Beat): number;
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

export const CONSTRUCTIONS: Construction[] = [
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
    // Anything can be given a body. The build reads its numbers off the
    // prose (how many, how fast, growing or not) and falls back to "the
    // subject" for its own account of itself, so a sentence naming no
    // creature still produces a specific body rather than a generic one.
    dislocate: () => 0.7,
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
    /* IT NOW REFUSES, which is what the comment below always said it
     * should do and what the code did not.
     *
     * `kind === "object"` covers door, window, lock, gate, sign, screen,
     * bed, mattress, bus, van, truck, pipe, valve, server and phone. This
     * construction knows how to build exactly three of those shapes — a
     * sensor, a sounder, a camera housing — and returned fit 1.0 for all
     * of them, so every physical noun in a 257-word lexicon became a
     * generic ceiling dome. That is the single line that made two
     * feasibility demos into the ontology of the system.
     *
     * A construction may now only claim a sentence it can actually
     * construct. With none of its three lookups hit it scores 0.12 — low
     * enough to lose to any real reading, high enough to remain visible
     * in the alternatives, because a director may still want a fixture. */
    fit: (beat) => {
      const s = beat.subjects[0];
      if (!s || s.kind !== "object") return 0;
      const noun = s.text.toLowerCase();
      const knows =
        /camera|dome|surveillance/.test(noun) ||
        /speaker|alarm|siren/.test(noun) ||
        /detector|sensor|thermostat|sprinkler/.test(noun);
      return knows ? 1 : 0.12;
    },
    // REFUSES. The whole point of this construction is that the noun
    // decides: a detector vents and blinks, a camera domes and does not.
    // With no object noun every one of those lookups misses and it builds
    // a generic fixture — which is the thing it was written to replace.
    // A construction that can only produce its own default is not an
    // interpretation of the sentence.
    dislocate: () => 0,
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
    // Any sentence can be shown as the record of itself. This is a real
    // reading rather than a fallback — an essay's claim rendered as the
    // document it would have to be to count is exactly the move the
    // Record's own material invites, and it is the strongest dislocation
    // available in an institutional film.
    dislocate: () => 0.75,
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
    // REFUSES when the prose printed no numbers. A chart drawn from
    // nothing is a picture of a chart, and this is the same firewall that
    // keeps a model away from a figure: an axis implies a measurement, and
    // inventing one to satisfy a directorial mood is the single most
    // dishonest thing this compiler could do. With real figures present,
    // charting a sentence that is not about its numbers is a legitimate
    // reading and is allowed.
    dislocate: (beat) => (beat.figures.some((f) => f.kind !== "year") ? 0.6 : 0),
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
    // REFUSES. A route IS its stages; the sankey has nothing to flow
    // between without them. Unlike the fixture, this is not a quality
    // objection — there is literally no drawing to make.
    dislocate: () => 0,
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
    // Anything with more than one thing in it can be shown as a relation
    // between them — people as nodes, a city as a topology. Guarded on
    // there being at least two things to relate, because a force layout
    // over one node is a dot.
    dislocate: (beat) => (beat.subjects.length + beat.figures.length >= 2 ? 0.7 : 0.4),
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
    // Every sentence happens somewhere, and building the SETTING rather
    // than the subject is one of the oldest moves in documentary — the
    // room the thing happened in, held while the narration says what
    // happened. It is also how "the city becomes the organism" is
    // reachable from a sentence whose subject is the people in it.
    dislocate: () => 0.7,
    build(beat, style) {
      return {
        nodes: [
          {
            primitiveId: "plate_scene",
            // `depth` and `haze` were set here and NEITHER EXISTS on
            // `plate_scene`. So every space this compiler has ever built
            // rendered with the same eleven cars at the same dusk, in
            // every film, whatever the state said — which is why the two
            // sentences "the city watched its residents" and "the city
            // appeared to watch its residents" came out byte-identical.
            //
            // The real knobs are how many things are in it, how dark it
            // is, and how much is moving. Read off the state so a space
            // can be crowded or emptied, lit or dusk, alive or still.
            params: {
              scene: style.abstraction > 0.6 ? 1 : 0,
              cars: Math.round(2 + style.density * 26 + style.human * 8),
              dusk: 0.25 + style.archival * 0.45 + (1 - style.energy) * 0.2,
              life: 0.1 + style.energy * 0.6 + style.human * 0.25,
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
            // `weight` exists on `variable_axis` and on NEITHER of the
            // two primitives this construction actually uses.
            // `text_layout` sets its measure with mode, tracking and
            // scale; `glyph_geometry` with sampling, scale and rotate.
            // Setting a name neither has meant every line of type in
            // every film was laid out identically — which is a large part
            // of why the films looked repetitive.
            params: {
              text: beat.phrase,
              ...(long
                ? {
                    mode: Math.round(style.typography * 2),
                    tracking: 0.2 + style.typography * 0.5,
                    scale: 0.3 + style.typography * 0.5,
                  }
                : {
                    sampling: Math.round(3 + (1 - style.density) * 8),
                    scale: 0.35 + style.typography * 0.45,
                    rotate: style.experimentalism * 0.3,
                  }),
            },
            reason: `set as ${long ? "a line" : "a single form"} — the words are the image`,
          },
          /* THE STEP THAT DESTROYED EVERY FILM.
           *
           * These two nodes used to be UNCONDITIONAL. So the construction
           * called "type" — whose own `why` says "the sentence, set" —
           * set the sentence and then immediately converted it to a point
           * cloud and smeared it, at every abstraction level, in every
           * language. Its own reason string admitted it: "decomposed to
           * points so it can be acted on RATHER THAN ONLY READ".
           *
           * Measured on a real 39-scene film: 19 of 39 scenes chose this
           * construction, which is the right choice — and not one of them
           * put a legible word on screen. The engine reported "the
           * sentence, set" and the frame was a particle field. That is
           * the whole of the "it thinks it is producing something
           * coherent and is actually producing glitch texture" problem,
           * and it was here, in the construction, not in the styling.
           *
           * Decomposition is now what it always should have been: a thing
           * the DISSOLUTION end of the ladder does, not a thing that
           * happens to every sentence on the way to the screen. Below the
           * DECOMPOSED rung, type is type. */
          ...(mayDecompose(style)
            ? [
                {
                  primitiveId: "glyph_to_points",
                  // `density` is not one of its knobs — it samples with
                  // `sampling` and scatters with `jitter`.
                  params: {
                    text: beat.phrase,
                    sampling: Math.round(3 + (1 - style.density) * 9),
                    jitter: 0.05 + style.experimentalism * 0.4,
                  },
                  reason: "decomposed to points — the words are coming apart",
                },
                {
                  primitiveId: "particle_trail",
                  // `fade` does not exist. A trail decays, spreads and has
                  // a count.
                  params: {
                    decay: 0.02 + (1 - style.energy) * 0.1,
                    spread: 0.15 + style.energy * 0.5,
                    count: 0.2 + style.density * 0.5,
                  },
                  reason: "drawn as accumulation",
                },
              ]
            : []),
        ],
        why: mayDecompose(style) ? "the sentence, set and coming apart" : "the sentence, set",
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
  /** The numbers, PER PRIMITIVE.
   *
   *  Takes the primitive id because an operator implemented by two of them
   *  is two different things — `trace` is an ascii pass and then a trail,
   *  and they share no parameter names. One bag applied to both meant each
   *  primitive received the other's parameters and silently ignored them,
   *  so half of every multi-primitive operator ran on its defaults. */
  params(style: Style, primitiveId: string): Record<string, number | string>;
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
    // `strength` was set for months and `scanline` has never had one. The
    // knobs it does have are gap, roll and bleed, so every scanline in
    // every film ran on defaults whatever the film's archival weight was.
    params: (s) => ({
      gap: Math.round(2 + s.archival * 5),
      roll: 0.2 + s.energy * 0.5,
      bleed: 0.25 + s.archival * 0.5,
    }),
    why: "scanned — the image as a recording of an image",
  },
  {
    id: "halftone",
    chain: ["halftone"],
    appetite: (s) => s.archival * 0.5 + s.typography * 0.3,
    // `dot` does not exist; a halftone cell's size is `size`.
    params: (s) => ({ size: Math.round(4 + (1 - s.density) * 12), angle: 0.15 + s.energy * 0.5 }),
    why: "halftoned — reproduction, with its own texture",
  },
  {
    id: "threshold",
    chain: ["threshold"],
    appetite: (s) => (1 - s.human) * 0.3 + s.abstraction * 0.25,
    // `cut` does not exist; the level to cut at is `level`.
    params: (s) => ({ level: 0.3 + s.density * 0.35, steps: Math.round(2 + s.abstraction * 5) }),
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
    params: (s) => ({
      amount: 0.15 + s.energy * 0.4,
      angle: 0.1 + s.abstraction * 0.6,
      pulse: 0.2 + s.energy * 0.5,
    }),
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
    params: (s, id) =>
      id === "image_to_points"
        ? {
            sampling: Math.round(3 + (1 - s.density) * 9),
            threshold: 0.2 + (1 - s.density) * 0.4,
            dissolve: s.abstraction * 0.6,
            drift: 0.2 + s.energy * 0.6,
          }
        : {
            decay: 0.02 + (1 - s.energy) * 0.12,
            spread: 0.2 + s.energy * 0.6,
            count: 0.2 + s.density * 0.6,
          },
    why: "taken apart into its own points and redrawn",
  },
  {
    id: "trace",
    chain: ["ascii_render", "particle_trail"],
    appetite: (s) => s.typography * 0.6 + s.experimentalism * 0.2,
    params: (s, id) =>
      id === "ascii_render"
        ? {
            cell: Math.round(6 + (1 - s.density) * 10),
            scale: 0.2 + s.typography * 0.5,
            ramp: 0.25 + s.archival * 0.5,
          }
        : {
            decay: 0.03 + s.restraint * 0.1,
            spread: 0.15 + s.energy * 0.5,
            count: 0.2 + s.density * 0.5,
          },
    why: "re-read as characters — the image transcribed",
  },
  {
    id: "grade",
    chain: ["color_transform"],
    appetite: (s) => 0.3 + s.archival * 0.2,
    // `warmth` and `lift` do not exist on `color_transform`. It grades by
    // MODE — which grade — plus how much of it and how far the hue moves.
    // This is why every graded shot in every film looked the same: mode 0
    // at amount 0.7, the defaults, in all of them.
    params: (s) => ({
      mode: Math.round(Math.min(2, s.archival * 2 + (s.experimentalism > 0.7 ? 1 : 0))),
      amount: 0.35 + s.archival * 0.5,
      shift: 0.1 + s.experimentalism * 0.5,
    }),
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

/** The state a construction actually reads, after the direction and the
 *  relation have both leaned on it.
 *
 *  Factored out of `constructPrograms` the moment a second caller existed.
 *  Two copies of this would mean a background plane built against an
 *  unbent style while its subject built against a bent one — the same
 *  scene composed against two different films, which is precisely the
 *  class of divergence that had the Lab and the Worker disagreeing about
 *  57 of 88 scenes. */
function styleForBeat(beat: Beat, raw: Style): Style {
  const intent = beat.intent ?? EMPTY_READING;
  return beat.relation
    ? bendStyle(bendStyle(raw, intent), {
        ...EMPTY_READING,
        style: relationBias(beat.relation),
      })
    : bendStyle(raw, intent);
}

/** BUILD ONE NAMED CONSTRUCTION, for a plane that already knows which one
 *  it wants.
 *
 *  The scene plan names a construction per PLANE, and a background plane
 *  deserves the same builder its subject gets. The alternative — a
 *  `{ space: "plate_scene" }` lookup table in the compositor — would be a
 *  second, worse implementation of the eight constructions, drifting from
 *  the real one the first time a construction learned a new parameter.
 *
 *  Returns null for an unknown id rather than falling back to something,
 *  because a plane whose construction cannot be built should be dropped
 *  loudly, not replaced silently. */
export function buildConstruction(id: string, beat: Beat, raw: Style): PlannedNode[] | null {
  const c = CONSTRUCTIONS.find((x) => x.id === id);
  if (!c) return null;
  return c.build(beat, styleForBeat(beat, raw)).nodes;
}

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
export function constructPrograms(beat: Beat, raw: Style, budgetMs: number): Program[] {
  // AN EXPLICITLY DRAWN ROUTE IS THE STRONGEST THING A SENTENCE CAN DO.
  //
  // "Ottawa → IHAP grants → Provincial governments → Hotel contracts" also
  // names a document and a place, so the paper and space constructions fit
  // it perfectly too — and one of them won, on a tiebreak, and charted the
  // stages as a page. The nouns in a route are its STAGES; the sentence is
  // about the movement between them. Stated once here rather than as five
  // edits to five `fit` functions, so the rule can be read.
  const drewRoute = beat.route.length >= 2;
  const intent = beat.intent ?? EMPTY_READING;

  // THE DIRECTION BENDS THE STATE EVERY CONSTRUCTION READS.
  //
  // The half that selection alone does not reach. Moving which
  // construction wins is one thing; a body built under five different
  // directions came out with identical segments, gait, wander and scale,
  // and only the operator tail changed — which is the "different colour
  // and post-processing" failure with the argument moved one layer down.
  //
  // Applied HERE and nowhere else, so it cannot be applied twice or
  // skipped by a caller. Every construction already reads these dials to
  // set its own numbers, so this reaches scale, speed, gait, wander,
  // segment count, depth and haze without naming any of them.
  // THE DIRECTION AND THE RELATION BOTH BEND IT, in that order.
  //
  // The relation is a fact about the prose and the direction is the
  // director's instruction, so the direction is applied first and the
  // relation leans on the result — a passive is still a passive in a film
  // directed to feel overwhelming, but it is an overwhelming passive.
  const style = styleForBeat(beat, raw);

  // HOW FAR THE DIRECTOR WILL LET THIS GO AGAINST THE GRAIN.
  //
  // Mostly the direction, because "make it absurd" is a request for
  // category error and "make it inevitable" is a request to watch the
  // thing itself keep going. Experimentalism and abstraction contribute a
  // little, so a film with no directed scenes still opens the space
  // slightly as it climbs the ladder — but never enough to take the
  // literal reading away from a director who did not ask.
  const appetite = Math.max(
    0,
    Math.min(1, intent.dislocation * 0.7 + style.experimentalism * 0.2 + style.abstraction * 0.2),
  );

  /* THE REPRESENTATION CANDIDATES, BEFORE ANY CONSTRUCTION IS CHOSEN.
   *
   * The layer this system did not have. A subject used to select a
   * construction directly — one kind, one generator, score 1.0 — so the
   * only thing a sentence could vary was which of five demo generators
   * ran. Now the sentence first produces six genuinely different VISUAL
   * IDEAS, weighted by checkable facts about the prose (is the noun used
   * or merely invoked, did it print a figure, did it draw a route) and by
   * the film's own state, and constructions compete to REALISE one.
   *
   * `fit` keeps its old job — is this construction suitable for this
   * sentence — and gains no semantic responsibility. The choice of what
   * KIND of image to make is made above it, which is the correction that
   * stops this becoming the routing table again with more arithmetic. */
  const reps = representationsFor(beat, style);

  const applicable: {
    c: Construction;
    fit: number;
    dislocated: boolean;
    rep: Representation | null;
  }[] = [];
  for (const c of CONSTRUCTIONS) {
    const raw0 = c.fit(beat) * (drewRoute && c.id !== "route" ? 0.5 : 1);
    // The construction's suitability, multiplied by how well it serves
    // the best idea it can serve. A construction that only realises the
    // literal reading of a sentence whose literal reading was killed by a
    // metaphor now scores near nothing — without anyone having written a
    // rule about windows.
    let best: Representation | null = null;
    let bestScore = 0;
    for (const rep of reps) {
      const s2 = rep.weight * realisationFit(c.id, rep.mode);
      if (s2 > bestScore) {
        bestScore = s2;
        best = rep;
      }
    }
    const semantic = raw0 * (best ? 0.25 + bestScore * 0.75 : 1);
    if (semantic > 0) {
      // A DIRECTION THAT WANTS DISLOCATION DISCOUNTS THE LITERAL READING.
      //
      // This is the half that is easy to miss and without which the test
      // fails: absurdity is a DEPARTURE from faithfulness, so it is not
      // enough to make the strange reading available — the faithful one
      // has to become less compelling in proportion. Capped at 0.55 so
      // even a maximally strange direction can never make the sentence's
      // own subject unreachable.
      applicable.push({ c, fit: semantic * (1 - appetite * 0.55), dislocated: false, rep: best });
    }
    // Against the grain. Offered even at zero appetite so the picker can
    // always show what else the sentence could have been — it simply
    // scores too low to win until the director asks for it.
    const against = c.dislocate?.(beat) ?? 0;
    if (against > 0 && semantic <= 0) {
      applicable.push({ c, fit: against * appetite, dislocated: true, rep: best });
    }
  }

  // Enough to be a real choice, few enough to read — and now drawn from
  // both readings rather than from the nouns alone.
  applicable.sort((a, b) => b.fit - a.fit);
  const considered = applicable.slice(0, 5);

  const stacks = operatorStacks(style, beat.index, intent);
  const programs: Program[] = [];

  for (const { c, fit, dislocated, rep } of considered) {
    const built = c.build(beat, style);
    for (const stack of stacks) {
      const program = assemble(c.id, built, stack, style, budgetMs);
      if (!program) continue;
      program.dislocated = dislocated;
      // The visual IDEA this program is a realisation of, carried onto
      // the plan so the Studio can say what kind of image it is making
      // rather than only which primitives it used.
      if (rep) {
        program.mode = rep.mode;
        program.idea = rep.idea;
      }
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
        // WHAT THE DIRECTION REACHED FOR. Weighted at 2 — heavy enough
        // that a stated intention can move which construction wins, light
        // enough that it cannot overturn a strongly-fitting subject on a
        // scene the direction barely touched. This term is the whole
        // reason `fit` was allowed to stay a claim about the text.
        (intent.constructions[c.id] ?? 0) * 2 +
        // How much the director's state wanted these operations. Breaks
        // ties BETWEEN stacks; never decides what is being built.
        stack.reduce((a, op) => a + Math.max(0, appetiteFor(op, style, intent)), 0) * 0.5 -
        // A restrained film pays for every extra stage.
        program.nodes.length * style.restraint * 0.15;
      programs.push(program);
    }
  }

  programs.sort((a, b) => b.score - a.score);
  return diversify(programs);
}

/** Put a genuinely different program second.
 *
 *  Sorting by score alone put the same construction in the top two slots
 *  differing by a single operator — which is a picker offering the same
 *  thing twice, and was half of why the alternatives read as noise. The
 *  first program of each distinct construction is promoted in score order,
 *  then everything else follows. Nothing is discarded and nothing is
 *  reordered within a construction, so the best program is still the best
 *  program; only the ORDER of the also-rans changes, which is exactly the
 *  part a director reads. */
function diversify(programs: Program[]): Program[] {
  const seen = new Set<string>();
  const first: Program[] = [];
  const rest: Program[] = [];
  for (const p of programs) {
    const key = `${p.construction}:${p.dislocated ? "against" : "with"}`;
    if (seen.has(key)) rest.push(p);
    else {
      seen.add(key);
      first.push(p);
    }
  }
  return [...first, ...rest];
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
function operatorStacks(style: Style, seed: number, intent?: IntentReading): Operator[][] {
  const allowed = permitted(style);
  const ranked = [...OPERATORS]
    .filter((op) => allowed.has(op.id))
    .map((op) => ({ op, want: appetiteFor(op, style, intent) }))
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
        params: op.params(style, primitiveId),
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
      // `depth` belongs to `parallax_layers`, not to `ease_profile`, and
      // the tail set it on both — so every shot in every film has eased
      // on `kind` 0 at `amount` 0.5, the defaults. The two primitives in
      // this tail want different numbers and now get them.
      params:
        primitiveId === "parallax_layers"
          ? {
              layers: Math.round(2 + style.density * 4),
              depth: 0.2 + style.density * 0.4,
              rate: 0.15 + style.energy * 0.5,
            }
          : { kind: Math.round(style.restraint > 0.6 ? 0 : 1), amount: 0.25 + style.energy * 0.5 },
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
