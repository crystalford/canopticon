// Render orchestrator — drives Remotion to produce an MP4 from the
// §7b segment JSON. Phase 1B adds the clip-fetch + caption-alignment
// pre-pass: any beat whose clip.src is an https:// URL gets downloaded
// via yt-dlp + trimmed with ffmpeg before bundling, then WhisperX
// extracts word-level timings for the caption chrome.

import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Beat, Segment } from "@canopticon/shared/video/segment-schema";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import { fetchAndTrimClip } from "../sourcing/fetch-clip";
import { alignWords } from "../sourcing/whisperx";

export interface RenderResult {
  ok: boolean;
  mp4?: Buffer;
  walltime_ms: number;
  chunks: number;
  clips_fetched: number;
  captions_aligned: number;
  error?: string;
}

/** Single-pass render. Bundles the Remotion root, picks the
 *  ForensicSegment composition, calls renderMedia with the segment as
 *  inputProps, reads the MP4 off disk, returns the Buffer. */
export async function renderSegment(segment: Segment): Promise<RenderResult> {
  const t0 = Date.now();
  const workDir = await prepareWorkdir(segment.id);
  const outPath = join(workDir, "out.mp4");
  try {
    // Phase 1B pre-pass: fetch any remote clip URLs and align captions
    // against the actual broadcast audio.
    const {
      segment: resolved,
      clipsFetched,
      captionsAligned,
    } = await resolveRemoteClipsAndAlign(segment);

    const entryPath = resolveRemotionEntry();
    const bundleLocation = await bundle({
      entryPoint: entryPath,
    });
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
      outputLocation: outPath,
      inputProps: { segment: resolved },
      concurrency: 3,
      chromiumOptions: {
        // GPU is off in the Container — Remotion picks software paths
        // automatically when GPU is disabled at the binary level
        // (ENV REMOTION_CHROMIUM_DISABLE_GPU=true in the Dockerfile).
        gl: "swangle",
      },
      // Phase 0 leaves audio at zero for now — narrator + clip audio
      // ducking ships in the audio/mix.ts pass once the renderer
      // builds clean. The MP4 still validates as h264+aac so it plays.
      audioBitrate: "128K",
    });
    const mp4 = await readFile(outPath);
    return {
      ok: true,
      mp4,
      walltime_ms: Date.now() - t0,
      chunks: 1,
      clips_fetched: clipsFetched,
      captions_aligned: captionsAligned,
    };
  } catch (err) {
    return failure(t0, (err as Error).message ?? "unknown");
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function failure(t0: number, error: string): RenderResult {
  return {
    ok: false,
    walltime_ms: Date.now() - t0,
    chunks: 0,
    clips_fetched: 0,
    captions_aligned: 0,
    error,
  };
}

/** Walk the segment's beats. For each beat whose clip.src is an
 *  https:// URL, fetch via yt-dlp + trim to the beat's window, then
 *  WhisperX-align the audio for any caption chrome that doesn't
 *  already have word timings. Rewrite the clip.src to the local path
 *  so Remotion's <OffthreadVideo> reads from disk. */
async function resolveRemoteClipsAndAlign(
  segment: Segment,
): Promise<{ segment: Segment; clipsFetched: number; captionsAligned: number }> {
  let clipsFetched = 0;
  let captionsAligned = 0;
  const resolvedBeats: Beat[] = [];

  for (const beat of segment.beats) {
    let resolvedBeat: Beat = beat;
    let localClipPath: string | null = null;

    if (beat.clip && /^https?:\/\//i.test(beat.clip.src)) {
      const fetched = await fetchAndTrimClip({
        url: beat.clip.src,
        in_s: beat.clip.in_s,
        out_s: beat.clip.out_s,
      });
      if (fetched.ok && fetched.localPath) {
        clipsFetched++;
        localClipPath = fetched.localPath;
        // Rewrite clip.src to the local path; the renderer's
        // staticFile() resolver treats absolute paths as direct file:
        // refs via Remotion's bundler config.
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
