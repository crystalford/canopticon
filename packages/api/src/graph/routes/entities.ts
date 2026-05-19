// Entities: list, graph, resolution queue.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../../auth/middleware.ts";
import { all, insertOne, one, parseJson, updateById } from "../../lib/d1.ts";
import { badRequest } from "../../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const userId = c.get("user_id");
  const type = c.req.query("type");
  const search = c.req.query("q");
  let sql =
    "SELECT id, canonical_name, entity_type, primary_attribute, heat_score, public_slug FROM entities WHERE user_id = ?";
  const params: unknown[] = [userId];
  if (type) {
    sql += " AND entity_type = ?";
    params.push(type);
  }
  if (search) {
    sql += " AND canonical_name LIKE ?";
    params.push(`%${search}%`);
  }
  sql += " ORDER BY heat_score DESC LIMIT 200";
  const entities = await all(c.env.DB, sql, params);
  return c.json({ entities });
});

app.get("/graph", async (c) => {
  const userId = c.get("user_id");
  const nodes = await all(
    c.env.DB,
    "SELECT id, canonical_name, entity_type, heat_score, pinned_thesis_ids FROM entities WHERE user_id = ? LIMIT 500",
    [userId],
  );
  const edges = await all(
    c.env.DB,
    "SELECT from_entity_id, to_entity_id, relation_type, strength FROM entity_relations WHERE user_id = ? LIMIT 2000",
    [userId],
  );
  return c.json({
    nodes: nodes.map((n) => ({
      ...n,
      pinned_thesis_ids: parseJson((n as { pinned_thesis_ids: unknown }).pinned_thesis_ids, []),
    })),
    edges,
  });
});

app.get("/resolution-queue", async (c) => {
  const userId = c.get("user_id");
  const queue = await all(
    c.env.DB,
    "SELECT * FROM entity_resolution_queue WHERE user_id = ? AND status = 'pending'",
    [userId],
  );
  return c.json({ queue });
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const entity = await one(c.env.DB, "SELECT * FROM entities WHERE id = ?", [id]);
  const relations_from = await all(
    c.env.DB,
    "SELECT * FROM entity_relations WHERE from_entity_id = ?",
    [id],
  );
  const relations_to = await all(
    c.env.DB,
    "SELECT * FROM entity_relations WHERE to_entity_id = ?",
    [id],
  );
  const mentions = await all<{ claim_id: string }>(
    c.env.DB,
    "SELECT claim_id FROM claim_entities WHERE entity_id = ? LIMIT 50",
    [id],
  );
  return c.json({
    entity,
    relations_from,
    relations_to,
    claim_ids: mentions.map((m) => m.claim_id),
  });
});

const resolveSchema = z.object({
  decision: z.enum(["confirm", "create_new", "defer"]),
  matched_entity_id: z.string().uuid().optional(),
  proposed_canonical_name: z.string().optional(),
  proposed_entity_type: z
    .enum([
      "person",
      "organization",
      "institution",
      "corporation",
      "department",
      "office",
      "legislation",
      "event",
      "concept",
      "location",
    ])
    .optional(),
  notes: z.string().optional(),
});

app.post("/resolution-queue/:id/decide", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const parsed = resolveSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid decision", { issues: parsed.error.issues });

  const row = await one<{ mention_id: string }>(
    c.env.DB,
    "SELECT mention_id FROM entity_resolution_queue WHERE id = ?",
    [id],
  );
  if (!row) throw badRequest("queue row not found");

  if (parsed.data.decision === "confirm" && parsed.data.matched_entity_id) {
    await updateById(c.env.DB, "entity_mentions", row.mention_id, {
      entity_id: parsed.data.matched_entity_id,
      resolved: true,
      resolved_at: new Date().toISOString(),
    });
  } else if (parsed.data.decision === "create_new" && parsed.data.proposed_canonical_name) {
    const newId = await insertOne(c.env.DB, "entities", {
      user_id: userId,
      canonical_name: parsed.data.proposed_canonical_name,
      entity_type: parsed.data.proposed_entity_type ?? "person",
    });
    await updateById(c.env.DB, "entity_mentions", row.mention_id, {
      entity_id: newId,
      resolved: true,
      resolved_at: new Date().toISOString(),
    });
  }

  const status =
    parsed.data.decision === "defer"
      ? "deferred"
      : parsed.data.decision === "create_new"
        ? "created"
        : "confirmed";
  await updateById(c.env.DB, "entity_resolution_queue", id, {
    status,
    decided_at: new Date().toISOString(),
    decision_notes: parsed.data.notes ?? null,
  });
  return c.json({ ok: true });
});

export default app;
