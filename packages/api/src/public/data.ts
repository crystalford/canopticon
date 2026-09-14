// Public-site data access. Reads the new PROBE-shaped tables (pieces,
// topics, entities, patterns, ...) from D1 and shapes them for the
// renderers. Every query is scoped to the operator (single-tenant:
// the public site shows the one operator's published record).
//
// Surfaces only published/canonical pieces — working-material passes
// (chain interior) never get a public page (spec §2.6). The one
// exception is the Library, which lists working-material too (it's the
// raw research layer) but marks it as such.

import { all, one, parseJson } from "../lib/d1";

export interface PublicEnv {
  DB: D1Database;
  /** The video Worker's URL — render/videos.ts fetches its public
   *  segments API cross-Worker. Optional; the page shows an honest
   *  empty state without it. */
  VIDEO_BASE?: string;
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
export async function listLibrary(
  db: D1Database,
  userId: string,
): Promise<Array<PieceSummary & { metadata: string }>> {
  // metadata comes along so the operator's own view can surface the essay
  // lint notes stored at upload time (operator/routes.ts createAndExtract).
  return all<PieceSummary & { metadata: string }>(
    db,
    `SELECT id, slug, title, subtitle, kind, subtype, publication_status,
            byline, published_at, signed_by, metadata
       FROM pieces WHERE user_id = ?
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

export const ESSAY_KINDS = ["essay"] as const;
export const RESEARCH_KINDS = ["research-report", "documented-record"] as const;

// An index row carries enough to render a list entry without loading the
// body: `body_chars` is LENGTH(body_md), which is all a read-time estimate
// needs and is far cheaper than selecting every document's full text.
export interface IndexPiece extends PieceSummary {
  body_chars: number;
  updated_at: string;
}

export function readMinutes(bodyChars: number): number {
  return Math.max(1, Math.round(bodyChars / 5 / 220));
}

async function listPiecesOfKind(
  db: D1Database,
  userId: string,
  kinds: readonly string[],
): Promise<IndexPiece[]> {
  const placeholders = kinds.map(() => "?").join(",");
  return all<IndexPiece>(
    db,
    `SELECT id, slug, title, subtitle, kind, subtype, publication_status,
            byline, published_at, signed_by, updated_at,
            LENGTH(body_md) AS body_chars
       FROM pieces
      WHERE user_id = ? AND publication_status IN ('published','canonical')
        AND kind IN (${placeholders})
      ORDER BY COALESCE(published_at, created_at) DESC`,
    [userId, ...kinds],
  );
}

export async function listEssays(db: D1Database, userId: string): Promise<IndexPiece[]> {
  return listPiecesOfKind(db, userId, ESSAY_KINDS);
}

export async function listResearch(db: D1Database, userId: string): Promise<IndexPiece[]> {
  return listPiecesOfKind(db, userId, RESEARCH_KINDS);
}

export interface PublishedPieceRef {
  slug: string;
  title: string;
  subtitle: string | null;
  kind: string;
  updated_at: string;
  published_at: string | null;
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
    `SELECT slug, title, subtitle, kind, updated_at, published_at
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
         AND publication_status IN ('published','canonical')
         AND kind IN ('research-report','documented-record')`,
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
export { parseJson };
