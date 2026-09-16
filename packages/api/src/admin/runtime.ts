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
import { draftMeme } from "../graph/lib/meme-draft.ts";
import { SETTLE_STEP_RUNNERS } from "../graph/lib/settle-pipeline.ts";
import { all, insertOne, one, run } from "../lib/d1.ts";
import { looksLikeMachineSlug, pieceSlug } from "../lib/slug.ts";
import { UNTITLED, displayTitle } from "../lib/title.ts";
import { type Role, callRole, modelForRole } from "../llm/router.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

// ---------------------------------------------------------------------------
// The corpus split — two populations that must never be treated as one.
//
// `pieces` holds two things that look identical in the schema and are not:
//
//   feed-upload    the operator's OWN documents, uploaded by them.
//   record-expand  third-party pages the retired crawler banked as SOURCE
//                  material (graph/lib/record-builder.ts:710), which sets
//                  working-material deliberately — it was never meant to be
//                  published. Wikipedia articles, news pieces, transcripts.
//
// Publishing the second group would put copyrighted text on canopticon.com
// under the CC BY 4.0 the About page asserts over everything, and bulk
// duplicated third-party text is what search engines penalise a whole domain
// for. So every query using these is guarded twice: on `ingested_from`, which
// is the real filter, and on the `web-fetched` tag, which is a second one.
// Getting this wrong publishes somebody else's work under the operator's name.
// ---------------------------------------------------------------------------

/** SQL fragment: the operator's own uploads, never anything web-fetched. */
/**
 * The third population: output of the dormant autonomous research pipeline.
 *
 * Neither the operator's own uploads nor banked third-party pages, so neither
 * of the guards below matches it — which is why the purge and the reslug both
 * correctly stepped around it, and why anything acting on it needs its own
 * filter rather than borrowing one aimed at something else.
 *
 * Guarded twice like its siblings: on `ingested_from`, and on the
 * `auto-research` tag that deep-research.ts writes at persist time.
 */
export const DEEP_RESEARCH_SQL = `json_extract(metadata, '$.ingested_from') = 'deep-research'
   AND (tags IS NULL OR tags LIKE '%auto-research%')`;

export const OWN_UPLOADS_SQL = `json_extract(metadata, '$.ingested_from') = 'feed-upload'
   AND (tags IS NULL OR tags NOT LIKE '%web-fetched%')`;

