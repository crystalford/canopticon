// THE SCENE GRAPH — a frame stops being one primitive.
//
// This is the milestone that unlocks several others at once, which is why
// it comes before camera, motion or a richer literal vocabulary: multiple
// simultaneous elements, spatial relationships, depth, hierarchy,
// foreground/background and deliberate negative space are all the same
// capability wearing different names. They are all "a scene contains more
// than one thing, and the things stand in a relation".
//
// Until now `realise()` returned a FLAT list of nodes — a single chain,
// one form, centred, on empty ground. Every compositional idea the
// grammar could have had was unreachable because there was nothing to
// compose WITH.
//
// THE MACHINERY ALREADY EXISTED. `layer_over` takes a second input and
// the executor builds it as a nested chain on the same clock (see
// `chain.js`). So a scene tree serialises to nested compositors without
// any change to the renderer:
//
//     SCENE                          far → near
//     ├── ground field               ← the chain starts here
//     ├── primary form               ← layer_over(front=1, ground=[…])
//     ├── secondary form             ← layer_over(front=1, ground=[…])
//     └── typography                 ← layer_over(front=1, ground=[…])
//
// WHAT DECIDES THE SCENE is the semantic material, not a recipe. A
// printed count makes a FIELD of many small things behind one large one;
// a relation makes two forms that acknowledge each other; a sparse
// abstract sentence gets one form and a great deal of empty space, which
// is a compositional decision rather than an absence of one.

import type { PlannedNode } from "./construct.ts";
import { type Material, type Op, realiseOps } from "./grammar-visual.ts";
import type { Mode } from "./represent.ts";

/** What an element is FOR in the frame. Roles, not shapes — the same
 *  operations serve any of them, and the role decides scale, placement
 *  and how loudly it is composited. */
export type Role = "GROUND" | "PRIMARY" | "SECONDARY" | "FIELD" | "TEXT";

export interface Element {
  role: Role;
  ops: Op[];
  /** Where it sits and how much of the frame it commands. */
  place: { scale: number; x: number; y: number; crop: number };
  /** 0 = furthest, 1 = nearest. Sets composite order and how far the
   *  element is sunk behind what is in front of it. */
  depth: number;
  /** Why this element is in the scene, in the director's language. */
  reason: string;
}

