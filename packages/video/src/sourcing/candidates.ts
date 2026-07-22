// candidates table — daily story-of-the-day candidates from GDELT,
// scored by the editorial rubric, ready for the operator to promote
// into a segment.
//
// Phase 1's daily cron upserts candidates here (one row per clip). The
// rubric scorer fills in the score columns. The /queue page reads from
// this table and the segments table together.

import type { Candidate } from "./gdelt";

export interface CandidateRow extends Candidate {
  /** Total rubric score (0–30 sum across six 0–5 axes). */
  rubric_score: number | null;
  /** Per-axis scores, JSON-serialised. */
  rubric_json: string | null;
  /** The template the caster picked — "claim_vs_ground" | "buried_number" | "reversal" */
  cast_template: string | null;
  /** Status: discovered → scored → cast → promoted → rejected */
  status: string;
  created_at: string;
}

/** Upsert a candidate (idempotent on id). Status starts at "discovered". */
export async function upsertCandidate(db: D1Database, c: Candidate): Promise<void> {
  await db
    .prepare(
      `INSERT INTO candidates (
         id, network, clip_url, captured_at, headline, excerpt, entities_json,
         source, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'discovered', ?)
       ON CONFLICT(id) DO UPDATE SET
         headline = excluded.headline,
         excerpt = excluded.excerpt,
         entities_json = excluded.entities_json`,
    )
    .bind(
      c.id,
      c.network,
      c.clip_url,
      c.captured_at,
      c.headline,
      c.excerpt,
      JSON.stringify(c.entities),
      c.source,
      new Date().toISOString(),
    )
    .run();
}

export async function recordRubric(
  db: D1Database,
  id: string,
  score: number,
  rubricJson: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE candidates SET rubric_score = ?, rubric_json = ?, status = 'scored'
        WHERE id = ?`,
    )
    .bind(score, rubricJson, id)
    .run();
}

export async function recordTemplate(db: D1Database, id: string, template: string): Promise<void> {
  await db
    .prepare("UPDATE candidates SET cast_template = ?, status = 'cast' WHERE id = ?")
    .bind(template, id)
    .run();
}

export async function markPromoted(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE candidates SET status = 'promoted' WHERE id = ?").bind(id).run();
}

export async function listRecent(
  db: D1Database,
  windowHours = 48,
  limit = 40,
): Promise<CandidateRow[]> {
  const rs = await db
    .prepare(
      `SELECT id, network, clip_url, captured_at, headline, excerpt, entities_json,
              source, rubric_score, rubric_json, cast_template, status, created_at
         FROM candidates
        WHERE created_at >= datetime('now', '-' || ? || ' hours')
        ORDER BY rubric_score DESC NULLS LAST, captured_at DESC
        LIMIT ?`,
    )
    .bind(windowHours, limit)
    .all<{
      id: string;
      network: string;
      clip_url: string;
      captured_at: string;
      headline: string;
      excerpt: string;
      entities_json: string | null;
      source: string;
      rubric_score: number | null;
      rubric_json: string | null;
      cast_template: string | null;
      status: string;
      created_at: string;
    }>();
  return (rs.results ?? []).map((r) => ({
    id: r.id,
    network: r.network,
    clip_url: r.clip_url,
    captured_at: r.captured_at,
    headline: r.headline,
    excerpt: r.excerpt,
    entities: r.entities_json ? (JSON.parse(r.entities_json) as string[]) : [],
    source: r.source as Candidate["source"],
    rubric_score: r.rubric_score,
    rubric_json: r.rubric_json,
    cast_template: r.cast_template,
    status: r.status,
    created_at: r.created_at,
  }));
}

export async function loadCandidate(db: D1Database, id: string): Promise<CandidateRow | null> {
  const rows = await listRecent(db, 24 * 30, 1000);
  return rows.find((r) => r.id === id) ?? null;
}
