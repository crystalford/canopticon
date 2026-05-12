// Productions: studio queue, scripts, beats, publishes.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, one, updateById } from "../lib/d1.ts";
import { badRequest } from "../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const userId = c.get("user_id");
  const state = c.req.query("state");
  const productions = state
    ? await all(
        c.env.DB,
        "SELECT * FROM productions WHERE user_id = ? AND state = ? ORDER BY updated_at DESC",
        [userId, state],
      )
    : await all(c.env.DB, "SELECT * FROM productions WHERE user_id = ? ORDER BY updated_at DESC", [
        userId,
      ]);
  return c.json({ productions });
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const production = await one(c.env.DB, "SELECT * FROM productions WHERE id = ?", [id]);
  const scripts = await all(
    c.env.DB,
    "SELECT * FROM scripts WHERE production_id = ? ORDER BY version_number DESC",
    [id],
  );
  const publishes = await all(
    c.env.DB,
    "SELECT * FROM production_publishes WHERE production_id = ?",
    [id],
  );
  return c.json({ production, scripts, publishes });
});

app.get("/:id/beats", async (c) => {
  const id = c.req.param("id");
  const script = await one<{ id: string }>(
    c.env.DB,
    "SELECT id FROM scripts WHERE production_id = ? ORDER BY version_number DESC LIMIT 1",
    [id],
  );
  if (!script) return c.json({ beats: [] });
  const beats = await all(
    c.env.DB,
    "SELECT * FROM beats WHERE script_id = ? ORDER BY beat_number",
    [script.id],
  );
  return c.json({ beats, script_id: script.id });
});

const beatStateSchema = z.object({
  state: z.enum(["pending", "good", "skipped", "rerecord"]),
  recording_uri: z.string().optional(),
});

app.patch("/beats/:id", async (c) => {
  const id = c.req.param("id");
  const parsed = beatStateSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const update: Record<string, unknown> = { state: parsed.data.state };
  if (parsed.data.recording_uri) {
    update.recording_uri = parsed.data.recording_uri;
    update.recorded_at = new Date().toISOString();
  }
  await updateById(c.env.DB, "beats", id, update);
  return c.json({ ok: true });
});

const stateSchema = z.object({
  state: z.enum(["ready", "recording", "producing", "publish", "perf", "archive"]),
});

app.patch("/:id/state", async (c) => {
  const id = c.req.param("id");
  const parsed = stateSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  await updateById(c.env.DB, "productions", id, { state: parsed.data.state });
  return c.json({ ok: true });
});

export default app;