export interface SceneGraph {
  elements: Element[];
  /** One sentence describing the composition, for the report. */
  describes: string;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** The operations each ROLE is built from, per representation mode.
 *
 *  Deliberately reuses the same eight verbs — a field of many is REPEAT,
 *  a ground is FRAME at low weight, typography is WORD. Nothing here is a
 *  new vocabulary; it is the existing one used more than once per frame. */
function opsFor(role: Role, mode: Mode): Op[] {
  if (role === "TEXT") return ["WORD", "PLACE", "FRAME"];
  if (role === "FIELD") return ["REPEAT", "PLACE", "FRAME"];
  if (role === "GROUND")
    return mode === "structural" ? ["APERTURE", "PLACE", "LAYER"] : ["MARK", "PLACE", "FRAME"];
  if (role === "SECONDARY") return ["MARK", "CONTOUR", "PLACE", "FRAME"];
  // PRIMARY carries the representation's own idea.
  return (
    {
      literal: ["APERTURE", "ENCLOSURE", "PLACE", "FRAME"],
      geometric: ["MARK", "CONTOUR", "PLACE", "FRAME"],
      structural: ["APERTURE", "PLACE", "LAYER"],
      typographic: ["WORD", "PLACE", "FRAME"],
      diagrammatic: ["CONNECT", "PLACE", "FRAME"],
      symbolic: ["REPEAT", "CONTOUR", "PLACE", "FRAME"],
    } as Record<Mode, Op[]>
  )[mode];
}

/** COMPOSE THE SCENE.
 *
 *  The decisions here are compositional, and each one is answerable from
 *  the prose or the film's own state:
 *
 *    how many elements   a counted multitude earns a FIELD; a relation
 *                        earns a SECONDARY; everything else is one form
 *    how large           a dominant subject takes the frame; a thing
 *                        among many does not
 *    where               off-axis in proportion to abstraction, so a
 *                        literal film is centred and an abstract one is not
 *    how much emptiness  restraint spends the frame on nothing, which is
 *                        the decision the old one-form-centred layout
 *                        could not make either way */
export function composeScene(mode: Mode, m: Material): SceneGraph {
  const els: Element[] = [];
  const many = m.count !== null && m.count > 12;
  const off = ((m.seed * 37) % 100) / 100;
  const airy = m.density < 0.45;

  // THE GROUND. A field behind everything, quiet, present when the film
  // is dense enough to want depth. An airy composition leaves it out —
  // negative space is a choice, and this is where it gets made.
  if (!airy || mode === "structural") {
    els.push({
      role: "GROUND",
      ops: opsFor("GROUND", mode),
      place: { scale: 1.6 + m.density * 0.9, x: 0.5, y: 0.5, crop: 1 },
      depth: 0,
      reason: "a field behind everything, cropped by the frame so it reads as bigger than the shot",
    });
  }

  // A COUNTED MULTITUDE. Only when the prose printed one.
  if (many) {
    els.push({
      role: "FIELD",
      ops: opsFor("FIELD", mode),
      place: { scale: 1.15, x: 0.5, y: 0.5, crop: 1 },
      depth: 0.25,
      reason: `many, because the prose counted ${m.count}`,
    });
  }

  // THE PRIMARY. Smaller when it is one of many; allowed to dominate and
  // be cropped when it is not.
  const pScale = many
    ? 0.34 + m.density * 0.12
    : airy
      ? 0.42 + (1 - m.density) * 0.35
      : 0.75 + (1 - m.density) * 0.5;
  els.push({
    role: "PRIMARY",
    ops: opsFor("PRIMARY", mode),
    place: {
      scale: clamp(pScale, 0.05, 4),
      x: clamp(0.5 + (off - 0.5) * (0.25 + m.abstraction * 0.6), 0.12, 0.88),
      y: clamp(0.5 + (0.5 - off) * (0.15 + m.abstraction * 0.4), 0.14, 0.86),
      crop: pScale > 1 ? 1 : 0,
    },
    depth: 0.6,
    reason: many
      ? "one of the many, given the eye"
      : pScale > 1
        ? "larger than the frame, cropped by it"
        : "the subject, off axis",
  });

  // A SECOND FORM, when the sentence has two things in it. This is what
  // makes a composition rather than a subject — something for the primary
  // to be in relation to.
  if (m.relation) {
    els.push({
      role: "SECONDARY",
      ops: opsFor("SECONDARY", mode),
      place: {
        scale: clamp(pScale * 0.42, 0.05, 4),
        x: clamp(1 - (0.5 + (off - 0.5) * 0.6), 0.1, 0.9),
        y: clamp(0.5 + (off - 0.5) * 0.5, 0.12, 0.88),
        crop: 0,
      },
      depth: 0.45,
      reason: `${m.relation[0]} and ${m.relation[1]} — two things, in relation`,
    });
  }

  // TYPOGRAPHY AS A SCENE ELEMENT rather than as the whole scene. In
  // every mode except the typographic one, where the words already ARE
  // the primary and a second copy would be a stutter.
  if (mode !== "typographic" && m.phrase && m.typography > 0.4) {
    els.push({
      role: "TEXT",
      ops: opsFor("TEXT", mode),
      place: {
        scale: 0.3 + m.typography * 0.35,
        x: off > 0.5 ? 0.26 : 0.72,
        y: off > 0.5 ? 0.78 : 0.24,
        crop: 0,
      },
      depth: 0.9,
      reason: "the words, as a secondary element against the form",
    });
  }

  els.sort((a, b) => a.depth - b.depth);
  const parts = els.map((e) => e.role.toLowerCase()).join(" · ");
  return {
    elements: els,
    describes: `${els.length} element${els.length === 1 ? "" : "s"} — ${parts}${airy ? ", held sparse" : ""}`,
  };
}

/** SERIALISE THE TREE TO A CHAIN.
 *
 *  Far element first, then each nearer one composited over it with
 *  `layer_over(front: 1)` carrying that element's own chain as its
 *  ground. The executor already runs a compositor's second input as a
 *  nested chain on the same clock, so nothing in the renderer changes.
 *
 *  `sink` rises with distance, which is what makes the stack read as
 *  depth rather than as several pictures fighting for the same frame. */
export function serialiseScene(scene: SceneGraph, m: Material): PlannedNode[] {
  const [first, ...rest] = scene.elements;
  if (!first) return [];
  const chainFor = (e: Element): PlannedNode[] =>
    realiseOps(e.ops, { ...m, place: e.place } as Material & { place: Element["place"] });

  // The first element is the chain's own image. When it is the GROUND it
  // is meant to sit quietly behind everything, so it starts sunk rather
  // than at full strength — otherwise the quietest element in the scene
  // is the one drawn most emphatically.
  let out = chainFor(first);
  for (const e of rest) {
    out = [
      ...out,
      {
        primitiveId: "layer_over",
        /* COMPOSITE STRENGTH IS A ROLE, NOT A DEPTH.
         *
         * The first version keyed opacity to depth, so TEXT — nearest by
         * construction — came in at 0.96 and the PRIMARY form was sunk
         * beneath it. Every cell of the gallery became the same caption
         * over a ghost, which collapsed the five representations back
         * into one picture. Depth decides ORDER; the role decides how
         * loudly the thing speaks, and a secondary element that arrives
         * louder than the subject is not a composition. */
        params: {
          opacity: { PRIMARY: 1, SECONDARY: 0.72, TEXT: 0.9, FIELD: 0.55, GROUND: 0.3 }[e.role],
          front: 1,
          sink: { PRIMARY: 0, SECONDARY: 0.3, TEXT: 0.12, FIELD: 0.5, GROUND: 0.75 }[e.role],
        },
        reason: e.reason,
        ground: chainFor(e),
      },
    ];
  }
  return out;
}
