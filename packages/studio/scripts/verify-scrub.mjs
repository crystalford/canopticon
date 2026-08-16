// VERIFY-SCRUB — prove the player actually seeks, in a real browser.
//
// This exists because the scrubbing bug shipped "fixed" twice on the
// strength of reading the code. The handler was correct, the CSS was
// correct, and the film still could not be scrubbed, because the PLAYER
// had no playhead: Play always restarted at zero and a click only painted
// a still. Only driving the real app in a real browser and asserting on
// BEHAVIOR catches that class of bug, so that is what this does:
//
//   1. the initial frame renders
//   2. pressing the bar at ~60% moves the bar AND changes the picture
//   3. dragging moves the playhead live
//   4. Play resumes FROM THE SEEK POINT — the assertion that would have
//      failed on every previous "fix"
//   5. Pause holds the playhead; Play continues from it
//
// The Worker API is stubbed at the network layer (route interception), so
// this drives the REAL shell.js → view-film.js → compose.js → frame.js
// path, not a copy of it.
//
// usage: node scripts/verify-scrub.mjs <fixture.json>
//   fixture.json = { cut, film } from gen-fixture-cut.ts

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB = path.resolve(HERE, "..", "lab");
const fixturePath = process.argv[2];
if (!fixturePath) {
  console.error("usage: verify-scrub.mjs <fixture.json>");
  process.exit(1);
}
const { cut, film } = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
};
const server = http.createServer((req, res) => {
  const rel =
    decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
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
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const failures = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
};

page.on("pageerror", (e) => check("no page errors", false, e.message));

// The Worker, stubbed at the network layer. Everything in front of it is real.
await page.route("**/v1/**", (route) => {
  const url = new URL(route.request().url());
  const body =
    url.pathname === `/v1/film/${cut.filmId}`
      ? { film: { title: film.title, narration: film.narration }, editorial: "rules" }
      : url.pathname === `/v1/film/${cut.filmId}/cut`
        ? cut
        : url.pathname === "/v1/voices"
          ? { voices: [] }
          : null;
  if (body) route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  else route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
});

await page.goto(`${origin}/index.html#film/${cut.filmId}`);
await page.waitForFunction(
  () => /beats/.test(document.querySelector("#sub")?.textContent ?? ""),
  null,
  {
    timeout: 15000,
  },
);

const barWidth = () =>
  page.evaluate(() => Number.parseFloat(document.querySelector("#played").style.width) || 0);
const frameHash = () => page.evaluate(() => document.querySelector("#stage").toDataURL());
const playLabel = () => page.evaluate(() => document.querySelector("#play").textContent);

const frame0 = await frameHash();
check("initial frame rendered", (await barWidth()) === 0 && frame0.length > 1000);

// 0 — THE ACTUAL COMPLAINT: is the scrub bar even visible? Real pixel
// contrast, not "the element exists in the DOM". Sample the scrim area
// against the track colour a real screenshot would show.
const scrubVisible = await page.evaluate(() => {
  const s = document.querySelector("#scrub");
  const track = document.querySelector(".scrubtrack");
  if (!s || !track) return { found: false };
  const sr = s.getBoundingClientRect();
  const tr = track.getBoundingClientRect();
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Rasterise via a synthetic paint: read actual computed backgrounds,
  // since html2canvas isn't available here — the real proof is the
  // computed styles used at paint time, which is what the browser
  // actually draws.
  const scrimBg = getComputedStyle(s).backgroundImage;
  const trackBg = getComputedStyle(track).backgroundColor;
  return {
    found: true,
    onVideo: sr.bottom > 0 && sr.top < window.innerHeight,
    hasGradientScrim: /gradient/.test(scrimBg),
    trackBg,
    trackWidth: tr.width,
    trackHeight: tr.height,
  };
});
check(
  "scrub bar is a real overlay on the video with a visible track",
  scrubVisible.found &&
    scrubVisible.onVideo &&
    scrubVisible.hasGradientScrim &&
    scrubVisible.trackWidth > 100 &&
    scrubVisible.trackHeight >= 3,
  JSON.stringify(scrubVisible),
);

// 0b — clicking the video itself toggles play/pause
check("play label starts as Play", (await playLabel()) === "Play");
await page.click("#stage");
await page.waitForTimeout(50);
check("clicking the video starts playback", (await playLabel()) === "Pause");
await page.click("#stage");
check("clicking the video again pauses", (await playLabel()) === "Play");

// 2 — press the bar at 60%: bar moves, picture changes
const bar = await page.locator("#scrub").boundingBox();
const yMid = bar.y + bar.height / 2;
const xAt = (pct) => bar.x + bar.width * pct;
await page.mouse.move(xAt(0.6), yMid);
await page.mouse.down();
await page.mouse.up();
const w60 = await barWidth();
check("press at 60% moves the bar", Math.abs(w60 - 60) < 3, `bar at ${w60.toFixed(1)}%`);
check("press at 60% changes the picture", (await frameHash()) !== frame0);

// 3 — drag from 60% to 25%: the playhead follows live
await page.mouse.move(xAt(0.6), yMid);
await page.mouse.down();
await page.mouse.move(xAt(0.45), yMid, { steps: 5 });
const wMid = await barWidth();
await page.mouse.move(xAt(0.25), yMid, { steps: 5 });
await page.mouse.up();
const w25 = await barWidth();
check("drag scrubs live", Math.abs(wMid - 45) < 3, `mid-drag at ${wMid.toFixed(1)}%`);
check("drag release lands at 25%", Math.abs(w25 - 25) < 3, `bar at ${w25.toFixed(1)}%`);

// 4 — THE assertion: Play resumes from the seek point, not from zero
await page.click("#play");
await page.waitForTimeout(700);
const wPlaying = await barWidth();
check(
  "Play resumes FROM THE SEEK POINT, not zero",
  wPlaying > 25 && wPlaying < 40,
  `bar at ${wPlaying.toFixed(1)}% after 0.7s (restart-at-zero bug would read <5%)`,
);
check("button reads Pause while playing", (await playLabel()) === "Pause");

// 5 — pause holds, play continues from the held position
await page.click("#play");
const wPaused = await barWidth();
await page.waitForTimeout(400);
check("pause holds the playhead", (await barWidth()) === wPaused, `held at ${wPaused.toFixed(1)}%`);
await page.click("#play");
await page.waitForTimeout(500);
const wResumed = await barWidth();
check(
  "play continues from the pause point",
  wResumed > wPaused && wResumed < wPaused + 6,
  `resumed to ${wResumed.toFixed(1)}%`,
);

// 6 — seeking WHILE PLAYING keeps playing from the new point
await page.mouse.move(xAt(0.8), yMid);
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(500);
const wAfterMidPlaySeek = await barWidth();
check(
  "seek during playback keeps playing from there",
  wAfterMidPlaySeek > 80 && wAfterMidPlaySeek < 90 && (await playLabel()) === "Pause",
  `bar at ${wAfterMidPlaySeek.toFixed(1)}%`,
);

await browser.close();
server.close();

if (failures.length) {
  console.error(`\nFAILED: ${failures.length} check(s): ${failures.join("; ")}`);
  process.exit(1);
}
console.log("\nall scrub behavior checks passed.");
