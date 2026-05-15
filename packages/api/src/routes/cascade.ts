// Cascade orchestration entry points.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, one } from "../lib/d1.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { runCascade } from "../llm/cascade.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/runs", async (c) => {
  const userId = c.get("user_id");
  const runs = await all(
    c.env.DB,
    "SELECT * FROM cascade_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    [userId],
  );
  return c.json({ runs });
});

app.get("/runs/:id", async (c) => {
  const id = c.req.param("id");
  const run = await one(c.env.DB, "SELECT * FROM cascade_runs WHERE id = ?", [id]);
  const invocations = await all(
    c.env.DB,
    "SELECT id, role_name, status, cost_cents, created_at FROM role_invocations WHERE cascade_run_id = ? ORDER BY created_at",
    [id],
  );
  return c.json({ run, invocations });
});

// Manually trigger a cascade for a specific source. The cascade itself runs
// in the background via waitUntil — the response returns immediately with
// just an acknowledgement; progress shows up on /live via orchestrator_events.
app.post("/run", async (c) => {
  const userId = c.get("user_id");
  const body = (await c.req.json().catch(() => ({}))) as { source_id?: string };
  if (!body.source_id) throw badRequest("source_id is required");
  const source = await one<{ id: string }>(
    c.env.DB,
    "SELECT id FROM sources WHERE id = ? AND user_id = ?",
    [body.source_id, userId],
  );
  if (!source) throw notFound("source");
  c.executionCtx.waitUntil(
    runCascade(c.env, { userId, sourceId: body.source_id, trigger: "operator" }),
  );
  return c.json({ accepted: true, source_id: body.source_id }, 202);
});

export default app;
