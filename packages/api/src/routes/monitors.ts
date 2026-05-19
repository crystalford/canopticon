// Monitors: curated watchers over high-signal sources (BIS, FSB, etc.).
// Watcher runs are kicked off either on schedule (see src/index.ts
// scheduled() handler) or on-demand via POST /:id/run.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { runWatcher } from "../graph/lib/watcher.ts";
import { all, one, run } from "../lib/d1.ts";
import { badRequest, notFound } from "../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const userId = c.get("user_id");
  const rows = await all(
    c.env.DB,
    `SELECT id, name, tier, source_url, cadence_cron, enabled,
            last_run_at, last_status, last_finding, last_source_id, created_at
       FROM monitors WHERE user_id = ? ORDER BY tier ASC, name ASC`,
    [userId],
  );
  return c.json({ monitors: rows });
});

app.get("/:id", async (c) => {
  const userId = c.get("user_id");
  const monitor = await one(c.env.DB, "SELECT * FROM monitors WHERE id = ? AND user_id = ?", [
    c.req.param("id"),
    userId,
  ]);
  if (!monitor) throw notFound("monitor");
  return c.json({ monitor });
});

app.patch("/:id", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const body = (await c.req.json()) as {
    enabled?: boolean;
    scout_prompt?: string;
    cadence_cron?: string;
    source_url?: string;
    name?: string;
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.enabled !== undefined) {
    sets.push("enabled = ?");
    params.push(body.enabled ? 1 : 0);
  }
  if (body.scout_prompt !== undefined) {
    sets.push("scout_prompt = ?");
    params.push(body.scout_prompt);
  }
  if (body.cadence_cron !== undefined) {
    sets.push("cadence_cron = ?");
    params.push(body.cadence_cron);
  }
  if (body.source_url !== undefined) {
    sets.push("source_url = ?");
    params.push(body.source_url);
  }
  if (body.name !== undefined) {
    sets.push("name = ?");
    params.push(body.name);
  }
  if (sets.length === 0) throw badRequest("nothing to update");
  sets.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(id, userId);
  await run(
    c.env.DB,
    `UPDATE monitors SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
    params,
  );
  return c.json({ ok: true });
});

// Manual trigger: kick off the watcher in the background and 202 immediately.
app.post("/:id/run", async (c) => {
  const userId = c.get("user_id");
  const monitorId = c.req.param("id");
  const owned = await one<{ id: string }>(
    c.env.DB,
    "SELECT id FROM monitors WHERE id = ? AND user_id = ?",
    [monitorId, userId],
  );
  if (!owned) throw notFound("monitor");
  c.executionCtx.waitUntil(runWatcher(c.env, monitorId));
  return c.json({ accepted: true, monitor_id: monitorId }, 202);
});

export default app;
