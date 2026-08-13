// Regenerates packages/studio/src/primitives/registry.ts from the Lab.
//
// The Lab (design/app) is where primitives actually paint. This script
// loads it in a real browser, reads the live `PRIMS` registry the
// primitives registered themselves into, and emits the compiler's typed
// view of the same palette — so the compiler can never believe in a
// primitive that doesn't exist, or miss one that does.
//
// Run manually when the palette changes:
//   node scripts/gen-primitive-registry.mjs <path-to-lab-app-dir>
//
// Requires playwright and a Chromium build. Deliberately NOT wired into
// CI: the generated file is committed, and regenerating it is a decision
// (the palette changed) rather than a build step.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Playwright is a dev-machine tool, not a repo dependency — this script is
// run by hand when the palette changes, not by CI. Resolve it from the
// project if it's installed there, otherwise from wherever the environment
// says (a global install won't resolve from a bare ESM specifier):
//   PLAYWRIGHT_MODULE=/usr/lib/node_modules/playwright node scripts/...
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  const fallback = process.env.PLAYWRIGHT_MODULE;
  if (!fallback) {
    console.error(
      "playwright not resolvable. Install it, or set PLAYWRIGHT_MODULE to the path of a global install.",
    );
    process.exit(1);
  }
  // A global install resolves to playwright's CommonJS entry, whose exports
  // land on `.default` under ESM interop rather than as named exports.
  const mod = await import(fallback);
  chromium = mod.chromium ?? mod.default?.chromium;
  if (!chromium) {
    console.error(`PLAYWRIGHT_MODULE=${fallback} did not export chromium.`);
    process.exit(1);
  }
}

const TYPES = new Set([
  "FIELD",
  "GEOMETRY",
  "IMAGE",
  "MASK",
  "DATA",
  "AUDIO",
  "ANIMATION",
  "ARTIFACT",
  // A procedural SUBJECT — a creature, machine, or crowd generated from a
  // body plan rather than painted as a texture. Distinct from GEOMETRY
  // because an entity carries behaviour and gait, not just points.
  "ENTITY",
]);

// Shader and 3D output depends on GPU behaviour, so they can only honestly
// promise pixel-identity on the same GPU model.
const GPU_FAMILIES = ["K · SHADER", "L · 3D"];

// Per-family fallback cost, used where the Lab has not measured one yet.
// These are estimates and are labelled as such in the Lab.
const FAMILY_COST = {
  "A · TYPOGRAPHIC": 3,
  "B · VECTOR": 4,
  "C · GENERATIVE": 7,
  "D · PARTICLE": 12,
  "E · PHYSICS": 8,
  "F · DATA": 5,
  "G · NETWORK": 9,
  "H · TIMELINE": 4,
  "I · DOCUMENTS": 3,
  "J · RASTER": 6,
  "K · SHADER": 11,
  "L · 3D": 13,
  "M · COMPOSITING": 3,
  "N · AUDIO": 2,
  "O · MOTION CRAFT": 1,
  "P · INTERFACE": 4,
  "Q · CUT GRAMMAR": 2,
  "R · MAPS": 8,
  // Entities carry geometry + gait + behaviour, so they cost more than a
  // texture but far less than a video model.
  "S · ENTITY": 10,
};

const appDir = process.argv[2];
if (!appDir) {
  console.error("usage: node scripts/gen-primitive-registry.mjs <path-to-lab-app-dir>");
  process.exit(1);
}

