// Articles: list, fetch, create, version, publish-prep, corrections.

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
  let q = client
    .from("articles")
    .select(`
      id, article_type, title, subtitle, author, byline_date, is_public, public_slug, published_at, thesis_id,
      current_version:article_versions!articles_current_version_fk (id, version_number, word_count, reading_time_minutes)
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (type) q = q.eq("article_type", type);
  const { data, error } = await q;
  if (error) throw error;
  return c.json({ articles: data ?? [] });
});

app.get("/:id", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const { data, error } = await client.from("articles").select("*").eq("id", id).single();
  if (error) throw error;
  const [versions, claims, corrections] = await Promise.all([
    client
      .from("article_versions")
      .select("*")
      .eq("article_id", id)
      .order("version_number", { ascending: false }),
    client
      .from("article_claims")
      .select("claim_id, citation_locator")
      .eq(
        "article_version_id",
        (data as { current_version_id: string | null }).current_version_id ??
          "00000000-0000-0000-0000-000000000000",
      ),
    client
      .from("article_corrections")
      .select("*")
      .eq("article_id", id)
      .order("corrected_at", { ascending: false }),
  ]);
  return c.json({
    article: data,
    versions: versions.data ?? [],
    claims: claims.data ?? [],
    corrections: corrections.data ?? [],
  });
});

const createSchema = z.object({
  article_type: z.enum([
    "intelligence_thesis",
    "policy_brief",
    "argument_map",
    "solution_inventory",
    "root_cause_analysis",
    "prediction_log",
    "book_chapter",
    "investigation_note",
    "frame_genealogy",
  ]),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  thesis_id: z.string().uuid().optional(),
  argument_map_id: z.string().uuid().optional(),
  solution_inventory_id: z.string().uuid().optional(),
  frame_genealogy_id: z.string().uuid().optional(),
  five_whys_chain_id: z.string().uuid().optional(),
});

app.post("/", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const { data, error } = await client
    .from("articles")
    .insert({ user_id: userId, ...parsed.data })
    .select("id")
    .single();
  if (error) throw error;
  return c.json({ id: (data as { id: string }).id }, 201);
});

const correctionSchema = z.object({
  original_text: z.string().optional(),
  corrected_text: z.string().min(1),
  reason: z.string().min(1),
  affects_claim_id: z.string().uuid().optional(),
  is_public: z.boolean().optional(),
});

app.post("/:id/corrections", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const id = c.req.param("id");
  const parsed = correctionSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const { data, error } = await client
    .from("article_corrections")
    .insert({
      user_id: userId,
      article_id: id,
      ...parsed.data,
    })
    .select("id")
    .single();
  if (error) throw error;
  return c.json({ id: (data as { id: string }).id }, 201);
});

export default app;
