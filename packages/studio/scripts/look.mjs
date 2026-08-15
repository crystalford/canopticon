// LOOK — draw a FilmCut, headless, and write frames.
//
// The development loop for this engine is BUILD → DEPLOY → LOOK, and the
// looking is the part that decides anything. This is the sandbox half of
// it: silent, estimated-timing, but rendered through the REAL compositor
// and the REAL renderer, with the REAL self-hosted fonts.
//
// It is deliberately not a test. A green suite cannot tell us whether the
// film is any good.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB = process.env.LAB_DIR || path.resolve(HERE, "..", "lab");
const [cutPath, outDir] = process.argv.slice(2);
if (!cutPath || !outDir) {
  console.error("usage: look.mjs <cut.json> <outDir> [--w 1280 --h 720 --n 12 --fps 30]");
  process.exit(1);
}
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? Number(process.argv[i + 1]) : d;
};
const W = arg("w", 1280);
const H = arg("h", 720);
const N = arg("n", 12);

const cut = JSON.parse(fs.readFileSync(cutPath, "utf8"));
fs.mkdirSync(outDir, { recursive: true });

// The page is a module, because the new lab code is modules. One import
// graph, no script-tag ordering to get wrong.
const html = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="fonts.css">
<style>html,body{margin:0;background:#000}</style>
<body><script type="module">
import { buildStages } from "./comp/compose.js";
import { drawFrame, prepareFilm } from "./paint/frame.js";
window.__boot = async (cut, w, h) => {
  // WAIT FOR THE FACES. Drawing before they load renders the fallback and
  // every judgement made from the frame is about the wrong typeface.
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
  window.__film = prepareFilm(cut, buildStages(cut));
  return {
    beats: cut.beats.length,
    grid: window.__film.grid,
    faces: [...document.fonts].map(f => f.family + " " + f.weight + " " + f.status),
  };
};
window.__draw = (i) => { drawFrame(window.__ctx, window.__film, i); return window.__canvas.toDataURL("image/png").split(",")[1]; };
</script></body>`;
fs.writeFileSync(path.join(LAB, "__look.html"), html);

// SERVED OVER HTTP, not file://. ES modules are blocked by CORS on
// file:// origins, and this is also how the Lab actually runs in
// production — `wrangler.toml`'s `[assets] directory = "./lab"` serves
// exactly this tree. Rendering it the same way the browser will is worth
// more than the twelve lines it costs.
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
const browser = await chromium.launch({ headless: true, ...(EXE ? { executablePath: EXE } : {}) });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.error("[page]", m.text()));
await page.goto(`${origin}/__look.html`);

const info = await page.evaluate(([c, w, h]) => window.__boot(c, w, h), [cut, W, H]);
console.log(
  `grid ${info.grid.cols}x${info.grid.rows} · ${info.grid.symmetry} · rot ${info.grid.rotation.toFixed(2)}°`,
);
const loaded = info.faces.filter((f) => f.endsWith("loaded"));
console.log(
  `fonts: ${loaded.length}/${info.faces.length} loaded${loaded.length === 0 ? "  ⚠ FALLBACK TYPEFACE" : ""}`,
);
console.log(`beats: ${info.beats}`);

// One frame from the MIDDLE of each beat, evenly spread — the start of a
// beat is its least representative frame, because everything is at t=0 of
// its own motion.
const fps = cut.fps || 30;
const step = Math.max(1, Math.floor(cut.beats.length / N));
const picks = [];
for (let i = 0; i < cut.beats.length && picks.length < N; i += step) {
  const b = cut.beats[i];
  picks.push({ i, frame: Math.round(((b.startMs + b.endMs) / 2 / 1000) * fps), b });
}

for (const p of picks) {
  const data = await page.evaluate((f) => window.__draw(f), p.frame);
  const file = path.join(outDir, `beat-${String(p.i).padStart(2, "0")}.png`);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  const txt = p.b.text.phrases.map((x) => `"${x.text}"`).join(" ");
  console.log(
    `  ${path.basename(file)}  ${p.b.editorialRole.padEnd(9)} ${p.b.visualIntent.behavior.padEnd(11)} ${txt}`,
  );
}

await browser.close();
server.close();
fs.unlinkSync(path.join(LAB, "__look.html"));
