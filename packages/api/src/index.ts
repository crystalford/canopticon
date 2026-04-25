import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AuthContext } from "./auth/middleware.ts";
import type { Env } from "./env.ts";
import { ApiError } from "./lib/errors.ts";
import sourcesRoutes from "./routes/sources.ts";

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
app.route("/v1", v1);

export default {
  fetch: app.fetch,
  // Cron handler is wired in src/cron/hansard.ts and re-exported once the
  // openparliament adapter exists. For now, the cron trigger in
  // wrangler.toml has no scheduled() handler — Wrangler will warn until we
  // add it.
} satisfies ExportedHandler<Env>;
