import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AuthContext } from "./auth/middleware.ts";
import { runHansardCron } from "./cron/hansard.ts";
import type { Env } from "./env.ts";
import { ApiError } from "./lib/errors.ts";
import articlesRoutes from "./routes/articles.ts";
import assumptionsRoutes from "./routes/assumptions.ts";
import booksRoutes from "./routes/books.ts";
import calibrationRoutes from "./routes/calibration.ts";
import cascadeRoutes from "./routes/cascade.ts";
import claimsRoutes from "./routes/claims.ts";
import entitiesRoutes from "./routes/entities.ts";
import findingsRoutes from "./routes/findings.ts";
import indicatorsRoutes from "./routes/indicators.ts";
import orchestratorRoutes from "./routes/orchestrator.ts";
import predictionsRoutes from "./routes/predictions.ts";
import publicRoutes from "./routes/public.ts";
import researchRoutes from "./routes/research.ts";
import sourcesRoutes from "./routes/sources.ts";
import systemRoutes from "./routes/system.ts";
import thesesRoutes from "./routes/theses.ts";

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

// Versioned API surface — routes will be mounted here as they come online.
// See packages/api/src/routes/ for implementations.
const v1 = new Hono<App>();
v1.route("/sources", sourcesRoutes);
v1.route("/claims", claimsRoutes);
v1.route("/theses", thesesRoutes);
v1.route("/predictions", predictionsRoutes);
v1.route("/articles", articlesRoutes);
v1.route("/indicators", indicatorsRoutes);
v1.route("/assumptions", assumptionsRoutes);
v1.route("/books", booksRoutes);
v1.route("/findings", findingsRoutes);
v1.route("/entities", entitiesRoutes);
v1.route("/calibration", calibrationRoutes);
v1.route("/cascade", cascadeRoutes);
v1.route("/research", researchRoutes);
v1.route("/orchestrator", orchestratorRoutes);
v1.route("/system", systemRoutes);
v1.route("/public", publicRoutes);
app.route("/v1", v1);

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    // Cron triggers — wrangler.toml schedules at "0 */6 * * *" (every 6h).
    // The handler dispatches by cron expression so future cron jobs share
    // this entry point. waitUntil keeps the handler alive past the
    // function return so the work actually runs.
    if (event.cron === "0 */6 * * *") {
      ctx.waitUntil(
        (async () => {
          const result = await runHansardCron(env);
          console.log("hansard cron result", JSON.stringify(result));
        })(),
      );
    }
  },
} satisfies ExportedHandler<Env>;
