// Library: cross-substrate search across articles, books, sources, theses, claims.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { userClient } from "../lib/supabase.ts";
import { getPublicUserId } from "../lib/user.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/search", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const q = c.req.query("q") ?? "";
  const types = (c.req.query("types") ?? "articles,books,sources,theses").split(",");

  const results: Record<string, unknown[]> = {};
  if (types.includes("articles")) {
    const { data } = await client
      .from("articles")
      .select("id, title, subtitle, article_type, public_slug")
      .eq("user_id", userId)
      .ilike("title", `%${q}%`)
      .limit(20);
    results.articles = data ?? [];
  }
  if (types.includes("books")) {
    const { data } = await client
      .from("books")
      .select("id, title, authors, ingest_mode, reading_progress")
      .eq("user_id", userId)
      .ilike("title", `%${q}%`)
      .limit(20);
    results.books = data ?? [];
  }
  if (types.includes("sources")) {
    const { data } = await client
      .from("sources")
      .select("id, title, source_type, admiralty_grade, published_at")
      .eq("user_id", userId)
      .ilike("title", `%${q}%`)
      .limit(20);
    results.sources = data ?? [];
  }
  if (types.includes("theses")) {
    const { data } = await client
      .from("theses")
      .select("id, title, seed_summary, public_slug")
      .eq("user_id", userId)
      .ilike("title", `%${q}%`)
      .limit(20);
    results.theses = data ?? [];
  }
  if (types.includes("claims")) {
    // Search claim_versions for claim_text.
    const { data } = await client
      .from("claim_versions")
      .select("claim_id, claim_text")
      .ilike("claim_text", `%${q}%`)
      .limit(20);
    results.claims = data ?? [];
  }
  return c.json(results);
});

app.get("/books", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const { data, error } = await client
    .from("books")
    .select("*, book_chapters(id, chapter_number, title)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return c.json({ books: data ?? [] });
});

export default app;
