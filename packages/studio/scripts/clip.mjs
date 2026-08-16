// CLIP — record the film as an actual moving picture, WITH ITS VOICE.
//
// `look.mjs` writes stills, and stills cannot answer the only question that
// matters about a film. This drives the REAL compositor and the REAL
// renderer in a browser and records the canvas as it plays, so what comes
// out is what the engine actually does over time.
//
// TWO THINGS CHANGED HERE AND BOTH MATTER.
//
// 1. IT RECORDS FROM INSIDE THE PAGE. Playwright's own `recordVideo`
//    captures the VIEWPORT and cannot capture audio at all — so every clip
//    ever sent from this sandbox was a re-encode of a scaled screenshot
//    stream, silent. It now uses `canvas.captureStream()` and MediaRecorder,
//    which is the same path `lab/export/encode.js` uses in the product: the
//    canvas at its own 1280×720, vp9 at 9Mbit, and the browser muxing the
//    voice onto its own track.
//
// 2. IT PLAYS THE NARRATION. `lab/export/voice.js` is imported directly
//    rather than reimplemented — there is no second engine here either. If
//    the cut carries no voice the film records silent, exactly as before.
//
// Give it a cut built with `NARRATION=<dir>` and point `--vo` at the same
// directory.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = await import("playwright-core").catch(() => import("playwright"));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB = process.env.LAB_DIR || path.resolve(HERE, "..", "lab");
const [cutPath, outPath] = process.argv.slice(2);
if (!cutPath || !outPath) {
  console.error("usage: clip.mjs <cut.json> <out.webm> [--from 0 --to 20000] [--vo <dir>]");
  process.exit(1);
}
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? Number(process.argv[i + 1]) : d;
};
const str = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const FROM = arg("from", 0);
const TO = arg("to", 20000);
const VO = str("vo", null);

/* ── the duration the browser does not write ─────────────────────────
 *
 * MediaRecorder streams: its Segment is unknown-length and its Info block
 * carries no Duration, because when the header is written the recording
 * has not happened yet. Every player therefore reports the file as having
 * no length — no seek bar, no total time, and in some players no scrubbing
 * at all. Chrome plays it, which is exactly why this is easy to ship and
 * not notice.
 *
 * Splicing one Duration element into Info fixes it. It is safe here for a
 * reason worth stating: this file has no SeekHead and no Cues, so nothing
 * in it holds an absolute byte offset that shifting the rest by eleven
 * bytes would invalidate, and the Segment's own size is already UNKNOWN so
 * it does not need rewriting either. Both facts are checked, not assumed —
 * if either stops being true the patch declines and the file is left as
 * the browser wrote it.
 */
function readId(b, at) {
  const m = b[at];
  let len = 1;
  for (let i = 7; i >= 0; i--) {
    if (m & (1 << i)) {
      len = 8 - i;
      break;
    }
  }
  let v = 0;
  for (let i = 0; i < len; i++) v = v * 256 + b[at + i];
  return { v, len };
}
function readSize(b, at) {
  const m = b[at];
  let len = 1;
  for (let i = 7; i >= 0; i--) {
    if (m & (1 << i)) {
      len = 8 - i;
      break;
    }
  }
  let v = m & ((1 << (8 - len)) - 1);
  let unknown = v === (1 << (8 - len)) - 1;
  for (let i = 1; i < len; i++) {
    v = v * 256 + b[at + i];
    if (b[at + i] !== 0xff) unknown = false;
  }
  return { v, len, unknown };
}
function writeSize(n) {
  for (let len = 1; len <= 8; len++) {
    if (n < 2 ** (7 * len) - 1) {
      const out = Buffer.alloc(len);
      let v = n;
      for (let i = len - 1; i >= 0; i--) {
        out[i] = v & 0xff;
        v = Math.floor(v / 256);
      }
      out[0] |= 1 << (8 - len);
      return out;
    }
  }
  throw new Error("size too large");
}

function patchDuration(file, ms) {
  const b = fs.readFileSync(file);
  let at = 0;
  // EBML header, then Segment.
  const head = readId(b, at);
  if (head.v !== 0x1a45dfa3) return "no EBML header";
  const headSize = readSize(b, at + head.len);
  at += head.len + headSize.len + headSize.v;
  const seg = readId(b, at);
  if (seg.v !== 0x18538067) return "no Segment";
  const segSize = readSize(b, at + seg.len);
  if (!segSize.unknown) return "Segment has a known size — not patching";

  let p = at + seg.len + segSize.len;
  while (p < b.length) {
    const cid = readId(b, p);
    const csz = readSize(b, p + cid.len);
    if (cid.v === 0x114d9b74) return "the file has a SeekHead — not patching";
    if (cid.v === 0x1c53bb6b) return "the file has Cues — not patching";
    if (cid.v === 0x1549a966) {
      const start = p + cid.len + csz.len;
      let scale = 1_000_000;
      for (let q = start; q < start + csz.v; ) {
        const gi = readId(b, q);
        const gs = readSize(b, q + gi.len);
        if (gi.v === 0x4489) return "already has a Duration";
        if (gi.v === 0x2ad7b1) {
          scale = 0;
          for (let k = 0; k < gs.v; k++) scale = scale * 256 + b[q + gi.len + gs.len + k];
        }
        q += gi.len + gs.len + gs.v;
      }
      const dur = Buffer.alloc(11);
      dur.writeUInt16BE(0x4489, 0);
      dur[2] = 0x88; // an 8-byte payload
      dur.writeDoubleBE((ms * 1e6) / scale, 3);
      const grown = Buffer.concat([
        b.subarray(0, p + cid.len),
        writeSize(csz.v + dur.length),
        b.subarray(p + cid.len + csz.len, start),
        dur,
        b.subarray(start),
      ]);
      fs.writeFileSync(file, grown);
      return null;
    }
    // A Cluster means Info never appeared.
    if (cid.v === 0x1f43b675) return "no Info block before the first Cluster";
    p += cid.len + csz.len + csz.v;
  }
  return "ran off the end of the file";
}

