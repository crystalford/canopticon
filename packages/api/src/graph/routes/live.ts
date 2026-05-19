// Live feed: cross-substrate activity aggregator.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../../auth/middleware.ts";
import { all } from "../../lib/d1.ts";

interface FeedItem {
  kind: string;
  id: string;
  ts: string;
  payload: Record<string, unknown>;
}

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const userId = c.get("user_id");
  const since = c.req.query("since") ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const db = c.env.DB;

  const [claims, contradictions, questions, preds, prods, sources, events] = await Promise.all([
    all(
      db,
      "SELECT id, layer, admiralty_grade, verification_status, created_at FROM claims WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 50",
      [userId, since],
    ),
    all(
      db,
      "SELECT id, posture, created_at FROM contradictions WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 50",
      [userId, since],
    ),
    all(
      db,
      "SELECT id, question_text, eig_score, created_at FROM questions WHERE user_id = ? AND state = 'open' AND created_at >= ? ORDER BY created_at DESC LIMIT 50",
      [userId, since],
    ),
    all(
      db,
      "SELECT id, statement, status, resolved_at, updated_at FROM predictions WHERE user_id = ? AND updated_at >= ? ORDER BY updated_at DESC LIMIT 50",
      [userId, since],
    ),
    all(
      db,
      "SELECT id, title, state, updated_at FROM productions WHERE user_id = ? AND updated_at >= ? ORDER BY updated_at DESC LIMIT 50",
      [userId, since],
    ),
    all(
      db,
      "SELECT id, title, ingestion_state, created_at FROM sources WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 50",
      [userId, since],
    ),
    all(
      db,
      "SELECT id, event_type, subject_kind, subject_id, payload, created_at FROM orchestrator_events WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 50",
      [userId, since],
    ),
  ]);

  const feed: FeedItem[] = [];
  const pushAll = (kind: string, rows: unknown[], tsField: "created_at" | "updated_at") => {
    for (const r of rows) {
      const row = r as Record<string, unknown>;
      feed.push({ kind, id: row.id as string, ts: row[tsField] as string, payload: row });
    }
  };
  pushAll("claim", claims, "created_at");
  pushAll("contradiction", contradictions, "created_at");
  pushAll("question", questions, "created_at");
  pushAll("prediction", preds, "updated_at");
  pushAll("production", prods, "updated_at");
  pushAll("source", sources, "created_at");
  pushAll("event", events, "created_at");

  feed.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const capped = feed.slice(0, 200);

  const stats = {
    claims: claims.length,
    contradictions: contradictions.length,
    questions: questions.length,
    predictions_resolved: preds.filter((p) =>
      (p as { status: string }).status.startsWith("resolved"),
    ).length,
    productions: prods.length,
    sources_pending: sources.filter(
      (s) => (s as { ingestion_state: string }).ingestion_state === "pending_critic",
    ).length,
  };

  return c.json({ feed: capped, stats });
});

export default app;
