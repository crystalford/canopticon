// Public read-only endpoints. Unauthenticated.
// D1 binding is on the Worker; we just query directly.

import { Hono } from "hono";
import type { Env } from "../env.ts";
import { all, insertOne, one, parseJson } from "../lib/d1.ts";
import { notFound } from "../lib/errors.ts";

const app = new Hono<{ Bindings: Env }>();

// Public reads of the CMS posts table. canopticon.com/p/<slug> hits these.
app.get("/posts", async (c) => {
  const postType = c.req.query("post_type");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const rows = postType
    ? await all(
        c.env.DB,
        `SELECT id, slug, title, subtitle, post_type, byline, is_forensic, published_at
           FROM posts WHERE status = 'published' AND post_type = ?
          ORDER BY published_at DESC LIMIT ?`,
        [postType, limit],
      )
    : await all(
        c.env.DB,
        `SELECT id, slug, title, subtitle, post_type, byline, is_forensic, published_at
           FROM posts WHERE status = 'published'
          ORDER BY published_at DESC LIMIT ?`,
        [limit],
      );
  return c.json({ posts: rows });
});

app.get("/posts/:slug", async (c) => {
  const post = await one(
    c.env.DB,
    `SELECT id, slug, title, subtitle, body_html, post_type, byline, tags, is_forensic, published_at, updated_at
       FROM posts WHERE slug = ? AND status = 'published'`,
    [c.req.param("slug")],
  );
  if (!post) throw notFound();
  return c.json({ post });
});

app.get("/articles", async (c) => {
  const type = c.req.query("type");
  const articles = type
    ? await all(
        c.env.DB,
        "SELECT article_id, slug, article_type, title, subtitle, author, byline_date, word_count, reading_time_minutes, published_at FROM pub_articles_cache WHERE article_type = ? ORDER BY published_at DESC",
        [type],
      )
    : await all(
        c.env.DB,
        "SELECT article_id, slug, article_type, title, subtitle, author, byline_date, word_count, reading_time_minutes, published_at FROM pub_articles_cache ORDER BY published_at DESC",
        [],
      );
  return c.json({ articles });
});

app.get("/articles/:slug", async (c) => {
  const article = await one(c.env.DB, "SELECT * FROM pub_articles_cache WHERE slug = ?", [
    c.req.param("slug"),
  ]);
  if (!article) throw notFound();
  return c.json({ article });
});

app.get("/theses", async (c) => {
  const theses = await all(
    c.env.DB,
    "SELECT thesis_id, slug, title, seed_summary, coined_phrase, ipcc_likelihood, tier_bluf, tier_80, version_number, published_at FROM pub_theses_cache ORDER BY published_at DESC",
    [],
  );
  return c.json({ theses });
});

app.get("/theses/:slug", async (c) => {
  const thesis = await one(c.env.DB, "SELECT * FROM pub_theses_cache WHERE slug = ?", [
    c.req.param("slug"),
  ]);
  if (!thesis) throw notFound();
  return c.json({ thesis });
});

app.get("/predictions", async (c) => {
  const predictions = await all(
    c.env.DB,
    "SELECT * FROM pub_predictions_cache ORDER BY resolution_horizon ASC",
    [],
  );
  return c.json({ predictions });
});

app.get("/contradictions", async (c) => {
  const contradictions = await all(c.env.DB, "SELECT * FROM pub_contradictions_cache", []);
  return c.json({ contradictions });
});

app.get("/entities/:slug", async (c) => {
  const entity = await one(c.env.DB, "SELECT * FROM pub_entities_cache WHERE slug = ?", [
    c.req.param("slug"),
  ]);
  if (!entity) throw notFound();
  return c.json({ entity });
});

app.get("/sources/:slug", async (c) => {
  const source = await one(c.env.DB, "SELECT * FROM pub_sources_cache WHERE slug = ?", [
    c.req.param("slug"),
  ]);
  if (!source) throw notFound();
  return c.json({ source });
});

app.get("/claims/:slug", async (c) => {
  const claim = await one(c.env.DB, "SELECT * FROM pub_claims_cache WHERE slug = ?", [
    c.req.param("slug"),
  ]);
  if (!claim) throw notFound();
  return c.json({ claim });
});

