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

// GET /v1/admin/research-runs — read-only. Where every research run stopped.
//
// This did not exist, so when the operator reported "it got to step like five
// and didn't work", there was no way to look. The probe could read the corpus,
// the queue depths and the graph counts, but not the one table that records
// what a research run was doing when it stopped.
//
// Step five is "Dig deeper (N follow-up searches)" — the pass2_pending state.
// Pass 2 is dispatched by advanceResearchRun, and the only caller in the live
// system is POST /op/research/advance, a button. With the cron off (standing
// rule 4) nothing drains it on its own, so a run that proposed follow-ups
// parks there until a person presses it. A row sitting at pass2_pending is
// therefore not a failure — it is a run waiting for a press, and that is
// exactly what this endpoint is for saying out loud.
app.get("/research-runs", async (c) => {
  const userId = c.get("user_id");
  const runs = await all<{
    id: string;
    label: string;
    angle: string | null;
    status: string;
    error: string | null;
    followups: string | null;
    final_piece_id: string | null;
    created_at: string;
    updated_at: string | null;
  }>(
    c.env.DB,
    `SELECT id, label, angle, status, error,
            followup_queries AS followups, final_piece_id, created_at, updated_at
       FROM research_runs WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 40`,
    [userId],
  ).catch(() => []);
  const byStatus = await all<{ status: string; n: number }>(
    c.env.DB,
    "SELECT status, COUNT(*) AS n FROM research_runs WHERE user_id = ? GROUP BY status",
    [userId],
  ).catch(() => []);
  const waiting = runs.filter((r) => r.status === "pass2_pending").length;
  return c.json({
    ok: true,
    by_status: byStatus,
    waiting_for_the_advance_button: waiting,
    advance_with: "POST /op/research/advance (one run per press)",
    runs,
  });
});

