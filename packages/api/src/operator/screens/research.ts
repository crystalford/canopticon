// The on-demand research screen (2026-07-26) — its own page, not a query
// param bolted onto /search. Before this, "Research this" landed on the
// search results page with ?researching=1, which read as broken: a live
// search box + "no matches" copy + a progress card stapled underneath,
// as if the two features were the same thing. They aren't — searching
// the existing record and researching something NEW are different
// actions with different shapes. This gives the second one a page that
// looks like what it is: a standing research instrument, not a search
// miss.

import { escapeHtml } from "../../public/layout";
import { renderLiveStatusBanner } from "../../public/render/status-banner";
import { renderOpPage } from "../layout";

export function renderResearchScreen(args: { label: string; angle?: string | undefined }): string {
  const { label, angle } = args;
  const pollUrl = `/op/research-status?q=${encodeURIComponent(label)}`;
  const banner = renderLiveStatusBanner(pollUrl, `Starting research on ${label}…`);
  const title = label.length > 64 ? `${label.slice(0, 61)}…` : label;

  const body = `
<div class="research-head">
  <div class="research-kicker">On-demand research</div>
  <h2 class="research-label">${escapeHtml(label)}</h2>
  ${angle ? `<p class="research-angle">Angle: &ldquo;${escapeHtml(angle)}&rdquo;</p>` : ""}
</div>
<p class="research-explain">
  Searching the web, banking whatever real sources it finds, and drafting a
  brief from them — word-for-word, nothing invented. Nothing here enters
  the record until you read the draft and publish it yourself. Same rule
  as everywhere else: the operator approves, never authors.
</p>
${banner}
<style>
  .research-head { margin-bottom: 4px; }
  .research-kicker {
    font-family: var(--mono); font-size: 11px; letter-spacing: .07em;
    text-transform: uppercase; color: var(--ink-3); margin-bottom: 10px;
  }
  .research-label {
    font-family: var(--serif); font-size: 30px; line-height: 1.22;
    color: var(--ink); margin: 0 0 6px; max-width: 720px; font-weight: 500;
  }
  .research-angle { font-family: var(--mono); font-size: 12.5px; color: var(--ink-3); margin: 0; }
  .research-explain {
    font-family: var(--serif); font-size: 15px; line-height: 1.6;
    color: var(--ink-2); max-width: 600px; margin: 16px 0 26px;
  }
</style>`;

  return renderOpPage({
    title,
    sub: "researching · not yet in the record",
    body,
    activeNav: "/",
  });
}
