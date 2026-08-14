// REPRESENTATION — the layer that was missing, and the reason every
// physical noun became the same ceiling fixture.
//
// THE PROVENANCE, because it explains the shape of this file.
//
// `creature_chain` and `mounted_fixture` were written in the Lab as
// FEASIBILITY PROOFS. `lab/prims-f.js` says so in its own first line:
// "The centipede proved code can generate a SUBJECT. This proves the
// other half." They were demonstrations that a coded organism and a coded
// physical object were possible at all.
//
// They then became the ontology. A 257-noun lexicon flattens to eight
// kinds; `kind: "object"` covers door, window, lock, gate, sign, screen,
// bed, mattress, bus, van, truck, pipe, valve, server, phone; and
// `construct.ts` said:
//
//     fit: (beat) => (beat.subjects[0]?.kind === "object" ? 1 : 0)
//
// Fit 1.0, unconditional, no competitor. So a bus, a mattress and a
// window all compiled to a generic mounted dome, and the essay's whole
// object world was two nouns rebuilt seven times.
//
// THE FIX IS NOT MORE NOUNS AND NOT MORE GENERATORS. A noun-per-generator
// system is a clip-art compiler, which is not what this was ever for. The
// missing concept is between the subject and the construction:
//
//     SUBJECT + ROLE + CONTEXT + RELATION + METAPHOR
//            ↓
//     REPRESENTATION CANDIDATES     ← this file
//     literal · geometric · typographic · diagrammatic · structural · symbolic
//            ↓
//     CONSTRUCTION CANDIDATES       (fit, as a suitability test)
//            ↓
//     REALISATION → primitives
//
// A representation is a VISUAL IDEA, not a treatment. These are six
// different things to put on screen:
//
//     literal        an architectural aperture
//     geometric      frame, void, boundary
//     typographic    the word WINDOW becoming a frame
//     diagrammatic   viewer ← window ← medium
//     structural     a transparent layer with another layer behind it
//     symbolic       something offered as transparent that is not
//
// Not six gradings of one image. That distinction is the whole point: we
// already know palette, texture and scanlines do not solve this.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO. It does not choose. It
// proposes, weighted, and `construct.ts` runs the competition — because
// making one function decide the whole representation would rebuild the
// routing table in a more complicated form, which is the correction the
// operator made to the first version of this design.

import type { Beat, Style } from "./construct.ts";

/** The six ways a meaning can become an image. Fixed and small on
 *  purpose: this is a vocabulary of visual THINKING, not a catalogue of
 *  effects, and a seventh should have to argue for itself. */
export type Mode =
  | "literal"
  | "geometric"
  | "typographic"
  | "diagrammatic"
  | "structural"
  | "symbolic";

export const MODES: Mode[] = [
  "literal",
  "geometric",
  "typographic",
  "diagrammatic",
  "structural",
  "symbolic",
];

export interface Representation {
  mode: Mode;
  /** The visual idea, in the director's language. Carried onto the plan so
   *  the Studio can show what was considered, not only what won. */
  idea: string;
  /** How well this idea suits THIS passage, 0..1. */
  weight: number;
  /** Why it scored what it scored — a phrase, for the report. */
  because: string;
}

/* ── IS THE NOUN BEING USED, OR MENTIONED? ────────────────────────────
 *
 * The single semantic distinction the system had no concept of.
 * `detectSubjects` is a whole-word lexicon match, so "he opened the
 * window" and "claiming to be a window" are byte-identical to it — and
 * the second one is not about a window at all.
 *
 * Checkable from the prose, in the same spirit as a figure: these are
 * literal frames that appear immediately before the noun, not a model's
 * opinion about meaning. A sentence that says "like a X" is telling you
 * it is not about X. */
/* A SIMILE IS NOT THIS, and the distinction is the whole rule.
 *
 * The first version of this regex included "like" and "as if". The
 * flagship test caught it immediately: "they walked around the city LIKE
 * INSECTS" stopped building insects. That is wrong, and instructively so.
 *
 *   SIMILE      "walked like insects"      INVITES the image.
 *               The sentence is asking you to see insects.
 *
 *   CLAIM       "claiming to be a window"  DENIES it.
 *               The sentence is reporting an assertion about what
 *               something is, and disputing it. It is not about a window.
 *
 * So only the claim frames are here. A simile is one of the strongest
 * reasons to draw a thing literally, not a reason to refuse. */
