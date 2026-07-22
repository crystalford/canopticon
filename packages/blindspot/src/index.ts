// canopticon-blindspot — The Blind Spot instrument Worker.
//
// An instrument that measures the failure of measurement: Canada's
// three official methods of estimating top-tail wealth (Survey of
// Financial Security, PBO Pareto, StatCan capitalization) disagree most
// at the very top. The instrument renders the disagreement as the
// subject and quantifies it as the Invisibility Index.
//
// Server-rendered HTML, no JS to read (the /where calculator is the one
// exception). Public everywhere; only /refresh and /assets/:key are
// operator-gated. Push-button mode — no cron.
//
// Routes:
//   GET  /            — the instrument (four movements)      public
//   GET  /method      — the method paper                     public
//   GET  /sources     — the source catalog                   public
//   GET  /where       — net-worth percentile calculator      public (JS)
//   POST /refresh      — trigger ingest                       operator-only
//   GET  /auth/login  — 302 → canopticon.com/auth/login      public
//   GET  /auth/logout — 302 → canopticon.com/auth/logout     public
//   GET  /health      — JSON liveness                         public
//   GET  /assets/:key — raw R2 snapshot proxy                 operator-only

import { Hono } from "hono";
import { type AuthState, requireOperator } from "./auth.ts";
import type { Env } from "./env.ts";
import authRoutes from "./routes/auth.ts";
import healthRoutes from "./routes/health.ts";
import homeRoutes from "./routes/home.ts";
import methodRoutes from "./routes/method.ts";
import refreshRoutes from "./routes/refresh.ts";
import sourcesRoutes from "./routes/sources.ts";
import whereRoutes from "./routes/where.ts";

type App = { Bindings: Env; Variables: AuthState };

const app = new Hono<App>();

app.onError((err, c) => {
  console.error("blindspot-worker error", err);
  return c.json(
    { error: { code: "internal_error", message: err.message || "Internal server error" } },
    500,
  );
});

app.route("/", homeRoutes);
app.route("/method", methodRoutes);
app.route("/sources", sourcesRoutes);
app.route("/where", whereRoutes);
app.route("/refresh", refreshRoutes);
app.route("/auth", authRoutes);
app.route("/health", healthRoutes);

// GET /assets/:key — operator-only proxy that streams a raw source
// snapshot out of R2. The provenance store is private; the public
// pages cite it by SHA but the bytes are operator-gated.
app.get("/assets/:key", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const key = decodeURIComponent(c.req.param("key"));
  const obj = await c.env.ASSETS.get(key);
  if (!obj) return new Response("not found", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "no-store",
    },
  });
});

// NOTE: cron is intentionally not registered. The instrument is
// push-button — the operator clicks "Refresh sources" (POST /refresh).
// Re-enable by adding a scheduled handler here + uncommenting
// [triggers] in wrangler.toml once the manual flow is settled.

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
