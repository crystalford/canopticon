// Investigations — the signed-analysis index + the Library (raw research
// archive). The piece page itself is rendered by piece-template.ts, not
// here — see that file for the public face of a single document.

import type { Env } from "../../env";
import type { LeadAnswer } from "../../graph/lib/answer-lead";
import {
  type ConsolidationSummary,
  type Lineage,
  consolidationLine,
  consolidationSummaries,
  lineageForPieces,
} from "../../graph/lib/consolidation";
import type { IngestionReceipt } from "../../graph/lib/ingestion-receipt";
import type { Lead } from "../../graph/lib/leads";
import {
  type ProcessingRow,
  describeProcessing,
  processingCounts,
  processingRows,
} from "../../graph/lib/processing";
import * as GATE from "../../lib/aeo";
import type { ResurfacedPassage } from "../../lib/resurface";
import { looksLikeMachineFilename, looksLikeWorkingTitle } from "../../lib/title";
import { titleCandidates } from "../../lib/title-candidates";
import { modelInUse } from "../../llm/router";
import { type PublicEnv, listInvestigations, resolveOperatorId } from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";
import { emptyState, formatDate, kindLabel, pieceCard, sectionHeader } from "./components";
import { PROCESS_LIVE_JS } from "./process-live";
import { renderLiveStatusBanner } from "./status-banner";

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
  const { all } = await import("../../lib/d1");
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

// Library — the raw research layer. Lists everything (incl. working-
// material) with an honest status tag.
// A stored piece's title is sometimes the raw upload filename — e.g.
// "compass_artifact_wf-c96cfa7c-3f5d-…_text_markdown.md" — when the
// operator dropped a file whose name was never meant to be read. Showing
// that verbatim as a page title reads as broken, not honest. Detect the
// machine-filename shape (long, no spaces, a file extension or a uuid-ish
// segment) and show a plain placeholder with the real filename kept
// visible underneath in mono, never hidden.
interface QuestionReview {
  id: string;
  question: string;
  slug: string;
  status: string;
  evidence_count: number;
  answer_words: number;
  models?: string | null;
  has_draft?: number;
  answer_approved_at?: string | null;
  contested?: number;
}

// What a document produced, and whether each question is allowed to become a
// page. Operator-only — a proposed question has no URL, so this is the one
// place it can be seen and judged before it becomes public.
//
// The controls that used to live here — "Select lead passage", the model
// picker, "Extract findings & questions" — are gone. Findings, the passage
// and the section run on upload now, as steps of the pipeline
// (graph/lib/processing.ts), and the lead passage is auto-approved: it is a
// verbatim span of a document the operator already published. The fold keeps
// what only it can show: the questions and their Draft → Approve → Publish
// gate, and the passage as a read-only line.
function renderAtomReview(
  atoms: { findings: number; questions: QuestionReview[] } | undefined,
  lede?: { verbatim_text: string } | null,
): string {
  const ledeLine = lede
    ? `<div class="atom-lede"><span class="atom-lede-k">Lead passage:</span> ${escapeHtml(lede.verbatim_text)}</div>`
    : "";
  // FOLDED. A native <details>, so nothing here needs JavaScript (rule 7).
  const fold = (inner: string, label: string) =>
    `<details class="atom-more"><summary>${escapeHtml(label)}</summary>${inner}</details>`;

  if (!atoms || (atoms.findings === 0 && atoms.questions.length === 0)) {
    return lede ? fold(`<div class="atoms">${ledeLine}</div>`, "Lead passage") : "";
  }
  const rows = atoms.questions
    .map((q) => {
      const { gateQuestion } = GATE;
      const gate = gateQuestion({
        evidenceCount: q.evidence_count,
        answerWords: q.answer_words,
        hasApprovedAnswer: Boolean(q.answer_approved_at),
      });
      // The route to a page now runs Draft -> Approve -> Publish, so the
      // action shown is whichever step is actually next. A single "Publish"
      // button that silently refuses is worse than no button.
      const draftAction = q.has_draft
        ? q.answer_approved_at
          ? ""
          : `<form method="POST" action="/op/answers/${escapeHtml(q.id)}/draft/approve" style="display:inline"><button type="submit" class="atom-pub">Approve answer</button></form>`
        : `<form method="POST" action="/op/answers/${escapeHtml(q.id)}/draft" style="display:inline"><button type="submit" class="atom-run">Draft answer</button></form>`;
      const action =
        q.status === "published"
          ? `<span class="atom-live">live</span>`
          : gate.publishable
            ? `<form method="POST" action="/op/answers/${escapeHtml(q.id)}/publish" style="display:inline"><button type="submit" class="atom-pub">Publish</button></form>`
            : `<span class="atom-blocked" title="${escapeHtml(gate.reason ?? "")}">held</span>`;
      const models = (q.models ?? "")
        .split(",")
        .map((m) => m.trim().split("/").pop() ?? "")
        .filter(Boolean);
      const by = models.length ? ` · ${escapeHtml(models.join(", "))}` : "";
      const flag = q.contested ? ` <span class="atom-contested">contested</span>` : "";
      return `    <li><span class="atom-q">${escapeHtml(q.question)}</span>${flag}
      <span class="atom-meta">${q.evidence_count} source${q.evidence_count === 1 ? "" : "s"} · ${q.answer_words}w${by}</span>
      ${draftAction}${action}</li>`;
    })
    .join("\n");
  return fold(
    `<div class="atoms">
  ${ledeLine}
  <div class="atom-head"><b>${atoms.findings}</b> finding${atoms.findings === 1 ? "" : "s"} · <b>${atoms.questions.length}</b> question${atoms.questions.length === 1 ? "" : "s"}</div>
  ${atoms.questions.length ? `<ul class="atom-list">\n${rows}\n  </ul>` : ""}
</div>`,
    `${atoms.findings} finding${atoms.findings === 1 ? "" : "s"} · ${atoms.questions.length} question${atoms.questions.length === 1 ? "" : "s"}`,
  );
}

/**
 * THE PIPELINE STATUS, per row. One line from describeProcessing(); the
 * poller (process-live.ts) rewrites the same cell by its data-piece, so the
 * server and the script paint the one shape.
 */
