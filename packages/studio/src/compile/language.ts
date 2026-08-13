// VISUAL LANGUAGE — the layer that decides what KIND of visual argument a
// sentence becomes.
//
// THE FINDING THIS FILE ANSWERS.
//
// A 38-scene film was compiled with a real arc, real semantic reading,
// real scene graphs and real director dimensions — and every scene came
// out as a variation of the same picture: raster strata, procedural
// marks, restrained palette, occasional typography. Different meaning,
// same kind of image.
//
// The cause is mechanical and it is not a shortage of primitives. The
// compiler reaches the palette through 8 CONSTRUCTIONS and 12 OPERATORS,
// and NINE of those twelve operators are raster or shader. So whatever
// gets built, the last three stages of every chain are pixelate, dither,
// halftone, scanline, threshold or chromatic split. The output is a
// raster treatment of something. Always.
//
// Meanwhile 80% of the palette had never been reached by any film:
// B·VECTOR entire (8 primitives — the Bauhaus vocabulary), F·DATA almost
// entire, G·NETWORK, L·3D, Q·CUT GRAMMAR, P·INTERFACE, R·MAPS. Not weak
// primitives — a clean wireframe cube, a boolean circle pair, a rosette,
// a voronoi cell map. Unreachable, not missing.
//
// SO THE MISSING LAYER IS NOT MORE CONSTRUCTIONS. It is the layer above
// them that decides which visual system a meaning should be expressed IN.
//
//   SCRIPT → SEMANTIC READING → VISUAL PROPOSITION
//                                     ↓
//                            ▸ VISUAL LANGUAGE ◂     ← this file
//                                     ↓
//                            SCENE GRAPH → CHAIN → PIXELS
//
// WHAT A LANGUAGE IS, AND WHAT IT IS NOT.
//
// NOT a preset, a mode or a template. A language is a set of ANSWERS to a
// fixed set of visual questions, and every language answers all of them
// from its own vocabulary:
//
//   what is a THING here?        given a named subject
//   what is a QUANTITY here?     given a figure the prose printed
//   what is a RELATION here?     given "A became B"
//   what is the WORLD here?      given a place
//   what are the WORDS here?     given the sentence's own type
//   what is the SURFACE here?    material — and whether raster is allowed
//   how does it MOVE?            motion vocabulary
//
// The QUESTIONS are identical across languages. The ANSWERS differ. That
// is what makes this a grammar rather than seven templates: the same
// semantic facts drive every language, the parameters still come off the
// prose, and a sentence with no figure gets no quantity answer in any
// language.
//
// The existing raster/glitch grammar is NOT discarded. It is promoted to
// one language among several — SIGNAL — where it is a deliberate choice
// rather than the universal default it had silently become.

import type { Beat, PlannedNode, Style } from "./construct.ts";
import { serialiseFigures } from "./figures.ts";
import type { Relation } from "./relation.ts";
import { type TypeComposition, composeType, significantWords } from "./words.ts";

export type LanguageId =
  | "TYPOGRAPHIC"
  | "GEOMETRIC"
  | "DIAGRAMMATIC"
  | "COMPUTATIONAL"
  | "MATERIAL"
  | "SIGNAL"
  | "ILLUSTRATIVE";

/** Everything a language is given about a beat. Identical for all of
 *  them — a language that needed its own semantic pass would be a second
 *  compiler. */
export interface LangContext {
  beat: Beat;
  style: Style;
  type: TypeComposition;
  relation: Relation | undefined;
  /** Deterministic per scene; every stochastic choice derives from it. */
  seed: number;
}

/** The questions. A language answers each one or declines it, and
 *  declining is a real answer — a language with no idea what a quantity
 *  looks like should not invent one. */
export interface Grammar {
  id: LanguageId;
  /** What a director is told this language is. No primitive names. */
  name: string;
  feels: string[];
  /** What the film will DO with the script, in one sentence. */
  argument: string;
  thing(ctx: LangContext): PlannedNode[] | null;
  quantity(ctx: LangContext): PlannedNode[] | null;
  relation(ctx: LangContext): PlannedNode[] | null;
  world(ctx: LangContext): PlannedNode[] | null;
  words(ctx: LangContext): PlannedNode[] | null;
  /** The surface treatment. Applied last, and MAY BE EMPTY — which is
   *  the single most important degree of freedom this layer adds, because
   *  a language that returns nothing here cannot be turned into raster
   *  mush by an operator tail. */
  surface(ctx: LangContext): PlannedNode[];
}

const n = (
  primitiveId: string,
  params: Record<string, number | string>,
  reason: string,
): PlannedNode => ({ primitiveId, params, reason });

/** A number in 0..1 derived from a seed, with no `Math.random()`. Standing
 *  rule 4: everything stochastic is a pure function of its seed. */
function rand(seed: number, salt: number): number {
  let h = (seed * 2654435761 + salt * 40503) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 0xffffffff;
}

/** THE SERIES A DATA PRIMITIVE IS FED, and where it is allowed to come
 *  from.
 *
 *  `data_series` takes a `text@kind|text@kind` string, which is the
 *  compiler's own figure format — the DATA family was built to be fed
 *  quantities the prose actually printed, and that is the only honest
 *  source for a chart. An axis implies a measurement.
 *
 *  When the sentence printed no figures, a diagrammatic language does NOT
 *  invent them. It diagrams the SENTENCE — one entry per significant
 *  word, valued by the rank `words.ts` gave it. That is a graph of the
 *  text rather than a graph of the world, which is a claim the system can
 *  actually stand behind. */
