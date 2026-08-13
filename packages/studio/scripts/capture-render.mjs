// CAPTURE-RENDER — export a real film against the deployed Studio, headless,
// and save both the video and the compile metadata behind it.
//
// Built for one specific experiment: "Version A" (pre parameter-plumbing
// fix) and "Version B" (post fix) of the same project, so the difference
// between them is evidence rather than an impression. It drives the Lab
// exactly the way an operator does — load the project, press RENDER at the
// UI's own defaults — because a fabricated comparison is not a control.
//
// Runs against production. This sandbox cannot reach studio.canopticon.com
// at all (the egress proxy refuses the CONNECT, same as every other probe
// in this repo), so this only runs inside a GitHub Actions job with real
// network access — see .github/workflows/studio-capture-render.yml.
//
// Deliberately not a permanent dependency: playwright is installed ad hoc
// by the workflow, not added to package.json. This is a diagnostic, not a
// feature.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.CAPTURE_BASE_URL || "https://studio.canopticon.com";
const PROJECT_ID = process.env.CAPTURE_PROJECT_ID;
const LABEL = process.env.CAPTURE_LABEL || "capture";
const OUT_DIR = process.env.CAPTURE_OUT_DIR || `ops/studio-capture/${LABEL}`;

if (!PROJECT_ID) {
  console.error("CAPTURE_PROJECT_ID is required");
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

function writeJSON(name, value) {
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, JSON.stringify(value, null, 2));
  console.log(`wrote ${p} (${fs.statSync(p).size} bytes)`);
}

const browser = await chromium.launch({
  headless: true,
  // The narration track plays through a real AudioContext so its clock can
  // pace the recorder — see narration.js. Chrome's autoplay policy blocks
  // that without a user gesture, which headless automation never provides,
  // so this would otherwise render six minutes of correct picture with
  // silently missing narration. Cheap insurance either way.
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
page.on("console", (msg) => {
  const t = msg.text();
  // The render loop logs progress every 4 frames; forwarding all of it
  // would flood the job log for a ~7 minute run, so only stage changes and
  // errors are surfaced.
  if (/^\[capture\]|error|Error/.test(t)) console.log("[page]", t);
});
page.on("pageerror", (err) => console.error("[pageerror]", err.message));

console.log(`→ ${BASE_URL}/  (project ${PROJECT_ID}, label "${LABEL}")`);
await page.goto(`${BASE_URL}/`, { waitUntil: "load", timeout: 60_000 });
await page.waitForFunction(
  () => typeof window.renderFilm === "function" && typeof window.loadProject === "function",
  { timeout: 30_000 },
);

// LOAD THE REAL PROJECT. Same call the FILMS picker makes.
const capturedAt = new Date().toISOString();
const loadStarted = Date.now();
const loaded = await page.evaluate(async (projectId) => {
  const film = await window.loadProject(projectId);
  return {
    title: film?.title ?? null,
    scenes: film?.scenes?.length ?? 0,
    planScenes: window.STUDIO.plan?.scenes?.length ?? 0,
    durationMs: window.STUDIO.plan?.durationMs ?? null,
  };
}, PROJECT_ID);
console.log(`[capture] loaded in ${Date.now() - loadStarted}ms —`, loaded);
if (!loaded.planScenes) throw new Error("project loaded but has no film plan — nothing to render");

// THE COMPILE REPORT. Not part of the render path — a second call, so the
// cache/hash/usage numbers describe what the SAME deployed code just
// composed, independent of what renderFilm does with it.
const compileReport = await page.evaluate(async () => {
  const res = await fetch(`/v1/project/${window.STUDIO.projectId}/compile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  if (!res.ok) throw new Error(`compile ${res.status}`);
  return res.json();
});
writeJSON("compile.json", compileReport);
writeJSON("plan.json", {
  title: loaded.title,
  plan: await page.evaluate(() => window.STUDIO.plan),
});

// THE RENDER. Exactly the UI's own defaults — 1280×720, 30fps, captions
// on — because the point is what an operator actually gets, not a tuned
// best case.
console.log("[capture] rendering — this paces to real time, expect several minutes");
const renderStarted = Date.now();
const downloadPromise = page.waitForEvent("download", { timeout: 20 * 60_000 });

const renderResult = await page.evaluate(async () => {
  const plan = window.STUDIO.plan;
  const out = await window.renderFilm(plan, {
    width: 1280,
    height: 720,
    fps: 30,
    captions: true,
    onProgress: (p) => {
      if (p.frame % 300 === 0 || p.pct >= 1) {
        console.log(
          `[capture] ${p.stage} — frame ${p.frame}/${p.frames} (${Math.round((p.pct || 0) * 100)}%)`,
        );
      }
    },
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(out.blob);
  a.download = "film.webm";
  document.body.appendChild(a);
  a.click();
  return {
    size: out.blob.size,
    frames: out.frames,
    frameExact: out.frameExact,
    narrated: out.narrated,
  };
});
const renderMs = Date.now() - renderStarted;
console.log(`[capture] render finished in ${renderMs}ms —`, renderResult);

const download = await downloadPromise;
const videoPath = path.join(OUT_DIR, "film.webm");
await download.saveAs(videoPath);
console.log(`[capture] saved ${videoPath} (${fs.statSync(videoPath).size} bytes)`);

writeJSON("meta.json", {
  label: LABEL,
  projectId: PROJECT_ID,
  baseUrl: BASE_URL,
  capturedAt,
  loadMs: loadStarted ? Date.now() - loadStarted : null,
  renderMs,
  render: renderResult,
  planTitle: loaded.title,
  planScenes: loaded.planScenes,
  planDurationMs: loaded.durationMs,
});

await browser.close();
console.log("[capture] done");
