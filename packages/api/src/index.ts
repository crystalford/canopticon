import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AuthContext } from "./auth/middleware.ts";
import postsRoutes from "./cms/routes/api-posts.ts";
import type { Env } from "./env.ts";
// Graph compartment routes.
import cascadeRoutes from "./graph/routes/cascade.ts";
import charactersRoutes from "./graph/routes/characters.ts";
import claimsRoutes from "./graph/routes/claims.ts";
import contradictionsRoutes from "./graph/routes/contradictions.ts";
import embeddingsRoutes from "./graph/routes/embeddings.ts";
import entitiesRoutes from "./graph/routes/entities.ts";
import liveRoutes from "./graph/routes/live.ts";
import monitorsRoutes from "./graph/routes/monitors.ts";
import orchestratorRoutes from "./graph/routes/orchestrator.ts";
import predictionsRoutes from "./graph/routes/predictions.ts";
import sourcesRoutes from "./graph/routes/sources.ts";
import thesesRoutes from "./graph/routes/theses.ts";
import uploadsRoutes from "./graph/routes/uploads.ts";
import { ApiError } from "./lib/errors.ts";
// Shared / cross-compartment routes.
import articlesRoutes from "./routes/articles.ts";
import chatRoutes from "./routes/chat.ts";
import costRoutes from "./routes/cost.ts";
import intellectualRoutes from "./routes/intellectual.ts";
import libraryRoutes from "./routes/library.ts";
import productionsRoutes from "./routes/productions.ts";
import publicRoutes from "./routes/public.ts";
import publishRoutes from "./routes/publish.ts";
import stitchRoutes from "./studio/routes/api-stitch.ts";
import studioRoutes from "./studio/routes/api-studio.ts";
import systemRoutes from "./routes/system.ts";

type App = AuthContext;

const app = new Hono<App>();

app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["authorization", "content-type", "idempotency-key"],
    credentials: true,
  }),
);

app.use("*", async (c, next) => {
  c.set("trace_id", crypto.randomUUID());
  await next();
});

app.onError((err, c) => {
  const traceId = c.get("trace_id");
  if (err instanceof ApiError) {
    return c.json(err.toBody(traceId), err.status as 400 | 401 | 403 | 404 | 500);
  }
  console.error("unhandled error", { trace_id: traceId, err });
  return c.json(
    {
      error: {
        code: "internal_error",
        message: "Internal server error",
        trace_id: traceId,
      },
    },
    500,
  );
});

app.get("/health", (c) => c.json({ ok: true }));

const v1 = new Hono<App>();
v1.route("/system", systemRoutes);
v1.route("/sources", sourcesRoutes);
v1.route("/cost", costRoutes);
v1.route("/cascade", cascadeRoutes);
v1.route("/claims", claimsRoutes);
v1.route("/entities", entitiesRoutes);
v1.route("/theses", thesesRoutes);
v1.route("/predictions", predictionsRoutes);
v1.route("/contradictions", contradictionsRoutes);
v1.route("/articles", articlesRoutes);
v1.route("/publish", publishRoutes);
v1.route("/productions", productionsRoutes);
v1.route("/library", libraryRoutes);
v1.route("/live", liveRoutes);
v1.route("/orchestrator", orchestratorRoutes);
v1.route("/intellectual", intellectualRoutes);
v1.route("/public", publicRoutes);
v1.route("/chat", chatRoutes);
v1.route("/uploads", uploadsRoutes);
v1.route("/embeddings", embeddingsRoutes);
v1.route("/monitors", monitorsRoutes);
v1.route("/posts", postsRoutes);
v1.route("/characters", charactersRoutes);

// Studio compartment — gated by env.STUDIO_ENABLED. When false, the
// routes 404 (we just don't mount them) and the operator UI shows a
// placeholder.
const studioGate = new Hono<App>();
studioGate.use("*", async (c, next) => {
  if (c.env.STUDIO_ENABLED !== "true") {
    return c.json({ error: { code: "studio_disabled", message: "Studio is disabled" } }, 404);
  }
  await next();
});
studioGate.route("/", studioRoutes);
studioGate.route("/", stitchRoutes);
v1.route("/studio", studioGate);

app.route("/v1", v1);

import { runWatcher } from "./graph/lib/watcher.ts";
import { all as dbAll } from "./lib/d1.ts";

// Cloudflare Cron Trigger handler. Wrangler fires this on the schedule
// declared in wrangler.toml. For each enabled monitor, we kick off a
// watcher via ctx.waitUntil so the worker invocation returns quickly
// while the agent loops run in the background.
const scheduled: ExportedHandlerScheduledHandler<Env> = async (_controller, env, ctx) => {
  const monitors = await dbAll<{ id: string }>(env.DB, "SELECT id FROM monitors WHERE enabled = 1");
  for (const m of monitors) {
    ctx.waitUntil(runWatcher(env, m.id));
  }
};

export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Env>;
