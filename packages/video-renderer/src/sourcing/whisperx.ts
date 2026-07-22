// WhisperX — word-level forced alignment for caption sync.
//
// Phase 0 used precomputed word timings hardcoded into the segment
// JSON. Phase 1B+ swaps those for real alignments: extract the clip's
// audio, run WhisperX (installed in the Dockerfile), get word-level
// timestamps that match the broadcast audio's actual cadence. The
// renderer's <Caption words={...}> highlights the correct word frame.
//
// WhisperX is a Python module; we spawn it as a CLI. The Container's
// image has whisperx==3.* preinstalled via pip.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface AlignedWord {
  text: string;
  t_in_ms: number;
  t_out_ms: number;
}

export interface AlignResult {
  ok: boolean;
  words?: AlignedWord[];
  error?: string;
}

/** Run WhisperX over a clip path. Returns word-level alignments shifted
 *  to start at `beatOffsetMs` so the caller can drop them straight into
 *  a §7b Caption chrome's `words[]`. */
export async function alignWords(clipPath: string, beatOffsetMs = 0): Promise<AlignResult> {
  if (!existsSync(clipPath)) {
    return { ok: false, error: `clip not found: ${clipPath}` };
  }
  const outDir = join(tmpdir(), `whisperx-${Date.now()}`);
  const outJson = join(outDir, `${basename(clipPath)}.json`);

  const err = await runWhisperX(clipPath, outDir);
  if (err) return { ok: false, error: err };
  if (!existsSync(outJson)) {
    return { ok: false, error: "whisperx produced no output json" };
  }

  try {
    const raw = await readFile(outJson, "utf8");
    const parsed = JSON.parse(raw) as WhisperXOutput;
    const words = flattenWords(parsed, beatOffsetMs);
    return { ok: true, words };
  } catch (e) {
    return { ok: false, error: `parse whisperx json: ${(e as Error).message}` };
  }
}

interface WhisperXWord {
  word?: string;
  start?: number;
  end?: number;
}
interface WhisperXSegment {
  words?: WhisperXWord[];
}
interface WhisperXOutput {
  segments?: WhisperXSegment[];
}

function flattenWords(out: WhisperXOutput, offsetMs: number): AlignedWord[] {
  const result: AlignedWord[] = [];
  for (const seg of out.segments ?? []) {
    for (const w of seg.words ?? []) {
      if (!w.word || w.start == null || w.end == null) continue;
      result.push({
        text: w.word.trim(),
        t_in_ms: Math.round(w.start * 1000) + offsetMs,
        t_out_ms: Math.round(w.end * 1000) + offsetMs,
      });
    }
  }
  return result;
}

function runWhisperX(clipPath: string, outDir: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(
      "whisperx",
      [
        clipPath,
        "--model",
        "large-v3-turbo",
        "--align_model",
        "WAV2VEC2_ASR_LARGE_LV60K_960H",
        "--language",
        "en",
        "--output_format",
        "json",
        "--output_dir",
        outDir,
        "--compute_type",
        "int8",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8");
    });
    child.on("close", (code) => {
      if (code === 0) return resolve(null);
      resolve(stderr.slice(-400) || `whisperx exit ${code}`);
    });
    child.on("error", (err: Error) => resolve(err.message));
  });
}

function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}
