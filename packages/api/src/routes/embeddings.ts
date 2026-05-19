// Embeddings backfill — one-shot batch routes that walk through substrate
// rows (entities, claims, articles, sources) and upsert their vectors
// into the Vectorize index. Intended to be triggered by the System
// screen's "Reindex" button.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { embedText, upsertVector, vectorId } from "../graph/lib/embeddings.ts";
import { all } from "../lib/d1.ts";
import { badRequest } from "../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

const KINDS = ["entity", "claim", "article", "source", "thesis"] as const;
type Kind = (typeof KINDS)[number];

const SQL: Record<
  Kind,
  { sql: string; toText: (r: Row) => { id: string; title: string; text: string } }
> = {
  entity: {
    sql: "SELECT id, canonical_name AS title, canonical_name AS text FROM entities WHERE user_id = ? LIMIT ?",
    toText: (r) => ({ id: String(r.id), title: String(r.title), text: String(r.text) }),
  },
  claim: {
    sql: "SELECT id, substr(claim_text, 1, 80) AS title, claim_text AS text FROM claims WHERE user_id = ? LIMIT ?",
    toText: (r) => ({ id: String(r.id), title: String(r.title), text: String(r.text) }),
  },
  article: {
    sql: "SELECT id, title, COALESCE(subtitle, title) AS text FROM articles WHERE user_id = ? LIMIT ?",
    toText: (r) => ({ id: String(r.id), title: String(r.title), text: String(r.text) }),
  },
  source: {
    sql: "SELECT id, title, COALESCE(content_text, title) AS text FROM sources WHERE user_id = ? LIMIT ?",
    toText: (r) => ({
      id: String(r.id),
      title: String(r.title),
      text: String(r.text).slice(0, 800),
    }),
  },
  thesis: {
    sql: "SELECT id, title, COALESCE(seed_summary, title) AS text FROM theses WHERE user_id = ? LIMIT ?",
    toText: (r) => ({ id: String(r.id), title: String(r.title), text: String(r.text) }),
  },
};

type Row = Record<string, unknown>;

app.post("/backfill", async (c) => {
  const userId = c.get("user_id");
  const kind = (c.req.query("kind") ?? "") as Kind;
  if (!KINDS.includes(kind)) throw badRequest(`kind must be one of: ${KINDS.join(", ")}`);
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);

  const def = SQL[kind];
  const rows = await all<Row>(c.env.DB, def.sql, [userId, limit]);
  let ok = 0;
  let failed = 0;
  for (const raw of rows) {
    const row = def.toText(raw);
    try {
      const values = await embedText(c.env, `${row.title}\n${row.text}`);
      await upsertVector(c.env, {
        id: vectorId(kind, row.id),
        values,
        metadata: { user_id: userId, kind, id: row.id, title: row.title },
      });
      ok++;
    } catch {
      failed++;
    }
  }
  return c.json({ kind, scanned: rows.length, embedded: ok, failed });
});

export default app;
