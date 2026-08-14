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

import type { Act } from "./act.ts";
import type { PlannedNode } from "./construct.ts";
import { elementKey } from "./film-mode.ts";
import { type Material, type Op, applyEmphasis, realiseOps } from "./grammar-visual.ts";
import type { Mode } from "./represent.ts";
import { type SemanticScene, arrange } from "./semantic-scene.ts";

/** What an element is FOR in the frame. Roles, not shapes — the same
 *  operations serve any of them, and the role decides scale, placement
 *  and how loudly it is composited. */
export type Role = "GROUND" | "PRIMARY" | "SECONDARY" | "FIELD" | "TEXT" | "SURFACE";

/* WHAT EACH ROLE IS MADE OF, PER REPRESENTATION.
 *
 * Material is a compositional dimension in its own right — not a colour,
 * not a texture pasted on. A literal PRIMARY is metal because a thing you
 * are asked to believe in has weight; a diagrammatic FIELD is data
 * because a distribution is discrete; a structural GROUND is glass
 * because you are meant to see through it. The GROUND is dust in most
 * modes for the same reason a ground is a ground: it is present without
 * asking to be read.
 *
 * Deliberately a small table rather than a lexicon. Eight materials, six
 * roles — and the same material appears across representations, which is
 * what stops the five columns becoming five hard-coded art styles. */
const MATERIAL: Record<Mode, Partial<Record<Role, number>>> = {
  // ink · paper · glass · light · screen · metal · dust · data
  literal: { PRIMARY: 5, SECONDARY: 5, GROUND: 6, FIELD: 6, TEXT: 1, SURFACE: 2 },
  structural: { PRIMARY: 2, SECONDARY: 2, GROUND: 3, FIELD: 6, TEXT: 1, SURFACE: 2 },
  geometric: { PRIMARY: 0, SECONDARY: 0, GROUND: 6, FIELD: 7, TEXT: 1, SURFACE: 2 },
  typographic: { PRIMARY: 1, SECONDARY: 1, GROUND: 6, FIELD: 6, TEXT: 1, SURFACE: 2 },
  diagrammatic: { PRIMARY: 7, SECONDARY: 7, GROUND: 4, FIELD: 7, TEXT: 1, SURFACE: 2 },
  symbolic: { PRIMARY: 3, SECONDARY: 0, GROUND: 6, FIELD: 6, TEXT: 1, SURFACE: 2 },
};

export interface Element {
  role: Role;
  /** 0..7 — see `geometry_draw`. Assigned from role × representation. */
  material?: number;
  ops: Op[];
  /** Where it sits and how much of the frame it commands. */
  place: { scale: number; x: number; y: number; crop: number };
  /** 0 = furthest, 1 = nearest. Sets composite order and how far the
   *  element is sunk behind what is in front of it. */
  depth: number;
  /** 0..1 — how much of the reader's attention this element is entitled
   *  to. Written by `emphasise`, read only through `applyEmphasis`. */
  emphasis?: number;
  /* WHAT THIS ELEMENT STANDS FOR, lowercased, when it stands for
   * something the prose named.
   *
   * Continuity is a fact about ENTITIES, so the film needs to know which
   * element depicts which — and it had no way to ask. `advance` paired
   * them BY INDEX against a list sorted by depth, so the first entity in
   * a sentence was matched to the GROUND, the second to the field, and
   * every element past the entity count was dropped from the film
   * entirely. It type-checked, it passed the continuity suite (which only
   * ever asserted on decisions and places, never on what was left to
   * draw), and it rendered a five-element scene as one faint outline.
   *
   * Elements that stand for nothing — the ground, the words, the surface,
   * the line drawn between two things — leave this undefined. They are
   * SCENERY: recomposed per scene rather than persisted, because a ground
   * is not a character. */
  depicts?: string;
  /** Why this element is in the scene, in the director's language. */
  reason: string;
}

