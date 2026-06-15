// canopticon-video — daily forensic video engine Worker.
//
// Phase 0 cockpit: the operator can fire a single render of the seeded
// Carney "It Looks Like Teslas" segment via POST /spike, watch the
// status page (polled every 3s), and play the resulting MP4 inline.
// Cron is a heartbeat-only log until Phase 1 wires the editorial brain.
//
// Routes:
//   GET  /                — operator-only status page (auth-gated)
//   POST /spike           — operator-only render trigger
//   GET  /assets/:key     — operator-only R2 proxy for the rendered MP4
//   GET  /auth/login      — 302 to canopticon.com/auth/login?next=...
//   GET  /auth/logout     — 302 to canopticon.com/auth/logout
//   GET  /health          — public JSON liveness

import { Hono } from "hono";
import { type AuthState, requireOperator } from "./auth.ts";
import type { Env } from "./env.ts";
import authRoutes from "./routes/auth.ts";
import healthRoutes from "./routes/health.ts";
import spikeRoutes from "./routes/spike.ts";
import statusRoutes from "./routes/status.ts";

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
app.route("/auth", authRoutes);
app.route("/health", healthRoutes);

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

// Scheduled handler — Phase 0 heartbeat only. Phase 1 swaps this for
// the GDELT poll → rubric → editorial-brain → enqueue-render chain.
const scheduled: ExportedHandlerScheduledHandler<Env> = async (controller, _env, _ctx) => {
  console.log(`canopticon-video cron ${controller.cron} fired at ${new Date().toISOString()}`);
};

export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Env>;
