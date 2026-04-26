// Entities: list, fetch, resolution queue, manual resolution.
// Powers Graph screen + Sources screen entity-resolution tab.

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
  const type = c.req.query("type");
  const search = c.req.query("q");
  let q = client
    .from("entities")
    .select("id, canonical_name, entity_type, primary_attribute, heat_score, public_slug")
    .eq("user_id", userId)
    .order("heat_score", { ascending: false })
    .limit(200);
  if (type) q = q.eq("entity_type", type);
  if (search) q = q.ilike("canonical_name", `%${search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return c.json({ entities: data ?? [] });
});

app.get("/graph", async (c) => {
  // Returns nodes + edges for the Graph screen.
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const [entR, relR] = await Promise.all([
    client
      .from("entities")
      .select("id, canonical_name, entity_type, heat_score, pinned_thesis_ids")
      .eq("user_id", userId)
      .limit(500),
    client
      .from("entity_relations")
      .select("from_entity_id, to_entity_id, relation_type, strength")
      .eq("user_id", userId)
      .limit(2000),
  ]);
  if (entR.error || relR.error) throw entR.error ?? relR.error;
  return c.json({ nodes: entR.data ?? [], edges: relR.data ?? [] });
});

app.get("/:id", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const { data, error } = await client.from("entities").select("*").eq("id", id).single();
  if (error) throw error;
  const [relsFrom, relsTo, mentions] = await Promise.all([
    client.from("entity_relations").select("*").eq("from_entity_id", id),
    client.from("entity_relations").select("*").eq("to_entity_id", id),
    client.from("claim_entities").select("claim_id").eq("entity_id", id).limit(50),
  ]);
  return c.json({
    entity: data,
    relations_from: relsFrom.data ?? [],
    relations_to: relsTo.data ?? [],
    claim_ids: (mentions.data ?? []).map((r) => (r as { claim_id: string }).claim_id),
  });
});

app.get("/resolution-queue", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const { data, error } = await client
    .from("entity_resolution_queue")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) throw error;
  return c.json({ queue: data ?? [] });
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
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const id = c.req.param("id");
  const parsed = resolveSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid decision", { issues: parsed.error.issues });

  const { data: row, error: rowErr } = await client
    .from("entity_resolution_queue")
    .select("mention_id")
    .eq("id", id)
    .single();
  if (rowErr) throw rowErr;
  const mentionId = (row as { mention_id: string }).mention_id;

  if (parsed.data.decision === "confirm" && parsed.data.matched_entity_id) {
    await client
      .from("entity_mentions")
      .update({
        entity_id: parsed.data.matched_entity_id,
        resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", mentionId);
  } else if (parsed.data.decision === "create_new" && parsed.data.proposed_canonical_name) {
    const { data: newEnt } = await client
      .from("entities")
      .insert({
        user_id: userId,
        canonical_name: parsed.data.proposed_canonical_name,
        entity_type: parsed.data.proposed_entity_type ?? "person",
      })
      .select("id")
      .single();
    if (newEnt) {
      await client
        .from("entity_mentions")
        .update({
          entity_id: (newEnt as { id: string }).id,
          resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", mentionId);
    }
  }

  await client
    .from("entity_resolution_queue")
    .update({
      status:
        parsed.data.decision === "defer"
          ? "deferred"
          : parsed.data.decision === "create_new"
            ? "created"
            : "confirmed",
      decided_at: new Date().toISOString(),
      decision_notes: parsed.data.notes ?? null,
    })
    .eq("id", id);

  return c.json({ ok: true });
});

export default app;
