// DIRECT GRAPH SYNTHESIS — an experiment, deliberately built beside the
// compiler rather than inside it.
//
// THE QUESTION IT EXISTS TO ANSWER.
//
// The visual-language layer produced six materially different films from
// one paragraph, which was the thing to prove. It did not prove that the
// generation architecture is open-ended, and an audit says it is not:
//
//   TYPOGRAPHIC   always glyph_geometry + text_layout + variable_axis
//   DIAGRAMMATIC  always data_series + force_layout + graph_reveal
//   COMPUTATIONAL always wireframe + camera_3d + ui_surface + pixelate
//
//   3–4 distinct primitive sets across 5 very different sentences.
//   42 of 129 primitives reachable across ALL six languages combined.
//   8 of 20 families never touched by any of them.
//
// So the funnel moved up one level. `8 constructions + 12 operators`
// became `7 grammars`, which are richer recipes with a couple of slots.
// Better, and the same shape of limit.
//
// WHAT THIS DOES INSTEAD.
//
//   SEMANTIC MODEL  +  VISUAL LANGUAGE  +  PRIMITIVE REGISTRY
//                            ↓
//                    GRAPH SYNTHESIS          ← no construction is chosen
//                            ↓                ← no operator stack is chosen
//                       TYPE CHECK
//                            ↓
//                         RENDER
//
// A language here is NOT a chain. It is a set of CONSTRAINTS and BIASES:
// which families it reaches for, which it refuses outright, how much
// raster it will tolerate, how big a graph it wants. The synthesizer
// grows type-valid graphs out of the registry under those constraints and
// binds their parameters to whatever the sentence actually offers.
//
// It may well rediscover something that looks like an existing recipe.
// That is a good outcome, and the direction of dependency is the point:
//
//   primitive graph  →  (optionally) a reusable macro
//   rather than
//   recipe           →  limited access to primitives
//
// NOTHING HERE IS WIRED INTO THE COMPILER. The Language Lab is the
// control and is untouched.

import type { SignificantWord } from "../src/compile/words.ts";
import { PRIMITIVES, type PrimitiveSpec } from "../src/primitives/registry.ts";

/* ── WHAT THE SENTENCE OFFERS ────────────────────────────────────────
 *
 * Not "what to build" — what MATERIAL exists. The synthesizer binds
 * these into whatever graph it grows; a graph that binds more of them
 * corresponds more closely to the sentence, which is a thing that can be
 * scored rather than asserted. */
export interface SemanticModel {
  sentence: string;
  words: SignificantWord[];
  /** `text@kind|…`, the compiler's own figure format. Empty when the
   *  prose printed no numbers — and then nothing may invent any. */
  series: string;
  /** A count the prose printed, or null. */
  count: number | null;
  place: string | null;
  subject: string | null;
  relation: { from: string; to: string; action: string } | null;
}

/* ── WHAT A LANGUAGE IS, IN THIS EXPERIMENT ──────────────────────────
 *
 * Constraints and appetites. No chain, no primitive named, no order
 * prescribed. A language cannot express "use force_layout" — only "I am
 * drawn to the NETWORK and DATA families and I will not tolerate
 * raster". Everything else is the synthesizer's problem. */
export interface LanguageConstraint {
  id: string;
  /** Appetite per family suffix ("VECTOR", "DATA"…), −1 … 1. Absent is 0. */
  appetite: Record<string, number>;
  /** Families this language refuses outright, whatever the appetite. */
  forbid: string[];
  /** How many raster/shader stages it will accept in one graph. */
  rasterBudget: number;
  /** Node count it is aiming for, inclusive. */
  size: [number, number];
  /** Does it want the sentence's words visibly bound into the graph? */
  wantsText: boolean;
}

export interface SynthNode {
  primitiveId: string;
  params: Record<string, number | string>;
  /** A compositor's second input — its own subgraph. This is why the
   *  result is a GRAPH and not a chain: the branch is the structure. */
  ground?: SynthNode[];
}

export interface Program {
  nodes: SynthNode[];
  /** Every primitive in the graph, at any depth. */
  flat: string[];
  families: string[];
  /** How many of the sentence's offered materials the graph actually
   *  bound. The nearest thing to "does this program correspond to the
   *  sentence" that can be measured rather than claimed. */
  bound: string[];
  rasterStages: number;
  depth: number;
  score: number;
}