app.get("/characters", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 200);
  const characters = await all(
    c.env.DB,
    `SELECT cp.slug, cp.canonical_name, cp.current_role, cp.portrait_url,
            cp.updated_at, e.heat_score
       FROM character_profiles cp
       JOIN entities e ON e.id = cp.entity_id
      WHERE cp.visibility = 'public'
      ORDER BY e.heat_score DESC, cp.updated_at DESC
      LIMIT ?`,
    [limit],
  );
  return c.json({ characters });
});

app.get("/characters/:slug", async (c) => {
  const slug = c.req.param("slug");
  const profile = await one<{
    id: string;
    entity_id: string;
    canonical_name: string;
    slug: string;
    current_role: string | null;
    bio_md: string;
    bio_html: string | null;
    wikipedia_url: string | null;
    portrait_url: string | null;
    updated_at: string;
  }>(
    c.env.DB,
    `SELECT id, entity_id, canonical_name, slug, current_role,
            bio_md, bio_html, wikipedia_url, portrait_url, updated_at
       FROM character_profiles
      WHERE slug = ? AND visibility = 'public'`,
    [slug],
  );
  if (!profile) throw notFound();
  const entity = await one<{ heat_score: number }>(
    c.env.DB,
    "SELECT heat_score FROM entities WHERE id = ?",
    [profile.entity_id],
  );
  const timeline = await all(
    c.env.DB,
    `SELECT event_date, event_title, event_body, significance, source_claim_ids
       FROM character_timeline_events
      WHERE entity_id = ? AND status = 'confirmed'
      ORDER BY event_date DESC`,
    [profile.entity_id],
  );
  const claims = await all(
    c.env.DB,
    `SELECT c.id, cv.claim_text, c.layer, c.admiralty_grade, c.ipcc_likelihood,
            c.public_slug, c.created_at
       FROM claim_entities ce
       JOIN claims c ON c.id = ce.claim_id
       JOIN claim_versions cv ON cv.id = c.current_version_id
      WHERE ce.entity_id = ?
      ORDER BY c.created_at DESC LIMIT 50`,
    [profile.entity_id],
  );
  const relations = await all(
    c.env.DB,
    `SELECT er.relation_type, er.strength, er.active_from, er.active_to,
            CASE WHEN er.from_entity_id = ? THEN e.canonical_name ELSE f.canonical_name END AS other_name,
            CASE WHEN er.from_entity_id = ? THEN er.to_entity_id ELSE er.from_entity_id END AS other_id,
            CASE WHEN er.from_entity_id = ? THEN e.public_slug ELSE f.public_slug END AS other_slug
       FROM entity_relations er
       LEFT JOIN entities e ON e.id = er.to_entity_id
       LEFT JOIN entities f ON f.id = er.from_entity_id
      WHERE er.from_entity_id = ? OR er.to_entity_id = ?
      LIMIT 50`,
    [profile.entity_id, profile.entity_id, profile.entity_id, profile.entity_id, profile.entity_id],
  );
  return c.json({
    profile,
    heat_score: entity?.heat_score ?? 0,
    timeline: timeline.map((t) => ({
      ...t,
      source_claim_ids: parseJson((t as { source_claim_ids: unknown }).source_claim_ids, []),
    })),
    claims,
    relations,
  });
});

app.get("/corrections", async (c) => {
  const corrections = await all(
    c.env.DB,
    "SELECT id, article_id, original_text, corrected_text, reason, corrected_at FROM article_corrections WHERE is_public = 1 ORDER BY corrected_at DESC",
    [],
  );
  return c.json({ corrections });
});

app.post("/subscribe", async (c) => {
  const body = (await c.req.json()) as { email: string; channels?: string[]; thesis_id?: string };
  if (!body.email)
    return c.json({ error: { code: "bad_request", message: "email required" } }, 400);
  const anyUser = await one<{ id: string }>(c.env.DB, "SELECT id FROM users LIMIT 1", []);
  if (!anyUser)
    return c.json({ error: { code: "no_operator", message: "no operator configured" } }, 503);
  await insertOne(c.env.DB, "pub_subscriptions", {
    user_id: anyUser.id,
    email: body.email,
    channels: body.channels ?? ["articles"],
    thesis_id: body.thesis_id ?? null,
    unsubscribe_token: crypto.randomUUID(),
    confirmation_token: crypto.randomUUID(),
  });
  return c.json({ ok: true });
});

export default app;
