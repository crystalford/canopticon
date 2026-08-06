// canopticon-video — forensic video engine Worker.
//
// The GDELT/Brave daily-radar discovery pipeline (poll → rubric-score →
// cast → promote) that used to drive this Worker has been CUT — a
// fully separate "what's newsworthy today" engine, its own database,
// zero connection to the publication's typed graph. See CLAUDE.md's
// "Two other Workers exist" section and docs/canopticon-renovation.md
// for the full reasoning. routes/queue.ts now only carries what's
// genuinely shared: the render-job review/approve/publish lifecycle,
// kept because routes/from-reading.ts's reading-sourced segments
// depend on it, plus read-only access to whatever candidates/segments
// already exist from before the cut.
//
// The live content path now: the publication's api Worker POSTs a
// signed reading's verified facts to /segments/from-reading, which
// drafts a video essay (short or long-form) — the reading's own facts
// re-sequenced into a script, never independently sourced or judged —
// then the SAME review/approve/render path above takes it from there.
// See editorial/reading-brain.ts.
//
// Phase 0 path (operator can still trigger): POST /spike renders the
// seeded "It Looks Like Teslas" segment against the Container.
//
// Routes:
//   GET  /                    — status page (latest render_job)
//   GET  /queue                — historical candidates (read-only)
//   GET  /queue/:id            — review: pre-render editor, or the
//                                 rendered video + publish button once
//                                 a render has actually run
//   POST /queue/:id/approve    — approve forensic_turn, fires the render
//   POST /queue/:id/publish    — operator has watched the render, makes
//                                 it visible on canopticon.com/videos
//   POST /segments/from-reading — server-to-server intake from the
//                                 publication's api Worker (shared-
//                                 token auth, not a session cookie)
//   POST /transcribe           — server-to-server: fetch+transcribe a
//                                 video URL (shared-token auth). Ingestion
//                                 direction, opposite of segments/from-
//                                 reading — this Worker only transcribes,
//                                 the api Worker owns turning the result
//                                 into fact-graph material.
//   GET  /transcribe/:jobId    — poll a transcription job's status
//   GET  /react                — reaction-video tool: project list
//   POST /react/projects       — create a project, transcribes +
//                                 segments into points in the background
//   GET  /react/projects/:id   — scripting review surface
//                                 (see routes/react.ts, react/db.ts,
//                                 react/segment-points.ts — a standalone
//                                 pipeline, not part of the GDELT/
//                                 AI-voiceover /queue flow above)
//   POST /spike                — render the Phase 0 seed segment
//   GET  /assets/:key          — operator-only R2 proxy
//   GET  /public/segments      — public JSON: every published segment
//   GET  /public/watch/:key    — public: streams one published MP4
//   GET  /auth/login           — 302 to canopticon.com/auth/login?next=...
//   GET  /auth/logout          — 302 to canopticon.com/auth/logout
//   GET  /health                — public JSON liveness

import { Hono } from "hono";
import { type AuthState, requireOperator } from "./auth.ts";
import type { Env } from "./env.ts";
import { loadDailyMetrics, loadMetrics, renderMetricsPage } from "./pages/metrics.ts";
import authRoutes from "./routes/auth.ts";
import fromReadingRoutes from "./routes/from-reading.ts";
import healthRoutes from "./routes/health.ts";
import publicRoutes from "./routes/public.ts";
import queueRoutes from "./routes/queue.ts";
import reactRoutes from "./routes/react.ts";
import spikeRoutes from "./routes/spike.ts";
import statusRoutes from "./routes/status.ts";
import transcribeRoutes from "./routes/transcribe.ts";
import voiceRoutes from "./voice/routes.ts";

// The Durable Object class backing the RENDER_CONTAINER binding. Must be
// a named export from this module (wrangler.toml's `main`) — Cloudflare
// resolves the class referenced in [[durable_objects.bindings]] here.
export { RenderContainer } from "./render/container.ts";

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
app.route("/", fromReadingRoutes);
app.route("/", transcribeRoutes);
app.route("/queue", queueRoutes);
app.route("/react", reactRoutes);
app.route("/voice", voiceRoutes);
app.route("/auth", authRoutes);
app.route("/health", healthRoutes);
app.route("/public", publicRoutes);

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

// NOTE: no cron here. There's no discovery pipeline left to schedule —
// the daily-radar poll this used to trigger was cut (see the header
// comment above). Nothing currently needs a scheduled handler.

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
