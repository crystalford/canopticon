// THE VISUAL GRAMMAR — how a representation becomes visual material.
//
// The guardrail this file was written under, and it is the right one:
//
//   "The next danger is that Claude will immediately start building six
//    new elaborate construction systems and accidentally recreate the
//    same problem at the next level."
//
// That is exactly what `structural → 30 structural primitives` would be.
// So this is deliberately SMALL: eight general visual OPERATIONS, shared
// across modes, each realised by primitives that already exist. There is
// no window operation, no camera operation, and no operation named after
// any noun. A window becomes `frame + enclosure + aperture`; a system
// becomes `node + edge + grouping`; and both use the same eight verbs.
//
//     REPRESENTATION   what the idea IS            (represent.ts)
//     GRAMMAR          what visual material it is  (this file)
//     PRIMITIVES       how that material renders   (the palette)
//
// Those three layers stay separate. Collapsing them is how the system
// ended up with `kind → generator` in the first place.
//
// THE CLAIM THIS FILE IS TESTING. That a handful of general operations
// gives the representation layer enough expressive power that a
// noun→generator mapping is never needed. If eight verbs can express
// many different semantic ideas, that is a far more important result
// than adding primitives.

import type { PlannedNode } from "./construct.ts";
import type { Mode } from "./represent.ts";

/** The operations. Visual verbs, not things.
 *
 *  Chosen because each one answers a question that recurs across
 *  completely unrelated subject matter: what is the boundary, what is
 *  inside it, what is behind it, how many are there, what connects to
 *  what, what is being said. A noun-specific generator answers none of
 *  those; it answers "what does a window look like", which is the
 *  question that produced the ceiling dome. */
export type Op =
  | "FRAME" // a boundary and what it encloses
  | "ENCLOSURE" // inside and outside, as solid form
  | "LAYER" // what is in front of what
  | "APERTURE" // an opening — the hole, not the wall
  | "REPEAT" // many of it, counted off the prose
  | "CONNECT" // this relates to that
  | "WORD" // the language itself, as material
  | "MARK" // a sign that stands in for the thing
  | "CONTOUR" // the edge of a form rather than the form
  | "SOLID" // a bounded polygonal body, not a blob
  | "DIVIDE" // that body given parts
  | "MASS" // that body given depth
  | "PLACE"; // how much of the frame it commands, and where

/** What the grammar is given. Semantic material, never a primitive name
 *  and never a noun-keyed lookup. */
export interface Material {
  /** The subject's own word, when the sentence named one. Used as TEXT,
   *  never as a key into a table — that distinction is the whole point. */
  noun: string;
  /** The words to set, already chosen by `phrase.ts`. */
  phrase: string;
  /** A count the prose actually printed. Never invented. */
  count: number | null;
  /** Two named things, when the sentence has them. */
  relation: [string, string] | null;
  /** 0..1, from the film's own curves. */
  density: number;
  energy: number;
  abstraction: number;
  /** How loud the film's typography is. Read by the scene graph to decide
   *  whether words appear as a second element beside a form. */
  typography: number;
  seed: number;
  /** WHAT THE MARKS ARE MADE OF, 0..7 — see `geometry_draw`'s `material`.
   *  Set by the scene graph from the ROLE and the REPRESENTATION, so the
   *  same material can appear across representations and the same
   *  representation can use different materials. Material and
   *  representation stay separate on purpose: collapsing them would make
   *  the five columns five hard-coded art styles. */
  material?: number;
  /** Set by the SCENE GRAPH per element. When present, PLACE uses it
   *  instead of deriving one — the composition has already decided where
   *  this element sits and how much of the frame it takes, and a second
   *  opinion here would fight it. */
  place?: { scale: number; x: number; y: number; crop: number };
  /** 0..1 — how much of the reader's attention this element is entitled
   *  to. Assigned by the scene graph's `emphasise`, consumed only through
   *  `applyEmphasis` below. */
  emphasis?: number;
}

