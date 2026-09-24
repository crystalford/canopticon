// Autonomous expand — RETIRED.
//
// This was the standing-newsroom engine: a cron tick picked the thinnest
// subject (or a due coverage beat) and ran expandRecord on it unattended,
// then wrote up whatever it banked. It is the "make the thing build itself"
// impulse CLAUDE.md says stalled the project twice, the cron that drove it is
// off (standing rule 4), and it is being unmounted.
//
// It also depended on expandRecord banking `pieces`: a beat's expand stored
// piece ids in coverage_beats.last_banked_piece_ids for synthesizeDueBeatReport
// to read back. expandRecord now banks `sources` only (record-builder.ts,
// migration 0059), so there are no piece ids to store, and rather than teach
// a retired sweep a new column, sweepThinSubjects() below refuses to run.
// /v1/admin/auto-expand's catch turns that into an autonomous.sweep.failed
// event, which is the honest outcome.
//
// pickThinCandidates() is kept live: the operator's manual "expand thinnest
// N" bulk action (operator/routes.ts) still ranks candidates with it.

import type { Env } from "../../env";
import { all } from "../../lib/d1";

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // don't re-sweep a subject inside 24h
const THIN_FACT_THRESHOLD = 5; // mirrors subject-page.ts's isThin
const CANDIDATE_POOL = 50; // bound the ranking query; re-ranked by edge_degree below

export interface SweepReport {
  configured: boolean;
  candidates_considered: number;
  subjects_swept: string[];
  errors: string[];
}

interface ThinCandidate {
  page_id: string;
  node_id: string;
  label: string;
  fact_count: number;
  edge_degree: number;
  has_lead: number;
}

/** Retired — see the file header. Throws so the one remaining caller
 *  (/v1/admin/auto-expand, itself dormant) records a stated failure instead
 *  of a sweep that silently did nothing. */
export async function sweepThinSubjects(_env: Env, _userId: string): Promise<SweepReport> {
  throw new Error(
    "autonomous expand is retired: fetched pages are banked as sources, not pieces, and nothing runs unattended (standing rule 4)",
  );
}

// Exported so the operator's manual "expand thinnest N" bulk action
// (operator/routes.ts) ranks candidates with the exact same sniper logic
// as the autonomous sweep, instead of a second, potentially-diverging
// copy of this query.
export async function pickThinCandidates(
  env: Env,
  userId: string,
  limit: number,
): Promise<ThinCandidate[]> {
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const rows = await all<ThinCandidate>(
    env.DB,
    `SELECT p.id AS page_id, n.id AS node_id, n.label AS label,
            (SELECT COUNT(*) FROM nodes f
              WHERE f.user_id = p.user_id AND f.kind IN ('neutral_fact','event','assertion')
                AND EXISTS (
                  SELECT 1 FROM edges e
                   WHERE e.user_id = p.user_id AND e.family = 'aboutness'
                     AND e.src_node_id = f.id AND e.dst_node_id = n.id
                )
            ) AS fact_count,
            (SELECT COUNT(*) FROM edges e2
              WHERE e2.user_id = p.user_id
                AND (e2.src_node_id = n.id OR e2.dst_node_id = n.id)
            ) AS edge_degree,
            -- Self-generated lead: this subject is what an unresolved
            -- contradiction or cross-document connection the system
            -- already surfaced (surfacing.ts, patterns.primary_node_id)
            -- is ABOUT. Newsroom phase 4 — a finding doesn't just sit on
            -- the homepage waiting to be clicked, it can outrank a purely
            -- edge_degree-ranked candidate for the sweep's one slot.
            (SELECT COUNT(*) FROM patterns pt
              WHERE pt.user_id = p.user_id AND pt.status = 'candidate'
                AND pt.primary_node_id = n.id
            ) AS has_lead
       FROM pages p
       JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ?
        AND (p.auto_expand_at IS NULL OR p.auto_expand_at < ?)
      ORDER BY COALESCE(p.auto_expand_at, '') ASC
      LIMIT ${CANDIDATE_POOL}`,
    [userId, cooldownCutoff],
  ).catch(() => []);

  return rows
    .filter((r) => r.fact_count < THIN_FACT_THRESHOLD)
    .sort(
      (a, b) =>
        (b.has_lead > 0 ? 1 : 0) - (a.has_lead > 0 ? 1 : 0) || b.edge_degree - a.edge_degree,
    )
    .slice(0, limit);
}
