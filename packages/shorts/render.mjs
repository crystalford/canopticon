// Render a spec to a video, in the v13 look (2026-11-28): 24 fps, four
// sub-frames over a half-open shutter for motion blur, a soft bloom, a little
// grain. Each 20-second part is encoded on its own and renamed only when
// ffmpeg finishes, then the parts are joined without re-encoding.
//
//   node render.mjs <spec.json> <out.mp4>
//
// Nothing schedules this; it runs when a person runs it.

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)("playwright");
const [specPath, outPath] = process.argv.slice(2).map((p) => resolve(p));
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const work = `${outPath}.parts`;
mkdirSync(work, { recursive: true });

const FPS = 24;
const SUB = 4;
const SHUTTER = 0.5;
const CHUNK = 20;
const VF = `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB,format=gbrp,split[a][b];[b]colorlevels=rimin=0.4:gimin=0.4:bimin=0.4,gblur=sigma=28[g];[a][g]blend=all_mode=screen:all_opacity=0.6,eq=contrast=1.06:saturation=1.12,noise=alls=5:allf=t,format=yuv420p`;

const run = (args) =>
  new Promise((ok, fail) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
    p.on("close", (c) => (c === 0 ? ok() : fail(new Error(`ffmpeg exited ${c}`))));
  });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(`file://${join(here, "player.html")}`);
await page.evaluate((s) => setSpec(s), spec);
await page.evaluate(() => document.fonts.ready);
const total = await page.evaluate(() => SPEC.total);
const frames = Math.round(total * FPS);
const per = CHUNK * FPS;
const parts = [];
for (let c = 0; c * per < frames; c++) {
  const tmp = join(work, `part-${c}.tmp.mp4`);
  const ff = spawn("ffmpeg", [
    ...["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS * SUB)],
    ...["-c:v", "mjpeg", "-i", "-", "-vf", VF, "-r", String(FPS)],
    ...["-c:v", "libx264", "-preset", "veryfast", "-b:v", "4M", "-maxrate", "6M", "-bufsize", "8M"],
    ...["-pix_fmt", "yuv420p", tmp],
  ]);
  for (let f = c * per; f < Math.min(frames, (c + 1) * per); f++)
    for (let j = 0; j < SUB; j++) {
      const T = Math.min(total - 0.001, (f + (j / SUB) * SHUTTER) / FPS);
      await page.evaluate((T) => render(T), T);
      const buf = await page.screenshot({ type: "jpeg", quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    }
  ff.stdin.end();
  if ((await new Promise((r) => ff.on("close", r))) !== 0) throw new Error(`part ${c} failed`);
  renameSync(tmp, join(work, `part-${c}.mp4`));
  parts.push(`file 'part-${c}.mp4'`);
  console.log(`part ${c + 1} of ${Math.ceil(frames / per)}`);
}
await browser.close();
writeFileSync(join(work, "list.txt"), `${parts.join("\n")}\n`);
const tmpOut = `${outPath}.tmp.mp4`;
await run([
  "-y",
  "-loglevel",
  "error",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  join(work, "list.txt"),
  "-c",
  "copy",
  "-movflags",
  "+faststart",
  tmpOut,
]);
renameSync(tmpOut, outPath);
console.log(`done: ${outPath} (${total.toFixed(1)}s)`);
