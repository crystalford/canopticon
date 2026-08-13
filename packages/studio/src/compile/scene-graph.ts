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
import { type SemanticScene, arrange } from "./semantic-scene.ts";

/** What an element is FOR in the frame. Roles, not shapes — the same
 *  operations serve any of them, and the role decides scale, placement
 *  and how loudly it is composited. */
export type Role = "GROUND" | "PRIMARY" | "SECONDARY" | "FIELD" | "TEXT" | "SURFACE";

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
  /* THE SURFACE THAT CONCEALS. An aperture is a RELATION BETWEEN TWO
   * SPACES, so it cannot live inside one element's chain — it needs
   * something behind it to reveal. Put in the element's op list it
   * painted a mid-toned rectangle with a hole cut to the ground colour
   * and nothing behind the hole, which is why the structural column was
   * a plain rectangle in every row of every gallery even after the
   * aperture primitive existed.
   *
   * As its own element, composited nearest, the knockout makes its
   * opening transparent and whatever the scene put behind it shows
   * through. Two elements, one relation — which is what it always was. */
  if (role === "SURFACE") return ["APERTURE"];
  if (role === "TEXT") return ["WORD", "PLACE", "FRAME"];
  if (role === "FIELD") return ["REPEAT", "PLACE", "FRAME"];
  if (role === "GROUND")
    return mode === "structural" ? ["MARK", "PLACE", "FRAME"] : ["MARK", "PLACE", "FRAME"];
  if (role === "SECONDARY") return ["SOLID", "PLACE", "FRAME"];
  // PRIMARY carries the representation's own idea.
  return (
    {
      literal: ["SOLID", "PLACE", "FRAME"],
      geometric: ["MARK", "CONTOUR", "PLACE", "FRAME"],
      structural: ["SOLID", "PLACE", "FRAME"],
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
/* COMPOSE FROM THE SEMANTIC SCENE.
 *
 * The template version below produced `primary + text + optional
 * secondary` for every sentence, which is why two sentences with
 * opposite meanings produced the same arrangement. This one reads the
 * RELATION and lets it decide how many elements exist, which dominates,
 * where they sit, what repeats and what is drawn between them.
 *
 * Nothing here consults a noun or a verb. The relation kind was already
 * turned into an arrangement by `semantic-scene.ts`; this places
 * elements into it. One authoritative translation point, standing rule 9,
 * applied to relations. */
export function composeFromMeaning(mode: Mode, m: Material, sem: SemanticScene): SceneGraph {
  const rel = sem.relations[0];
  if (!rel || sem.entities.length < 2) {
    // No relation the prose actually drew — fall back to the single
    // subject composition rather than inventing a second entity.
    const g = composeScene(mode, m);
    return { ...g, describes: `${g.describes} · ${sem.describes}` };
  }
  const a = arrange(rel.kind, sem.negated);
  const els: Element[] = [];

  // A ground only where the arrangement wants depth behind it.
  if (a.nested || m.density > 0.45) {
    els.push({
      role: "GROUND",
      ops: opsFor("GROUND", mode),
      place: { scale: 1.7 + m.density * 0.8, x: 0.5, y: 0.5, crop: 1 },
      depth: 0,
      reason: "the world the relation happens in",
    });
  }

  // THE TO-ENTITY. A field when the relation multiplies it — an observer
  // watches MANY, an accumulation IS many — otherwise a single form.
  els.push({
    role: a.field ? "FIELD" : "SECONDARY",
    ops: opsFor(a.field ? "FIELD" : "SECONDARY", mode),
    place: { scale: a.to.scale, x: a.to.x, y: a.to.y, crop: a.to.scale > 1 ? 1 : 0 },
    depth: 0.35,
    reason: `${sem.entities[rel.to]?.text ?? "the other"} — ${a.why}`,
  });

  // THE FROM-ENTITY, which the arrangement usually makes dominant.
  els.push({
    role: "PRIMARY",
    ops: opsFor("PRIMARY", mode),
    place: { scale: a.from.scale, x: a.from.x, y: a.from.y, crop: a.from.scale > 1 ? 1 : 0 },
    depth: a.nested ? 0.2 : 0.65,
    reason: `${sem.entities[rel.from]?.text ?? "the subject"} — ${rel.kind.toLowerCase()}`,
  });

  // WHAT RUNS BETWEEN THEM. A line of sight, a link, a crossing — drawn
  // only when the relation genuinely has one, and removed by negation.
  if (a.sight) {
    els.push({
      role: "SECONDARY",
      ops: ["CONNECT", "PLACE", "FRAME"],
      place: { scale: 1.1, x: (a.from.x + a.to.x) / 2, y: (a.from.y + a.to.y) / 2, crop: 0 },
      depth: 0.5,
      reason: "what runs between them",
    });
  }

  // THE APERTURE, nearest, so everything the scene built is seen through
  // it. This is what makes the structural reading structural: not a
  // plane, but an inside and an outside.
  if (mode === "structural") {
    els.push({
      role: "SURFACE",
      ops: opsFor("SURFACE", mode),
      place: { scale: 1, x: 0.5, y: 0.5, crop: 0 },
      depth: 0.99,
      reason: "a surface in front of it all — what is behind is seen only through the opening",
    });
  }

  if (mode !== "typographic" && m.phrase && m.typography > 0.4) {
    els.push({
      role: "TEXT",
      ops: opsFor("TEXT", mode),
      place: { scale: 0.1 + m.typography * 0.1, x: 0.2, y: 0.88, crop: 0 },
      depth: 0.95,
      reason: "the words, as an accent",
    });
  }

  els.sort((x, y) => x.depth - y.depth);
  return {
    elements: els,
    describes: `${sem.describes} · ${els.length} elements · ${a.why}`,
  };
}

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

  if (mode === "structural") {
    els.push({
      role: "SURFACE",
      ops: opsFor("SURFACE", mode),
      place: { scale: 1, x: 0.5, y: 0.5, crop: 0 },
      depth: 0.99,
      reason: "a surface in front of it all — what is behind is seen only through the opening",
    });
  }

  // TYPOGRAPHY AS A SCENE ELEMENT rather than as the whole scene. In
  // every mode except the typographic one, where the words already ARE
  // the primary and a second copy would be a stutter.
  if (mode !== "typographic" && m.phrase && m.typography > 0.4) {
    els.push({
      role: "TEXT",
      ops: opsFor("TEXT", mode),
      /* AN ACCENT, NOT A HEADLINE.
       *
       * This was `0.3 + typography * 0.35` — roughly half the frame — so
       * in four of five modes the words out-read the subject and the
       * representations collapsed back into one picture. A secondary
       * element has to be secondary in SIZE, in POSITION and in WEIGHT,
       * or it is simply the primary wearing a different role name. */
      place: {
        scale: 0.1 + m.typography * 0.1,
        x: off > 0.5 ? 0.2 : 0.8,
        y: off > 0.5 ? 0.85 : 0.15,
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
          /* AN ELEMENT THAT CANNOT BE SEEN IS NOT IN THE SCENE.
           *
           * The arrangement was computing correctly — "one above and
           * apart, many below, and a line of sight between them" — and
           * the frame showed one form, because FIELD came in at opacity
           * 0.55 with sink 0.5 and SECONDARY at 0.72/0.3. Both were
           * suppressed to the point of invisibility, so every semantic
           * distinction the scene made died at the compositor.
           *
           * Hierarchy is made with SCALE and PLACEMENT, which the
           * arrangement already decides. It is not made by fading the
           * subordinate elements until they disappear — that is not a
           * quiet element, it is a missing one. Only the GROUND is
           * genuinely sunk, because a ground is the one thing that is
           * supposed to sit behind. */
          opacity: {
            PRIMARY: 1,
            SECONDARY: 0.95,
            TEXT: 0.85,
            FIELD: 0.95,
            GROUND: 0.45,
            SURFACE: 1,
          }[e.role],
          front: 1,
          sink: { PRIMARY: 0, SECONDARY: 0.05, TEXT: 0.05, FIELD: 0.05, GROUND: 0.6, SURFACE: 0 }[
            e.role
          ],
        },
        reason: e.reason,
        ground: chainFor(e),
      },
    ];
  }
  return out;
}

/* ── THE CAMERA ───────────────────────────────────────────────────────
 *
 * SCENE ≠ FRAME, and the scene graph is what finally makes that true. A
 * scene is a set of elements at places and depths; the camera is a
 * separate decision about how we see it. Until the scene existed
 * independently there was nothing for a camera to observe.
 *
 * Implemented where it belongs — as a transform on the scene's PLACES,
 * before serialisation. Nothing downstream knows a camera exists, which
 * is what keeps it a directorial layer rather than a per-primitive
 * parameter. Parallax falls out for free: an element at depth 0 moves
 * less under a pan than one at depth 1, so a lateral move separates the
 * planes the way a real one does.
 */
export interface Camera {
  /** 1 = the frame as composed. >1 pushes in. */
  zoom: number;
  /** Where the camera is looking, in frame coordinates. */
  x: number;
  y: number;
  /** How strongly depth separates under movement, 0..1. */
  parallax: number;
}

export const CAMERA_STILL: Camera = { zoom: 1, x: 0.5, y: 0.5, parallax: 0 };

/** Observe a scene through a camera. Returns a new graph; the scene is
 *  untouched, because the whole point is that the same scene can be
 *  looked at more than one way. */
export function observe(scene: SceneGraph, cam: Camera): SceneGraph {
  const elements = scene.elements.map((e) => {
    // Nearer elements are displaced more by a move off centre. That is
    // parallax, and it is the one thing a flat compositor cannot fake.
    const lean = 1 + (e.depth - 0.5) * cam.parallax * 2;
    return {
      ...e,
      place: {
        scale: e.place.scale * cam.zoom,
        x: 0.5 + (e.place.x - cam.x) * cam.zoom * lean,
        y: 0.5 + (e.place.y - cam.y) * cam.zoom * lean,
        // A push-in crops what a wide shot contained.
        crop: cam.zoom > 1.15 ? 1 : e.place.crop,
      },
    };
  });
  const how =
    cam.zoom > 1.3
      ? "pushed in"
      : cam.zoom < 0.85
        ? "pulled wide"
        : cam.parallax > 0.3
          ? "moved across"
          : "held";
  return { elements, describes: `${scene.describes} · ${how}` };
}

/* ── TIME OPERATES ON THE SCENE ───────────────────────────────────────
 *
 * The bar is no longer "an interesting frame". It is whether an essay's
 * ARGUMENT can become a sequence of visual transformations — a field
 * established, most of it removed, what survives isolated and carried
 * forward; sight lines built and then reversed when the essay reverses.
 *
 * So time is expressed the same way the camera is: as a transform on the
 * SCENE, before serialisation. Nothing downstream knows time exists, and
 * a scene at t=0.2 is simply a different scene graph. That is what makes
 * this a temporal GRAMMAR rather than an animation parameter bolted to a
 * primitive — the same eight moves apply to any element in any
 * representation, because they are operations on places and presences
 * rather than on pictures.
 */
export type Move =
  | "HOLD" // it is simply there
  | "ENTER" // it arrives from outside the frame
  | "EMERGE" // it grows into presence in place
  | "ACCUMULATE" // there is more of it as time passes
  | "WITHDRAW" // it leaves
  | "DISSOLVE" // it thins out of presence
  | "APPROACH" // it closes on something
  | "REVERSE"; // the relation it is part of turns around

export interface Choreography {
  /** Per element index, the move it makes. Elements not named HOLD. */
  moves: Record<number, Move>;
  describes: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));