function seriesFor(ctx: LangContext): { series: string; caption: string } {
  const figs = ctx.beat.figures ?? [];
  if (figs.length > 0) {
    return {
      series: serialiseFigures(figs),
      caption: (ctx.type.headline?.text ?? "").slice(0, 28),
    };
  }
  const terms = ctx.type.all
    .filter((w) => w.weight >= 0.3)
    .slice(0, 8)
    .map((w) => `${w.text}@${Math.round(w.weight * 100)}`);
  return {
    series: terms.join("|") || "TERM@40",
    caption: ctx.type.headline?.text ?? "",
  };
}

/** The figure the prose printed, as a number, or null. Never invented —
 *  the same firewall the quantity construction keeps. */
function printedCount(ctx: LangContext): number | null {
  const fig = (ctx.beat.figures ?? [])[0];
  if (fig) {
    const v = Number(String(fig.value).replace(/[^0-9.]/g, ""));
    if (Number.isFinite(v) && v > 0) return Math.min(400, Math.round(v));
  }
  if (ctx.type.repeat) return ctx.type.repeat.times;
  return null;
}

/* ════════════════════════════════════════════════════════════════════
   TYPOGRAPHIC — words are the objects.
   ═══════════════════════════════════════════════════════════════════

   Not captions. A caption tells you what the narration says; this makes
   an argument out of the sentence's own words — what fills the frame,
   what is set small against it, what is printed ninety-six times, and
   what the cut lands on. `words.ts` ranks them; this sets them. */
const TYPOGRAPHIC: Grammar = {
  id: "TYPOGRAPHIC",
  name: "Typographic / editorial",
  feels: ["analytical", "declarative", "compressed"],
  argument: "Sets the argument in the script's own words — scale, repetition and hard cuts.",
  thing(ctx) {
    const w = ctx.type.headline;
    if (!w) return null;
    // A named thing becomes its own name, monumental. `glyph_geometry`
    // samples the word into a point field, so the type is a made object
    // rather than a rendered string.
    return [
      n(
        "glyph_geometry",
        {
          text: w.text,
          sampling: Math.round(3 + (1 - ctx.style.density) * 5),
          scale: 0.55 + w.weight * 0.4,
          rotate: ctx.style.experimentalism * 0.2,
        },
        `"${w.verbatim}" set as the object itself`,
      ),
    ];
  },
  quantity(ctx) {
    const count = printedCount(ctx);
    const w = ctx.type.repeat?.word ?? ctx.type.headline;
    if (!count || !w) return null;
    // MULTIPLICITY AS TYPE, and the count comes off the prose:
    // "thousands of ordinary decisions" is DECISION ninety-six times.
    //
    // `tile` looked like the primitive for this and is not — it declares
    // IMAGE → IMAGE and draws a synthetic plate, so a word handed to it
    // came back as the palette's own default repeated. `text_repeat`
    // exists because of that, and it was written by looking at the
    // picture rather than at the type signature.
    const side = Math.max(2, Math.min(14, Math.round(Math.sqrt(count))));
    return [
      n(
        "text_repeat",
        {
          text: w.text,
          count: side,
          scatter: 0.05 + ctx.style.experimentalism * 0.35,
          fade: 0.2 + (1 - ctx.style.density) * 0.5,
        },
        `"${w.verbatim}" printed ${side * side} times — the prose said ${count}`,
      ),
    ];
  },
  relation(ctx) {
    const r = ctx.relation;
    if (!r?.agent || !r?.patient) return null;
    // A → B as one word BECOMING another, which is what `text_morph` is
    // for and what it has never once been asked to do.
    return [
      n(
        "text_morph",
        {
          from: r.agent.text.toUpperCase(),
          to: r.patient.text.toUpperCase(),
          rate: 0.25 + ctx.style.energy * 0.4,
        },
        `"${r.agent.text}" becomes "${r.patient.text}" — the relation set as a transformation`,
      ),
    ];
  },
  world(ctx) {
    const place = ctx.beat.subjects.find((s) => s.kind === "place");
    if (!place) return null;
    // A PLACE AS A TYPOGRAPHIC FIELD. The word, repeated at the scale of
    // architecture, is a legitimate reading of a city — and it is the one
    // this language has.
    return [
      n(
        "text_repeat",
        {
          text: place.text.toUpperCase(),
          count: Math.round(3 + ctx.style.density * 5),
          scatter: 0.1 + ctx.style.energy * 0.3,
          fade: 0.55,
        },
        `${place.text} as a field of its own name, to the edge of frame`,
      ),
    ];
  },
  words(ctx) {
    const h = ctx.type.hinge ?? ctx.type.headline;
    if (!h) return null;
    // MODE IS THE HIERARCHY. text_layout's six modes are a real
    // typographic vocabulary — centred, editorial, asymmetric, stacked,
    // circular, scattered — and the word's ROLE chooses among them: a
    // figure is centred and monumental, a turn is asymmetric, a concept
    // is stacked.
    const mode = h.role === "FIGURE" ? 0 : h.role === "TURN" ? 2 : h.role === "CONCEPT" ? 3 : 1;
    return [
      n(
        "text_layout",
        {
          text: h.text,
          mode,
          tracking: 0.15 + ctx.style.typography * 0.5,
          scale: 0.35 + h.weight * 0.55,
        },
        `"${h.verbatim}" — ${h.role.toLowerCase()}, set ${["centred", "editorial", "asymmetric", "stacked"][mode] ?? "plainly"}`,
      ),
      n(
        "variable_axis",
        {
          text: h.text,
          weight: 0.3 + h.weight * 0.6,
          animate: 0.3 + ctx.style.energy * 0.5,
          width: 0.5,
        },
        "the word moves under its own weight",
      ),
    ];
  },
  surface(ctx) {
    // DELIBERATELY ALMOST NOTHING. Typography is ruined by raster mush,
    // and the whole reason this layer exists is that every language used
    // to end in three raster stages. A single hard threshold is the most
    // this language will accept, and only when the film is experimental.
    return ctx.style.experimentalism > 0.6
      ? [n("threshold", { level: 0.5, steps: 2 }, "hard contrast — print, not photography")]
      : [];
  },
};