/** SQL fragment: the crawler's banked third-party material. */
export const WEB_FETCHED_SQL = `(json_extract(metadata, '$.ingested_from') = 'record-expand'
    OR tags LIKE '%web-fetched%')`;

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

  // ⚠ This promoted EVERY working-material row. That was written when the
  // only working-material pieces were the operator's own older uploads; the
  // retired record-expand crawler has since banked ~100 third-party pages
  // (Wikipedia articles, news, transcripts) in the same table with the same
  // status, deliberately unpublished. One query string would have put all of
  // them on canopticon.com as Canopticon's own work under CC BY 4.0.
  // Now scoped to the operator's own uploads, matching /publish-uploads.
  const publishResult = await run(
    c.env.DB,
    `UPDATE pieces SET publication_status = 'published', published_at = ?
      WHERE user_id = ? AND publication_status = 'working-material'
        AND ${OWN_UPLOADS_SQL}`,
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

// GET /v1/admin/corpus-split — read-only. What is actually in the corpus,
// grouped so the two populations are visible before anything acts on them.
app.get("/corpus-split", async (c) => {
  const userId = c.get("user_id");
  const groups = await all<{
    ingested_from: string | null;
    publication_status: string;
    kind: string;
    n: number;
  }>(
    c.env.DB,
    `SELECT json_extract(metadata, '$.ingested_from') AS ingested_from,
            publication_status, kind, COUNT(*) AS n
       FROM pieces WHERE user_id = ?
      GROUP BY ingested_from, publication_status, kind
      ORDER BY n DESC`,
    [userId],
  );
  const own = await all<{ slug: string; title: string; publication_status: string; chars: number }>(
    c.env.DB,
    `SELECT slug, title, publication_status, COALESCE(length(body_md), 0) AS chars
       FROM pieces
      WHERE user_id = ? AND ${OWN_UPLOADS_SQL}
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT 200`,
    [userId],
  );
  const webFetched = await one<{ n: number }>(
    c.env.DB,
    `SELECT COUNT(*) AS n FROM pieces WHERE user_id = ? AND ${WEB_FETCHED_SQL}`,
    [userId],
  );
  return c.json({
    ok: true,
    groups,
    own_uploads: { count: own.length, pieces: own },
    web_fetched: { count: webFetched?.n ?? 0 },
  });
});

// GET /v1/admin/publish-uploads?confirm=1 — promote the operator's own
// uploads, and only those. Idempotent; safe to re-run.
// GET /v1/admin/reslug?confirm=1[&execute=1]
//
// Every document published before migration 0052 has a slug like
// `compass-artifact-wf-facec16e-…-text-markdown` — the upload's filename,
// with a UUID in it. That is the string a person pastes into a footnote and
// the string a machine keys on, and it signals nothing.
//
// Renaming gets more expensive with every inbound link that exists, so this
// is deliberately a one-time repair run early rather than a permanent
// feature. Scoped to the operator's OWN UPLOADS by the same guard as every
// other destructive endpoint here: third-party banked pages are never
// published and have no URL worth repairing.
//
// The old slug becomes an alias (0052) in the SAME batch as the rename, so
// there is no window in which the old URL is dead — and a citation already
// in the world keeps resolving, which is the whole reason this is safe to do.
//
// Dry run unless &execute=1.
app.get("/reslug", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const execute = c.req.query("execute") === "1";
  const userId = c.get("user_id");
  const rows = await all<{ id: string; slug: string; title: string; body_head: string }>(
    c.env.DB,
    `SELECT id, slug, title, SUBSTR(body_md, 1, 400) AS body_head
       FROM pieces
      WHERE user_id = ? AND ${OWN_UPLOADS_SQL}`,
    [userId],
  );

  const taken = new Set(
    (
      await all<{ slug: string }>(c.env.DB, "SELECT slug FROM pieces WHERE user_id = ?", [userId])
    ).map((r) => r.slug),
  );
  const aliased = new Set(
    (
      await all<{ old_slug: string }>(
        c.env.DB,
        "SELECT old_slug FROM piece_slug_aliases WHERE user_id = ?",
        [userId],
      ).catch(() => [])
    ).map((r) => r.old_slug),
  );

  const planned: Array<{ id: string; from: string; to: string; title: string }> = [];
  const skipped: Array<{ slug: string; why: string }> = [];
  for (const r of rows) {
    if (!looksLikeMachineSlug(r.slug)) {
      skipped.push({ slug: r.slug, why: "already readable" });
      continue;
    }
    // displayTitle, not the raw title: a piece whose stored title is also a
    // filename still has a real heading in its body, and that is the name
    // this slug should come from.
    const name = displayTitle(r.title, r.body_head);
    if (name === UNTITLED) {
      skipped.push({ slug: r.slug, why: "no title to build a slug from" });
      continue;
    }
    let candidate = pieceSlug(name);
    if (!candidate) {
      skipped.push({ slug: r.slug, why: "title produced an empty slug" });
      continue;
    }
    // Uniqueness across BOTH live slugs and retired ones: reusing an old slug
    // for a different document would silently redirect its citations to the
    // wrong page, which is worse than the ugly slug it replaced.
    if (taken.has(candidate) || aliased.has(candidate)) {
      let n = 2;
      while (taken.has(`${candidate}-${n}`) || aliased.has(`${candidate}-${n}`)) n++;
      candidate = `${candidate}-${n}`;
    }
    taken.add(candidate);
    planned.push({ id: r.id, from: r.slug, to: candidate, title: name });
  }

  if (execute) {
    for (const p of planned) {
      await run(
        c.env.DB,
        `INSERT OR IGNORE INTO piece_slug_aliases (id, user_id, piece_id, old_slug)
         VALUES (?, ?, ?, ?)`,
        [crypto.randomUUID(), userId, p.id, p.from],
      );
      await run(
        c.env.DB,
        "UPDATE pieces SET slug = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        [p.to, new Date().toISOString(), p.id, userId],
      );
    }
  }

  return c.json({
    ok: true,
    execute,
    considered: rows.length,
    renamed: execute ? planned.length : 0,
    would_rename: planned.length,
    planned: planned.slice(0, 60),
    skipped: skipped.slice(0, 20),
    ...(execute ? {} : { note: "DRY RUN — re-call with &execute=1 to apply" }),
  });
});

