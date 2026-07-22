// The ingest orchestrator — what POST /refresh runs.
//
// For each source: fetch → snapshot raw bytes to R2 (content-hash dedup)
// → log to update_log → upsert the typed fact rows, each carrying its
// snapshot key. Then compute the Invisibility Index for the latest year
// all three methods can be aligned, and upsert it. Every step is
// idempotent: a second refresh with unchanged sources changes nothing
// but the last-checked timestamps.

import { INDEX_PARAMS } from "../content/capitalization-factors.ts";
import type { Env } from "../env.ts";
import { fetchNBSA } from "../sources/nbsa.ts";
import { fetchPBO } from "../sources/pbo.ts";
import { HOUSEHOLD_NET_WORTH_CAD, fetchDHEA, fetchSFS } from "../sources/statcan.ts";
import { computeInvisibilityIndex } from "./index-calc.ts";
import { putSnapshot } from "./snapshots.ts";
import type { Method, SourceReading, TopTailPoint } from "./types.ts";

export interface IngestSummary {
  sources: number;
  snapshotsNew: number;
  periods: number;
  indexComputed: boolean;
  errors: string[];
}

function componentFor(method: Method): { component: string; scope: string } {
  return method === "capitalization"
    ? { component: "financial_assets", scope: "financial_assets" }
    : { component: "net_worth_household", scope: "net_worth" };
}

async function log(
  env: Env,
  source: string,
  action: string,
  result: string,
  key: string | null,
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO update_log (id, source, action, result, snapshot_r2_key) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), source, action, result, key)
    .run();
}

async function upsertPeriod(env: Env, periodId: string, year: number, quarter: number | null) {
  await env.DB.prepare(
    `INSERT INTO period (id, year, quarter, label) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  )
    .bind(periodId, year, quarter, String(year))
    .run();
}

async function writeTopTail(env: Env, p: TopTailPoint, snapKey: string): Promise<void> {
  const { component, scope } = componentFor(p.method);
  await upsertPeriod(env, p.periodId, p.year, null);

  await env.DB.prepare(
    `INSERT INTO wealth_share
       (id, period_id, category_id, component_id, method, scope, value, source_url, snapshot_r2_key)
     VALUES (?, ?, 'top_1pct', ?, ?, ?, ?, ?, ?)
     ON CONFLICT(period_id, category_id, component_id, method, scope) DO UPDATE SET
       value = excluded.value,
       source_url = excluded.source_url,
       snapshot_r2_key = excluded.snapshot_r2_key,
       ingested_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
  )
    .bind(
      `${p.method}:${scope}:top_1pct:${p.periodId}`,
      p.periodId,
      component,
      p.method,
      scope,
      p.share,
      p.sourceUrl,
      snapKey,
    )
    .run();

  await env.DB.prepare(
    `INSERT INTO top_tail_series
       (id, period_id, method, percentile, share, threshold_cad, family_count, scope, source_url, snapshot_r2_key)
     VALUES (?, ?, ?, 0.99, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(period_id, method, percentile, scope) DO UPDATE SET
       share = excluded.share,
       threshold_cad = excluded.threshold_cad,
       family_count = excluded.family_count,
       source_url = excluded.source_url,
       snapshot_r2_key = excluded.snapshot_r2_key,
       ingested_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
  )
    .bind(
      `${p.method}:0.99:${scope}:${p.periodId}`,
      p.periodId,
      p.method,
      p.share,
      p.thresholdCad ?? null,
      p.familyCount ?? null,
      scope,
      p.sourceUrl,
      snapKey,
    )
    .run();
}

async function ingestReading(env: Env, reading: SourceReading): Promise<boolean> {
  const snap = await putSnapshot(env, reading.sourceId, reading.raw, reading.contentType);
  await log(
    env,
    reading.sourceId,
    "fetched",
    reading.fromFallback ? "documented fallback" : "live",
    snap.key,
  );
  await log(
    env,
    reading.sourceId,
    snap.isNew ? "snapshot_new" : "snapshot_same",
    snap.sha,
    snap.key,
  );

  for (const p of reading.topTail) await writeTopTail(env, p, snap.key);

  for (const f of reading.flows) {
    await upsertPeriod(env, f.periodId, f.year, null);
    await env.DB.prepare(
      `INSERT INTO nbsa_flows (id, period_id, indicator_code, label, value, source_url, snapshot_r2_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(period_id, indicator_code) DO UPDATE SET
         value = excluded.value, label = excluded.label,
         source_url = excluded.source_url, snapshot_r2_key = excluded.snapshot_r2_key,
         ingested_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    )
      .bind(
        `${f.indicatorCode}:${f.periodId}`,
        f.periodId,
        f.indicatorCode,
        f.label,
        f.value,
        f.sourceUrl,
        snap.key,
      )
      .run();
  }

  await log(
    env,
    reading.sourceId,
    "ingested",
    `${reading.topTail.length + reading.flows.length} facts`,
    snap.key,
  );
  return snap.isNew;
}

