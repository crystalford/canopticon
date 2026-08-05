// Full-video transcription — the ingestion counterpart to fetch-clip.ts's
// yt-dlp usage. Downloads a video's AUDIO TRACK ONLY (not the video —
// cheaper, and only the audio is needed) plus its publish metadata, then
// runs whisperx WITHOUT forced alignment (--no_align). whisperx.ts's
// alignment is for caption sync on short clips; a 60-minute commentary
// video just needs the plain text, and skipping alignment is faster.
//
// Two output modes, both skip --align (word-level WAV2VEC2 alignment is
// unnecessary cost/precision for either use case — that's reserved for
// caption sync in whisperx.ts): plain text (`--output_format txt`, the
// original reading-ingestion use case, no timestamps at all) and
// timestamped (`--output_format json`, the reaction-video tool's point-
// segmentation use case) — WhisperX's base decode already emits
// segment-level start/end times as part of its normal JSON output, no
// forced-alignment pass required to get them.
//
// File discovery is directory-scanned rather than assuming an exact
// output filename — yt-dlp's --write-info-json naming (with
// --extract-audio active) and whisperx's output naming have both varied
// across versions, and this hasn't been exercised against a real video
// yet. Scanning by extension is the defensive choice until that's
// confirmed live.

import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TranscriptSegment {
  text: string;
  start_s: number;
  end_s: number;
}

export interface TranscribeResult {
  ok: boolean;
  transcript?: string | undefined;
  segments?: TranscriptSegment[] | undefined;
  title?: string | undefined;
  channel?: string | undefined;
  published_at?: string | null | undefined;
  duration_s?: number | undefined;
  source_url?: string | undefined;
  error?: string | undefined;
}

interface YtDlpInfo {
  title?: string;
  uploader?: string;
  channel?: string;
  upload_date?: string; // YYYYMMDD
  duration?: number;
}

/** WhisperX's own JSON output shape (undocumented publicly, confirmed
 *  from the whisperx source: a top-level `segments` array, each with at
 *  least `start`/`end`/`text` — `words` is only populated when --align
 *  ran, which this call deliberately skips). */
interface WhisperXJson {
  segments?: Array<{ start?: number; end?: number; text?: string }>;
}

export async function transcribeVideoUrl(
  url: string,
  opts: { timestamped?: boolean } = {},
): Promise<TranscribeResult> {
  const workDir = join(tmpdir(), `transcribe-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  await mkdir(workDir, { recursive: true });
  const outBase = join(workDir, "audio");
  const timestamped = opts.timestamped === true;

  try {
    const ytErr = await runYtDlp(url, outBase);
    if (ytErr) return { ok: false, error: `yt-dlp: ${ytErr}` };

    const files = await readdir(workDir).catch(() => [] as string[]);
    const audioName = files.find((f) => f.endsWith(".mp3"));
    if (!audioName) return { ok: false, error: "yt-dlp produced no audio file" };
    const audioPath = join(workDir, audioName);

    const infoName = files.find((f) => f.endsWith(".info.json"));
    let info: YtDlpInfo = {};
    if (infoName) {
      try {
        info = JSON.parse(await readFile(join(workDir, infoName), "utf8")) as YtDlpInfo;
      } catch {
        // non-fatal — metadata is best-effort, the transcript is what matters
      }
    }

    const wxErr = await runWhisperX(audioPath, workDir, timestamped ? "json" : "txt");
    if (wxErr) return { ok: false, error: `whisperx: ${wxErr}` };

    const postFiles = await readdir(workDir).catch(() => [] as string[]);
    const common = {
      title: info.title ?? undefined,
      channel: info.channel ?? info.uploader ?? undefined,
      published_at: parseUploadDate(info.upload_date),
      duration_s: info.duration ?? undefined,
      source_url: url,
    };

    if (timestamped) {
      const jsonName = postFiles.find((f) => f.endsWith(".json"));
      if (!jsonName) return { ok: false, error: "whisperx produced no timestamped output file" };
      let parsed: WhisperXJson;
      try {
        parsed = JSON.parse(await readFile(join(workDir, jsonName), "utf8")) as WhisperXJson;
      } catch (err) {
        return { ok: false, error: `whisperx json parse failed: ${(err as Error).message}` };
      }
      const segments = (parsed.segments ?? [])
        .filter((s) => typeof s.text === "string" && s.text.trim())
        .map((s) => ({
          text: (s.text ?? "").trim(),
          start_s: s.start ?? 0,
          end_s: s.end ?? s.start ?? 0,
        }));
      if (segments.length === 0) return { ok: false, error: "whisperx produced no segments" };
      return {
        ok: true,
        segments,
        transcript: segments.map((s) => s.text).join(" "),
        ...common,
      };
    }

    const txtName = postFiles.find((f) => f.endsWith(".txt"));
    if (!txtName) return { ok: false, error: "whisperx produced no transcript file" };
    const transcript = (await readFile(join(workDir, txtName), "utf8")).trim();
    if (!transcript) return { ok: false, error: "whisperx produced an empty transcript" };

    return { ok: true, transcript, ...common };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function parseUploadDate(raw: string | undefined): string | null {
  if (!raw || raw.length !== 8) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function runYtDlp(url: string, outBase: string): Promise<string | null> {
  return run("yt-dlp", [
    "-f",
    "bestaudio",
    "--extract-audio",
    "--audio-format",
    "mp3",
    "--write-info-json",
    "--no-playlist",
    "--no-progress",
    "--socket-timeout",
    "30",
    "-o",
    `${outBase}.%(ext)s`,
    url,
  ]);
}

function runWhisperX(
  audioPath: string,
  outDir: string,
  format: "txt" | "json",
): Promise<string | null> {
  return run("whisperx", [
    audioPath,
    "--model",
    "large-v3-turbo",
    "--no_align",
    "--language",
    "en",
    "--output_format",
    format,
    "--output_dir",
    outDir,
    "--compute_type",
    "int8",
  ]);
}

/** Run a CLI, capture stderr on failure. Returns null on success or a
 *  truncated stderr blob on non-zero exit. Same shape as fetch-clip.ts's
 *  helper — kept local rather than shared to avoid coupling two
 *  independent call sites to one signature. */
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