/** THE SCENE AT A MOMENT. Returns a new graph — the scene is untouched,
 *  the same way the camera leaves it untouched, because the whole point
 *  is that one scene can be looked at from more than one time. */
export function at(scene: SceneGraph, ch: Choreography, t: number): SceneGraph {
  const e = ease(t);
  const elements: Element[] = [];
  scene.elements.forEach((el, i) => {
    const move = ch.moves[i] ?? "HOLD";
    const p = { ...el.place };
    let present = true;
    switch (move) {
      case "ENTER":
        // Arrives from outside the frame and settles. The direction is
        // the side it is nearest, so a thing on the left comes in from
        // the left rather than crossing the shot to get home.
        p.x = lerp(el.place.x < 0.5 ? -0.35 : 1.35, el.place.x, e);
        break;
      case "EMERGE":
        p.scale = el.place.scale * Math.max(0.02, e);
        break;
      case "ACCUMULATE":
        // More of it, and it spreads. A field that accumulates should
        // reach further than the one that started.
        p.scale = el.place.scale * lerp(0.35, 1.25, e);
        break;
      case "WITHDRAW":
        p.x = lerp(el.place.x, el.place.x < 0.5 ? -0.35 : 1.35, e);
        break;
      case "DISSOLVE":
        p.scale = el.place.scale * Math.max(0.02, 1 - e);
        present = e < 0.97;
        break;
      case "APPROACH": {
        // Closes on the centre of the frame, which is where the thing it
        // is approaching has been placed by the arrangement.
        p.x = lerp(el.place.x, 0.5, e * 0.7);
        p.y = lerp(el.place.y, 0.5, e * 0.7);
        break;
      }
      case "REVERSE":
        // THE ARGUMENT TURNING AROUND. The element crosses to the place
        // its counterpart held, which is what makes "the residents
        // watched the city" the same scene as its opposite, run the
        // other way, rather than a second unrelated picture.
        p.x = lerp(el.place.x, 1 - el.place.x, e);
        p.y = lerp(el.place.y, 1 - el.place.y, e);
        break;
      default:
        break;
    }
    if (present) elements.push({ ...el, place: p });
  });
  return { elements, describes: `${scene.describes} · ${ch.describes} @${t.toFixed(2)}` };
}