/* ════════════════════════════════════════════════════════════════════
   GEOMETRIC — circles, lines, grids. Meaning as arrangement.
   ═══════════════════════════════════════════════════════════════════

   The Bauhaus / Saul Bass / record-sleeve territory, and the cheapest
   route to something legible the system has: a circle does not have to
   pretend to be a city. "Concentration" is a hundred points collapsing
   to one; "fragmentation" is one rectangle becoming twelve. That is
   interpretation rather than illustration, and every primitive it needs
   has been in the palette, unused, since the palette existed. */
const GEOMETRIC: Grammar = {
  id: "GEOMETRIC",
  name: "Geometric / graphic",
  feels: ["constructed", "modernist", "exact"],
  argument: "Turns the argument into shape and arrangement — circles, grids, hard division.",
  thing(ctx) {
    const s = ctx.beat.subjects[0];
    // A THING IS A FORM. Sides from the noun's own length so two
    // different nouns are two different shapes — derived, not random,
    // and not a lookup table of noun→shape either.
    const a = s ? 3 + (s.text.length % 7) : 4;
    const b = s ? 3 + ((s.text.length * 3 + 5) % 9) : 8;
    return [
      n(
        "parametric_curve",
        { mode: s ? s.text.length % 4 : 0, k: 1 + ((s?.text.length ?? 3) % 8), reveal: 0.8 },
        s ? `${s.text} as a figure with ${1 + ((s?.text.length ?? 3) % 8)} lobes` : "a figure",
      ),
      n(
        "shape_morph",
        { sides_a: a, sides_b: b, rate: 0.15 + ctx.style.energy * 0.5 },
        `${a} sides becoming ${b} — the form is not stable`,
      ),
      n(
        "geometry_draw",
        {
          weight: 0.35 + ctx.style.density * 0.5,
          halftone: 0,
          invert: 0,
          trail: ctx.style.energy * 0.4,
        },
        "drawn, not filled",
      ),
    ];
  },
  quantity(ctx) {
    const count = printedCount(ctx);
    if (!count) return null;
    // THE NUMBER IS THE PICTURE. Not a chart of the number — that many
    // marks. This is the reading a graphic designer gives a figure and
    // the one the data family cannot.
    return [
      n(
        "particle_emitter",
        {
          rate: Math.max(0.05, Math.min(1, count / 200)),
          life: 0.6,
          spread: 0.25 + ctx.style.density * 0.5,
          gravity: 0.1,
        },
        `${count} marks — the figure, counted out rather than charted`,
      ),
      n(
        "particle_seek",
        {
          text: ctx.type.headline?.text ?? "",
          damping: 0.88,
          force: 0.04 + ctx.style.energy * 0.1,
          scatter: 0.15,
        },
        "and they gather into a form",
      ),
    ];
  },
  relation(ctx) {
    const r = ctx.relation;
    if (!r?.agent || !r?.patient) return null;
    // TWO FORMS AND WHAT PASSES BETWEEN THEM. `boolean_ops` is the
    // graphic vocabulary for a relation: union, intersection, subtraction
    // ARE claims about how two things stand to each other.
    // UNION, INTERSECTION, SUBTRACTION AND DIFFERENCE ARE CLAIMS about
    // how two things stand to each other. A passive takes something away;
    // a forward cause joins; the rest overlap.
    const op = r.voice === "passive" ? 2 : r.cause === "forward" ? 0 : 1;
    return [
      n("parametric_curve", { mode: 1, k: 3, reveal: 0.9 }, "the first term as a form"),
      n(
        "boolean_ops",
        { op, offset: 0.22 + ctx.style.energy * 0.2, size: 0.45 },
        `${["union", "intersection", "subtraction", "difference"][op]} — "${r.action}" as a relation between two forms`,
      ),
    ];
  },
  world(ctx) {
    const place = ctx.beat.subjects.find((s) => s.kind === "place");
    if (!place) return null;
    // A PLACE IS A SUBDIVISION. Voronoi is a city plan without being a
    // picture of one — cells, edges, uneven blocks.
    return [
      n(
        "voronoi",
        {
          cells: 0.15 + ctx.style.density * 0.7,
          drift: 0.1 + ctx.style.energy * 0.4,
          fill: 0.15 + ctx.style.archival * 0.3,
        },
        `${place.text} as a subdivision of the plane — cells and edges, not a picture of a city`,
      ),
    ];
  },
  words(ctx) {
    const h = ctx.type.headline;
    if (!h || ctx.style.typography < 0.3) return null;
    // Type is allowed in, but as a GRAPHIC element: outlined, set against
    // the geometry rather than over it.
    return [
      n(
        "glyph_to_path",
        {
          text: h.text,
          weight: 0.15 + ctx.style.typography * 0.3,
          dash: 0.3 + ctx.style.experimentalism * 0.4,
        },
        `"${h.verbatim}" as an outline, drawn like the geometry around it`,
      ),
    ];
  },
  surface() {
    // NO RASTER AT ALL. This is the language's defining refusal: dither
    // and pixelate would turn a hard-edged graphic composition into the
    // same murk as everything else, which is precisely the failure this
    // layer exists to end.
    return [];
  },
};

