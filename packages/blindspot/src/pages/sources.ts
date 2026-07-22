// pages/sources.ts — the source catalog at /sources. Renders SOURCES
// grouped into official statistics (the series the instrument pulls and
// snapshots) and academic grounding (what justifies the four channels).
// Each official source carries a last-fetched slot; Commit 4's ingest
// fills it from update_log. Until then it reads "not yet fetched".

import { SOURCES, type Source } from "../sources/registry.ts";
import { escapeAttr, escapeHtml, renderShell } from "./shell.ts";

const SOURCES_CSS = `
.bs-sources-wrap { max-width: 1120px; margin: 0 auto; padding: clamp(40px,6vw,72px) clamp(18px,5vw,48px); }
.bs-sources-head { max-width: var(--reading); margin-bottom: 40px; }
.bs-sources-h1 { font-family: var(--serif); font-weight: 500; font-size: clamp(34px,5.4vw,52px); letter-spacing: -0.025em; line-height: 1.02; margin: 14px 0 18px; max-width: 20ch; }
.bs-sources-standfirst { font-family: var(--serif); font-size: 19px; line-height: 1.5; color: var(--ink-3); max-width: 52ch; }
.bs-source-group { margin-bottom: 40px; }
.bs-source-group > .bs-label { padding-bottom: 9px; border-bottom: 1px solid var(--rule); margin-bottom: 4px; }
.bs-source { padding: 22px 0; border-bottom: 1px solid var(--rule-soft); scroll-margin-top: 84px; }
.bs-source-top { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.bs-source-name { font-family: var(--sans); font-weight: 600; font-size: 18px; letter-spacing: -0.01em; color: var(--ink); }
.bs-source-name a { color: inherit; border-bottom: 1px solid var(--accent-bd); }
.bs-source-pub { font-family: var(--mono); font-size: 11.5px; color: var(--ink-mute); }
.bs-source-badges { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0 10px; }
.bs-source-badge { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; background: var(--paper-2); color: var(--ink-3); }
.bs-source-badge.method { background: var(--accent-bg); color: var(--accent-2); }
.bs-source-role { font-family: var(--serif); font-size: 16px; line-height: 1.55; color: var(--ink-2); max-width: 74ch; }
.bs-source-foot { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 10px; font-family: var(--mono); font-size: 11.5px; color: var(--ink-mute); }
.bs-source-foot .fetched { color: var(--ink-faint); }
`;

function badge(text: string, kind: "plain" | "method" = "plain"): string {
  return `<span class="bs-source-badge${kind === "method" ? " method" : ""}">${escapeHtml(text)}</span>`;
}

function sourceRow(s: Source): string {
  const badges: string[] = [];
  if (s.method) badges.push(badge(s.method, "method"));
  badges.push(badge(s.kind === "official" ? "official series" : "academic grounding"));
  if (s.cubePid) badges.push(badge(s.cubePid));

  const fetched =
    s.kind === "official" ? `<span class="fetched">last fetched · not yet fetched</span>` : "";

  return `<article id="${s.id}" class="bs-source">
  <div class="bs-source-top">
    <div class="bs-source-name"><a href="${escapeAttr(s.url)}" rel="noreferrer">${escapeHtml(s.name)}</a></div>
    <div class="bs-source-pub">${escapeHtml(s.publisher)}</div>
  </div>
  <div class="bs-source-badges">${badges.join("")}</div>
  <p class="bs-source-role">${escapeHtml(s.role)}</p>
  <div class="bs-source-foot">
    <span>cadence · ${escapeHtml(s.cadence)}</span>
    ${fetched}
  </div>
</article>`;
}

export function renderSourcesPage(isOperator: boolean): string {
  const official = SOURCES.filter((s) => s.kind === "official");
  const academic = SOURCES.filter((s) => s.kind === "academic");

  const body = `
<div class="bs-sources-wrap">
  <header class="bs-sources-head">
    <div class="bs-label">Sources</div>
    <h1 class="bs-sources-h1">Every number here is the government's, and traceable</h1>
    <p class="bs-sources-standfirst">The official series the instrument pulls and snapshots, and the academic work that grounds how it reads them. Nothing is published that isn't traceable to a stored snapshot of one of these.</p>
  </header>

  <section class="bs-source-group">
    <div class="bs-label">Official statistics · pulled &amp; snapshotted</div>
    ${official.map(sourceRow).join("")}
  </section>

  <section class="bs-source-group">
    <div class="bs-label">Academic grounding · the four channels</div>
    ${academic.map(sourceRow).join("")}
  </section>
</div>`;

  return renderShell({
    title: "Sources",
    description:
      "Every official statistic The Blind Spot stands on — publisher, cadence, last-fetched, and the stored snapshot — plus the academic work grounding the Invisibility Index.",
    activeNav: "/sources",
    isOperator,
    canonical: "https://blindspot.canopticon.com/sources",
    extraCss: SOURCES_CSS,
    body,
  });
}
