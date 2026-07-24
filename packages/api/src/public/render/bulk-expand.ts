// "Expand the thinnest subjects now" result page — task #25's bulk
// action, task #24's "what grew" summary. Operator-only: the trigger
// itself is an operator POST (operator/routes.ts), this page just shows
// what came of it. Reuses subject-page.ts's renderExpandBanner per
// subject — each one now polls its own live status client-side
// (status-banner.ts), so this page no longer meta-refreshes itself: doing
// both would just reset every banner's in-flight poller every 5s, the
// exact double-refresh jank the client-side poller was built to remove.
// The aggregate "what grew" total below is a snapshot as of page load; a
// manual reload picks up the final tally once every banner reports done.

import type { Env } from "../../env";
import { getExpandStatus } from "../../graph/lib/record-builder";
import { escapeHtml, renderPage } from "../layout";
import { renderExpandBanner } from "./subject-page";

export async function renderBulkExpandResult(
  env: Env,
  userId: string,
  subjects: string[],
): Promise<string> {
  const banners = subjects.map((s) => renderExpandBanner(s));

  // "What grew" — sum real fact counts across every subject in this batch
  // whose run has reached a terminal state (search+bank done AND queued
  // extraction has actually landed or failed — see getExpandStatus).
  // Subjects still in flight simply don't contribute yet — a snapshot as
  // of this render, not live (see the file comment above).
  let totalFactsAdded = 0;
  let completedCount = 0;
  for (const subject of subjects) {
    const status = await getExpandStatus(env, userId, subject).catch(() => null);
    if (status?.terminal) {
      completedCount++;
      totalFactsAdded += status.factsAdded;
    }
  }

  const allDone = completedCount === subjects.length;
  const summary = allDone
    ? `<div class="bulk-summary bulk-summary-done">Done — <b>${totalFactsAdded}</b> new fact${totalFactsAdded === 1 ? "" : "s"} across ${subjects.length} subject${subjects.length === 1 ? "" : "s"}.</div>`
    : `<div class="bulk-summary">Expanding ${subjects.length} subjects — ${completedCount} of ${subjects.length} done so far.</div>`;

  const body = `
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