const FIGURATIVE_FRAME =
  /\b(claim(?:s|ed|ing)?\s+to\s+be|present(?:s|ed|ing)?\s+(?:itself|themselves)\s+as|what\s+we\s+call|so-called|a\s+metaphor\s+for|passe[sd]?\s+for|dressed\s+up\s+as|amounts?\s+to)\s+(?:an?\s+|the\s+)?$/i;

/** Does the sentence use this noun figuratively? Judged on the span
 *  immediately before the matched word, so it is checkable against the
 *  prose exactly the way a figure's verbatim substring is. */
export function isFigurative(sentence: string, offset: number): boolean {
  return FIGURATIVE_FRAME.test(sentence.slice(0, offset));
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** THE CANDIDATE SET for one beat.
 *
 *  Every mode is always offered — a representation that scores zero is
 *  still a thing the director can be shown and can choose. What changes
 *  per sentence is the WEIGHT, and the weights come from checkable facts
 *  about the prose plus the film's own state.
 *
 *  The compositional strategy reaches this through `style`: abstraction,
 *  typography, data and language are already resolved per scene, so a
 *  film composed against a typographic language raises the typographic
 *  idea everywhere without this file knowing what a language is. */
/** How each approach leans on the six readings. Multipliers, so nothing is
 *  ever removed from the list — a film with an approach can still reach the
 *  reading a particular sentence demands, it simply has a preference.
 *
 *  `image` leans exactly like `world` for now: generative imagery is not a
 *  material this build can produce, so an approach that promised it would
 *  be a control that reports rather than acts. It is listed so the axis is
 *  complete and behaves as the nearest honest thing until the material
 *  exists. */
const APPROACH_LEAN: Record<string, Partial<Record<Mode, number>> | null> = {
  hybrid: null,
  text: { typographic: 2.6, symbolic: 1.2, literal: 0.5, structural: 0.6, geometric: 0.8 },
  abstract: { geometric: 2.0, symbolic: 1.9, structural: 1.3, literal: 0.35, typographic: 0.7 },
  world: { literal: 2.0, structural: 1.6, diagrammatic: 0.8, typographic: 0.5, symbolic: 0.7 },
  image: { literal: 2.0, structural: 1.6, diagrammatic: 0.8, typographic: 0.5, symbolic: 0.7 },
};

/** ANOTHER TAKE ON THE SAME SENTENCE.
 *
 *  Deterministic — a hash of (which take, which scene, which reading), so
 *  the same variant always produces the same film and two variants
 *  produce genuinely different ones. A MULTIPLIER, never a filter, which
 *  is the discipline the approach lean already keeps: a printed figure
 *  and a drawn route still reach the chart in every take, because both
 *  are decided upstream of here on facts about the prose.
 *
 *  THE RANGE IS WIDE ON PURPOSE, and the first one was not. `clamp01`
 *  saturates the winning reading at 1.0 — a text-driven film's
 *  typographic idea scores 1.495 before the clamp and 1.0 after — so a
 *  gentle ±10% cannot reorder anything, and the first version changed the
 *  IDEA in one scene of twenty-two. A second take that differs only in
 *  procedural noise is the button doing nothing, which is the thing this
 *  exists to fix. [0.4, 1.9] genuinely overlaps a strong reading with the
 *  ones behind it without ever promoting a reading that scored zero. */
function takeWeight(variant: number, sceneIndex: number, k: number): number {
  if (variant <= 0) return 1;
  const h = (variant * 2654435761 + sceneIndex * 40503 + k * 97 + 0x9e3779b9) >>> 0;
  return 0.4 + ((h % 1000) / 1000) * 1.5;
}

const MODE_ORDER: Mode[] = [
  "literal",
  "geometric",
  "typographic",
  "diagrammatic",
  "structural",
  "symbolic",
];

export function representationsFor(beat: Beat, style: Style, variant = 0): Representation[] {
  const subject = beat.subjects[0];
  const noun = subject?.text ?? "";
  const figurative = subject ? isFigurative(beat.sentence, subject.offset) : false;
  const printedFigure = beat.figures.length > 0;
  const drewRoute = beat.route.length >= 2;
  const hasRelation = Boolean(beat.relation);
  const named = Boolean(subject);

  const out: Representation[] = [];
  const add = (mode: Mode, weight: number, idea: string, because: string) =>
    out.push({ mode, weight: clamp01(weight), idea, because });

  // LITERAL — draw the thing. Strong when a specific noun is genuinely
  // being used, and it is the reading that FIGURATIVE USE KILLS. This one
  // line is the difference between "claiming to be a window" reaching a
  // ceiling dome and not.
  add(
    "literal",
    subject ? (figurative ? 0.05 : subject.weight * (1 - style.abstraction * 0.5)) : 0,
    named ? `the ${noun} itself, in a place` : "nothing named to draw",
    figurative
      ? `"${noun}" is being invoked, not used — the sentence is not about a ${noun}`
      : named
        ? `the sentence names a ${noun}`
        : "no depictable noun",
  );

  // GEOMETRIC — the thing reduced to its form. A window is a frame, a
  // void and a boundary; that survives the metaphor, which is why this
  // RISES when the literal reading falls.
  add(
    "geometric",
    named ? 0.3 + (figurative ? 0.35 : 0) + style.abstraction * 0.3 : style.abstraction * 0.35,
    named
      ? `${noun} as pure form — its shape, its edge, what it encloses`
      : "form without a subject",
    figurative
      ? "the form survives a metaphor even when the object does not"
      : "form is always available",
  );

  /* TYPOGRAPHIC — the words are the image. ONLY WHERE THERE ARE WORDS.
   *
   * This carried a flat 0.35 floor and the note "every sentence has
   * words; a subject is not required". Both were true of the SENTENCE and
   * false of the SCENE. Promotion decides film-wide which moments earn
   * text; everywhere else `beat.phrase` is the empty string, and this
   * reading still scored 0.35 — multiplied to 0.91 by a text-driven
   * film's lean, which beat every reading that had something to draw.
   *
   * Measured on a real 52-scene film: 41 scenes composed TYPOGRAPHIC and
   * 26 of them had nothing to set. Those 26 fell through `opsFor`'s
   * no-words branch to one hardcoded shape, so `parametric_curve → place
   * → geometry_draw` opened 42 of 52 frames and 19 of 135 primitives ever
   * ran. That is the whole of "every shot looks the same".
   *
   * A reading that will draw nothing is not a weak reading, it is not a
   * reading. Scoring it honestly is what lets GEOMETRIC, STRUCTURAL,
   * SYMBOLIC and DIAGRAMMATIC — all of which were unreachable — take the
   * scenes the film speaks rather than shows. */
  const set = beat.phrase.trim();
  add(
    "typographic",
    set ? 0.35 + style.typography * 0.45 + (figurative ? 0.15 : 0) : 0,
    set ? `the sentence's own words, set — "${set}"` : "no words are shown at this moment",
    set
      ? "the film promoted this span to the screen"
      : "the film speaks this line rather than showing it, so there is no type to set",
  );

  // DIAGRAMMATIC — the relation is the image. Earned by the prose rather
  // than chosen: a printed figure or a drawn route means there is
  // genuinely something to diagram.
  add(
    "diagrammatic",
    (printedFigure ? 0.55 : 0) + (drewRoute ? 0.6 : 0) + (hasRelation ? 0.3 : 0) + style.data * 0.3,
    drewRoute
      ? `the route itself — ${beat.route.join(" → ")}`
      : printedFigure
        ? "the quantity as a measured figure"
        : "what acts on what",
    drewRoute
      ? "the prose drew a route"
      : printedFigure
        ? "the prose printed a figure"
        : hasRelation
          ? "the sentence has a subject and an object"
          : "nothing measurable in the sentence",
  );

  // STRUCTURAL — layers, and what is behind what. The reading a metaphor
  // usually wants: "claiming to be a window" is a surface presented as
  // transparent with structure behind it.
  add(
    "structural",
    0.2 + (figurative ? 0.5 : 0) + style.abstraction * 0.35 + (hasRelation ? 0.15 : 0),
    figurative
      ? "a surface offered as transparent, with structure behind it"
      : `${named ? noun : "the subject"} as layers — what is in front, what is behind`,
    figurative
      ? "a metaphor is a claim about what something is hiding"
      : "depth is always available",
  );

  // SYMBOLIC — the idea as a mark. Deliberately the weakest by default:
  // it is the most powerful and the easiest to use as an excuse for an
  // arbitrary picture, so it has to be reached for.
  add(
    "symbolic",
    0.1 + (figurative ? 0.25 : 0) + style.abstraction * 0.4 + style.experimentalism * 0.2,
    "a mark that stands for it rather than shows it",
    "reached for at the abstract end of the ladder",
  );

  /* THE DIRECTOR'S APPROACH, APPLIED AS A WEIGHT.
   *
   * The one thing above this layer that says what KIND of picture the film
   * makes — and it belongs here rather than in `fit`, because `fit` asks
   * "is this construction suitable for this sentence" and this asks "what
   * is this film made of". Two questions; the second one is the director's.
   *
   * A MULTIPLIER, never a filter. Every mode stays in the list at a lower
   * weight, so a text-driven film that hits a sentence the typographic
   * reading cannot serve still reaches the one that can — and a printed
   * figure or a drawn route still overrides everything, upstream of here,
   * because both are checkable facts about the prose rather than
   * preferences. `hybrid` multiplies by one and changes nothing, which is
   * what makes every film composed before this field existed compose
   * identically. */
  const lean = APPROACH_LEAN[beat.approach ?? "hybrid"];
  if (lean) {
    for (const r of out) r.weight = clamp01(r.weight * (lean[r.mode] ?? 1));
  }
  /* AND WHICH TAKE THIS IS. Applied last, over the top of everything the
   * prose and the director decided, because a second take is a second
   * opinion about the same evidence rather than different evidence. */
  if (variant > 0) {
    for (const r of out) {
      r.weight = clamp01(r.weight * takeWeight(variant, beat.index, MODE_ORDER.indexOf(r.mode)));
    }
  }
  return out.sort((a, b) => b.weight - a.weight);
}

/* ── WHICH CONSTRUCTIONS CAN REALISE WHICH IDEAS ──────────────────────
 *
 * Declared once, here, rather than as a `modes` field edited into eight
 * construction literals — so the whole mapping can be read at a glance
 * and an omission is visible.
 *
 * THIS IS WHERE `fixture` GETS DEMOTED BACK TO WHAT IT IS. It realises
 * exactly one idea: the literal one. It is a genuinely good way to build
 * a mounted physical unit and a terrible way to represent the concept of
 * mediation, and until now it was the only thing an object noun could
 * reach. It keeps its job; it loses its monopoly.
 *
 * And it is where the typographic and diagrammatic capabilities — which
 * already work, and which produced the only legible frames this system
 * has made — become reachable BY AN OBJECT NOUN for the first time. */
export const REALISES: Record<string, Mode[]> = {
  /* THE SCENE CONSTRUCTION SERVES ALL SIX, and that is the claim the
   * whole three-layer separation rests on. If it needed a different
   * generator per mode it would be the routing table again with more
   * arithmetic; it does not, because what differs between a literal
   * reading and a diagrammatic one is WHICH OPERATIONS RUN on the same
   * arrangement, not which generator was picked. */
  scene: ["literal", "structural", "geometric", "typographic", "diagrammatic", "symbolic"],
  fixture: ["literal"],
  body: ["literal"],
  space: ["literal", "structural"],
  paper: ["literal", "structural"],
  type: ["typographic", "symbolic"],
  quantity: ["diagrammatic"],
  route: ["diagrammatic", "structural"],
  network: ["diagrammatic", "geometric"],
  field: ["geometric", "structural", "symbolic"],
  grid: ["geometric", "diagrammatic"],
};

/** How well a construction serves an idea. 1 when it declares the mode,
 *  and a floor rather than 0 for the rest — a construction that does not
 *  claim a mode can still be offered, it simply has to out-fit everything
 *  that does. Nothing is made unreachable by this table. */
export function realisationFit(constructionId: string, mode: Mode): number {
  const modes = REALISES[constructionId];
  if (!modes) return 0.5;
  return modes.includes(mode) ? 1 : 0.15;
}