/* ════════════════════════════════════════════════════════════════════
   DIAGRAMMATIC — the argument as a system.
   ═══════════════════════════════════════════════════════════════════

   Nodes, edges, flows, charts, callouts. The natural language for
   investigative material and the one Canopticon's own subject matter
   asks for most often. Twelve DATA and five NETWORK primitives, none of
   which a film has ever reached except by accident. */
const DIAGRAMMATIC: Grammar = {
  id: "DIAGRAMMATIC",
  name: "Diagrammatic / systemic",
  feels: ["forensic", "explanatory", "cold"],
  argument: "Draws the argument as a system — nodes, edges, flows and quantities.",
  thing(ctx) {
    const s = ctx.beat.subjects[0];
    return [
      n("data_series", { ...seriesFor(ctx), reveal: 0.9 }, "the series"),
      n(
        "force_layout",
        {
          nodes: 0.2 + ctx.style.density * 0.7,
          charge: 0.3 + ctx.style.energy * 0.4,
          link: 0.3 + ctx.style.data * 0.5,
        },
        s ? `${s.text} as a node among others` : "a topology",
      ),
      n(
        "graph_reveal",
        {
          rate: 0.2 + ctx.style.energy * 0.5,
          order: ctx.style.data > 0.5 ? 1 : 0,
          nodes: 0.3 + ctx.style.density * 0.6,
        },
        "the graph assembles itself in front of you",
      ),
    ];
  },
  quantity(ctx) {
    const count = printedCount(ctx);
    if (!count) return null;
    return [
      n("data_series", { ...seriesFor(ctx), reveal: 0.9 }, `${count}, as data`),
      n(
        "chart_cartesian",
        {
          kind: count > 40 ? 2 : 1,
          reveal: 0.3 + ctx.style.energy * 0.5,
          grid: 0.4 + ctx.style.data * 0.4,
        },
        "plotted — an axis implies a measurement, so it is only drawn when the prose printed one",
      ),
    ];
  },
  relation(ctx) {
    const r = ctx.relation;
    if (!r?.agent || !r?.patient) return null;
    return [
      n("data_series", { ...seriesFor(ctx), reveal: 0.9 }, "the stages"),
      n(
        "sankey_flow",
        {
          nodes: 3,
          thickness: 0.35 + ctx.style.data * 0.4,
          curve: 0.5 + ctx.style.energy * 0.3,
          route: `${r.agent.text.toUpperCase()} → ${r.patient.text.toUpperCase()}`,
        },
        `${r.agent.text} → ${r.patient.text}, as flow between stages`,
      ),
    ];
  },
  world(ctx) {
    const place = ctx.beat.subjects.find((s) => s.kind === "place");
    if (!place) return null;
    return [
      n("data_series", { ...seriesFor(ctx), reveal: 0.9 }, "the field"),
      n(
        "data_to_particles",
        {
          perUnit: 0.2 + ctx.style.density * 0.6,
          gather: 0.4,
          jitter: 0.15 + ctx.style.energy * 0.3,
        },
        `${place.text} as a distribution of units`,
      ),
      n(
        "particle_connect",
        {
          count: 0.3 + ctx.style.density * 0.5,
          radius: 0.2 + ctx.style.density * 0.4,
          drift: ctx.style.energy * 0.4,
        },
        "and its adjacencies — the place as who is next to whom",
      ),
    ];
  },
  words(ctx) {
    const h = ctx.type.headline;
    // A DIAGRAM'S WORDS ARE ALREADY IN IT.
    //
    // The first version put an `annotation` layer over the graph, and
    // `annotation` is a SOURCE that paints an opaque page — so it hid
    // the topology underneath completely and the whole language rendered
    // as ruled paper. The labels of a diagram are not a layer over the
    // diagram; they are nodes of it, and `seriesFor` has already put the
    // sentence's own terms into the series the graph is laid out from.
    //
    // Declining is the right answer, not a missing feature.
    void h;
    return null;
  },
  surface(ctx) {
    // A diagram may be printed but never dissolved. One reprographic
    // pass at most, because a diagram whose lines have been eaten is no
    // longer a diagram.
    return ctx.style.archival > 0.55
      ? [n("halftone", { size: 4, angle: 0.2 }, "reproduced — a printed figure")]
      : [];
  },
};

