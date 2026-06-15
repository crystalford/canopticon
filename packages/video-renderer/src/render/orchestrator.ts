// Render orchestrator — drives Remotion + ffmpeg to produce a final
// MP4 from the §7b segment JSON.
//
// Pipeline:
//   1. Pre-pass — fetch remote clip URLs via yt-dlp, align captions
//      with WhisperX
//   2. Remotion bundle + render → silent video MP4
//   3. Audio mix — MiniMax narrator per VO beat + ducked broadcast +
//      music bed via ffmpeg complex filter graph
//   4. Mux — combine silent video + final audio → final MP4

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Beat, Segment } from "@canopticon/shared/video/segment-schema";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import { detectBeats, snapToBeat } from "../audio/beats";
import { mixSegmentAudio } from "../audio/mix";
import { fetchAndTrimClip } from "../sourcing/fetch-clip";
import { alignWords } from "../sourcing/whisperx";

export interface RenderResult {
  ok: boolean;
  mp4?: Buffer;
  walltime_ms: number;
  chunks: number;
  clips_fetched: number;
  captions_aligned: number;
  narrator_seconds: number;
  beats_snapped: number;
  error?: string;
}

/** Single-pass render. Bundles the Remotion root, picks the
 *  ForensicSegment composition, calls renderMedia with the segment as
 *  inputProps, reads the MP4 off disk, returns the Buffer. */
export async function renderSegment(segment: Segment): Promise<RenderResult> {
  const t0 = Date.now();
  const workDir = await prepareWorkdir(segment.id);
  const silentVideoPath = join(workDir, "silent.mp4");
  const finalVideoPath = join(workDir, "out.mp4");
  try {
    // 1. Resolve remote clips + WhisperX-align captions.
    const {
      segment: resolved,
      clipsFetched,
      captionsAligned,
      clipPaths,
    } = await resolveRemoteClipsAndAlign(segment);

    // 1b. Beat-sync — detect beats in the music bed (or the first
    // surface clip when there's no bed). Snap the forensic_turn t_in
    // to the nearest beat within a 0.4s window. Per the handoff:
    // sync the turn, not every line.
    let beats_snapped = 0;
    const beatTrack = await detectBeatsForSegment(resolved, clipPaths);
    if (beatTrack?.beats_s?.length) {
      const adjustedBeats: Beat[] = [];
      for (const beat of resolved.beats) {
        if (beat.type === "forensic_turn" || beat.type === "cold_open") {
          const snapped = snapToBeat(beat.t_in_s, beatTrack.beats_s, 0.4);
          if (snapped !== beat.t_in_s) {
            beats_snapped++;
            adjustedBeats.push({ ...beat, t_in_s: snapped });
            continue;
          }
        }
        adjustedBeats.push(beat);
      }
      // The new t_in values can disturb the next beat's t_out; we
      // intentionally leave it — Remotion clips Sequence durations
      // at the next sibling's start anyway.
      resolved.beats = adjustedBeats;
    }

    // 2. Remotion render → silent video.
    const entryPath = resolveRemotionEntry();
    const bundleLocation = await bundle({ entryPoint: entryPath });
    const comps = await getCompositions(bundleLocation, {
      inputProps: { segment: resolved },
    });
    const composition = comps.find((c) => c.id === "ForensicSegment");
    if (!composition) {
      return failure(t0, "ForensicSegment composition not found in bundle");
    }
    const fps = composition.fps;
    const durationInFrames = Math.max(1, Math.round(resolved.length_s * fps));
    await renderMedia({
      composition: { ...composition, durationInFrames },
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: silentVideoPath,
      inputProps: { segment: resolved },
      concurrency: 3,
      chromiumOptions: { gl: "swangle" },
      audioBitrate: "128K",
    });

    // 3. Audio mix — MiniMax narrator + ducked surface + music bed.
    const mix = await mixSegmentAudio({
      segment: resolved,
      clipPaths,
      ...(process.env.MINIMAX_API_KEY ? { minimaxApiKey: process.env.MINIMAX_API_KEY } : {}),
    });

    // 4. Mux silent video + final audio. If the audio mix failed,
    // ship the silent MP4 — the operator can still review the visuals.
    if (mix.ok && mix.audioPath) {
      const muxErr = await muxAudioOntoVideo(silentVideoPath, mix.audioPath, finalVideoPath);
      if (muxErr) {
        // Fall back to silent video on mux failure.
        const mp4 = await readFile(silentVideoPath);
        return {
          ok: true,
          mp4,
          walltime_ms: Date.now() - t0,
          chunks: 1,
          clips_fetched: clipsFetched,
          captions_aligned: captionsAligned,
          narrator_seconds: mix.narrator_seconds ?? 0,
          beats_snapped,
        };
      }
      const mp4 = await readFile(finalVideoPath);
      return {
        ok: true,
        mp4,
        walltime_ms: Date.now() - t0,
        chunks: 1,
        clips_fetched: clipsFetched,
        captions_aligned: captionsAligned,
        narrator_seconds: mix.narrator_seconds ?? 0,
        beats_snapped,
      };
    }
    // Mix failed entirely — return silent.
    const mp4 = await readFile(silentVideoPath);
    return {
      ok: true,
      mp4,
      walltime_ms: Date.now() - t0,
      chunks: 1,
      clips_fetched: clipsFetched,
      captions_aligned: captionsAligned,
      narrator_seconds: 0,
      beats_snapped,
    };
  } catch (err) {
    return failure(t0, (err as Error).message ?? "unknown");
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function detectBeatsForSegment(
  segment: Segment,
  clipPaths: Record<string, string>,
): Promise<{ beats_s: number[] } | null> {
  // Try the music bed first; fall back to the first fetched surface
  // clip so beat-snap still works when there's no bed.
  const bedPath = join("/app/audio-beds", `${segment.music.bed}.mp3`);
  if (existsSync(bedPath)) {
    const r = await detectBeats(bedPath);
    if (r.ok && r.beats_s) return { beats_s: r.beats_s };
  }
  for (const beat of segment.beats) {
    if (beat.clip && clipPaths[beat.clip.src]) {
      const r = await detectBeats(clipPaths[beat.clip.src] as string);
      if (r.ok && r.beats_s) {
        // Shift by the beat's t_in so the beats[] array is in segment
        // wall-clock seconds, not clip-local seconds.
        return { beats_s: r.beats_s.map((b) => b + beat.t_in_s) };
      }
    }
  }
  return null;
}

function muxAudioOntoVideo(
  videoPath: string,
  audioPath: string,
  outPath: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-shortest",
        "-movflags",
        "+faststart",
        outPath,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8");
    });
    child.on("close", (code) => resolve(code === 0 ? null : stderr.slice(-300) || `exit ${code}`));
    child.on("error", (err: Error) => resolve(err.message));
  });
}

