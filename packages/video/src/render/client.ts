// Container client — wraps the Cloudflare Container binding fetcher.
//
// Contract (Phase 0):
//   POST /render
//     Content-Type: application/json
//     Body: §7b Segment JSON
//   →
//     200 + Content-Type: video/mp4
//        + X-Walltime-Ms, X-Est-Cost-Cents, X-Chunks headers
//        + body = MP4 bytes
//     5xx + JSON { ok: false, error: string }
//
// The Worker reads the MP4 bytes from the response body and writes them
// to R2 itself. No long-lived R2 credentials inside the Container.

import type { Segment } from "@canopticon/shared/video/segment-schema";

export interface RenderResult {
  ok: boolean;
  mp4?: ArrayBuffer;
  walltime_ms?: number;
  est_cost_cents?: number;
  chunks?: number;
  clips_fetched?: number;
  captions_aligned?: number;
  narrator_seconds?: number;
  beats_snapped?: number;
  error?: string;
}

interface ContainerNamespaceLike {
  get(id: DurableObjectId): { fetch(request: Request): Promise<Response> };
  idFromName(name: string): DurableObjectId;
}

export async function renderSegment(
  containerNs: DurableObjectNamespace,
  segment: Segment,
): Promise<RenderResult> {
  const ns = containerNs as unknown as ContainerNamespaceLike;
  const id = ns.idFromName(segment.id);
  const stub = ns.get(id);
  try {
    const res = await stub.fetch(
      new Request("https://render/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(segment),
      }),
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `renderer returned ${res.status}: ${text.slice(0, 300)}` };
    }
    const mp4 = await res.arrayBuffer();
    return {
      ok: true,
      mp4,
      walltime_ms: Number(res.headers.get("x-walltime-ms") ?? 0),
      est_cost_cents: Number(res.headers.get("x-est-cost-cents") ?? 0),
      chunks: Number(res.headers.get("x-chunks") ?? 1),
      clips_fetched: Number(res.headers.get("x-clips-fetched") ?? 0),
      captions_aligned: Number(res.headers.get("x-captions-aligned") ?? 0),
      narrator_seconds: Number(res.headers.get("x-narrator-seconds") ?? 0),
      beats_snapped: Number(res.headers.get("x-beats-snapped") ?? 0),
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export interface TranscriptSegment {
  text: string;
  start_s: number;
  end_s: number;
}

export interface TranscribeContainerResult {
  ok: boolean;
  transcript?: string;
  segments?: TranscriptSegment[];
  title?: string;
  channel?: string;
  published_at?: string | null;
  duration_s?: number;
  error?: string;
}

/** Ask the Container to fetch + transcribe a video URL. Same
 *  DurableObjectNamespace binding as renderSegment above (RENDER_CONTAINER,
 *  max_instances=1 per wrangler.toml) — a transcription job and a video
 *  render share the one Container instance and queue behind each other.
 *  Acceptable for now (both are operator-triggered, not high-frequency);
 *  revisit if that contention becomes a real bottleneck.
 *
 *  `timestamped: true` (the reaction-video tool's point-segmentation use
 *  case) requests WhisperX's --output_format json instead of plain txt —
 *  segment-level start/end times, no forced-alignment pass needed for
 *  that precision. Omit/false preserves the original reading-ingestion
 *  behavior (plain text, no segments array). */
export async function transcribeVideo(
  containerNs: DurableObjectNamespace,
  jobId: string,
  url: string,
  opts: { timestamped?: boolean } = {},
): Promise<TranscribeContainerResult> {
  const ns = containerNs as unknown as ContainerNamespaceLike;
  const id = ns.idFromName(jobId);
  const stub = ns.get(id);
  try {
    const res = await stub.fetch(
      new Request("https://render/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, timestamped: opts.timestamped === true }),
      }),
    );
    const body = (await res.json().catch(() => null)) as TranscribeContainerResult | null;
    if (!res.ok || !body) {
      return { ok: false, error: body?.error ?? `transcriber returned ${res.status}` };
    }
    return body;
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
