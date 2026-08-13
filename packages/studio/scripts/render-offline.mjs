// RENDER-OFFLINE — the film, rendered from a plan, with no server and no
// real-time clock.
//
// The Lab's own renderer already drives the chain BY FRAME INDEX, which is
// the hard part and the reason it is deterministic. What it does not have
// is a way to get those frames out of a browser that nobody is watching:
// it hands them to a MediaRecorder, which writes on the wall clock, so a
// six-minute film costs six minutes and a slow frame is a lost one.
//
// This drives the same functions — `buildForRender` and `drawFrame`, the
// Lab's, not a second implementation — inside headless Chromium, pulls
// each frame out as a JPEG, and pipes it into ffmpeg. Nothing reads a
// clock anywhere in the path, so frame 900 of a 30fps film is t = 30.000s
// whether it took 4ms or 400ms to compute.
//
// ffmpeg comes from Playwright's own bundle. It is built
// `--disable-everything` with exactly one video encoder (libvpx VP8) and
// exactly one useful demuxer (image2pipe), which is precisely this job and
// nothing else. It has NO audio encoder, so this writes picture only —
// stated here rather than discovered later.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB = process.env.LAB_DIR || path.resolve(HERE, "..", "lab");
const FFMPEG = process.env.FFMPEG_PATH || "/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux";

const planPath = process.argv[2];
const outPath = process.argv[3];
if (!planPath || !outPath) {
  console.error("usage: render-offline.mjs <plan.json> <out.webm> [--w 1280 --h 720 --fps 24]");
  process.exit(1);
}
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : fallback;
};
const W = arg("w", 1280);
const H = arg("h", 720);
const FPS = arg("fps", 24);
const CAPTIONS = !process.argv.includes("--no-captions");
const QUALITY = arg("q", 92);

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
const durationMs = plan.scenes.reduce((m, s) => Math.max(m, s.endMs), 0);
const frames = Math.ceil((durationMs / 1000) * FPS);
console.log(
  `film: ${plan.scenes.length} scenes · ${(durationMs / 1000).toFixed(1)}s · ${frames} frames @ ${FPS}fps · ${W}x${H}`,
);

// The Lab is a set of classic scripts with no module boundary, so the page
// is assembled here rather than loading index.html — the UI would drag in
// views, state and an app shell none of which this needs.
const SCRIPTS = [
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
  "render.js",
];

const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#0d0f11}</style>
<body>
${SCRIPTS.map((s) => `<script src="${s}"></script>`).join("\n")}
<script>
  // render.js expects these two to exist; the film has no narration track
  // here (no audio encoder downstream) and no procedural score, so both
  // are stubbed rather than loaded. Stated in the log, not hidden.
  window.narrationStatus = window.narrationStatus || (() => ({ narrated: 0 }));
  window.loadNarration = window.loadNarration || (async () => ({ loaded: 0 }));
</script>
</body>`;
fs.writeFileSync(path.join(LAB, "__render.html"), html);

// The sandbox ships Chromium at a pinned path that will not match
// whatever build the installed Playwright expects, so the executable is
// named explicitly rather than downloaded — see the environment's own
// note about PLAYWRIGHT_BROWSERS_PATH.
const EXE =
  process.env.CHROMIUM_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ headless: true, ...(EXE ? { executablePath: EXE } : {}) });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.error("[page]", m.text());
});
await page.goto(pathToFileURL(path.join(LAB, "__render.html")).href);

const ready = await page.evaluate(() => ({
  prims: Object.keys(window.PRIMS || {}).length,
  build: typeof buildForRender === "function",
  draw: typeof drawFrame === "function",
}));
console.log(`lab: ${ready.prims} primitives loaded, buildForRender=${ready.build}`);
if (!ready.prims || !ready.build || !ready.draw) {
  console.error("the Lab did not load — aborting rather than writing a black film");
  await browser.close();
  process.exit(1);
}

// Build every scene's chain ONCE. Instances hold state — particle
// positions, creature bodies, motion history — so rebuilding per frame
// would reset every motion in the film to its first step, every frame.
const built = await page.evaluate(
  ({ plan, W, H, CAPTIONS }) => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    window.__ctx = canvas.getContext("2d");
    window.__canvas = canvas;
    window.__scenes = buildForRender(plan, W, H);
    window.__captions = CAPTIONS;
    return window.__scenes.map((s) => ({
      id: s.scene.sceneId || "",
      errors: (s.built.errors || []).slice(0, 3),
    }));
  },
  { plan, W, H, CAPTIONS },
);
const broken = built.filter((b) => b.errors.length);
if (broken.length) {
  console.log(`⚠ ${broken.length}/${built.length} scenes have chain errors:`);
  for (const b of broken.slice(0, 8)) console.log(`   ${b.id}: ${b.errors.join(" | ")}`);
}

const ff = spawn(FFMPEG, [
  "-y",
  "-f",
  "image2pipe",
  // NAMED, not probed. ffmpeg probes an unknown pipe before enough frames
  // have arrived to identify it and gives up with "unknown codec" — which
  // it reports as an OUTPUT error, so the message points at the wrong end
  // of the pipeline entirely.
  "-vcodec",
  "mjpeg",
  "-framerate",
  String(FPS),
  "-i",
  "pipe:0",
  // Playwright's ffmpeg is built --disable-everything: libvpx VP8 is the
  // only encoder and webm the only muxer, so the codec is named explicitly
  // and nothing else is assumed to exist. `-an` because there is no audio
  // encoder in this build at all — the film is picture only, by the tool's
  // construction rather than by choice.
  "-an",
  "-c:v",
  "libvpx",
  "-b:v",
  "4M",
  "-quality",
  "good",
  "-cpu-used",
  "2",
  "-f",
  "webm",
  outPath,
]);
ff.stderr.on("data", (d) => {
  const s = String(d);
  if (process.env.FF_DEBUG || /error|Error|Invalid/.test(s)) process.stderr.write(s);
});
const done = new Promise((res, rej) => {
  ff.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))));
  ff.on("error", rej);
});

const started = Date.now();
for (let frame = 0; frame < frames; frame++) {
  const data = await page.evaluate(
    ({ frame, FPS, W, H, QUALITY }) => {
      drawFrame(window.__ctx, window.__scenes, frame, FPS, W, H, window.__captions);
      const url = window.__canvas.toDataURL("image/jpeg", QUALITY / 100);
      // Split on the comma rather than a fixed offset. A canvas that
      // cannot encode JPEG silently returns a PNG data URL with a
      // different prefix length, and a fixed slice would corrupt every
      // frame while looking like it worked.
      return url.slice(url.indexOf(",") + 1);
    },
    { frame, FPS, W, H, QUALITY },
  );
  const buf = Buffer.from(data, "base64");
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (frame % Math.max(1, Math.floor(frames / 20)) === 0) {
    const pct = Math.round((frame / frames) * 100);
    const rate = frame / ((Date.now() - started) / 1000 || 1);
    process.stdout.write(
      `  ${String(pct).padStart(3)}%  frame ${frame}/${frames}  ${rate.toFixed(1)} fps\n`,
    );
  }
}
ff.stdin.end();
await done;
await browser.close();
fs.unlinkSync(path.join(LAB, "__render.html"));

const size = fs.statSync(outPath).size;
console.log(
  `\n✓ ${outPath} — ${(size / 1e6).toFixed(2)} MB, ${frames} frames, ${(durationMs / 1000).toFixed(1)}s, ${((Date.now() - started) / 1000).toFixed(0)}s to render`,
);
if (size < 20000) {
  console.error("⚠ suspiciously small file — this is very likely a black or static film");
  process.exit(1);
}
