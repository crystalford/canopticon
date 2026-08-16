// LOCAL NARRATION — so the sandbox can hear the film, and so the picture
// is cut against MEASURED speech rather than a guess.
//
// WHAT THIS IS NOT. It is not the product's TTS. The film's voice is
// `@cf/deepgram/aura-1` through the Workers AI binding, spoken once at
// authoring time by `src/narrate/`, hashed into R2 and frozen — and that
// binding does not exist outside the deployed Worker. Nothing in `src/`
// imports this file and nothing ever should.
//
// WHY IT EXISTS ANYWAY. Every clip made in this sandbox has been silent,
// and worse, cut against `estimateSpine` — a 150-words-per-minute guess off
// character counts. So the one claim the whole engine rests on, that the
// picture answers to the voice, has never been checked here. It could only
// be checked after a deploy, which is exactly the loop this repo's scripts
// exist to avoid.
//
// So: espeak-ng speaks it locally. The voice is robotic and nobody should
// judge the film's SOUND by it. What is real is the TIMING — where a
// sentence ends, how long a clause takes, where the breath falls — and the
// timing is what the cut consumes.
//
// HOW THE WORD TIMINGS ARE OBTAINED, stated exactly, because a measurement
// described loosely is a measurement nobody can check:
//
//   · The span's TOTAL duration is read off the rendered wav. Measured.
//   · Each word's SHARE of that total is its own solo synthesis duration,
//     less a self-calibrated per-utterance overhead, plus a pause weight at
//     punctuation. Modelled — espeak's own duration model, not mine, and
//     not a character count.
//
// That is `espeak-proportional`, and it is written onto the manifest under
// that name so no downstream reader can mistake it for forced alignment.
// The production path is `asr-proportional` and is a different, better
// thing; this is the sandbox's stand-in for it.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { readEssayStructurally } from "../src/editor/rules.ts";
import { planSpans } from "../src/narrate/spans.ts";

const [essayPath, outDir] = process.argv.slice(2);
if (!essayPath || !outDir) {
  console.error("usage: narrate.mjs <essay.md> <outDir>");
  process.exit(1);
}

const WPM = Number(process.env.EWPM || 150);
const GAP_MS = 320; // the rest between spans — matches buildSpine's own

/* ── espeak ─────────────────────────────────────────────────────────── */

let VOICE = process.env.EVOICE || "";

function speakWith(voice, text, wav) {
  execFileSync("espeak-ng", ["-v", voice, "-s", String(WPM), "-w", wav, "--", text], {
    stdio: ["ignore", "ignore", "pipe"],
  });
}

/** Prefer the diphone voice if its data is installed — the formant
 *  synthesiser is a good clock and a poor speaker, and while nobody should
 *  judge the film's SOUND by either, a voice that can be listened to for
 *  two minutes without effort makes the timing easier to judge. Falls back
 *  rather than failing, since neither is a dependency of anything real. */
function pickVoice(probe) {
  for (const v of [VOICE, "mb-en1", "en-gb"].filter(Boolean)) {
    try {
      speakWith(v, "the", probe);
      if (fs.statSync(probe).size > 1000) return v;
    } catch {
      // Not installed. Try the next.
    }
  }
  throw new Error("espeak-ng cannot speak — install it, or narrate after deploy");
}

function speak(text, wav) {
  speakWith(VOICE, text, wav);
}

/** Duration in ms, from the wav's own header. Parsed rather than assumed:
 *  espeak's sample rate is a build-time property of the voice. */
function wavMs(file) {
  const b = fs.readFileSync(file);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`${file} is not a wav`);
  }
  let at = 12;
  let byteRate = 0;
  while (at + 8 <= b.length) {
    const id = b.toString("ascii", at, at + 4);
    const size = b.readUInt32LE(at + 4);
    if (id === "fmt ") byteRate = b.readUInt32LE(at + 16);
    if (id === "data") return byteRate ? Math.round((size / byteRate) * 1000) : 0;
    at += 8 + size + (size % 2);
  }
  return 0;
}

const tmp = path.join(outDir, ".tmp.wav");
const soloCache = new Map();

function soloMs(word) {
  const cached = soloCache.get(word);
  if (cached !== undefined) return cached;
  speak(word, tmp);
  const ms = wavMs(tmp);
  soloCache.set(word, ms);
  return ms;
}

fs.mkdirSync(outDir, { recursive: true });
VOICE = pickVoice(tmp);

/** THE OVERHEAD, MEASURED NOT ASSUMED.
 *
 *  Every espeak utterance carries a fixed lead-in and tail. Left in, it
 *  would be added once per word, which inflates short words by a large
 *  fraction of their own length and makes "the" as long as "surveillance".
 *  Ten of a word against one of it isolates the constant. */
speak("the the the the the the the the the the", tmp);
const ten = wavMs(tmp);
const one = soloMs("the");
const OVERHEAD = Math.max(0, Math.round((10 * one - ten) / 9));

/* ── the spans ──────────────────────────────────────────────────────── */

const essay = fs.readFileSync(essayPath, "utf8");
const editorial = readEssayStructurally(essay);
const spans = planSpans(essay, editorial);

/** A pause weight, in the same units as a word's, for what follows a
 *  token. espeak really does render these inside the span, so leaving them
 *  out would push every word after a full stop early. */
function punctWeight(token) {
  if (/[.!?]["')\]]?$/.test(token)) return 380;
  if (/[;:—–]$/.test(token)) return 260;
  if (/,$/.test(token)) return 170;
  return 0;
}

const manifest = { method: "espeak-proportional", voice: VOICE, wpm: WPM, spans: [] };
let cursor = 0;

for (const span of spans) {
  const wav = `${span.spanId}.wav`;
  speak(span.text, path.join(outDir, wav));
  const durationMs = wavMs(path.join(outDir, wav));

  const tokens = span.text.split(/\s+/).filter(Boolean);
  const weights = tokens.map((t) => {
    const bare = t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "") || t;
    return Math.max(40, soloMs(bare.toLowerCase()) - OVERHEAD);
  });
  const gaps = tokens.map(punctWeight);
  const total = weights.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
  const scale = total > 0 ? durationMs / total : 0;

  const words = [];
  let at = 0;
  for (let i = 0; i < tokens.length; i++) {
    const w = weights[i] * scale;
    words.push({
      word: tokens[i],
      startMs: Math.round(at),
      endMs: Math.round(at + w),
    });
    at += w + gaps[i] * scale;
  }

  manifest.spans.push({
    spanId: span.spanId,
    text: span.text,
    range: span.range,
    wav,
    startMs: cursor,
    durationMs,
    words,
  });
  cursor += durationMs + GAP_MS;
}

fs.rmSync(tmp, { force: true });
fs.writeFileSync(path.join(outDir, "narration.json"), JSON.stringify(manifest, null, 1));

const secs = (cursor - GAP_MS) / 1000;
console.log(
  `${manifest.spans.length} spans · ${Math.floor(secs / 60)}m${String(Math.round(secs % 60)).padStart(2, "0")}s ` +
    `· ${manifest.spans.reduce((n, s) => n + s.words.length, 0)} words ` +
    `· overhead ${OVERHEAD}ms · ${outDir}`,
);
