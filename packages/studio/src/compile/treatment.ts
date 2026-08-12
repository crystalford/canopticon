// Treatment planning — narrative meaning to a type-checked primitive chain.
//
// This is the wire between the essay and the palette. Everything below it
// (subjects, typed composition, depiction) was already proven; nothing
// above it could reach any of it.
//
// The shape:
//
//   sentence → SemanticReading → (visual language) → validated chain
//
// Two rules make it honest rather than a lookup table with extra steps:
//
// 1. The SemanticReading is a FROZEN INPUT ARTIFACT, exactly like narration
//    audio. An LLM proposes it once at authoring time; the operator
//    ratifies it; it is hashed and committed. `planTreatment` never calls a
//    model — given the same reading it always plans the same chain. That is
//    what keeps standing rule 1 intact while still letting the system read
//    meaning out of prose.
//
// 2. Every chain is TYPE-CHECKED against the palette's real signatures. A
//    chain that reads plausibly in prose is rejected if the types don't
//    line up. This is the mechanism that stops the palette collapsing back
//    into a menu of effects: you cannot staple two nice-looking primitives
//    together unless one genuinely consumes what the other emits.
//
// The same reading rendered through different visual languages produces
// different chains and the SAME subject. Identity is invariant; depiction
// is the director's.

import type { SemanticReading, VisualLanguage } from "../ir/schema.ts";
import { PRIMITIVES, type PrimitiveType, canChain } from "../primitives/registry.ts";
import { chartFor, serialiseFigures } from "./figures.ts";

// The reading and the visual language are AUTHORED DATA, so they live in
// the IR. Re-exported here so callers of the planner do not need to know
// that, and so the two can never drift into separate definitions.
export type { SemanticReading, VisualLanguage };

export const VISUAL_LANGUAGES: VisualLanguage[] = [
  "documentary",
  "technical",
  "pixel",
  "surreal",
  "kinetic",
];

/** Which body plan realises a kind of subject. Deliberately small: a body
 *  plan is a parameterised generator, not an asset, so a handful of them
 *  covers a lot of nouns. `mounted_fixture` is a smoke detector, a ceiling
 *  speaker, a sprinkler head or a camera dome depending on its parameters. */
const BODY_PLANS: Record<SemanticReading["subjects"][number]["kind"], string> = {
  object: "mounted_fixture",
  creature: "creature_chain",
  document: "document_surface",
  person: "creature_chain",
  place: "noise_field",
  concept: "glyph_geometry",
};

/** The representation rung each language sits on, and what it appends after
 *  rasterisation. Each tail is written against the palette's real type
 *  signatures — see the test that proves all four typecheck. */
const LANGUAGE_SPEC: Record<
  VisualLanguage,
  { representation: number; tail: string[]; why: string }
> = {
  documentary: {
    representation: 0, // SOLID
    tail: ["parallax_layers", "ease_profile"],
    why: "shaded solid, given depth by parallax and eased motion — the object as a thing in a room",
  },
  technical: {
    representation: 2, // TECHNICAL
    tail: ["blend"],
    why: "wireframe with callouts derived from the geometry — the object as a specification",
  },
  pixel: {
    representation: 3, // PIXEL
    tail: ["pixelate", "dither"],
    why: "re-rendered at low resolution and quantised — the object as a game asset",
  },
  // Typography-led, for prose whose subjects are ideas rather than things.
  // An aphoristic essay of short declarative lines has nothing to depict
  // and everything to SET — the words are the image. Paired with a high
  // cut rhythm this is the register that suits an argument made in
  // fragments, and it is the one the palette always had and never used.
  kinetic: {
    representation: 0,
    tail: ["geometry_morph", "geometry_draw", "ease_profile"],
    why: "the words as the image — glyph geometry morphed and drawn, cut fast",
  },
  surreal: {
    representation: 4, // POINTS
    tail: ["ascii_render", "particle_seek", "particle_trail"],
    why: "decomposed to points and advected — the object coming apart into its own structure",
  },
};

export interface PlannedNode {
  primitiveId: string;
  params: Record<string, number | string>;
  /** Why this primitive is here, in the director's language. */
  reason: string;
}

export interface ChainError {
  at: number;
  from: string;
  to: string;
  message: string;
}

export interface Treatment {
  language: VisualLanguage;
  subject: string;
  nodes: PlannedNode[];
  /** The type signature of the chain, for display in the Compile view. */
  signature: string;
  valid: boolean;
  errors: ChainError[];
  rationale: string;
}

/** Walk a chain and confirm each link genuinely typechecks. Reports the
 *  exact seam that fails rather than a bare boolean, because "this chain is
 *  invalid" is useless to a director and "particle_flow wants a FIELD but
 *  image_to_points emits GEOMETRY" is actionable. */