const FAM = (id: string) => (PRIMITIVES[id]?.family ?? "? · ?").split(" · ")[1] ?? "?";
const RASTER = new Set(["RASTER", "SHADER"]);
const ALL = Object.values(PRIMITIVES);

/** Seeded, because standing rule 4 holds in an experiment too. */
function rng(seed: number) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    return ((s ^ (s >>> 14)) >>> 0) / 0xffffffff;
  };
}

/** A primitive's parameters, filled from the registry's own declared
 *  ranges and — where the parameter is a STRING — from the sentence.
 *
 *  This is where semantic correspondence actually happens, and it is
 *  entirely driven by what the primitive DECLARES rather than by a table
 *  of which primitives deserve text. A primitive that takes a `text` gets
 *  the sentence's strongest available word; one that takes a `series`
 *  gets the figures, and only if the prose printed any. */
function bindParams(
  spec: PrimitiveSpec,
  model: SemanticModel,
  rand: () => number,
  bound: Set<string>,
): Record<string, number | string> | null {
  const out: Record<string, number | string> = {};
  const words = model.words.filter((w) => w.weight >= 0.3);
  for (const [key, p] of Object.entries(spec.parameters)) {
    if (p.kind === "string") {
      if (key === "series") {
        // THE FIGURE FIREWALL. A series primitive is only legal when the
        // prose printed numbers; otherwise this whole graph is refused
        // rather than fed an invented measurement.
        if (!model.series) return null;
        out[key] = model.series;
        bound.add("figures");
      } else if (key === "route") {
        if (!model.relation) return null;
        out[key] = `${model.relation.from.toUpperCase()} → ${model.relation.to.toUpperCase()}`;
        bound.add("relation");
      } else if (key === "from" || key === "to") {
        if (!model.relation) return null;
        out[key] = (key === "from" ? model.relation.from : model.relation.to).toUpperCase();
        bound.add("relation");
      } else {
        const pick = words[Math.floor(rand() * Math.max(1, words.length))] ?? words[0];
        if (!pick) return null;
        out[key] = pick.text;
        bound.add(`word:${pick.text}`);
      }
      continue;
    }
    const lo = p.min ?? 0;
    const hi = p.max ?? 1;
    // A COUNT THE PROSE PRINTED BEATS A RANDOM ONE. Any parameter that
    // plainly means "how many" takes the sentence's own number, scaled
    // into the primitive's declared range.
    if (model.count !== null && /count|nodes|cells|items|points|layers|subdiv|cols/.test(key)) {
      const t = Math.max(0, Math.min(1, model.count / 120));
      out[key] = p.kind === "int" ? Math.round(lo + t * (hi - lo)) : lo + t * (hi - lo);
      bound.add("count");
      continue;
    }
    // THE MIDDLE OF THE DECLARED RANGE, not the whole of it.
    //
    // A synthesized program hit `IndexSizeError: arc radius -0.808`: the
    // registry declares a parameter's range, and some primitives cannot
    // actually survive their own declared extremes — nobody had ever set
    // two of them to the ends at once, because until now nothing chose
    // parameters except hand-written recipes.
    //
    // That is a real finding about the palette and it is recorded rather
    // than papered over. For the experiment the synthesizer explores the
    // middle 70%, which is conservative and honest: it means coverage
    // numbers below are a FLOOR, not a ceiling.
    const t = 0.15 + rand() * 0.7;
    const v = lo + t * (hi - lo);
    out[key] = p.kind === "int" ? Math.round(v) : Math.round(v * 1000) / 1000;
  }
  return out;
}

/** Can this primitive be appended after a payload of these types? */
function accepts(spec: PrimitiveSpec, have: string[]): boolean {
  if (spec.inputs.length === 0) return false;
  return spec.inputs.every((t) => have.includes(t));
}

interface GrowOpts {
  model: SemanticModel;
  lang: LanguageConstraint;
  rand: () => number;
  budget: number;
  depth: number;
}

/** Grow one type-valid graph forward from a source.
 *
 *  No construction is selected. No operator stack is selected. The only
 *  things consulted are the registry's declared types, the language's
 *  appetites, and what the sentence offers. */
