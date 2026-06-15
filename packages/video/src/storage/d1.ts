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
 *  point the renderer fires). */
export async function insertDraftedSegment(db: D1Database, segment: Segment): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO segments (
         id, status, source_rubric_score, template, forensic_turn, needs_human, payload_json, created_at
       ) VALUES (?, 'awaiting_approval', ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      segment.id,
      null,
      segment.template,
      segment.forensic_turn.text,
      JSON.stringify(segment),
      new Date().toISOString(),
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
