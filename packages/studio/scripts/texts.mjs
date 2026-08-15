// PROBE THE TEXT SPACE — twenty ways of setting one line, side by side.
//
// The operator has been shown black-and-white punk-zine typography six times
// and has asked, correctly, why there are not a hundred variants. The answer
// is that three things were welded into the renderer and could not be reached:
// monochrome, the photocopy press, and four typefaces. None of those is a
// choice the engine could make; they were constants.
//
// This sheet draws the type ONLY — no press, no grain, no forms — so what is
// being judged is the setting itself, and colour is on, because every frame
// this engine has ever produced has been black and white.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = await import("playwright-core");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB = path.resolve(HERE, "..", "lab");
const out = process.argv[2] || "/tmp/texts.png";
const COLS = 4;
const ROWS = 5;
const W = 400;
const H = 225;

const html = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="fonts.css">
<style>html,body{margin:0;background:#000}</style>
<body><canvas id="c" width="${COLS * W}" height="${ROWS * H}"></canvas>
<script type="module">
import { sampleStyle } from "./style/space.js";
import { layoutText } from "./comp/treatment.js";
import { FACES } from "./core/type.js";
import { mulberry32 } from "./core/rng.js";

const PHRASE = "the same machine wearing a coat";
const FACE_NAMES = Object.keys(FACES);

window.__go = async (seed) => {
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load('400 100px "Archivo Black"'),
    document.fonts.load('700 100px "Space Grotesk"'),
    document.fonts.load('500 100px "Space Grotesk"'),
    document.fonts.load('400 100px "Newsreader"'),
    document.fonts.load('500 100px "JetBrains Mono"'),
  ]);
  const c = document.getElementById("c");
  const p = c.getContext("2d");
  const notes = [];
  for (let i = 0; i < ${COLS * ROWS}; i++) {
    const rng = mulberry32(seed + i * 7919);
    const st = sampleStyle(rng);
    const cx = (i % ${COLS}) * ${W};
    const cy = Math.floor(i / ${COLS}) * ${H};

    // COLOUR. A hue per cell, with saturation as its own dimension so a
    // sample can be fully monochrome, fully saturated, or anywhere between —
    // which is a range the engine has never had at all.
    const hue = Math.round(rng() * 360);
    const sat = Math.round(rng() * rng() * 90);
    const dark = st.f.weight > 0.5;
    const ground = dark ? \`hsl(\${hue} \${sat}% \${8 + rng() * 14}%)\` : \`hsl(\${hue} \${sat * 0.5}% \${86 + rng() * 12}%)\`;
    const ink = dark ? \`hsl(\${(hue + 180 * (rng() < 0.4 ? 1 : 0)) % 360} \${sat}% \${72 + rng() * 24}%)\` : \`hsl(\${hue} \${sat}% \${10 + rng() * 22}%)\`;

    p.save();
    p.beginPath(); p.rect(cx, cy, ${W}, ${H}); p.clip();
    p.fillStyle = ground; p.fillRect(cx, cy, ${W}, ${H});
    p.translate(cx, cy);

    const u = {
      text: PHRASE,
      size: 0.06 + rng() * 0.2,
      box: { x: 0, y: 0, w: 0.55 + rng() * 0.5, h: 0.3 },
      face: FACE_NAMES[Math.floor(rng() * FACE_NAMES.length)],
      altFace: FACE_NAMES[Math.floor(rng() * FACE_NAMES.length)],
      phase: Math.floor(rng() * 9999),
      trackingOffset: 0,
      style: st,
    };
    const laid = layoutText(p, u, ${W}, ${H});
    p.save();
    p.translate(${W} * (0.08 + rng() * 0.2), ${H} * (0.3 + rng() * 0.4));
    p.rotate((st.angleMean * (rng() < 0.35 ? 1 : 0) * Math.PI) / 180);
    for (const r of laid.runs) {
      p.save();
      p.letterSpacing = ((r.tracking ?? 0) * 0.06).toFixed(3) + "em";
      p.font = Math.round(r.weight) + " " + r.px + "px " + (FACES[r.face] || FACES.grotesque);
      p.textAlign = "left"; p.textBaseline = "alphabetic";
      p.translate(r.x, r.y);
      if (r.rot) p.rotate((r.rot * Math.PI) / 180);
      if (r.stroke) { p.strokeStyle = ink; p.lineWidth = r.stroke; p.strokeText(r.text, 0, 0); }
      else { p.fillStyle = ink; p.fillText(r.text, 0, 0); }
      p.restore();
    }
    p.restore();
    p.restore();
    p.strokeStyle = "#222"; p.strokeRect(cx, cy, ${W}, ${H});
    notes.push([
      "curv " + st.curvature.toFixed(2),
      "jit " + st.glyphJitter.toFixed(2),
      "vert " + st.verticality.toFixed(2),
      "stack " + st.stacking.toFixed(2),
      "trk " + st.tracking.toFixed(2),
      "hue " + hue + "/" + sat,
    ].join(" "));
  }
  return { png: c.toDataURL("image/png").split(",")[1], notes };
};
</script></body>`;
fs.writeFileSync(path.join(LAB, "__texts.html"), html);

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
};
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
await page.goto(`${origin}/__texts.html`);
const r = await page.evaluate((s) => window.__go(s), Number(process.env.SEED ?? 77));
fs.writeFileSync(out, Buffer.from(r.png, "base64"));
await browser.close();
server.close();
fs.unlinkSync(path.join(LAB, "__texts.html"));
console.log(`wrote ${out}`);
console.log(`distinct settings: ${new Set(r.notes).size}/${r.notes.length}`);
