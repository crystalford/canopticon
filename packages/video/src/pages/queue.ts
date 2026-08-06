// /queue — operator's daily-radar view. Lists candidates ordered by
// rubric score, with per-axis scores visible, a cast template, and a
// "Promote to segment" affordance for the top candidate.

import type { RubricScores } from "../editorial/rubric";
import type { CandidateRow } from "../sourcing/candidates";
import { escapeAttr, escapeHtml, htmlPage } from "./shell";

interface QueueArgs {
  candidates: CandidateRow[];
}

export function renderQueuePage(args: QueueArgs): Response {
  const { candidates } = args;
  const castCount = candidates.filter((c) => c.cast_template != null).length;
  const inner = candidates.length === 0 ? renderEmpty() : renderTable(candidates);
  const briefAction =
    castCount >= 2
      ? `<form method="POST" action="/queue/brief" style="margin:0 0 18px;display:inline">
  <button class="btn" type="submit" style="background:#fff;color:var(--ink);border:1px solid var(--rule)">
    Build today's brief — ${castCount} stories →
  </button>
</form>`
      : "";
  const pollAction = `<form method="POST" action="/queue/poll" style="margin:0 0 18px;display:inline;margin-left:8px">
  <button class="btn" type="submit" style="background:#fff;color:var(--ink);border:1px solid var(--rule)">
    Refresh radar
  </button>
</form>`;
  const body = `
  <div class="h1">Today's candidates — the daily radar</div>
  <div class="sub">phase 1 cockpit · gdelt + brave radars · workers-ai rubric · ${candidates.length} candidate${candidates.length === 1 ? "" : "s"} from the last 48h · <span class="pill" style="background:#fff5e6;color:#5c4413">manual mode · cron disabled</span></div>
  <div style="font-family:var(--mono);font-size:11px;margin:0 0 16px">
    <a href="/" style="color:var(--ink-3);text-decoration:none;margin-right:14px">status →</a>
    <a href="/queue" style="color:var(--ink);text-decoration:none;margin-right:14px;border-bottom:2px solid var(--amber)">queue</a>
    <a href="/react" style="color:var(--ink-3);text-decoration:none;margin-right:14px">reaction videos →</a>
    <a href="/voice" style="color:var(--ink-3);text-decoration:none;margin-right:14px">voice clone →</a>
    <a href="/metrics" style="color:var(--ink-3);text-decoration:none">metrics →</a>
  </div>
  <div>${briefAction}${pollAction}</div>
  ${inner}
  <div class="card" style="margin-top:24px">
    <div class="k">how this works</div>
    <div style="font-family:var(--serif);font-size:14.5px;line-height:1.65;margin-top:4px">
      The daily cron polls GDELT for Canadian-politics clips, scores each one against the
      six-axis rubric (forensic potential, visual evidence, recency, lane fit, counter-voice,
      legibility), and casts the highest into one of three templates. The operator
      promotes the top candidate to a segment — the editorial brain writes the §7b script,
      flags the forensic_turn as <code>needs_human: true</code>, and waits for your edit.
    </div>
  </div>
`;
  return htmlPage({ title: "Queue", body });
}

function renderEmpty(): string {
  return `<div class="card">
  <div class="k">no candidates yet</div>
  <div class="v empty">The daily cron fires at noon UTC. Until then this is empty unless you trigger a manual poll.</div>
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
        <th style="text-align:right;padding:12px 16px;font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.04em">action</th>
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
  const status = `<span class="pill ${escapeAttr(c.status)}">${escapeHtml(c.status)}</span>`;
  const action =
    c.status === "cast" || c.status === "scored"
      ? `<form method="POST" action="/queue/${escapeAttr(c.id)}/promote" style="margin:0">
        <button class="btn" type="submit" style="padding:8px 14px;font-size:12px">Promote →</button>
      </form>`
      : c.status === "promoted"
        ? `<span class="pill succeeded">promoted</span>`
        : `<span class="empty">—</span>`;

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
  <td style="padding:14px 16px;vertical-align:top;text-align:right">${action}</td>
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
