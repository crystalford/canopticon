// yt-dlp + ffmpeg clip fetch — the missing piece that turns the
// pipeline from "renders fixture clips" into "renders today's actual
// broadcast footage." Triggered inside the Container before Remotion
// bundles the comp.
//
// The §7b segment's beats can carry clip URLs in three shapes:
//   - local fixture path: "fixtures/carney-clip.mp4"   → use as-is
//   - r2:// key: "r2://clips/cand-xxx.mp4"             → resolve via R2
//   - https://... URL pointing at an IA TV News page,
//     a broadcaster page, or any HLS .m3u8           → yt-dlp it
//
// Phase 1B adds the third path. yt-dlp + ffmpeg run as child processes
// inside the Container (both installed in the Dockerfile). Output is
// a trimmed MP4 written to /tmp matching the beat's in_s/out_s, so the
// renderer can OffthreadVideo it without any further work.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

export interface ClipFetchResult {
  ok: boolean;
  localPath?: string;
  bytes?: number;
  error?: string;
}

const CACHE_DIR = "/tmp/canopticon-clips";

/** Download a clip URL via yt-dlp + trim with ffmpeg. Returns the
 *  local MP4 path the Remotion <OffthreadVideo> can read. */
export async function fetchAndTrimClip(args: {
  url: string;
  in_s: number;
  out_s: number;
  cacheKey?: string;
}): Promise<ClipFetchResult> {
  if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true });
  const key = args.cacheKey ?? hashUrl(args.url);
  const fullPath = join(CACHE_DIR, `${key}.full.mp4`);
  const trimmedPath = join(CACHE_DIR, `${key}.${args.in_s}-${args.out_s}.mp4`);

  // Already trimmed? Reuse it — yt-dlp is the expensive step.
  if (existsSync(trimmedPath)) {
    const s = await stat(trimmedPath);
    return { ok: true, localPath: trimmedPath, bytes: s.size };
  }

  // Fetch via yt-dlp if we don't already have the full clip cached.
  if (!existsSync(fullPath)) {
    const ytErr = await runYtDlp(args.url, fullPath);
    if (ytErr) return { ok: false, error: `yt-dlp: ${ytErr}` };
  }

  // Trim with ffmpeg — accurate seek (no -ss before -i shortcut),
  // re-encode to H.264 + AAC at a consistent bitrate so the
  // OffthreadVideo decoder doesn't choke on odd source codecs.
  const ffErr = await runFfmpegTrim(fullPath, trimmedPath, args.in_s, args.out_s);
  if (ffErr) return { ok: false, error: `ffmpeg: ${ffErr}` };

  const s = await stat(trimmedPath);
  return { ok: true, localPath: trimmedPath, bytes: s.size };
}

function runYtDlp(url: string, outPath: string): Promise<string | null> {
  return run("yt-dlp", [
    // Prefer mp4 for compatibility with the trimmer; fall back to bv*+ba
    // and merge if mp4 isn't an option.
    "-f",
    "best[ext=mp4]/bv*+ba/best",
    "--merge-output-format",
    "mp4",
    "--no-playlist",
    "--no-progress",
    "--socket-timeout",
    "30",
    "-o",
    outPath,
    url,
  ]);
}

function runFfmpegTrim(
  inputPath: string,
  outputPath: string,
  inS: number,
  outS: number,
): Promise<string | null> {
  const duration = Math.max(0.1, outS - inS);
  return run("ffmpeg", [
    "-y", // overwrite
    "-ss",
    String(inS),
    "-i",
    inputPath,
    "-t",
    String(duration),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

/** Run a CLI, capture stderr on failure. Returns null on success or a
 *  truncated stderr blob on non-zero exit. */
function run(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (code === 0) return resolve(null);
      resolve(stderr.slice(-400) || `exit ${code}`);
    });
    child.on("error", (err: Error) => resolve(err.message));
  });
}

function hashUrl(url: string): string {
  return Array.from(url)
    .reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0)
    .toString(36)
    .replace(/-/g, "n");
}