export interface SceneGraph {
  elements: Element[];
  /** One sentence describing the composition, for the report. */
  describes: string;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/* ── HIERARCHY ────────────────────────────────────────────────────────
 *
 * A frame of five elements all drawn at the same volume is not a
 * composition, it is an inventory. The scene graph could already decide
 * WHAT is in the frame and WHERE — it had no way to decide WHICH ONE THE
 * FRAME IS ABOUT, so the eye had nowhere to land and every representation
 * read as busy rather than as directed.
 *
 * Two properties make this a hierarchy rather than a set of numbers:
 *
 *   EXACTLY ONE FOCUS. Some element in every scene is at 1. Not "usually",
 *   not "when the arrangement is clear" — a frame with no focal point is
 *   the failure this exists to prevent, so it is made structurally
 *   impossible rather than encouraged.
 *
 *   A GUARANTEED GAP. Ranked, not scored. Two elements with near-identical
 *   claims still separate, because the thing that makes a hierarchy legible
 *   is the DISTANCE between levels — a scene whose top two elements sit at
 *   0.81 and 0.79 has no hierarchy no matter what the numbers say.
 */
const ENTITLEMENT: Record<Role, number> = {
  // What the element is FOR, before the arrangement has its say. The
  // subject of the sentence outranks the thing it acts on, which outranks
  // the words about it, which outranks the world it happens in.
  PRIMARY: 1,
  FIELD: 0.66,
  SURFACE: 0.6,
  SECONDARY: 0.54,
  TEXT: 0.36,
  GROUND: 0.08,
};

/** Assign attention across a scene. Returns a new list — the arrangement
 *  is not modified, because emphasis is a reading of a composition rather
 *  than part of building one. */
export function emphasise(els: Element[]): Element[] {
  if (els.length === 0) return els;
  // The claim: what it is for, weighted by how much frame it took. An
  // element the arrangement made large has earned attention the role
  // table alone would not have given it — which is how a FIELD becomes
  // the subject of a frame when the sentence is about the many rather
  // than the one.
  const claim = els.map((e) => ENTITLEMENT[e.role] * (0.55 + Math.min(1.8, e.place.scale) * 0.45));
  const order = els.map((_, i) => i).sort((a, b) => (claim[b] ?? 0) - (claim[a] ?? 0));
  const out = [...els];
  /* A LADDER THAT ALWAYS SPANS, whatever the scene's size.
   *
   * This was a fixed 0.15 step against a clamp floor, and the test caught
   * what that does: a six-element structural scene ran 1 · 0.78 · 0.63 ·
   * 0.48 · 0.33 · 0.24, and the bottom two rungs collapsed to 0.11 apart
   * — indistinguishable, which is the exact thing hierarchy is for.
   *
   * The subordinates are spread evenly across a fixed range instead, so
   * the ladder's bottom is the same whether the scene holds two elements
   * or seven and the steps are as large as the count allows. The focus
   * keeps its own gap above the range, because the distance between the
   * subject and everything else is not one rung of the same ladder. */
  const subs = els.length - 1;
  const step = subs > 1 ? (0.8 - 0.26) / (subs - 1) : 0;
  order.forEach((idx, rank) => {
    const e = els[idx];
    if (!e) return;
    out[idx] = { ...e, emphasis: rank === 0 ? 1 : clamp(0.8 - (rank - 1) * step, 0.26, 0.8) };
  });
  return out;
}

/** The element the frame is about, for the report. */
export function focusOf(els: Element[]): Element | undefined {
  return els.find((e) => (e.emphasis ?? 0) >= 1);
}

/** The operations each ROLE is built from, per representation mode.
 *
 *  Deliberately reuses the same eight verbs — a field of many is REPEAT,
 *  a ground is FRAME at low weight, typography is WORD. Nothing here is a
 *  new vocabulary; it is the existing one used more than once per frame. */
/** Whether this element's words are SET by a glyph primitive that draws
 *  its own finished frame, rather than SAMPLED into geometry the scene
 *  composes. The single source of truth for the branch `WORD` takes. */
export function setsOwnType(mode: Mode, level?: number, register?: string): boolean {
  if (mode !== "typographic") return false;
  if (register === "kinetic") return false;
  if (register === "auto" && (level ?? 2) >= 4) return false;
  return true;
}

function opsFor(role: Role, mode: Mode, words = true, level?: number, register?: string): Op[] {
  /* NO WORDS MEANS NO WORD OP — and this is what a text-driven film
   * actually is.
   *
   * Promotion decides film-wide that most of an essay is spoken and not
   * shown, so most scenes of a TEXT film arrive with an empty phrase. The
   * typographic recipe is `WORD → PLACE → FRAME`, and `text_layout` with
   * an empty string draws nothing: a text-driven film would have been
   * mostly blank frames, which is a worse failure than the 36 title cards
   * it replaced.
   *
   * "Text driven" does not mean "type in every frame". It means the
   * writing is the primary material WHEN there is something to show, and
   * the film's own marks and fields carry the space between. So a scene
   * with nothing promoted composes as GEOMETRIC — the same forms, without
   * a caption nobody wrote. */
  if (!words && (role === "PRIMARY" || role === "TEXT") && mode === "typographic") {
    return role === "TEXT" ? [] : ["MARK", "CONTOUR", "PLACE", "FRAME"];
  }
  /* A SET WORD DRAWS ITS OWN FRAME.
   *
   * `WORD → PLACE → FRAME` is right for the sampled stack, where the type
   * is a point cloud that has to be composed like any other form. It is
   * wrong for `text_layout` and `variable_axis`, which measure the string
   * and fill the frame themselves: `place` would re-sample the finished
   * canvas and then size it by `min(w,h) / max(fw,fh)`, shrinking a wide
   * line by its own aspect ratio. Measured — that is why every set phrase
   * came out a fifth the size of the title.
   *
   * `setsOwnType` is decided in one place, by the same rule the WORD op
   * branches on, so the recipe and the primitive can never disagree about
   * which stack is running. */
  if (words && setsOwnType(mode, level, register)) {
    if (role === "PRIMARY" || role === "TEXT") return ["WORD"];
  }
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
  if (role === "SECONDARY") return ["SOLID", "DIVIDE", "PLACE", "FRAME"];
  // PRIMARY carries the representation's own idea.
  return (
    {
      literal: ["SOLID", "DIVIDE", "PLACE", "FRAME"],
      geometric: ["MARK", "CONTOUR", "PLACE", "FRAME"],
      structural: ["SOLID", "DIVIDE", "PLACE", "FRAME"],
      typographic: ["WORD", "PLACE", "FRAME"],
      diagrammatic: ["CONNECT", "PLACE", "FRAME"],
      symbolic: ["REPEAT", "CONTOUR", "PLACE", "FRAME"],
    } as Record<Mode, Op[]>
  )[mode];
}

/** HOW MUCH OF THE FRAME THE WORDS COMMAND.
 *
 *  Standing rule 9. `glyph_geometry` has a `scale` of its own and setting
 *  it there did almost nothing, because `place` is what actually decides
 *  how much frame a form takes and it ran afterwards — a level-4 thesis
 *  and a level-2 phrase came out at 0.97 and 0.94, a difference nobody
 *  would ever see. The level is a semantic quantity and this is the one
 *  place it becomes a size.
 *
 *    4  larger than the frame, cropped by it — it TAKES OVER the screen,
 *       which is what level 4 means and the only thing that makes level 3
 *       mean anything by contrast
 *    3  commands the frame without leaving it
 *    2  present and readable, with room around it
 *    1  a marker in the corner
 */
export function placeForLevel(level: number, seed: number): Element["place"] {
  if (level >= 4) return { scale: 1.35, x: 0.5, y: 0.48, crop: 1 };
  if (level === 3) return { scale: 0.86, x: 0.5, y: 0.5, crop: 0 };
  if (level === 2) return { scale: 0.62, x: 0.5, y: 0.54, crop: 0 };
  // The one level that is deliberately off-centre and small: a marker is
  // a note on the frame, not the subject of it.
  return { scale: 0.2, x: seed % 2 === 0 ? 0.22 : 0.78, y: 0.86, crop: 0 };
}

/* WHEN THE WORDS ARE THE SUBJECT, THE GROUND HOLDS BACK.
 *
 * A GROUND is placed at `1.6–1.7 + density * 0.8`, cropped by the frame —
 * bigger than the shot, which is exactly right when it is the world a
 * relation happens in. Behind a sentence it is wallpaper: measured on the
 * text film, every level-0 scene was a full-bleed curve at 2.1× the frame
 * and every promoted scene had one behind the type.
 *
 * A text-driven film composes its depth out of restraint. The ground
 * stays — a frame with nothing behind it is flat — but it comes inside
 * the frame, stops being cropped, and gives up its claim on the eye. */
const groundPlace = (base: number, m: Material, mode: Mode): Element["place"] =>
  // Keyed on the MODE, not on the register — the register is set on every
  // film and a world film's ground is meant to be bigger than the shot.
  mode === "typographic" && m.phrase?.trim()
    ? { scale: 0.9 + m.density * 0.35, x: 0.5, y: 0.5, crop: 0 }
    : { scale: base + m.density * 0.8, x: 0.5, y: 0.5, crop: 1 };

/** Give every WORD-bearing element the size its level earned. Applied to
 *  the composed list rather than at each push site, so there is one rule
 *  and it cannot be forgotten by a new branch. */
function sizeWords(els: Element[], m: Material): Element[] {
  if (m.level === undefined || !m.phrase?.trim()) return els;
  return els.map((e) =>
    e.ops.includes("WORD")
      ? {
          ...e,
          place: placeForLevel(m.level as number, m.seed),
          /* AND THE WORDS ARE THE SUBJECT. In a promoted scene the type is
           * what the frame is about, so it takes the focus outright rather
           * than competing for it on depth — which is what left it drawn
           * at a subordinate's weight and unreadable. */
          emphasis: 1,
        }
      : e,
  );
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
  const hasWords = Boolean(m.phrase?.trim());
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
      ops: opsFor("GROUND", mode, hasWords, m.level, m.register),
      material: MATERIAL[mode]?.GROUND ?? 0,
      place: groundPlace(1.7, m, mode),
      depth: 0,
      reason: "the world the relation happens in",
    });
  }

  // THE TO-ENTITY. A field when the relation multiplies it — an observer
  // watches MANY, an accumulation IS many — otherwise a single form.
  const to = sem.entities[rel.to]?.text;
  const from = sem.entities[rel.from]?.text;
  els.push({
    role: a.field ? "FIELD" : "SECONDARY",
    ops: opsFor(a.field ? "FIELD" : "SECONDARY", mode, hasWords, m.level, m.register),
    material: MATERIAL[mode]?.[a.field ? "FIELD" : "SECONDARY"] ?? 0,
    place: { scale: a.to.scale, x: a.to.x, y: a.to.y, crop: a.to.scale > 1 ? 1 : 0 },
    depth: 0.35,
    ...(to ? { depicts: to.toLowerCase() } : {}),
    reason: `${to ?? "the other"} — ${a.why}`,
  });

  // THE FROM-ENTITY, which the arrangement usually makes dominant.
  els.push({
    role: "PRIMARY",
    ops: opsFor("PRIMARY", mode, hasWords, m.level, m.register),
    material: MATERIAL[mode]?.PRIMARY ?? 0,
    place: { scale: a.from.scale, x: a.from.x, y: a.from.y, crop: a.from.scale > 1 ? 1 : 0 },
    depth: a.nested ? 0.2 : 0.65,
    ...(from ? { depicts: from.toLowerCase() } : {}),
    reason: `${from ?? "the subject"} — ${rel.kind.toLowerCase()}`,
  });

  // WHAT RUNS BETWEEN THEM. A line of sight, a link, a crossing — drawn
  // only when the relation genuinely has one, and removed by negation.
  if (a.sight) {
    els.push({
      role: "SECONDARY",
      ops: ["CONNECT", "PLACE", "FRAME"],
      material: MATERIAL[mode]?.SECONDARY ?? 0,
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
      ops: opsFor("SURFACE", mode, hasWords, m.level, m.register),
      material: MATERIAL[mode]?.SURFACE ?? 0,
      place: { scale: 1, x: 0.5, y: 0.5, crop: 0 },
      depth: 0.99,
      reason: "a surface in front of it all — what is behind is seen only through the opening",
    });
  }

  if (mode !== "typographic" && m.phrase && m.typography > 0.4) {
    els.push({
      role: "TEXT",
      ops: opsFor("TEXT", mode, hasWords, m.level, m.register),
      material: MATERIAL[mode]?.TEXT ?? 0,
      place: { scale: 0.1 + m.typography * 0.1, x: 0.2, y: 0.88, crop: 0 },
      depth: 0.95,
      reason: "the words, as an accent",
    });
  }

  const sized = sizeWords(els, m);
  sized.sort((x, y) => x.depth - y.depth);
  const ranked = emphasise(sized);
  const focus = focusOf(ranked);
  return {
    elements: ranked,
    describes: `${sem.describes} · ${els.length} elements · ${a.why} · the frame is about the ${(
      focus?.role ?? "primary"
    ).toLowerCase()}`,
  };
}