/* ── HIERARCHY: THE ONE TRANSLATION POINT ─────────────────────────────
 *
 * Standing rule 9, applied to attention. The semantic layer says THIS
 * ELEMENT IS ENTITLED TO 0.74 OF THE FRAME'S ATTENTION; it never says
 * "draw it thinner" or "fade it to 0.6". Exactly one function turns that
 * number into parameters, and every new consumer goes inside it.
 *
 * The failure this prevents already happened once here in miniature. The
 * compositor keyed opacity and sink to a ROLE TABLE while the renderer
 * keyed weight to DENSITY, so two unrelated mechanisms both claimed to
 * decide how loudly an element speaks — and they disagreed. FIELD came in
 * at 0.55 opacity with 0.5 sink and vanished, while the arrangement that
 * placed it was computing perfectly. Both tables are gone; both consumers
 * call this.
 *
 * FOUR LEVERS, ONE NUMBER, because a hierarchy made of only one of them
 * is not a hierarchy:
 *
 *   weight    the focus is drawn heaviest — a mark's own presence
 *   recede    subordinates soften and wash toward the ground, which is
 *             what DISTANCE looks like rather than what turning something
 *             down looks like
 *   opacity   how loudly the compositor brings it in
 *   sink      how far behind what is in front of it it sits
 *
 * The floors matter and are deliberate: nothing ever recedes past 0.62 or
 * drops below 0.46 opacity. An element that cannot be seen is not a quiet
 * element, it is a missing one — the exact bug that made a correctly
 * computed five-element arrangement render as a single form.
 */
export interface Attention {
  weight: number;
  recede: number;
  opacity: number;
  sink: number;
}

export function applyEmphasis(emphasis: number, density = 0.5): Attention {
  const e = clamp(emphasis, 0, 1);
  return {
    // Squared, so the drop from the focus to the next element is steep
    // and the drop between two subordinates is shallow. A hierarchy is
    // one thing and then everything else, not an even ramp.
    weight: clamp(0.14 + e * e * (0.4 + density * 0.45), 0.08, 1),
    recede: clamp((1 - e) * 0.62, 0, 1),
    opacity: clamp(0.46 + e * 0.54, 0.46, 1),
    sink: clamp((1 - e) * 0.5, 0, 1),
  };
}

const n = (primitiveId: string, params: PlannedNode["params"], reason: string): PlannedNode => ({
  primitiveId,
  params,
  reason,
});

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/* ── THE OPERATIONS, each realised from the existing palette ──────────
 *
 * Every one takes the same `Material` and returns nodes. None of them
 * looks at the noun to decide WHAT to build — only to decide how big,
 * how many, how deep. */

