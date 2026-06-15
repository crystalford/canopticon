// canopticon-video — daily forensic video engine Worker.
//
// Phase 1 cockpit: the daily cron polls GDELT for Canadian-politics
// clips, scores each through the editorial rubric (Workers AI), casts
// the highest-scoring into one of three templates, and surfaces them
// on /queue. The operator promotes one candidate per day to a segment
// that Phase 1 chunk B's editorial brain writes a script for.
//
// Phase 0 path (operator can still trigger): POST /spike renders the
// seeded "It Looks Like Teslas" segment against the Container.
//
// Routes:
//   GET  /                — status page (latest render_job)
//   GET  /queue           — daily-radar candidates
//   POST /queue/poll      — manual GDELT poll (same as the cron)
//   POST /queue/:id/promote — promote a candidate to a segment
//   POST /spike           — render the Phase 0 seed segment
//   GET  /assets/:key     — operator-only R2 proxy
//   GET  /auth/login      — 302 to canopticon.com/auth/login?next=...
//   GET  /auth/logout     — 302 to canopticon.com/auth/logout
//   GET  /health          — public JSON liveness

import { Hono } from "hono";
import { type AuthState, requireOperator } from "./auth.ts";
import type { Env } from "./env.ts";
import { loadDailyMetrics, loadMetrics, renderMetricsPage } from "./pages/metrics.ts";
import authRoutes from "./routes/auth.ts";
import healthRoutes from "./routes/health.ts";
import queueRoutes, { runDailyPoll } from "./routes/queue.ts";
import spikeRoutes from "./routes/spike.ts";
import statusRoutes from "./routes/status.ts";
import voiceRoutes from "./voice/routes.ts";

type App = { Bindings: Env; Variables: AuthState };

const app = new Hono<App>();

app.onError((err, c) => {
  console.error("video-worker error", err);
  return c.json(
    {
      error: {
        code: "internal_error",
        message: err.message || "Internal server error",
      },
    },
    500,
  );
});

app.route("/", statusRoutes);
app.route("/", spikeRoutes);
app.route("/queue", queueRoutes);
app.route("/voice", voiceRoutes);
app.route("/auth", authRoutes);
app.route("/health", healthRoutes);

// GET /metrics — operator-only render-cost dashboard.
app.get("/metrics", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const [metrics, daily] = await Promise.all([
    loadMetrics(c.env.DB).catch(() => null),
    loadDailyMetrics(c.env.DB).catch(() => []),
  ]);
  return renderMetricsPage({
    metrics: metrics ?? {
      total_renders: 0,
      succeeded: 0,
      failed: 0,
      total_cost_cents: 0,
      avg_walltime_ms: 0,
      avg_cost_cents: 0,
      most_recent_at: null,
    },
    daily,
  });
});

// GET /assets/:key — operator-only proxy that streams the rendered MP4
// out of R2. Cheaper than minting signed URLs for the Phase 0 status
// page; production rendering pipelines should switch to direct R2 URLs
// or Cloudflare Stream once we're past de-risking.
app.get("/assets/:key", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const key = decodeURIComponent(c.req.param("key"));
  const obj = await c.env.ASSETS.get(key);
  if (!obj) return new Response("not found", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "video/mp4",
      "cache-control": "no-store",
    },
  });
});

// Scheduled handler — daily noon UTC. Polls GDELT, scores each
// candidate through the rubric, casts the highest into a template.
// The operator promotes the top candidate manually on /queue —
// nothing auto-publishes.
const scheduled: ExportedHandlerScheduledHandler<Env> = async (controller, env, ctx) => {
  console.log(`canopticon-video cron ${controller.cron} fired at ${new Date().toISOString()}`);
  ctx.waitUntil(runDailyPoll(env));
};

export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Env>;