export function validateChain(chain: string[]): { valid: boolean; errors: ChainError[] } {
  const errors: ChainError[] = [];
  for (let i = 0; i < chain.length; i++) {
    const id = chain[i] as string;
    if (!PRIMITIVES[id]) {
      errors.push({ at: i, from: id, to: "", message: `unknown primitive "${id}"` });
      continue;
    }
    if (i === 0) continue;
    const prev = chain[i - 1] as string;
    if (!PRIMITIVES[prev]) continue;
    if (!canChain(prev, id)) {
      const out = (PRIMITIVES[prev]?.outputs ?? []).join("|") || "nothing";
      const need = (PRIMITIVES[id]?.inputs ?? []).join("|") || "nothing";
      errors.push({
        at: i,
        from: prev,
        to: id,
        message: `${id} consumes ${need} but ${prev} emits ${out}`,
      });
    }
  }
  return { valid: errors.length === 0, errors };
}

/** The type signature of a chain, e.g. "— → ENTITY → IMAGE → IMAGE". */
export function chainSignature(chain: string[]): string {
  const parts: string[] = [];
  const first = PRIMITIVES[chain[0] as string];
  parts.push(first && first.inputs.length > 0 ? first.inputs.join("+") : "—");
  for (const id of chain) {
    const spec = PRIMITIVES[id];
    parts.push(spec ? (spec.outputs.join("+") as PrimitiveType | string) : "?");
  }
  return parts.join(" → ");
}

/** Plan one treatment. Pure and deterministic: same reading + same language
 *  always yields the same chain, so this can sit inside the cache-aware
 *  compile without ever spending a model call. */