function failure(t0: number, error: string): RenderResult {
  return {
    ok: false,
    walltime_ms: Date.now() - t0,
    chunks: 0,
    clips_fetched: 0,
    captions_aligned: 0,
    narrator_seconds: 0,
    beats_snapped: 0,
    error,
  };
}

/** Walk the segment's beats. For each beat whose clip.src is an
 *  https:// URL, fetch via yt-dlp + trim to the beat's window, then
 *  WhisperX-align the audio for any caption chrome that doesn't
 *  already have word timings. Rewrite the clip.src to the local path
 *  so Remotion's <OffthreadVideo> reads from disk. */
async function resolveRemoteClipsAndAlign(segment: Segment): Promise<{
  segment: Segment;
  clipsFetched: number;
  captionsAligned: number;
  clipPaths: Record<string, string>;
}> {
  let clipsFetched = 0;
  let captionsAligned = 0;
  const clipPaths: Record<string, string> = {};
  const resolvedBeats: Beat[] = [];

  for (const beat of segment.beats) {
    let resolvedBeat: Beat = beat;
    let localClipPath: string | null = null;

    if (beat.clip && /^https?:\/\//i.test(beat.clip.src)) {
      const originalSrc = beat.clip.src;
      const fetched = await fetchAndTrimClip({
        url: originalSrc,
        in_s: beat.clip.in_s,
        out_s: beat.clip.out_s,
      });
      if (fetched.ok && fetched.localPath) {
        clipsFetched++;
        localClipPath = fetched.localPath;
        clipPaths[originalSrc] = fetched.localPath;
        // Also key by the rewritten src so audio/mix.ts can find it
        // after the renderer sees the rewritten beat.
        clipPaths[fetched.localPath] = fetched.localPath;
        resolvedBeat = {
          ...beat,
          clip: {
            ...beat.clip,
            src: fetched.localPath,
            in_s: 0,
            out_s: beat.clip.out_s - beat.clip.in_s,
          },
        };
      }
    }

    // For each caption chrome WITHOUT words, run WhisperX against the
    // beat's audio so the highlight tracks the broadcast cadence.
    if (localClipPath) {
      const chromeOut = await Promise.all(
        resolvedBeat.chrome.map(async (chrome) => {
          if (chrome.kind !== "caption" || chrome.words) return chrome;
          const offsetMs = Math.round(resolvedBeat.t_in_s * 1000);
          const aligned = await alignWords(localClipPath as string, offsetMs);
          if (!aligned.ok || !aligned.words || aligned.words.length === 0) return chrome;
          captionsAligned++;
          return { ...chrome, words: aligned.words };
        }),
      );
      resolvedBeat = { ...resolvedBeat, chrome: chromeOut };
    }

    resolvedBeats.push(resolvedBeat);
  }

  return {
    segment: { ...segment, beats: resolvedBeats },
    clipsFetched,
    captionsAligned,
    clipPaths,
  };
}

async function prepareWorkdir(segmentId: string): Promise<string> {
  const dir = join(tmpdir(), `canopticon-render-${segmentId}-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

function resolveRemotionEntry(): string {
  // The bundled dist/ structure puts Remotion's entry at dist/remotion/Root.js.
  // Fall back to the src path when running under tsx / vitest.
  const candidates = [
    join(process.cwd(), "dist", "remotion", "Root.js"),
    join(process.cwd(), "src", "remotion", "Root.tsx"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0] as string;
}
