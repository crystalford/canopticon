// Draw single frames of a spec, to look at before a full render.
//
//   node stills.mjs <spec.json> <outDir> [seconds,…]
//
// With no times, draws one frame two-thirds of the way through each shot.

import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)("playwright");
const [specPath, outDir, at = ""] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(`file://${join(here, "player.html")}`);
await page.evaluate((s) => setSpec(s), spec);
await page.evaluate(() => document.fonts.ready);
const shots = await page.evaluate(() => SPEC.beats.map((b) => [b._start, b.dur]));
const total = await page.evaluate(() => SPEC.total);
console.log(
  `total ${total.toFixed(1)}s`,
  JSON.stringify(shots.map(([s, d]) => [+s.toFixed(1), d])),
);
const times = at ? at.split(",").map(Number) : shots.map(([s, d]) => +(s + d * 0.66).toFixed(1));
for (const T of times) {
  await page.evaluate((T) => render(T), T);
  await page.screenshot({
    path: join(outDir, `t-${T.toFixed(1).padStart(6, "0")}.jpg`),
    type: "jpeg",
    quality: 80,
  });
}
await browser.close();
