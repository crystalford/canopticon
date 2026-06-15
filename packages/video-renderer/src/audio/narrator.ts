// MiniMax Speech 2.8 HD narrator — turns a VO line into audio bytes.
// Called from the renderer's audio mix pipeline once per voiced beat.
//
// The voice_id is the operator's trained clone (see voice_profile in
// the Worker's D1). Cached per (voice_id, text) hash so repeated runs
// of the same segment don't re-bill.
//
// Falls back to a silent track when the API key isn't configured so
// the render still completes — the operator sees an audio-less video
// and can fix the key without code changes.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CACHE_DIR = "/tmp/canopticon-narrator";
const MINIMAX_TTS_URL = "https://api.minimaxi.chat/v1/t2a_v2";

interface NarrateArgs {
  text: string;
  voice_id: string;
  apiKey?: string | undefined;
}

export interface NarrateResult {
  ok: boolean;
  mp3Path?: string;
  cached?: boolean;
  error?: string;
}

export async function narrate(args: NarrateArgs): Promise<NarrateResult> {
  if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true });
  const key = hash(`${args.voice_id}|${args.text}`);
  const outPath = join(CACHE_DIR, `${key}.mp3`);
  if (existsSync(outPath)) return { ok: true, mp3Path: outPath, cached: true };

  // No API key → emit a silent MP3 placeholder so the mix pipeline
  // still produces a valid output. The Worker logs "narrator not
  // configured" so the operator knows what to fix.
  if (!args.apiKey) {
    const silent = await emitSilence(outPath, estimateDurationMs(args.text));
    return silent.ok
      ? { ok: true, mp3Path: outPath, cached: false }
      : { ok: false, error: silent.error ?? "silence failed" };
  }

  try {
    const res = await fetch(MINIMAX_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "speech-02-hd",
        text: args.text,
        voice_setting: {
          voice_id: args.voice_id,
          speed: 1.0,
          vol: 1.0,
          emotion: "neutral",
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: "mp3",
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `minimax ${res.status}: ${text.slice(0, 200)}` };
    }
    const arrayBuf = await res.arrayBuffer();
    await writeFile(outPath, Buffer.from(arrayBuf));
    return { ok: true, mp3Path: outPath, cached: false };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function hash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 24);
}

/** Rough WPM estimate so the silent fallback has a duration roughly
 *  matching what the real voiceover would land at. 150 WPM = 400 ms /
 *  word. */
function estimateDurationMs(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(800, words * 400);
}

async function emitSilence(
  outPath: string,
  durationMs: number,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=32000",
        "-t",
        String(durationMs / 1000),
        "-c:a",
        "libmp3lame",
        "-b:a",
        "128k",
        outPath,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8");
    });
    child.on("close", (code) => {
      if (code === 0) return resolve({ ok: true });
      resolve({ ok: false, error: stderr.slice(-300) });
    });
    child.on("error", (err: Error) => resolve({ ok: false, error: err.message }));
  });
}

/** Read an MP3 written by narrate() into a Buffer — used when the mix
 *  pipeline wants the bytes inline. */
export async function readNarrator(mp3Path: string): Promise<Buffer> {
  return readFile(mp3Path);
}
