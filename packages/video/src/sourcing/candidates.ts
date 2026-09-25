// candidates table — READ-ONLY HISTORY as of the GDELT-pipeline cut
// (see CLAUDE.md's "Two other Workers exist" section and
// docs/archive/canopticon-renovation.md). This table stops receiving new rows:
// the discovery/scoring/casting pipeline that used to write here
// (sourcing/gdelt.ts, sourcing/brave.ts, editorial/rubric.ts) has been
// removed as a fully separate "what's newsworthy" engine with no
// connection to the typed graph. Kept only so already-promoted
// candidates and their segments remain reviewable — routes/queue.ts's
// GET / and GET /:id still read through here.

/** Shape a historical candidate row was written in — same fields the
 *  now-removed GDELT/Brave clients + rubric scorer produced. Kept here
 *  (not re-imported from the deleted sourcing/gdelt.ts) purely so
 *  CandidateRow still type-checks against rows already in D1. */
export interface Candidate {
  id: string;
  network: string;
  clip_url: string;
  captured_at: string;
  headline: string;
  excerpt: string;
  entities: string[];
  source: "gdelt" | "brave" | "rss" | "stub";
}

/** Per-axis rubric scores a historical row's rubric_json deserialises
 *  to — kept for pages/queue.ts's read-only display, same reason as
 *  Candidate above. */
export interface RubricScores {
  forensic_potential: number;
  visual_evidence: number;
  recency: number;
  canadian_lane: number;
  counter_voice: number;
  legibility: number;
}

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