// GET /v1/admin/unpublish-briefs?confirm=1[&execute=1]
//
// The four published deep-research briefs are ~2KB pass-1 summaries of
// third-party web pages: no quotes, no receipts, no figures, published under a
// CC BY byline as this site's own work. The Joly brief's own closing section
// says the sources do not support any detail. They are the weakest pages on a
// site whose entire argument is provenance, and thin-content enforcement lands
// on a whole domain rather than a page.
//
// They are also pass-1 output of a two-pass process: researchOnDemand defers
// the follow-up searches and re-synthesis to advanceResearchRun, which only
// ever ran from the cron. With the cron off they were frozen mid-process and
// published anyway.
//
// UNPUBLISH, NEVER DELETE. The rows stay and only visibility changes, so this
// is reversible by flipping the column back. They leave /research, the
// sitemap, llms.txt and the feed, and renderPiece already refuses
// working-material so /p/<slug> stops resolving. The operator still reaches
// them: renderLibraryIndex links working-material drafts to the review screen.
//
// Dry run unless &execute=1.
app.get("/unpublish-briefs", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const execute = c.req.query("execute") === "1";
  const userId = c.get("user_id");
  const affected = await all<{ slug: string; title: string }>(
    c.env.DB,
    `SELECT slug, title FROM pieces
      WHERE user_id = ? AND publication_status IN ('published','canonical')
        AND ${DEEP_RESEARCH_SQL}`,
    [userId],
  );
  if (execute) {
    await run(
      c.env.DB,
      `UPDATE pieces SET publication_status = 'working-material', updated_at = ?
        WHERE user_id = ? AND publication_status IN ('published','canonical')
          AND ${DEEP_RESEARCH_SQL}`,
      [new Date().toISOString(), userId],
    );
  }
  return c.json({
    ok: true,
    execute,
    count: affected.length,
    pieces: affected,
    ...(execute ? {} : { note: "DRY RUN — re-call with &execute=1 to unpublish" }),
  });
});

app.get("/publish-uploads", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const userId = c.get("user_id");
  const willPublish = await all<{ slug: string; title: string }>(
    c.env.DB,
    `SELECT slug, title FROM pieces
      WHERE user_id = ? AND publication_status = 'working-material' AND ${OWN_UPLOADS_SQL}`,
    [userId],
  );
  const res = await run(
    c.env.DB,
    `UPDATE pieces
        SET publication_status = 'published',
            published_at = COALESCE(published_at, created_at),
            updated_at = ?
      WHERE user_id = ? AND publication_status = 'working-material' AND ${OWN_UPLOADS_SQL}`,
    [new Date().toISOString(), userId],
  );
  return c.json({
    ok: true,
    published: res.meta.changes ?? 0,
    slugs: willPublish.map((p) => p.slug),
    titles: willPublish.map((p) => p.title),
  });
});

// GET /v1/admin/purge-web-fetched?confirm=1[&execute=1]
//
// DRY RUN unless &execute=1. Reports exactly what would be destroyed so the
// operator sees the number before it happens.
//
// The deletion has to go through `nodes`, not `pieces`. `nodes.piece_id` is a
// plain TEXT column with no foreign key (migration 0027), so deleting a piece
// does NOT cascade — it would leave that piece's quotes alive but unmoored,
// and quote-receipt.ts's LEFT JOIN would render a receipt with no document
// behind it. Deleting the nodes DOES cascade correctly: quotes.source_id,
// quotes.node_id, edges.src/dst_node_id, node_props.node_id and
// assertions.node_id are all ON DELETE CASCADE. purgeTypedGraphForPiece()
// already does exactly that one delete, so it is reused rather than
// reimplemented here.
//
// NOT REVERSIBLE. The R2 objects and uploaded_files rows survive, but the
// extracted graph is not rebuildable without re-fetching the original URLs.
app.get("/purge-web-fetched", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const execute = c.req.query("execute") === "1";
  const userId = c.get("user_id");

  const pieces = await all<{ id: string; slug: string; title: string; source_id: string | null }>(
    c.env.DB,
    `SELECT id, slug, title, json_extract(metadata, '$.source_id') AS source_id
       FROM pieces WHERE user_id = ? AND ${WEB_FETCHED_SQL}
      ORDER BY created_at`,
    [userId],
  );
  if (!pieces.length) {
    return c.json({ ok: true, execute, pieces: 0, note: "nothing web-fetched left to purge" });
  }

  // Count the collateral up front. This is the number that gets shown to the
  // operator before anything is destroyed.
  const ids = pieces.map((p) => p.id);
  const placeholders = ids.map(() => "?").join(",");
  const impact = await one<{ nodes: number; quotes: number }>(
    c.env.DB,
    `SELECT
       (SELECT COUNT(*) FROM nodes WHERE user_id = ? AND piece_id IN (${placeholders})) AS nodes,
       (SELECT COUNT(*) FROM quotes WHERE user_id = ? AND node_id IN
          (SELECT id FROM nodes WHERE user_id = ? AND piece_id IN (${placeholders}))) AS quotes`,
    [userId, ...ids, userId, userId, ...ids],
  ).catch(() => null);

  const summary = {
    ok: true,
    execute,
    pieces: pieces.length,
    nodes: impact?.nodes ?? 0,
    quotes: impact?.quotes ?? 0,
    sample: pieces.slice(0, 15).map((p) => p.title),
  };
  if (!execute) {
    return c.json({ ...summary, note: "DRY RUN — re-call with &execute=1 to destroy this" });
  }

  // One piece at a time. 13k nodes across ~100 pieces is far past what a
  // single D1 request should attempt, and a partial run is safe to resume
  // because the selection query no longer matches whatever already went.
  const { purgeTypedGraphForPiece } = await import("../graph/lib/digestion-typed.ts");
  let done = 0;
  for (const p of pieces) {
    await purgeTypedGraphForPiece(c.env, userId, p.id);
    if (p.source_id) {
      await run(c.env.DB, "DELETE FROM sources WHERE id = ? AND user_id = ?", [
        p.source_id,
        userId,
      ]).catch(() => undefined);
    }
    await run(c.env.DB, "DELETE FROM pieces WHERE id = ? AND user_id = ?", [p.id, userId]);
    done++;
  }
  return c.json({ ...summary, purged: done });
});