/* ════════════════════════════════════════════════════════════════════
   COMPUTATIONAL — the world as a running system.
   ═══════════════════════════════════════════════════════════════════

   Wireframe, point cloud, isometric space, HUD, cursor, spotlight. The
   videogame/early-3D territory. The first film found some of this by
   accident — the low-bit creature behaviour — which is evidence the
   territory is fertile, not that it should stay accidental. */
const COMPUTATIONAL: Grammar = {
  id: "COMPUTATIONAL",
  name: "Computational / synthetic",
  feels: ["synthetic", "instrumented", "uncanny"],
  argument:
    "Renders the argument as a running system seen from inside — wireframe space and instruments.",
  thing(ctx) {
    const s = ctx.beat.subjects[0];
    return [
      n(
        "wireframe",
        {
          form: s ? s.text.length % 3 : 0,
          spin: 0.15 + ctx.style.energy * 0.5,
          subdiv: Math.round(4 + ctx.style.density * 8),
        },
        s ? `${s.text} as a wireframe solid` : "a solid",
      ),
      n(
        "camera_3d",
        { orbit: 0.2 + ctx.style.energy * 0.5, dolly: 0.15 + ctx.style.density * 0.3, grid: 0.6 },
        "seen from a camera that is itself part of the system",
      ),
    ];
  },
  quantity(ctx) {
    const count = printedCount(ctx);
    if (!count) return null;
    return [
      n(
        "point_cloud",
        {
          count: Math.max(0.05, Math.min(1, count / 120)),
          spin: 0.15 + ctx.style.energy * 0.4,
          form: count > 60 ? 2 : 1,
        },
        `${count}, as a volume of points rather than a number`,
      ),
    ];
  },
  relation(ctx) {
    const r = ctx.relation;
    if (!r?.agent || !r?.patient) return null;
    return [
      n(
        "wireframe",
        { form: 1, spin: 0.2 + ctx.style.energy * 0.3, subdiv: 6 },
        "the first term, built",
      ),
      n(
        "exploded_view",
        {
          layers: 4,
          separation: 0.3 + ctx.style.energy * 0.5,
          tilt: 0.3 + ctx.style.abstraction * 0.4,
        },
        `"${r.action}" — the thing taken apart into what it becomes`,
      ),
    ];
  },
  world(ctx) {
    const place = ctx.beat.subjects.find((s) => s.kind === "place");
    if (!place) return null;
    return [
      n("data_series", { ...seriesFor(ctx), reveal: 0.9 }, "the terrain data"),
      n(
        "data_to_particles",
        { perUnit: 0.3 + ctx.style.density * 0.6, gather: 0.2, jitter: 0.1 },
        `${place.text} as occupied cells`,
      ),
      n(
        "extrude",
        {
          text: place.text.toUpperCase(),
          depth: 0.25 + ctx.style.density * 0.5,
          spin: 0.1 + ctx.style.energy * 0.3,
        },
        "given height — a city block is a column",
      ),
    ];
  },
  words(ctx) {
    const h = ctx.type.headline;
    if (!h) return null;
    // Type as INSTRUMENTATION — a readout over the world, not a caption
    // under it.
    return [
      n("data_series", { ...seriesFor(ctx), reveal: 0.9 }, "the readout's data"),
      n(
        "ui_surface",
        {
          kind: h.role === "FIGURE" ? 1 : 0,
          items: Math.round(3 + ctx.style.data * 8),
          activity: 0.3 + ctx.style.energy * 0.5,
        },
        `an instrument reading "${h.verbatim}" — type as HUD, not as caption`,
      ),
    ];
  },
  surface(ctx) {
    // Low-bit ON PURPOSE. This is the one language where quantisation is
    // the point rather than an accident of the operator tail.
    return [
      n(
        "pixelate",
        {
          size: Math.round(3 + (1 - ctx.style.abstraction) * 7),
          quantize: Math.round(4 + ctx.style.archival * 8),
        },
        "resolved down — low-bit on purpose here, not as an accident of the tail",
      ),
    ];
  },
};

/* ════════════════════════════════════════════════════════════════════
   MATERIAL — paper, ink, print, the archive.
   ═══════════════════════════════════════════════════════════════════

   Where the current raster family actually belongs: halftone and dither
   are REPRODUCTION, not glitch, and given a paper substrate they read as
   a photocopied document rather than as noise. This is also the language
   closest to the Record's own subject matter. */
