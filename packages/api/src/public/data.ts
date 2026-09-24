// Public-site data access. Reads the new PROBE-shaped tables (pieces,
// topics, entities, patterns, ...) from D1 and shapes them for the
// renderers. Every query is scoped to the operator (single-tenant:
// the public site shows the one operator's published record).
//
// Surfaces only published/canonical pieces — working-material passes
// (chain interior) never get a public page (spec §2.6). The one
// exception is the Library, which lists working-material too (it's the
// raw research layer) but marks it as such.

import { TOPICS, type Topic } from "../graph/lib/topics";
import { WEB_FETCHED_SQL } from "../lib/corpus-guards";
import { all, one, parseJson } from "../lib/d1";

export interface PublicEnv {
  DB: D1Database;
  /** The video Worker's URL — render/videos.ts fetches its public
   *  segments API cross-Worker. Optional; the page shows an honest
   *  empty state without it. */
  VIDEO_BASE?: string;
  /** Which model reads for the record — see llm/router.ts modelInUse(). */
  AI_GATEWAY_ID?: string;
  CLAUDE_MODEL?: string;
  /** R2, for the share card a document page names only once it exists. */
  FILES?: R2Bucket;
}

// The public site is single-operator. Resolve "the operator" as the
// first (and only) user row. Cached per request via the caller.
export async function resolveOperatorId(db: D1Database): Promise<string | null> {
  const row = await one<{ id: string }>(db, "SELECT id FROM users ORDER BY created_at LIMIT 1", []);
  return row?.id ?? null;
}

// ---- Topics ---------------------------------------------------------------

export interface TopicRow {
  id: string;
  slug: string;
  label: string;
  overview_md: string;
  overview_html: string | null;
  signed_by: string | null;
}

export async function listTopics(db: D1Database, userId: string): Promise<TopicRow[]> {
  return all<TopicRow>(
    db,
    `SELECT id, slug, label, overview_md, overview_html, signed_by
       FROM topics WHERE user_id = ? ORDER BY sort_order, label`,
    [userId],
  );
}

export async function getTopic(
  db: D1Database,
  userId: string,
  slug: string,
): Promise<TopicRow | null> {
  return one<TopicRow>(
    db,
    `SELECT id, slug, label, overview_md, overview_html, signed_by
       FROM topics WHERE user_id = ? AND slug = ?`,
    [userId, slug],
  );
}

// Reports/pieces that map to a topic, newest first. Used on the topic
// hub. No 6-link cap — the anti-thinness fix from the audit.
export async function piecesForTopic(
  db: D1Database,
  userId: string,
  topicId: string,
): Promise<PieceSummary[]> {
  return all<PieceSummary>(
    db,
    `SELECT p.id, p.slug, p.title, p.subtitle, p.kind, p.subtype,
            p.publication_status, p.byline, p.published_at, p.signed_by
       FROM topic_pieces tp
       JOIN pieces p ON p.id = tp.piece_id
      WHERE tp.user_id = ? AND tp.topic_id = ?
        AND p.publication_status IN ('published','canonical')
      ORDER BY tp.sort_order, p.published_at DESC`,
    [userId, topicId],
  );
}

export async function entitiesForTopic(
  db: D1Database,
  userId: string,
  topicId: string,
): Promise<EntitySummary[]> {
  return all<EntitySummary>(
    db,
    `SELECT e.id, e.canonical_name, e.public_slug, e.kind, e.entity_type,
            e.current_role, e.heat_score
       FROM topic_entities te
       JOIN entities e ON e.id = te.entity_id
      WHERE te.user_id = ? AND te.topic_id = ?
      ORDER BY te.sort_order, e.heat_score DESC`,
    [userId, topicId],
  );
}

// ---- Pieces / investigations ---------------------------------------------

export interface PieceSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  kind: string;
  subtype: string | null;
  publication_status: string;
  byline: string | null;
  published_at: string | null;
  signed_by: string | null;
}

export interface PieceDetail extends PieceSummary {
  body_md: string;
  body_html: string | null;
  chain_id: string | null;
  tags: string;
  metadata: string;
  argument_summary_md: string | null;
  created_at: string;
  updated_at: string;
}

