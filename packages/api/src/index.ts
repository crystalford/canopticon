import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AuthContext } from "./auth/middleware.ts";
import type { Env } from "./env.ts";
import { ApiError } from "./lib/errors.ts";
import articlesRoutes from "./routes/articles.ts";
import cascadeRoutes from "./routes/cascade.ts";
import claimsRoutes from "./routes/claims.ts";
import contradictionsRoutes from "./routes/contradictions.ts";
import costRoutes from "./routes/cost.ts";
import entitiesRoutes from "./routes/entities.ts";
import intellectualRoutes from "./routes/intellectual.ts";
import libraryRoutes from "./routes/library.ts";
import liveRoutes from "./routes/live.ts";
import orchestratorRoutes from "./routes/orchestrator.ts";
import predictionsRoutes from "./routes/predictions.ts";
import productionsRoutes from "./routes/productions.ts";
import publicRoutes from "./routes/public.ts";
import publishRoutes from "./routes/publish.ts";
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
app.route("/v1", v1);

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