/** Pick the latest year for which all three methods reported, and compute
 *  + upsert the Invisibility Index there. Returns true if computed. */
async function computeAndStoreIndex(env: Env, readings: SourceReading[]): Promise<boolean> {
  const byMethod: Record<Method, Map<number, TopTailPoint>> = {
    survey: new Map(),
    pareto: new Map(),
    capitalization: new Map(),
  };
  for (const r of readings) for (const p of r.topTail) byMethod[p.method].set(p.year, p);

  const alignedYears = [...byMethod.survey.keys()]
    .filter((y) => byMethod.pareto.has(y) && byMethod.capitalization.has(y))
    .sort((a, b) => b - a);
  const year = alignedYears[0];
  if (year === undefined) return false;

  const surveyShare = byMethod.survey.get(year)?.share ?? 0;
  const paretoShare = byMethod.pareto.get(year)?.share ?? 0;
  const capShare = byMethod.capitalization.get(year)?.share ?? 0;
  const totalHouseholdWealthCad =
    HOUSEHOLD_NET_WORTH_CAD[year] ?? HOUSEHOLD_NET_WORTH_CAD[2023] ?? 0;

  const idx = computeInvisibilityIndex({
    surveyShare,
    paretoShare,
    capShare,
    totalHouseholdWealthCad,
    params: INDEX_PARAMS,
  });

  await upsertPeriod(env, String(year), year, null);
  await env.DB.prepare(
    `INSERT INTO invisibility_index
       (period_id, total_gap_cad, ch_unrealized_cad, ch_private_equity_cad,
        ch_offshore_cad, ch_nonresponse_cad, recovery_ratio)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(period_id) DO UPDATE SET
       total_gap_cad = excluded.total_gap_cad,
       ch_unrealized_cad = excluded.ch_unrealized_cad,
       ch_private_equity_cad = excluded.ch_private_equity_cad,
       ch_offshore_cad = excluded.ch_offshore_cad,
       ch_nonresponse_cad = excluded.ch_nonresponse_cad,
       recovery_ratio = excluded.recovery_ratio,
       computed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
  )
    .bind(
      String(year),
      idx.total_gap_cad,
      idx.ch_unrealized_cad,
      idx.ch_private_equity_cad,
      idx.ch_offshore_cad,
      idx.ch_nonresponse_cad,
      idx.recovery_ratio,
    )
    .run();
  return true;
}

export async function runIngest(env: Env): Promise<IngestSummary> {
  const summary: IngestSummary = {
    sources: 0,
    snapshotsNew: 0,
    periods: 0,
    indexComputed: false,
    errors: [],
  };

  const readings: SourceReading[] = [];
  const fetchers: Array<[string, () => Promise<SourceReading>]> = [
    ["sfs", fetchSFS],
    ["dhea", fetchDHEA],
    ["pbo-hnw", () => fetchPBO(env)],
    ["nbsa", fetchNBSA],
  ];

  for (const [id, fn] of fetchers) {
    try {
      const reading = await fn();
      const isNew = await ingestReading(env, reading);
      readings.push(reading);
      summary.sources += 1;
      if (isNew) summary.snapshotsNew += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${id}: ${msg}`);
      try {
        await log(env, id, "failed", msg, null);
      } catch {
        // logging failure is non-fatal
      }
    }
  }

  try {
    summary.indexComputed = await computeAndStoreIndex(env, readings);
  } catch (err) {
    summary.errors.push(`index: ${err instanceof Error ? err.message : String(err)}`);
  }

  return summary;
}
