// D1 access — segments + render_jobs CRUD.
//
// Phase 0 reads ONE row: the seeded Carney "It Looks Like Teslas"
// segment from supabase/migrations-video/0002_phase0_spike_seed.sql.
// Phase 1's editorial brain inserts new segments daily.

import type { Segment } from "@canopticon/shared/video/segment-schema";

export interface SegmentRow {
  id: string;
  status: string;
  template: string;
  forensic_turn: string | null;
  needs_human: number;
  payload_json: string;
  created_at: string;
}

export interface RenderJobRow {
  id: string;
  segment_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  started_at: string | null;
  finished_at: string | null;
  r2_key: string | null;
  walltime_ms: number | null;
  est_cost_cents: number | null;
  error: string | null;
  payload_json: string;
}

export async function loadSegment(db: D1Database, id: string): Promise<Segment | null> {
  const row = await db
    .prepare("SELECT payload_json FROM segments WHERE id = ? LIMIT 1")
    .bind(id)
    .first<{ payload_json: string }>();
  if (!row) return null;
  return JSON.parse(row.payload_json) as Segment;
}

export async function loadSegmentRow(db: D1Database, id: string): Promise<SegmentRow | null> {
  return db.prepare("SELECT * FROM segments WHERE id = ? LIMIT 1").bind(id).first<SegmentRow>();
}

/** Insert a freshly-drafted segment from the editorial brain. Lifecycle
 *  starts at 'awaiting_approval' — the operator's /queue/:id review
 *  edits the forensic_turn and flips status to 'approved' (at which
 *  point the renderer fires). `sourceKind` distinguishes the GDELT
 *  news-clip pipeline (default, unchanged) from reading-sourced
 *  essays; `subjectSlug` links a reading-sourced segment back to the
 *  Canopticon File it came from (migration 0006). */
export async function insertDraftedSegment(
  db: D1Database,
  segment: Segment,
  opts: { sourceKind?: "gdelt" | "reading"; subjectSlug?: string } = {},
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO segments (
         id, status, source_rubric_score, template, forensic_turn, needs_human, payload_json, created_at, source_kind, subject_slug
       ) VALUES (?, 'awaiting_approval', ?, ?, ?, 1, ?, ?, ?, ?)`,
    )
    .bind(
      segment.id,
      null,
      segment.template,
      segment.forensic_turn.text,
      JSON.stringify(segment),
      new Date().toISOString(),
      opts.sourceKind ?? "gdelt",
      opts.subjectSlug ?? null,
    )
    .run();
}

/** Operator-approved: update the forensic_turn text, flip needs_human
 *  to 0, flip status to 'approved'. The render is fired by the route
 *  handler immediately after this in waitUntil. */
export async function approveSegment(
  db: D1Database,
  id: string,
  forensicTurn: string,
): Promise<Segment | null> {
  const current = await loadSegment(db, id);
  if (!current) return null;
  const updated: Segment = {
    ...current,
    forensic_turn: {
      ...current.forensic_turn,
      text: forensicTurn,
      needs_human: false,
      approved_at: new Date().toISOString(),
    },
  };
  await db
    .prepare(
      `UPDATE segments
          SET status = 'approved',
              forensic_turn = ?,
              needs_human = 0,
              payload_json = ?
        WHERE id = ?`,
    )
    .bind(forensicTurn, JSON.stringify(updated), id)
    .run();
  return updated;
}

/** Save-draft: update forensic_turn text without approving. Used by
 *  the review page's "Save draft" button so the operator can refine
 *  the line over multiple visits before clicking Approve. */
export async function saveSegmentDraft(
  db: D1Database,
  id: string,
  forensicTurn: string,
): Promise<void> {
  const current = await loadSegment(db, id);
  if (!current) return;
  const updated: Segment = {
    ...current,
    forensic_turn: { ...current.forensic_turn, text: forensicTurn },
  };
  await db
    .prepare("UPDATE segments SET forensic_turn = ?, payload_json = ? WHERE id = ?")
    .bind(forensicTurn, JSON.stringify(updated), id)
    .run();
}

export async function markSegmentRendered(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE segments SET status = 'rendered' WHERE id = ?").bind(id).run();
}

export async function createRenderJob(db: D1Database, segment: Segment): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO render_jobs (id, segment_id, status, started_at, payload_json)
       VALUES (?, ?, 'queued', ?, ?)`,
    )
    .bind(id, segment.id, new Date().toISOString(), JSON.stringify(segment))
    .run();
  return id;
}