// Investigations index: published + canonical pieces of the editorial
// kinds (not raw library working-material). Newest first.
export async function listInvestigations(db: D1Database, userId: string): Promise<PieceSummary[]> {
  return all<PieceSummary>(
    db,
    `SELECT id, slug, title, subtitle, kind, subtype, publication_status,
            byline, published_at, signed_by
       FROM pieces
      WHERE user_id = ? AND publication_status IN ('published','canonical')
      ORDER BY published_at DESC, updated_at DESC`,
    [userId],
  );
}

export async function getPieceBySlug(
  db: D1Database,
  userId: string,
  slug: string,
): Promise<PieceDetail | null> {
  return one<PieceDetail>(
    db,
    `SELECT id, slug, title, subtitle, kind, subtype, publication_status,
            byline, published_at, signed_by, body_md, body_html, chain_id,
            tags, metadata, argument_summary_md, created_at, updated_at
       FROM pieces WHERE user_id = ? AND slug = ?`,
    [userId, slug],
  );
}

// Library: every piece including working-material, with a status tag so
// the raw research layer is honest about what's a finished publication
// vs an interior chain pass.
export type LibraryRow = PieceSummary & {
  metadata: string;
  original_title?: string | null;
  title_auto_at?: string | null;
};

export async function listLibrary(
  db: D1Database,
  userId: string,
  opts: { includeUnpublished?: boolean } = {},
): Promise<Array<LibraryRow>> {
  // metadata comes along so the operator's own view can surface the essay
  // lint notes stored at upload time (operator/routes.ts createAndExtract).
  // original_title / title_auto_at say whether the pipeline renamed the row
  // (graph/lib/processing.ts stepTitle), so /library can offer the revert.
  //
  // WORKING-MATERIAL IS OPERATOR-ONLY. This had no status filter at all, so
  // every unpublished draft was listed by title to anyone who opened /library
  // — while its /p/<slug> correctly 404'd. That is the worst shape: the page
  // is withheld and its existence is not. It also silently undid unpublishing
  // anything, which is the mechanism this codebase uses instead of deleting.
  const visibility = opts.includeUnpublished
    ? ""
    : " AND publication_status IN ('published','canonical')";
  // NOTHING WEB-FETCHED. The research pipeline's crawler used to bank every
  // page it fetched as a pieces row, and this listing showed all of them —
  // brainly.com answers and a Cloudflare bot-challenge page titled "Just a
  // moment...", each labelled "research report". The crawler writes `sources`
  // only now (graph/lib/record-builder.ts); this guard keeps any row it left
  // behind out of the operator's view until the purge removes it.
  return all<LibraryRow>(
    db,
    `SELECT id, slug, title, subtitle, kind, subtype, publication_status,
            byline, published_at, signed_by, metadata, original_title, title_auto_at
       FROM pieces WHERE user_id = ?${visibility}
        AND NOT ${WEB_FETCHED_SQL}
      ORDER BY COALESCE(published_at, created_at) DESC`,
    [userId],
  );
}

// ---- The two public doors -------------------------------------------------
//
// Essays and Research are the whole publication now. Both read `pieces`;
// the only difference is `kind`. Uploads land as 'research-report' (see
// operator/routes.ts createAndExtract); 'essay' is set when an uploaded
// .md matches the essay convention.
//
// Only published/canonical surface here, so a working-material row never
// reaches an index or the sitemap.

// Research is defined as "not an essay", not as an allow-list of two kinds.
//
// An allow-list of research-report + documented-record silently orphaned the
// other four published kinds the schema permits (thesis, synthesis, brief,
// note): they appeared in the sitemap, llms.txt and the feed — all of which
// treat every non-essay kind as research — and their own pages said
// "Research" in the nav and breadcrumb, but no index anywhere linked to them.
// The seed corpus contains a canonical thesis, so this was not hypothetical.
export const ESSAY_KINDS = ["essay"] as const;

