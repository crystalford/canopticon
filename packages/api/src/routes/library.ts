// Library: cross-substrate search.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all } from "../lib/d1.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/search", async (c) => {
  const userId = c.get("user_id");
  const q = c.req.query("q") ?? "";
  const types = (c.req.query("types") ?? "articles,books,sources,theses").split(",");
  const like = `%${q}%`;
  const results: Record<string, unknown[]> = {};

  if (types.includes("articles")) {
    results.articles = await all(
      c.env.DB,
      "SELECT id, title, subtitle, article_type, public_slug FROM articles WHERE user_id = ? AND title LIKE ? LIMIT 20",
      [userId, like],
    );
  }
  if (types.includes("books")) {
    results.books = await all(
      c.env.DB,
      "SELECT id, title, authors, ingest_mode, reading_progress FROM books WHERE user_id = ? AND title LIKE ? LIMIT 20",
      [userId, like],
    );
  }
  if (types.includes("sources")) {
    results.sources = await all(
      c.env.DB,
      "SELECT id, title, source_type, admiralty_grade, published_at FROM sources WHERE user_id = ? AND title LIKE ? LIMIT 20",
      [userId, like],
    );
  }
  if (types.includes("theses")) {
    results.theses = await all(
      c.env.DB,
      "SELECT id, title, seed_summary, public_slug FROM theses WHERE user_id = ? AND title LIKE ? LIMIT 20",
      [userId, like],
    );
  }
  if (types.includes("claims")) {
    results.claims = await all(
      c.env.DB,
      "SELECT claim_id, claim_text FROM claim_versions WHERE claim_text LIKE ? LIMIT 20",
      [like],
    );
  }
  return c.json(results);
});

app.get("/books", async (c) => {
  const userId = c.get("user_id");
  const books = await all(
    c.env.DB,
    "SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
  return c.json({ books });
});

export default app;
