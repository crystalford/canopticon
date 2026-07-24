import { Hono } from "hono";
import { cors } from "hono/cors";
import { type AuthContext, attachAuthState } from "./auth/middleware.ts";
import authRoutes from "./auth/routes.ts";
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
import systemRoutes from "./routes/system.ts";
import stitchRoutes from "./studio/routes/api-stitch.ts";
import studioRoutes from "./studio/routes/api-studio.ts";

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

app.onError(async (err, c) => {
  const traceId = c.get("trace_id") ?? crypto.randomUUID();
  if (err instanceof ApiError) {
    return c.json(err.toBody(traceId), err.status as 400 | 401 | 403 | 404 | 500);
  }
  // Persist real error stacks to D1 so /v1/admin/runtime surfaces them —
  // no more "trace_id only" with the actual stack hidden in wrangler tail.
  // Best-effort; if logging itself fails we swallow rather than compound.
  try {
    const userRow = c.env.OPERATOR_EMAIL
      ? await c.env.DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
          .bind(c.env.OPERATOR_EMAIL)
          .first<{ id: string }>()
      : null;
    if (userRow?.id) {
      await c.env.DB.prepare(
        `INSERT INTO orchestrator_events (id, user_id, event_type, trace_id, payload, created_at)
         VALUES (?, ?, 'worker_error', ?, ?, ?)`,
      )
        .bind(
          crypto.randomUUID(),
          userRow.id,
          traceId,
          JSON.stringify({
            path: c.req.path,
            method: c.req.method,
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack?.slice(0, 4000) : undefined,
            name: err instanceof Error ? err.name : undefined,
          }),
          new Date().toISOString(),
        )
        .run();
    }
  } catch (logErr) {
    console.error("error-log insert failed", logErr);
  }
  console.error("unhandled error", { trace_id: traceId, err });
  // Same split as app.notFound: JSON for the API surface, a styled HTML
  // page for public routes. Before this, ANY uncaught error anywhere —
  // API or public — fell through to this one handler, so a transient D1
  // hiccup mid-page-load showed a reader raw {"error":...} JSON instead
  // of a page (confirmed live: a D1 CPU-time-limit reset from a concurrent
  // heavy digest job broke an unrelated /search render this way).
  const path = c.req.path;
  if (path.startsWith("/v1/") || path === "/health") {
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
  }
  const { renderServerError } = await import("./public/render/placeholder.ts");
  return htmlResponse(renderServerError(traceId), { status: 500 });
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

import lighthouseRoutes from "./graph/routes/lighthouse.ts";
v1.route("/lighthouse", lighthouseRoutes);

import adminIngestLibraryRoutes from "./admin/ingest-library.ts";
import adminRuntimeRoutes from "./admin/runtime.ts";
import adminSeedRoutes from "./admin/seed-corpus.ts";
v1.route("/admin", adminSeedRoutes);
v1.route("/admin", adminIngestLibraryRoutes);
v1.route("/admin", adminRuntimeRoutes);

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

// Operator console — server-rendered HTML at /op/*. Cloudflare Access
// gates this subtree at the edge, so every request here is the
// authenticated operator. Mounted before the public catch-all.
import operatorRoutes from "./operator/routes.ts";
app.route("/op", operatorRoutes);

import { htmlResponse } from "./public/layout.ts";
// Public site — server-rendered HTML at canopticon.com. Mounted last so
// /v1, /op, and /health take precedence on overlapping paths.
import publicSiteRoutes, { renderNotFound as renderPublicNotFound } from "./public/routes.ts";

// /auth/* — the operator's bootstrap into the one-site permission model
// (spec v2.5 Part 9). Cloudflare Access gates this subtree at the edge so
// only the operator can mint a session cookie.
app.route("/auth", authRoutes);

// Auth-state middleware: every public request gets is_operator + operator_id
// in the Hono context. Anonymous = false/null; renderers read these to reveal
// affordances. Mounted on the public catch-all only (the API + operator
// routes have their own auth posture).
const publicShell = new Hono<App>();
publicShell.use("*", attachAuthState());
publicShell.route("/", publicSiteRoutes);
app.route("/", publicShell);

// Unified notFound: JSON for the API surface, styled HTML for public.
app.notFound((c) => {
  const path = c.req.path;
  if (path.startsWith("/v1/") || path === "/health") {
    return c.json(
      { error: { code: "not_found", message: "Not found", trace_id: c.get("trace_id") } },
      404,
    );
  }
  return htmlResponse(renderPublicNotFound(path), { status: 404 });
});

import { drainDigestJobs, runDigestJob } from "./graph/lib/digest-jobs.ts";
import { runWatcher } from "./graph/lib/watcher.ts";
import { all as dbAll } from "./lib/d1.ts";

// Cloudflare Cron Trigger handler. Three crons configured in wrangler.toml:
//   "*/2 * * * *"  — drain the digest_jobs queue (safety net for ingest)
//   "0 12 * * 1"   — weekly monitor watchers
//   "0 */4 * * *"  — autonomous expand sweep every 4h (one thin subject/tick,
//                    ranked by edge_degree — see graph/lib/autonomous-expand.ts)
// We branch on controller.cron so the drain tick doesn't refire watchers or
// the sweep on every tick.
//
// The drain tick was every-minute until live D1_ERROR "exceeded its CPU
// time limit and was reset" events (see draft-reading.ts / profile-
// generator.ts's candidate queries, and reports of the site itself loading
// slowly) traced to this account's shared D1 CPU budget getting exhausted
// by everything running concurrently — this drain, the settle pipeline,
// and the autonomous sweep all competing for the same pool at once.
// Halved to every 2 minutes as a conservative, reversible knob alongside
// halving CHUNK_CONCURRENCY and the per-tick doc count below — not a
// redesign, just less pressure per unit time. Revisit if ingest throughput
// becomes the bottleneck instead.
const scheduled: ExportedHandlerScheduledHandler<Env> = async (controller, env, ctx) => {
  const cron = controller.cron;
  if (cron === "0 12 * * 1") {
    const monitors = await dbAll<{ id: string }>(
      env.DB,
      "SELECT id FROM monitors WHERE enabled = 1",
    );
    for (const m of monitors) {
      ctx.waitUntil(runWatcher(env, m.id));
    }
    return;
  }
  if (cron === "0 */4 * * *") {
    const { resolveOperatorId } = await import("./public/data.ts");
    const { sweepThinSubjects } = await import("./graph/lib/autonomous-expand.ts");
    const userId = await resolveOperatorId(env.DB);
    if (userId) ctx.waitUntil(sweepThinSubjects(env, userId));
    return;
  }
  // Default branch (every-2-minute tick): drain queued + stalled digest
  // jobs. Each job runs in waitUntil; if it gets killed, a later tick picks
  // it up. 2 docs per tick × 2 chunks-in-flight per doc (CHUNK_CONCURRENCY)
  // = 4 concurrent LLM/D1-touching calls peak from this source, down from
  // 16 — see the D1 CPU budget note above.
  const jobIds = await drainDigestJobs(env, 2);
  for (const id of jobIds) {
    ctx.waitUntil(runDigestJob(env, id));
  }
  // Also nudge the corpus-settle pipeline forward every tick (self-
  // throttled to ~90s inside advanceSettleOneStep — see settle-
  // pipeline.ts). digest-jobs.ts already advances it once whenever a
  // batch of uploads finishes; this is what keeps the six-step cycle
  // moving even when nothing new has been uploaded, so generate_profiles
  // (last in the cycle) reliably gets its own turn instead of only firing
  // right after an upload.
  const { resolveOperatorId } = await import("./public/data.ts");
  const { advanceSettleOneStep } = await import("./graph/lib/settle-pipeline.ts");
  const settleUserId = await resolveOperatorId(env.DB);
  if (settleUserId) ctx.waitUntil(advanceSettleOneStep(env, settleUserId));
};

export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Env>;
