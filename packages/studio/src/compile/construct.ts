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
import { PRIMITIVES, canChain, chainCost, chainOverwrites } from "../primitives/registry.ts";
import type { Act } from "./act.ts";
import { chartFor, serialiseFigures } from "./figures.ts";
import type { FilmMode } from "./film-mode.ts";
import type { Material } from "./grammar-visual.ts";
import { EMPTY_READING, type IntentReading, bendStyle } from "./intent.ts";
import { type Relation, relationBias } from "./relation.ts";
import {
  type Mode,
  REALISES,
  type Representation,
  realisationFit,
  representationsFor,
} from "./represent.ts";
import { type SceneGraph, composeFromMeaning, serialiseScene } from "./scene-graph.ts";
import type { SceneKind } from "./scene-kind.ts";
import { readScene } from "./semantic-scene.ts";
import type { DetectedSubject } from "./subject.ts";
import { INTERFACE_WORDS } from "./subject.ts";

export interface PlannedNode {
  primitiveId: string;
  params: Record<string, number | string>;
  reason: string;
  /** A compositor's SECOND INPUT, when the planner built one. Present
   *  only on two-input primitives; `language.ts` uses it to nest a
   *  grammar's layers so that a world, a subject and a set of words
   *  compose instead of overwriting each other. */
  ground?: PlannedNode[];
  /** THE BRIDGE. `{param: [from, to]}`, applied to this node's live params
   *  by the chain executor over `tweenMs` without rebuilding the chain.
   *  Written only by `serialiseScene`, only on `place`, and only in a film
   *  whose mode bridges. */
  tween?: Record<string, [number, number]>;
  tweenMs?: number;
  /** WHEN the tween starts, scene-local. Without it a bridge can only run
   *  from the top of the scene — right for a world arriving, useless for a
   *  phrase whose measured word is four seconds in. */
  tweenAtMs?: number;
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
  /** WHAT KIND OF PICTURE THIS FILM MAKES.
   *
   *  Read by `fit` — it is the one thing that legitimately moves which
   *  construction wins for an ordinary sentence, because it is the
   *  director saying what the film is made of. A WEIGHTING: a printed
   *  figure still reaches the chart family and a drawn route is still a
   *  route in every approach, since both are checkable facts about the
   *  prose and outrank a preference. `hybrid` leaves everything alone. */
  approach?: "text" | "abstract" | "world" | "image" | "hybrid" | undefined;
  /** True when this scene has a promoted phrase to put on screen. Read
   *  only by `assemble`, to keep a typeset frame out of the resamplers. */
  setsType?: boolean | undefined;
  /** THE FILM'S WORLD, ALREADY ADVANCED.
   *
   *  Present when the film has continuity. The graph's elements arrive with
   *  their INHERITED places — a thing established three scenes ago is where
   *  the film left it, not where a fresh composition would put it — so the
   *  scene construction serialises this rather than recomposing.
   *
   *  Computed once per scene, in `composeScene`, above the constructor.
   *  Doing it in here would advance the film once for every candidate
   *  program that lost. */
  world?:
    | {
        graph: SceneGraph;
        material: Material;
        /** How the world gets here from the last scene. Empty in a film
         *  that cuts, where arriving instantly is the point. */
        bridge?: { tweens: Map<string, Record<string, [number, number]>>; ms: number };
        /** How this film moves. Carried for the report; the CONSTRUCTION
         *  reads `beat.approach` instead, because what the picture is made
         *  of and whether the film cuts are two questions. */
        mode?: FilmMode;
      }
    | null
    | undefined;
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
  /* DERIVED FROM THE OPERATORS THEMSELVES rather than restated as three
   * id lists. An operator added to `OPERATORS` and forgotten here could
   * never fire, and nothing said so — a set that does not contain you
   * raises nothing. Two operators were added and did not appear once, at
   * any intensity, in any language, for exactly this reason. */
  const upto =
    style.abstraction < 0.32
      ? ["keep"]
      : style.abstraction < 0.62
        ? ["keep", "stylise"]
        : ["keep", "stylise", "decompose"];
  return new Set(OPERATORS.filter((op) => upto.includes(op.rung)).map((op) => op.id));
}

/** An operator's appetite, after the language, the film's own captured
 *  grammar and this beat's direction have had their say — in that order,
 *  widest scope first. A language is the film's dialect, a grammar is the
 *  refinement of it this film actually settled into, and a direction is
 *  one scene asking for something; each may bend the one before it. */
function appetiteFor(op: Operator, style: Style, intent?: IntentReading): number {
  return (
    op.appetite(style) +
    // The operator's own declaration, then the language's table — which
    // stays for the NEGATIVE opinions a language holds about operators it
    // does not own ("a documentary does not glitch").
    (op.languages?.[style.language] ?? 0) +
    (LANGUAGE[style.language]?.ops[op.id] ?? 0) +
    (style.grammar?.ops[op.id] ?? 0) +
    (intent?.ops[op.id] ?? 0)
  );
}

/** The representation rung for a construction that has one — the language's
 *  preference, pulled toward the curve. Neither wins outright: a
 *  documentary film at high abstraction is still a documentary film, and a
 *  pixel film at low abstraction still has to be recognisable. */
