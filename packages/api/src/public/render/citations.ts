// Citations tracker — operator-only view of AI-crawler hits on the
// public site (spec v2.6 Part 14 #10 + the citation-tracker line item
// in Part 18). The hits are already captured by the middleware in
// public/routes.ts; this renderer surfaces them.
//
// The page answers four questions for the operator at a glance:
//   1. Are AI crawlers visiting the site at all (last 30 days)?
//   2. Which bots are visiting most (Google, OpenAI, Claude, Perplexity, …)?
//   3. Which pages get cited (top paths)?
//   4. What's the recent activity (last 50 hits)?
//
// Pure rendering — one SELECT per question, no joins beyond what's
// already there. Operator-only at the route level.

import { all } from "../../lib/d1";
import type { PublicEnv } from "../data";
import { escapeHtml, renderPage } from "../layout";

interface SummaryRow {
  bot: string;
  hits: number;
  days_active: number;
}

interface TopPathRow {
  path: string;
  hits: number;
  bots: number;
}

interface RecentRow {
  path: string;
  bot: string;
  created_at: string;
}

const WINDOW_DAYS = 30;

async function loadSummary(env: PublicEnv): Promise<SummaryRow[]> {
  return all<SummaryRow>(
    env.DB,
    `SELECT bot,
            COUNT(*) AS hits,
            COUNT(DISTINCT substr(created_at, 1, 10)) AS days_active
       FROM citation_hits
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY bot
      ORDER BY hits DESC`,
    [WINDOW_DAYS],
  ).catch(() => []);
}

async function loadTopPaths(env: PublicEnv): Promise<TopPathRow[]> {
  return all<TopPathRow>(
    env.DB,
    `SELECT path,
            COUNT(*) AS hits,
            COUNT(DISTINCT bot) AS bots
       FROM citation_hits
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY path
      ORDER BY hits DESC
      LIMIT 25`,
    [WINDOW_DAYS],
  ).catch(() => []);
}

async function loadRecent(env: PublicEnv): Promise<RecentRow[]> {
  return all<RecentRow>(
    env.DB,
    `SELECT path, bot, created_at
       FROM citation_hits
      ORDER BY created_at DESC
      LIMIT 50`,
  ).catch(() => []);
}

export async function renderCitationsPage(env: PublicEnv): Promise<string> {
  const [summary, topPaths, recent] = await Promise.all([
    loadSummary(env),
    loadTopPaths(env),
    loadRecent(env),
  ]);
  const totalHits = summary.reduce((acc, r) => acc + r.hits, 0);
  const botCount = summary.length;

  const summaryRows = summary.length
    ? summary
        .map(
          (r) =>
            `<tr><td>${escapeHtml(r.bot)}</td><td class="num">${r.hits}</td><td class="num">${r.days_active}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="muted">No bot hits in the last ${WINDOW_DAYS} days yet.</td></tr>`;

  const topPathsRows = topPaths.length
    ? topPaths
        .map(
          (r) =>
            `<tr><td><a href="${escapeHtml(r.path)}">${escapeHtml(r.path)}</a></td><td class="num">${r.hits}</td><td class="num">${r.bots}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="muted">No cited paths in the last ${WINDOW_DAYS} days yet.</td></tr>`;

  const recentRows = recent.length
    ? recent
        .map(
          (r) =>
            `<tr><td class="mono small">${escapeHtml(r.created_at.slice(0, 19))}</td><td>${escapeHtml(r.bot)}</td><td><a href="${escapeHtml(r.path)}">${escapeHtml(r.path)}</a></td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="muted">No bot hits captured yet.</td></tr>`;

  const body = `<section class="cit-section">
  <h1 class="cit-h1">Citations — the AI-crawler ledger</h1>
  <p class="cit-sub">Who's reading you, and what they're reading. Last ${WINDOW_DAYS} days unless noted. Operator-only.</p>

  <div class="cit-stats">
    <div class="cit-stat"><div class="cit-stat-n">${totalHits}</div><div class="cit-stat-k">crawler hits</div></div>
    <div class="cit-stat"><div class="cit-stat-n">${botCount}</div><div class="cit-stat-k">distinct bots</div></div>
    <div class="cit-stat"><div class="cit-stat-n">${topPaths.length}</div><div class="cit-stat-k">paths cited</div></div>
  </div>

  <h2 class="cit-h2">Who's visiting</h2>
  <table class="cit-table">
    <thead><tr><th>Bot</th><th class="num">Hits</th><th class="num">Days active</th></tr></thead>
    <tbody>${summaryRows}</tbody>
  </table>

  <h2 class="cit-h2">Top cited paths</h2>
  <table class="cit-table">
    <thead><tr><th>Path</th><th class="num">Hits</th><th class="num">Distinct bots</th></tr></thead>
    <tbody>${topPathsRows}</tbody>
  </table>

  <h2 class="cit-h2">Recent activity</h2>
  <table class="cit-table">
    <thead><tr><th>When (UTC)</th><th>Bot</th><th>Path</th></tr></thead>
    <tbody>${recentRows}</tbody>
  </table>
</section>
<style>
  .cit-section { max-width: 980px; margin: 24px auto; padding: 0 24px 80px; }
  .cit-h1 { font-family: var(--serif); font-size: 30px; margin: 0 0 6px; color: var(--ink); }
  .cit-h2 { font-family: var(--serif); font-size: 20px; margin: 36px 0 10px; color: var(--ink); }
  .cit-sub { font-family: var(--serif); font-style: italic; font-size: 15px; color: var(--ink-3); margin: 0 0 22px; }
  .cit-stats { display: flex; gap: 18px; margin: 22px 0; }
  .cit-stat { padding: 14px 22px; background: #fff; border: 1px solid #e7e2d6; border-radius: 10px; }
  .cit-stat-n { font-family: var(--serif); font-size: 28px; font-weight: 600; color: var(--ink); }
  .cit-stat-k { font-family: var(--mono); font-size: 11px; color: var(--ink-3); letter-spacing: .04em; margin-top: 2px; }
  .cit-table { width: 100%; border-collapse: collapse; margin-top: 6px; background: #fff; border: 1px solid #e7e2d6; border-radius: 8px; overflow: hidden; }
  .cit-table th { font-family: var(--mono); font-size: 11px; text-align: left; padding: 10px 14px; background: #f6f3ec; color: var(--ink-3); letter-spacing: .04em; border-bottom: 1px solid #e7e2d6; }
  .cit-table td { padding: 9px 14px; font-size: 13.5px; border-bottom: 1px solid #f0ece2; color: var(--ink); }
  .cit-table tr:last-child td { border-bottom: none; }
  .cit-table .num { text-align: right; font-variant-numeric: tabular-nums; font-family: var(--mono); }
  .cit-table .mono { font-family: var(--mono); }
  .cit-table .small { font-size: 12px; }
  .cit-table a { color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--ink-3); }
  .cit-table a:hover { border-bottom-color: var(--ink); }
  .cit-table .muted { color: var(--ink-3); font-style: italic; padding: 24px 14px; text-align: center; }
</style>`;

  return renderPage({
    title: "Citations · canopticon",
    description: "Operator-only view of AI-crawler hits on public pages.",
    body,
    activeNav: "/citations",
  });
}
