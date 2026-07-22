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
import { enqueueDigest, ensureJobsTable, runDigestJob } from "../graph/lib/digest-jobs.ts";
import { all, one, run } from "../lib/d1.ts";
import { type Role, callRole, modelForRole } from "../llm/router.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/runtime", async (c) => {
  const userId = c.get("user_id");

  const [counts, events, proposals, recentPieces, uploads, jobs, typedGraph] = await Promise.all([
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
    // Recent uploads — the failure path stores the real error here
    // (extraction_status='failed', metadata.error) so we can read WHY an
    // ingest threw instead of only seeing the UI banner.
    all<{
      id: string;
      original_filename: string | null;
      classification: string | null;
      extraction_status: string | null;
      size_bytes: number | null;
      metadata: string | null;
      created_at: string;
    }>(
      c.env.DB,
      `SELECT id, original_filename, classification, extraction_status,
              size_bytes, metadata, created_at
         FROM uploaded_files
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 15`,
      [userId],
    ).catch(() => []),
    // Recent digest jobs — last_error/step tell us where typed extraction died.
    all<{
      id: string;
      piece_id: string;
      status: string;
      step: string;
      claims_count: number;
      attempts: number;
      last_error: string | null;
      updated_at: string;
    }>(
      c.env.DB,
      `SELECT id, piece_id, status, step, claims_count, attempts, last_error, updated_at
         FROM digest_jobs
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT 15`,
      [userId],
    ).catch(() => []),
    loadTypedGraphCounts(c.env.DB, userId),
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
    typed_graph: typedGraph,
    uploads: uploads.map((u) => ({ ...u, metadata: parsePayload(u.metadata ?? "") })),
    digest_jobs: jobs,
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

// Typed-graph row counts (migration 0026/0027). Each guarded so a missing
// table (un-applied migration) reports 0 rather than failing the whole probe.
async function loadTypedGraphCounts(
  db: D1Database,
  userId: string,
): Promise<Record<string, number | string>> {
  // nodes / edges / quotes / inquiry_threads carry user_id directly.
  // assertions + node_props are scoped to the user via their node_id → nodes.
  const direct = ["nodes", "edges", "quotes", "inquiry_threads"];
  const viaNode = ["assertions", "node_props"];
  const out: Record<string, number | string> = {};
  for (const t of direct) {
    try {
      const row = await one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`, [
        userId,
      ]);
      out[t] = row?.n ?? 0;
    } catch (err) {
      out[t] = `error: ${(err as Error).message}`;
    }
  }
  for (const t of viaNode) {
    try {
      const row = await one<{ n: number }>(
        db,
        `SELECT COUNT(*) AS n FROM ${t} WHERE node_id IN (SELECT id FROM nodes WHERE user_id = ?)`,
        [userId],
      );
      out[t] = row?.n ?? 0;
    } catch (err) {
      out[t] = `error: ${(err as Error).message}`;
    }
  }
  return out;
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
  // Typed graph (migration 0026/0027). Deleting nodes cascades to edges /
  // quotes / assertions / node_props, so only the user_id-bearing roots are
  // listed here.
  "nodes",
  "inquiry_threads",
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

// GET /v1/admin/reextract?confirm=1
//
// Re-run typed extraction for every piece the operator has. Clears any
// existing digest jobs for each piece (so a fresh resumable run starts at
// chunk 0) and kicks the job inline. Probe-reachable so extraction can be
// triggered + verified without UI clicks. Returns the jobs it started.
app.get("/reextract", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const userId = c.get("user_id");
  await ensureJobsTable(c.env);
  const pieces = await all<{ id: string; slug: string; title: string; source_id: string | null }>(
    c.env.DB,
    `SELECT id, slug, title, json_extract(metadata, '$.source_id') AS source_id
       FROM pieces WHERE user_id = ? ORDER BY created_at`,
    [userId],
  );
  const started: Array<{ piece: string; job_id: string }> = [];
  for (const p of pieces) {
    if (!p.source_id) continue;
    // Clear prior jobs for this piece so enqueue starts a fresh chunk-0 run.
    await run(c.env.DB, "DELETE FROM digest_jobs WHERE user_id = ? AND piece_id = ?", [
      userId,
      p.id,
    ]);
    const jobId = await enqueueDigest(c.env, {
      userId,
      pieceId: p.id,
      slug: p.slug,
      title: p.title,
      sourceId: p.source_id,
    });
    c.executionCtx.waitUntil(runDigestJob(c.env, jobId));
    started.push({ piece: p.slug, job_id: jobId });
  }
  return c.json({ ok: true, pieces: pieces.length, started });
});

// GET /v1/admin/backfill-library?confirm=1
//
// One-time repair for pieces created before two bugs were fixed:
//   1. Every upload defaulted to publication_status='working-material'
//      with no route anywhere that ever promoted it — so no uploaded
//      document could ever get a public page. New uploads now default to
//      'published'; this catches up everything ingested before that.
//   2. File uploads never derived a title from the document's own content
//      — every one showed the raw uploaded filename (hidden behind
//      "Untitled research document" on the Library page). New uploads now
//      pull the first markdown heading/line; this re-derives a title for
//      already-stored pieces from their own body_md where the current
//      title still looks like a machine filename.
// Probe-reachable, matches the reset-graph/reextract pattern.
const MACHINE_FILENAME_RE =
  /(\.(md|txt|pdf|html?|docx?|csv|json)$|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4})/i;

app.get("/backfill-library", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const userId = c.get("user_id");
  const nowIso = new Date().toISOString();

  const publishResult = await run(
    c.env.DB,
    `UPDATE pieces SET publication_status = 'published', published_at = ?
      WHERE user_id = ? AND publication_status = 'working-material'`,
    [nowIso, userId],
  );

  const pieces = await all<{ id: string; title: string; body_md: string | null }>(
    c.env.DB,
    "SELECT id, title, body_md FROM pieces WHERE user_id = ?",
    [userId],
  );
  const retitled: Array<{ id: string; from: string; to: string }> = [];
  for (const p of pieces) {
    if (!p.body_md || !MACHINE_FILENAME_RE.test(p.title) || /\s/.test(p.title)) continue;
    const heading = p.body_md.match(/^#{1,2}\s+(.+)$/m);
    const firstLine = p.body_md
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    const newTitle =
      heading?.[1]?.trim().slice(0, 200) ||
      (firstLine && firstLine.length <= 200 ? firstLine : null);
    if (!newTitle || newTitle === p.title) continue;
    await run(c.env.DB, "UPDATE pieces SET title = ? WHERE id = ?", [newTitle, p.id]);
    retitled.push({ id: p.id, from: p.title, to: newTitle });
  }

  return c.json({
    ok: true,
    published: publishResult.meta.changes ?? 0,
    retitled_count: retitled.length,
    retitled,
  });
});

// GET /v1/admin/health — model + binding probe.
//
// Pings each role in the router with a 5-token request and reports per-role
// status + latency. The goal: catch a sunset/wedged model the day it breaks
// instead of the next time the operator uploads a document. Designed to be
// cheap (Workers AI free; a handful of tiny calls) and safe to hit every
// deploy. A failed role doesn't fail the whole endpoint — each role is
// independently captured so a partial outage is visible.
//
// Returns:
//   {
//     ok: <all roles green>,
//     generated_at: ISO,
//     roles: {
//       bulk_extraction:    { model, status: "ok" | "fail", latency_ms, error? },
//       hard_extraction:    { ... },
//       ...
//     }
//   }
const HEALTH_ROLES: Role[] = [
  "bulk_extraction",
  "hard_extraction",
  "surfacing_ambitious",
  "judge",
  "large_context",
];

app.get("/health", async (c) => {
  const userId = c.get("user_id");
  const results: Record<string, unknown> = {};
  let allOk = true;
  for (const role of HEALTH_ROLES) {
    const cfg = modelForRole(role);
    const start = Date.now();
    try {
      const out = await callRole(c.env, role, {
        userId,
        system: "Reply with exactly: OK",
        messages: [{ role: "user", content: [{ type: "text", text: "ping" }] }],
        max_tokens: 8,
        idempotency_key: `health:${role}:${Math.floor(start / 60000)}`,
      });
      results[role] = {
        model: cfg.model,
        status: "ok",
        latency_ms: Date.now() - start,
        text_sample: (out.text ?? "").slice(0, 32),
      };
    } catch (err) {
      allOk = false;
      results[role] = {
        model: cfg.model,
        status: "fail",
        latency_ms: Date.now() - start,
        error: (err as Error).message ?? "unknown",
      };
    }
  }
  return c.json({
    ok: allOk,
    generated_at: new Date().toISOString(),
    roles: results,
  });
});

// GET /v1/admin/debug-model?model=...&prompt=...
//
// Calls env.AI.run DIRECTLY (bypassing our callWorkersAi normalizer) and
// returns the raw response so we can see the exact output shape a model
// produces. Diagnoses "the model replied but we parsed nothing" — i.e. the
// adapter is reading the wrong field. Defaults to the bulk-extraction model.
app.get("/debug-model", async (c) => {
  const model = c.req.query("model") ?? modelForRole("bulk_extraction").model;
  const prompt =
    c.req.query("prompt") ??
    'Extract JSON from this text. Output ONLY JSON: {"entities":[{"name":"..."}]}. Text: OSFI raised the domestic stability buffer to 4.0% in 2026.';
  // Defaults to 512 (a quick sanity ping); pass ?max_tokens= to reproduce a
  // real caller's budget, e.g. digestion-typed.ts's EXTRACTION_MAX_TOKENS —
  // needed to diagnose reasoning-capable models that spend the whole budget
  // on reasoning_content and never reach the actual answer.
  const maxTokensParam = Number.parseInt(c.req.query("max_tokens") ?? "512", 10);
  const maxTokens = Number.isFinite(maxTokensParam) && maxTokensParam > 0 ? maxTokensParam : 512;
  const start = Date.now();
  try {
    const raw = (await c.env.AI.run(
      model as never,
      {
        messages: [
          { role: "system", content: "You output JSON only. No prose." },
          { role: "user", content: prompt },
        ],
        max_tokens: maxTokens,
      } as never,
    )) as unknown as Record<string, unknown> | string;
    const isObj = typeof raw === "object" && raw !== null;
    return c.json({
      ok: true,
      model,
      max_tokens: maxTokens,
      latency_ms: Date.now() - start,
      raw_type: typeof raw,
      raw_keys: isObj ? Object.keys(raw as Record<string, unknown>) : null,
      raw,
    });
  } catch (err) {
    return c.json({
      ok: false,
      model,
      max_tokens: maxTokens,
      latency_ms: Date.now() - start,
      error: (err as Error).message ?? "unknown",
    });
  }
});

export default app;
