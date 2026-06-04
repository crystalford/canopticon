// Runtime diagnostics — read-only observability endpoint.
//
// GET /v1/admin/runtime
//   Returns the recent state of the system: orchestrator events (errors,
//   leads, near-duplicates), pending entity proposals, recent pieces.
//
// Auth: gated by the regular requireAuth() middleware. The endpoint sits
// behind Cloudflare Access at the edge (anyone calling /v1/admin/* has
// already passed Access), so this returns operator-only data.
//
// Designed to be cheap, idempotent, and safe to fetch every time the
// operator needs to share state — no copy-pasting logs.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, one, run } from "../lib/d1.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/runtime", async (c) => {
  const userId = c.get("user_id");

  const [counts, events, proposals, recentPieces] = await Promise.all([
    loadCounts(c.env.DB, userId),
    all<{
      id: string;
      event_type: string;
      payload: string;
      subject_kind: string | null;
      subject_id: string | null;
      created_at: string;
    }>(
      c.env.DB,
      `SELECT id, event_type, payload, subject_kind, subject_id, created_at
         FROM orchestrator_events
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50`,
      [userId],
    ),
    all<{
      id: string;
      entity_id: string;
      kind: string;
      rationale: string | null;
      created_at: string;
    }>(
      c.env.DB,
      `SELECT id, entity_id, kind, rationale, created_at
         FROM character_update_proposals
        WHERE status = 'pending'
        ORDER BY created_at DESC
        LIMIT 20`,
    ),
    all<{
      id: string;
      slug: string;
      title: string | null;
      kind: string;
      publication_status: string;
      body_len: number;
      created_at: string;
      updated_at: string;
    }>(
      c.env.DB,
      `SELECT id, slug, title, kind, publication_status,
              COALESCE(length(body_md), 0) AS body_len,
              created_at, updated_at
         FROM pieces
        WHERE user_id = ?
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT 20`,
      [userId],
    ),
  ]);

  // Bucket events by type for a quick overview.
  const eventsByType: Record<string, number> = {};
  for (const e of events) {
    eventsByType[e.event_type] = (eventsByType[e.event_type] ?? 0) + 1;
  }

  return c.json({
    ok: true,
    generated_at: new Date().toISOString(),
    user_id: userId,
    counts,
    events: {
      by_type: eventsByType,
      recent: events.map((e) => ({
        ...e,
        payload: parsePayload(e.payload),
      })),
    },
    pending_proposals: proposals,
    recent_pieces: recentPieces,
  });
});

interface Counts {
  pieces: number;
  entities: number;
  topics: number;
  claims: number;
  sources: number;
  conversations: number;
}

async function loadCounts(db: D1Database, userId: string): Promise<Counts> {
  const row = await one<Counts>(
    db,
    `SELECT
       (SELECT COUNT(*) FROM pieces WHERE user_id = ?) AS pieces,
       (SELECT COUNT(*) FROM entities WHERE user_id = ?) AS entities,
       (SELECT COUNT(*) FROM topics WHERE user_id = ?) AS topics,
       (SELECT COUNT(*) FROM claims WHERE user_id = ?) AS claims,
       (SELECT COUNT(*) FROM sources WHERE user_id = ?) AS sources,
       (SELECT COUNT(*) FROM chat_conversations WHERE user_id = ?) AS conversations`,
    [userId, userId, userId, userId, userId, userId],
  );
  return (
    row ?? {
      pieces: 0,
      entities: 0,
      topics: 0,
      claims: 0,
      sources: 0,
      conversations: 0,
    }
  );
}

function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// Full graph wipe for the calling operator. Requires ?confirm=1 so a curious
// GET can't accidentally nuke the corpus. Mirrors the Library mode=all delete
// (operator/routes.ts) PLUS digest_jobs so the processing panel clears too.
// Probe-reachable for fast resets without UI clicks.
const RESET_TABLES = [
  "claim_entities",
  "claim_sources",
  "claim_versions",
  "claims",
  "entity_mentions",
  "entity_relations",
  "entity_resolution_log",
  "entity_resolution_queue",
  "entities",
  "chain_passes",
  "topic_pieces",
  "topic_entities",
  "patterns",
  "sources",
  "uploaded_files",
  "pieces",
  "orchestrator_events",
  "digest_jobs",
];

app.get("/reset-graph", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const userId = c.get("user_id");
  const wiped: Record<string, number | string> = {};
  for (const t of RESET_TABLES) {
    try {
      const r = await run(c.env.DB, `DELETE FROM ${t} WHERE user_id = ?`, [userId]);
      wiped[t] = r.meta.changes ?? 0;
    } catch (err) {
      wiped[t] = `error: ${(err as Error).message}`;
    }
  }
  return c.json({ ok: true, wiped });
});

export default app;
