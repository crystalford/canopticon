// Sources: list, ingest, approve/defer/reject.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, insertOne, one, run, updateById } from "../lib/d1.ts";
import { badRequest } from "../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const userId = c.get("user_id");
  const state = c.req.query("state");
  const rows = state
    ? await all(
        c.env.DB,
        "SELECT id, title, url, source_type, ingestion_state, admiralty_grade, bias_profile, ingested_at, published_at FROM sources WHERE user_id = ? AND ingestion_state = ? ORDER BY ingested_at DESC LIMIT 100",
        [userId, state],
      )
    : await all(
        c.env.DB,
        "SELECT id, title, url, source_type, ingestion_state, admiralty_grade, bias_profile, ingested_at, published_at FROM sources WHERE user_id = ? ORDER BY ingested_at DESC LIMIT 100",
        [userId],
      );
  return c.json({ sources: rows });
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const source = await one(c.env.DB, "SELECT * FROM sources WHERE id = ?", [id]);
  const critic_report = await one(
    c.env.DB,
    "SELECT * FROM ingestion_critic_reports WHERE source_id = ?",
    [id],
  );
  return c.json({ source, critic_report });
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
  const userId = c.get("user_id");
  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid source body", { issues: parsed.error.issues });
  const id = await insertOne(c.env.DB, "sources", {
    user_id: userId,
    ...parsed.data,
    authors: parsed.data.authors ?? [],
    metadata: parsed.data.metadata ?? {},
    ingested_via: "operator_upload",
  });
  return c.json({ id }, 201);
});

const actionSchema = z.object({
  action: z.enum(["approve", "defer", "reject", "edit_grade"]),
  notes: z.string().optional(),
  grade: z.enum(["A", "B", "C", "D", "E", "F"]).optional(),
});

app.post("/:id/action", async (c) => {
  const userId = c.get("user_id");
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
  await updateById(c.env.DB, "sources", id, updates);
  await insertOne(c.env.DB, "ingestion_actions", {
    user_id: userId,
    source_id: id,
    action,
    notes: notes ?? null,
    payload: { grade: grade ?? null },
  });
  void run;
  return c.json({ ok: true });
});

export default app;
