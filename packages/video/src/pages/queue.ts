// /queue — read-only history. The GDELT/Brave daily-radar discovery +
// rubric scoring + promote flow that used to populate this table has
// been cut (see CLAUDE.md's "Two other Workers exist" section) — no
// route writes a new candidate row anymore, so this page shows only
// whatever's already in D1 from before the cut, no poll/brief/promote
// actions.

import type { CandidateRow, RubricScores } from "../sourcing/candidates";
import { escapeAttr, escapeHtml, htmlPage } from "./shell";

interface QueueArgs {
  candidates: CandidateRow[];
}

export function renderQueuePage(args: QueueArgs): Response {
  const { candidates } = args;
  const inner = candidates.length === 0 ? renderEmpty() : renderTable(candidates);
  const body = `
  <div class="h1">Candidates — history</div>
  <div class="sub">gdelt/brave daily-radar discovery retired — see CLAUDE.md · ${candidates.length} candidate${candidates.length === 1 ? "" : "s"} on record, read-only</div>
  <div style="font-family:var(--mono);font-size:11px;margin:0 0 16px">
    <a href="/" style="color:var(--ink-3);text-decoration:none;margin-right:14px">status →</a>
    <a href="/queue" style="color:var(--ink);text-decoration:none;margin-right:14px;border-bottom:2px solid var(--amber)">queue</a>
    <a href="/react" style="color:var(--ink-3);text-decoration:none;margin-right:14px">reaction videos →</a>
    <a href="/voice" style="color:var(--ink-3);text-decoration:none;margin-right:14px">voice clone →</a>
    <a href="/metrics" style="color:var(--ink-3);text-decoration:none">metrics →</a>
  </div>
  ${inner}
  <div class="card" style="margin-top:24px">
    <div class="k">how segments get made now</div>
    <div style="font-family:var(--serif);font-size:14.5px;line-height:1.65;margin-top:4px">
      The daily GDELT/Brave radar — poll, six-axis rubric score, cast, promote — has been
      retired: it was a fully separate "what's newsworthy" engine with no connection to the
      publication's typed graph. Segments now come from the publication's own signed
      readings — the api Worker POSTs a reading's already-verified facts to
      <code>/segments/from-reading</code>, which drafts a script from them (re-sequenced,
      not independently sourced) and lands it in the same review below. Rows in this table
      are history from before the cut.
    </div>
  </div>
`;
  return htmlPage({ title: "Queue", body });
}

function renderEmpty(): string {
  return `<div class="card">
  <div class="k">no candidates on record</div>
  <div class="v empty">Nothing here — this table only ever held GDELT/Brave-sourced candidates, and that pipeline is retired.</div>
</div>`;
}

function renderTable(candidates: CandidateRow[]): string {
  const rows = candidates.map((c) => renderRow(c)).join("");
  return `<div class="card" style="padding:0;overflow:hidden">
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#f6f3ec">
        <th style="text-align:left;padding:12px 16px;font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.04em">score</th>
        <th style="text-align:left;padding:12px 16px;font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.04em">network · headline</th>
        <th style="text-align:left;padding:12px 16px;font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.04em">template</th>
        <th style="text-align:left;padding:12px 16px;font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.04em">status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
}

function renderRow(c: CandidateRow): string {
  const score =
    c.rubric_score != null
      ? `<span class="v num" style="font-size:24px">${c.rubric_score.toFixed(0)}</span><span class="k" style="margin-left:4px">/30</span>`
      : `<span class="empty">—</span>`;
  const scores = c.rubric_json ? renderAxisChips(JSON.parse(c.rubric_json) as RubricScores) : "";
  const template = c.cast_template
    ? `<span class="pill running">${escapeHtml(c.cast_template)}</span>`
    : `<span class="empty">—</span>`;
  const status =
    c.status === "promoted"
      ? `<a href="/queue/${escapeAttr(c.id)}" class="pill succeeded" style="text-decoration:none">promoted — review →</a>`
      : `<span class="pill ${escapeAttr(c.status)}">${escapeHtml(c.status)}</span>`;

  const sourceTag =
    c.source === "stub"
      ? `<span class="pill" style="background:#fff5e6;color:#5c4413">stub</span>`
      : `<span class="pill" style="background:#e7f0e6;color:#2f7d52">live</span>`;

  const ago = humanAge(c.captured_at);

  return `<tr style="border-top:1px solid var(--rule)">
  <td style="padding:14px 16px;vertical-align:top">
    ${score}
    ${scores}
  </td>
  <td style="padding:14px 16px;vertical-align:top">
    <div style="display:flex;gap:8px;align-items:center;font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.04em">
      ${escapeHtml(c.network)} ${sourceTag} · ${escapeHtml(ago)}
    </div>
    <div style="margin-top:4px;font-family:var(--serif);font-size:15px;line-height:1.3">${escapeHtml(c.headline)}</div>
    <div style="margin-top:6px;font-family:var(--serif);font-style:italic;font-size:13px;color:var(--ink-3);line-height:1.5">${escapeHtml(c.excerpt.slice(0, 200))}${c.excerpt.length > 200 ? "…" : ""}</div>
    ${c.entities.length > 0 ? `<div style="margin-top:6px;font-family:var(--mono);font-size:10.5px;color:var(--ink-3)">${c.entities.map((e) => escapeHtml(e)).join(" · ")}</div>` : ""}
  </td>
  <td style="padding:14px 16px;vertical-align:top">${template}</td>
  <td style="padding:14px 16px;vertical-align:top">${status}</td>
</tr>`;
}

function renderAxisChips(scores: RubricScores): string {
  const axes: Array<[keyof RubricScores, string]> = [
    ["forensic_potential", "forensic"],
    ["visual_evidence", "visual"],
    ["recency", "recent"],
    ["canadian_lane", "lane"],
    ["counter_voice", "counter"],
    ["legibility", "legible"],
  ];
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${axes
    .map(
      ([k, label]) =>
        `<span style="font-family:var(--mono);font-size:10px;color:var(--ink-3);letter-spacing:.04em">${escapeHtml(label)}·<b style="color:var(--ink)">${scores[k] ?? 0}</b></span>`,
    )
    .join("")}</div>`;
}

function humanAge(iso: string): string {
  const ago = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ago / 3600_000);
  if (h < 1) return "<1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