const OPS: Record<Op, (m: Material) => PlannedNode[]> = {
  // A boundary and what it encloses. `boolean_ops` subtracting one form
  // from another IS a frame — the negative space is the point.
  FRAME: (m) => {
    const a = applyEmphasis(m.emphasis ?? 1, m.density);
    return [
      n(
        "geometry_draw",
        {
          weight: a.weight,
          halftone: 0,
          invert: 0,
          trail: 0,
          material: m.material ?? 0,
          recede: a.recede,
        },
        a.recede > 0.28
          ? "held back — softened and washed toward the ground, so the eye passes over it"
          : "a boundary drawn as line, not as a filled shape",
      ),
    ];
  },

  /* NOT IN THE LITERAL RECIPE ANY MORE, and the reason is worth keeping.
   * `boolean_ops` flattened a 7-sided polygon, a wireframe volume and a
   * parametric curve into the SAME filled disc — three different forms,
   * one output. A transform that erases the identity of everything it
   * receives is not an operation on a form, it is a form generator
   * wearing an operator's name. It stays available where subtraction is
   * genuinely the idea; it is no longer on the path where "the thing
   * itself" is. */
  ENCLOSURE: (m) => [
    n(
      "boolean_ops",
      {
        // 1 = subtract. An enclosure is what is left when the inside is
        // taken out of the outside.
        op: 1,
        offset: clamp(0.25 + m.abstraction * 0.4, 0, 1),
        size: clamp(0.4 + m.density * 0.35, 0.2, 1),
      },
      "inside taken out of outside — the wall is what remains",
    ),
  ],

  // Depth as a stack of surfaces, peeled. This is the structural reading
  // of a claim: something presented as one surface with another behind.
  LAYER: (m) => [
    n(
      "layer_peel",
      {
        layers: Math.round(clamp(3 + m.density * 4, 2, 7)),
        rate: clamp(0.12 + m.energy * 0.4, 0.05, 1),
        curl: clamp(0.3 + m.abstraction * 0.5, 0, 1),
      },
      "surfaces in front of surfaces, coming apart to show what is behind",
    ),
  ],

  // The opening rather than the wall. `wireframe` form 1 is an open
  // volume — you look through it, which is what an aperture is for.
  /* AN OPENING, NOT A PLANE. This was `wireframe(form:1)` — an open
   * volume — which drew a rectangle and made the structural column a
   * rectangle in every row of every gallery. An aperture is a SURFACE
   * WITH A HOLE, and the hole is what the scene behind is seen through;
   * the compositor's knockout does the rest. */
  APERTURE: (m) => [
    n(
      "aperture",
      {
        sides: Math.round(clamp(m.count ? (m.count % 8) + 4 : 4 + (m.seed % 4), 3, 32)),
        size: clamp(0.3 + (1 - m.density) * 0.45, 0.05, 1.2),
        x: clamp(0.5 + (((m.seed * 29) % 100) / 100 - 0.5) * m.abstraction * 0.4, 0, 1),
        y: 0.5,
        // A film that has come apart tears its openings rather than
        // cutting them.
        erode: clamp((m.abstraction - 0.5) * 1.2, 0, 1),
        surface: clamp(0.5 + m.density * 0.45, 0, 1),
      },
      "a surface with an opening — what is behind is seen only through it",
    ),
  ],

  // MANY OF IT — and the count is the prose's, never the system's.
  REPEAT: (m) => [
    n(
      "recursive_geometry",
      {
        depth: Math.round(clamp(m.count ? Math.log2(Math.max(2, m.count)) + 3 : 5, 2, 11)),
        angle: clamp(0.2 + m.energy * 0.5, 0.05, 1),
        decay: clamp(0.9 - m.density * 0.3, 0.5, 0.9),
      },
      m.count
        ? `repeated to the depth the prose printed — ${m.count}`
        : "repeated without a printed count, so shallowly",
    ),
  ],

  CONNECT: (m) => [
    // `force_layout` consumes DATA, so the operation carries its own
    // source. The series is the sentence's own significant words, or the
    // count it printed — never invented numbers.
    n(
      "data_series",
      {
        series: m.count
          ? `${m.noun || "count"}@${Math.min(100, m.count)}|rest@${Math.max(10, 100 - Math.min(100, m.count))}`
          : m.phrase
              .split(/\s+/)
              .slice(0, 6)
              .map((w, i) => `${w}@${90 - i * 12}`)
              .join("|"),
      },
      "the sentence's own terms, as the thing being related",
    ),
    n(
      "force_layout",
      {
        nodes: clamp(m.count ? Math.min(1, m.count / 60) : 0.25 + m.density * 0.3, 0.05, 1),
        charge: clamp(0.3 + m.energy * 0.5, 0.1, 1),
        link: clamp(0.35 + m.density * 0.4, 0.1, 1),
      },
      m.relation
        ? `${m.relation[0]} joined to ${m.relation[1]}`
        : "things, and what holds them together",
    ),
  ],

  WORD: (m) => [
    n(
      "text_layout",
      {
        text: m.phrase,
        mode: Math.round(clamp(m.abstraction * 4, 0, 5)),
        tracking: clamp(0.1 + m.abstraction * 0.5, 0, 1),
        scale: clamp(0.75 - m.density * 0.25, 0.1, 1),
      },
      `the words themselves, set — "${m.phrase}"`,
    ),
  ],

  /* A BOUNDED BODY. The literal reading was `wireframe → boolean_ops`,
   * which produced a filled circle or a pair of them and nothing else —
   * the thinnest column in every gallery. `shape_morph` interpolates
   * between two polygon counts, so the same operation makes a triangle,
   * a hexagon, a near-circle or the transition between them, and the
   * count comes off the prose when the prose printed one. */
  SOLID: (m) => [
    n(
      "polygon",
      {
        // The face count comes off the prose when the prose printed one.
        // "Nine numbered rooms" is a nine-sided body; nothing else is.
        sides: Math.round(clamp(m.count ? (m.count % 10) + 3 : 4 + (m.seed % 6), 3, 24)),
        radius: clamp(0.22 + (1 - m.density) * 0.3, 0.05, 0.9),
        corner: clamp(m.abstraction * 0.5, 0, 1),
        taper: clamp((((m.seed * 13) % 100) / 100 - 0.5) * m.abstraction, -0.8, 0.8),
        turn: clamp(m.energy * 0.5, 0, 1),
      },
      m.count
        ? `a body with ${(m.count % 10) + 3} faces — the count is the prose's`
        : "a bounded body, its faces counted rather than defaulted",
    ),
  ],

  /* DEPTH. Declared and NOT USED in the literal recipe: `extrude` takes
   * a `text` parameter and rasterises its own plate rather than
   * extruding what arrives, so it REPLACED the polygon instead of giving
   * it a near face and a far one. The same decorative-link failure the
   * payload audit named, caught here by looking at the picture. Kept as
   * an operation because a real depth primitive belongs in the grammar;
   * it is simply not this one. */
  MASS: (m) => [
    n(
      "extrude",
      {
        text: m.noun ? m.noun.toUpperCase().slice(0, 10) : m.phrase.split(" ")[0] || "FORM",
        depth: clamp(0.2 + (1 - m.abstraction) * 0.55, 0.05, 1),
        spin: clamp(0.08 + m.energy * 0.4, 0, 1),
      },
      "given a near face and a far one",
    ),
  ],

  // THE EDGE, NOT THE FILL. This is the whole distinction between
  // depicting a thing and describing its shape, and its absence is why
  // LITERAL and GEOMETRIC rendered as the same filled blob.
  CONTOUR: (m) => [
    n(
      "contour",
      {
        thin: clamp(0.4 + m.abstraction * 0.5, 0, 1),
        construction: clamp(0.2 + m.abstraction * 0.6, 0, 1),
        seed: m.seed,
      },
      "reduced to its own edge, with the lines it was built on",
    ),
  ],

  /* WHERE IT SITS AND HOW BIG IT IS.
   *
   * The gallery's real weakness was never a broken primitive: it was that
   * every frame held ONE FORM, CENTRED, AT ONE SCALE. Every source draws
   * itself where it wants to be, so the grammar could decide what to
   * build and had no way to decide what the composition IS.
   *
   * Scale and position are read off the semantic material — a printed
   * count makes a thing small in a large field, a metaphor pushes it off
   * centre, density crops it — so this is a compositional decision rather
   * than a parameter someone picked. */
  PLACE: (m) => {
    if (m.place) {
      return [
        n(
          "place",
          { scale: m.place.scale, x: m.place.x, y: m.place.y, crop: m.place.crop },
          "placed by the composition",
        ),
      ];
    }
    const many = m.count !== null && m.count > 12;
    // A counted multitude is small against a big field; a single named
    // thing is allowed to dominate. Deterministic per beat.
    const scale = many ? 0.3 + m.density * 0.15 : 0.55 + (1 - m.density) * 0.5;
    const off = ((m.seed * 37) % 100) / 100;
    return [
      n(
        "place",
        {
          scale: clamp(scale, 0.05, 4),
          // Off-centre in proportion to how far the film is from literal.
          x: clamp(0.5 + (off - 0.5) * m.abstraction * 0.7, -0.4, 1.4),
          y: clamp(0.5 + (0.5 - off) * m.abstraction * 0.45, -0.4, 1.4),
          crop: scale > 1 ? 1 : 0,
        },
        many
          ? `small against a large field — the prose counted ${m.count}`
          : scale > 1
            ? "larger than the frame, cropped by it"
            : "given the frame, off centre",
      ),
    ];
  },

  /* THE OPERATION THAT MAKES A BODY CONSTRUCTED.
   *
   * Materiality said what a body is MADE of; hierarchy said which body
   * the frame is ABOUT. Neither could say that a body HAS PARTS, and
   * having parts is most of what separates a depicted thing from a shape
   * — which is why the literal column stayed one convex polygon in every
   * row of every gallery through both of those passes.
   *
   * The axis is READ, not picked. A printed multitude is a grid because
   * that is what many of something laid out looks like; an abstract body
   * divides about its own centre; a dense one is columnar and a sparse
   * one stacks. Nothing here knows what the body is. */
  DIVIDE: (m) => {
    const many = m.count !== null && m.count > 12;
    const axis = many ? 2 : m.abstraction > 0.62 ? 3 : m.density > 0.58 ? 1 : 0;
    return [
      n(
        "subdivide",
        {
          axis,
          // The count is the prose's when the prose printed one.
          parts: m.count ? clamp(Math.round(m.count), 1, 24) : Math.round(3 + m.density * 5),
          gap: clamp(0.07 + m.abstraction * 0.2, 0, 0.6),
          // A dense body crowds its divisions toward one end rather than
          // spacing them evenly, which is the difference between a grid
          // and a stack that settles.
          grade: clamp((m.density - 0.5) * 0.9, -1, 1),
        },
        m.count
          ? `divided into ${clamp(Math.round(m.count), 1, 24)} members — the count is the prose's`
          : `given parts — ${["stacked", "columnar", "celled", "about its own centre"][axis]}`,
      ),
    ];
  },

  MARK: (m) => [
    n(
      "parametric_curve",
      {
        mode: Math.round(clamp(m.seed % 4, 0, 3)),
        k: Math.round(clamp(3 + m.density * 5, 1, 9)),
        reveal: 1,
      },
      "a single figure standing in for the thing rather than showing it",
    ),
  ],
};

