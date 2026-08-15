// PROBE THE FORM SPACE — render sampled forms on their own, large.
//
// The generator has to be judged before it is judged inside a film. A form
// that is too small, off-frame or eaten by the press is indistinguishable from
// a form that was never generated, and the difference matters: one is a wiring
// bug and the other means the space itself is empty.
//
// This draws a grid of independent samples at full size with no press, no
// type and no composition. If this sheet is not full of varied structures,
// nothing downstream can save it.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = await import("playwright-core");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB = path.resolve(HERE, "..", "lab");
const out = process.argv[2] || "/tmp/forms.png";
const COLS = 5;
const ROWS = 4;
const CELL = 300;

const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#111}</style>
<body><canvas id="c" width="${COLS * CELL}" height="${ROWS * CELL}"></canvas>
<script type="module">
import { sampleForm, buildForm, growAt, formKey } from "./form/grow.js";
import { drawForm } from "./form/draw.js";
import { mulberry32 } from "./core/rng.js";
window.__go = (seed) => {
  const c = document.getElementById("c");
  const p = c.getContext("2d");
  p.fillStyle = "#111"; p.fillRect(0,0,c.width,c.height);
  const keys = [];
  let stats = [];
  for (let i = 0; i < ${COLS * ROWS}; i++) {
    const rng = mulberry32(seed + i * 7919);
    const f = sampleForm(rng);
    const built = buildForm(f);
    keys.push(formKey(f));
    stats.push({limbs: built.limbs.length, dots: built.dots.length, hulls: built.hulls.length, rects: built.rects.length});
    const cx = (i % ${COLS}) * ${CELL};
    const cy = Math.floor(i / ${COLS}) * ${CELL};
    p.save();
    p.beginPath(); p.rect(cx, cy, ${CELL}, ${CELL}); p.clip();
    p.translate(cx, cy);
    // Fully grown, centred, sized to the cell.
    drawForm(p, growAt(built, 1), 0.5, 0.5, 0.9, ${CELL}, ${CELL}, "#fff");
    p.restore();
    p.strokeStyle = "#333"; p.strokeRect(cx, cy, ${CELL}, ${CELL});
  }
  return { png: c.toDataURL("image/png").split(",")[1], keys, stats };
};
</script></body>`;
fs.writeFileSync(path.join(LAB, "__forms.html"), html);

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "");
  const file = path.join(LAB, rel);
  if (!file.startsWith(LAB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("no");
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  headless: true,
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
await page.goto(`${origin}/__forms.html`);
const r = await page.evaluate((s) => window.__go(s), Number(process.env.SEED ?? 4210));
fs.writeFileSync(out, Buffer.from(r.png, "base64"));
await browser.close();
server.close();
fs.unlinkSync(path.join(LAB, "__forms.html"));

console.log(`wrote ${out}`);
console.log(`distinct form points: ${new Set(r.keys).size}/${r.keys.length}`);
const empty = r.stats.filter((s) => s.limbs + s.dots + s.hulls + s.rects < 3).length;
console.log(`near-empty forms:     ${empty}/${r.stats.length}`);
console.log(
  `limbs  min ${Math.min(...r.stats.map((s) => s.limbs))}  max ${Math.max(...r.stats.map((s) => s.limbs))}`,
);
