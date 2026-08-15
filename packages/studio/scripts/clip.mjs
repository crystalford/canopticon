// CLIP — record the film as an actual moving picture.
//
// `look.mjs` writes stills, and stills cannot answer the only question that
// matters about a film. This drives the REAL compositor and the REAL
// renderer in a browser and records the canvas as it plays, so what comes
// out is what the engine actually does over time.
//
// Silent and estimated-timing, like everything in the sandbox. The narrated
// film is still judged after deploy.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = await import("playwright-core").catch(() => import("playwright"));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB = process.env.LAB_DIR || path.resolve(HERE, "..", "lab");
const [cutPath, outPath] = process.argv.slice(2);
if (!cutPath || !outPath) {
  console.error("usage: clip.mjs <cut.json> <out.webm> [--from 0 --to 20000]");
  process.exit(1);
}
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? Number(process.argv[i + 1]) : d;
};
const FROM = arg("from", 0);
const TO = arg("to", 20000);

const cut = JSON.parse(fs.readFileSync(cutPath, "utf8"));

const html = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="fonts.css">
<style>html,body{margin:0;background:#000;overflow:hidden}
canvas{display:block;width:1280px;height:720px}</style>
<body><canvas id="c" width="1280" height="720"></canvas><script type="module">
import { buildStages } from "./comp/compose.js";
import { drawFrame, prepareFilm } from "./paint/frame.js";
window.__run = async (cut, fromMs, toMs) => {
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load('400 100px "Archivo Black"'),
    document.fonts.load('700 100px "Space Grotesk"'),
    document.fonts.load('500 100px "Space Grotesk"'),
    document.fonts.load('400 100px "Newsreader"'),
    document.fonts.load('500 100px "JetBrains Mono"'),
  ]);
  const ctx = document.getElementById("c").getContext("2d");
  const film = prepareFilm(cut, buildStages(cut));
  // PLAYED ON THE WALL CLOCK, not stepped by index — a recording has to
  // pass through real time or it is not a recording of a film.
  const t0 = performance.now();
  await new Promise((done) => {
    const tick = () => {
      const ms = fromMs + (performance.now() - t0);
      if (ms >= toMs) return done();
      drawFrame(ctx, film, Math.round((ms / 1000) * cut.fps));
      requestAnimationFrame(tick);
    };
    tick();
  });
};
</script></body>`;
fs.writeFileSync(path.join(LAB, "__clip.html"), html);

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
const dir = path.resolve(path.dirname(outPath), ".clip-tmp");
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
await page.goto(`${origin}/__clip.html`);
console.log(`recording ${((TO - FROM) / 1000).toFixed(1)}s …`);
await page.evaluate(([c, a, b]) => window.__run(c, a, b), [cut, FROM, TO], { timeout: 0 });
const video = page.video();
await ctx.close();
await browser.close();
server.close();
fs.unlinkSync(path.join(LAB, "__clip.html"));

fs.renameSync(await video.path(), outPath);
fs.rmSync(dir, { recursive: true, force: true });
console.log(`wrote ${outPath} (${(fs.statSync(outPath).size / 1e6).toFixed(2)} MB)`);