// An index row carries enough to render a list entry without loading the
// body: `body_chars` is LENGTH(body_md), which is all a read-time estimate
// needs and is far cheaper than selecting every document's full text.
export interface IndexPiece extends PieceSummary {
  body_chars: number;
  updated_at: string;
  /** Model-assigned at authoring time and frozen (migration 0055). Null means
   *  ungrouped, which is a real state — see graph/lib/topics.ts. */
  topic: string | null;
  /** The first 400 characters of body_md — enough for displayTitle() to
   *  recover a real heading when the stored title is a raw filename, without
   *  pulling every document's full text into an index query. */
  body_head: string | null;
}

export function readMinutes(bodyChars: number): number {
  return Math.max(1, Math.round(bodyChars / 5 / 220));
}

async function listPiecesByKind(
  db: D1Database,
  userId: string,
  match: "essay" | "not-essay",
): Promise<IndexPiece[]> {
  const placeholders = ESSAY_KINDS.map(() => "?").join(",");
  return all<IndexPiece>(
    db,
    `SELECT id, slug, title, subtitle, kind, subtype, publication_status,
            byline, published_at, signed_by, updated_at, topic,
            LENGTH(body_md) AS body_chars, SUBSTR(body_md, 1, 400) AS body_head
       FROM pieces
      WHERE user_id = ? AND publication_status IN ('published','canonical')
        AND kind ${match === "essay" ? "IN" : "NOT IN"} (${placeholders})
      ORDER BY COALESCE(published_at, created_at) DESC`,
    [userId, ...ESSAY_KINDS],
  );
}

export async function listEssays(db: D1Database, userId: string): Promise<IndexPiece[]> {
  return listPiecesByKind(db, userId, "essay");
}

export async function listResearch(db: D1Database, userId: string): Promise<IndexPiece[]> {
  return listPiecesByKind(db, userId, "not-essay");
}

export interface PublishedPieceRef {
  slug: string;
  title: string;
  subtitle: string | null;
  kind: string;
  updated_at: string;
  published_at: string | null;
  body_head: string | null;
}

// Every publicly-visible piece, for the sitemap, llms.txt and the feed.
// One query behind all three so those three can never disagree about what
// is published.
export async function listPublishedPieces(
  db: D1Database,
  userId: string,
): Promise<PublishedPieceRef[]> {
  return all<PublishedPieceRef>(
    db,
    `SELECT slug, title, subtitle, kind, updated_at, published_at,
            SUBSTR(body_md, 1, 400) AS body_head
       FROM pieces
      WHERE user_id = ? AND publication_status IN ('published','canonical')
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT 5000`,
    [userId],
  );
}

// Counts for the homepage state strip.
export async function publicationCounts(
  db: D1Database,
  userId: string,
): Promise<{ essays: number; research: number; sources: number; lastPublished: string | null }> {
  const [essays, research, sources, last] = await Promise.all([
    one<{ n: number }>(
      db,
      `SELECT COUNT(*) AS n FROM pieces WHERE user_id = ?
         AND publication_status IN ('published','canonical') AND kind = 'essay'`,
      [userId],
    ),
    one<{ n: number }>(
      db,
      `SELECT COUNT(*) AS n FROM pieces WHERE user_id = ?
         AND publication_status IN ('published','canonical') AND kind <> 'essay'`,
      [userId],
    ),
    one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM sources WHERE user_id = ?", [userId]).catch(
      () => ({ n: 0 }),
    ),
    one<{ d: string | null }>(
      db,
      `SELECT MAX(COALESCE(published_at, created_at)) AS d FROM pieces
        WHERE user_id = ? AND publication_status IN ('published','canonical')`,
      [userId],
    ),
  ]);
  return {
    essays: essays?.n ?? 0,
    research: research?.n ?? 0,
    sources: sources?.n ?? 0,
    lastPublished: last?.d ? last.d.slice(0, 10) : null,
  };
}