// `representationRung` and `wordCount` were only ever read by the two
// deleted noun-object constructions. Removed with them.

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
  /** The third argument is the REPRESENTATION this construction was
   *  selected to realise, when the scorer chose one. Most constructions
   *  ignore it — a chart is a chart. The scene construction cannot: it
   *  builds a composition IN a mode, and which mode is exactly the
   *  decision the representation layer above it exists to make. */
  build(
    beat: Beat,
    style: Style,
    rep?: Representation | null,
  ): { nodes: PlannedNode[]; why: string };
  /** DOES THIS CONSTRUCTION DRAW WHAT THE FILM IS ALREADY CARRYING?
   *
   *  Declared rather than inferred, the same way a primitive declares
   *  whether it preserves what it was handed. A construction that reads
   *  `beat.world` draws the elements the film has established, in the
   *  places it left them, and can therefore express something happening
   *  TO them. One that builds its own object from the sentence cannot: it
   *  starts again every scene, whatever the world was doing.
   *
   *  This is the fact the act gate turns on. Measured on the real essay:
   *  on every scene where the world produced a MOVE, a construction that
   *  ignores the world won the picture — so the move was computed,
   *  attached, and thrown away. Not a coincidence, and the mechanism is
   *  the centipede's from a third angle: the film only has a moving
   *  element when the prose NAMED something, and a named noun is exactly
   *  what makes an object construction win. */
  usesWorld?: boolean;
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

/* THE CROWD, SWARM AND ESCALATION LEXICONS WERE HERE AND ARE GONE.
 *
 * They existed to parameterise a body: how many of them, whether they
 * moved in step, whether they were multiplying. That construction read a
 * noun and drew a creature, and it is deleted — so are the word lists that
 * fed it. What a sentence says about accumulation is read by `act.ts` from
 * what the sentence DOES, and reaches the picture as a MOVE rather than as
 * a leg count. */

/** The interface nouns as a set, built once. The list itself lives in
 *  `subject.ts`, which owns what a noun is. */
const INTERFACE_SET = new Set(INTERFACE_WORDS);

