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
// each call. BATCH_SIZE and COOLDOWN_MS below are deliberately small; widen
// them only with the actual Brave quota in mind, not the pipeline's
// capacity.

import type { Env } from "../../env";
import { all, insertOne, run } from "../../lib/d1";
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
}

export async function sweepThinSubjects(env: Env, userId: string): Promise<SweepReport> {
  const report: SweepReport = {
    configured: !!env.BRAVE_SEARCH_API_KEY,
    candidates_considered: 0,
    subjects_swept: [],
    errors: [],
  };

  if (!env.BRAVE_SEARCH_API_KEY) return report;

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
            ) AS fact_count
       FROM pages p
       JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ?
        AND (p.auto_expand_at IS NULL OR p.auto_expand_at < ?)
      ORDER BY COALESCE(p.auto_expand_at, '') ASC
      LIMIT 50`,
    [userId, cooldownCutoff],
  ).catch(() => []);

  const thin = rows.filter((r) => r.fact_count < THIN_FACT_THRESHOLD).slice(0, BATCH_SIZE);
  report.candidates_considered = rows.length;
  if (thin.length === 0) return report;

  await emit(env, userId, "autonomous.sweep.started", {
    candidates: rows.length,
    picked: thin.map((t) => t.label),
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