// An environment with a pre-installed Chromium (the remote sandbox has one
// at /opt/pw-browsers) will not match the build number whichever playwright
// version happens to be installed expects. Point at it rather than
// downloading a second copy:
//   PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const page = await browser.newPage();
await page.goto(`file://${resolve(appDir, "index.html")}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);

const { reg, cost } = await page.evaluate(() => {
  const out = {};
  for (const id of Object.keys(PRIMS)) {
    const d = PRIMS[id];
    const params = {};
    for (const k in d.params) {
      const s = d.params[k];
      params[k] =
        s.s !== undefined
          ? { kind: "string", default: s.s }
          : { kind: s.int ? "int" : "float", default: s.v, min: s.lo, max: s.hi };
    }
    // DOES IT ACTUALLY READ ITS UPSTREAM?
    //
    // Declaring an input type is a promise; reading the fifth argument of
    // frame() is keeping it. The two came apart twice — `entity_render`
    // synthesised a gradient and ignored what it was handed, and the whole
    // motion-craft family painted an easing diagram over the shot — and
    // both times the chain typechecked. Determined here by instantiating
    // the primitive and reading frame's arity, which is mechanical and
    // cannot drift from the truth the way a hand-maintained flag would.
    let consumesUpstream = false;
    let secondInput = null;
    try {
      const probe = { seed: 1337 };
      for (const k in d.params) {
        const sp = d.params[k];
        probe[k] = sp.s !== undefined ? sp.s : sp.v;
      }
      const inst = d.make(probe);
      // Two honest ways to consume: read the upstream buffer in frame(), or
      // expose warp() and re-time what came before. Motion craft does the
      // second — an ease cannot be applied to an already-rendered frame —
      // and counting only the first flagged all six as fakes.
      consumesUpstream =
        (typeof inst.frame === "function" && inst.frame.length >= 5) ||
        typeof inst.warp === "function";
      // A SECOND INPUT.
      //
      // An io string has one arrow, so a two-input primitive cannot
      // declare its B side there. It declares it on the instance instead —
      // the precedent motion craft set with `warp` — and the value names
      // the TYPE that side consumes. "IMAGE" means pixels, which every
      // primitive produces, so it is recorded and deliberately not
      // enforced; anything else is a real constraint the compiler checks.
      secondInput = typeof inst.two === "string" ? inst.two : null;
    } catch {
      consumesUpstream = false;
    }
    out[id] = {
      id,
      family: d.family,
      io: d.io,
      params,
      note: d.note || "",
      consumesUpstream,
      secondInput,
    };
  }
  return { reg: out, cost: typeof COST !== "undefined" ? COST : {} };
});
await browser.close();

function parseIO(io) {
  const [lhs, rhs] = io.split("→").map((s) => s.trim());
  return {
    inputs:
      lhs === "—"
        ? []
        : lhs
            .split("+")
            .map((s) => s.trim())
            .filter((t) => TYPES.has(t)),
    outputs: rhs
      .split("+")
      .map((s) => s.trim())
      .filter((t) => TYPES.has(t)),
  };
}

const ids = Object.keys(reg).sort();
const families = [...new Set(ids.map((i) => reg[i].family))].sort();

const entries = ids
  .map((id) => {
    const r = reg[id];
    const { inputs, outputs } = parseIO(r.io);
    const det = GPU_FAMILIES.includes(r.family) ? "L2-GPU" : "L2";
    const c = cost[id] ?? FAMILY_COST[r.family] ?? 4;
    const params = Object.entries(r.params)
      .map(([k, v]) =>
        v.kind === "string"
          ? `      ${JSON.stringify(k)}: { kind: "string", default: ${JSON.stringify(v.default)} },`
          : `      ${JSON.stringify(k)}: { kind: "${v.kind}", default: ${v.default}, min: ${v.min}, max: ${v.max} },`,
      )
      .join("\n");
    const second = r.secondInput ? `\n    secondInput: ${JSON.stringify(r.secondInput)},` : "";
    return `  ${JSON.stringify(id)}: {
    primitiveId: ${JSON.stringify(id)},
    family: ${JSON.stringify(r.family)},
    inputs: [${inputs.map((t) => `"${t}"`).join(", ")}],
    outputs: [${outputs.map((t) => `"${t}"`).join(", ")}],
    parameters: {
${params}
    },
    estimatedCostMsPerFrame: ${c},
    determinismGuarantee: ${JSON.stringify(det)},
    consumesUpstream: ${r.consumesUpstream ? "true" : "false"},${second}
    note: ${JSON.stringify(r.note)},
  },`;
  })
  .join("\n");

writeFileSync(
  resolve("packages/studio/src/primitives/registry.ts"),
  `// GENERATED by scripts/gen-primitive-registry.mjs — do not hand-edit.
// ${ids.length} primitives across ${families.length} families, read from the Lab's own registry.
// See that script for how determinism and cost are assigned.

export type PrimitiveType =
  | "FIELD"
  | "GEOMETRY"
  | "IMAGE"
  | "MASK"
  | "DATA"
  | "AUDIO"
  | "ANIMATION"
  | "ARTIFACT"
  | "ENTITY";

export type Determinism = "L1" | "L2" | "L2-GPU";

export interface ParameterSpec {
  kind: "int" | "float" | "string";
  default: number | string;
  min?: number;
  max?: number;
}

export interface PrimitiveSpec {
  primitiveId: string;
  family: string;
  inputs: PrimitiveType[];
  outputs: PrimitiveType[];
  parameters: Record<string, ParameterSpec>;
  estimatedCostMsPerFrame: number;
  determinismGuarantee: Determinism;
  /** True when the primitive actually READS its upstream buffer rather than
   *  clearing the frame and drawing its own thing. Detected mechanically at
   *  generation time from frame()'s arity, not declared by hand.
   *
   *  This is the difference between a chain and a stack. A source composes
   *  with anything and overwrites what came before it, so a chain of three
   *  sources renders as its last element and the first two cost time for
   *  nothing. chainOverwrites() reports where that happens. */
  consumesUpstream: boolean;
  /** The TYPE this primitive takes on a SECOND input, when it takes one.
   *
   *  An io string has one arrow, so a two-input primitive cannot declare
   *  its B side there — it declares it on its instance, and this is read
   *  off that at generation time.
   *
   *  "IMAGE" means pixels. Every primitive produces pixels, so an IMAGE
   *  second input is recorded and deliberately NOT enforced; saying a
   *  branch must emit IMAGE when everything does would be theatre.
   *  Anything else is a real structural requirement — field_displace
   *  reads a field's numbers, so a branch that only paints a picture of a
   *  field is refused rather than silently doing nothing. */
  secondInput?: PrimitiveType;
  note: string;
}

/** Stages a chain will paint over. Every stage after the LAST source is
 *  visible; everything before it is overwritten and its cost is wasted.
 *
 *  Reported rather than forbidden. A stack of sources is sometimes what a
 *  director wants — a recipe reaching for one look — but it should be a
 *  choice, not a thing the system does silently while presenting a
 *  three-primitive chain as though all three were on screen. */
export function chainOverwrites(chain: string[]): { at: number; id: string; by: string }[] {
  const out: { at: number; id: string; by: string }[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const later = chain
      .slice(i + 1)
      .findIndex((id) => PRIMITIVES[id] && !PRIMITIVES[id].consumesUpstream);
    if (later < 0) continue;
    const by = chain[i + 1 + later] as string;
    out.push({ at: i, id: chain[i] as string, by });
  }
  return out;
}

export const PRIMITIVES: Record<string, PrimitiveSpec> = {
${entries}
};

export const PRIMITIVE_IDS: string[] = Object.keys(PRIMITIVES);

export const FAMILIES: string[] = ${JSON.stringify(families, null, 2)};

/** Determinism propagates as the WEAKEST link in a chain (Atlas 7.1.3). */
export function chainDeterminism(chain: string[]): Determinism {
  let level: Determinism = "L1";
  for (const id of chain) {
    const spec = PRIMITIVES[id];
    if (!spec) continue;
    if (spec.determinismGuarantee === "L2-GPU") return "L2-GPU";
    if (spec.determinismGuarantee === "L2") level = "L2";
  }
  return level;
}

/** Summed per-frame cost, used to refuse chains that blow the budget. */
export function chainCost(chain: string[]): number {
  return chain.reduce((sum, id) => sum + (PRIMITIVES[id]?.estimatedCostMsPerFrame ?? 0), 0);
}

/** Whether \`producer\` emits something \`consumer\` accepts. */
export function canChain(producerId: string, consumerId: string): boolean {
  const producer = PRIMITIVES[producerId];
  const consumer = PRIMITIVES[consumerId];
  if (!producer || !consumer) return false;
  if (consumer.inputs.length === 0) return true;
  // A COMPOSITOR TAKES PIXELS.
  //
  // Its first input is the previous stage's canvas, and every primitive in
  // this palette paints one — a declared output type describes the extra
  // TYPED payload a primitive emits (GEOMETRY, FIELD, DATA), not whether
  // it drew anything. So a two-input compositor composes after anything,
  // which is what "layer" means.
  //
  // Stated as an exception in exactly one place rather than by giving all
  // primitives an IMAGE output, because that second reading would also
  // make image_to_points accept a DATA source and the type system would
  // stop catching the things it currently catches.
  if (consumer.secondInput) return true;
  return consumer.inputs.some((t) => producer.outputs.includes(t));
}
`,
);

console.log(`wrote ${ids.length} primitives across ${families.length} families`);