// GET /v1/admin/resettle?confirm=1&step=<name>
//
// Manually re-runs ONE step of the corpus-settle gate (surfacing_l1 →
// theme_surfacer → autoseed_pages → generate_profiles)
// without needing a new digest job to trigger it — digest-jobs.ts only
// fires the settle gate automatically when the LAST queued/running job
// finishes, so a bug fix to one of these steps has no way to re-run
// against an already-settled corpus short of re-extracting everything.
//
// ONE step per call, not all chained — confirmed live that chaining
// them (each step can make several real LLM calls) reliably exceeds
// whatever aggregate CPU/wall-clock budget Cloudflare gives a single
// waitUntil execution: two consecutive attempts logged a "resettle_started"
// breadcrumb and then nothing else at all — not even the try/catch's own
// "resettle_crashed" breadcrumb, meaning the platform tore down the
// execution context outright rather than the code throwing a catchable
// error. Reuses the same step map the automatic pipeline runs
// (graph/lib/settle-pipeline.ts) so a manual override here can never drift
// from what actually runs on its own. Call this once per step name below
// (see SETTLE_STEPS_ORDER) to run the whole gate; poll /runtime's
// events.by_type between calls.
const RESETTLE_STEPS = SETTLE_STEP_RUNNERS;

// GET /v1/admin/settle-advance?confirm=1 — diagnostic: call
// advanceSettleOneStep from a normal fetch-triggered request instead of
// the every-minute cron. If this reliably advances next_step where the
// cron-triggered call doesn't, that confirms scheduled()-handler waitUntil
// work runs under a tighter execution budget than fetch-triggered
// waitUntil work — a real, documented Cloudflare Workers distinction, not
// a code bug — and the fix is to have the cron self-fetch instead of
// calling the heavy step directly.
app.get("/settle-advance", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const userId = c.get("user_id");
  const env = c.env;
  const before = await one(env.DB, "SELECT * FROM settle_state WHERE user_id = ?", [userId]).catch(
    (err) => ({ error: (err as Error).message }),
  );
  const { advanceSettleOneStep } = await import("../graph/lib/settle-pipeline.ts");
  let advanceError: string | null = null;
  try {
    await advanceSettleOneStep(env, userId);
  } catch (err) {
    advanceError = (err as Error).message ?? "unknown error";
  }
  const after = await one(env.DB, "SELECT * FROM settle_state WHERE user_id = ?", [userId]).catch(
    (err) => ({ error: (err as Error).message }),
  );
  return c.json({ ok: true, before, advanceError, after });
});

// GET /v1/admin/settle-state — diagnostic: what does settle_state actually
// hold right now. Exists because the every-minute cron nudge kept
// re-running entity_resolution instead of advancing — need to see the raw
// row to know whether next_step is stuck or the read/write itself is
// failing silently (a waitUntil'd promise rejection has nowhere to surface).
app.get("/settle-state", async (c) => {
  const userId = c.get("user_id");
  const row = await one<{ user_id: string; next_step: string; last_advanced_at: string | null }>(
    c.env.DB,
    "SELECT user_id, next_step, last_advanced_at FROM settle_state WHERE user_id = ?",
    [userId],
  ).catch((err) => ({ error: (err as Error).message }) as never);
  return c.json({ ok: true, row });
});

