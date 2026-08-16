// LOOK-THREE — draw a Three.js-backend FilmCut, headless, and write frames.
//
// Same discipline as look.mjs, aimed at the new backend: renders through
// the REAL initThreeJSRenderer + renderTypeLayer modules, in a REAL
// browser (headless Chromium, software WebGL via SwiftShader), with the
// REAL self-hosted fonts. Catches shader compile errors, JS exceptions in
// the resolveAt/composition wiring, and canvas-context bugs that
// typecheck cannot see.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB = process.env.LAB_DIR || path.resolve(HERE, "..", "lab");
const [cutPath, outDir] = process.argv.slice(2);
if (!cutPath || !outDir) {
  console.error("usage: look-three.mjs <cut.json> <outDir> [--w 1280 --h 720 --n 8]");
  process.exit(1);
}
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? Number(process.argv[i + 1]) : d;
};
const W = arg("w", 1280);
const H = arg("h", 720);
const N = arg("n", 8);

const cut = JSON.parse(fs.readFileSync(cutPath, "utf8"));
fs.mkdirSync(outDir, { recursive: true });

const html = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="fonts.css">
<style>html,body{margin:0;background:#000}</style>
<body><script type="module">
import { buildStages } from "./comp/compose.js";
import { initThreeJSRenderer } from "./threejs/render.js";
import { renderTypeLayer } from "./threejs/composition.js";
window.__boot = async (cut, w, h) => {
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load('400 100px "Archivo Black"'),
    document.fonts.load('700 100px "Space Grotesk"'),
    document.fonts.load('500 100px "Space Grotesk"'),
    document.fonts.load('400 100px "Newsreader"'),
    document.fonts.load('500 100px "JetBrains Mono"'),
  ]);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  window.__ctx = c.getContext("2d");
  window.__canvas = c;
  window.__renderer = initThreeJSRenderer(c, cut);
  window.__stages = buildStages(cut).stages;
  return {
    beats: cut.beats.length,
    renderBackend: cut.renderBackend,
    threeConfig: cut.threeConfig,
    faces: [...document.fonts].map(f => f.family + " " + f.weight + " " + f.status),
  };
};
window.__draw = (ms, beatIndex, timeInBeat) => {
  const pixels = window.__renderer.renderFrame(beatIndex, timeInBeat);
  const imageData = new ImageData(pixels, window.__canvas.width, window.__canvas.height);
  window.__ctx.putImageData(imageData, 0, 0);
  renderTypeLayer(window.__ctx, window.__canvas.width, window.__canvas.height, window.__stages, ms);
  return window.__canvas.toDataURL("image/png").split(",")[1];
};
</script></body>`;
fs.writeFileSync(path.join(LAB, "__look_three.html"), html);

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".json": "application/json",
};
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "");
  const file = path.join(LAB, rel);
  if (!file.startsWith(LAB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const EXE =
  process.env.CHROMIUM_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
// --use-gl=swiftshader forces software WebGL so this runs the same in any
// headless container, no GPU passthrough required.
const browser = await chromium.launch({
  headless: true,
  ...(EXE ? { executablePath: EXE } : {}),
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
let hadError = false;
page.on("pageerror", (e) => {
  hadError = true;
  console.error("[pageerror]", e.message);
});
page.on("console", (m) => {
  // Chromium logs every failed resource fetch (this harness serves no
  // favicon) as this exact generic phrasing, with no URL in the message —
  // noise, not signal. Real application errors (shader compile failures,
  // thrown exceptions surfaced via console.error) use their own distinct
  // text and are never phrased this way, so the filter can't hide them.
  if (m.type() === "error" && !m.text().startsWith("Failed to load resource:")) {
    hadError = true;
    console.error("[page]", m.text());
  }
});
await page.goto(`${origin}/__look_three.html`);

const info = await page.evaluate(([c, w, h]) => window.__boot(c, w, h), [cut, W, H]);
console.log(`backend: ${info.renderBackend}`);
console.log("threeConfig:", info.threeConfig);
const loaded = info.faces.filter((f) => f.endsWith("loaded"));
console.log(
  `fonts: ${loaded.length}/${info.faces.length} loaded${loaded.length === 0 ? "  ⚠ FALLBACK TYPEFACE" : ""}`,
);
console.log(`beats: ${info.beats}`);

const step = Math.max(1, Math.floor(cut.beats.length / N));
const picks = [];
for (let i = 0; i < cut.beats.length && picks.length < N; i += step) {
  const b = cut.beats[i];
  const ms = (b.startMs + b.endMs) / 2;
  picks.push({ i, ms, b });
}

for (const p of picks) {
  const beatIndex = p.i;
  const timeInBeat = p.ms - p.b.startMs;
  const data = await page.evaluate(
    ([ms, bi, tib]) => window.__draw(ms, bi, tib),
    [p.ms, beatIndex, timeInBeat],
  );
  const file = path.join(outDir, `three-beat-${String(p.i).padStart(2, "0")}.png`);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  const txt = p.b.text.phrases.map((x) => `"${x.text}"`).join(" ");
  console.log(
    `  ${path.basename(file)}  ${p.b.editorialRole.padEnd(9)} ${p.b.visualIntent.behavior.padEnd(11)} ${txt}`,
  );
}

await browser.close();
server.close();
fs.unlinkSync(path.join(LAB, "__look_three.html"));

if (hadError) {
  console.error("\n⚠ page errors were reported during render — see [pageerror]/[page] lines above");
  process.exit(1);
}
console.log("\nno page errors reported.");
