// CONTACT SHEET — every frame of a stretch, on one page.
//
// The perceptual numbers say the frames differ. The operator says the film
// looks the same. Both can be true, and a sheet is the only way to find out
// which one is measuring the thing that matters — a grid of twenty frames is
// read in a second, and a film that repeats itself is obvious on it in a way
// no metric has managed to be.

import fs from "node:fs";
import path from "node:path";
const { chromium } = await import("playwright-core");

const [dir, out] = process.argv.slice(2);
if (!dir || !out) {
  console.error("usage: contact.mjs <frames-dir> <out.png>");
  process.exit(1);
}
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".png"))
  .sort();
const COLS = 5;
const CELL = 320;
const ROWS = Math.ceil(files.length / COLS);

const b = await chromium.launch({
  headless: true,
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const pg = await b.newPage();
await pg.setContent(`<canvas id="c" width="${COLS * CELL}" height="${ROWS * (CELL * 9) / 16}"></canvas>`);
const data = files.map((f) => fs.readFileSync(path.join(dir, f)).toString("base64"));

const png = await pg.evaluate(
  async ([imgs, cols, cell]) => {
    const c = document.getElementById("c");
    const p = c.getContext("2d");
    p.fillStyle = "#000";
    p.fillRect(0, 0, c.width, c.height);
    const h = (cell * 9) / 16;
    for (const [i, d] of imgs.entries()) {
      const img = new Image();
      img.src = `data:image/png;base64,${d}`;
      await img.decode();
      p.drawImage(img, (i % cols) * cell, Math.floor(i / cols) * h, cell, h);
      p.strokeStyle = "#333";
      p.strokeRect((i % cols) * cell, Math.floor(i / cols) * h, cell, h);
    }
    return c.toDataURL("image/png").split(",")[1];
  },
  [data, COLS, CELL],
);
fs.writeFileSync(out, Buffer.from(png, "base64"));
await b.close();
console.log(`wrote ${out} — ${files.length} frames`);
