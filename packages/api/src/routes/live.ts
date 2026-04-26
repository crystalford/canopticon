// Live feed: aggregates recent activity across the substrate for the
// operator's Live screen. Per plan §open-question-3: per-table indexed
// queries with LIMIT 50 each, merged in Worker via priority queue, capped
// at 200 items total.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { userClient } from "../lib/supabase.ts";
import { getPublicUserId } from "../lib/user.ts";

interface FeedItem {
  kind: string;
  id: string;
  ts: string;
  payload: Record<string, unknown>;
}

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const since = c.req.query("since") ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [claimsR, contradictionsR, questionsR, predictionsR, productionsR, sourcesR, eventsR] =
    await Promise.all([
      client
        .from("claims")
        .select("id, layer, admiralty_grade, verification_status, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("contradictions")
        .select("id, posture, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("questions")
        .select("id, question_text, eig_score, created_at")
        .eq("user_id", userId)
        .eq("state", "open")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("predictions")
        .select("id, statement, status, resolved_at, updated_at")
        .eq("user_id", userId)
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(50),
      client
        .from("productions")
        .select("id, title, state, updated_at")
        .eq("user_id", userId)
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(50),
      client
        .from("sources")
        .select("id, title, ingestion_state, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("orchestrator_events")
        .select("id, event_type, subject_kind, subject_id, payload, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const feed: FeedItem[] = [];
  for (const r of claimsR.data ?? [])
    feed.push({
      kind: "claim",
      id: (r as { id: string }).id,
      ts: (r as { created_at: string }).created_at,
      payload: r as Record<string, unknown>,
    });
  for (const r of contradictionsR.data ?? [])
    feed.push({
      kind: "contradiction",
      id: (r as { id: string }).id,
      ts: (r as { created_at: string }).created_at,
      payload: r as Record<string, unknown>,
    });
  for (const r of questionsR.data ?? [])
    feed.push({
      kind: "question",
      id: (r as { id: string }).id,
      ts: (r as { created_at: string }).created_at,
      payload: r as Record<string, unknown>,
    });
  for (const r of predictionsR.data ?? [])
    feed.push({
      kind: "prediction",
      id: (r as { id: string }).id,
      ts: (r as { updated_at: string }).updated_at,
      payload: r as Record<string, unknown>,
    });
  for (const r of productionsR.data ?? [])
    feed.push({
      kind: "production",
      id: (r as { id: string }).id,
      ts: (r as { updated_at: string }).updated_at,
      payload: r as Record<string, unknown>,
    });
  for (const r of sourcesR.data ?? [])
    feed.push({
      kind: "source",
      id: (r as { id: string }).id,
      ts: (r as { created_at: string }).created_at,
      payload: r as Record<string, unknown>,
    });
  for (const r of eventsR.data ?? [])
    feed.push({
      kind: "event",
      id: (r as { id: string }).id,
      ts: (r as { created_at: string }).created_at,
      payload: r as Record<string, unknown>,
    });

  feed.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const capped = feed.slice(0, 200);

  // Summary stats.
  const stats = {
    claims: claimsR.data?.length ?? 0,
    contradictions: contradictionsR.data?.length ?? 0,
    questions: questionsR.data?.length ?? 0,
    predictions_resolved: (predictionsR.data ?? []).filter((p) =>
      (p as { status: string }).status.startsWith("resolved"),
    ).length,
    productions: productionsR.data?.length ?? 0,
    sources_pending: (sourcesR.data ?? []).filter(
      (s) => (s as { ingestion_state: string }).ingestion_state === "pending_critic",
    ).length,
  };

  return c.json({ feed: capped, stats });
});

export default app;