function grow(o: GrowOpts, bound: Set<string>): SynthNode[] | null {
  const { lang, rand } = o;
  const legal = (s: PrimitiveSpec) =>
    !lang.forbid.includes(FAM(s.primitiveId)) && (lang.appetite[FAM(s.primitiveId)] ?? 0) > -0.9;

  // WEIGHTED BY APPETITE, not filtered by a list. A language biased
  // toward VECTOR still MAY reach a particle system; it is simply less
  // likely to, which is what makes these languages rather than menus.
  const pickFrom = (pool: PrimitiveSpec[]): PrimitiveSpec | null => {
    const scored = pool.map((s) => ({
      s,
      w: Math.exp((lang.appetite[FAM(s.primitiveId)] ?? 0) * 2.2),
    }));
    const total = scored.reduce((n, x) => n + x.w, 0);
    if (total <= 0) return null;
    let r = rand() * total;
    for (const x of scored) {
      r -= x.w;
      if (r <= 0) return x.s;
    }
    return scored[scored.length - 1]?.s ?? null;
  };

  const sources = ALL.filter((s) => s.inputs.length === 0 && legal(s));
  const first = pickFrom(sources);
  if (!first) return null;
  const p0 = bindParams(first, o.model, rand, bound);
  if (!p0) return null;

  const nodes: SynthNode[] = [{ primitiveId: first.primitiveId, params: p0 }];
  let have = [...first.outputs];
  let raster = RASTER.has(FAM(first.primitiveId)) ? 1 : 0;

  const target = lang.size[0] + Math.floor(rand() * (lang.size[1] - lang.size[0] + 1));
  for (let i = 1; i < target && i < o.budget; i++) {
    const pool = ALL.filter((s) => {
      if (!legal(s) || !accepts(s, have)) return false;
      if (RASTER.has(FAM(s.primitiveId)) && raster >= lang.rasterBudget) return false;
      // Do not repeat a primitive already in this graph — repetition is a
      // director's decision, not a search artifact.
      if (nodes.some((x) => x.primitiveId === s.primitiveId)) return false;
      return true;
    });
    if (pool.length === 0) break;
    const next = pickFrom(pool);
    if (!next) break;
    const params = bindParams(next, o.model, rand, bound);
    if (!params) continue;

    const node: SynthNode = { primitiveId: next.primitiveId, params };

    // A SECOND INPUT IS A SUBGRAPH, and this is the part a chain model
    // cannot express. When the registry says a primitive takes a second
    // input, one is SYNTHESIZED for it — a whole independent graph, grown
    // under the same constraints — and type-checked against what the
    // compositor declares it needs.
    if (next.secondInput && o.depth > 0) {
      const branch = grow(
        { ...o, depth: o.depth - 1, budget: Math.max(2, o.budget - i - 1) },
        bound,
      );
      if (!branch) continue;
      const tail = branch[branch.length - 1];
      const gives = tail ? (PRIMITIVES[tail.primitiveId]?.outputs ?? []) : [];
      // IMAGE means pixels and everything paints pixels, so an IMAGE
      // second input is unconstrained. FIELD is real: a field compositor
      // reads numbers, and a branch that only paints a picture of a field
      // would composite nothing while looking like it worked.
      if (next.secondInput !== "IMAGE" && !gives.includes(next.secondInput)) continue;
      node.ground = branch;
    }

    nodes.push(node);
    if (RASTER.has(FAM(next.primitiveId))) raster++;
    have = [...next.outputs];
  }
  return nodes.length >= lang.size[0] ? nodes : null;
}

function flatten(nodes: SynthNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    out.push(n.primitiveId);
    if (n.ground) out.push(...flatten(n.ground));
  }
  return out;
}
function graphDepth(nodes: SynthNode[]): number {
  return 1 + Math.max(0, ...nodes.map((n) => (n.ground ? graphDepth(n.ground) : 0)));
}

