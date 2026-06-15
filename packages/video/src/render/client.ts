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
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
