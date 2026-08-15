// PERCEPTUAL VARIETY — measure the IMAGE, not the parameters.
//
// Every variety number this engine reports so far measures its own latent
// parameters: distinct style points, coverage of the space, distance between
// films. All of them look excellent and the operator still says it goes stale
// after forty seconds. Those metrics cannot be wrong about what they measure
// and cannot be right about what matters, because forty parameters can vary
// wildly and still funnel into an image that looks identical.
//
// So this reduces each frame to what a viewer actually retains — a coarse grid
// of tones — and asks how different consecutive and distant frames really are.
// If the parameters spread and this does not, the funnel is downstream and
// that is where the work is.

import fs from "node:fs";
import path from "node:path";
const { chromium } = await import("playwright-core");

const dir = process.argv[2];
if (!dir) {
  console.error("usage: perceptual.mjs <frames-dir>");
  process.exit(1);
}
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".png"))
  .sort();

const b = await chromium.launch({
  headless: true,
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const pg = await b.newPage();
await pg.setContent("<canvas id=c></canvas>");

const N = 8; // an 8×8 tone grid is roughly what the eye keeps of a glanced frame
const sigs = [];
for (const f of files) {
  const data = fs.readFileSync(path.join(dir, f)).toString("base64");
  const sig = await pg.evaluate(
    async ([d, n]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${d}`;
      await img.decode();
      const c = document.getElementById("c");
      c.width = n;
      c.height = n;
      const x = c.getContext("2d");
      // Downscaling IS the perceptual model: it throws away exactly the detail
      // a viewer does not retain between two frames a second apart.
      x.drawImage(img, 0, 0, n, n);
      const p = x.getImageData(0, 0, n, n).data;
      const out = [];
      for (let i = 0; i < p.length; i += 4) {
        out.push((0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) / 255);
      }
      return out;
    },
    [data, N],
  );
  sigs.push(sig);
}
await b.close();

const dist = (a, c) => Math.hypot(...a.map((v, i) => v - c[i])) / Math.sqrt(a.length);

const adjacent = [];
for (let i = 1; i < sigs.length; i++) adjacent.push(dist(sigs[i], sigs[i - 1]));

const nearest = [];
for (let i = 3; i < sigs.length; i++) {
  let best = Number.POSITIVE_INFINITY;
  for (let j = 0; j < i - 2; j++) {
    const d = dist(sigs[i], sigs[j]);
    if (d < best) best = d;
  }
  nearest.push(best);
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const seg = (a, s, e) => mean(a.slice(s, e)).toFixed(3);

console.log(`frames compared            ${sigs.length}`);
console.log(`mean tone                  ${mean(sigs.map((s) => mean(s))).toFixed(3)}`);
console.log(`ADJACENT frame difference  ${mean(adjacent).toFixed(3)}   (0 = identical)`);
console.log(
  `NEAREST earlier frame      ${mean(nearest).toFixed(3)}   — how close every frame gets to one already seen`,
);
const q = Math.floor(nearest.length / 3);
console.log(`  first third  ${seg(nearest, 0, q)}`);
console.log(`  middle third ${seg(nearest, q, 2 * q)}`);
console.log(`  last third   ${seg(nearest, 2 * q, nearest.length)}`);