/** Synthesize N distinct legal programs for one sentence in one language. */
export function synthesize(
  model: SemanticModel,
  lang: LanguageConstraint,
  n: number,
  seed = 1,
): Program[] {
  const seen = new Set<string>();
  const out: Program[] = [];
  // Tries are bounded rather than open — a search that cannot find N
  // distinct programs should say so by returning fewer.
  for (let attempt = 0; attempt < n * 60 && out.length < n; attempt++) {
    const rand = rng(seed * 7919 + attempt);
    const bound = new Set<string>();
    const nodes = grow({ model, lang, rand, budget: 9, depth: 2 }, bound);
    if (!nodes) continue;
    const flat = flatten(nodes);
    const key = flat.join(">");
    if (seen.has(key)) continue;
    seen.add(key);
    const families = [...new Set(flat.map(FAM))];
    const rasterStages = flat.filter((p) => RASTER.has(FAM(p))).length;
    out.push({
      nodes,
      flat,
      families,
      bound: [...bound],
      rasterStages,
      depth: graphDepth(nodes),
      score:
        bound.size * 2 +
        families.length +
        flat.reduce((s, p) => s + (lang.appetite[FAM(p)] ?? 0), 0) -
        rasterStages * 0.5,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ── THE SAME SEVEN LANGUAGES, EXPRESSED AS CONSTRAINTS ──────────────
 *
 * Compare these to `language.ts`. There, a language IS its chains. Here
 * a language cannot name a primitive at all — it can only say what it is
 * drawn to and what it refuses. Whether that is enough to produce
 * recognisably different films is the experiment. */
export const CONSTRAINTS: Record<string, LanguageConstraint> = {
  TYPOGRAPHIC: {
    id: "TYPOGRAPHIC",
    appetite: {
      TYPOGRAPHIC: 1.4,
      VECTOR: 0.5,
      "CUT GRAMMAR": 0.5,
      COMPOSITING: 0.2,
      PARTICLE: 0.1,
    },
    forbid: ["MAPS", "AUDIO", "TIMELINE"],
    rasterBudget: 1,
    size: [2, 4],
    wantsText: true,
  },
  GEOMETRIC: {
    id: "GEOMETRIC",
    appetite: {
      VECTOR: 1.5,
      GENERATIVE: 0.8,
      PARTICLE: 0.5,
      PHYSICS: 0.4,
      COMPOSITING: 0.3,
      TYPOGRAPHIC: 0.2,
    },
    // The defining refusal, and the only place in this file where a
    // language says "never".
    forbid: ["RASTER", "SHADER", "DOCUMENTS", "AUDIO", "MAPS", "INTERFACE"],
    rasterBudget: 0,
    size: [3, 5],
    wantsText: false,
  },
  DIAGRAMMATIC: {
    id: "DIAGRAMMATIC",
    appetite: { DATA: 1.4, NETWORK: 1.3, TIMELINE: 0.7, MAPS: 0.5, VECTOR: 0.3, PARTICLE: 0.2 },
    forbid: ["AUDIO", "ENTITY"],
    rasterBudget: 1,
    size: [3, 5],
    wantsText: false,
  },
  COMPUTATIONAL: {
    id: "COMPUTATIONAL",
    appetite: { "3D": 1.4, INTERFACE: 1.1, PARTICLE: 0.7, RASTER: 0.6, DATA: 0.5, PHYSICS: 0.4 },
    forbid: ["DOCUMENTS", "AUDIO"],
    rasterBudget: 2,
    size: [3, 6],
    wantsText: false,
  },
  MATERIAL: {
    id: "MATERIAL",
    appetite: {
      DOCUMENTS: 1.4,
      RASTER: 0.9,
      MATERIAL: 0.9,
      TYPOGRAPHIC: 0.5,
      ENTITY: 0.4,
      DATA: 0.3,
    },
    forbid: ["AUDIO", "3D", "INTERFACE"],
    rasterBudget: 3,
    size: [3, 5],
    wantsText: true,
  },
  SIGNAL: {
    id: "SIGNAL",
    appetite: {
      GENERATIVE: 1.3,
      PARTICLE: 1.1,
      SHADER: 0.9,
      PHYSICS: 0.7,
      RASTER: 0.6,
      COMPOSITING: 0.5,
    },
    forbid: ["DOCUMENTS", "AUDIO", "TIMELINE", "MAPS"],
    rasterBudget: 3,
    size: [3, 6],
    wantsText: false,
  },
};