export function composeScene(mode: Mode, m: Material): SceneGraph {
  const hasWords = Boolean(m.phrase?.trim());
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
      ops: opsFor("GROUND", mode, hasWords, m.level, m.register),
      material: MATERIAL[mode]?.GROUND ?? 0,
      place: groundPlace(1.6, m, mode),
      depth: 0,
      reason: "a field behind everything, cropped by the frame so it reads as bigger than the shot",
    });
  }

  // A COUNTED MULTITUDE. Only when the prose printed one.
  if (many) {
    els.push({
      role: "FIELD",
      ops: opsFor("FIELD", mode, hasWords, m.level, m.register),
      material: MATERIAL[mode]?.FIELD ?? 0,
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
    ops: opsFor("PRIMARY", mode, hasWords, m.level, m.register),
    material: MATERIAL[mode]?.PRIMARY ?? 0,
    place: {
      scale: clamp(pScale, 0.05, 4),
      x: clamp(0.5 + (off - 0.5) * (0.25 + m.abstraction * 0.6), 0.12, 0.88),
      y: clamp(0.5 + (0.5 - off) * (0.15 + m.abstraction * 0.4), 0.14, 0.86),
      crop: pScale > 1 ? 1 : 0,
    },
    depth: 0.6,
    ...(m.noun ? { depicts: m.noun.toLowerCase() } : {}),
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
      ops: opsFor("SECONDARY", mode, hasWords, m.level, m.register),
      material: MATERIAL[mode]?.SECONDARY ?? 0,
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
      ops: opsFor("SURFACE", mode, hasWords, m.level, m.register),
      material: MATERIAL[mode]?.SURFACE ?? 0,
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
      ops: opsFor("TEXT", mode, hasWords, m.level, m.register),
      material: MATERIAL[mode]?.TEXT ?? 0,
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

  const sized = sizeWords(els, m);
  sized.sort((a, b) => a.depth - b.depth);
  const ranked = emphasise(sized);
  const parts = ranked.map((e) => e.role.toLowerCase()).join(" · ");
  return {
    elements: ranked,
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
/** `layer_over` takes only the two of the four levers that are its own.
 *  The other two belong to `geometry_draw` and are applied there. */
const pick = (a: { opacity: number; sink: number }) => ({ opacity: a.opacity, sink: a.sink });

export function serialiseScene(
  scene: SceneGraph,
  m: Material,
  /* THE BRIDGE, ATTACHED WHERE IT CAN ACT.
   *
   * Keyed by element, because that is what the bridge is computed over —
   * "this element was there and is now here". It has to be applied to the
   * ONE node in that element's chain which reads a place, and this is the
   * only function that knows which nodes belong to which element. Passing
   * it down instead of stamping it afterwards is what stops the caller
   * having to reverse-engineer the correspondence. */
  bridge?: { tweens: Map<string, Record<string, [number, number]>>; ms: number },
): PlannedNode[] {
  const [first, ...rest] = scene.elements;
  if (!first) return [];
  const chainFor = (e: Element): PlannedNode[] => {
    const nodes = realiseOps(e.ops, {
      ...m,
      place: e.place,
      material: e.material ?? 0,
      emphasis: e.emphasis ?? 1,
    } as Material);
    /* THE WORDS ARRIVE WHEN THEY ARE SPOKEN.
     *
     * A tween on this element's `place`, cued to the measured moment the
     * phrase begins. It grows into presence from a fraction of its final
     * size, which is why the cue matters: a level-4 statement snapping to
     * full scale four seconds into a scene reads as an EVENT, and the
     * same statement present from the first frame reads as a caption.
     *
     * Only on an element that carries words, and only when the recording
     * measured them. A film with no narration has no cue, so the type is
     * simply there — which is honest, and is what it did before. */
    if (
      m.enterAtMs != null &&
      m.enterAtMs > 0 &&
      e.ops.includes("WORD") &&
      m.phrase?.trim() &&
      !bridge
    ) {
      const at = m.enterAtMs;
      const over = Math.max(180, Math.min(m.holdMs ?? 420, 900));
      return nodes.map((node) =>
        node.primitiveId === "place"
          ? {
              ...node,
              tween: {
                scale: [Number(node.params.scale ?? 1) * 0.55, Number(node.params.scale ?? 1)] as [
                  number,
                  number,
                ],
              },
              tweenMs: over,
              tweenAtMs: at,
            }
          : node,
      );
    }
    const tween = bridge?.tweens.get(elementKey(e));
    if (!tween || !bridge || bridge.ms <= 0) return nodes;
    // Only `place` reads x/y/scale, and only `place` has been verified to
    // read its params inside `frame()` rather than capturing them at make
    // time. A primitive that captures would ignore this silently, which is
    // why the set is one and widening it means checking first.
    return nodes.map((n) => (n.primitiveId === "place" ? { ...n, tween, tweenMs: bridge.ms } : n));
  };

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
        /* COMPOSITE STRENGTH IS EMPHASIS, AND ONLY EMPHASIS.
         *
         * This was a role table — PRIMARY 1, SECONDARY 0.95, GROUND 0.45 —
         * sitting alongside a completely separate density-keyed weight in
         * the renderer. Two mechanisms, both claiming to decide how loudly
         * an element speaks, in different files, disagreeing. That is the
         * exact failure standing rule 9 names, and it produced both of
         * this file's earlier bugs: TEXT arriving louder than its subject,
         * then FIELD suppressed until it was invisible.
         *
         * One number now, translated in one place. Depth still decides
         * ORDER; emphasis decides everything about volume. */
        params: { ...pick(applyEmphasis(e.emphasis ?? 1, m.density)), front: 1 },
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

/** CHOREOGRAPH FROM THE ACT, when no relation was read.
 *
 *  `choreograph` below is good and it has never run. Its gate is
 *  `sem.relations[0]`, and a relation needs two lexicon-known nouns — so
 *  on an essay of ideas there is nothing to key on, and the eight moves,
 *  the whole semantic→time table and `at()` have sat behind a condition
 *  that an argument cannot satisfy. `construct.ts:508` carries a comment
 *  asserting the capability is wired. It was not.
 *
 *  The ACT is the same question asked of what the sentence DOES rather
 *  than of what it names, so it is available on every scene. The relation
 *  still wins where it exists: two named things is a more specific
 *  reading than a verb over a whole sentence.
 *
 *  Every row below is a move that already existed. `REVERSE` in
 *  particular — the element crossing to the place its counterpart held —
 *  was written, is the most directly argumentative move in the table, and
 *  `choreograph` emits it for NO relation, so it has been doubly
 *  unreachable since the day it was written. A CONTRAST is exactly what it
 *  is for.
 *
 *  Two acts deliberately produce no move. SUSTAIN is the world staying as
 *  it is, which is what an empty choreography already means. QUALIFY is
 *  the essay giving ground, and there is no move for "less than was
 *  claimed" — inventing one here would be this file deciding what a
 *  qualification looks like, which is the layer below's job. */
export function choreographAct(scene: SceneGraph, act: Act, negated = false): Choreography {
  const moves: Record<number, Move> = {};
  const roleAt = (r: Role) => scene.elements.findIndex((e) => e.role === r);
  const field = roleAt("FIELD");
  const primary = roleAt("PRIMARY");
  const secondary = roleAt("SECONDARY");
  /** The thing the scene is about, whichever role carries it. A film of
   *  ideas often has no PRIMARY at all. */
  const subject = primary >= 0 ? primary : secondary >= 0 ? secondary : field;

  switch (act) {
    case "DECLARE":
      if (subject >= 0) moves[subject] = "EMERGE";
      return { moves, describes: "put on screen" };
    case "WITHDRAW":
      // A denial removes what was claimed rather than carrying it out of
      // frame — the claim never arrived, so it thins rather than leaves.
      if (subject >= 0) moves[subject] = negated ? "DISSOLVE" : "WITHDRAW";
      return { moves, describes: negated ? "refusing to arrive" : "going" };
    case "ACCUMULATE":
      if (field >= 0) {
        moves[field] = "ACCUMULATE";
        if (primary >= 0) moves[primary] = "HOLD";
      } else if (subject >= 0) moves[subject] = "ACCUMULATE";
      return { moves, describes: "more of it, gathering" };
    case "CONVERGE":
      if (subject >= 0) moves[subject] = "APPROACH";
      if (secondary >= 0 && secondary !== subject) moves[secondary] = "APPROACH";
      return { moves, describes: "the distance closing" };
    case "CONTRAST":
      if (subject >= 0) moves[subject] = "REVERSE";
      return { moves, describes: "the argument turning around" };
    case "REVEAL":
      if (secondary >= 0) moves[secondary] = "EMERGE";
      else if (subject >= 0) moves[subject] = "EMERGE";
      return { moves, describes: "what is behind, becoming visible" };
    case "TRANSFORM":
      if (secondary >= 0) {
        moves[secondary] = "EMERGE";
        if (primary >= 0) moves[primary] = "DISSOLVE";
      } else if (subject >= 0) moves[subject] = "EMERGE";
      return { moves, describes: "one turning into the other" };
    case "INTENSIFY":
      if (subject >= 0) moves[subject] = "ACCUMULATE";
      return { moves, describes: "the same thing, pressed harder" };
    case "RECALL":
      if (subject >= 0) moves[subject] = "ENTER";
      return { moves, describes: "back, from earlier" };
    default:
      return { moves, describes: "as it was" };
  }
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