/* ── WHICH OPERATIONS EACH IDEA IS MADE OF ────────────────────────────
 *
 * The whole mapping, readable at a glance. Note how much is SHARED —
 * FRAME appears in three modes, REPEAT in three, WORD in two. That
 * sharing is the result being tested: if each mode needed its own
 * private vocabulary this would be six systems wearing one name. */
/* AN OPERATION HAS A ROLE IN THE CHAIN, and the payload contract caught
 * me ignoring that within minutes of writing the first recipe:
 *
 *     geometric FAIL: boolean_ops consumes GEOMETRY but geometry_draw
 *                     emits ANIMATION
 *
 * `geometry_draw` is a RENDERER — it turns geometry into a picture and
 * cannot be fed into a geometry transform. So the grammar is ordered by
 * role rather than by taste: something must make geometry, something may
 * transform it, and something must draw it. Exactly the discipline the
 * payload contract was built to enforce, applied one layer up. */
type Role = "SOURCE" | "TRANSFORM" | "RENDER";
const ROLE: Record<Op, Role> = {
  SOLID: "SOURCE",
  DIVIDE: "TRANSFORM",
  MASS: "TRANSFORM",
  CONTOUR: "TRANSFORM",
  PLACE: "TRANSFORM",
  APERTURE: "RENDER",
  WORD: "SOURCE",
  MARK: "SOURCE",
  REPEAT: "SOURCE",
  CONNECT: "SOURCE",
  ENCLOSURE: "TRANSFORM",
  FRAME: "RENDER",
  LAYER: "RENDER",
};

