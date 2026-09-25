// The retired signed-analysis index. /investigations has 301ed to /research
// since 2026-09-23 (CLAUDE.md, "Retired rooms redirect, never render"); the
// renderer stays in the tree, unwired, and is re-exported from
// public/render/investigations.ts so nothing that names it has to move.

import { type PublicEnv, listInvestigations, resolveOperatorId } from "../../data";
import { escapeHtml, renderPage } from "../../layout";
import { formatDate, pieceCard } from "../components";

// Reader-facing intent labels for signed readings (spec Part 18.2: intents
// are badges and filters, not nav). The seven canonical signed-reading
// intents — spec v2.5 Part 5, and the only values pages.intent's CHECK
// constraint (migration 0032) permits.
const INTENT_LABELS: Record<string, string> = {
  investigation: "Investigation",
  argument: "Argument",
  pattern: "Pattern",
  hypothesis: "Hypothesis",
  assessment: "Assessment",
  critique: "Critique",
  explanation: "Explanation",
};

export async function renderInvestigationsIndex(
  env: PublicEnv,
  intentFilter?: string,
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const pieces = userId ? await listInvestigations(env.DB, userId) : [];

  // Signed readings from the fabric (pages.signed_status='published'). These
  // are the Phase-3 auto-drafted, operator-signed readings of subjects — the
  // only "published analysis" pipeline actually being fed going forward.
  // (The older `briefs` table/pipeline this index used to also list here is
  // sunset — see settle-pipeline.ts. Already-published briefs still resolve
  // at their own /briefs/:slug URLs; they just don't surface here anymore.)
  const { all } = await import("../../../lib/d1");
  const readings = userId
    ? await all<{
        slug: string;
        label: string;
        kind: string;
        thesis: string | null;
        intent: string | null;
        signed_by: string | null;
        signed_at: string | null;
        confidence: string | null;
      }>(
        env.DB,
        `SELECT p.slug, n.label, n.kind, p.thesis, p.intent, p.signed_by, p.signed_at, p.confidence
           FROM pages p JOIN nodes n ON n.id = p.subject_node_id
          WHERE p.user_id = ? AND p.signed_status = 'published'
          ORDER BY p.signed_at DESC LIMIT 40`,
        [userId],
      ).catch(() => [])
    : [];

  // Apply the intent filter to readings — clicking an intent badge narrows.
  const shownReadings = intentFilter ? readings.filter((r) => r.intent === intentFilter) : readings;

  // Editorial hierarchy: a LEAD reading + secondary cards row + the rest as
  // a compact ordered list. A real investigations page foregrounds the
  // strongest piece instead of treating every reading as equal.
  const leadReading = shownReadings[0];
  const secondaryReadings = shownReadings.slice(1, 3);
  const tailReadings = shownReadings.slice(3);

  const intentChip = (intent: string | null | undefined): string =>
    intent
      ? `<span class="intent-badge intent-${escapeHtml(intent)}">${escapeHtml(INTENT_LABELS[intent] ?? intent)}</span>`
      : `<span class="chip">Signed analysis</span>`;

  const leadReadingCard = leadReading
    ? `<a class="inv-lead" href="/s/${escapeHtml(leadReading.slug)}?mode=signed">
  <div class="inv-lead-kicker">
    ${intentChip(leadReading.intent)}
    ${leadReading.confidence ? `<span class="inv-meta">${escapeHtml(leadReading.confidence)} confidence</span>` : ""}
    ${leadReading.signed_by ? `<span class="inv-meta">signed · ${escapeHtml(leadReading.signed_by)}</span>` : ""}
    ${leadReading.signed_at ? `<span class="inv-meta inv-date">${escapeHtml(formatDate(leadReading.signed_at))}</span>` : ""}
  </div>
  <h2 class="inv-lead-title">${escapeHtml(leadReading.label)}</h2>
  ${leadReading.thesis ? `<p class="inv-lead-thesis">${escapeHtml(leadReading.thesis.slice(0, 220))}</p>` : ""}
</a>`
    : "";

  const secondaryReadingsRow = secondaryReadings.length
    ? `<div class="inv-secondaries">${secondaryReadings
        .map(
          (r) => `<a class="inv-secondary" href="/s/${escapeHtml(r.slug)}?mode=signed">
  <div class="inv-secondary-kicker">${intentChip(r.intent)}${r.confidence ? ` <span class="inv-meta">${escapeHtml(r.confidence)} confidence</span>` : ""}</div>
  <h3 class="inv-secondary-title">${escapeHtml(r.label)}</h3>
  ${r.thesis ? `<p class="inv-secondary-thesis">${escapeHtml(r.thesis.slice(0, 130))}</p>` : ""}
  ${r.signed_at ? `<div class="inv-meta inv-date">${escapeHtml(formatDate(r.signed_at))}</div>` : ""}
</a>`,
        )
        .join("")}</div>`
    : "";

  const tailReadingsList = tailReadings.length
    ? `<div class="inv-tail-list">${tailReadings
        .map(
          (r) => `<div class="inv-row">
  ${intentChip(r.intent)}
  <a class="inv-row-link" href="/s/${escapeHtml(r.slug)}?mode=signed">${escapeHtml(r.label)}</a>
  ${r.signed_at ? `<span class="inv-meta inv-date">${escapeHtml(formatDate(r.signed_at))}</span>` : ""}
</div>`,
        )
        .join("")}</div>`
    : "";

  const readingCards = leadReadingCard + secondaryReadingsRow + tailReadingsList;

  // Filter row collects intents from signed readings (pages.intent). Click
  // an intent to narrow.
  const presentTypes = [...new Set(readings.map((r) => r.intent).filter((i): i is string => !!i))];
  const filterRow = presentTypes.length
    ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
  <a href="/investigations" class="chip" style="text-decoration:none${intentFilter ? "" : ";border-color:var(--accent)"}">All</a>
  ${presentTypes
    .map(
      (t) =>
        `<a href="/investigations?intent=${escapeHtml(t)}" class="chip" style="text-decoration:none${intentFilter === t ? ";border-color:var(--accent)" : ""}">${escapeHtml(INTENT_LABELS[t] ?? t)}</a>`,
    )
    .join("")}
</div>
<style>
  .intent-badge { display:inline-block; font-size:10px; padding:2px 9px; border-radius:4px;
    font-weight:600; letter-spacing:.04em; margin-right:6px; }
  .intent-investigation { background:rgba(77,156,111,.16); color:#4d9c6f; }
  .intent-argument { background:rgba(201,106,83,.16); color:#c96a53; }
  .intent-pattern { background:rgba(126,166,216,.16); color:#7ea6d8; }
  .intent-hypothesis { background:rgba(183,158,224,.16); color:#b79ee0; }
  .intent-assessment { background:rgba(209,171,92,.16); color:#d1ab5c; }
  .intent-critique { background:rgba(196,123,152,.16); color:#c47b98; }
  .intent-explanation { background:rgba(126,200,227,.16); color:#7ec8e3; }
</style>`
    : "";

  const list = pieces.length
    ? `<div class="cards-row">${pieces.map((p) => pieceCard(p)).join("")}</div>`
    : "";

  // The fabric-era ledger: signed readings of subjects/themes. When no
  // readings exist yet — and we only have legacy CMS-era pieces (or
  // nothing) — explain the SHAPE that fills this page rather than show a
  // dead empty.
  const shapeBlock =
    readings.length === 0
      ? `<section class="shape-block" aria-label="What this page will contain">
  <div class="sec-k">What lands here</div>
  <ul>
    <li><b>Signed analyses</b> — the operator picks a subject (entity, event, or theme) with enough material on it, optionally gives it an angle, and drafts an analysis; then reads and signs it. Each carries a thesis, a confidence band, and a mandatory box of facts that complicate it.</li>
    <li><b>Intent badges</b> — every signed piece wears its kind: Investigation · Argument · Pattern · Assessment · Critique · Explanation. Filter above when there are enough to filter.</li>
    <li><b>Receipts</b> — every load-bearing assertion ties back to a verbatim quote from a stored source document.</li>
  </ul>
  ${pieces.length > 0 ? `<p>Showing ${pieces.length} legacy investigation${pieces.length === 1 ? "" : "s"} from before the fabric era below. No fabric-era signed analyses yet — draft one from any subject's page.</p>` : '<p>No signed analyses yet — draft one from any subject\'s page ("Draft an analysis").</p>'}
</section>`
      : "";

  const body = `
<section style="margin-bottom:24px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> Signed analysis</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 12px;color:var(--ink)">Investigations</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--ink-2);max-width:680px">
    The figure cut across the facts. Every piece wears its intent as a badge;
    every load-bearing assertion ties back to the evidence it rests on.
  </p>
</section>
${shapeBlock}
${filterRow}
<section>${readingCards}${list}</section>
<style>
  .shape-block { padding:20px 22px; border:1px solid var(--rule); border-radius:9px;
    background:var(--panel-soft, rgba(0,0,0,.02)); margin-bottom:28px; }
  .shape-block .sec-k { font-size:11px; letter-spacing:.14em; color:var(--ink-3);
    text-transform:uppercase; font-weight:600; margin:0 0 12px; }
  .shape-block ul { list-style:none; padding:0; margin:0 0 14px; }
  .shape-block li { font-size:14.5px; line-height:1.6; color:var(--ink-2); padding:7px 0;
    border-top:1px solid var(--rule); }
  .shape-block li:first-child { border-top:none; }
  .shape-block li b { color:var(--ink); font-weight:600; }
  .shape-block p { font-size:13.5px; color:var(--ink-3); font-style:italic; margin:0; }

  /* Investigations editorial hierarchy — lead piece, two secondaries,
     compact tail list. Matches the home pattern so the reader's mental
     model carries across surfaces. */
  .inv-lead {
    display: block; text-decoration: none;
    padding: 28px 32px; margin-bottom: 24px;
    border: 1px solid var(--rule); border-radius: 13px;
    background: var(--surface, #fff);
    transition: border-color .12s;
  }
  .inv-lead:hover { border-color: var(--accent-bd); }
  .inv-lead-kicker { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .inv-lead-title {
    font-family: var(--serif);
    font-size: 32px; line-height: 1.16;
    letter-spacing: -0.018em;
    color: var(--ink);
    margin: 0 0 12px;
  }
  .inv-lead-thesis {
    font-family: var(--serif);
    font-size: 18px; line-height: 1.55;
    font-style: italic;
    color: var(--ink-2);
    margin: 0;
    max-width: 720px;
  }
  .inv-secondaries { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 28px; }
  .inv-secondary {
    display: block; text-decoration: none;
    padding: 20px 22px;
    border: 1px solid var(--rule); border-radius: 10px;
    background: var(--surface, #fff);
    transition: border-color .12s;
  }
  .inv-secondary:hover { border-color: var(--accent-bd); }
  .inv-secondary-kicker { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 9px; }
  .inv-secondary-title {
    font-family: var(--serif);
    font-size: 20px; line-height: 1.22;
    color: var(--ink);
    margin: 0 0 8px;
  }
  .inv-secondary-thesis {
    font-family: var(--serif);
    font-size: 14px; line-height: 1.5;
    color: var(--ink-2);
    margin: 0 0 10px;
  }
  .inv-tail-list { margin-top: 16px; }
  .inv-row {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 12px 0; border-top: 1px solid var(--rule);
  }
  .inv-row:first-child { border-top: none; }
  .inv-row-link {
    font-family: var(--serif); font-size: 17px;
    color: var(--ink); text-decoration: none;
    flex: 1;
  }
  .inv-row-link:hover { color: var(--accent); }
  .inv-meta {
    font-size: 12px;
    color: var(--ink-3);
    letter-spacing: .03em;
  }
  .inv-date { font-family: var(--mono); font-size: 11.5px; }
  @media (max-width: 720px) {
    .inv-secondaries { grid-template-columns: 1fr; }
    .inv-lead-title { font-size: 26px; }
    .inv-lead-thesis { font-size: 16px; }
  }
</style>
`;
  return renderPage({
    title: "Investigations",
    description: "Signed analysis on Canadian power — investigations, arguments, assessments.",
    body,
    activeNav: "/investigations",
    zone: "investigations",
  });
}
