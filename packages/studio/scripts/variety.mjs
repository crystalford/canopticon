// VARIETY — measure whether the engine is a generator or a template.
//
// This number is the one that was missing. A green test suite says every word
// on screen is the essay's own and the same seed makes the same film; it says
// nothing at all about whether the film repeats itself, and the engine spent
// weeks producing one look while every test passed.
//
// So: build a cut, give every beat a SIGNATURE — the world it is in, the
// spatial structure, the set of treatments actually used, the angles and
// scales in play, the register and the transition — and report how many
// distinct ones there are, how long the longest identical run is, and how soon
// a signature comes back.
//
// A template scores a handful of signatures and long runs. A generator scores
// hundreds and comes back rarely.

import fs from "node:fs";
import { buildStages, resolveAt } from "../lab/comp/compose.js";

const [cutPath] = process.argv.slice(2);
if (!cutPath) {
  console.error("usage: variety.mjs <cut.json>");
  process.exit(1);
}
const cut = JSON.parse(fs.readFileSync(cutPath, "utf8"));
const built = buildStages(cut);

const bucket = (n, step) => Math.round(n / step) * step;

const signatures = [];
for (const [i, s] of built.stages.entries()) {
  const beat = cut.beats[i];
  const at = resolveAt(built.stages, (beat.startMs + beat.endMs) / 2);
  const live = at ? at.units : [];
  const treatments = [...new Set(live.map((u) => u.treatment))].sort().join("+") || "-";
  const angles = [...new Set(live.map((u) => bucket(u.rot, 15)))].sort((a, b) => a - b).join(",");
  const scales = [...new Set(live.map((u) => bucket(u.size, 0.05)))]
    .sort((a, b) => a - b)
    .join(",");
  signatures.push(
    [s.world, s.layout, treatments, angles, scales, s.stage.regName ?? "-", s.entry].join("|"),
  );
}

const distinct = new Set(signatures);

let longestRun = 1;
let run = 1;
for (let i = 1; i < signatures.length; i++) {
  run = signatures[i] === signatures[i - 1] ? run + 1 : 1;
  if (run > longestRun) longestRun = run;
}

// How many beats before a signature is seen again. The number that says
// "template" out loud: if it is small, the film is cycling.
const lastSeen = new Map();
const gaps = [];
for (const [i, sig] of signatures.entries()) {
  if (lastSeen.has(sig)) gaps.push(i - lastSeen.get(sig));
  lastSeen.set(sig, i);
}
const meanGap =
  gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : Number.POSITIVE_INFINITY;
const minGap = gaps.length > 0 ? Math.min(...gaps) : Number.POSITIVE_INFINITY;

const worlds = new Set(built.stages.map((s) => s.world));
const layouts = new Set(built.stages.map((s) => s.layout));
const treatments = new Set();
for (const s of built.stages)
  for (const u of s.stage.units) if (!u.dead) treatments.add(u.treatment);

console.log(`beats                ${signatures.length}`);
console.log(`worlds in play       ${worlds.size}  ${[...worlds].join(" ")}`);
console.log(`layouts in play      ${layouts.size}`);
console.log(`treatments in play   ${treatments.size}`);
console.log(
  `DISTINCT SIGNATURES  ${distinct.size} / ${signatures.length}  (${Math.round((distinct.size / signatures.length) * 100)}%)`,
);
console.log(`longest identical run ${longestRun} beats`);
console.log(
  `signature returns    after ${minGap === Number.POSITIVE_INFINITY ? "never" : `${minGap} beats at soonest`}, ${
    meanGap === Number.POSITIVE_INFINITY ? "never" : `${meanGap.toFixed(1)} on average`
  }`,
);
