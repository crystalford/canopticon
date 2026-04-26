// Entities routes — see canopticon-api-v1.0.md §15 and schema-v1.0 §5.
//
//   GET    /v1/entities                            list (filter by type, search)
//   GET    /v1/entities/:id                        one entity with mention count
//                                                    + linked claim count
//   POST   /v1/entities                            declare an entity manually
//   PATCH  /v1/entities/:id                        edit fields, add aliases
//   GET    /v1/entities/mentions/unresolved        operator review queue
//   POST   /v1/entities/mentions/:mention_id/link  link a mention to an entity
//                                                    (operator disambiguation)
//   POST   /v1/entities/resolve                    fire the deterministic
//                                                    resolver across all
//                                                    unresolved mentions

import { ENTITY_TYPES } from "@canopticon/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { serviceClient, userClient } from "../lib/supabase.ts";
import { runEntityResolver } from "../orchestrator/entity_resolver.ts";

const entities = new Hono<AuthContext>();
entities.use("*", requireAuth());

// --- list ----------------------------------------------------------------

entities.get("/", async (c) => {
  const type = c.req.query("entity_type");
  const search = c.req.query("q");
  const client = userClient(c.env, c.get("jwt"));
  let q = client
    .from("entities")
    .select(
      "id, entity_type, canonical_name, display_name, aliases, slug, description, last_seen_at, created_at",
    )
    .eq("is_excluded", false)
    .order("last_seen_at", { ascending: false })
    .limit(200);
  if (type) q = q.eq("entity_type", type);
  if (search) q = q.ilike("canonical_name", `%${search}%`);
  const { data, error } = await q;
  if (error) throw new Error(`entities.list: ${error.message}`);
  return c.json({ data });
});

// --- detail --------------------------------------------------------------

entities.get("/:id", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: entity, error } = await client
    .from("entities")
    .select(
      "id, entity_type, canonical_name, display_name, aliases, slug, description, metadata, first_seen_at, last_seen_at, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`entities.get: ${error.message}`);
  if (!entity) throw notFound("Entity not found");

  const [{ count: mention_count }, { count: claim_count }] = await Promise.all([
    client.from("entity_mentions").select("id", { count: "exact", head: true }).eq("entity_id", id),
    client.from("claim_entities").select("id", { count: "exact", head: true }).eq("entity_id", id),
  ]);

  return c.json({
    data: { ...entity, mention_count: mention_count ?? 0, claim_count: claim_count ?? 0 },
  });
});

// --- create --------------------------------------------------------------

const createSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES as readonly [string, ...string[]]),
  canonical_name: z.string().min(2).max(300),
  display_name: z.string().min(2).max(300).optional(),
  aliases: z.array(z.string().min(1)).default([]),
  description: z.string().max(4000).optional(),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

entities.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid entity payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const { data, error } = await client
    .from("entities")
    .insert({
      user_id: userId,
      entity_type: parsed.data.entity_type,
      canonical_name: parsed.data.canonical_name,
      display_name: parsed.data.display_name ?? parsed.data.canonical_name,
      aliases: parsed.data.aliases,
      description: parsed.data.description ?? null,
      slug: parsed.data.slug ?? null,
    })
    .select("id, canonical_name, slug, created_at")
    .single();
  if (error) {
    if (error.code === "23505") throw badRequest("An entity with that slug already exists");
    throw new Error(`entities.create: ${error.message}`);
  }
  return c.json({ data }, 201);
});

// --- patch ---------------------------------------------------------------

const patchSchema = z.object({
  canonical_name: z.string().min(2).max(300).optional(),
  display_name: z.string().min(2).max(300).optional(),
  aliases: z.array(z.string().min(1)).optional(),
  description: z.string().max(4000).nullable().optional(),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .nullable()
    .optional(),
  is_excluded: z.boolean().optional(),
});

entities.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid patch payload", { issues: parsed.error.issues });
  }
  const client = userClient(c.env, c.get("jwt"));

  const { data, error } = await client
    .from("entities")
    .update(parsed.data)
    .eq("id", id)
    .select("id, canonical_name, display_name, aliases, slug, updated_at")
    .single();
  if (error) throw new Error(`entities.patch: ${error.message}`);
  return c.json({ data });
});

// --- mentions: review queue ---------------------------------------------

entities.get("/mentions/unresolved", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const { data, error } = await client
    .from("entity_mentions")
    .select("id, source_id, mention_text, context_excerpt, created_at")
    .is("entity_id", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`entities.mentions: ${error.message}`);
  return c.json({ data });
});

const linkSchema = z.object({
  entity_id: z.string().uuid(),
});

entities.post("/mentions/:mention_id/link", async (c) => {
  const mentionId = c.req.param("mention_id");
  if (!mentionId) throw badRequest("Missing :mention_id parameter");
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid link payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: mention, error: mErr } = await client
    .from("entity_mentions")
    .select("id, source_id")
    .eq("id", mentionId)
    .maybeSingle<{ id: string; source_id: string }>();
  if (mErr || !mention) throw notFound("Mention not found");

  const { error: updErr } = await client
    .from("entity_mentions")
    .update({
      entity_id: parsed.data.entity_id,
      resolution_confidence: 1.0,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", mentionId);
  if (updErr) throw new Error(`entities.mentions.link: ${updErr.message}`);

  // Walk claim_sources → write claim_entities for every claim citing
  // this source. Duplicates are a no-op.
  const { data: cs } = await client
    .from("claim_sources")
    .select("claim_id")
    .eq("source_id", mention.source_id);
  const claimIds = Array.from(
    new Set((cs ?? []).map((row) => (row as { claim_id: string }).claim_id)),
  );
  let written = 0;
  for (const claim_id of claimIds) {
    const { error } = await client.from("claim_entities").insert({
      user_id: userId,
      claim_id,
      entity_id: parsed.data.entity_id,
      role_in_claim: null,
    });
    if (!error) written++;
  }

  return c.json({ data: { mention_id: mentionId, linked: true, claim_entities_written: written } });
});

// --- resolver ------------------------------------------------------------

entities.post("/resolve", async (c) => {
  const userId = c.get("user_id");
  const ctx = { service: serviceClient(c.env) };
  const result = await runEntityResolver(ctx, {
    user_id: userId,
    triggered_by: "entities.resolve",
  });
  return c.json({ data: result });
});

export default entities;
