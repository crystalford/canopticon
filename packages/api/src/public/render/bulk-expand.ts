// "Expand the thinnest subjects now" result page — task #25's bulk
// action, task #24's "what grew" summary. Operator-only: the trigger
// itself is an operator POST (operator/routes.ts), this page just shows
// what came of it. Reuses subject-page.ts's renderExpandBanner per
// subject (same live per-subject narration the single-subject expand
// banner already uses) plus a running total once every subject reports
// completion — no new progress machinery, just composing what exists.

import type { Env } from "../../env";
import { all } from "../../lib/d1";
import { escapeHtml, renderPage } from "../layout";
import { renderExpandBanner } from "./subject-page";

interface CompletedEvent {
  payload: string;
}

export async function renderBulkExpandResult(
  env: Env,
  userId: string,
  subjects: string[],
): Promise<string> {
  const banners = await Promise.all(subjects.map((s) => renderExpandBanner(env, userId, s)));

  // "What grew" — sum facts_added across every subject in this batch that
  // has already reported a record.expand.completed event. Subjects still
  // in flight simply don't contribute yet; the page auto-refreshes (via
  // renderExpandBanner's own meta-refresh convention below) until they do.
  let totalFactsAdded = 0;
  let completedCount = 0;
  for (const subject of subjects) {
    const completed = await all<CompletedEvent>(
      env.DB,
      `SELECT payload FROM orchestrator_events
        WHERE user_id = ? AND event_type = 'record.expand.completed'
          AND json_extract(payload, '$.subject') = ?
          AND created_at > datetime('now','-15 minutes')
        ORDER BY created_at DESC LIMIT 1`,
      [userId, subject],
    ).catch(() => []);
    const row = completed[0];
    if (row) {
      completedCount++;
      try {
        const payload = JSON.parse(row.payload) as { facts_added?: number };
        totalFactsAdded += payload.facts_added ?? 0;
      } catch {
        // malformed payload — skip, don't let it break the total
      }
    }
  }

  const allDone = completedCount === subjects.length;
  const summary = allDone
    ? `<div class="bulk-summary bulk-summary-done">Done — <b>${totalFactsAdded}</b> new fact${totalFactsAdded === 1 ? "" : "s"} across ${subjects.length} subject${subjects.length === 1 ? "" : "s"}.</div>`
    : `<div class="bulk-summary">Expanding ${subjects.length} subjects — ${completedCount} of ${subjects.length} done so far.</div>`;

  const body = `${allDone ? "" : '<meta http-equiv="refresh" content="5">'}
<section class="bulk-section">
  <h1 class="bulk-h1">Expanding the thinnest subjects</h1>
  ${summary}
  <div class="bulk-list">${banners.join("")}</div>
  <p class="bulk-back"><a href="/">← Back to the record</a></p>
</section>
<style>
  .bulk-section { max-width: 760px; margin: 32px auto; padding: 0 24px 80px; }
  .bulk-h1 { font-family: var(--serif); font-size: 26px; margin: 0 0 14px; color: var(--ink); }
  .bulk-summary { font-family: var(--mono); font-size: 13px; color: var(--ink-3); margin-bottom: 20px; }
  .bulk-summary-done { color: var(--confirmed, #2f7d52); }
  .bulk-summary b { color: var(--ink); }
  .bulk-list > * + * { margin-top: 14px; }
  .bulk-back { margin-top: 24px; font-family: var(--mono); font-size: 12.5px; }
  .bulk-back a { color: var(--accent); text-decoration: none; }
</style>`;

  return renderPage({
    title: `Expanding ${subjects.length} subjects · canopticon`,
    description: "Bulk-expanding the thinnest subjects in the record.",
    body,
  });
}

export function renderBulkExpandEmpty(): string {
  return renderPage({
    title: "Nothing to expand · canopticon",
    description: "No thin subjects were eligible for expansion right now.",
    body: `<section class="bulk-section">
  <h1 class="bulk-h1">Nothing to expand right now</h1>
  <p>${escapeHtml("Every subject either has enough facts on file already, or was expanded too recently to try again.")}</p>
  <p class="bulk-back"><a href="/">← Back to the record</a></p>
</section>
<style>
  .bulk-section { max-width: 760px; margin: 32px auto; padding: 0 24px 80px; font-family: var(--serif); color: var(--ink-2); }
  .bulk-h1 { font-family: var(--serif); font-size: 26px; margin: 0 0 14px; color: var(--ink); }
  .bulk-back { margin-top: 24px; font-family: var(--mono); font-size: 12.5px; }
  .bulk-back a { color: var(--accent); text-decoration: none; }
</style>`,
  });
}