// GET /v1/admin/corpus-split — read-only. What is actually in the corpus,
// grouped so the three populations are visible before anything acts on them:
// the operator's own uploads, the crawler's banked pages (legacy rows only —
// since migration 0059 a fetched page is a `sources` row and never a piece,
// so this count only ever goes down), and the research pipeline's own briefs.
// `banked_sources` is where fetched pages live now.
// The record linking itself, as the live site computes it (site/content/
// store.ts linkIndex, site/links.ts): the graph's subjects as vocabulary,
// how many of them two or more public documents carry word for word, how
// many documents link out, and one document's links (?slug=, else three
// samples). Destinations are only ever public documents. Read-only.
app.get("/links", async (c) => {
  const store = await import("../site/content/store.ts");
  const { refreshUploads } = await import("../site/uploads.ts");
  await refreshUploads(c.env, true);
  const stats = store.linkIndexStats();
  const held = new Set(store.heldResearch().map((d) => d.id));
  const docs = store.publicResearch().map((d) => d.id);
  let toHeld = 0;
  let links = 0;
  for (const id of docs)
    for (const l of store.subjectLinks(id)) {
      links++;
      if (held.has(l.route.slice(3))) toHeld++;
    }
  // ?vocabulary=1: the subject names themselves (no document text), so the
  // link rules can be tuned against the live vocabulary.
  if (c.req.query("vocabulary") === "1") {
    const { subjectVocabulary } = await import("../graph/lib/crosslinks.ts");
    const userId = c.get("user_id");
    const kinds = await all<{ label: string; kind: string; type: string | null }>(
      c.env.DB,
      `SELECT DISTINCT label, kind, json_extract(metadata, '$.entity_type') AS type FROM nodes
        WHERE user_id = ? AND kind IN ('entity','event','theme') AND LENGTH(label) >= 8
          AND COALESCE(json_extract(metadata, '$.entity_type'), '') NOT IN ('person','organization','institution')`,
      [userId],
    ).catch(() => []);
    return c.json({ count: (await subjectVocabulary(c.env.DB, userId)).length, labels: kinds });
  }
  const slug = c.req.query("slug");
  const show = (id: string) => ({
    slug: id,
    links: store
      .subjectLinks(id)
      .slice(0, 8)
      .map((l) => ({ phrase: l.label, to: l.route })),
  });
  return c.json({
    vocabulary: stats.vocabulary,
    phrases_shared_by_2_or_more_documents: stats.labelsShared,
    documents_with_links: stats.docsWithLinks,
    index_built_in_ms: stats.buildMs,
    public_documents: docs.length,
    candidate_links_on_public_documents: links,
    links_to_held_documents: toHeld,
    sample: slug
      ? [show(slug)]
      : docs
          .filter((id) => store.subjectLinks(id).length)
          .slice(0, 3)
          .map(show),
  });
});

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
  const deepResearch = await one<{ n: number }>(
    c.env.DB,
    `SELECT COUNT(*) AS n FROM pieces WHERE user_id = ? AND ${DEEP_RESEARCH_SQL}`,
    [userId],
  ).catch(() => null);
  const bankedSources = await one<{ n: number }>(
    c.env.DB,
    "SELECT COUNT(*) AS n FROM sources WHERE user_id = ? AND ingested_via = 'record-expand'",
    [userId],
  ).catch(() => null);
  return c.json({
    ok: true,
    groups,
    own_uploads: { count: own.length, pieces: own },
    web_fetched: {
      count: webFetched?.n ?? 0,
      note: "legacy pieces rows only; fetched pages are sources since migration 0059",
    },
    deep_research: { count: deepResearch?.n ?? 0 },
    banked_sources: { count: bankedSources?.n ?? 0 },
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

// GET /v1/admin/announce?slug=<piece>&confirm=1[&execute=1]
//
// Tell the confirmed subscribers about one published piece. The mailing list
// collected addresses and sent nothing since it shipped; this is the other
// half, and lib/email.ts is the sender.
//
// CONFIRMED SUBSCRIBERS ONLY, and never the unsubscribed. Anyone can type
// anyone's address into a public form, so an unconfirmed row is an assertion
// about someone who has not agreed to anything — mailing them is the one
// mistake here that cannot be taken back.
//
// Dry run unless &execute=1, because unlike every other endpoint in this file
// the effect is not in a database this operator controls. It is in other
// people's inboxes, and there is no undo.
app.get("/announce", async (c) => {
  if (c.req.query("confirm") !== "1") {
    return c.json({ ok: false, error: "missing ?confirm=1" }, 400);
  }
  const slug = c.req.query("slug") ?? "";
  if (!slug) return c.json({ ok: false, error: "missing ?slug=" }, 400);
  const execute = c.req.query("execute") === "1";
  const userId = c.get("user_id");

  const piece = await one<{ slug: string; title: string; subtitle: string | null }>(
    c.env.DB,
    `SELECT slug, title, subtitle FROM pieces
      WHERE user_id = ? AND slug = ? AND publication_status IN ('published','canonical')`,
    [userId, slug],
  );
  if (!piece) return c.json({ ok: false, error: "no published piece with that slug" }, 404);

  const recipients = await all<{ email: string; unsubscribe_token: string }>(
    c.env.DB,
    `SELECT email, unsubscribe_token FROM pub_subscriptions
      WHERE user_id = ? AND confirmed = 1 AND unsubscribed_at IS NULL`,
    [userId],
  );

  if (!execute) {
    return c.json({
      ok: true,
      execute: false,
      piece: { slug: piece.slug, title: piece.title },
      recipients: recipients.length,
      note: "DRY RUN — re-call with &execute=1 to send. There is no undo.",
    });
  }

  const { sendAnnouncement } = await import("../lib/email");
  const url = `https://canopticon.com/p/${piece.slug}`;
  let sent = 0;
  const failures: string[] = [];
  for (const r of recipients) {
    const res = await sendAnnouncement(c.env, r.email, {
      title: piece.title,
      subtitle: piece.subtitle,
      url,
      unsubscribeToken: r.unsubscribe_token,
    });
    if (res.ok) sent++;
    else if (failures.length < 5 && res.reason) failures.push(res.reason);
  }
  return c.json({
    ok: true,
    execute: true,
    piece: { slug: piece.slug, title: piece.title },
    recipients: recipients.length,
    sent,
    // Surfaced rather than swallowed: a missing key and an unverified sending
    // domain both produce zero sends and look identical from the outside.
    ...(failures.length ? { failures } : {}),
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
//
// Since migration 0059 nothing creates rows this matches: expandRecord banks
// a fetched page as a `sources` row only. This endpoint drains what is left
// from before. A research run that banked before 0059 still references these
// pieces by id (pass1_piece_ids / pass2_piece_ids); purging them makes that
// run's synthesis fail with "banked pieces no longer found (purged) — start a
// new run", a stated reason rather than a crash (deep-research.ts,
// loadBankedSources).
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

// ---- what the cheaper engine could run on, and where the Claude money went ----

/** The live Workers AI text-generation catalog (ids, context, tools, price
 *  as the catalog states them). ?try=<model> runs one tiny tool-calling call
 *  on that model and returns what came back; ?search=<query> tries the
 *  Web Search binding once. Read-only apart from those two small calls. */
app.get("/models", async (c) => {
  const ai = c.env.AI as unknown as {
    models?: (p?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
    run: (model: string, input: unknown) => Promise<unknown>;
    websearch?: (input: Record<string, unknown>) => Promise<unknown>;
  };
  const out: Record<string, unknown> = {
    websearch_binding: typeof ai.websearch,
    ai_gateway_id_set: !!c.env.AI_GATEWAY_ID,
    search_gateway_id: c.env.SEARCH_GATEWAY_ID ?? null,
  };
  try {
    const list = (await ai.models?.({ task: "Text Generation", per_page: 300 })) ?? [];
    out.models = list.map((m) => ({
      name: m.name,
      description: String(m.description ?? "").slice(0, 160),
      created_at: m.created_at,
      properties: Object.fromEntries(
        ((m.properties as Array<{ property_id: string; value: unknown }>) ?? []).map((p) => [
          p.property_id,
          p.value,
        ]),
      ),
    }));
  } catch (err) {
    out.models_error = String(err);
  }
  const tryModel = c.req.query("try");
  if (tryModel) {
    const t0 = Date.now();
    try {
      out.try = {
        model: tryModel,
        result: await ai.run(tryModel, {
          messages: [
            { role: "system", content: "Use the tool when a question needs it." },
            { role: "user", content: "What is the population of Hamilton, Ontario? Look it up." },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "web_search",
                description: "Search the web.",
                parameters: {
                  type: "object",
                  properties: { query: { type: "string" } },
                  required: ["query"],
                },
              },
            },
          ],
          max_tokens: 400,
        }),
        ms: Date.now() - t0,
      };
    } catch (err) {
      out.try = { model: tryModel, error: String(err), ms: Date.now() - t0 };
    }
  }
  // The Workers AI engine's own web tools, as a research turn uses them.
  const { readPage, webSearch } = await import("../write/engines.ts");
  const ws = c.req.query("websearch");
  if (ws) {
    try {
      out.websearch = (await webSearch(c.env, ws)).slice(0, 5);
    } catch (err) {
      out.websearch = { error: String(err) };
    }
  }
  const read = c.req.query("read");
  if (read) {
    const t0 = Date.now();
    try {
      const page = await readPage(c.env, read);
      out.read = page
        ? {
            url: page.url,
            title: page.title,
            kind: page.kind,
            chars: page.text.length,
            start: page.text.slice(0, 600),
            ms: Date.now() - t0,
          }
        : { empty: true, ms: Date.now() - t0 };
    } catch (err) {
      out.read = { error: String(err), ms: Date.now() - t0 };
    }
  }
  const q = c.req.query("search");
  if (q && ai.websearch) {
    try {
      const r = (await ai.websearch({
        query: q,
        limit: 3,
        gatewayId:
          c.req.query("gateway") ?? c.env.SEARCH_GATEWAY_ID ?? c.env.AI_GATEWAY_ID ?? "default",
        ...(c.req.query("provider") ? { provider: c.req.query("provider") } : {}),
      })) as unknown;
      out.search =
        r instanceof Response ? { status: r.status, body: (await r.text()).slice(0, 4000) } : r;
    } catch (err) {
      out.search = { error: String(err) };
    }
  }
  return c.json(out);
});

/** Where the workspace's Claude spending went: per kind of conversation and
 *  the costliest conversations, by token type. No titles, no text. */
app.get("/spend", async (c) => {
  const userId = c.get("user_id");
  const rows = await all<{ id: string; kind: string; created_at: string; usage: string }>(
    c.env.DB,
    "SELECT id, kind, created_at, usage FROM drafts WHERE user_id = ?",
    [userId],
  ).catch(() => []);
  const msgs = await all<{ draft_id: string; n: number }>(
    c.env.DB,
    "SELECT draft_id, COUNT(*) AS n FROM draft_messages GROUP BY draft_id",
    [],
  ).catch(() => []);
  const pages = await all<{ draft_id: string; n: number }>(
    c.env.DB,
    "SELECT draft_id, COUNT(*) AS n FROM research_sources GROUP BY draft_id",
    [],
  ).catch(() => []);
  const count = (list: Array<{ draft_id: string; n: number }>) =>
    new Map(list.map((r) => [r.draft_id, r.n]));
  const m = count(msgs);
  const p = count(pages);
  const each = rows.map((r) => {
    const u = JSON.parse(r.usage || "{}") as Record<string, number>;
    return {
      kind: r.kind,
      created: r.created_at.slice(0, 10),
      dollars: Math.round(u.cents ?? 0) / 100,
      input: u.input ?? 0,
      output: u.output ?? 0,
      cache_read: u.cacheRead ?? 0,
      cache_write: u.cacheWrite ?? 0,
      message_rows: m.get(r.id) ?? 0,
      pages_read: p.get(r.id) ?? 0,
    };
  });
  const byKind: Record<string, Record<string, number>> = {};
  for (const e of each) {
    const k = (byKind[e.kind] ??= {
      drafts: 0,
      dollars: 0,
      input: 0,
      output: 0,
      cache_read: 0,
      cache_write: 0,
    });
    k.drafts = (k.drafts ?? 0) + 1;
    for (const f of ["dollars", "input", "output", "cache_read", "cache_write"] as const)
      k[f] = (k[f] ?? 0) + e[f];
  }
  return c.json({
    total_dollars: Math.round(each.reduce((a, e) => a + e.dollars, 0) * 100) / 100,
    by_kind: byKind,
    costliest: each.sort((a, b) => b.dollars - a.dollars).slice(0, 15),
  });
});

/** One research turn on a Workers AI engine, run in memory (nothing saved,
 *  nothing in the drafts list): what it did, the report it wrote, whether its
 *  quotations were found word for word in the pages it read, and the cost.
 *  ?q=<question>&model=<engine id>&steps=<max model calls, default 14>. */
app.get("/engine-try", async (c) => {
  const { runTurn } = await import("../write/agent.ts");
  const { memoryDrafts } = await import("../write/drafts.ts");
  const { memorySources, checkReport, citationProblems, figureProblems } = await import(
    "../write/research.ts"
  );
  const { memoryNotes } = await import("../write/notes.ts");
  const { DEFAULT_ENGINE, isWorkersAi, engine } = await import("../write/engines.ts");
  const model = c.req.query("model") ?? DEFAULT_ENGINE;
  // Claude is billed per token on the operator's account: only when asked.
  const known = engine(model).id === model;
  if (!known) return c.json({ error: "Not an engine." }, 400);
  if (!isWorkersAi(model) && c.req.query("claude") !== "1")
    return c.json({ error: "A Claude engine needs &claude=1 (it is billed)." }, 400);
  // ?eval=N runs task N of the engine test (write/eval.ts) and grades it.
  const { EVAL_SET, grade, repeatedShare } = await import("../write/eval.ts");
  const task = c.req.query("eval") != null ? EVAL_SET[Number(c.req.query("eval"))] : undefined;
  if (c.req.query("eval") != null && !task) return c.json({ error: "No such task." }, 400);
  const kind = task?.kind ?? (c.req.query("kind") === "article" ? "article" : "research");
  const q =
    task?.text ??
    c.req.query("q") ??
    "How many housing units were started in the City of Toronto in the first half of 2026, and how does that compare with the previous decade?";
  const full = c.req.query("full") === "1";
  // Follow-ups, as Chris would send them: "keep going" while parts are unwritten.
  const follow = Math.min(3, Math.max(0, Number(c.req.query("follow")) || 0));
  const store = memoryDrafts();
  const sources = memorySources();
  const notes = memoryNotes();
  const d = await store.create(kind);
  const events: Array<Record<string, unknown>> = [];
  const t0 = Date.now();
  const deadline = Math.min(1500, Math.max(20, Number(c.req.query("deadline")) || 240)) * 1000;
  const maxSteps = Math.min(100, Math.max(2, Number(c.req.query("steps")) || 14));
  const emit = (e: unknown) => {
    const x = e as Record<string, unknown>;
    // Claude's text arrives in small pieces: keep the rest, not those.
    if (x.type === "text" && !isWorkersAi(model)) return;
    const { check: _check, ...rest } = x;
    events.push({
      s: Math.round((Date.now() - t0) / 1000),
      ...rest,
      ...(typeof x.text === "string" ? { text: x.text.slice(0, 300) } : {}),
    });
  };
  const unwritten = (body: string) =>
    body.trim().length < 400 || /^#{2,3} [^\n]+\n+_\(to write\)_/m.test(body);
  const work = (async () => {
    let text = q;
    let turns = 0;
    for (;;) {
      turns++;
      await runTurn({
        stream: null,
        defaultEngine: model,
        env: c.env,
        store,
        sources,
        notes,
        draftId: d.id,
        text,
        maxSteps,
        emit,
      });
      const now = await store.get(d.id);
      if (turns > follow || !unwritten(now?.body ?? "")) return turns;
      text = "Keep going: write the parts still unwritten.";
    }
  })();
  // The answer is streamed: a space every fifteen seconds keeps the
  // connection open through a long turn (JSON allows leading whitespace).
  const { readable, writable } = new TransformStream();
  const out = writable.getWriter();
  const enc = new TextEncoder();
  const beat = setInterval(() => out.write(enc.encode(" ")).catch(() => {}), 15_000);
  const answer = (async () => {
    const turns = await Promise.race([
      work.catch((e) => {
        events.push({ s: Math.round((Date.now() - t0) / 1000), error: String(e).slice(0, 300) });
        return -1;
      }),
      new Promise<number>((r) => setTimeout(() => r(0), deadline)),
    ]);
    const done = await store.get(d.id);
    const pages = await sources.texts(d.id);
    const body = done?.body ?? "";
    let check = checkReport(body, pages);
    let publish: string[] = [];
    if (kind === "article" && done) {
      // An article quotes the record: checked as Publish checks it.
      const { checkQuotes, draftQuotes } = await import("../write/check.ts");
      const { sourceTexts } = await import("../write/sources.ts");
      const { publishProblems } = await import("../write/publish.ts");
      check = checkQuotes(
        body,
        await sourceTexts(
          c.env,
          draftQuotes(body).map((x) => x.doc),
        ),
      );
      publish = await publishProblems(c.env, c.get("user_id"), done).catch((e) => [String(e)]);
    }
    const kept = await notes.list(d.id);
    const words = body.split(/\s+/).filter(Boolean).length;
    const figures = kind === "research" ? figureProblems(body, pages) : [];
    const cites = kind === "research" ? citationProblems(body) : [];
    const graded = grade({
      kind,
      finished: turns > 0,
      words,
      quotations: check.total,
      notFound: check.failed.length,
      unwritten: kind === "research" ? unwritten(body) : body.trim().length < 400,
      citations: cites.length,
      figuresNotInPages: figures.length,
      repeated: kind === "research" ? repeatedShare(body) : 0,
      pages: pages.length,
      publishProblems: publish,
    });
    clearInterval(beat);
    await out.write(
      enc.encode(
        JSON.stringify({
          model,
          ...(task ? { eval: Number(c.req.query("eval")), label: task.label } : {}),
          kind,
          grade: graded,
          q,
          finished: turns > 0,
          turns,
          seconds: Math.round((Date.now() - t0) / 1000),
          dollars: Math.round((done?.usage.cents ?? 0) * 100) / 10000,
          usage: done?.usage,
          pages_read: pages.map((p) => ({ url: p.url, chars: p.text.length })),
          notes: kept.length,
          report: {
            title: done?.meta.title,
            topic: done?.meta.topic,
            words,
            quotations: check.total,
            not_found: check.failed.map((f) => f.text.slice(0, 160)),
            citations: cites,
            figures_not_in_pages: figures,
            repeated: Math.round(repeatedShare(body) * 1000) / 1000,
            // The reviewers' flags, and how many sentences changed after.
            review: (done?.meta.review ?? []).map((f) => ({
              ...f,
              changed: !body.replace(/\s+/g, " ").includes(f.sentence.replace(/\s+/g, " ").trim()),
            })),
            publish_problems: publish,
            unwritten: unwritten(body),
            ...(full ? { body } : { start: body.slice(0, 2500) }),
          },
          events,
        }),
      ),
    );
    await out.close();
  })();
  c.executionCtx.waitUntil(answer);
  return new Response(readable, { headers: { "content-type": "application/json" } });
});

/** How the workspace's conversations actually behaved, from their stored
 *  messages: model calls per message, tools used and how much each returned,
 *  pages fetched more than once, whole-report rewrites against passage edits,
 *  failed quotation checks. Counts only — no titles, no text.
 *  ?kind=research|article|read (default research)&limit=12. */
app.get("/turns", async (c) => {
  const { d1Drafts } = await import("../write/drafts.ts");
  const store = d1Drafts(c.env, c.get("user_id"));
  const kind = c.req.query("kind") ?? "research";
  const drafts = (await store.list())
    .filter((d) => d.kind === kind)
    .slice(0, Math.min(30, Number(c.req.query("limit")) || 12));
  const out: Array<Record<string, unknown>> = [];
  for (const d of drafts) {
    const msgs = await store.messages(d.id).catch(() => []);
    let said = 0;
    let calls = 0;
    const tools: Record<string, number> = {};
    const resultChars: Record<string, number> = {};
    const names = new Map<string, string>();
    const urls = new Map<string, number>();
    const reports: number[] = [];
    let edits = 0;
    let failedChecks = 0;
    let errors = 0;
    let thinkingBlocks = 0;
    for (const m of msgs) {
      const blocks = (
        typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content
      ) as Array<Record<string, unknown>>;
      if (m.role === "assistant") {
        calls++;
        for (const b of blocks) {
          if (b.type === "thinking") thinkingBlocks++;
          if (b.type === "tool_use" || b.type === "server_tool_use") {
            const name = String(b.name);
            tools[name] = (tools[name] ?? 0) + 1;
            names.set(String(b.id), name);
            const input = (b.input ?? {}) as Record<string, unknown>;
            if (name === "web_fetch" && typeof input.url === "string" && !input.offset)
              urls.set(input.url, (urls.get(input.url) ?? 0) + 1);
            if (name === "write_report" || name === "write_draft")
              reports.push(String(input.body ?? "").length);
            if (name === "edit_draft") edits++;
          }
          if (String(b.type).endsWith("_tool_result")) {
            const name = names.get(String(b.tool_use_id)) ?? String(b.type);
            resultChars[name] = (resultChars[name] ?? 0) + JSON.stringify(b.content ?? "").length;
          }
        }
      } else {
        if (blocks.some((b) => b.type === "text")) said++;
        for (const b of blocks) {
          if (b.type !== "tool_result") continue;
          const name = names.get(String(b.tool_use_id)) ?? "?";
          const text = JSON.stringify(b.content ?? "");
          resultChars[name] = (resultChars[name] ?? 0) + text.length;
          if (b.is_error) errors++;
          if (/NOT FOUND|not word for word|not found word for word/i.test(text)) failedChecks++;
        }
      }
    }
    out.push({
      created: d.createdAt.slice(0, 10),
      engine: d.meta.engine ?? "claude",
      dollars: Math.round(d.usage.cents) / 100,
      messages_from_chris: said,
      model_calls: calls,
      tools,
      result_chars_by_tool: resultChars,
      pages_fetched: urls.size,
      pages_fetched_more_than_once: [...urls.values()].filter((n) => n > 1).length,
      whole_writes: reports.length,
      whole_write_chars: reports,
      passage_edits: edits,
      failed_quote_checks: failedChecks,
      tool_errors: errors,
      thinking_blocks: thinkingBlocks,
    });
  }
  return c.json({ kind, conversations: out });
});

export default app;
