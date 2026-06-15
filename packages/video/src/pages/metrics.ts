// /metrics — render-cost dashboard. Aggregates over render_jobs so
// the operator can see total spend, average walltime, success rate,
// and per-day burn at a glance.

import { escapeHtml, htmlPage } from "./shell";

export interface MetricsRow {
  total_renders: number;
  succeeded: number;
  failed: number;
  total_cost_cents: number;
  avg_walltime_ms: number;
  avg_cost_cents: number;
  most_recent_at: string | null;
}

export interface DailyRow {
  day: string;
  renders: number;
  cost_cents: number;
  walltime_ms: number;
}

export async function loadMetrics(db: D1Database): Promise<MetricsRow> {
  const r = await db
    .prepare(
      `SELECT
         COUNT(*) AS total_renders,
         SUM(CASE WHEN status='succeeded' THEN 1 ELSE 0 END) AS succeeded,
         SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
         COALESCE(SUM(est_cost_cents), 0) AS total_cost_cents,
         COALESCE(AVG(walltime_ms), 0) AS avg_walltime_ms,
         COALESCE(AVG(est_cost_cents), 0) AS avg_cost_cents,
         MAX(started_at) AS most_recent_at
       FROM render_jobs`,
    )
    .first<MetricsRow>();
  return (
    r ?? {
      total_renders: 0,
      succeeded: 0,
      failed: 0,
      total_cost_cents: 0,
      avg_walltime_ms: 0,
      avg_cost_cents: 0,
      most_recent_at: null,
    }
  );
}

export async function loadDailyMetrics(db: D1Database, days = 30): Promise<DailyRow[]> {
  const r = await db
    .prepare(
      `SELECT
         substr(started_at, 1, 10) AS day,
         COUNT(*) AS renders,
         COALESCE(SUM(est_cost_cents), 0) AS cost_cents,
         COALESCE(SUM(walltime_ms), 0) AS walltime_ms
       FROM render_jobs
       WHERE started_at >= datetime('now', '-' || ? || ' days')
       GROUP BY day
       ORDER BY day DESC`,
    )
    .bind(days)
    .all<DailyRow>();
  return r.results ?? [];
}

export function renderMetricsPage(args: { metrics: MetricsRow; daily: DailyRow[] }): Response {
  const { metrics, daily } = args;
  const totalUsd = (metrics.total_cost_cents / 100).toFixed(2);
  const avgUsd = (metrics.avg_cost_cents / 100).toFixed(3);
  const avgSec = (metrics.avg_walltime_ms / 1000).toFixed(1);
  const successRate =
    metrics.total_renders > 0
      ? ((metrics.succeeded / metrics.total_renders) * 100).toFixed(0)
      : "—";

  const dailyRows = daily.length
    ? daily
        .map(
          (d) => `<tr>
  <td class="mono small">${escapeHtml(d.day)}</td>
  <td class="num">${d.renders}</td>
  <td class="num">$${(d.cost_cents / 100).toFixed(3)}</td>
  <td class="num">${(d.walltime_ms / 1000).toFixed(0)}s</td>
</tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="empty" style="padding:14px;text-align:center;font-style:italic">No renders in the last 30 days.</td></tr>`;

  const body = `
  <div class="h1">Render metrics — spend &amp; reliability</div>
  <div class="sub">phase 1b cockpit · ${metrics.total_renders} renders · ${metrics.succeeded} succeeded · ${metrics.failed} failed</div>

  <div class="row" style="gap:14px;margin-bottom:18px;flex-wrap:wrap">
    <div class="card" style="flex:1;min-width:160px">
      <div class="k">total spend</div>
      <div class="v num" style="font-size:32px">$${totalUsd}</div>
    </div>
    <div class="card" style="flex:1;min-width:160px">
      <div class="k">avg / render</div>
      <div class="v num" style="font-size:32px">$${avgUsd}</div>
    </div>
    <div class="card" style="flex:1;min-width:160px">
      <div class="k">avg walltime</div>
      <div class="v num" style="font-size:32px">${avgSec}s</div>
    </div>
    <div class="card" style="flex:1;min-width:160px">
      <div class="k">success rate</div>
      <div class="v num" style="font-size:32px">${successRate}%</div>
    </div>
  </div>

  <div class="card" style="padding:0;overflow:hidden">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f6f3ec">
          <th style="text-align:left;padding:12px 16px;font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.04em">day</th>
          <th style="text-align:right;padding:12px 16px;font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.04em">renders</th>
          <th style="text-align:right;padding:12px 16px;font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.04em">cost</th>
          <th style="text-align:right;padding:12px 16px;font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.04em">walltime</th>
        </tr>
      </thead>
      <tbody>${dailyRows}</tbody>
    </table>
  </div>

  <div class="card" style="margin-top:18px">
    <div class="k">phase 0 budget gates</div>
    <div style="font-family:var(--serif);font-size:14px;line-height:1.65;margin-top:6px">
      Per the spec, a Phase 0 render passes when walltime ≤ 5 min (warm) /
      8 min (cold) and cost ≤ $0.10. Current averages are <b>${avgSec}s</b> and
      <b>$${avgUsd}</b>. If either drifts past those gates consistently,
      the architecture shifts to an external GPU renderer (Remotion Lambda
      or Cloud Run) with the §7b JSON contract unchanged.
    </div>
  </div>
`;
  return htmlPage({ title: "Metrics", body });
}

const _classMonoSmall = "mono small"; // satisfy lint about unused tags
void _classMonoSmall;