// GET /v1/admin/profiles-state — diagnostic: what's actually in
// page_profiles right now (graph/lib/profile-generator.ts). Exists for the
// same reason /settle-state does — live-verifying a new pipeline step
// against the busy orchestrator_events log (capped at the last 50 rows via
// /runtime) is unreliable once other autonomous activity is pushing that
// window fast; this reads the table directly instead of racing the log.
app.get("/profiles-state", async (c) => {
  const userId = c.get("user_id");
  const rows = await all<{
    id: string;
    label: string;
    status: string;
    claims_verified: number;
    claims_killed: number;
    error: string | null;
    updated_at: string;
  }>(
    c.env.DB,
    `SELECT pp.id, n.label, pp.status, pp.claims_verified, pp.claims_killed, pp.error, pp.updated_at
       FROM page_profiles pp
       JOIN nodes n ON n.id = pp.subject_node_id
      WHERE pp.user_id = ?
      ORDER BY pp.updated_at DESC
      LIMIT 20`,
    [userId],
  ).catch((err) => [{ error: (err as Error).message } as never]);
  return c.json({ ok: true, rows });
});

// GET /v1/admin/readings-candidates — diagnostic: what does
// draft-reading.ts's own candidate query see right now. Exists because
// readings.drafted logged {"drafted":0,"skipped":0,"errors":[]} on every
// tick for 6+ consecutive hours (12:15-14:18 drafted 8 readings fine, then
// nothing) — need to see whether the pool is genuinely exhausted under the
// real thresholds or the query itself is silently failing (same
// .catch(() => []) shape that made generate_profiles hard to debug).
// Mirrors draftReadings' own query exactly rather than reimplementing it.
app.get("/readings-candidates", async (c) => {
  const userId = c.get("user_id");
  const MIN_QUOTES = 4;
  const rows = await all<{
    page_id: string;
    label: string;
    signed_status: string;
    score: number;
    qcount: number;
    claims_verified: number;
    claims_killed: number;
  }>(
    c.env.DB,
    `SELECT p.id AS page_id, n.label, p.signed_status, p.claims_verified, p.claims_killed,
            (SELECT COUNT(*) FROM assertions a JOIN nodes an ON an.id = a.node_id
               WHERE an.user_id = ? AND a.rank = 'contested'
                 AND EXISTS (SELECT 1 FROM edges e WHERE
                   (e.src_node_id = an.id AND e.dst_node_id = n.id) OR
                   (e.dst_node_id = an.id AND e.src_node_id = n.id))) * 3
          + (SELECT COUNT(*) FROM edges e WHERE e.src_node_id = n.id OR e.dst_node_id = n.id) AS score,
            (SELECT COUNT(*) FROM quotes q
              WHERE q.user_id = ?
                AND (q.node_id = n.id OR EXISTS (
                  SELECT 1 FROM edges e WHERE
                    (e.src_node_id = q.node_id AND e.dst_node_id = n.id) OR
                    (e.dst_node_id = q.node_id AND e.src_node_id = n.id)
                ))
            ) AS qcount
       FROM pages p JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ?
        AND n.kind IN ('entity', 'theme')
      ORDER BY score DESC
      LIMIT 20`,
    [userId, userId, userId],
  ).catch((err) => [{ error: (err as Error).message } as never]);
  const eligible = rows.filter(
    (r) =>
      r.qcount >= MIN_QUOTES &&
      (r.signed_status === "none" ||
        (r.signed_status === "draft" &&
          r.qcount >= r.claims_verified + r.claims_killed + MIN_QUOTES)),
  );
  return c.json({
    ok: true,
    total_pages_scanned: rows.length,
    eligible_count: eligible.length,
    rows,
  });
});

app.get("/resettle", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const stepName = c.req.query("step") ?? "";
  const stepFn = (
    RESETTLE_STEPS as Record<string, (typeof RESETTLE_STEPS)[keyof typeof RESETTLE_STEPS]>
  )[stepName];
  if (!stepFn) {
    return c.json(
      {
        ok: false,
        error: `missing or unknown ?step= — one of: ${Object.keys(RESETTLE_STEPS).join(", ")}`,
      },
      400,
    );
  }
  const userId = c.get("user_id");
  const env = c.env;
  c.executionCtx.waitUntil(
    (async () => {
      await insertOne(env.DB, "orchestrator_events", {
        user_id: userId,
        event_type: "resettle_step_started",
        subject_kind: "corpus",
        subject_id: userId,
        payload: JSON.stringify({ step: stepName, at: new Date().toISOString() }),
      }).catch(() => {});
      try {
        await stepFn(env, userId);
      } catch (err) {
        await insertOne(env.DB, "orchestrator_events", {
          user_id: userId,
          event_type: "settle_step_failed",
          subject_kind: "corpus",
          subject_id: userId,
          payload: JSON.stringify({
            step: stepName,
            error: (err as Error).message ?? "unknown error",
          }),
        }).catch(() => {});
      }
    })(),
  );
  return c.json({ ok: true, started: true, step: stepName });
});