const MATERIAL: Grammar = {
  id: "MATERIAL",
  name: "Material / archival",
  feels: ["documentary", "handled", "sober"],
  argument:
    "Treats the argument as a document — paper, print, redaction and the marks of handling.",
  thing(ctx) {
    return [
      n(
        "document_layout",
        {
          kind: Math.round(ctx.style.data * 3),
          columns: ctx.style.density > 0.6 ? 2 : 1,
          age: ctx.style.archival,
          heading: ctx.type.headline?.text ?? "",
        },
        "set as a document",
      ),
      n(
        "camera_move",
        {
          kind: ctx.style.energy > 0.5 ? 1 : 0,
          rate: 0.1 + ctx.style.energy * 0.3,
          amount: 0.2 + ctx.style.density * 0.4,
        },
        "and read by a camera that moves the way a hand moves",
      ),
    ];
  },
  quantity(ctx) {
    const count = printedCount(ctx);
    if (!count) return null;
    return [
      n("data_series", { ...seriesFor(ctx), reveal: 0.9 }, `${count}`),
      n(
        "small_multiples",
        {
          cols: Math.max(2, Math.min(10, Math.round(Math.sqrt(count)))),
          highlight: 0.4,
          reveal: 0.5,
        },
        "tabulated — a figure among figures, which is what a register looks like",
      ),
    ];
  },
  relation(ctx) {
    const r = ctx.relation;
    if (!r?.agent || !r?.patient) return null;
    return [
      n(
        "document_surface",
        { age: ctx.style.archival, columns: 1, redaction: 0.2 + (1 - ctx.style.human) * 0.3 },
        "the record",
      ),
      n(
        "redaction",
        {
          coverage: 0.2 + (1 - ctx.style.human) * 0.4,
          mode: 1,
          rate: 0.15 + ctx.style.energy * 0.3,
        },
        `what the record says about ${r.patient.text} — and what it does not`,
      ),
    ];
  },
  world(ctx) {
    const place = ctx.beat.subjects.find((s) => s.kind === "place");
    if (!place) return null;
    return [
      n(
        "document_surface",
        { age: 0.5 + ctx.style.archival * 0.4, columns: 2, redaction: 0.1 },
        `the file on ${place.text}`,
      ),
      n(
        "annotation",
        { kind: 0, roughness: 0.4 + ctx.style.experimentalism * 0.4, draw: 0.7 },
        "annotated by a hand that has been through it",
      ),
    ];
  },
  words(ctx) {
    const h = ctx.type.headline;
    if (!h) return null;
    return [
      n(
        "text_layout",
        { text: h.text, mode: 1, tracking: 0.08, scale: 0.28 },
        `"${h.verbatim}", typed`,
      ),
    ];
  },
  surface(ctx) {
    // Reprographic, in a specific order: halftone is a printing process,
    // dither is a cheaper one, and doing both is a photocopy of a
    // photocopy — which is a real archival claim rather than a look.
    const out = [
      n(
        "halftone",
        { size: Math.round(4 + ctx.style.archival * 8), angle: 0.15 },
        "printed — a reprographic process, not a glitch",
      ),
    ];
    if (ctx.style.archival > 0.6) {
      out.push(
        n("dither", { threshold: 0.5, size: 2 }, "and copied again — a photocopy of a photocopy"),
      );
    }
    return out;
  },
};

/* ════════════════════════════════════════════════════════════════════
   SIGNAL — the language the compiler had already found.
   ═══════════════════════════════════════════════════════════════════

   Fields, particles, feedback, quantisation, drift. This is the murky
   procedural grammar every film has been coming out in, and it is KEPT,
   deliberately: it is genuinely good at abstraction, rhythm, strangeness
   and cheapness. The only thing wrong with it was that it was the
   universal default. Named, it becomes a choice. */
const SIGNAL: Grammar = {
  id: "SIGNAL",
  name: "Signal / abstract",
  feels: ["computational", "restless", "strange"],
  argument: "Refuses depiction — expresses the argument as field, density, drift and interference.",
  thing(ctx) {
    return [
      n(
        "noise_field",
        {
          scale: 0.2 + ctx.style.density * 0.5,
          octaves: Math.round(2 + ctx.style.density * 3),
          turbulence: 0.2 + ctx.style.energy * 0.4,
        },
        "a field",
      ),
      n(
        "flow_field",
        {
          scale: 0.2 + ctx.style.abstraction * 0.5,
          turbulence: 0.3 + ctx.style.experimentalism * 0.5,
          density: 0.3 + ctx.style.density * 0.5,
        },
        "given direction",
      ),
      n(
        "particle_flow",
        {
          count: 0.2 + ctx.style.density * 0.7,
          speed: 0.2 + ctx.style.energy * 0.6,
          turbulence: 0.3,
          trail: 0.05 + ctx.style.archival * 0.2,
        },
        "and inhabitants that only exist as motion",
      ),
    ];
  },
  quantity(ctx) {
    const count = printedCount(ctx);
    if (!count) return null;
    return [
      n(
        "particle_emitter",
        {
          rate: Math.max(0.05, Math.min(1, count / 150)),
          life: 0.5 + ctx.style.archival * 0.4,
          spread: 0.7,
          gravity: -0.05,
        },
        `${count}, expressed as density rather than counted`,
      ),
    ];
  },
  relation(ctx) {
    if (!ctx.relation?.agent || !ctx.relation.patient) return null;
    return [
      n(
        "gravity_field",
        { mass: 0.4 + ctx.style.energy * 0.4, bodies: 2, trails: 0.4 },
        "two attractors",
      ),
      n(
        "particle_flow",
        {
          count: 0.3 + ctx.style.density * 0.6,
          speed: 0.3 + ctx.style.energy * 0.4,
          turbulence: 0.2,
          trail: 0.12,
        },
        `everything drifts from ${ctx.relation.agent.text} toward ${ctx.relation.patient.text}`,
      ),
    ];
  },
  world(ctx) {
    if (!ctx.beat.subjects.some((s) => s.kind === "place")) return null;
    return [
      n(
        "reaction_diffusion",
        {
          feed: 0.3 + ctx.style.density * 0.3,
          kill: 0.4 + ctx.style.abstraction * 0.2,
          scale: 0.3 + ctx.style.density * 0.5,
        },
        "a system that grows into its own space",
      ),
    ];
  },
  words(ctx) {
    const h = ctx.type.headline;
    if (!h || ctx.style.typography < 0.45) return null;
    return [
      n(
        "glyph_to_points",
        {
          text: h.text,
          sampling: Math.round(4 + ctx.style.density * 6),
          jitter: 0.15 + ctx.style.experimentalism * 0.5,
        },
        `"${h.verbatim}" decomposed to points so the field can act on it`,
      ),
    ];
  },
  surface(ctx) {
    const out: PlannedNode[] = [
      n(
        "color_transform",
        { mode: ctx.style.archival > 0.5 ? 1 : 0, amount: 0.3 + ctx.style.human * 0.4, shift: 0.2 },
        "graded",
      ),
    ];
    if (ctx.style.abstraction > 0.5) {
      out.push(n("feedback", { zoom: 0.06, rotate: 0.03, decay: 0.75 }, "fed back into itself"));
    }
    out.push(
      n(
        "scanline",
        { gap: Math.round(3 + ctx.style.archival * 4), roll: 0.15, bleed: 0.3 },
        "read off a surface",
      ),
    );
    return out;
  },
};