// Topics a piece belongs to — for the piece page's "filed under" line.
export async function topicsForPiece(
  db: D1Database,
  userId: string,
  pieceId: string,
): Promise<Array<{ slug: string; label: string }>> {
  return all<{ slug: string; label: string }>(
    db,
    `SELECT t.slug, t.label
       FROM topic_pieces tp JOIN topics t ON t.id = tp.topic_id
      WHERE tp.user_id = ? AND tp.piece_id = ?
      ORDER BY t.sort_order, t.label`,
    [userId, pieceId],
  );
}

// ---- Entities / the record -----------------------------------------------

export interface EntitySummary {
  id: string;
  canonical_name: string;
  public_slug: string | null;
  kind: string | null;
  entity_type: string;
  current_role: string | null;
  heat_score: number;
}

export interface EntityDetail extends EntitySummary {
  bio_md: string | null;
  bio_html: string | null;
  description: string | null;
  metadata: string;
}

// The record index, grouped by kind, most-developed first.
export async function listEntities(db: D1Database, userId: string): Promise<EntitySummary[]> {
  return all<EntitySummary>(
    db,
    `SELECT id, canonical_name, public_slug, kind, entity_type, current_role, heat_score
       FROM entities WHERE user_id = ?
      ORDER BY heat_score DESC, canonical_name`,
    [userId],
  );
}

export async function getEntityBySlug(
  db: D1Database,
  userId: string,
  slug: string,
): Promise<EntityDetail | null> {
  return one<EntityDetail>(
    db,
    `SELECT id, canonical_name, public_slug, kind, entity_type, current_role,
            heat_score, bio_md, bio_html, description, metadata
       FROM entities WHERE user_id = ? AND public_slug = ?`,
    [userId, slug],
  );
}

// Pieces that mention an entity (via claim → claim_entities → entity).
// For the entity page's "appears in" footprint.
export async function piecesMentioningEntity(
  db: D1Database,
  userId: string,
  entityId: string,
): Promise<PieceSummary[]> {
  return all<PieceSummary>(
    db,
    `SELECT DISTINCT p.id, p.slug, p.title, p.subtitle, p.kind, p.subtype,
            p.publication_status, p.byline, p.published_at, p.signed_by
       FROM claim_entities ce
       JOIN claims c ON c.id = ce.claim_id
       JOIN pieces p ON p.id = c.asserted_in_piece_id
      WHERE ce.user_id = ? AND ce.entity_id = ?
        AND p.publication_status IN ('published','canonical')
      ORDER BY p.published_at DESC`,
    [userId, entityId],
  );
}

// ---- Patterns / lighthouse -----------------------------------------------

export interface PatternSummary {
  id: string;
  slug: string;
  kind: string;
  title: string;
  statement_md: string;
  confidence: string;
  signed_by: string | null;
  signed_at: string | null;
}

// Only signed patterns reach the public site (spec §6.5: candidates
// live in the operator's Leads queue, never auto-published).
export async function listSignedPatterns(
  db: D1Database,
  userId: string,
): Promise<PatternSummary[]> {
  return all<PatternSummary>(
    db,
    `SELECT id, slug, kind, title, statement_md, confidence, signed_by, signed_at
       FROM patterns WHERE user_id = ? AND status = 'signed'
      ORDER BY signed_at DESC`,
    [userId],
  );
}

