// Cascade orchestration entry points.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, insertOne, one } from "../lib/d1.ts";

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

app.post("/run", async (c) => {
  const userId = c.get("user_id");
  const runId = await insertOne(c.env.DB, "cascade_runs", {
    user_id: userId,
    status: "pending",
    trigger_source: "operator",
    started_at: new Date().toISOString(),
  });
  await insertOne(c.env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: "cascade.started",
    cascade_run_id: runId,
    subject_kind: "cascade_run",
    subject_id: runId,
    payload: { trigger: "operator" },
  });
  return c.json({ run_id: runId }, 202);
});

export default app;
