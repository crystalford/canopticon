// Lighthouse — operator endpoints for pattern candidates + gaps +
// timeline events. Sign / dismiss / create flows for the operator
// Leads queue. Pattern auto-detection is a deferred follow-up; for
// Phase 4 the operator authors patterns directly through chat tools
// or this endpoint.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../../auth/middleware.ts";
import { all, insertOne, one, run } from "../../lib/d1.ts";
import { badRequest, notFound } from "../../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

// List candidates + signed patterns for the operator queue.
app.get("/patterns", async (c) => {
  const userId = c.get("user_id");
  const status = c.req.query("status") ?? "candidate";
  const rows = await all(
    c.env.DB,
    `SELECT id, slug, kind, title, statement_md, confidence, status, signed_by,
            signed_at, created_at
       FROM patterns WHERE user_id = ? AND status = ?
      ORDER BY created_at DESC LIMIT 100`,
    [userId, status],
  );
  return c.json({ patterns: rows });
});

const createPatternSchema = z.object({
  slug: z.string().min(1).max(80),
  kind: z.enum([
    "recurring-actor",
    "frame",
    "contradiction",
    "rules-for-thee",
    "measurement",
    "net-zero",
    "other",
  ]),
  title: z.string().min(1),
  statement_md: z.string().min(1),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  disconfirming_md: z.string().optional(),
  notes_md: z.string().optional(),
  date_range_from: z.string().optional(),
  date_range_to: z.string().optional(),
  piece_ids: z.array(z.string()).optional(),
  entity_ids: z.array(z.string()).optional(),
  topic_ids: z.array(z.string()).optional(),
});

app.post("/patterns", async (c) => {
  const userId = c.get("user_id");
  const parsed = createPatternSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const p = parsed.data;
  const id = await insertOne(c.env.DB, "patterns", {
    user_id: userId,
    slug: p.slug,
    kind: p.kind,
    title: p.title,
    statement_md: p.statement_md,
    confidence: p.confidence ?? "medium",
    disconfirming_md: p.disconfirming_md ?? "",
    notes_md: p.notes_md ?? null,
    date_range_from: p.date_range_from ?? null,
    date_range_to: p.date_range_to ?? null,
    status: "candidate",
  });
  for (const piece_id of p.piece_ids ?? []) {
    await insertOne(c.env.DB, "pattern_pieces", { pattern_id: id, piece_id, user_id: userId });
  }
  for (const entity_id of p.entity_ids ?? []) {
    await insertOne(c.env.DB, "pattern_entities", { pattern_id: id, entity_id, user_id: userId });
  }
  for (const topic_id of p.topic_ids ?? []) {
    await insertOne(c.env.DB, "pattern_topics", { pattern_id: id, topic_id, user_id: userId });
  }
  return c.json({ ok: true, id });
});

const decisionSchema = z.object({
  decision: z.enum(["sign", "dismiss"]),
  reason: z.string().optional(),
});

app.post("/patterns/:id/decide", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const parsed = decisionSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });

  const existing = await one<{ id: string; status: string }>(
    c.env.DB,
    "SELECT id, status FROM patterns WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!existing) throw notFound("pattern");

  if (parsed.data.decision === "sign") {
    await run(
      c.env.DB,
      `UPDATE patterns SET status = 'signed', signed_by = ?, signed_at = ?, updated_at = ?
        WHERE id = ?`,
      [userId, new Date().toISOString(), new Date().toISOString(), id],
    );
  } else {
    await run(
      c.env.DB,
      `UPDATE patterns SET status = 'dismissed', dismissal_reason = ?, updated_at = ?
        WHERE id = ?`,
      [parsed.data.reason ?? null, new Date().toISOString(), id],
    );
  }
  return c.json({ ok: true, decision: parsed.data.decision });
});

// Gaps — list + create.
const gapSchema = z.object({
  slug: z.string().min(1).max(80),
  title: z.string().min(1),
  subject_kind: z.enum(["entity", "topic", "corpus"]),
  subject_id: z.string().optional(),
  what_we_have_md: z.string().optional(),
  what_we_lack_md: z.string().optional(),
  suggested_next_step_md: z.string().optional(),
});

app.get("/gaps", async (c) => {
  const userId = c.get("user_id");
  const rows = await all(
    c.env.DB,
    `SELECT id, slug, title, subject_kind, subject_id, status, signed_by, updated_at
       FROM gaps WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200`,
    [userId],
  );
  return c.json({ gaps: rows });
});

app.post("/gaps", async (c) => {
  const userId = c.get("user_id");
  const parsed = gapSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const g = parsed.data;
  const id = await insertOne(c.env.DB, "gaps", {
    user_id: userId,
    slug: g.slug,
    title: g.title,
    subject_kind: g.subject_kind,
    subject_id: g.subject_id ?? null,
    what_we_have_md: g.what_we_have_md ?? "",
    what_we_lack_md: g.what_we_lack_md ?? "",
    suggested_next_step_md: g.suggested_next_step_md ?? "",
    signed_by: userId,
    signed_at: new Date().toISOString(),
  });
  return c.json({ ok: true, id });
});

// Timeline events — list + create.
const timelineSchema = z.object({
  event_date: z.string().min(1),
  title: z.string().min(1),
  body_md: z.string().optional(),
  related_piece_ids: z.array(z.string()).optional(),
  related_entity_ids: z.array(z.string()).optional(),
  significance: z.enum(["major", "context"]).optional(),
});

app.get("/timeline", async (c) => {
  const userId = c.get("user_id");
  const rows = await all(
    c.env.DB,
    `SELECT id, event_date, title, significance, signed_by
       FROM timeline_events WHERE user_id = ? ORDER BY event_date DESC LIMIT 500`,
    [userId],
  );
  return c.json({ events: rows });
});

app.post("/timeline", async (c) => {
  const userId = c.get("user_id");
  const parsed = timelineSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const e = parsed.data;
  const id = await insertOne(c.env.DB, "timeline_events", {
    user_id: userId,
    event_date: e.event_date,
    title: e.title,
    body_md: e.body_md ?? null,
    related_piece_ids: e.related_piece_ids ?? [],
    related_entity_ids: e.related_entity_ids ?? [],
    significance: e.significance ?? "context",
    signed_by: userId,
  });
  return c.json({ ok: true, id });
});

export default app;
