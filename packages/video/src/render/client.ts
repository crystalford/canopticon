// Container client — wraps the Durable-Object-style fetcher Cloudflare
// exposes for [[containers]] bindings.
//
// The renderer is a Node HTTP service listening on :8080 inside the
// Container; the Worker calls it via env.RENDER_CONTAINER.get(id) and
// `.fetch(request)` like any Durable Object stub. Phase 0 spawns one
// instance per render. Phase 3 fan-out raises max_instances and routes
// each variant to its own stub.
//
// The contract IS the §7b segment JSON — both sides import the same
// zod schema from @canopticon/shared/video/segment-schema.

import type { Segment } from "@canopticon/shared/video/segment-schema";

export interface RenderResult {
  ok: boolean;
  r2_key?: string;
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
  // Each segment id gets its own Container instance (deterministic
  // routing — the same segment always renders on the same instance so
  // repeated calls can short-circuit when the cache is warm).
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
    return (await res.json()) as RenderResult;
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