const RECIPE: Record<Mode, Op[]> = {
  // THE THING: a solid, bounded, placed in the frame. A silhouette.
  literal: ["SOLID", "DIVIDE", "PLACE", "FRAME"],
  // ITS SHAPE: the same kind of form taken to its edge, with the lines it
  // was built on, repeated. Not a filled blob — that was the collapse.
  geometric: ["MARK", "CONTOUR", "PLACE", "FRAME"],
  // DEPTH: an open volume, peeled apart to show what is behind it.
  structural: ["SOLID", "DIVIDE", "PLACE", "FRAME"],
  // LANGUAGE as material.
  typographic: ["WORD", "PLACE", "FRAME"],
  // WHAT CONNECTS TO WHAT.
  diagrammatic: ["CONNECT", "PLACE", "FRAME"],
  // A repeated figure standing in for the thing.
  symbolic: ["REPEAT", "CONTOUR", "PLACE", "FRAME"],
};

/** Realise an idea as visual material.
 *
 *  The abstraction curve decides how many operations get used — a
 *  restrained frame is one operation, an abstract one stacks all three.
 *  Nothing here consults the noun. */
/** Realise an explicit op list. The scene graph builds each element from
 *  its own operations, so it needs this rather than a mode. */
export function realiseOps(ops: Op[], m: Material): PlannedNode[] {
  const out: PlannedNode[] = [];
  for (const op of ops) out.push(...OPS[op](m));
  return out;
}

export function realise(mode: Mode, m: Material): PlannedNode[] {
  const out: PlannedNode[] = [];
  for (const op of opsFor(mode, m)) out.push(...OPS[op](m));
  return out;
}

/** What operations an idea is made of, for the report. Lets the Studio
 *  say "frame + enclosure + aperture" rather than naming primitives. */
export function opsFor(mode: Mode, m: Material): Op[] {
  const ops = RECIPE[mode] ?? ["WORD", "FRAME"];
  // A SOURCE and a RENDER are structural — drop either and there is no
  // picture. Only the TRANSFORM is discretionary, so restraint removes
  // elaboration rather than removing the image.
  //
  // PLACE IS NEVER DISCRETIONARY. It was, and two LITERAL cells of the
  // first gallery came back empty because of it: at low abstraction the
  // filter dropped the placement and the source drew itself wherever it
  // happened to draw itself, which on a wireframe is mostly off-frame.
  // Deciding how much of the frame a form commands is composition, not
  // elaboration — a restrained film still has to put the thing somewhere.
  return ops.filter((op) => op === "PLACE" || ROLE[op] !== "TRANSFORM" || m.abstraction > 0.3);
}
