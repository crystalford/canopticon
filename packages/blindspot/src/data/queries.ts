// Read-side queries for the pages. Pure D1 reads; the charts and the
// sources page consume these. Every function tolerates an empty database
// (returns [] / null) so the instrument renders its "no data yet" state
// before the first refresh.

import type { Env } from "../env.ts";

export interface SpreadRow {
  year: number;
  survey: number | null;
  pareto: number | null;
  capitalization: number | null;
}

/** The three-method top-1% share series, one row per year. */
export async function getSpreadSeries(env: Env): Promise<SpreadRow[]> {
  const res = await env.DB.prepare(
    `SELECT p.year AS year, t.method AS method, t.share AS share
       FROM top_tail_series t JOIN period p ON p.id = t.period_id
      WHERE t.percentile = 0.99
      ORDER BY p.year ASC`,
  ).all<{ year: number; method: string; share: number }>();

  const byYear = new Map<number, SpreadRow>();
  for (const r of res.results ?? []) {
    const row =
      byYear.get(r.year) ??
      ({ year: r.year, survey: null, pareto: null, capitalization: null } as SpreadRow);
    if (r.method === "survey") row.survey = r.share;
    else if (r.method === "pareto") row.pareto = r.share;
    else if (r.method === "capitalization") row.capitalization = r.share;
    byYear.set(r.year, row);
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

export interface IndexRow {
  year: number;
  total_gap_cad: number;
  ch_unrealized_cad: number;
  ch_private_equity_cad: number;
  ch_offshore_cad: number;
  ch_nonresponse_cad: number;
  recovery_ratio: number | null;
}

/** The most recent computed Invisibility Index, or null if none. */
export async function getLatestIndex(env: Env): Promise<IndexRow | null> {
  const row = await env.DB.prepare(
    `SELECT p.year AS year, i.total_gap_cad, i.ch_unrealized_cad, i.ch_private_equity_cad,
            i.ch_offshore_cad, i.ch_nonresponse_cad, i.recovery_ratio
       FROM invisibility_index i JOIN period p ON p.id = i.period_id
      ORDER BY p.year DESC LIMIT 1`,
  ).first<IndexRow>();
  return row ?? null;
}

export interface BehaviorRow {
  year: number;
  finNonfin: number | null;
  debtDti: number | null;
}

/** The behavior-strip series (financial/non-financial ratio + DTI). */
export async function getBehaviorSeries(env: Env): Promise<BehaviorRow[]> {
  const res = await env.DB.prepare(
    `SELECT p.year AS year, f.indicator_code AS code, f.value AS value
       FROM nbsa_flows f JOIN period p ON p.id = f.period_id
      ORDER BY p.year ASC`,
  ).all<{ year: number; code: string; value: number }>();

  const byYear = new Map<number, BehaviorRow>();
  for (const r of res.results ?? []) {
    const row = byYear.get(r.year) ?? { year: r.year, finNonfin: null, debtDti: null };
    if (r.code === "fin_nonfin_ratio") row.finNonfin = r.value;
    else if (r.code === "debt_to_disposable_income") row.debtDti = r.value;
    byYear.set(r.year, row);
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

export interface ThresholdRow {
  year: number;
  thresholdCad: number;
  familyCount: number | null;
}

/** The latest Pareto top-1% threshold + family count (for Where You Stand). */
export async function getLatestThreshold(env: Env): Promise<ThresholdRow | null> {
  const row = await env.DB.prepare(
    `SELECT p.year AS year, t.threshold_cad AS thresholdCad, t.family_count AS familyCount
       FROM top_tail_series t JOIN period p ON p.id = t.period_id
      WHERE t.method = 'pareto' AND t.threshold_cad IS NOT NULL
      ORDER BY p.year DESC LIMIT 1`,
  ).first<ThresholdRow>();
  return row ?? null;
}

/** Last-fetched timestamp per source id (for the sources page). */
export async function getLastFetchedBySource(env: Env): Promise<Record<string, string>> {
  const res = await env.DB.prepare(
    `SELECT source, MAX(ts) AS ts FROM update_log
      WHERE action IN ('fetched','ingested') GROUP BY source`,
  ).all<{ source: string; ts: string }>();
  const out: Record<string, string> = {};
  for (const r of res.results ?? []) out[r.source] = r.ts;
  return out;
}

/** Whether any facts have been ingested yet. */
export async function hasData(env: Env): Promise<boolean> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM wealth_share").first<{ n: number }>();
  return (row?.n ?? 0) > 0;
}