const cut = JSON.parse(fs.readFileSync(cutPath, "utf8"));
const narrated = Boolean(cut.voice && VO);
if (cut.voice && !VO) {
  console.error("this cut carries voice but no --vo <dir> was given — recording silent");
}

const html = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="fonts.css">
<style>html,body{margin:0;background:#000;overflow:hidden}
canvas{display:block;width:100vw;height:auto}</style>
<body><canvas id="c" width="1280" height="720"></canvas><script type="module">
import { buildStages } from "./comp/compose.js";
import { drawFrame, prepareFilm } from "./paint/frame.js";
import { loadVoice, voiceTrack } from "./export/voice.js";

window.__run = async (cut, fromMs, toMs, useVoice) => {
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load('400 100px "Archivo Black"'),
    document.fonts.load('700 100px "Space Grotesk"'),
    document.fonts.load('500 100px "Space Grotesk"'),
    document.fonts.load('400 100px "Newsreader"'),
    document.fonts.load('500 100px "JetBrains Mono"'),
  ]);
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const film = prepareFilm(cut, buildStages(cut));

  // THE VOICE, decoded before a single frame is written. A span that
  // arrives late is a span the film plays over in silence.
  let voice = null;
  let loaded = { loaded: 0, total: 0, failed: [] };
  if (useVoice && cut.voice) {
    loaded = await loadVoice(cut);
    voice = voiceTrack(cut);
    if (voice) await voice.resume();
  }

  const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(
    (m) => MediaRecorder.isTypeSupported(m),
  );
  const stream = canvas.captureStream(cut.fps);
  if (voice?.track) stream.addTrack(voice.track);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 9_000_000 });

  // Chunks leave the page as they arrive rather than as one blob at the
  // end: a two-minute film at 9Mbit is well past what survives a single
  // structured-clone hop, and holding it costs memory the render wants.
  let tail = Promise.resolve();
  rec.ondataavailable = (e) => {
    if (!e.data.size) return;
    tail = tail.then(
      () =>
        new Promise((done) => {
          const fr = new FileReader();
          fr.onload = async () => {
            // Split on the MARKER, not on the first comma: the mime type
            // is "video/webm;codecs=vp9,opus" and contains one, so the
            // naive split hands seven bytes per chunk to a file that then
            // looks written and plays as nothing.
            const url = String(fr.result);
            await window.__chunk(url.slice(url.indexOf("base64,") + 7));
            done();
          };
          fr.readAsDataURL(e.data);
        }),
    );
  };

  rec.start(800);
  // Started AFTER the recorder, never before — a schedule laid down first
  // opens the film mid-sentence.
  const sources = voice ? voice.begin() : [];

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

  for (const s of sources) {
    try { s.stop(); } catch { /* already finished */ }
  }
  await new Promise((r) => setTimeout(r, 300));
  rec.stop();
  await new Promise((r) => (rec.onstop = r));
  await tail;
  return { spans: loaded.loaded, total: loaded.total, failed: loaded.failed, mime };
};
</script></body>`;
fs.writeFileSync(path.join(LAB, "__clip.html"), html);

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
};
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "");
  // The narration lives outside the Lab, under the same convention
  // `mkcut.ts` writes onto the cut.
  const root = rel.startsWith("__vo/") ? VO : LAB;
  const file = root ? path.join(root, rel.startsWith("__vo/") ? rel.slice(5) : rel) : null;
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
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
const browser = await chromium.launch({
  headless: true,
  ...(EXE ? { executablePath: EXE } : {}),
  // Without this the AudioContext starts suspended and the film records
  // silent while reporting every span loaded.
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("[pageerror]", e.message));

fs.rmSync(outPath, { force: true });
const out = fs.createWriteStream(outPath);
let bytes = 0;
await page.exposeFunction("__chunk", (b64) => {
  const buf = Buffer.from(b64, "base64");
  bytes += buf.length;
  out.write(buf);
});

await page.goto(`${origin}/__clip.html`);
console.log(
  `recording ${((TO - FROM) / 1000).toFixed(1)}s${narrated ? " with voice" : " silent"} …`,
);
const wallStart = Date.now();
const report = await page.evaluate(
  ([c, a, b, v]) => window.__run(c, a, b, v),
  [cut, FROM, TO, narrated],
  { timeout: 0 },
);
await ctx.close();
await browser.close();
server.close();
fs.unlinkSync(path.join(LAB, "__clip.html"));
await new Promise((r) => out.end(r));
const refused = patchDuration(outPath, Date.now() - wallStart);

for (const f of report.failed ?? []) console.error(`  voice failed — ${f}`);
if (refused) console.error(`  no duration written — ${refused}`);
const said = narrated ? ` · ${report.spans}/${report.total} spans of voice` : "";
console.log(`wrote ${outPath} (${(bytes / 1e6).toFixed(2)} MB, ${report.mime})${said}`);