// GET /v1/admin/auto-expand — manually fire one autonomous-sweep tick, for
// testing/observing without waiting for the cron. Same budget cap as the
// cron path (graph/lib/autonomous-expand.ts) — this does NOT bypass the
// per-subject cooldown or batch size, it just runs the same logic on demand.
app.get("/auto-expand", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const userId = c.get("user_id");
  const env = c.env;
  // Same reason /resettle fires via waitUntil: a batch of real searches +
  // fetches + extraction runs long enough to risk the platform's execution
  // ceiling if awaited inline. Poll /v1/admin/runtime for autonomous.sweep.*
  // orchestrator_events instead.
  c.executionCtx.waitUntil(
    (async () => {
      const { sweepThinSubjects } = await import("../graph/lib/autonomous-expand.ts");
      await sweepThinSubjects(env, userId).catch((err) => {
        return insertOne(env.DB, "orchestrator_events", {
          user_id: userId,
          event_type: "autonomous.sweep.failed",
          subject_kind: "sweep",
          subject_id: null,
          payload: JSON.stringify({ error: (err as Error).message ?? "unknown error" }),
        });
      });
    })(),
  );
  return c.json({ ok: true, started: true });
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

// GET /v1/admin/reembed-status
//
// One-time backfill for the 2026-07-24 bge-large-en-v1.5 -> bge-m3 swap
// (graph/lib/embeddings.ts). The actual work — graph/lib/embeddings.ts's
// advanceReembedBackfill — runs automatically off the cron tick (index.ts,
// same pattern as advanceResearchRun/advanceSettleOneStep): 5 pieces per
// tick, progress tracked via an orchestrator_events row rather than a
// request param so no caller has to remember an offset. This route is
// read-only: it just reports where the cron-driven backfill currently is,
// for checking progress without waiting on ~20 ticks to land one at a
// time. (An earlier version of this route drove the backfill itself,
// synchronously, one batch per call — dropped after a live probe run at
// batch size 10 silently died mid-request: the admin-probe's own curl call
// has a 30s client-side timeout, independent of any Cloudflare-side limit,
// and even a smaller batch would have meant ~20 manual round trips for a
// 102-piece corpus. Letting the existing cron infra own it is both safer
// and needs zero manual driving.)
app.get("/reembed-status", async (c) => {
  const userId = c.get("user_id");
  const total =
    (
      await one<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM pieces WHERE user_id = ?", [
        userId,
      ])
    )?.n ?? 0;
  const doneEvent = await one<{ created_at: string }>(
    c.env.DB,
    "SELECT created_at FROM orchestrator_events WHERE user_id = ? AND event_type = 'embeddings.reembed_done' LIMIT 1",
    [userId],
  );
  const progress = await one<{ payload: string; created_at: string }>(
    c.env.DB,
    `SELECT payload, created_at FROM orchestrator_events
      WHERE user_id = ? AND event_type = 'embeddings.reembed_progress'
      ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  return c.json({
    ok: true,
    total,
    done: Boolean(doneEvent),
    done_at: doneEvent?.created_at ?? null,
    progress: progress ? { ...JSON.parse(progress.payload), at: progress.created_at } : null,
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

// GET /v1/admin/beats — list standing coverage areas (newsroom phase 3).
app.get("/beats", async (c) => {
  const userId = c.get("user_id");
  const beats = await all<{
    id: string;
    label: string;
    created_at: string;
    last_swept_at: string | null;
  }>(
    c.env.DB,
    "SELECT id, label, created_at, last_swept_at FROM coverage_beats WHERE user_id = ? ORDER BY created_at ASC",
    [userId],
  ).catch(() => []);
  return c.json({ ok: true, beats });
});

// GET /v1/admin/beats/add?confirm=1&label=... — add one beat. Idempotent:
// the unique (user_id, label) index means adding the same label twice is a
// no-op, not an error.
app.get("/beats/add", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const label = (c.req.query("label") ?? "").trim();
  if (!label) return c.json({ ok: false, error: "missing ?label=" }, 400);
  const userId = c.get("user_id");
  await insertOne(c.env.DB, "coverage_beats", { user_id: userId, label }).catch(() => {});
  return c.json({ ok: true, label });
});

// GET /v1/admin/event-log?type=<event_type> — the raw orchestrator_events
// rows for any one event_type, most recent first. Generalizes the
// search-miss-log pattern below instead of adding a new single-purpose
// route every time a new pipeline step needs debugging against the
// /runtime feed, whose last-50-rows window fills fast once autonomous
// activity (the newsroom sweep, feed processing) is running concurrently.
app.get("/event-log", async (c) => {
  const userId = c.get("user_id");
  const eventType = (c.req.query("type") ?? "").trim();
  if (!eventType) return c.json({ ok: false, error: "missing ?type=" }, 400);
  const rows = await all<{
    id: string;
    payload: string;
    subject_kind: string | null;
    subject_id: string | null;
    created_at: string;
  }>(
    c.env.DB,
    `SELECT id, payload, subject_kind, subject_id, created_at FROM orchestrator_events
     WHERE user_id = ? AND event_type = ?
     ORDER BY created_at DESC LIMIT 30`,
    [userId, eventType],
  ).catch(() => []);
  return c.json({ ok: true, type: eventType, count: rows.length, events: rows });
});

// GET /v1/admin/search-miss-log — the raw orchestrator_events rows behind
// every "search.miss" (logged on every /search hit with zero corpus
// matches, from public.render/search.ts). Existed to answer one concrete
// question after the Brave Answers product blew through its $5/mo cap in
// days: was that public-visitor traffic, or repeated live-testing during
// this session? The query text + timestamps settle it either way — kept
// as a permanent diagnostic since "why did a metered call spike" will
// come up again.
app.get("/search-miss-log", async (c) => {
  const userId = c.get("user_id");
  const rows = await all<{ payload: string; created_at: string }>(
    c.env.DB,
    `SELECT payload, created_at FROM orchestrator_events
     WHERE user_id = ? AND event_type = 'search.miss'
     ORDER BY created_at DESC LIMIT 300`,
    [userId],
  ).catch(() => []);
  return c.json({
    ok: true,
    count: rows.length,
    events: rows.map((r) => {
      let query: string | null = null;
      try {
        query = (JSON.parse(r.payload) as { query?: string }).query ?? null;
      } catch {
        query = null;
      }
      return { query, created_at: r.created_at };
    }),
  });
});

// GET /v1/admin/backfill-citation-markers?confirm=1
//
// One-time cleanup: readings drafted before applyCitationMarkers existed
// (draft-reading.ts) have raw [qN] bracket text baked into their stored
// body_md/body_html — fixing draftOne only stops NEW drafts from getting
// this. Confirmed live at canopticon.com/p/larry-fink?mode=signed before
// this endpoint ran. Safe to re-run; pages with nothing left to fix are
// no-ops.
app.get("/backfill-citation-markers", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const userId = c.get("user_id");
  const { backfillCitationMarkers } = await import("../graph/lib/draft-reading.ts");
  const report = await backfillCitationMarkers(c.env, userId);
  return c.json({ ok: true, ...report });
});

// GET /v1/admin/backfill-face-citations?confirm=1
//
// Sibling bug to backfill-citation-markers, caught in verification, not
// in the original report: the LLM-seasoned Faces (video script, chapter
// outline — face-renderer.ts) are generated by feeding the model the
// SIGNED READING's stored body_md as context. Any face rendered before
// the draft-reading.ts fix + the pages backfill was fed body_md that
// still had raw [qN] brackets in it, and echoed that same bracket format
// into its own output — a second copy of the same visible bug, in a
// different table (page_faces, not pages). There's no marker mapping to
// reconstruct here; the fix is simpler: page_faces.body_md now has clean
// real-citation-link context available, so just re-render. Uses the same
// generateSingleFace the operator's existing "rerender" affordance calls.
app.get("/backfill-face-citations", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const userId = c.get("user_id");
  // '%[%]%' not '%[q%' — same marker-drift reason as backfill-citation-markers.
  const affected = await all<{ page_id: string; kind: "script" | "chapter" }>(
    c.env.DB,
    `SELECT page_id, kind FROM page_faces
      WHERE user_id = ? AND kind IN ('script', 'chapter')
        AND status = 'ready' AND (body_md LIKE '%[%]%' OR body_html LIKE '%[%]%')`,
    [userId],
  ).catch(() => []);
  const { generateSingleFace } = await import("../graph/lib/face-renderer.ts");
  const report = { scanned: affected.length, rerendered: 0, errors: [] as string[] };
  for (const row of affected) {
    try {
      await generateSingleFace(c.env, userId, row.page_id, row.kind);
      report.rerendered++;
    } catch (err) {
      report.errors.push(`${row.page_id}/${row.kind}: ${(err as Error).message}`);
    }
  }
  return c.json({ ok: true, ...report });
});

// GET /v1/admin/expand-status?subject=X — reads getExpandStatus() for a
// subject, the same function the live banner/search page use to decide
// what to show and whether to keep polling. Safe, read-only — kept as a
// permanent diagnostic (like /beats) for checking a record-expand run's
// real state without waiting on the UI's own 5s refresh.
app.get("/expand-status", async (c) => {
  const subject = c.req.query("subject");
  if (!subject) return c.json({ ok: false, error: "missing ?subject=" }, 400);
  const userId = c.get("user_id");
  const { getExpandStatus } = await import("../graph/lib/record-builder.ts");
  const status = await getExpandStatus(c.env, userId, subject);
  return c.json({ ok: true, status });
});

// GET /v1/admin/backfill-cost-whitelists?confirm=1 — one-time sync: insert
// any DEFAULT_WHITELISTS (lib/seed.ts) entry the operator's account is
// missing. Needed because seedOperator only writes the whitelist once, at
// account creation — an operation_type added later (like
// browser_rendering.fetch, added for record-builder.ts's autonomous
// fetch-fallback) never reaches an already-seeded account on its own, and
// the cost gate (cost/approve.ts) treats a missing whitelist row as
// unauthorized. Deliberately NOT folded into the hot-path
// getOrSeedOperator, which runs on every request — see the comment on
// seedOperator in lib/seed.ts. Safe to re-run: INSERT OR IGNORE against
// the UNIQUE(user_id, operation_type) constraint.
app.get("/backfill-cost-whitelists", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const userId = c.get("user_id");
  const { DEFAULT_WHITELISTS } = await import("../lib/seed.ts");
  let inserted = 0;
  for (const w of DEFAULT_WHITELISTS) {
    const before = await one<{ id: string }>(
      c.env.DB,
      "SELECT id FROM cost_whitelists WHERE user_id = ? AND operation_type = ?",
      [userId, w.operation_type],
    ).catch(() => null);
    if (before) continue;
    await run(
      c.env.DB,
      `INSERT OR IGNORE INTO cost_whitelists
         (id, user_id, operation_type, enabled, per_op_max_cents, daily_max_cents, monthly_max_cents, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        userId,
        w.operation_type,
        w.enabled ? 1 : 0,
        w.per_op_max_cents,
        w.daily_max_cents,
        w.monthly_max_cents,
        w.notes,
      ],
    );
    inserted++;
  }
  return c.json({ ok: true, checked: DEFAULT_WHITELISTS.length, inserted });
});

