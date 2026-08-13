// CHECK-PAYLOAD-CONTRACTS — does a primitive emit what it declares?
//
// The registry records an output TYPE for every primitive. This runs each
// one standalone and compares that declaration to the payload it actually
// returns. The gap is large and it is the single most consequential fact
// about the palette:
//
//   42 of 129 declare GEOMETRY / FIELD / DATA / ENTITY / ARTIFACT and
//   return nothing but pixels.
//
// Which means a chain can type-check completely and the downstream node
// receives NOTHING — it falls back to its own synthetic default, and the
// film renders something plausible that no part of the compiler chose.
// `tile` returning the palette's stock "90 DAYS" was this. So was
// `geometry_draw: no upstream GEOMETRY` on a chain the type checker had
// already approved.
//
// This is the input-side discipline (`consumesUpstream`, detected
// mechanically from frame() arity) applied to the output side. It belongs
// in the generator eventually, so a declaration can never drift from
// behaviour again. Until then it is a check you can run.
//
//   PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node packages/studio/scripts/check-payload-contracts.mjs

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
const LAB = "/home/user/canopticon/packages/studio/lab";
const S = [
  "primitives.js",
  "prims-a.js",
  "prims-b.js",
  "prims-c.js",
  "prims-d.js",
  "prims-e.js",
  "prims-f.js",
  "prims-g.js",
  "prims-h.js",
  "prims-i.js",
  "prims-j.js",
  "chain.js",
];
fs.writeFileSync(
  path.join(LAB, "__c.html"),
  `<!doctype html><meta charset=utf-8><body>${S.map((s) => `<script src="${s}"></script>`).join("")}</body>`,
);
const b = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const p = await b.newPage();
p.on("pageerror", (_e) => {});
await p.goto(pathToFileURL(path.join(LAB, "__c.html")).href);
const res = await p.evaluate(() => {
  const out = [];
  const W = 240;
  const H = 140;
  for (const [id, def] of Object.entries(window.PRIMS)) {
    const declared = (def.io || "")
      .split("→")
      .pop()
      .trim()
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    const params = { seed: 11 };
    for (const k in def.params) {
      const s = def.params[k];
      params[k] = s.s !== undefined ? s.s : s.v;
    }
    let inst;
    try {
      inst = def.make(params);
    } catch (e) {
      out.push({ id, declared, emits: [], err: `make: ${e.message}` });
      continue;
    }
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const cx = c.getContext("2d");
    let r = null;
    let err = null;
    try {
      for (let f = 0; f < 6; f++) r = inst.frame(cx, W, H, f / 24, null, null, 3);
    } catch (e) {
      err = e.message;
    }
    const emits = [];
    if (r?.geometry) emits.push("GEOMETRY");
    if (r?.field) emits.push("FIELD");
    if (r?.data) emits.push("DATA");
    if (r?.entity) emits.push("ENTITY");
    if (r?.artifact) emits.push("ARTIFACT");
    out.push({ id, declared, emits, err });
  }
  return out;
});
await b.close();
fs.unlinkSync(path.join(LAB, "__c.html"));
const PAYLOAD = new Set(["GEOMETRY", "FIELD", "DATA", "ENTITY", "ARTIFACT"]);
let honest = 0;
let nominal = 0;
let threw = 0;
const bad = [];
for (const r of res) {
  if (r.err) {
    threw++;
  }
  const want = r.declared.filter((t) => PAYLOAD.has(t));
  if (want.length === 0) {
    honest++;
    continue;
  }
  const got = want.every((t) => r.emits.includes(t));
  if (got) honest++;
  else {
    nominal++;
    bad.push(
      `${r.id.padEnd(22)} declares ${want.join("|").padEnd(9)} emits ${r.emits.join("|") || "— (pixels only)"}`,
    );
  }
}
console.log(`PRIMITIVES: ${res.length}`);
console.log(`  declared payload type actually emitted : ${honest}`);
console.log(
  `  declared a payload and emits NONE      : ${nominal}   ← type is nominal, not structural`,
);
console.log(`  threw when run standalone              : ${threw}`);
console.log("\nNOMINAL-ONLY (a chain consuming these type-checks and gets nothing):");
for (const l of bad) console.log(`  ${l}`);
