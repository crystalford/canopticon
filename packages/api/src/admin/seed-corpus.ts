// One-shot seed endpoint: POST /v1/admin/seed-corpus
// Imports the SEED_TOPICS + SEED_ENTITIES + SEED_PIECES tables defined
// in seed-data.ts into D1. Idempotent: re-running upserts by slug.
//
// Cloudflare Access gates /v1/* so this is operator-only; the endpoint
// is otherwise unprotected (no body validation beyond confirm-token).
// Pass ?force=1 to overwrite existing rows; default keeps them.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { renderMarkdown } from "../cms/lib/render-post.ts";
import { insertOne, one, run } from "../lib/d1.ts";
import { SEED_ENTITIES, SEED_PIECES, SEED_TOPICS, SEED_TOPIC_ENTITIES } from "./seed-data.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

interface SeedReport {
  topics_inserted: number;
  topics_skipped: number;
  entities_inserted: number;
  entities_skipped: number;
  pieces_inserted: number;
  pieces_skipped: number;
  topic_pieces_inserted: number;
  topic_entities_inserted: number;
  orphans: string[];
}

app.post("/seed-corpus", async (c) => {
  const userId = c.get("user_id");
  const force = c.req.query("force") === "1";
  const report: SeedReport = {
    topics_inserted: 0,
    topics_skipped: 0,
    entities_inserted: 0,
    entities_skipped: 0,
    pieces_inserted: 0,
    pieces_skipped: 0,
    topic_pieces_inserted: 0,
    topic_entities_inserted: 0,
    orphans: [],
  };

  // Topics — slug as the natural key.
  const topicIdBySlug = new Map<string, string>();
  for (const t of SEED_TOPICS) {
    const existing = await one<{ id: string }>(
      c.env.DB,
      "SELECT id FROM topics WHERE user_id = ? AND slug = ?",
      [userId, t.slug],
    );
    if (existing && !force) {
      topicIdBySlug.set(t.slug, existing.id);
      report.topics_skipped += 1;
      continue;
    }
    if (existing && force) {
      await run(
        c.env.DB,
        "UPDATE topics SET label = ?, overview_md = ?, overview_html = ?, sort_order = ? WHERE id = ?",
        [t.label, t.overview_md, renderMarkdown(t.overview_md), t.sort_order, existing.id],
      );
      topicIdBySlug.set(t.slug, existing.id);
      report.topics_inserted += 1;
      continue;
    }
    const id = await insertOne(c.env.DB, "topics", {
      user_id: userId,
      slug: t.slug,
      label: t.label,
      overview_md: t.overview_md,
      overview_html: renderMarkdown(t.overview_md),
      sort_order: t.sort_order,
    });
    topicIdBySlug.set(t.slug, id);
    report.topics_inserted += 1;
  }

  // Entities — public_slug as the natural key.
  const entityIdBySlug = new Map<string, string>();
  for (const e of SEED_ENTITIES) {
    const existing = await one<{ id: string }>(
      c.env.DB,
      "SELECT id FROM entities WHERE user_id = ? AND public_slug = ?",
      [userId, e.slug],
    );
    if (existing && !force) {
      entityIdBySlug.set(e.slug, existing.id);
      report.entities_skipped += 1;
      continue;
    }
    if (existing && force) {
      await run(
        c.env.DB,
        `UPDATE entities SET canonical_name = ?, kind = ?, entity_type = ?,
              current_role = ?, bio_md = ?, bio_html = ?
            WHERE id = ?`,
        [
          e.canonical_name,
          e.kind,
          e.entity_type,
          e.current_role,
          e.bio_md,
          renderMarkdown(e.bio_md),
          existing.id,
        ],
      );
      entityIdBySlug.set(e.slug, existing.id);
      report.entities_inserted += 1;
      continue;
    }
    const id = await insertOne(c.env.DB, "entities", {
      user_id: userId,
      public_slug: e.slug,
      canonical_name: e.canonical_name,
      kind: e.kind,
      entity_type: e.entity_type,
      current_role: e.current_role,
      bio_md: e.bio_md,
      bio_html: renderMarkdown(e.bio_md),
    });
    entityIdBySlug.set(e.slug, id);
    report.entities_inserted += 1;
  }

  // Pieces — slug as the natural key. Published/canonical so they hit
  // the public site immediately.
  const pieceIdBySlug = new Map<string, string>();
  for (const p of SEED_PIECES) {
    const existing = await one<{ id: string }>(
      c.env.DB,
      "SELECT id FROM pieces WHERE user_id = ? AND slug = ?",
      [userId, p.slug],
    );
    if (existing && !force) {
      pieceIdBySlug.set(p.slug, existing.id);
      report.pieces_skipped += 1;
      continue;
    }
    const now = new Date().toISOString();
    if (existing && force) {
      await run(
        c.env.DB,
        `UPDATE pieces SET title = ?, subtitle = ?, kind = ?,
              publication_status = ?, body_md = ?, body_html = ?,
              byline = ?, published_at = COALESCE(published_at, ?)
            WHERE id = ?`,
        [
          p.title,
          p.subtitle,
          p.kind,
          p.publication_status,
          p.body_md,
          renderMarkdown(p.body_md),
          p.byline,
          now,
          existing.id,
        ],
      );
      pieceIdBySlug.set(p.slug, existing.id);
      report.pieces_inserted += 1;
      continue;
    }
    const id = await insertOne(c.env.DB, "pieces", {
      user_id: userId,
      slug: p.slug,
      title: p.title,
      subtitle: p.subtitle,
      kind: p.kind,
      publication_status: p.publication_status,
      body_md: p.body_md,
      body_html: renderMarkdown(p.body_md),
      byline: p.byline,
      published_at: now,
    });
    pieceIdBySlug.set(p.slug, id);
    report.pieces_inserted += 1;
  }

  // Topic ↔ piece joins. Anti-orphan: every published piece in the
  // seed has at least one topic.
  for (const p of SEED_PIECES) {
    const pieceId = pieceIdBySlug.get(p.slug);
    if (!pieceId) continue;
    for (const topicSlug of p.topics) {
      const topicId = topicIdBySlug.get(topicSlug);
      if (!topicId) continue;
      const exists = await one(
        c.env.DB,
        "SELECT 1 AS one FROM topic_pieces WHERE topic_id = ? AND piece_id = ?",
        [topicId, pieceId],
      );
      if (!exists) {
        await insertOne(c.env.DB, "topic_pieces", {
          topic_id: topicId,
          piece_id: pieceId,
          user_id: userId,
        });
        report.topic_pieces_inserted += 1;
      }
    }
  }

  // Topic ↔ entity joins.
  for (const [topicSlug, entitySlugs] of Object.entries(SEED_TOPIC_ENTITIES)) {
    const topicId = topicIdBySlug.get(topicSlug);
    if (!topicId) continue;
    for (const entitySlug of entitySlugs) {
      const entityId = entityIdBySlug.get(entitySlug);
      if (!entityId) continue;
      const exists = await one(
        c.env.DB,
        "SELECT 1 AS one FROM topic_entities WHERE topic_id = ? AND entity_id = ?",
        [topicId, entityId],
      );
      if (!exists) {
        await insertOne(c.env.DB, "topic_entities", {
          topic_id: topicId,
          entity_id: entityId,
          user_id: userId,
        });
        report.topic_entities_inserted += 1;
      }
    }
  }

  // Anti-orphan check: every published piece must have a topic.
  // (All SEED_PIECES are published/canonical; this guards against
  // future seed additions that forget to file a piece.)
  for (const p of SEED_PIECES) {
    if (p.topics.length === 0) report.orphans.push(p.slug);
  }

  return c.json({ ok: true, report });
});

export default app;
