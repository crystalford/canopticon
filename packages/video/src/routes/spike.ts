// POST /spike — fire a Phase 0 render against the seeded Carney
// segment. Creates a render_jobs row, kicks the Container in
// waitUntil, redirects back to / (which polls every 3s).

import { Hono } from "hono";
import { type AuthState, requireOperator } from "../auth.ts";
import type { Env } from "../env.ts";
import { renderSegment } from "../render/client.ts";
import {
  createRenderJob,
  loadSegment,
  markRenderFailed,
  markRenderRunning,
  markRenderSucceeded,
} from "../storage/d1.ts";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

const SEED_SEGMENT_ID = "phase0-carney-it-looks-like-teslas";

app.post("/spike", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const segment = await loadSegment(c.env.DB, SEED_SEGMENT_ID);
  if (!segment) {
    return new Response(
      `Seed segment "${SEED_SEGMENT_ID}" not found. Apply migrations-video before running the spike.`,
      { status: 500 },
    );
  }
  const jobId = await createRenderJob(c.env.DB, segment);

  c.executionCtx.waitUntil(
    (async () => {
      const t0 = Date.now();
      try {
        await markRenderRunning(c.env.DB, jobId);
        const result = await renderSegment(c.env.RENDER_CONTAINER, segment);
        if (!result.ok) {
          await markRenderFailed(c.env.DB, jobId, result.error ?? "unknown");
          return;
        }
        const walltime = result.walltime_ms ?? Date.now() - t0;
        const cost = result.est_cost_cents ?? estimateCost(walltime);
        const key = result.r2_key ?? `${jobId}.mp4`;
        await markRenderSucceeded(c.env.DB, jobId, {
          r2_key: key,
          walltime_ms: walltime,
          est_cost_cents: cost,
        });
      } catch (err) {
        await markRenderFailed(c.env.DB, jobId, (err as Error).message ?? "unknown").catch(
          () => {},
        );
      }
    })(),
  );

  return c.redirect("/", 302);
});

// Used only when the Container doesn't report cost itself. standard-4
// charges per the Cloudflare Containers price list (2026); the constant
// here is conservative — the operator updates it from the dashboard
// number when Phase 0 lands real metrics.
const STANDARD_4_CENTS_PER_SECOND = 0.0042;
function estimateCost(walltimeMs: number): number {
  return (walltimeMs / 1000) * STANDARD_4_CENTS_PER_SECOND;
}

export default app;