function renderProcessingCell(pieceId: string, row: ProcessingRow | undefined): string {
  const d = describeProcessing(row);
  // The model that did the work rides along as a tooltip — it is recorded on
  // the row so a comparison between two runs survives the page.
  const model = row?.model ?? "";
  return `<span class="lib-st lib-st-${d.state}" data-piece="${escapeAttr(pieceId)}"${
    model ? ` title="${escapeAttr(model)}"` : ""
  }>${escapeHtml(d.text)}</span>`;
}

/** Re-process always; Retry only when the row failed. */
function renderRowActions(pieceId: string, row: ProcessingRow | undefined): string {
  const retry =
    row?.status === "failed"
      ? `<form method="POST" action="/op/library/${escapeAttr(pieceId)}/retry" style="display:inline"><button type="submit" class="atom-pub">Retry</button></form>`
      : "";
  const label = row?.status === "queued" || row?.status === "running" ? "Restart" : "Re-process";
  // A new version (docs/the-record.md §4): the body is replaced, the slug
  // and date stay, the pipeline re-runs, the previous source is kept.
  const replace = `<details class="lib-replace" style="display:inline"><summary>New version</summary><form method="POST" action="/op/library/${escapeAttr(pieceId)}/replace" enctype="multipart/form-data" style="display:inline"><input type="file" name="file" accept=".md,.txt,.html,.pdf,.docx" required> <button type="submit" class="atom-run">Replace</button></form></details>`;
  return `<div class="lib-actions">${retry}<form method="POST" action="/op/library/${escapeAttr(pieceId)}/reprocess" style="display:inline"><button type="submit" class="atom-run">${label}</button></form>${replace}</div>`;
}

/**
 * A title the pipeline replaced. The original is kept on the row and one
 * click puts it back (docs/the-record.md §4: the rename is reversible from
 * the row; the slug never changes).
 */
function renderAutoTitle(pieceId: string, original: string | null | undefined): string {
  if (!original) return "";
  return `<div class="lib-retitled">Renamed from \u201c${escapeHtml(original)}\u201d by the pipeline
  <form method="POST" action="/op/pieces/${escapeAttr(pieceId)}/title/revert" style="display:inline"><button type="submit" class="atom-run">Put it back</button></form></div>`;
}

// Essay lint notes, written into the piece's metadata at upload time. Shown
// here rather than only on the upload confirmation, which is seen once and
// then gone. Advisory — the piece published regardless.
/**
 * A working title, and the way out of it.
 *
 * "PASS 7-MINI — HARDENING DOSSIER" and "Phase 6" are what a research session
 * called itself. They are the page's H1, its <title> tag and its citation
 * line, and they made a real corpus read as a pile of scraps.
 *
 * This is deliberately a SUGGESTION and not a correction. Upload is
 * authorization for publishing, so the document is already live under the
 * name it arrived with; renaming is a separate act and needs a person. Every
 * candidate is the document's own text, lifted out of it — so accepting one
 * is choosing between things the document already says, not approving a
 * model's guess about it.
 *
 * Renders nothing when the title looks fine, and nothing when the document
 * offers no candidate worth showing. An empty suggestion box is worse than
 * none: it implies the title is wrong and offers no way out.
 */
function renderRename(pieceId: string, current: string, candidates: string[] | undefined): string {
  if (!candidates?.length) return "";
  const options = candidates
    .map(
      (
        c,
      ) => `      <form method="POST" action="/op/pieces/${escapeAttr(pieceId)}/title" class="rn-form">
        <input type="hidden" name="title" value="${escapeAttr(c)}" />
        <button type="submit" class="rn-pick">${escapeHtml(c)}</button>
      </form>`,
    )
    .join("\n");
  return `<div class="rn">
  <div class="rn-k">Working title — ${escapeHtml(current)}</div>
  <div class="rn-note">From the document's own words. Pick one, or leave it.</div>
${options}
</div>`;
}

/**
 * THE INGESTION RECEIPT, per document.
 *
 * "What is the system doing with the research that I'm dropping into it?" —
 * this is the answer, in the row of the document it is about. It was possible
 * to upload a 140KB dossier, get a page back, and never learn that extraction
 * had read half of it.
 *
 * THE GAP GOES FIRST. Extraction stops at a ceiling, and a receipt that led
 * with "47 verified spans" while saying nothing about the 75KB nobody looked
 * at would imply a coverage the system does not have. Standing rule 6: an
 * honest gap beats a confident number.
 */
