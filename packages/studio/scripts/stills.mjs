// STILLS — pull exact frames out of a film plan as PNGs.
//
// The bundled ffmpeg has no filters worth the name (pad, crop, scale and
// nothing else), so frames cannot be extracted from the encoded webm.
// They do not need to be: the renderer is driven by frame index, so any
// frame can simply be drawn again. Same functions, same determinism.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB = process.env.LAB_DIR || path.resolve(HERE, "..", "lab");
const [planPath, outDir] = process.argv.slice(2);
if (!planPath || !outDir) {
  console.error("usage: stills.mjs <plan.json> <outDir> [--w 1280 --h 720 --fps 24 --n 12]");
  process.exit(1);
}
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? Number(process.argv[i + 1]) : d;
};
const W = arg("w", 1280);
const H = arg("h", 720);
const FPS = arg("fps", 24);
const N = arg("n", 12);
const CAPTIONS = !process.argv.includes("--no-captions");

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
fs.mkdirSync(outDir, { recursive: true });

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
const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}</style><body>
${SCRIPTS.map((s) => `<script src="${s}"></script>`).join("\n")}
<script>window.narrationStatus=()=>({narrated:0});window.loadNarration=async()=>({loaded:0});</script>
</body>`;
fs.writeFileSync(path.join(LAB, "__stills.html"), html);

const EXE =
  process.env.CHROMIUM_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ headless: true, ...(EXE ? { executablePath: EXE } : {}) });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
await page.goto(pathToFileURL(path.join(LAB, "__stills.html")).href);

await page.evaluate(
  ({ plan, W, H, CAPTIONS }) => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    window.__ctx = c.getContext("2d");
    window.__canvas = c;
    window.__scenes = buildForRender(plan, W, H);
    window.__captions = CAPTIONS;
  },
  { plan, W, H, CAPTIONS },
);

// One still from the MIDDLE of each scene, up to N, evenly spread across
// the film. The middle rather than the start because a chain's first frame
// is every particle system at step zero — the least representative frame a
// procedural shot has.
const scenes = plan.scenes;
const pick = [];
const step = Math.max(1, Math.floor(scenes.length / N));
for (let i = 0; i < scenes.length && pick.length < N; i += step) {
  const s = scenes[i];
  pick.push({ i, frame: Math.round(((s.startMs + s.endMs) / 2 / 1000) * FPS), text: s.text });
}

for (const p of pick) {
  let data;
  try {
    data = await page.evaluate(
      ({ frame, FPS, W, H }) => {
        // Wind the chain forward from the scene's own start so particle and
        // creature state is where it would be in a real playthrough, not
        // where a cold single call would leave it.
        for (let f = Math.max(0, frame - 30); f <= frame; f++) {
          drawFrame(window.__ctx, window.__scenes, f, FPS, W, H, window.__captions);
        }
        const u = window.__canvas.toDataURL("image/png");
        return u.slice(u.indexOf(",") + 1);
      },
      { frame: p.frame, FPS, W, H },
    );
  } catch (e) {
    // One scene that throws must not take the contact sheet with it —
    // the point of a sheet is to see WHICH ones fail.
    console.log(`scene-${String(p.i).padStart(2, "0")}  FAILED: ${String(e).split("\n")[0]}`);
    continue;
  }
  const file = path.join(outDir, `scene-${String(p.i).padStart(2, "0")}.png`);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  console.log(`${file}  ${String(p.text).slice(0, 62)}`);
}

await browser.close();
fs.unlinkSync(path.join(LAB, "__stills.html"));
