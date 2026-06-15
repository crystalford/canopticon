// GET /health — public JSON liveness. No auth.

import { Hono } from "hono";
import type { Env } from "../env.ts";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) =>
  c.json({
    ok: true,
    worker: "canopticon-video",
    ts: new Date().toISOString(),
  }),
);

export default app;