function renderReceipt(r: IngestionReceipt | undefined, answers?: Map<string, LeadAnswer>): string {
  // Not extracted is a STATE, and it is the one that tells the operator to
  // press a button — so it is rendered, not omitted. It must also be rendered
  // HERE rather than by a second block: the row used to carry a separate
  // "fed the fabric" cell fed by its own query, and the two could disagree.
  // A screenshot caught them doing exactly that — one cell reading "not
  // extracted" beside a receipt reporting 112 facts on the same document.
  if (!r) return `<div class="rcpt"><span class="rcpt-none">Not extracted yet.</span></div>`;
  const pct = r.total_chars > 0 ? Math.round((r.read_chars / r.total_chars) * 100) : 100;
  const coverage = r.truncated
    ? `<span class="rcpt-gap">Read the first ${r.read_chars.toLocaleString()} of ${r.total_chars.toLocaleString()} characters (${pct}%) — the rest was never looked at.</span>`
    : `<span class="rcpt-full">Read in full — ${r.total_chars.toLocaleString()} characters.</span>`;

  const counts = [
    `<b>${r.quotes}</b> verified span${r.quotes === 1 ? "" : "s"}`,
    r.nodes > 0 ? `<b>${r.nodes}</b> fact${r.nodes === 1 ? "" : "s"}` : "",
    r.findings > 0 ? `<b>${r.findings}</b> figure${r.findings === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return `<div class="rcpt">
  <div class="rcpt-line">${coverage}</div>
  <div class="rcpt-line rcpt-counts">${counts}</div>
  ${renderLeads(r.leads, answers)}
</div>`;
}

/**
 * Leads — where this document made the corpus strange.
 *
 * Each one is a query result, not an opinion: the system points, it does not
 * narrate. Ordered by recency, which is a LIST ORDER and not a ranking —
 * ranking leads would end in ranking them by how often something recurs, and
 * frequency is the one mechanism this must never use. The documents are the
 * operator's own research output, so three of them agreeing may be one
 * upstream page echoing three times.
 */
/**
 * A lead's answer, rendered under the lead it settles.
 *
 * Small on purpose. The whole argument for this artifact is that it can be
 * CHECKED rather than trusted: three sentences and up to four quotes, each one
 * already located verbatim in a stored document, each linking to that
 * document. If it takes longer than half a minute to verify, it has failed at
 * the thing it exists to do.
 */
function renderLeadAnswer(a: LeadAnswer | undefined): string {
  if (!a) return "";

  if (a.status === "failed") {
    return `      <div class="lead-ans lead-ans-warn">Could not settle it — ${escapeHtml(
      a.error ?? "unknown reason",
    )}</div>\n`;
  }

  // Not a failure, and it must not read as one. "The documents raised this and
  // do not answer it" is a finding: it says the gap is real and still open.
  if (a.status === "nothing_found") {
    return `      <div class="lead-ans lead-ans-none">
        <span class="lead-ans-k">Not settled by these documents${modelTag(a)}</span>
        ${a.answer_md ? `<p>${escapeHtml(a.answer_md)}</p>` : ""}
        ${discardLine(a)}
      </div>\n`;
  }

  const quotes = a.quotes
    .map(
      (q) => `          <li>
            <span class="lead-ans-q">${escapeHtml(q.text)}</span>
            ${
              q.url
                ? `<a class="lead-ans-src" href="${escapeAttr(q.url)}" rel="nofollow noopener">${escapeHtml(
                    q.title ?? q.url,
                  )}</a>`
                : q.slug
                  ? `<a class="lead-ans-src" href="/library/${escapeAttr(q.slug)}">${escapeHtml(
                      q.title ?? q.slug,
                    )}</a>`
                  : `<span class="lead-ans-src">${escapeHtml(q.title ?? "a stored document")}</span>`
            }
          </li>`,
    )
    .join("\n");

  return `      <div class="lead-ans">
        <span class="lead-ans-k">What the documents settle${modelTag(a)}</span>
        <p>${escapeHtml(a.answer_md ?? "")}</p>
        <ul class="lead-ans-quotes">
${quotes}
        </ul>
        ${discardLine(a)}
      </div>\n`;
}

/** Which model wrote it — the whole point of a per-run toggle is comparing. */
function modelTag(a: LeadAnswer): string {
  if (!a.model) return "";
  const short = a.model.replace(/^@cf\/[^/]+\//, "");
  return ` <span class="lead-ans-model">${escapeHtml(short)}</span>`;
}

/**
 * How many proposed quotes failed the verbatim check.
 *
 * Shown rather than hidden, and shown even when the answer stands: a high
 * count is the operator's signal that the model was reaching, and suppressing
 * it would make a shaky answer look identical to a solid one.
 */
function discardLine(a: LeadAnswer): string {
  if (!a.discarded) return "";
  return `<span class="lead-ans-disc">${a.discarded} proposed quote${
    a.discarded === 1 ? "" : "s"
  } discarded for not matching any document word for word</span>`;
}

/** Exported for tests: the block is where the answer's honesty is enforced. */
export const renderLeadAnswerForTest = renderLeadAnswer;

const LEAD_LABEL: Record<Lead["kind"], string> = {
  contradiction: "sources disagree",
  "unsourced-figure": "no source named",
  bridge: "bridge between sections",
  reading: "read by the operator",
};

/**
 * The novelty check, as a research question. docs/the-record.md §1b: the
 * research pass for "The Medium Becomes the Ground" checked four literatures
 * by hand to find that nobody had made the McLuhan–allostasis connection.
 * This is that check as one button, and its answer — nobody, or these three
 * people — is itself a document.
 */
export const HAS_ANYONE_SAID_THIS_ANGLE =
  "Has anyone published this connection before? Search the literature for prior statements of it " +
  "and report who, where, when — or that none was found.";

/**
 * The dig button. The seed and angle ride along in the form because a lead
 * is a query result, not a stored row — and the angle is what makes the run
 * worth starting: a run seeded with a bare topic returns a topic's worth of
 * material. piece_id becomes the run's parent (§5), kind its origin.
 */
function digForm(l: Lead, verb: string, angle: string): string {
  return `
      <form method="POST" action="/op/leads/dig" class="lead-dig-form">
        <input type="hidden" name="seed" value="${escapeAttr(l.seed)}" />
        <input type="hidden" name="angle" value="${escapeAttr(angle)}" />
        <input type="hidden" name="kind" value="${escapeAttr(l.kind)}" />
        <input type="hidden" name="piece_id" value="${escapeAttr(l.piece_id)}" />
        <input type="hidden" name="piece_slug" value="${escapeAttr(l.piece_slug ?? "")}" />
        <input type="hidden" name="other_slug" value="${escapeAttr(l.other_piece_slug ?? "")}" />
        <button type="submit" class="lead-dig">${escapeHtml(verb)} →</button>
        <label class="lead-writer"><input type="checkbox" name="writer" value="anthropic" /> with Claude</label>
      </form>`;
}

function renderLeads(
  leads: Lead[],
  answers?: Map<string, LeadAnswer>,
  opts: { showPiece?: boolean } = {},
): string {
  if (!leads.length) return "";
  const items = leads
    .map((l) => {
      const answer = answers?.get(l.answer_key ?? "");
      const label = LEAD_LABEL[l.kind] ?? l.kind;
      // In the corpus-wide worklist a lead must say which document it came
      // out of; under a document's own receipt that is already the row.
      const piece =
        opts.showPiece && l.piece_slug
          ? ` <a class="lead-piece" href="/library/${escapeAttr(l.piece_slug)}">${escapeHtml(l.piece_title ?? l.piece_slug)}</a>`
          : "";
      const other =
        (l.kind === "contradiction" || l.kind === "bridge") && l.other_piece_slug
          ? ` <a class="lead-other" href="/library/${escapeAttr(l.other_piece_slug)}">${escapeHtml(l.other_piece_title ?? "the other document")}</a>`
          : "";
      const receipt = l.quote_id
        ? ` <a class="lead-receipt" href="/q/${escapeAttr(l.quote_id)}">quote ↗</a>`
        : "";
      // A contradiction is answerable from documents already held, in full,
      // with no web search — so the button says what it will actually do
      // rather than promising research it is not going to perform. A bridge
      // gets two runs: the connection itself, and whether anyone has made it.
      let dig = "";
      if (l.seed && l.kind === "bridge") {
        dig =
          digForm(l, "Research", l.angle) +
          digForm(l, "Has anyone said this?", HAS_ANYONE_SAID_THIS_ANGLE);
      } else if (l.seed) {
        const verb = answer ? "Dig again" : l.kind === "contradiction" ? "Settle this" : "Dig here";
        dig = digForm(l, verb, l.angle);
      }
      return `    <li class="lead lead-${escapeAttr(l.kind)}">
      <span class="lead-k">${escapeHtml(label)}</span>
      <span class="lead-sum">${escapeHtml(l.summary)}</span>${piece}${other}${receipt}${dig}
${renderLeadAnswer(answer)}    </li>`;
    })
    .join("\n");
  return `<ul class="lead-list">
${items}
  </ul>`;
}

/** Exported for tests: the two-button bridge and the per-kind labels. */
export const renderLeadsForTest = renderLeads;

/**
 * WHAT THE RECORD WANTS — the worklist (docs/the-record.md §6, part 3).
 *
 * Recent-first and never by frequency. Every entry is a query result with the
 * document(s) it came out of and the one action that follows it.
 */
function renderWorklist(
  leads: Lead[],
  answers: Map<string, LeadAnswer>,
  resurfaced: ResurfacedPassage | null = null,
): string {
  const list = leads.length
    ? renderLeads(leads, answers, { showPiece: true })
    : `<p class="op-wants-empty">Nothing yet. Leads appear here once documents have been processed: contradictions between two documents, figures with no source named, and bridges between sections.</p>`;
  return `<section class="op-queue op-wants wb-sec" id="op-wants">
  <div class="op-queue-head">What the record wants
    <span class="op-queue-note">Recent-first, never by frequency. Contradictions settle from documents already held; the rest start a research run parented to the document that raised them.</span>
  </div>
  ${renderResurfaced(resurfaced)}
  ${list}
</section>`;
}

/**
 * RESURFACED TODAY (lib/resurface.ts): one verified passage from a document
 * without a recent reading, chosen by the oldest update and a daily rotation
 * — a rehearsal of the record, never a ranking. Nothing when there is no
 * candidate. Two actions, both ordinary forms: a note (§5c) and a research
 * run parented to the document (§5).
 */
function renderResurfaced(r: ResurfacedPassage | null): string {
  if (!r) return "";
  const angle =
    "The operator is re-reading this passage of a document already on the record. Answer the question against the passage: what it asks for, what it doubts, what it says is missing.";
  return `<div class="resurfaced" id="resurfaced">
    <div class="op-queue-head">Resurfaced today</div>
    <blockquote><a href="/q/${escapeAttr(r.quote_id)}">${escapeHtml(r.verbatim_text)}</a></blockquote>
    <p class="resurfaced-from">from <a href="/p/${escapeAttr(r.piece_slug)}">${escapeHtml(r.piece_title)}</a></p>
    <form method="POST" action="/op/readings" class="resurfaced-note">
      <input type="hidden" name="piece_id" value="${escapeAttr(r.piece_id)}" />
      <input type="hidden" name="passage" value="${escapeAttr(r.verbatim_text)}" />
      <textarea name="note" rows="2" placeholder="Note this — what it asks for, doubts, or is missing" required></textarea>
      <button type="submit" class="atom-run">Note this</button>
    </form>
    <form method="POST" action="/op/leads/dig" class="lead-dig-form">
      <input type="hidden" name="seed" value="${escapeAttr(r.verbatim_text)}" />
      <input type="hidden" name="angle" value="${escapeAttr(angle)}" />
      <input type="hidden" name="kind" value="question" />
      <input type="hidden" name="piece_id" value="${escapeAttr(r.piece_id)}" />
      <input type="hidden" name="piece_slug" value="${escapeAttr(r.piece_slug)}" />
      <button type="submit" class="lead-dig">Research this →</button>
    </form>
  </div>`;
}

/** A zip can make a hundred rows; the banner names the first few. */
const UPLOAD_BANNER_MAX = 5;

/**
 * What just happened, where it happened. After an upload the operator lands
 * here, and the page's first line about the new document(s) is: it is live
 * at its URL (upload IS publication), the pipeline is at this step, and —
 * when the pipeline has finished — this is what the record made of it.
 *
 * Each part is the SAME renderer the row below uses: the status cell carries
 * the row's data-piece so the poller (process-live.ts) repaints both; the
 * consolidation line is consolidationLine(); the leads are renderLeads(),
 * and only appear once the row is done, because before that the record has
 * not read the document. Nothing here is a second copy of a number.
 */
function renderUploadBanner(
  uploaded: Array<{ id: string; slug: string; title: string }>,
  ctx: {
    procRows: Map<string, ProcessingRow>;
    consolidation: Map<string, ConsolidationSummary>;
    receipts: Map<string, IngestionReceipt>;
    leadAnswers: Map<string, LeadAnswer>;
  },
): string {
  if (!uploaded.length) return "";
  const items = uploaded
    .map((p) => {
      const proc = ctx.procRows.get(p.id);
      const done = proc?.status === "done";
      const consol = done ? renderConsolidation(ctx.consolidation.get(p.id)) : "";
      const leads = done ? (ctx.receipts.get(p.id)?.leads ?? []) : [];
      const title = looksLikeMachineFilename(p.title) ? "Untitled research document" : p.title;
      return `<li class="uploaded-doc" data-uploaded="${escapeAttr(p.id)}">
  <a href="/p/${escapeAttr(p.slug)}" class="uploaded-title">${escapeHtml(title)}</a>
  <span class="uploaded-live">Published — live now</span>
  ${renderProcessingCell(p.id, proc)}
  ${consol}${renderLeads(leads, ctx.leadAnswers)}
</li>`;
    })
    .join("\n");
  return `<section class="op-banner uploaded" id="uploaded" aria-label="Just uploaded">
  <div class="uploaded-k">Just uploaded</div>
  <ul class="uploaded-list">
${items}
  </ul>
</section>`;
}

/**
 * The consolidation line under a processed row: how the document now sits in
 * the record. Only for a row the pipeline has finished — before that the
 * counts would describe a document the record has not read.
 */
function renderConsolidation(s: ConsolidationSummary | undefined): string {
  if (!s) return "";
  return `<div class="rcpt-line rcpt-consol">${escapeHtml(consolidationLine(s))}</div>`;
}

/** Lineage (§5): where a document grew from, and how many grew from it. */
function renderLineage(l: Lineage | undefined): string {
  if (!l) return "";
  const parts: string[] = [];
  if (l.parent_id) {
    const name = escapeHtml(l.parent_title ?? l.parent_slug ?? "a document");
    parts.push(
      l.parent_slug
        ? `Grew from <a class="ac" href="/library/${escapeAttr(l.parent_slug)}">${name}</a>`
        : `Grew from ${name}`,
    );
  }
  if (l.branches > 0) parts.push(`${l.branches} branch${l.branches === 1 ? "" : "es"}`);
  if (!parts.length) return "";
  const origin = l.origin ? ` <span class="lib-lineage-origin">${escapeHtml(l.origin)}</span>` : "";
  return `<div class="lib-lineage">${parts.join(" · ")}${origin}</div>`;
}

function renderLintNotes(metadataJson: string | null | undefined): string {
  let notes: Array<{ level: string; message: string }> = [];
  try {
    const meta = JSON.parse(metadataJson || "{}") as { essay_lint?: typeof notes };
    notes = Array.isArray(meta.essay_lint) ? meta.essay_lint : [];
  } catch {
    return "";
  }
  const loud = notes.filter((n) => n.level === "error" || n.level === "warn");
  if (!loud.length) return "";
  return `<details class="lint">
  <summary>${loud.length} note${loud.length === 1 ? "" : "s"} on this essay's structure</summary>
  <ul>${loud.map((n) => `<li>${escapeHtml(n.message)}</li>`).join("")}</ul>
</details>`;
}

export async function renderLibraryIndex(
  env: PublicEnv,
  opts: {
    isOperator?: boolean;
    ingested?: string;
    error?: string;
    importing?: string;
    videoError?: string;
    published?: string;
    /** Set after a title was replaced or put back from /op/pieces/:id/title. */
    renamed?: string;
    /** How many documents "Process everything" / Re-process just queued. */
    queued?: string;
    /**
     * The piece ids the upload just made, comma-separated, from the redirect
     * POST /op/feed/upload issues. The page opens on them (renderUploadBanner).
     */
    uploaded?: string;
  } = {},
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const { listLibrary } = await import("../data");
  const pieces = userId
    ? await listLibrary(env.DB, userId, { includeUnpublished: opts.isOperator === true })
    : [];

  // working-material never gets a public page (renderPiece refuses it,
  // by design — see piece-template.ts) — EXCEPT an on-demand research
  // draft (graph/lib/deep-research.ts's researchOnDemand), which is
  // working-material specifically so it can't go live before review, but
  // still needs to be readable somewhere. This is that somewhere: link it
  // to the operator review screen instead of leaving it dead text like
  // every other piece of raw working material.
  const { all: allRows2 } = await import("../../lib/d1");
  const onDemandDrafts = new Set<string>();
  if (userId && opts.isOperator) {
    const rows = await allRows2<{ id: string }>(
      env.DB,
      `SELECT id FROM pieces WHERE user_id = ? AND publication_status = 'working-material'
         AND tags LIKE '%on-demand%'`,
      [userId],
    ).catch(() => []);
    for (const r of rows) onDemandDrafts.add(r.id);
  }

  const uploadBanner = opts.error
    ? `<div class="op-banner op-banner-error">${escapeHtml(opts.error)}</div>`
    : opts.ingested
      ? `<div class="op-banner">Uploaded ${escapeHtml(opts.ingested)} document${opts.ingested === "1" ? "" : "s"} — processing runs while this tab is open.</div>`
      : opts.queued
        ? `<div class="op-banner">${
            opts.queued === "0"
              ? "Nothing to queue — every document is processed or already waiting."
              : `Queued ${escapeHtml(opts.queued)} document${opts.queued === "1" ? "" : "s"}. Processing runs while this tab is open.`
          }</div>`
        : opts.renamed
          ? `<div class="op-banner">Title updated. The old one is kept on the row.</div>`
          : opts.published
            ? `<div class="op-banner">Answer published.</div>`
            : "";

  // Operator affordance strip — only rendered when logged in. Surfaces the
  // bulk extract action (the work behind it lives at POST /op/library/extract
  // and is unchanged). Spec v2.5 Part 9: same URL, controls woven in. Visual
  // treatment is deliberately minimal — a band, two buttons. The handoff doc
  // says "implement the model and leave the exact visual treatment for review".
  // THE PIPELINE, per document and in total. One table (piece_processing),
  // read once here for the status column, the counts line and the button.
  const procEnv = env as unknown as Env;
  const procRows =
    opts.isOperator && userId
      ? await processingRows(procEnv, userId)
      : new Map<string, ProcessingRow>();
  const procCounts =
    opts.isOperator && userId
      ? await processingCounts(procEnv, userId)
      : { queued: 0, running: 0, failed: 0, done: 0, unprocessed: 0 };
  const active = procCounts.queued + procCounts.running;

  let opStrip = "";
  if (opts.isOperator && userId) {
    // One button drives the whole queue; the poller presses /op/process/advance
    // while the tab is open. Hidden when there is nothing left to queue.
    const processBtn =
      procCounts.unprocessed > 0
        ? `<form method="POST" action="/op/process/all" style="display:inline;margin-right:8px">
  <button type="submit" class="op-strip-btn op-strip-btn-primary">Process everything (${procCounts.unprocessed})</button>
</form>`
        : "";
    // Pass 2 of on-demand research was dispatched only by the cron, so with
    // the cron off a run that finds follow-up queries parks at pass2_pending.
    // Shown unconditionally rather than gated on a count, because the cheap
    // thing to get wrong here is not knowing a run is stuck.
    const advanceBtn = `<form method="POST" action="/op/research/advance" style="display:inline;margin-right:8px">
  <button type="submit" class="op-strip-btn">Advance research</button>
</form>`;
    // The upload dropzone. This existed only on the old /op/library screen
    // (operator/screens/library.ts's dropzone()) before that screen was
    // redirected away into this same public page — the extract/re-extract
    // buttons made the trip over, the upload form never did, leaving no
    // reachable way to add a document at all. Same backend (POST
    // /op/feed/upload, unchanged), same auto-submit-on-choose behaviour.
    const dropzone = `<form method="POST" action="/op/feed/upload" enctype="multipart/form-data" id="feed-form" class="op-dropzone-form">
  <label class="op-dropzone" for="feed-file" id="op-dz-label">
    <div class="op-dz-1">Drop a document here, or click to choose</div>
    <div class="op-dz-2">Markdown · plain text · PDF · Word · a .zip of any of these</div>
    <input type="file" id="feed-file" name="file" accept=".md,.txt,.pdf,.docx,.zip,text/markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed" required style="display:none" />
  </label>
  <div class="op-dz-uploading" id="op-dz-uploading" hidden>Uploading — banking into the Library. You can leave this page.</div>
</form>
<script>
(function () {
  var form = document.getElementById("feed-form");
  var input = document.getElementById("feed-file");
  var label = document.getElementById("op-dz-label");
  var busy = document.getElementById("op-dz-uploading");
  if (!form || !input || !label || !busy) return;
  input.addEventListener("change", function () {
    if (!input.files || input.files.length === 0) return;
    label.setAttribute("hidden", "");
    busy.removeAttribute("hidden");
    if (form.dataset.submitting === "1") return;
    form.dataset.submitting = "1";
    form.submit();
  });
})();
</script>`;

    // Video-as-source-material (Phase 1, 2026-07-24): the same "drop it in,
    // no confirmation gauntlet" upload philosophy as the dropzone above,
    // pointed at a video URL instead of a file. POSTs to
    // /op/library/import-video, which fetches+transcribes via the video
    // Worker's Container and (once done) turns the transcript into a piece
    // exactly like an uploaded document — see graph/lib/video-intake.ts.
    const videoImportBanner = opts.videoError
      ? `<div class="op-banner op-banner-error">${escapeHtml(opts.videoError)}</div>`
      : "";
    const videoStatus = opts.importing
      ? renderLiveStatusBanner(
          `/op/library/import-video/${encodeURIComponent(opts.importing)}/status`,
          "Fetching and transcribing…",
        )
      : "";
    const videoImportForm = opts.importing
      ? ""
      : `<form method="POST" action="/op/library/import-video" class="op-video-form">
  <input type="url" name="url" placeholder="Paste a video URL to transcribe and add" required class="op-video-input" />
  <button type="submit" class="op-strip-btn">Import video</button>
</form>`;

    // UPLOADING IS THE POINT OF THIS PAGE, so it is the first thing on it.
    //
    // It used to sit under a row of five batch buttons — Process queue,
    // File into sections, Advance research, Extract all, Re-extract all —
    // which is five verbs of machinery in front of the one action the
    // operator came to perform. Those are real and stay reachable, but they
    // are maintenance, not the job, so they fold away behind a native
    // <details>. No JavaScript, so standing rule 7 holds.
    opStrip = `<div class="op-strip">
  ${dropzone}
  ${videoImportBanner}
  ${videoStatus}
  ${videoImportForm}
  <details class="op-more">
    <summary>Maintenance</summary>
    <div class="op-strip-actions">${processBtn}${advanceBtn}</div>
  </details>
</div>`;
  }

  // Proposed atoms, per document. Operator-only: these have no URL until they
  // pass the gate AND the operator publishes them, so this list is the only
  // place they are visible.
  const atomsByPiece = new Map<string, { findings: number; questions: QuestionReview[] }>();
  const ledeByPiece = new Map<string, { verbatim_text: string }>();
  if (opts.isOperator && userId) {
    const { all: allRows } = await import("../../lib/d1");
    const fRows = await allRows<{ piece_id: string; n: number }>(
      env.DB,
      "SELECT piece_id, COUNT(*) AS n FROM aeo_findings WHERE user_id = ? GROUP BY piece_id",
      [userId],
    ).catch(() => []);
    const qRows = await allRows<QuestionReview & { piece_id: string }>(
      env.DB,
      `SELECT DISTINCT e.piece_id, q.id, q.question, q.slug, q.status,
              (SELECT COUNT(*) FROM aeo_question_evidence e2 WHERE e2.question_id = q.id) AS evidence_count,
              (SELECT COALESCE(SUM(LENGTH(e3.answer_text) - LENGTH(REPLACE(e3.answer_text,' ','')) + 1), 0)
                 FROM aeo_question_evidence e3 WHERE e3.question_id = q.id) AS answer_words,
              (SELECT GROUP_CONCAT(DISTINCT e4.model)
                 FROM aeo_question_evidence e4 WHERE e4.question_id = q.id) AS models,
              CASE WHEN q.standing_answer IS NULL THEN 0 ELSE 1 END AS has_draft,
              q.answer_approved_at, q.contested
         FROM aeo_question_evidence e JOIN aeo_questions q ON q.id = e.question_id
        WHERE e.user_id = ?
        ORDER BY evidence_count DESC`,
      [userId],
    ).catch(() => []);
    const lRows = await allRows<{
      piece_id: string;
      verbatim_text: string;
      approved_at: string | null;
    }>(
      env.DB,
      `SELECT p.id AS piece_id, q.verbatim_text, p.lede_approved_at AS approved_at
         FROM pieces p JOIN quotes q ON q.id = p.lede_quote_id
        WHERE p.user_id = ?`,
      [userId],
    ).catch(() => []);
    for (const r of lRows) ledeByPiece.set(r.piece_id, r);
    for (const r of fRows) atomsByPiece.set(r.piece_id, { findings: r.n, questions: [] });
    for (const r of qRows) {
      const cur = atomsByPiece.get(r.piece_id) ?? { findings: 0, questions: [] };
      cur.questions.push(r);
      atomsByPiece.set(r.piece_id, cur);
    }
  }

  // The ingestion receipt, per document: what extraction actually read, what
  // survived verification, and where this document made the corpus strange.
  // Operator-only and computed on view — nothing caches it, nothing sweeps.
  const receipts =
    opts.isOperator && userId
      ? await (await import("../../graph/lib/ingestion-receipt"))
          .ingestionReceipts(env.DB, userId)
          .catch(() => new Map<string, IngestionReceipt>())
      : new Map<string, IngestionReceipt>();

  // The corpus-wide worklist: every lead, newest first, capped so the page
  // stays a page. Readings (docs/the-record.md §5c) — what the operator
  // noticed — sit in the same list as what the record noticed.
  let worklist: Lead[] = [];
  let resurfaced: ResurfacedPassage | null = null;
  if (opts.isOperator && userId) {
    resurfaced = await (await import("../../lib/resurface"))
      .resurfacePassage(env.DB, userId)
      .catch(() => null);
    const [leads, readings] = await Promise.all([
      (await import("../../graph/lib/leads"))
        .leadsForCorpus(env.DB, userId, { limit: 30 })
        .catch(() => [] as Lead[]),
      (await import("../../lib/readings"))
        .readingsAsLeads(env.DB, userId, { limit: 20 })
        .catch(() => [] as Lead[]),
    ]);
    worklist = [...leads, ...readings].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  // Stored answers for whatever leads those receipts carry. One query for all
  // of them, keyed by the lead's own identity — see leads.ts's answer_key.
  const leadKeys = [...[...receipts.values()].flatMap((r) => r.leads), ...worklist]
    .map((l) => l.answer_key)
    .filter((k): k is string => !!k);
  const leadAnswers =
    opts.isOperator && userId && leadKeys.length
      ? await (await import("../../graph/lib/answer-lead"))
          .answersForLeads(env.DB, userId, leadKeys)
          .catch(() => new Map<string, LeadAnswer>())
      : new Map<string, LeadAnswer>();

  // CONSOLIDATION, per processed row, and LINEAGE for the tree. Both are
  // queries over what is already stored; each is one batch for the page.
  const doneIds = [...procRows.values()].filter((r) => r.status === "done").map((r) => r.piece_id);
  const consolidation =
    opts.isOperator && userId && doneIds.length
      ? await consolidationSummaries(env.DB, userId, doneIds).catch(
          () => new Map<string, ConsolidationSummary>(),
        )
      : new Map<string, ConsolidationSummary>();
  const lineage =
    opts.isOperator && userId
      ? await lineageForPieces(env.DB, userId).catch(() => new Map<string, Lineage>())
      : new Map<string, Lineage>();

  // WORKING TITLES. Candidates are computed here rather than stored, for the
  // handful of rows that need them: the function is pure and cheap, so a
  // stored column would only add a backfill and a way to go stale against an
  // edited body. Bodies are fetched for the flagged pieces alone.
  const flagged = opts.isOperator
    ? pieces.filter((p) => !p.title_auto_at && looksLikeWorkingTitle(p.title)).slice(0, 12)
    : [];
  const candidatesByPiece = new Map<string, string[]>();
  if (flagged.length && userId) {
    const { all: allBodies } = await import("../../lib/d1");
    const placeholders = flagged.map(() => "?").join(",");
    const bodies = await allBodies<{ id: string; body_md: string | null }>(
      env.DB,
      `SELECT id, body_md FROM pieces WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...flagged.map((p) => p.id)],
    ).catch(() => []);
    for (const b of bodies) {
      const cands = titleCandidates(b.body_md ?? "");
      if (cands.length) candidatesByPiece.set(b.id, cands);
    }
  }

  // WHAT THESE QUESTIONS ACTUALLY ARE — and what they are not.
  //
  // This block used to be headed "Questions the documents raised and cannot
  // answer", with a "Research this" button on every row. Both were false, and
  // the extractor's own prompt says so in as many words:
  //
  //     "questions" — questions a person would genuinely type into a search
  //     box, THAT THIS DOCUMENT ANSWERS. […] Do not ask questions the document
  //     cannot answer.
  //
  // So every row here arrives with its answer attached — openQuestions cannot
  // even return one without evidence, since evidence_count counts the answer
  // passages. Pressing "Research this" then told the writer "the record has N
  // documents touching this but cannot answer it; find what is missing", and
  // sent it to research a question the document it came from already answers.
  // What came back was a thinner copy of that document.
  //
  // The operator found this from the outside, from behaviour alone: "the
  // question I was asking to get that research report was a question that the
  // system detected the research report was trying to find… but that's also
  // what that research article is, so what if I build another one, what's
  // that gonna do?" Nothing. It returns to where it started.
  //
  // The rows are not wrong, they were mislabelled. A question carrying its own
  // answer is an INDEX of what the document establishes — real value, and what
  // the FAQ structured data is built from. It is not a worklist.
  //
  // Real leads come from ABSENCE, and they already render per document above:
  // "NO SOURCE NAMED" (a figure with no attribution anywhere in the corpus)
  // and "SOURCES DISAGREE" (two documents that contradict each other), each
  // with its own DIG HERE. Those are the queue. See graph/lib/leads.ts.
  const { openQuestions } = await import("../../graph/lib/standing-answer");
  const open =
    opts.isOperator && userId ? await openQuestions(env.DB, userId, 12).catch(() => []) : [];

  const queueBlock = open.length
    ? `<section class="op-queue wb-sec" id="answers">
  <div class="op-queue-head">Questions these documents answer
    <span class="op-queue-note">Extracted with the passage that answers each one, and used for the FAQ structured data. Not a to-do list — what to chase shows on each document above, as a lead.</span>
  </div>
  <ul class="op-queue-list">
${open
  .map(
    (q) => `    <li>
      <span class="atom-q">${escapeHtml(q.question)}</span>
      <span class="atom-meta">answered in ${q.sources} document${q.sources === 1 ? "" : "s"} · ${q.evidence_count} quote${q.evidence_count === 1 ? "" : "s"}${q.has_draft ? " · drafted" : ""}</span>
    </li>`,
  )
  .join("\n")}
  </ul>
</section>`
    : "";

  // THE POST-UPLOAD BANNER: the document(s) just uploaded, at the top of the
  // list, live now, with the pipeline's status and — once the row is done —
  // how the record has taken them in. Everything it shows is already
  // computed for the rows below; it is the same cell, the same line, the
  // same buttons, in one more place.
  const uploadedIds = opts.uploaded
    ? opts.uploaded
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, UPLOAD_BANNER_MAX)
    : [];
  const uploadedBanner =
    opts.isOperator && uploadedIds.length
      ? renderUploadBanner(
          uploadedIds
            .map((id) => pieces.find((p) => p.id === id))
            .filter((p): p is (typeof pieces)[number] => !!p),
          { procRows, consolidation, receipts, leadAnswers },
        )
      : "";

  const rows = pieces.length
    ? pieces
        .map((p) => {
          const isOnDemandDraft =
            p.publication_status === "working-material" && onDemandDrafts.has(p.id);
          const isPublished =
            p.publication_status === "published" || p.publication_status === "canonical";
          // The status column is the PIPELINE's status. Publication state is
          // only worth a chip when it is not the default — upload is
          // publication, so "published" said nothing.
          const pubChip = isOnDemandDraft
            ? ` <span class="chip">draft — awaiting review</span>`
            : p.publication_status === "working-material"
              ? ` <span class="chip">working material</span>`
              : "";
          const proc = procRows.get(p.id);
          const status = opts.isOperator
            ? `${renderProcessingCell(p.id, proc)}${pubChip}`
            : pubChip.trim() || `<span class="chip">published</span>`;
          const href = isOnDemandDraft
            ? `/op/library/research/${escapeHtml(p.id)}/review`
            : p.publication_status === "working-material"
              ? ""
              : `/library/${escapeHtml(p.slug)}`;
          const isRawFilename = looksLikeMachineFilename(p.title);
          const displayTitle = isRawFilename ? "Untitled research document" : p.title;
          const rawFilenameLine = isRawFilename
            ? `<div class="lib-title-raw">${escapeHtml(p.title)}</div>`
            : "";
          const title = href
            ? `<a href="${href}" class="ac">${escapeHtml(displayTitle)}</a>${rawFilenameLine}`
            : `${escapeHtml(displayTitle)}${rawFilenameLine}`;
          const atoms = atomsByPiece.get(p.id);
          const atomBlock =
            opts.isOperator && isPublished ? renderAtomReview(atoms, ledeByPiece.get(p.id)) : "";
          const receiptBlock = opts.isOperator
            ? renderReceipt(receipts.get(p.id), leadAnswers) +
              (proc?.status === "done" ? renderConsolidation(consolidation.get(p.id)) : "")
            : "";
          const lineageBlock = opts.isOperator ? renderLineage(lineage.get(p.id)) : "";
          const actions = opts.isOperator && isPublished ? renderRowActions(p.id, proc) : "";
          // A pipeline rename shows the original with a way back; the
          // suggestion box is only for a working title the pipeline could not
          // improve on (it had no candidate), so the two never stack.
          const titleBlock = opts.isOperator
            ? p.title_auto_at
              ? renderAutoTitle(p.id, p.original_title)
              : renderRename(p.id, p.title, candidatesByPiece.get(p.id))
            : "";
          return `<tr>
  <td>${title}${lineageBlock}${titleBlock}${renderLintNotes(p.metadata)}${receiptBlock}${atomBlock}${actions}</td>
  <td><span class="coord">${escapeHtml(kindLabel(p.kind))}</span></td>
  <td class="lib-status">${status}</td>
  <td><span class="coord">${p.published_at ? escapeHtml(formatDate(p.published_at)) : "—"}</span></td>
</tr>`;
        })
        .join("")
    : "";

  // One line above the table: what the pipeline is doing right now. The
  // poller writes into it; data-lib-active is what tells the poller to start.
  const queueParts = [
    procCounts.queued ? `${procCounts.queued} queued` : "",
    procCounts.running ? `${procCounts.running} processing` : "",
    procCounts.failed ? `${procCounts.failed} failed` : "",
  ].filter(Boolean);
  const queueLine = opts.isOperator
    ? `<p id="lib-queue" class="lib-queue" data-lib-active="${active}"${queueParts.length ? "" : " hidden"}>${escapeHtml(queueParts.join(" · "))}</p>`
    : "";

  const table = pieces.length
    ? `<table class="lib-table">
  <thead><tr>
    <th class="label">Title</th>
    <th class="label">Kind</th>
    <th class="label">Status</th>
    <th class="label">Date</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`
    : emptyState(
        "No documents yet. Once research reports are dropped into the Library, every one will land here with what it fed showing in its row.",
      );

  // THE WEIGHT BAND IS GONE. It ran across the top: 57 source documents,
  // 8,642 facts extracted, 4,712 subject pages fed, 1,682 open threads.
  //
  // Same trade as the state strip deleted from the front page, and the same
  // verdict. Two of those numbers mean nothing to the person reading them —
  // "subject pages fed" and "open threads" measure internals, not work — and
  // all four pushed the upload box and the documents below the fold on the
  // one page that exists to do a job. Per-document counts already live in
  // each row's receipt, where they answer a question somebody has.

  // Which model does the reading. Named on the page rather than assumed:
  // Claude through Cloudflare's AI Gateway when the gateway is configured,
  // Workers AI otherwise — and "not configured" is said, never hidden behind a
  // quiet downgrade (docs/the-record.md §3).
  const inUse = modelInUse(env);
  const modelLine = opts.isOperator
    ? `<p class="lib-model${inUse.configured ? "" : " lib-model-fallback"}"><span class="label">Model</span> ${escapeHtml(inUse.label)}</p>`
    : "";

  const body = `
<header class="phead">
  <div class="eyebrow">The raw research</div>
  <h1>Library</h1>
  <p class="phead-dek">
    Every document the rest is built on, kept whole. Each row shows what it fed —
    facts extracted, subjects it touched. Working material feeds the rest but
    doesn't get its own public page.
  </p>
  ${modelLine}
</header>
<div class="wb">
<nav class="wb-rail" aria-label="Library sections">
  <a href="#upload">Upload</a>
  <a href="#documents">Documents <span class="wb-n">${pieces.length}</span></a>
  <a href="#op-wants">Worklist</a>
  <a href="/op/research">Research</a>
</nav>
<div class="wb-main">
<section class="wb-sec" id="upload">
${uploadBanner}
${opStrip}
</section>
<section class="wb-sec" id="documents">${sectionHeader(`All material (${pieces.length})`)}${uploadedBanner}${queueLine}${table}</section>
${opts.isOperator ? renderWorklist(worklist, leadAnswers, resurfaced) : ""}
${queueBlock}
</div>
</div>
${opts.isOperator ? PROCESS_LIVE_JS : ""}
`;
  return renderPage({
    title: "Library",
    description:
      "Every source document the rest is built on. Each row shows what it fed — facts extracted, subjects it touched.",
    body,
    activeNav: "/library",
    zone: "library",
  });
}
