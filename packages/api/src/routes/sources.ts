// Sources routes — see canopticon-api-v1.0.md §4.
//
//   GET  /v1/sources                      list with filters + pagination
//   GET  /v1/sources/:id                  single source detail
//   POST /v1/sources                      operator URL or text upload
//   GET  /v1/sources/:id/critic-report    Critic's most recent report
//   POST /v1/sources/:id/{approve,defer,reject}
//
// Multipart upload (POST /v1/sources/upload) lands when the R2 binding
// is wired in.
//
// Every route runs through requireAuth(); inserts/updates use the
// user-scoped Supabase client so RLS enforces ownership at the DB layer
// (defense in depth — the route also sets user_id explicitly).

import {
  INGESTION_STATES,
  type IngestionState,
  SOURCE_TYPES,
  type SourceType,
} from "@canopticon/shared";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { userClient } from "../lib/supabase.ts";

const sources = new Hono<AuthContext>();

sources.use("*", requireAuth());

// --- list ---------------------------------------------------------------

const listQuerySchema = z.object({
  ingestion_state: z
    .enum(INGESTION_STATES as readonly [IngestionState, ...IngestionState[]])
    .optional(),
  source_type: z.enum(SOURCE_TYPES as readonly [SourceType, ...SourceType[]]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

sources.get("/", async (c) => {
  const parsed = listQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    throw badRequest("Invalid query parameters", { issues: parsed.error.issues });
  }
  const { ingestion_state, source_type, limit, cursor } = parsed.data;

  const client = userClient(c.env, c.get("jwt"));
  let query = client
    .from("sources")
    .select(
      "id, source_type, title, url, publication, author, published_at, retrieved_at, admiralty_grade, ingestion_mode, ingestion_state, slug, created_at",
    )
    .order("retrieved_at", { ascending: false })
    .limit(limit);

  if (ingestion_state) query = query.eq("ingestion_state", ingestion_state);
  if (source_type) query = query.eq("source_type", source_type);
  if (cursor) query = query.lt("retrieved_at", cursor);

  const { data, error } = await query;
  if (error) throw new Error(`sources.list: ${error.message}`);

  const next_cursor =
    data && data.length === limit
      ? (data[data.length - 1] as { retrieved_at: string }).retrieved_at
      : null;

  return c.json({ data, next_cursor });
});

// --- get one ------------------------------------------------------------

sources.get("/:id", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));
  const { data, error } = await client.from("sources").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`sources.get: ${error.message}`);
  if (!data) throw notFound("Source not found");
  return c.json({ data });
});

// --- create -------------------------------------------------------------

const createSchema = z.object({
  source_type: z.enum(SOURCE_TYPES as readonly [SourceType, ...SourceType[]]),
  title: z.string().min(1).max(500),
  url: z.string().url().optional(),
  publication: z.string().optional(),
  author: z.string().optional(),
  published_at: z.string().datetime().optional(),
  raw_text: z.string().optional(),
  admiralty_grade: z.enum(["A", "B", "C", "D", "E", "F"]).default("B"),
  bias_profile: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  slug: z.string().optional(),
});

sources.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid source payload", { issues: parsed.error.issues });
  }

  const client = userClient(c.env, c.get("jwt"));
  const { data, error } = await client
    .from("sources")
    .insert({
      user_id: c.get("user_id"),
      source_type: parsed.data.source_type,
      title: parsed.data.title,
      url: parsed.data.url ?? null,
      publication: parsed.data.publication ?? null,
      author: parsed.data.author ?? null,
      published_at: parsed.data.published_at ?? null,
      raw_text: parsed.data.raw_text ?? null,
      admiralty_grade: parsed.data.admiralty_grade,
      bias_profile: parsed.data.bias_profile ?? null,
      metadata: parsed.data.metadata ?? {},
      ingestion_mode: "operator",
      ingestion_state: "pending_critic",
      slug: parsed.data.slug ?? null,
    })
    .select(
      "id, source_type, title, url, publication, admiralty_grade, ingestion_mode, ingestion_state, retrieved_at",
    )
    .single();

  if (error) throw new Error(`sources.create: ${error.message}`);
  return c.json({ data }, 201);
});

// --- critic report ------------------------------------------------------

sources.get("/:id/critic-report", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));
  const { data, error } = await client
    .from("ingestion_critic_reports")
    .select("*")
    .eq("source_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`sources.critic-report: ${error.message}`);
  if (!data) throw notFound("No critic report for this source");
  return c.json({ data });
});

// --- approve / defer / reject -------------------------------------------

const actionNotesSchema = z.object({ notes: z.string().max(2000).optional() });

async function recordAction(
  c: Context<AuthContext>,
  action: "approved" | "deferred" | "rejected",
): Promise<Response> {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");

  const body = await c.req.json().catch(() => ({}));
  const parsed = actionNotesSchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw badRequest("Invalid action payload", { issues: parsed.error.issues });
  }

  const client = userClient(c.env, c.get("jwt"));

  // Confirm the source exists and belongs to the user (RLS enforces, but
  // a 404 reads better than the silent no-op of an UPDATE that matched
  // zero rows).
  const { data: source, error: fetchErr } = await client
    .from("sources")
    .select("id, ingestion_state")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) throw new Error(`sources.${action}: ${fetchErr.message}`);
  if (!source) throw notFound("Source not found");

  // Update the source state and append the action. We can't run these in
  // a single transaction over the JS client; do them in sequence and
  // accept that a partial failure leaves the action row without a state
  // move. Sprint 2 wraps these in a Postgres RPC for atomicity.
  const { error: updateErr } = await client
    .from("sources")
    .update({ ingestion_state: action })
    .eq("id", id);
  if (updateErr) throw new Error(`sources.${action}: ${updateErr.message}`);

  const { data: actionRow, error: actionErr } = await client
    .from("ingestion_actions")
    .insert({
      user_id: c.get("user_id"),
      source_id: id,
      action,
      notes: parsed.data.notes ?? null,
    })
    .select("id, action, acted_at, notes")
    .single();
  if (actionErr) throw new Error(`sources.${action}: ${actionErr.message}`);

  return c.json({ data: { source_id: id, action: actionRow } });
}

sources.post("/:id/approve", (c) => recordAction(c, "approved"));
sources.post("/:id/defer", (c) => recordAction(c, "deferred"));
sources.post("/:id/reject", (c) => recordAction(c, "rejected"));

export default sources;
