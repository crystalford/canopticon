import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AuthContext } from "./auth/middleware.ts";
import { runHansardCron } from "./cron/hansard.ts";
import type { Env } from "./env.ts";
import { ApiError } from "./lib/errors.ts";
import cascadeRoutes from "./routes/cascade.ts";
import claimsRoutes from "./routes/claims.ts";
import orchestratorRoutes from "./routes/orchestrator.ts";
import researchRoutes from "./routes/research.ts";
import sourcesRoutes from "./routes/sources.ts";
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

// Versioned API surface — routes will be mounted here as they come online.
// See packages/api/src/routes/ for implementations.
const v1 = new Hono<App>();
v1.route("/sources", sourcesRoutes);
v1.route("/claims", claimsRoutes);
v1.route("/cascade", cascadeRoutes);
v1.route("/research", researchRoutes);
v1.route("/orchestrator", orchestratorRoutes);
v1.route("/system", systemRoutes);
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