// GET /v1/admin/meme-draft?confirm=1[&contradiction_id=...]
//
// Prototype: compresses one already judge-verified self_contradictions row
// into the "bare A/B, no connecting clause" meme copy format, translates it
// into a visual prompt, generates one image via Workers AI, stores both.
// Picks the most recent undrafted contradiction if no id is given. Produces
// exactly one meme_drafts row for the operator to look at — nothing here
// publishes anywhere.
app.get("/meme-draft", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const userId = c.get("user_id");
  const result = await draftMeme(c.env, userId, c.req.query("contradiction_id") || undefined);
  return c.json(result);
});

// GET /v1/admin/meme-image?key=memes/<uuid>.jpg
//
// Serves a generated meme image back out of R2. The key is checked against
// this user's own meme_drafts rows before FILES.get — without that check an
// arbitrary ?key= would let an authenticated admin read any R2 object by
// key, not just meme output.
app.get("/meme-image", async (c) => {
  const key = c.req.query("key");
  if (!key || !key.startsWith("memes/")) {
    return c.json({ ok: false, error: "missing or invalid ?key=" }, 400);
  }
  const userId = c.get("user_id");
  const owned = await one<{ id: string }>(
    c.env.DB,
    "SELECT id FROM meme_drafts WHERE image_r2_key = ? AND user_id = ?",
    [key, userId],
  );
  if (!owned) return c.json({ ok: false, error: "not found" }, 404);
  const obj = await c.env.FILES.get(key);
  if (!obj) return c.json({ ok: false, error: "missing in storage" }, 404);
  return new Response(obj.body, {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=3600" },
  });
});

export default app;