/** CHOREOGRAPH FROM THE RELATION. The move each element makes is read
 *  off what the sentence says is happening, not chosen — an
 *  ACCUMULATES relation accumulates its field, an EMERGES relation makes
 *  its subject emerge, a denied relation dissolves the thing it denies.
 *
 *  This is the join between the semantic scene and time, and it is
 *  deliberately the only one. */
export function choreograph(scene: SceneGraph, sem: SemanticScene): Choreography {
  const rel = sem.relations[0];
  const moves: Record<number, Move> = {};
  const roleAt = (r: Role) => scene.elements.findIndex((e) => e.role === r);
  const field = roleAt("FIELD");
  const primary = roleAt("PRIMARY");
  const secondary = roleAt("SECONDARY");

  if (!rel) {
    if (primary >= 0) moves[primary] = "EMERGE";
    return { moves, describes: "the subject arriving" };
  }
  switch (rel.kind) {
    case "ACCUMULATES":
      if (field >= 0) moves[field] = "ACCUMULATE";
      if (primary >= 0) moves[primary] = "HOLD";
      return { moves, describes: "more of it, gathering" };
    case "OBSERVES":
      // The observed field is there first; the observer arrives to it.
      if (field >= 0) moves[field] = "HOLD";
      if (primary >= 0) moves[primary] = "ENTER";
      return { moves, describes: "the field, then the thing that watches it" };
    case "EMERGES":
      if (primary >= 0) moves[primary] = "EMERGE";
      return { moves, describes: "coming up out of it" };
    case "APPROACHES":
      if (primary >= 0) moves[primary] = "APPROACH";
      if (secondary >= 0) moves[secondary] = "HOLD";
      return { moves, describes: "the distance closing" };
    case "DEPARTS":
      if (primary >= 0) moves[primary] = "WITHDRAW";
      return { moves, describes: "the distance opening" };
    case "BECOMES":
      // A denial dissolves the thing that was claimed rather than
      // transforming into it — which is the visual form of "never".
      if (secondary >= 0) moves[secondary] = sem.negated ? "DISSOLVE" : "EMERGE";
      if (primary >= 0) moves[primary] = sem.negated ? "HOLD" : "DISSOLVE";
      return {
        moves,
        describes: sem.negated ? "the claim refusing to arrive" : "one turning into the other",
      };
    case "REVEALS":
      if (secondary >= 0) moves[secondary] = "EMERGE";
      return { moves, describes: "what is behind, becoming visible" };
    case "CONCEALS":
      if (secondary >= 0) moves[secondary] = "DISSOLVE";
      return { moves, describes: "what is behind, being withheld" };
    default:
      if (primary >= 0) moves[primary] = "ENTER";
      return { moves, describes: "arriving" };
  }
}