export const CONSTRUCTIONS: Construction[] = [
  /* ── A SCENE. The composition itself, as a construction.
   *
   * THE WIRE THAT WAS MISSING, and it took compiling a real essay and
   * reading the usage table to find it. Representation reached production
   * — `representationsFor` is called eight lines above this — but
   * everything BELOW it did not. `grammar-visual.ts`, `scene-graph.ts`,
   * `semantic-scene.ts`, `film-state.ts` and `film-mode.ts` imported only
   * each other, so the entire representation → grammar → scene → continuity
   * chain was a closed island reachable from tests and nothing else. A
   * 25-scene essay compiled to `plate_scene`, `pixel_quantise` and
   * `color_transform`: the old generic constructions, in a system that had
   * spent five passes building something better and never plugged it in.
   *
   * Standing rule 10, exactly: PLANNED is the dangerous state, because a
   * planned thing looks finished from every angle except the screen.
   *
   * This construction is the plug. It reads the sentence as a SEMANTIC
   * SCENE — entities and the relation between them — arranges those into
   * elements with roles, places, depths, materials and a hierarchy, and
   * serialises the arrangement to nested compositors. It declares every
   * mode because that is the point of the layering: the same machinery
   * builds the literal reading and the diagrammatic one, and what differs
   * is which operations run, not which generator was picked.
   *
   * It competes rather than replaces. A sentence that draws a route is
   * still a route; a printed quantity is still a chart. What this takes
   * is the enormous middle — every ordinary sentence that used to fall
   * through to a generic plate. */
  {
    id: "scene",
    // The only construction that draws what the film is already carrying.
    usesWorld: true,
    fit(beat) {
      const rel = beat.relation?.agent && beat.relation.patient;
      /* IT NEVER RETURNS ZERO, and the measurement is why.
       *
       * The first version refused a sentence that named nothing the
       * lexicon knows. Run over a real 25-sentence essay, that put
       * `type` — a SINGLE `text_layout` node, words on a plate — first
       * on ten scenes, with `space` and `paper` generics taking nine
       * more. Nineteen of twenty-five frames were a card or a texture,
       * which is the whole of "why is it just abstract screens".
       *
       * `composeScene` needs no named noun. It composes from the film's
       * own state — a form, a ground, a count, negative space — so
       * refusing was never a statement about capability, only an
       * oversight. A sentence about accumulation has an ACCUMULATES
       * relation and a choreography built for it; a text card is the
       * poorest available answer to it. */
      /* A WORLD FILM DRAWS ONE WORLD — and that is a decision about the
       * PICTURE, not about the editing.
       *
       * The first version of this read `beat.world.mode` and gave ONE_SHOT
       * the sentence outright, which quietly made "never cut" mean "build
       * a world". Two different questions wearing one control: a
       * text-driven film that never cuts and a world film that cuts hard
       * were both unreachable. The approach decides what the picture is
       * made of; continuity decides whether the film cuts; the film state
       * advances either way, because identity persistence is pipeline
       * rather than language.
       *
       * The measurement that motivated the forcing is still true and still
       * applies — under `world`. With the state threaded but this
       * construction left on its ordinary weight, a six-scene world film
       * drew `scene · body · body · fixture · scene · scene`: identities
       * persisting perfectly while the picture restarted four times.
       * Persistence nothing can see is not continuity. */
      if (beat.approach === "world") return 1.02;
      if (beat.approach === "abstract") return rel ? 0.95 : 0.9;
      // TEXT wants the typographic constructions; the scene graph still
      // competes, because a text film is a COMPOSITION containing words
      // rather than a card with words on it — it is simply not favoured.
      if (beat.approach === "text") return rel ? 0.7 : 0.5;
      if (!beat.subjects.length && !rel) return 0.55;
      // A relation is two things and what stands between them, which is a
      // COMPOSITION. A lone named subject is a single form in a frame,
      // which is real but thinner — and both outrank a generic plate.
      return rel ? 0.86 : 0.72;
    },
    build(beat, style, rep) {
      /* THE WORLD, WHEN THE FILM HAS ONE.
       *
       * Already composed and already advanced through the film's state, so
       * what arrives here is what PERSISTS plus this scene's own scenery,
       * in the places the film left them. Recomposing from the sentence at
       * this point would throw that away and put every element back where a
       * first-time composition would have placed it — which is exactly the
       * behaviour a persistent world is supposed to replace. */
      if (beat.world) {
        return {
          nodes: serialiseScene(
            beat.world.graph,
            beat.world.material,
            beat.world.bridge ?? undefined,
          ),
          why: beat.world.graph.describes,
        };
      }
      const count = statedCount(beat);
      const sem = readScene(beat.sentence, beat.subjects, beat.relation ?? null, count);
      const m: Material = {
        noun: beat.subjects[0]?.text ?? "",
        phrase: beat.phrase,
        count,
        relation:
          beat.relation?.agent && beat.relation?.patient
            ? [String(beat.relation.agent), String(beat.relation.patient)]
            : null,
        density: style.density,
        energy: style.energy,
        abstraction: style.abstraction,
        typography: style.typography,
        seed: 101 + beat.index * 7,
      };
      const mode = (rep?.mode ?? "literal") as Mode;
      const scene = composeFromMeaning(mode, m, sem);
      return {
        nodes: serialiseScene(scene, m),
        why: scene.describes,
      };
    },
  },
  /* ── A SCREEN. Software, shown as software.
   *
   * P · INTERFACE — device_frame, browser_chrome, ui_surface, cursor,
   * interaction, spotlight — never ran once in 32 compiles across two
   * real essays. Seven implemented primitives with real parameters, and
   * nothing could reach them, because no construction built one and the
   * scene graph's grammar has no idea what a phone is.
   *
   * That is worth fixing on its own and it is glaring on the essay that
   * exposed it: a piece about a screenshot tool, in which the compiler
   * drew abstract marks for twenty-eight sentences because it had no way
   * to draw a screen. An essay about software should be able to show
   * software.
   *
   * WHAT MAKES IT REAL RATHER THAN A TEMPLATE. Every number is read off
   * the prose. Which device comes from the noun that was named — a laptop
   * sentence is not a phone sentence. Whether a cursor or a gesture is on
   * screen comes from whether the sentence describes someone DOING
   * something. The spotlight appears only where the writing is about
   * attention being directed, which is what a spotlight means. A sentence
   * that merely mentions a phone gets a phone; a sentence about missing a
   * target with your thumb gets the miss.
   *
   * It composes rather than replaces: the base is the trunk and
   * everything else hangs off a compositor's ground, because `cursor`,
   * `interaction` and `spotlight` are SOURCES — each one calls `bg()` and
   * paints from nothing, so chaining one after the frame would erase the
   * frame. Verified against the implementations in `lab/prims-d.js`
   * rather than assumed from the type signature, which permits it. */
  {
    id: "screen",
    fit(beat) {
      const named = beat.subjects.findIndex((sub) => INTERFACE_SET.has(sub.text.toLowerCase()));
      if (named < 0) return 0;
      // Leading with it means the sentence is ABOUT the interface. Naming
      // it later means the interface is where something else happened,
      // which is still worth showing and is not the subject.
      return named === 0 ? 0.99 : 0.72;
    },
    build(beat, style) {
      const t = beat.sentence.toLowerCase();
      const has = (re: RegExp) => re.test(t);
      const nouns = beat.subjects.map((sub) => sub.text.toLowerCase());
      const web = has(/\b(browser|web|google|search|url|tab|site|website|page)\b/);
      const big = nouns.some((n) => /laptop|computer|monitor|keyboard|desktop/.test(n));
      const nodes: PlannedNode[] = [
        web
          ? {
              primitiveId: "browser_chrome",
              params: {
                url: 0.4 + style.density * 0.4,
                tabs: Math.round(2 + style.density * 5),
                scroll: 0.2 + style.energy * 0.5,
              },
              reason: "a browser, because the sentence is about the web",
            }
          : {
              primitiveId: "device_frame",
              // 0 phone · 1 tablet · 2 laptop, from the noun that was named.
              params: {
                kind: big ? 2 : nouns.some((n) => /tablet|ipad/.test(n)) ? 1 : 0,
                scale: 0.62 + (1 - style.density) * 0.28,
                content: 0.3 + style.density * 0.5,
              },
              reason: big
                ? "a laptop, because that is what the sentence named"
                : "a phone, held in the frame",
            },
      ];
      /* WHAT IS HAPPENING TO IT. A gesture when the writing describes one;
       * a pointer when it describes a hand rather than an action; neither
       * when the sentence is only about the thing existing. */
      const gesture = has(/\b(tap|tapp|swipe|swip|scroll|drag|pinch|crop|press|flip|slide)\w*\b/);
      const pointing = has(/\b(thumb|finger|hand|cursor|point|click|miss|reach)\w*\b/);
      if (gesture || pointing) {
        nodes.push({
          primitiveId: "layer_over",
          params: { strength: 0.9 },
          reason: gesture ? "and the gesture the sentence describes" : "and the hand doing it",
          ground: [
            gesture
              ? {
                  primitiveId: "interaction",
                  // 0 tap · 1 swipe · 2 scroll, read off the verb.
                  params: {
                    kind: has(/\bscroll/) ? 2 : has(/\bswipe|drag|slide|crop/) ? 1 : 0,
                    rate: 0.25 + style.energy * 0.6,
                  },
                  reason: "the gesture, at the film's own pace",
                }
              : {
                  primitiveId: "cursor",
                  params: {
                    damping: 0.25 + style.restraint * 0.6,
                    dwell: 0.2 + (1 - style.energy) * 0.6,
                    click: has(/\bclick|press|tap/) ? 1 : 0,
                  },
                  reason: "a pointer, moving and settling",
                },
          ],
        });
      }
      /* ATTENTION, WHERE THE WRITING IS ABOUT ATTENTION. A spotlight is a
       * claim that one part of the screen matters and the rest does not,
       * so it is earned by the sentence saying so rather than added for
       * texture. */
      if (has(/\b(highlight|select|attention|focus|notice|spot|find|look)\w*\b/)) {
        nodes.push({
          primitiveId: "layer_mask",
          params: { strength: 0.85 },
          reason: "with one part of it picked out, because the sentence is about noticing",
          ground: [
            {
              primitiveId: "spotlight",
              params: {
                radius: 0.14 + (1 - style.density) * 0.3,
                dim: 0.55 + style.restraint * 0.35,
                move: style.energy * 0.8,
              },
              reason: "the attention itself",
            },
          ],
        });
      }
      return {
        nodes,
        why: `${web ? "a browser" : big ? "a laptop" : "a phone"}${gesture ? ", being used" : pointing ? ", and the hand at it" : ""}`,
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
  /** WHERE ON THE LADDER THIS OPERATOR MAY RUN.
   *
   *  `keep` is what a restrained film may still do to a picture — grade
   *  it, soften it, give it a reproduction texture. `stylise` re-renders
   *  the surface. `decompose` takes the image apart, and a film has to
   *  have said it is coming apart before it gets one.
   *
   *  DECLARED HERE because it was a hardcoded id list inside
   *  `permitted()`, and an operator missing from that list was silently
   *  unreachable however much the film wanted it. */
  rung: "keep" | "stylise" | "decompose";
  /** How much a given visual language wants this.
   *
   *  Also a separate table until now (`LANGUAGE[lang].ops[id]`), and the
   *  omission was not neutral: `operatorStacks` uses only the top two by
   *  appetite, and every established operator carried a language bonus,
   *  so an operator absent from that table was systematically outranked
   *  everywhere. Two silent exclusions in two files for one operator. */
  languages?: Partial<Record<VisualLanguage, number>>;
}

/** WHICH PRIMITIVES AN OPERATOR ACTUALLY RUNS, by id.
 *
 *  Exported because `compose.ts` has to know whether a primitive it just
 *  cut for cost belongs to an operator the program is claiming — and the
 *  mapping is not the identity: `grade` runs `color_transform`. Derived
 *  from the table below rather than restated, so an operator that changes
 *  its chain cannot leave a second copy behind disagreeing with it. */
export const OPERATOR_CHAINS: Map<string, string[]> = new Map();

const OPERATORS: Operator[] = [
  {
    id: "quantise",
    chain: ["pixel_quantise"],
    rung: "stylise",
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
    rung: "stylise",
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
    rung: "keep",
    appetite: (s) => s.archival * 0.6 + s.experimentalism * 0.2,
    params: (s) => ({ threshold: 0.4 + s.density * 0.2, size: Math.round(2 + s.archival * 4) }),
    why: "dithered — print rather than screen",
  },
  {
    id: "scanline",
    chain: ["scanline"],
    rung: "keep",
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
    rung: "keep",
    appetite: (s) => s.archival * 0.5 + s.typography * 0.3,
    // `dot` does not exist; a halftone cell's size is `size`.
    params: (s) => ({ size: Math.round(4 + (1 - s.density) * 12), angle: 0.15 + s.energy * 0.5 }),
    why: "halftoned — reproduction, with its own texture",
  },
  {
    id: "threshold",
    chain: ["threshold"],
    rung: "stylise",
    appetite: (s) => (1 - s.human) * 0.3 + s.abstraction * 0.25,
    // `cut` does not exist; the level to cut at is `level`.
    params: (s) => ({ level: 0.3 + s.density * 0.35, steps: Math.round(2 + s.abstraction * 5) }),
    why: "thresholded — reduced to what is there and what is not",
  },
  {
    id: "sort",
    chain: ["pixel_sort"],
    rung: "decompose",
    appetite: (s) => s.experimentalism * 0.8 - s.restraint * 0.4,
    params: (s) => ({ threshold: 0.4 + s.energy * 0.3, direction: 0 }),
    why: "sorted — the frame's own material rearranged",
  },
  {
    id: "split",
    chain: ["chromatic_split"],
    rung: "decompose",
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
    rung: "decompose",
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
    rung: "stylise",
    /* NOT KEYED ON TYPOGRAPHY. This was `s.typography * 0.6`, and
     * `ascii_render` re-reads the whole frame as character cells — so the
     * more the argument turned on a line, the more likely the engine was
     * to transcribe that line into a grid of dots. Measured: a level-4
     * statement rendered through `ascii_render{scale: 0.685}` and could
     * not be read at any size.
     *
     * Transcribing an IMAGE into characters is a real and good idea; it is
     * a treatment for a picture. Applied to words it destroys the thing it
     * was reaching for, which is the definition of the wrong appetite. */
    appetite: (s) => s.experimentalism * 0.5 + (1 - s.typography) * 0.3,
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
    rung: "keep",
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
    rung: "keep",
    appetite: (s) => s.restraint * 0.5 - s.density * 0.2,
    params: (s) => ({ radius: 0.1 + s.restraint * 0.3, kind: 0 }),
    why: "softened — held back",
  },
];
for (const op of OPERATORS) OPERATOR_CHAINS.set(op.id, op.chain);

/* ── AN OPERATOR THAT CAN NEVER FIRE IS A BUG, NOT A CHOICE ───────────
 *
 * The whole reason the palette has 135 primitives and a film draws 33 is
 * that reachability was spread across four places — this table, the
 * ladder gate, the language bias, and a top-two race — and omitting any
 * one of them failed SILENTLY. Nothing was ever wrong; the operator
 * simply never appeared, which is indistinguishable from a film that did
 * not want it.
 *
 * Two of those are now derived from the declaration above and cannot be
 * half-done. This is the third: every operator is checked, at module
 * load, against the palette it claims to run and the type contract
 * between its own primitives. A chain naming something that does not
 * exist, or two primitives that cannot legally follow one another, is a
 * dead operator and now says so at startup rather than at no point ever.
 *
 * It throws rather than warns because this is a static property of the
 * source: it cannot depend on a film, a style or a sentence, so it is
 * either right for every compile or wrong for every compile. A warning
 * would be a note nobody reads in a Worker log. */
for (const op of OPERATORS) {
  for (const id of op.chain) {
    if (!PRIMITIVES[id]) {
      throw new Error(
        `operator "${op.id}" names "${id}", which is not in the palette — it could never run`,
      );
    }
  }
  for (let i = 1; i < op.chain.length; i++) {
    const from = op.chain[i - 1] as string;
    const to = op.chain[i] as string;
    if (!canChain(from, to)) {
      throw new Error(
        `operator "${op.id}" chains ${from} → ${to}, which the payload contract forbids — it could never run`,
      );
    }
  }
}

/** The motion tail. Not an operator: it re-times what came before rather
 *  than drawing anything, which is why the executor folds it into the
 *  clock instead of running it as a stage. */
const MOTION_TAIL = ["parallax_layers", "ease_profile"];

/* HOW THE FILM MOVES, PER ACT.
 *
 * `O · MOTION CRAFT` has six primitives. Five of them —`anticipation`,
 * `overshoot`, `follow_through`, `damping`, `seamless_loop` — are written,
 * registered, typed ANIMATION → ANIMATION, and have NEVER been put in a
 * chain. The executor that runs them has been live the whole time and only
 * ever ran `ease_profile`, so every shot of every film has moved with the
 * same anonymous ease.
 *
 * They are the cheapest expressive thing in the palette: they re-time what
 * is already there rather than drawing anything, they cost 1ms/frame, and
 * they are the difference between a thing that arrives and a thing that
 * ARRIVES. So the ACT chooses one — the same reading that decides what
 * changes decides how that change carries itself.
 *
 * `anticipation` is a small counter-move before the main one, which is
 * what a DECLARE is: gather, then state. `overshoot` passes the target and
 * settles — an INTENSIFY going too far and coming back. `damping` is a
 * settle with no overshoot at all, which is a QUALIFY: less than was
 * claimed. `follow_through` lets the tail keep going after the body has
 * stopped, which is what a WITHDRAW leaves behind.
 *
 * Deliberately not one per act. SUSTAIN and NONE get nothing, because the
 * absence of authored motion is a reading too. */
const MOTION_CHARACTER: Partial<Record<Act, { id: string; amount: number; why: string }>> = {
  DECLARE: { id: "anticipation", amount: 0.45, why: "gathers before it states" },
  INTENSIFY: { id: "overshoot", amount: 0.6, why: "goes too far, and comes back" },
  ACCUMULATE: { id: "overshoot", amount: 0.4, why: "arrives with more force each time" },
  CONTRAST: { id: "anticipation", amount: 0.62, why: "draws back before it turns" },
  QUALIFY: { id: "damping", amount: 0.7, why: "settles without insisting" },
  WITHDRAW: { id: "follow_through", amount: 0.55, why: "the tail keeps going after it leaves" },
  CONVERGE: { id: "damping", amount: 0.45, why: "closes without a bounce" },
  RECALL: { id: "follow_through", amount: 0.4, why: "carries its own history in" },
  TRANSFORM: { id: "overshoot", amount: 0.5, why: "passes through what it becomes" },
  REVEAL: { id: "anticipation", amount: 0.35, why: "holds a beat before it shows" },
};

/** Primitives that RESAMPLE the finished frame — they slice it, offset it,
 *  quantise it or re-read it as characters. Every one is a good treatment
 *  for a picture and every one destroys type.
 *
 *  Measured at 1280×720: `parallax_layers` shifted the slice carrying the
 *  first word off the left edge, so "position, not a person" rendered as
 *  "osition, not a person" in all three sampled frames. It was not a
 *  centring bug — the type was drawn correctly and then moved. */
/** Type drawn as real glyphs — the stack whose frame must not be
 *  resampled. `glyph_geometry` is deliberately absent: a word made of
 *  points is ALREADY a resampling, and treating it further is the point of
 *  the kinetic register. */
export const isSetType = (id: string) => id === "text_layout" || id === "variable_axis";

/** Every primitive in a program, grounds included. */
function flatIds(ns: PlannedNode[]): string[] {
  return ns.flatMap((n) => [n.primitiveId, ...(n.ground ? flatIds(n.ground) : [])]);
}

/** May this primitive run over a frame that is PRESENTING TYPE?
 *
 *  This was `RESAMPLES_THE_FRAME`, a hand-kept set of six known
 *  offenders. The flaw was the polarity: every primitive nobody had
 *  thought about counted as safe. `field_displace` was one of them, and
 *  measured on a real film it put holes through "one is exposure, not
 *  corruption" — displacing a finished frame that already had the words
 *  composited into it.
 *
 *  Inverted. A primitive DECLARES that it preserves what it was handed,
 *  and anything that does not declare is assumed to move, sample or erode
 *  it. Adding a destructive primitive to the palette can no longer break
 *  presented type by omission, which is the only version of this rule
 *  that stays true as the palette grows.
 *
 *  A primitive that reads nothing upstream cannot damage it either — it
 *  simply draws its own thing — so the question only applies to
 *  consumers. */
export function mayFollowPresentedType(id: string): boolean {
  const spec = PRIMITIVES[id];
  if (!spec) return false;
  if (!spec.consumesUpstream) return true;
  return spec.preservesUpstream;
}

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
export function constructPrograms(
  beat: Beat,
  raw: Style,
  budgetMs: number,
  /** What the film allocated to this moment. When it allocated TEXT, only
   *  a construction that can put words on screen may realise it. */
  intervention?: "TEXT" | "COMPOSE",
  /** WHAT KIND OF CHANGE this moment is. Only `DECLARE` may build a new
   *  thing; every other act happens to what the film already has, and a
   *  construction that ignores the world cannot express it. See the gate
   *  below. */
  act?: Act,
  /** WHICH TAKE. 0 is the film as it has always composed. Above 0 it
   *  perturbs the representation weights and, below, which of the
   *  candidates is taken first — so asking for another take moves the
   *  KIND of picture, not just the noise inside one. */
  variant = 0,
): Program[] {
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
  const reps = representationsFor(beat, style, variant);

  const applicable: {
    c: Construction;
    fit: number;
    dislocated: boolean;
    rep: Representation | null;
  }[] = [];
  /* THE MEMBERSHIP GATE — the thing operators have always had and
   * constructions never did.
   *
   * `permitted(style)` is a hard set filter: an operator outside it cannot
   * run at all at that abstraction. The construction loop, by contrast,
   * was `for (const c of CONSTRUCTIONS)` — the entire array, unfiltered by
   * style, language, approach or tier. So every decision above it could
   * only ever re-weight, and nothing anywhere could say "not this".
   *
   * The first thing the gate is used for is the failure it explains. When
   * the film allocates TEXT to a moment, it has decided the words ARE the
   * intervention — and a construction that draws a room or a body will
   * happily win that scene and never put the promoted phrase on screen.
   * That is how a line the argument turns on gets chosen film-wide and
   * then silently fails to appear.
   *
   * `REALISES` already records which constructions can carry typography.
   * This is that table used for its stated purpose rather than as another
   * multiplier. */
  /* AND THE SECOND THING THE GATE IS FOR:
   *
   *     ONLY `DECLARE` MAY BUILD A NEW THING.
   *
   * Every other act is something happening to what is ALREADY on screen —
   * it accumulates, it turns around, it comes back, it goes. A
   * construction that ignores the film's world cannot express any of
   * that: it starts again from the sentence every scene, whatever the
   * world was doing.
   *
   * Measured, and it is the finding that made this necessary rather than
   * tidy: on EVERY scene where the world produced a move, a construction
   * that ignores the world won the picture. The move was computed,
   * attached to the right node by `serialiseScene`, and thrown away with
   * the losing candidate. Not a coincidence — the film only has a moving
   * element when the prose NAMED something, and a named noun is exactly
   * what makes an object construction win. The same mechanism as the
   * centipede, from a third angle.
   *
   * So this is "semantic understanding ≠ visual depiction" as a filter
   * rather than a weight, and it is the strongest form of it in the
   * compiler: a sentence may contain a concrete entity, and unless the
   * act is DECLARE that entity does not get built. */
  const introducing = !act || act === "DECLARE" || act === "NONE" || act === "QUALIFY";
  /* CHECKABLE MATERIAL IS NOT GATED. A printed quantity and a drawn route
   * are facts about the prose that anyone can verify, and this compiler's
   * standing position is that they outrank a preference. The gate is about
   * what the film INFERS, never about what the essay printed. */
  const printed = beat.figures.length > 0 || beat.route.length >= 2;
  const eligible =
    intervention === "TEXT"
      ? CONSTRUCTIONS.filter((c) => (REALISES[c.id] ?? []).includes("typographic"))
      : introducing || printed || !beat.world
        ? CONSTRUCTIONS
        : CONSTRUCTIONS.filter((c) => c.usesWorld);

  for (const c of eligible) {
    const raw0 = c.fit(beat) * (drewRoute && c.id !== "route" ? 0.5 : 1);
    // The construction's suitability, multiplied by how well it serves
    // the best idea it can serve. A construction that only realises the
    // literal reading of a sentence whose literal reading was killed by a
    // metaphor now scores near nothing — without anyone having written a
    // rule about windows.
    let best: Representation | null = null;
    let bestScore = 0;
    for (const rep of reps) {
      /* AND THE OTHER HALF OF THE GATE. A TYPOGRAPHIC READING OF A SCENE
       * WITH NO WORDS IS A LABEL WITH NOTHING BEHIND IT.
       *
       * The gate above stops a construction that cannot carry type from
       * winning a scene whose intervention IS the words. This is its
       * mirror: when the film allocated no words here, the sentence cannot
       * be REPRESENTED as type either, because there is no type.
       *
       * Measured on the fixture: two of ten scenes came out labelled
       * `typographic` with no text primitive anywhere in the chain. The
       * chain was right — there was nothing to set — and the label was
       * what was false, which is worse than either, because the Compile
       * view audits the chain against the label. */
      if (rep.mode === "typographic" && !beat.setsType) continue;
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
  /* ANOTHER TAKE REACHES PAST THE WINNER.
   *
   * The representation perturbation above moves what KIND of image the
   * sentence wants. This moves which construction gets to make it — and
   * both are needed, because on a real essay one construction takes fifty
   * scenes out of fifty-two, so a take that only re-weighted readings
   * would hand the same builder a slightly different brief and produce a
   * film that looks identical.
   *
   * The alternatives are already built and already carried on the report
   * for the director to pin. This is the same list, rotated: take N
   * promotes a runner-up that genuinely fit this sentence rather than
   * inventing a candidate that did not. A sentence with one applicable
   * construction still has one, in every take. */
  if (variant > 0 && applicable.length > 1) {
    const h = (variant * 2246822519 + beat.index * 374761393 + 0x85ebca6b) >>> 0;
    // Never past the third-best: below that a candidate is applicable
    // rather than suitable, and a take is meant to be another reading of
    // the sentence, not a worse one.
    const lift = h % Math.min(3, applicable.length);
    if (lift > 0) applicable.unshift(...applicable.splice(lift, 1));
  }
  const considered = applicable.slice(0, 5);

  const stacks = operatorStacks(style, beat.index, intent);
  const programs: Program[] = [];

  for (const { c, fit, dislocated, rep } of considered) {
    const built = c.build(beat, style, rep);
    /* DOES THIS PROGRAM PUT SET WORDS ON SCREEN? Asked of what was
     * actually built rather than of the beat, because the answer depends
     * on which construction won and which register it used — and the
     * treatment that must not run is a fact about the picture, not about
     * the sentence. */
    /* FLATTENED, because the type is almost never at the top level.
     *
     * `serialiseScene` puts every element after the first on a
     * compositor's SECOND INPUT, so a scene of a ground plus a phrase has
     * `text_layout` inside `layer_over.ground` — and a `.some()` over
     * `built.nodes` finds nothing. Measured: the guard was written,
     * typechecked, and did not fire once; the frame still came back
     * resampled by `parallax_layers`, with the first word sliced off.
     *
     * Standing rule 11 — a compositional structure is not implemented
     * until every system that operates on a visual program treats it
     * recursively. This is the fourth consumer to need that reminder. */
    const setsType = Boolean(beat.setsType) && flatIds(built.nodes).some(isSetType);
    for (const stack of stacks) {
      const program = assemble(c.id, built, stack, style, budgetMs, setsType, act);
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
        /* A RESTRAINED FILM PAYS FOR ELABORATION, NOT FOR COMPOSITION.
         *
         * This counted `program.nodes.length`, which is a category error
         * with a measurable cost. An OPERATOR stage is elaboration — a
         * dither, a scanline, a displacement laid over what was built. A
         * scene graph's nodes are ELEMENTS: a ground, a subject, a field,
         * the words, the line drawn between two things. Charging the same
         * per node meant a five-element composition paid roughly ten
         * times what a single text plate paid, so restraint was not
         * choosing simplicity — it was choosing EMPTINESS, and the
         * measurement showed it: `type`, one `text_layout` node, first on
         * ten of twenty-five scenes of a real essay.
         *
         * Restraint should say "fewer treatments", never "fewer things in
         * the frame". Composition is what the film is; elaboration is
         * what is done to it. */
        stack.length * style.restraint * 0.5;
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
  setsType = false,
  /** What kind of change this moment is — decides the film's motion
   *  character for this shot. See `MOTION_CHARACTER`. */
  act?: Act,
  /* WHY THERE IS NO RESTRAINT CEILING IN THIS FUNCTION.
   *
   *  It used to be applied to the finished chain in `compose.ts`:
   *
   *  It was a post-hoc truncation in `compose.ts`: build the whole
   *  program, then `chain.slice(0, ceiling)`. Two things went wrong with
   *  that, and both are standing rule 11.
   *
   *  It counted TOP-LEVEL nodes on a structure whose elements hang off
   *  compositor grounds — so a nested scene of eleven real primitives
   *  counted as six and passed, while a flat one of eight was cut.
   *
   *  And it cut from the TAIL, which is where the operators are. Measured
   *  across both real essays: 13 of 30 operators the report named were
   *  not in the chain at all, `halftone` 0 of 4 and `scanline` 0 of 3 —
   *  the entire J · RASTER family never ran in 32 compiles. Restraint was
   *  removing a film's surface texture, which is not what restraint
   *  means, and the program went on claiming what had been cut.
   *
   *  The slice is now scoped to the LADDER path, which is the flat chain
   *  it was written for, and a constructed program is left whole — so
   *  `applied` names what is actually in the chain and the report is true
   *  by construction. Restraint still governs the picture: it decides how
   *  many ELEMENTS the scene graph builds, upstream of here. */
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
    /* AN OPERATOR IS NOT ANOTHER THING ON SCREEN.
     *
     * The ceiling is restraint — "how much can be on screen at once" —
     * and it is counted against what the construction BUILDS. A halftone,
     * a grade, a scanline are treatments of the same image: they add
     * texture, not clutter, and capping them is why a restrained film
     * lost its surface rather than its density.
     *
     * The first attempt at this fix checked the whole candidate here,
     * which only moved the cut earlier and produced the same silent loss.
     * `treatment.test.ts` caught it in one run: a visual language moves
     * operator appetites, and with operators suppressed the language
     * reached only the scenes a human had ratified — which is precisely
     * the "it uses the same filter palettes" complaint that test exists
     * to prevent coming back.
     *
     * What still bounds an operator is `chainCost` against the frame
     * budget, which is the honest limit: cost, not clutter. A scene graph
     * routinely builds sixteen primitives for three elements, so ANY
     * clutter gate here — on the candidate or on the construction —
     * silences every operator on every constructed scene, which is the
     * state this file was in. */
    // A scene whose subject is WORDS does not get its frame resampled.
    // `language.ts` already keeps this discipline — its `surface()` may
    // return nothing, documented as the one degree of freedom that stops a
    // language being turned into raster mush by an operator tail — and the
    // construction path was bypassing it entirely.
    if (setsType && !op.chain.every(mayFollowPresentedType)) continue;
    /* AN OPERATOR MAY NOT PAINT OVER WHAT IT WAS APPLIED TO.
     *
     * `chainOverwrites` has always been able to detect this and has only
     * ever REPORTED it — a stack of sources is sometimes what a director
     * wants. But an operator TAIL is not a director's choice; it is
     * appended by the engine, and appending a source to a constructed
     * scene silently deletes the scene and bills for it.
     *
     * Measured, and it is the whole of "I see some of the same exact
     * patterns": the frame carrying "The fallacy isn't a lapse." rendered
     * a cityscape with no words in it, because `plate_scene` — a source —
     * was appended after the composition and overwrote it. Two other
     * frames were full-bleed reaction-diffusion for the same reason. And
     * the ONE frame that looked right, the title, was right by accident:
     * `variable_axis` had overwritten the scene and drawn the title
     * itself.
     *
     * A source is still reachable as a CONSTRUCTION, which is where a
     * director asking for that look should get it. It is no longer
     * reachable as a tail. */
    const overwritten = chainOverwrites(candidate.map((n) => n.primitiveId)).some(
      (o) => o.at < built.nodes.length,
    );
    if (overwritten) continue;
    nodes.length = 0;
    nodes.push(...candidate);
    applied.push(op.id);
  }

  // The motion tail, if it still fits and can legally attach. The act's
  // own character goes LAST, so it re-times the eased motion rather than
  // being flattened by it.
  const character = act ? MOTION_CHARACTER[act] : undefined;
  /* The character is tried SEPARATELY, not appended to the tail's loop.
   * That loop `break`s the moment one of its two primitives will not
   * attach — so hanging the act's motion off the end meant it only ever
   * ran on the chains where parallax AND ease had both already fitted.
   * Measured: 2 of 52 scenes. It re-times whatever is there; it does not
   * care what came before it. */
  for (const primitiveId of MOTION_TAIL) {
    if (setsType && !mayFollowPresentedType(primitiveId)) continue;
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

  /* WHERE THE CHARACTER CAN ACTUALLY GO.
   *
   * Motion craft is ANIMATION → ANIMATION, and most chains end on
   * `layer_over`, which emits IMAGE. Appending to the end therefore
   * attached in 5 of 52 scenes and the other 47 kept the same anonymous
   * ease. It re-times what it is handed and passes it on unchanged, so it
   * belongs at the LAST point in the chain the type system allows — not
   * at the end for the sake of it. Searched from the back, so it re-times
   * as much of the shot as it legally can. */
  if (character && (!setsType || mayFollowPresentedType(character.id))) {
    const withIt = [...nodes.map((n) => n.primitiveId), character.id];
    if (chainCost(withIt) <= budgetMs) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const before = nodes[i]?.primitiveId;
        const after = nodes[i + 1]?.primitiveId;
        if (!before || !canChain(before, character.id)) continue;
        if (after && !canChain(character.id, after)) continue;
        nodes.splice(i + 1, 0, {
          primitiveId: character.id,
          // Pulled back by restraint — a spare film still moves like
          // itself, just less.
          params: { amount: character.amount * (1 - style.restraint * 0.45) },
          reason: `${character.why} — because this moment ${String(act).toLowerCase()}s`,
        });
        break;
      }
    }
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