/* ════════════════════════════════════════════════════════════════════
   ILLUSTRATIVE — the object world.
   ═══════════════════════════════════════════════════════════════════

   The branch the last several batches built: places, bodies, fixtures,
   documents, populated worlds and the scene graph. Kept as a language so
   it can go on improving on its own track WITHOUT the rest of the system
   waiting for it — which was the whole point of the split. It delegates
   to `construct.ts` rather than reimplementing it. */
const ILLUSTRATIVE: Grammar = {
  id: "ILLUSTRATIVE",
  name: "Material world",
  feels: ["observational", "physical", "inhabited"],
  argument:
    "Builds the things the script names — places, bodies, objects — and composes them in depth.",
  // Answers are supplied by the existing constructor; see `chainFor`.
  thing: () => null,
  quantity: () => null,
  relation: () => null,
  world: () => null,
  words: () => null,
  surface: () => [],
};

/* ════════════════════════════════════════════════════════════════════
   SYNTHESIS — a passage that changes what kind of thing it is.
   ═══════════════════════════════════════════════════════════════════

   Not an eighth vocabulary. A RULE about the other seven: take two
   languages and hand successive beats to each, so the film crosses from
   one representational system to another while the argument continues.

   This is the territory the whole layer was built to reach. A city
   becomes a grid becomes a word becomes a field is not a transition
   effect between two shots — it is the same claim expressed in three
   systems in sequence, and it is only possible once "what kind of visual
   argument is this" is a thing the compiler can answer differently at
   different moments.

   Deliberately a PAIR rather than a free-for-all. A passage that visits
   six languages is not synthesis, it is a showreel. */
export interface SynthesisPlan {
  from: LanguageId;
  to: LanguageId;
  /** Which language each beat is spoken in, in order. */
  at: LanguageId[];
  why: string;
}

/** Cross from one language to another across `beats` beats.
 *
 *  The crossing is not a dissolve at the midpoint — it INTERLEAVES near
 *  the boundary, so a beat or two speak the new language before the old
 *  one gives up. That is how a cut sequence actually turns: the new idea
 *  appears, is withdrawn, and then takes over. */
export function planSynthesis(from: LanguageId, to: LanguageId, beats: number): SynthesisPlan {
  const at: LanguageId[] = [];
  for (let i = 0; i < beats; i++) {
    const t = beats <= 1 ? 1 : i / (beats - 1);
    // A deterministic interleave: the second language starts appearing
    // at a third of the way through and is the only one by two thirds.
    const bias = t < 0.34 ? 0 : t > 0.66 ? 1 : i % 2 === 0 ? 0 : 1;
    at.push(bias === 0 ? from : to);
  }
  return {
    from,
    to,
    at,
    why: `${from.toLowerCase()} crossing into ${to.toLowerCase()} — the same argument, changing what kind of thing it is`,
  };
}

export const GRAMMARS: Record<LanguageId, Grammar> = {
  TYPOGRAPHIC,
  GEOMETRIC,
  DIAGRAMMATIC,
  COMPUTATIONAL,
  MATERIAL,
  SIGNAL,
  ILLUSTRATIVE,
};

export const LANGUAGE_IDS = Object.keys(GRAMMARS) as LanguageId[];

/** What a language made of a beat: a set of LAYERS, not one chain.
 *
 *  This is the shape the first version got wrong and the type system
 *  caught within minutes. Almost every answer a grammar gives is a
 *  SOURCE — a document surface, a wireframe, a field, a word — and
 *  concatenating sources into one linear chain means each one clears the
 *  frame and paints over the last. The chain type-checks, costs full
 *  price, and renders as its final element.
 *
 *  A world and a subject and a set of words are not a sequence. They are
 *  a composition, and the compiler already has the structure for that:
 *  the scene graph. So a language returns its answers as layers and the
 *  graph nests them, far to near, exactly as it does for semantic
 *  planes. */
