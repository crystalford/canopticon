// Render orchestrator — drives Remotion to produce an MP4 from the
// §7b segment JSON. Phase 0 ships a single-instance render with three
// parallel Chrome workers (Remotion's `concurrency` option). Phase 2
// adds chunked rendering across multiple Container instances.

import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Segment } from "@canopticon/shared/video/segment-schema";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";

export interface RenderResult {
  ok: boolean;
  mp4?: Buffer;
  walltime_ms: number;
  chunks: number;
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
    const entryPath = resolveRemotionEntry();
    const bundleLocation = await bundle({
      entryPoint: entryPath,
      // No webpack overrides — keep Phase 0 minimal.
    });
    const comps = await getCompositions(bundleLocation, {
      inputProps: { segment },
    });
    const composition = comps.find((c) => c.id === "ForensicSegment");
    if (!composition) {
      return failure(t0, "ForensicSegment composition not found in bundle");
    }
    const fps = composition.fps;
    const durationInFrames = Math.max(1, Math.round(segment.length_s * fps));
    await renderMedia({
      composition: { ...composition, durationInFrames },
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outPath,
      inputProps: { segment },
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
    error,
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
