// Autonomous expand — the standing-newsroom engine (spec: "beats" step 1).
//
// expandRecord() (record-builder.ts) already does the real work: Brave
// Search -> fetch real pages -> extract verbatim quotes through the same
// firewall as an uploaded document. Until now it only ever fired when the
// operator clicked "Expand this file" on one subject. This module is the
// autonomous trigger: a cron tick picks a small, budget-capped batch of
// the thinnest subjects that haven't been swept recently and runs
// expandRecord on each of them, unattended.
//
// Budget discipline matters here specifically because it spends a metered,
// rate-limited third-party API (Brave Search) without a human initiating
// each call, and because Workers AI inference + D1 time inside each sweep
// are themselves billed — this is real spend, not a free background task.
// BATCH_SIZE, COOLDOWN_MS, and the cron cadence in wrangler.toml are all
// deliberately conservative; widen them only against actual observed cost,
// not the pipeline's raw capacity.
//
// Sniper, not shotgun: candidates aren't picked by staleness alone. Each
// thin candidate's edge_degree (how many edges in the typed graph already
// touch it — mentions, relationships, causal links) is a cheap proxy for
// "how much the corpus already cares about this." A subject with a high
// edge_degree but few verified facts is exactly the gap worth spending a
// real search+fetch+extract on: the corpus keeps bringing it up, but
// nothing has gone and gotten the receipts yet. A subject nobody links to
// is just thin, not urgent, so it waits. Subjects flagged as a self-
// generated lead (the target of a contradiction or connection the system
// already surfaced — see has_lead below) outrank pure edge_degree: the
// system isn't just noticing a gap, it's noticing a gap it already has a
// specific reason to care about.

import type { Env } from "../../env";
import { all, insertOne, run } from "../../lib/d1";
import { synthesizeDueBeatReport } from "./deep-research";
import { expandRecord } from "./record-builder";

// One subject per tick, deliberately. expandRecord() already runs one full
// search+fetch+extract sequence close to the platform's execution ceiling
// (record-builder.ts's own comment: "~30-60s fits comfortably in waitUntil"
// for a SINGLE subject) — chaining a second one in the same waitUntil call
// is exactly the pattern that silently killed the multi-step resettle
// endpoint earlier. Throughput comes from cron frequency, not batch size.
const BATCH_SIZE = 1; // subjects expanded per sweep tick
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // don't re-sweep a subject inside 24h
const THIN_FACT_THRESHOLD = 5; // mirrors subject-page.ts's isThin
const CANDIDATE_POOL = 50; // bound the ranking query; re-ranked by edge_degree below

// Beats (operator-declared standing coverage areas) get first refusal on
// the sweep's one slot per tick — they're an explicit priority, not a
// detected gap, so they don't need to compete on edge_degree. A 3-day
// cooldown keeps any one beat from monopolising the shared slot away from
// genuine thin-subject gap-filling. Crucially: beats do NOT add a new cron
// trigger or extra Brave spend — they only change what the existing slot
// picks.
const BEAT_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

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

interface DueBeat {
  id: string;
  label: string;
}

export async function sweepThinSubjects(env: Env, userId: string): Promise<SweepReport> {
  const report: SweepReport = {
    configured: !!env.BRAVE_SEARCH_API_KEY,
    candidates_considered: 0,
    subjects_swept: [],
    errors: [],
  };

  if (!env.BRAVE_SEARCH_API_KEY) return report;

  // Finishing a beat's research (writing up what its last expand banked)
  // gets first refusal on the tick, ahead of even starting a new expand —
  // it's one bounded LLM call against already-fetched text, no new Brave
  // spend, and it's "pending work" rather than "more work." Mutually
  // exclusive with everything below: one bounded unit per tick, same
  // budget as always.
  const synthesis = await synthesizeDueBeatReport(env, userId).catch(
    (err) => ({ synthesized: false, reason: (err as Error).message }) as const,
  );
  if (synthesis.synthesized) {
    report.subjects_swept.push(`${synthesis.beatLabel} (research brief)`);
    return report;
  }

  const beat = await pickDueBeat(env, userId);
  if (beat) {
    await emit(env, userId, "autonomous.sweep.started", {
      source: "beat",
      picked: [{ label: beat.label }],
    });
    try {
      await run(env.DB, "UPDATE coverage_beats SET last_swept_at = ? WHERE id = ?", [
        new Date().toISOString(),
        beat.id,
      ]);
      const expandReport = await expandRecord(env, userId, beat.label);
      await run(env.DB, "UPDATE coverage_beats SET last_banked_piece_ids = ? WHERE id = ?", [
        JSON.stringify(expandReport.banked_piece_ids),
        beat.id,
      ]);
      report.subjects_swept.push(beat.label);
    } catch (err) {
      report.errors.push(`${beat.label}: ${(err as Error).message}`);
    }
    await emit(env, userId, "autonomous.sweep.completed", {
      swept: report.subjects_swept,
      errors: report.errors,
    });
    return report;
  }

  const rows = await pickThinCandidates(env, userId, CANDIDATE_POOL);
  const thin = rows.slice(0, BATCH_SIZE);
  report.candidates_considered = rows.length;
  if (thin.length === 0) return report;

  await emit(env, userId, "autonomous.sweep.started", {
    candidates: rows.length,
    picked: thin.map((t) => ({
      label: t.label,
      edge_degree: t.edge_degree,
      self_generated_lead: t.has_lead > 0,
    })),
  });

  for (const candidate of thin) {
    try {
      await run(env.DB, "UPDATE pages SET auto_expand_at = ? WHERE id = ?", [
        new Date().toISOString(),
        candidate.page_id,
      ]);
      await expandRecord(env, userId, candidate.label);
      report.subjects_swept.push(candidate.label);
    } catch (err) {
      report.errors.push(`${candidate.label}: ${(err as Error).message}`);
    }
  }

  await emit(env, userId, "autonomous.sweep.completed", {
    swept: report.subjects_swept,
    errors: report.errors,
  });

  return report;
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

async function pickDueBeat(env: Env, userId: string): Promise<DueBeat | null> {
  const cutoff = new Date(Date.now() - BEAT_COOLDOWN_MS).toISOString();
  const rows = await all<DueBeat>(
    env.DB,
    `SELECT id, label FROM coverage_beats
      WHERE user_id = ? AND (last_swept_at IS NULL OR last_swept_at < ?)
      ORDER BY COALESCE(last_swept_at, '') ASC
      LIMIT 1`,
    [userId, cutoff],
  ).catch(() => []);
  return rows[0] ?? null;
}

async function emit(
  env: Env,
  userId: string,
  event_type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type,
    subject_kind: "sweep",
    subject_id: null,
    payload,
  }).catch(() => {});
}
