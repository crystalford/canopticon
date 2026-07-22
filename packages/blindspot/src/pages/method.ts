// pages/method.ts — renders METHOD_PAPER into the long-form method
// paper at /method. A sticky table-of-contents rail on desktop; the
// paper flows in a single reading column. All prose primitives
// (.bs-prose, .bs-honesty) come from the shell stylesheet.

import { METHOD_PAPER } from "../content/method-paper.ts";
import { escapeHtml, renderShell } from "./shell.ts";

const METHOD_CSS = `
.bs-method-layout { max-width: 1120px; margin: 0 auto; padding: clamp(40px,6vw,72px) clamp(18px,5vw,48px); display: grid; grid-template-columns: 1fr; gap: 40px; }
.bs-method-head { max-width: var(--reading); }
.bs-method-kicker { margin-bottom: 14px; }
.bs-method-h1 { font-family: var(--serif); font-weight: 500; font-size: clamp(34px,5.4vw,52px); letter-spacing: -0.025em; line-height: 1.02; margin-bottom: 18px; max-width: 18ch; }
.bs-method-standfirst { font-family: var(--serif); font-size: 20px; line-height: 1.5; color: var(--ink-3); max-width: 46ch; }
.bs-method-toc { font-family: var(--mono); font-size: 12.5px; }
.bs-method-toc .bs-label { margin-bottom: 12px; }
.bs-method-toc ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.bs-method-toc a { display: flex; gap: 10px; color: var(--ink-3); padding: 5px 8px; border-radius: var(--r-sm); }
.bs-method-toc a:hover { background: var(--paper-2); color: var(--ink); text-decoration: none; }
.bs-method-toc .toc-num { color: var(--accent); width: 1.4em; flex: none; }
.bs-method-section { max-width: var(--reading); scroll-margin-top: 84px; padding-top: 8px; }
.bs-method-section + .bs-method-section { margin-top: 40px; padding-top: 40px; border-top: 1px solid var(--rule); }
.bs-method-section > .bs-sec-head { display: flex; align-items: baseline; gap: 14px; margin-bottom: 14px; }
.bs-method-section .bs-sec-num { font-family: var(--mono); font-size: 13px; color: var(--accent); font-weight: 500; }
.bs-method-section .bs-sec-title { font-family: var(--serif); font-weight: 600; font-size: 27px; letter-spacing: -0.015em; line-height: 1.14; color: var(--ink); }
.bs-factor-table { width: 100%; border-collapse: collapse; font-family: var(--sans); font-size: 13.5px; margin-top: 1em; }
.bs-factor-table th { text-align: left; font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-mute); border-bottom: 1px solid var(--rule); padding: 8px 10px; }
.bs-factor-table td { border-bottom: 1px solid var(--rule-soft); padding: 9px 10px; color: var(--ink-2); vertical-align: top; }
.bs-factor-table .bs-num { font-family: var(--mono); text-align: right; white-space: nowrap; }
@media (min-width: 940px) {
  .bs-method-layout { grid-template-columns: 220px 1fr; column-gap: 56px; }
  .bs-method-head { grid-column: 1 / -1; }
  .bs-method-toc { position: sticky; top: 84px; align-self: start; grid-column: 1; }
  .bs-method-body { grid-column: 2; }
}
`;

export function renderMethodPage(isOperator: boolean): string {
  const toc = METHOD_PAPER.map((s) => {
    const num = s.num
      ? `<span class="toc-num">${escapeHtml(s.num)}</span>`
      : `<span class="toc-num">·</span>`;
    return `<li><a href="#${s.id}">${num}<span>${escapeHtml(s.title)}</span></a></li>`;
  }).join("");

  const sections = METHOD_PAPER.map((s) => {
    const num = s.num ? `<span class="bs-sec-num">${escapeHtml(s.num)}</span>` : "";
    return `<section id="${s.id}" class="bs-method-section">
  <div class="bs-sec-head">${num}<h2 class="bs-sec-title">${escapeHtml(s.title)}</h2></div>
  <div class="bs-prose">${s.bodyHtml}</div>
</section>`;
  }).join("\n");

  const body = `
<div class="bs-method-layout">
  <header class="bs-method-head">
    <div class="bs-label bs-method-kicker">Method paper · The Blind Spot</div>
    <h1 class="bs-method-h1">Measuring the failure of measurement</h1>
    <p class="bs-method-standfirst">How three official methods can measure the same wealth and disagree by nearly a factor of two at the top — and what that gap is made of.</p>
  </header>
  <nav class="bs-method-toc" aria-label="Contents">
    <div class="bs-label">Contents</div>
    <ol>${toc}</ol>
  </nav>
  <div class="bs-method-body">
    ${sections}
  </div>
</div>`;

  return renderShell({
    title: "Method",
    description:
      "The method paper behind The Blind Spot: the proposition, why the three methods disagree, the Invisibility Index and its four channels, the recovery ratio, and every stated assumption.",
    activeNav: "/method",
    isOperator,
    canonical: "https://blindspot.canopticon.com/method",
    extraCss: METHOD_CSS,
    body,
  });
}
