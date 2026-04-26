// Public read-only endpoints. Use anon-key paths only — no JWT required.
// Reads from pub_*_cache materialized tables.
//
// All routes here are unauthenticated and serve the public website.

import { Hono } from "hono";
import type { Env } from "../env.ts";
import { notFound } from "../lib/errors.ts";
import { serviceClient } from "../lib/supabase.ts";

const app = new Hono<{ Bindings: Env }>();

app.get("/articles", async (c) => {
  const client = serviceClient(c.env);
  const type = c.req.query("type");
  let q = client
    .from("pub_articles_cache")
    .select(
      "article_id, slug, article_type, title, subtitle, author, byline_date, word_count, reading_time_minutes, published_at",
    )
    .order("published_at", { ascending: false });
  if (type) q = q.eq("article_type", type);
  const { data, error } = await q;
  if (error) throw error;
  return c.json({ articles: data ?? [] });
});

app.get("/articles/:slug", async (c) => {
  const client = serviceClient(c.env);
  const { data, error } = await client
    .from("pub_articles_cache")
    .select("*")
    .eq("slug", c.req.param("slug"))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return c.json({ article: data });
});

app.get("/theses", async (c) => {
  const client = serviceClient(c.env);
  const { data, error } = await client
    .from("pub_theses_cache")
    .select(
      "thesis_id, slug, title, seed_summary, coined_phrase, ipcc_likelihood, tier_bluf, tier_80, version_number, published_at",
    )
    .order("published_at", { ascending: false });
  if (error) throw error;
  return c.json({ theses: data ?? [] });
});

app.get("/theses/:slug", async (c) => {
  const client = serviceClient(c.env);
  const { data, error } = await client
    .from("pub_theses_cache")
    .select("*")
    .eq("slug", c.req.param("slug"))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return c.json({ thesis: data });
});

app.get("/predictions", async (c) => {
  const client = serviceClient(c.env);
  const { data, error } = await client
    .from("pub_predictions_cache")
    .select("*")
    .order("resolution_horizon", { ascending: true });
  if (error) throw error;
  return c.json({ predictions: data ?? [] });
});

app.get("/contradictions", async (c) => {
  const client = serviceClient(c.env);
  const { data, error } = await client.from("pub_contradictions_cache").select("*");
  if (error) throw error;
  return c.json({ contradictions: data ?? [] });
});

app.get("/entities/:slug", async (c) => {
  const client = serviceClient(c.env);
  const { data, error } = await client
    .from("pub_entities_cache")
    .select("*")
    .eq("slug", c.req.param("slug"))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return c.json({ entity: data });
});

app.get("/sources/:slug", async (c) => {
  const client = serviceClient(c.env);
  const { data, error } = await client
    .from("pub_sources_cache")
    .select("*")
    .eq("slug", c.req.param("slug"))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return c.json({ source: data });
});

app.get("/claims/:slug", async (c) => {
  const client = serviceClient(c.env);
  const { data, error } = await client
    .from("pub_claims_cache")
    .select("*")
    .eq("slug", c.req.param("slug"))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return c.json({ claim: data });
});

app.get("/corrections", async (c) => {
  const client = serviceClient(c.env);
  const { data, error } = await client
    .from("article_corrections")
    .select("id, article_id, original_text, corrected_text, reason, corrected_at")
    .eq("is_public", true)
    .order("corrected_at", { ascending: false });
  if (error) throw error;
  return c.json({ corrections: data ?? [] });
});

app.post("/subscribe", async (c) => {
  const client = serviceClient(c.env);
  const body = (await c.req.json()) as { email: string; channels?: string[]; thesis_id?: string };
  if (!body.email)
    return c.json({ error: { code: "bad_request", message: "email required" } }, 400);
  // Insert needs user_id (operator); pull from any thesis or use a sentinel.
  // For first cut, find the operator that owns the thesis if specified, or
  // the first operator (single-tenant assumption). This will be tightened
  // when multi-tenant materializes.
  const { data: anyUser } = await client.from("users").select("id").limit(1).maybeSingle();
  if (!anyUser)
    return c.json({ error: { code: "no_operator", message: "no operator configured" } }, 503);

  const unsubscribeToken = crypto.randomUUID();
  const confirmationToken = crypto.randomUUID();
  const { error } = await client.from("pub_subscriptions").insert({
    user_id: (anyUser as { id: string }).id,
    email: body.email,
    channels: body.channels ?? ["articles"],
    thesis_id: body.thesis_id ?? null,
    unsubscribe_token: unsubscribeToken,
    confirmation_token: confirmationToken,
  });
  if (error) {
    return c.json({ error: { code: "insert_failed", message: error.message } }, 400);
  }
  return c.json({ ok: true });
});

export default app;