export function planTreatment(reading: SemanticReading, language: VisualLanguage): Treatment {
  const spec = LANGUAGE_SPEC[language];

  // The shot is about the heaviest subject. Ties break on document order,
  // which keeps planning deterministic.
  const subject = [...reading.subjects].sort((a, b) => b.weight - a.weight)[0];

  // DOES THE SENTENCE HAVE ARITHMETIC IN IT?
  //
  // Two cases, and only two, hand the shot to the data family:
  //
  //   A named ROUTE always wins. "Ottawa → IRCC → hotels → housed" is a
  //   claim about form, and no body plan can depict a claim about form.
  //
  //   FIGURES win only when the heaviest subject is a concept — that is,
  //   when there is nothing concrete to depict anyway. A sentence with a
  //   real object in it and a number attached is still about the object;
  //   letting every stray year displace a depictable thing would turn an
  //   investigation into a slideshow of charts.
  const figures = reading.figures ?? [];
  const route = reading.route ?? [];
  const dataLed = route.length >= 2 || (figures.length > 0 && subject?.kind === "concept");

  const nodes: PlannedNode[] = [];

  if (dataLed) {
    nodes.push({
      primitiveId: "data_series",
      params: {
        series: serialiseFigures(figures),
        caption: (subject?.label ?? "figures").toUpperCase(),
        reveal: 1,
      },
      reason:
        route.length >= 2
          ? `the sentence routes a quantity through ${route.length} stages — the route is the shot`
          : `${figures.length} figure${figures.length === 1 ? "" : "s"} carried verbatim out of the prose`,
    });
    const chart = chartFor(figures, route.length >= 2);
    nodes.push({
      primitiveId: chart,
      params: route.length >= 2 ? { route: route.join(" → ") } : {},
      reason: `${chart} — chosen by what the figures are, not by a house style`,
    });
  } else {
    const bodyPlan = subject ? BODY_PLANS[subject.kind] : "glyph_to_points";
    nodes.push({
      primitiveId: bodyPlan,
      params: {
        representation: spec.representation,
        // `inspect` is the opportunity that wants a camera push; the others
        // hold back so the subject isn't crowded.
        push: reading.visualOpportunity === "inspect" ? 0.62 : 0.25,
        spin: reading.visualOpportunity === "inspect" ? 0.4 : 0.15,
      },
      reason: `${subject?.label ?? "subject"} realised as a ${bodyPlan} body plan`,
    });
  }

  // A body plan emits a domain type — ENTITY for a creature or a fixture,
  // ARTIFACT for a document. The compositing and raster families all speak
  // IMAGE, so a bridge is required. Inserted automatically rather than left
  // for an author to remember: forgetting it is exactly the failure the
  // type check catches, and it caught it twice before this table existed.
  const BRIDGES: Record<string, string> = {
    ENTITY: "entity_render",
    ARTIFACT: "artifact_render",
    // The round trip. A kinetic treatment wants to MORPH its subject, and
    // you cannot morph a raster — shape_morph consumes GEOMETRY. So a
    // concrete subject travels ENTITY → IMAGE → GEOMETRY to be treated
    // typographically. Without this the mirror, the aperture and the
    // stenographer all failed to typecheck in exactly the language they
    // most wanted.
    IMAGE: "image_to_points",
    // A place resolves to a FIELD, and a field is not geometry either.
    // particle_flow advects a field into points, which is the honest path
    // from "somewhere" to something a typographic treatment can morph.
    FIELD: "particle_flow",
    // A chart emits point geometry. The raster tails speak IMAGE, and
    // advecting a chart's own marks into trails is the honest way across:
    // the figures come apart into drift rather than being screenshotted.
    GEOMETRY: "particle_trail",
  };
  const emitted = PRIMITIVES[nodes[nodes.length - 1]?.primitiveId ?? ""]?.outputs ?? [];
  const bridge = emitted.map((t) => BRIDGES[t]).find(Boolean);
  // Only bridge eagerly if the tail cannot already consume what we have.
  // Without this guard the GEOMETRY bridge fires on a kinetic chart chain
  // and rasterises the very points the morph was going to interpolate.
  const tailHead = spec.tail[0];
  if (bridge && !(tailHead && canChain(nodes[nodes.length - 1]?.primitiveId ?? "", tailHead))) {
    nodes.push({
      primitiveId: bridge,
      params: {
        // A contested claim is lit a little colder and closer, which is a
        // treatment choice the reading earns rather than a random flourish.
        exposure: reading.contested ? 0.38 : 0.55,
        vignette: reading.contested ? 0.6 : 0.3,
      },
      reason: reading.contested
        ? "rasterised, held slightly under-exposed — the sentence reports a claim, not a fact"
        : "rasterised so raster and compositing primitives can consume it",
    });
  }

  // Keep bridging until the tail's opening primitive can legally consume
  // what the chain currently emits. Two hops at most — ENTITY → IMAGE →
  // GEOMETRY is the longest real path, and an unbounded loop here would
  // hide a missing bridge as a hang.
  const head = spec.tail[0];
  if (head) {
    for (let hop = 0; hop < 2; hop++) {
      const last = nodes[nodes.length - 1]?.primitiveId;
      if (!last || canChain(last, head)) break;
      const emits = PRIMITIVES[last]?.outputs ?? [];
      const next = emits.map((t) => BRIDGES[t]).find(Boolean);
      if (!next || next === last) break;
      nodes.push({
        primitiveId: next,
        params: {},
        reason: `bridged to ${PRIMITIVES[next]?.outputs.join("|")} so ${head} can consume it`,
      });
    }
  }

  // Apply the tail SELECTIVELY. A visual language is a preference, not an
  // obligation, and some heads genuinely end the picture chain: `counter`
  // emits ANIMATION, and nothing in the palette consumes ANIMATION except
  // the six motion-craft primitives, which return it unchanged. Appending
  // the documentary tail wholesale produced fifteen invalid chains on this
  // essay — every one of them a big verbatim figure that the type system
  // was right to refuse to parallax.
  //
  // So each tail primitive is appended only if it can legally consume what
  // the chain currently emits. What survives is the part of the language
  // that actually applies: an eased counter, rather than an eased counter
  // with a parallax error attached.
  const skipped: string[] = [];
  for (const id of spec.tail) {
    const last = nodes[nodes.length - 1]?.primitiveId ?? "";
    if (last && !canChain(last, id)) {
      skipped.push(id);
      continue;
    }
    nodes.push({ primitiveId: id, params: {}, reason: spec.why });
  }

  const chain = nodes.map((n) => n.primitiveId);
  const { valid, errors } = validateChain(chain);

  return {
    language,
    subject: subject?.label ?? "unknown",
    nodes,
    signature: chainSignature(chain),
    valid,
    errors,
    // Say what the language could NOT reach. A silently truncated tail
    // would leave a director wondering why one shot looks unstyled.
    rationale: [
      `${reading.visualOpportunity} · ${spec.why}`,
      reading.contested ? "claim, not fact" : "",
      skipped.length > 0
        ? `${skipped.join(", ")} skipped — ${nodes[nodes.length - 1]?.primitiveId} ends the picture chain`
        : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Plan every visual language from ONE reading. The point of the exercise:
 *  same meaning, same subject, same narrative function — four different
 *  visual ontologies, each independently type-checked. */
export function planAllTreatments(reading: SemanticReading): Treatment[] {
  return VISUAL_LANGUAGES.map((l) => planTreatment(reading, l));
}

/** The reading for the worked example, hand-authored to stand in for the
 *  frozen LLM artifact. Kept here so the vertical slice is testable before
 *  the segmentation call exists. */
export const SMOKE_DETECTOR_READING: SemanticReading = {
  sentence: "He claimed the smoke detector was mounted on the ceiling.",
  subjects: [
    { label: "smoke detector", kind: "object", weight: 0.9 },
    { label: "ceiling", kind: "place", weight: 0.3 },
    { label: "he", kind: "person", weight: 0.2 },
  ],
  visualOpportunity: "inspect",
  contested: true,
};
