// Sources: list, ingest, approve/defer/reject, view critic reports.
// Powers the Sources screen.

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
    .from("sources")
    .select(
      "id, title, url, source_type, ingestion_state, admiralty_grade, bias_profile, ingested_at, published_at",
    )
    .eq("user_id", userId)
    .order("ingested_at", { ascending: false })
    .limit(100);
  if (state) q = q.eq("ingestion_state", state);
  const { data, error } = await q;
  if (error) throw error;
  return c.json({ sources: data ?? [] });
});

app.get("/:id", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const { data, error } = await client.from("sources").select("*").eq("id", id).single();
  if (error) throw error;
  const { data: report } = await client
    .from("ingestion_critic_reports")
    .select("*")
    .eq("source_id", id)
    .maybeSingle();
  return c.json({ source: data, critic_report: report });
});

const createSchema = z.object({
  title: z.string().min(1),
  url: z.string().url().optional(),
  source_type: z.enum([
    "hansard",
    "news",
    "social",
    "video",
    "book",
    "filing",
    "report",
    "operator_note",
    "other",
  ]),
  content_text: z.string().optional(),
  external_id: z.string().optional(),
  authors: z.array(z.string()).optional(),
  published_at: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

app.post("/", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid source body", { issues: parsed.error.issues });
  const { data, error } = await client
    .from("sources")
    .insert({
      user_id: userId,
      ...parsed.data,
      ingested_via: "operator_upload",
    })
    .select("id")
    .single();
  if (error) throw error;
  return c.json({ id: (data as { id: string }).id }, 201);
});

const actionSchema = z.object({
  action: z.enum(["approve", "defer", "reject", "edit_grade"]),
  notes: z.string().optional(),
  grade: z.enum(["A", "B", "C", "D", "E", "F"]).optional(),
});

app.post("/:id/action", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const id = c.req.param("id");
  const parsed = actionSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid action body", { issues: parsed.error.issues });
  const { action, notes, grade } = parsed.data;

  const updates: Record<string, unknown> = {};
  if (action === "approve") {
    updates.ingestion_state = "approved";
    updates.approved_at = new Date().toISOString();
    updates.approved_by_user_id = userId;
    if (grade) updates.admiralty_grade = grade;
  } else if (action === "defer") {
    updates.ingestion_state = "deferred";
  } else if (action === "reject") {
    updates.ingestion_state = "rejected";
  } else if (action === "edit_grade" && grade) {
    updates.admiralty_grade = grade;
  }

  const { error: updErr } = await client.from("sources").update(updates).eq("id", id);
  if (updErr) throw updErr;

  const { error: actErr } = await client.from("ingestion_actions").insert({
    user_id: userId,
    source_id: id,
    action,
    notes: notes ?? null,
    payload: { grade: grade ?? null },
  });
  if (actErr) throw actErr;
  return c.json({ ok: true });
});

export default app;
