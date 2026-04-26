// Productions: studio queue, scripts, beats, recording, publish.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { badRequest } from "../lib/errors.ts";
import { userClient } from "../lib/supabase.ts";
import { getPublicUserId } from "../lib/user.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const state = c.req.query("state");
  let q = client
    .from("productions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (state) q = q.eq("state", state);
  const { data, error } = await q;
  if (error) throw error;
  return c.json({ productions: data ?? [] });
});

app.get("/:id", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const { data, error } = await client.from("productions").select("*").eq("id", id).single();
  if (error) throw error;
  const { data: scripts } = await client
    .from("scripts")
    .select("*")
    .eq("production_id", id)
    .order("version_number", { ascending: false });
  const { data: publishes } = await client
    .from("production_publishes")
    .select("*")
    .eq("production_id", id);
  return c.json({ production: data, scripts: scripts ?? [], publishes: publishes ?? [] });
});

app.get("/:id/beats", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const { data: scripts } = await client
    .from("scripts")
    .select("id")
    .eq("production_id", id)
    .order("version_number", { ascending: false })
    .limit(1);
  if (!scripts || scripts.length === 0) return c.json({ beats: [] });
  const scriptId = (scripts[0] as { id: string }).id;
  const { data, error } = await client
    .from("beats")
    .select("*")
    .eq("script_id", scriptId)
    .order("beat_number");
  if (error) throw error;
  return c.json({ beats: data ?? [], script_id: scriptId });
});

const beatStateSchema = z.object({
  state: z.enum(["pending", "good", "skipped", "rerecord"]),
  recording_uri: z.string().optional(),
});

app.patch("/beats/:id", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const parsed = beatStateSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const update: Record<string, unknown> = { state: parsed.data.state };
  if (parsed.data.recording_uri) {
    update.recording_uri = parsed.data.recording_uri;
    update.recorded_at = new Date().toISOString();
  }
  const { error } = await client.from("beats").update(update).eq("id", id);
  if (error) throw error;
  return c.json({ ok: true });
});

const stateSchema = z.object({
  state: z.enum(["ready", "recording", "producing", "publish", "perf", "archive"]),
});

app.patch("/:id/state", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const parsed = stateSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const { error } = await client
    .from("productions")
    .update({ state: parsed.data.state })
    .eq("id", id);
  if (error) throw error;
  return c.json({ ok: true });
});

export default app;