// Helper: how many distinct topics exist, for the anti-orphan render
// check on the library page.
export async function countOrphanPieces(db: D1Database, userId: string): Promise<number> {
  const row = await one<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM pieces p
      WHERE p.user_id = ? AND p.publication_status IN ('published','canonical')
        AND NOT EXISTS (SELECT 1 FROM topic_pieces tp WHERE tp.piece_id = p.id)`,
    [userId],
  );
  return row?.n ?? 0;
}

// ---- Pattern detail / gaps / timeline ------------------------------------

export interface PatternDetail extends PatternSummary {
  disconfirming_md: string;
  notes_md: string | null;
  date_range_from: string | null;
  date_range_to: string | null;
}

export async function getPatternBySlug(
  db: D1Database,
  userId: string,
  slug: string,
): Promise<PatternDetail | null> {
  return one<PatternDetail>(
    db,
    `SELECT id, slug, kind, title, statement_md, confidence, signed_by, signed_at,
            disconfirming_md, notes_md, date_range_from, date_range_to
       FROM patterns WHERE user_id = ? AND slug = ? AND status = 'signed'`,
    [userId, slug],
  );
}

export async function piecesForPattern(
  db: D1Database,
  userId: string,
  patternId: string,
): Promise<PieceSummary[]> {
  return all<PieceSummary>(
    db,
    `SELECT p.id, p.slug, p.title, p.subtitle, p.kind, p.subtype,
            p.publication_status, p.byline, p.published_at, p.signed_by
       FROM pattern_pieces pp
       JOIN pieces p ON p.id = pp.piece_id
      WHERE pp.user_id = ? AND pp.pattern_id = ?
      ORDER BY p.published_at DESC`,
    [userId, patternId],
  );
}

export interface GapRow {
  id: string;
  slug: string;
  title: string;
  subject_kind: string;
  subject_id: string | null;
  what_we_have_md: string;
  what_we_lack_md: string;
  suggested_next_step_md: string;
  signed_by: string | null;
  status: string;
}

export async function listGaps(db: D1Database, userId: string): Promise<GapRow[]> {
  return all<GapRow>(
    db,
    `SELECT id, slug, title, subject_kind, subject_id, what_we_have_md,
            what_we_lack_md, suggested_next_step_md, signed_by, status
       FROM gaps WHERE user_id = ? AND status IN ('open','partially-filled')
      ORDER BY updated_at DESC`,
    [userId],
  );
}

export interface TimelineEventRow {
  id: string;
  event_date: string;
  title: string;
  body_md: string | null;
  related_piece_ids: string;
  related_entity_ids: string;
  significance: string;
}

export async function listTimelineEvents(
  db: D1Database,
  userId: string,
): Promise<TimelineEventRow[]> {
  return all<TimelineEventRow>(
    db,
    `SELECT id, event_date, title, body_md, related_piece_ids, related_entity_ids, significance
       FROM timeline_events WHERE user_id = ? ORDER BY event_date DESC`,
    [userId],
  );
}

// Re-export parseJson so renderers can decode tags without importing d1.
// ---- lineage (docs/the-record.md §5) --------------------------------------

export interface LineageRef {
  slug: string;
  title: string;
  /** The question, lead or contradiction, verbatim, that started the child. */
  origin: string | null;
}

export interface Lineage {
  parent: LineageRef | null;
  children: LineageRef[];
}

/**
 * What a document grew from and what grew out of it. `pieces.parent_piece_id`
 * has no foreign key (0027 precedent), so a parent that was purged simply
 * reads as none. Only published relatives are shown: a working-material child
 * is not a public page and must not be linked as one.
 */
export async function lineageForPiece(
  db: D1Database,
  userId: string,
  pieceId: string,
): Promise<Lineage> {
  const parent = await one<LineageRef>(
    db,
    `SELECT parent.slug AS slug, parent.title AS title, child.origin AS origin
       FROM pieces child
       JOIN pieces parent ON parent.id = child.parent_piece_id
      WHERE child.id = ? AND child.user_id = ? AND parent.user_id = ?
        AND parent.publication_status IN ('published','canonical')`,
    [pieceId, userId, userId],
  );
  const children = await all<LineageRef>(
    db,
    `SELECT slug, title, origin
       FROM pieces
      WHERE user_id = ? AND parent_piece_id = ?
        AND publication_status IN ('published','canonical')
      ORDER BY published_at DESC, updated_at DESC`,
    [userId, pieceId],
  );
  return { parent: parent ?? null, children };
}

// ---- related by subject ------------------------------------------------------

/** Below this a label is a bare surname or an acronym (crosslinks.ts agrees). */
const RELATED_MIN_LABEL_CHARS = 8;

/**
 * The other published documents that share the most subjects with this one.
 *
 * A subject is an entity or theme node label the typed graph filed under both
 * documents — a query, not a model call, so it is free, deterministic and
 * current the moment a document extracts. Ordered by how many labels are
 * shared, then by recency. When the query finds nothing (the document has no
 * nodes yet, or shares none), the list falls back to the most recent
 * documents — "related by date" said honestly as a fallback, not a default.
 */
export async function relatedBySubject(
  db: D1Database,
  userId: string,
  pieceId: string,
  limit = 4,
): Promise<PieceSummary[]> {
  const shared = await all<PieceSummary & { shared: number }>(
    db,
    `WITH mine AS (
       SELECT DISTINCT label FROM nodes
        WHERE user_id = ? AND piece_id = ? AND kind IN ('entity','theme')
          AND LENGTH(label) >= ?
     )
     SELECT p.id, p.slug, p.title, p.subtitle, p.kind, p.subtype, p.publication_status,
            p.byline, p.published_at, p.signed_by, COUNT(DISTINCT n.label) AS shared
       FROM nodes n
       JOIN mine ON mine.label = n.label
       JOIN pieces p ON p.id = n.piece_id
      WHERE n.user_id = ? AND n.piece_id IS NOT NULL AND n.piece_id != ?
        AND n.kind IN ('entity','theme')
        AND p.user_id = ? AND p.publication_status IN ('published','canonical')
      GROUP BY p.id
      ORDER BY shared DESC, p.published_at DESC, p.updated_at DESC
      LIMIT ?`,
    [userId, pieceId, RELATED_MIN_LABEL_CHARS, userId, pieceId, userId, limit],
  );
  if (shared.length > 0) return shared.map(({ shared: _n, ...p }) => p);
  const recent = await listInvestigations(db, userId);
  return recent.filter((r) => r.id !== pieceId).slice(0, limit);
}

export { parseJson };

// ---- section hubs (docs/the-record.md §6: /research/<section>) -------------

/** "Politics & government" → "politics-government". Deterministic, so a hub
 *  URL is derived from the closed list and never stored. */
export function topicSlug(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The closed section a hub slug names, or null: an unknown slug is a 404,
 *  never a guessed section. */
export function topicFromSlug(slug: string): Topic | null {
  return TOPICS.find((t) => topicSlug(t) === slug) ?? null;
}

/** Two lines per section — plain, factual, written once. */
export const TOPIC_DESCRIPTIONS: Record<Topic, string> = {
  "Politics & government":
    "Elections, parties, legislatures and the public bodies that answer to them. Polling, procedure and the record of what was decided.",
  "Media & information":
    "How news, platforms and attention work, and what they do to the people who use them. Media theory and the measurement of it.",
  "Public health":
    "Illness, drugs, care and the systems that deliver or fail to deliver it. Figures with a named source and a date, kept whole.",
  "Housing & cities":
    "Homes, rents, land, zoning and the cities they make. Supply, prices and who is priced out.",
  "Money & markets":
    "Banks, budgets, prices, trade and the instruments that move them. Carbon finance sits here too.",
  "Climate & energy":
    "Emissions, grids, fuels and the policy built around them. What is measured and what is promised.",
  "Technology & systems":
    "Software, platforms, models and the infrastructure under them. How systems behave and what they are for.",
  "Method & measurement":
    "How research is done: sampling, polling method, statistics and the ways a number can mislead.",
};

/** A piece's frozen section (migration 0055), or null when ungrouped. */
export async function topicForPiece(
  db: D1Database,
  userId: string,
  pieceId: string,
): Promise<string | null> {
  const row = await one<{ topic: string | null }>(
    db,
    "SELECT topic FROM pieces WHERE id = ? AND user_id = ?",
    [pieceId, userId],
  );
  return row?.topic?.trim() || null;
}

/** Everything published, with its full body — for /llms-full.txt. Same
 *  predicate as listPublishedPieces so the two cannot disagree. */
export async function listPublishedPiecesFull(
  db: D1Database,
  userId: string,
): Promise<PieceDetail[]> {
  return all<PieceDetail>(
    db,
    `SELECT id, slug, title, subtitle, kind, subtype, publication_status,
            byline, published_at, signed_by, body_md, body_html, chain_id,
            tags, metadata, argument_summary_md, created_at, updated_at
       FROM pieces
      WHERE user_id = ? AND publication_status IN ('published','canonical')
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT 5000`,
    [userId],
  );
}