export async function markRenderRunning(db: D1Database, jobId: string): Promise<void> {
  await db
    .prepare("UPDATE render_jobs SET status = 'running', started_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), jobId)
    .run();
}

export async function markRenderSucceeded(
  db: D1Database,
  jobId: string,
  args: { r2_key: string; walltime_ms: number; est_cost_cents: number },
): Promise<void> {
  await db
    .prepare(
      `UPDATE render_jobs
          SET status = 'succeeded',
              finished_at = ?,
              r2_key = ?,
              walltime_ms = ?,
              est_cost_cents = ?
        WHERE id = ?`,
    )
    .bind(new Date().toISOString(), args.r2_key, args.walltime_ms, args.est_cost_cents, jobId)
    .run();
}

export async function markRenderFailed(
  db: D1Database,
  jobId: string,
  error: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE render_jobs
          SET status = 'failed', finished_at = ?, error = ?
        WHERE id = ?`,
    )
    .bind(new Date().toISOString(), error.slice(0, 2000), jobId)
    .run();
}

export async function loadJob(db: D1Database, jobId: string): Promise<RenderJobRow | null> {
  return db
    .prepare("SELECT * FROM render_jobs WHERE id = ? LIMIT 1")
    .bind(jobId)
    .first<RenderJobRow>();
}

export async function loadLatestJob(db: D1Database): Promise<RenderJobRow | null> {
  return db
    .prepare("SELECT * FROM render_jobs ORDER BY started_at DESC LIMIT 1")
    .first<RenderJobRow>();
}

/** The most recent render job for ONE segment — used by the review page
 *  to show "already rendered, publish?" instead of the pre-render
 *  editor once a render has actually run for this specific segment.
 *  loadLatestJob above is global (Phase 0's single-spike assumption);
 *  this is per-segment, needed once multiple segments can be in flight
 *  at once (reading-sourced essays alongside the daily GDELT radar). */
export async function loadLatestJobForSegment(
  db: D1Database,
  segmentId: string,
): Promise<RenderJobRow | null> {
  return db
    .prepare("SELECT * FROM render_jobs WHERE segment_id = ? ORDER BY started_at DESC LIMIT 1")
    .bind(segmentId)
    .first<RenderJobRow>();
}

/** Flip a rendered segment to 'published' — the operator has watched
 *  the finished MP4 and decided it's fit to show on canopticon.com's
 *  public /videos section. Deliberately separate from 'rendered':
 *  the operator-approves-never-authors rule applies to the finished
 *  video, not just the drafted script (migration 0006). */
export async function publishSegment(db: D1Database, segmentId: string): Promise<void> {
  await db
    .prepare(
      "UPDATE segments SET status = 'published', published_at = ? WHERE id = ? AND status = 'rendered'",
    )
    .bind(new Date().toISOString(), segmentId)
    .run();
}

export interface PublishedSegmentRow {
  id: string;
  title: string;
  source_kind: string;
  subject_slug: string | null;
  template: string;
  published_at: string;
  length_s: number;
  variant: string;
  r2_key: string | null;
}

/** Public listing — every published segment, newest first, joined to
 *  its succeeded render job for the R2 key the public watch route
 *  serves. Read by packages/api's /videos section across the Worker
 *  boundary (see routes/public.ts). */
export async function listPublishedSegments(
  db: D1Database,
  limit = 50,
): Promise<PublishedSegmentRow[]> {
  const rows = await db
    .prepare(
      `SELECT s.id, s.payload_json, s.source_kind, s.subject_slug, s.template, s.published_at,
              (SELECT r2_key FROM render_jobs WHERE segment_id = s.id AND status = 'succeeded'
                 ORDER BY started_at DESC LIMIT 1) AS r2_key
         FROM segments s
        WHERE s.status = 'published'
        ORDER BY s.published_at DESC
        LIMIT ?`,
    )
    .bind(limit)
    .all<{
      id: string;
      payload_json: string;
      source_kind: string;
      subject_slug: string | null;
      template: string;
      published_at: string;
      r2_key: string | null;
    }>();
  return (rows.results ?? []).map((r) => {
    const payload = JSON.parse(r.payload_json) as Segment;
    return {
      id: r.id,
      title: payload.title,
      source_kind: r.source_kind,
      subject_slug: r.subject_slug,
      template: r.template,
      published_at: r.published_at,
      length_s: payload.length_s,
      variant: payload.variants[0] ?? "1080x1920",
      r2_key: r.r2_key,
    };
  });
}

/** Is the segment whose render produced this R2 key published? Gate
 *  for the public unauthenticated watch route (routes/public.ts) —
 *  never serve an R2 asset publicly unless the operator explicitly
 *  published the segment it belongs to. Keyed by r2_key, not job id,
 *  since that's what the public route actually receives (the key the
 *  public /public/segments listing handed out). */
export async function isKeyPublished(db: D1Database, r2Key: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT s.status AS status FROM render_jobs rj
         JOIN segments s ON s.id = rj.segment_id
        WHERE rj.r2_key = ? AND rj.status = 'succeeded'`,
    )
    .bind(r2Key)
    .first<{ status: string }>();
  return row?.status === "published";
}
