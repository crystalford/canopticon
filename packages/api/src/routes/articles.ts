// Articles + corrections.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, insertOne, one } from "../lib/d1.ts";
import { badRequest } from "../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const userId = c.get("user_id");
  const type = c.req.query("type");
  const sql = type
    ? `SELECT a.id, a.article_type, a.title, a.subtitle, a.author, a.byline_date,
              a.is_public, a.public_slug, a.published_at, a.thesis_id,
              av.id AS version_id, av.version_number, av.word_count, av.reading_time_minutes
       FROM articles a LEFT JOIN article_versions av ON av.id = a.current_version_id
       WHERE a.user_id = ? AND a.article_type = ? ORDER BY a.created_at DESC`
    : `SELECT a.id, a.article_type, a.title, a.subtitle, a.author, a.byline_date,
              a.is_public, a.public_slug, a.published_at, a.thesis_id,
              av.id AS version_id, av.version_number, av.word_count, av.reading_time_minutes
       FROM articles a LEFT JOIN article_versions av ON av.id = a.current_version_id
       WHERE a.user_id = ? ORDER BY a.created_at DESC`;
  const params = type ? [userId, type] : [userId];
  const articles = await all(c.env.DB, sql, params);
  return c.json({ articles });
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const article = await one<{ current_version_id: string | null }>(
    c.env.DB,
    "SELECT * FROM articles WHERE id = ?",
    [id],
  );
  const versions = await all(
    c.env.DB,
    "SELECT * FROM article_versions WHERE article_id = ? ORDER BY version_number DESC",
    [id],
  );
  const claims = article?.current_version_id
    ? await all(
        c.env.DB,
        "SELECT claim_id, citation_locator FROM article_claims WHERE article_version_id = ?",
        [article.current_version_id],
      )
    : [];
  const corrections = await all(
    c.env.DB,
    "SELECT * FROM article_corrections WHERE article_id = ? ORDER BY corrected_at DESC",
    [id],
  );
  return c.json({ article, versions, claims, corrections });
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
  const userId = c.get("user_id");
  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const id = await insertOne(c.env.DB, "articles", { user_id: userId, ...parsed.data });
  return c.json({ id }, 201);
});

const correctionSchema = z.object({
  original_text: z.string().optional(),
  corrected_text: z.string().min(1),
  reason: z.string().min(1),
  affects_claim_id: z.string().uuid().optional(),
  is_public: z.boolean().optional(),
});

app.post("/:id/corrections", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const parsed = correctionSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const cid = await insertOne(c.env.DB, "article_corrections", {
    user_id: userId,
    article_id: id,
    ...parsed.data,
    is_public: parsed.data.is_public ?? true,
  });
  return c.json({ id: cid }, 201);
});

export default app;