export interface LanguageBuild {
  layers: { role: string; nodes: PlannedNode[] }[];
  surface: PlannedNode[];
  why: string;
}

/** THE BRIDGE THAT ALMOST RUINED EVERY LANGUAGE.
 *
 *  The first version of `assemble` inserted a GEOMETRY → IMAGE converter
 *  between every layer, on the theory that a compositor needs pixels. It
 *  does not: a compositor's inputs are CANVASES, every primitive paints
 *  one, and `groundSatisfies` enforces a type only for the field
 *  compositors that genuinely read numbers.
 *
 *  What the bridge did instead was destroy the thing it was bridging.
 *  `particle_trail` consumes GEOMETRY and emits a sparse smear of dots,
 *  so a clean outlined word, a voronoi cell map and a drawn polygon all
 *  arrived at the compositor as the same faint speckle — three languages
 *  rendered as near-black frames, for exactly the "operators destroy
 *  their substrate" reason this whole layer was built to fix. Introducing
 *  that bug while fixing that bug is worth the comment.
 *
 *  So there is no bridge between layers. The only place pixels are
 *  genuinely required is a one-input raster SURFACE operator, and a
 *  multi-layer chain already ends in a compositor, which emits IMAGE. A
 *  single-layer chain whose tail is not IMAGE simply goes untreated —
 *  saying nothing is better than saying it through a primitive that eats
 *  the picture.
 */
/** Build a scene in one language.
 *
 *  THE QUESTIONS FIRE FROM THE SEMANTICS, NOT FROM THE LANGUAGE. Which
 *  answers are asked for depends on what the sentence actually contains —
 *  a relation only if the prose drew one, a quantity only if it printed a
 *  figure. So the same language produces different work for different
 *  sentences, and different languages produce different work for the same
 *  one. That is the whole architecture in one function.
 *
 *  Returns null when a language has nothing to say about a beat, which is
 *  an honest answer and better than a default. */
export function chainFor(id: LanguageId, ctx: LangContext): LanguageBuild | null {
  const g = GRAMMARS[id];
  if (!g) return null;

  const layers: LanguageBuild["layers"] = [];

  // Ordered far to near: the world is behind everything, the subject
  // stands in it, the words sit over both.
  const world = g.world(ctx);
  if (world) layers.push({ role: "world", nodes: world });

  const quantity = g.quantity(ctx);
  const relation = g.relation(ctx);
  const thing = g.thing(ctx);
  // A quantity outranks a relation outranks a bare thing, for the same
  // reason the quantity construction outranks everything else: a printed
  // figure is the most specific thing a sentence can hand a renderer.
  if (quantity) layers.push({ role: "quantity", nodes: quantity });
  else if (relation) layers.push({ role: "relation", nodes: relation });
  else if (thing) layers.push({ role: "thing", nodes: thing });

  const words = g.words(ctx);
  if (words && (layers.length === 0 || ctx.style.typography > 0.35)) {
    layers.push({ role: "words", nodes: words });
  }

  if (layers.length === 0) return null;
  return {
    layers,
    surface: g.surface(ctx),
    why: `${g.name.toLowerCase()} — ${layers.map((l) => l.role).join(" + ")}`,
  };
}

/** The layers, nested into one chain the executor can run.
 *
 *  Same rule the scene graph uses: each layer composites what is behind
 *  it onto its own second input, so nothing overwrites anything. The
 *  surface treatment is applied once, at the very end, to the assembled
 *  picture — never per layer, which would print the same halftone three
 *  times at three different scales. */
export function assemble(
  built: LanguageBuild,
  outputsOf: (primitiveId: string) => string[],
): PlannedNode[] {
  let acc: PlannedNode[] | null = null;
  for (const [i, layer] of built.layers.entries()) {
    const nodes = layer.nodes;
    if (!acc) {
      acc = [...nodes];
      continue;
    }
    acc = [
      ...nodes,
      {
        primitiveId: "layer_over",
        params: { opacity: 0.72, front: 0, sink: 0.22 },
        reason: `the ${built.layers[i - 1]?.role} sits behind the ${layer.role}`,
        ground: acc,
      },
    ];
  }
  if (!acc) return [];
  // The surface treats the WHOLE composition, once — never per layer,
  // which would print the same halftone three times at three scales.
  const tail = acc[acc.length - 1];
  const emitsImage = tail ? outputsOf(tail.primitiveId).includes("IMAGE") : false;
  return built.surface.length > 0 && emitsImage ? [...acc, ...built.surface] : acc;
}

/** Assemble the context a language needs from a beat. One place, so no
 *  language can quietly read the prose differently from another. */
export function contextFor(beat: Beat, style: Style, seed: number): LangContext {
  const words = significantWords(beat.sentence, beat.subjects, beat.relation?.action);
  return {
    beat,
    style,
    type: composeType(words, beat.sentence),
    relation: beat.relation ?? undefined,
    seed,
  };
}

/** What a director is told about a language, with no primitive named. */
export function describeLanguage(id: LanguageId): {
  name: string;
  feels: string;
  argument: string;
} {
  const g = GRAMMARS[id];
  return { name: g.name, feels: g.feels.join(" · "), argument: g.argument };
}
