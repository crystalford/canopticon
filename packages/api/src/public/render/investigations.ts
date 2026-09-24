// Investigations — the signed-analysis index + the Library (raw research
// archive). The piece page itself is rendered by piece-template.ts, not
// here — see that file for the public face of a single document.

import type { LeadAnswer } from "../../graph/lib/answer-lead";
import type { Lead } from "../../graph/lib/leads";
import { type PublicEnv, listInvestigations, resolveOperatorId } from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";
import {
  HAS_ANYONE_SAID_THIS_ANGLE,
  type LibraryAction,
  type LibraryConsolidation,
  type LibraryLead,
  type LibraryLeadAnswer,
  type LibraryLineage,
  type LibraryLintNote,
  type LibraryModel,
  type LibraryQuestion,
  type LibraryReceipt,
  type LibraryResurfaced,
  type LibraryRowModel,
  type LibraryStatus,
  type LibraryUploaded,
  emptyLibraryModel,
  leadAnswerView,
  leadView,
  libraryModel,
} from "../models/library";
import { emptyState, formatDate, pieceCard, sectionHeader } from "./components";
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

// Library — the operator's workbench. Everything it shows is gathered ONCE by
// public/models/library.ts (libraryModel) and rendered from that model here;
// GET /library.json serves the same model, so a front end built against it
// sees exactly what this page sees. Nothing below runs a query.
//
// A stored piece's title is sometimes the raw upload filename — e.g.
// "compass_artifact_wf-c96cfa7c-3f5d-…_text_markdown.md" — when the
// operator dropped a file whose name was never meant to be read. The model
// swaps in a plain placeholder and keeps the real filename visible
// underneath in mono, never hidden.

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
  findings: number,
  questions: LibraryQuestion[],
  lede: string | null,
): string {
  const ledeLine = lede
    ? `<div class="atom-lede"><span class="atom-lede-k">Lead passage:</span> ${escapeHtml(lede)}</div>`
    : "";
  // FOLDED. A native <details>, so nothing here needs JavaScript (rule 7).
  const fold = (inner: string, label: string) =>
    `<details class="atom-more"><summary>${escapeHtml(label)}</summary>${inner}</details>`;

  if (findings === 0 && questions.length === 0) {
    return lede ? fold(`<div class="atoms">${ledeLine}</div>`, "Lead passage") : "";
  }
  const rows = questions
    .map((q) => {
      // The route to a page now runs Draft -> Approve -> Publish, so the
      // action shown is whichever step is actually next. A single "Publish"
      // button that silently refuses is worse than no button.
      const draftAction =
        q.draftStep === "approve"
          ? `<form method="POST" action="/op/answers/${escapeHtml(q.id)}/draft/approve" style="display:inline"><button type="submit" class="atom-pub">Approve answer</button></form>`
          : q.draftStep === "draft"
            ? `<form method="POST" action="/op/answers/${escapeHtml(q.id)}/draft" style="display:inline"><button type="submit" class="atom-run">Draft answer</button></form>`
            : "";
      const action =
        q.publishStep === "live"
          ? `<span class="atom-live">live</span>`
          : q.publishStep === "publish"
            ? `<form method="POST" action="/op/answers/${escapeHtml(q.id)}/publish" style="display:inline"><button type="submit" class="atom-pub">Publish</button></form>`
            : `<span class="atom-blocked" title="${escapeHtml(q.heldReason ?? "")}">held</span>`;
      const by = q.models.length ? ` · ${escapeHtml(q.models.join(", "))}` : "";
      const flag = q.contested ? ` <span class="atom-contested">contested</span>` : "";
      return `    <li><span class="atom-q">${escapeHtml(q.question)}</span>${flag}
      <span class="atom-meta">${q.evidenceCount} source${q.evidenceCount === 1 ? "" : "s"} · ${q.answerWords}w${by}</span>
      ${draftAction}${action}</li>`;
    })
    .join("\n");
  return fold(
    `<div class="atoms">
  ${ledeLine}
  <div class="atom-head"><b>${findings}</b> finding${findings === 1 ? "" : "s"} · <b>${questions.length}</b> question${questions.length === 1 ? "" : "s"}</div>
  ${questions.length ? `<ul class="atom-list">\n${rows}\n  </ul>` : ""}
</div>`,
    `${findings} finding${findings === 1 ? "" : "s"} · ${questions.length} question${questions.length === 1 ? "" : "s"}`,
  );
}

/**
 * THE PIPELINE STATUS, per row. One line from describeProcessing() (via the
 * model); the poller (process-live.ts) rewrites the same cell by its
 * data-piece, so the server and the script paint the one shape.
 */
function renderProcessingCell(pieceId: string, s: LibraryStatus): string {
  // The model that did the work rides along as a tooltip — it is recorded on
  // the row so a comparison between two runs survives the page.
  return `<span class="lib-st lib-st-${s.state}" data-piece="${escapeAttr(pieceId)}"${
    s.model ? ` title="${escapeAttr(s.model)}"` : ""
  }>${escapeHtml(s.text)}</span>`;
}

/** Re-process always; Retry only when the row failed; a new version always. */
function renderRowActions(actions: LibraryAction[]): string {
  if (!actions.length) return "";
  const parts = actions.map((a) => {
    if (a.kind === "replace") {
      // A new version (docs/the-record.md §4): the body is replaced, the slug
      // and date stay, the pipeline re-runs, the previous source is kept.
      const file = a.fields.find((f) => f.type === "file");
      return `<details class="lib-replace" style="display:inline"><summary>${escapeHtml(a.label)}</summary><form method="POST" action="${escapeAttr(a.action)}" enctype="multipart/form-data" style="display:inline"><input type="file" name="${escapeAttr(file?.name ?? "file")}" accept="${escapeAttr(file?.accept ?? "")}" required> <button type="submit" class="atom-run">Replace</button></form></details>`;
    }
    const cls = a.kind === "retry" ? "atom-pub" : "atom-run";
    return `<form method="POST" action="${escapeAttr(a.action)}" style="display:inline"><button type="submit" class="${cls}">${escapeHtml(a.label)}</button></form>`;
  });
  return `<div class="lib-actions">${parts.join("")}</div>`;
}

/**
 * A title the pipeline replaced. The original is kept on the row and one
 * click puts it back (docs/the-record.md §4: the rename is reversible from
 * the row; the slug never changes).
 */
function renderAutoTitle(pieceId: string, original: string | null): string {
  if (!original) return "";
  return `<div class="lib-retitled">Renamed from “${escapeHtml(original)}” by the pipeline
  <form method="POST" action="/op/pieces/${escapeAttr(pieceId)}/title/revert" style="display:inline"><button type="submit" class="atom-run">Put it back</button></form></div>`;
}

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
function renderRename(pieceId: string, current: string, candidates: string[]): string {
  if (!candidates.length) return "";
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
function renderReceipt(r: LibraryReceipt | null, leads: LibraryLead[]): string {
  // Not extracted is a STATE, and it is the one that tells the operator to
  // press a button — so it is rendered, not omitted. It must also be rendered
  // HERE rather than by a second block: the row used to carry a separate
  // "fed the fabric" cell fed by its own query, and the two could disagree.
  if (!r) return `<div class="rcpt"><span class="rcpt-none">Not extracted yet.</span></div>`;
  const coverage = r.truncated
    ? `<span class="rcpt-gap">Read the first ${r.charsRead.toLocaleString()} of ${r.charsTotal.toLocaleString()} characters (${r.percent}%) — the rest was never looked at.</span>`
    : `<span class="rcpt-full">Read in full — ${r.charsTotal.toLocaleString()} characters.</span>`;

  const counts = [
    `<b>${r.verifiedSpans}</b> verified span${r.verifiedSpans === 1 ? "" : "s"}`,
    r.facts > 0 ? `<b>${r.facts}</b> fact${r.facts === 1 ? "" : "s"}` : "",
    r.figures > 0 ? `<b>${r.figures}</b> figure${r.figures === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return `<div class="rcpt">
  <div class="rcpt-line">${coverage}</div>
  <div class="rcpt-line rcpt-counts">${counts}</div>
  ${renderLeads(leads)}
</div>`;
}

/**
 * A lead's answer, rendered under the lead it settles.
 *
 * Small on purpose. The whole argument for this artifact is that it can be
 * CHECKED rather than trusted: three sentences and up to four quotes, each one
 * already located verbatim in a stored document, each linking to that
 * document. If it takes longer than half a minute to verify, it has failed at
 * the thing it exists to do.
 */
function renderLeadAnswer(a: LibraryLeadAnswer | null): string {
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
        ${a.answerMd ? `<p>${escapeHtml(a.answerMd)}</p>` : ""}
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
        <p>${escapeHtml(a.answerMd ?? "")}</p>
        <ul class="lead-ans-quotes">
${quotes}
        </ul>
        ${discardLine(a)}
      </div>\n`;
}

/** Which model wrote it — the whole point of a per-run toggle is comparing. */
function modelTag(a: LibraryLeadAnswer): string {
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
function discardLine(a: LibraryLeadAnswer): string {
  if (!a.discarded) return "";
  return `<span class="lead-ans-disc">${a.discarded} proposed quote${
    a.discarded === 1 ? "" : "s"
  } discarded for not matching any document word for word</span>`;
}

/** Exported for tests: the block is where the answer's honesty is enforced. */
export const renderLeadAnswerForTest = (a: LeadAnswer | undefined): string =>
  renderLeadAnswer(leadAnswerView(a));

export { HAS_ANYONE_SAID_THIS_ANGLE };

/**
 * The dig button. The seed and angle ride along in the form because a lead
 * is a query result, not a stored row — and the angle is what makes the run
 * worth starting: a run seeded with a bare topic returns a topic's worth of
 * material. piece_id becomes the run's parent (§5), kind its origin.
 */
function digForm(l: LibraryLead, verb: string, angle: string): string {
  return `
      <form method="POST" action="/op/leads/dig" class="lead-dig-form">
        <input type="hidden" name="seed" value="${escapeAttr(l.seed)}" />
        <input type="hidden" name="angle" value="${escapeAttr(angle)}" />
        <input type="hidden" name="kind" value="${escapeAttr(l.kind)}" />
        <input type="hidden" name="piece_id" value="${escapeAttr(l.pieceId)}" />
        <input type="hidden" name="piece_slug" value="${escapeAttr(l.pieceSlug ?? "")}" />
        <input type="hidden" name="other_slug" value="${escapeAttr(l.otherSlug ?? "")}" />
        <button type="submit" class="lead-dig">${escapeHtml(verb)} →</button>
        <label class="lead-writer"><input type="checkbox" name="writer" value="anthropic" /> with Claude</label>
      </form>`;
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
function renderLeads(leads: LibraryLead[], opts: { showPiece?: boolean } = {}): string {
  if (!leads.length) return "";
  const items = leads
    .map((l) => {
      // In the corpus-wide worklist a lead must say which document it came
      // out of; under a document's own receipt that is already the row.
      const piece =
        opts.showPiece && l.pieceSlug
          ? ` <a class="lead-piece" href="/library/${escapeAttr(l.pieceSlug)}">${escapeHtml(l.pieceTitle ?? l.pieceSlug)}</a>`
          : "";
      const other =
        (l.kind === "contradiction" || l.kind === "bridge") && l.otherSlug
          ? ` <a class="lead-other" href="/library/${escapeAttr(l.otherSlug)}">${escapeHtml(l.otherTitle ?? "the other document")}</a>`
          : "";
      const receipt = l.quoteId
        ? ` <a class="lead-receipt" href="/q/${escapeAttr(l.quoteId)}">quote ↗</a>`
        : "";
      const dig = l.digs.map((d) => digForm(l, d.verb, d.angle)).join("");
      return `    <li class="lead lead-${escapeAttr(l.kind)}">
      <span class="lead-k">${escapeHtml(l.label)}</span>
      <span class="lead-sum">${escapeHtml(l.summary)}</span>${piece}${other}${receipt}${dig}
${renderLeadAnswer(l.answer)}    </li>`;
    })
    .join("\n");
  return `<ul class="lead-list">
${items}
  </ul>`;
}

/** Exported for tests: the two-button bridge and the per-kind labels. */
export const renderLeadsForTest = (
  leads: Lead[],
  answers?: Map<string, LeadAnswer>,
  opts: { showPiece?: boolean } = {},
): string =>
  renderLeads(
    leads.map((l) => leadView(l, answers)),
    opts,
  );

/**
 * WHAT THE RECORD WANTS — the worklist (docs/the-record.md §6, part 3).
 *
 * Recent-first and never by frequency. Every entry is a query result with the
 * document(s) it came out of and the one action that follows it.
 */
function renderWorklist(leads: LibraryLead[], resurfaced: LibraryResurfaced | null): string {
  const list = leads.length
    ? renderLeads(leads, { showPiece: true })
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
function renderResurfaced(r: LibraryResurfaced | null): string {
  if (!r) return "";
  return `<div class="resurfaced" id="resurfaced">
    <div class="op-queue-head">Resurfaced today</div>
    <blockquote><a href="/q/${escapeAttr(r.quoteId)}">${escapeHtml(r.text)}</a></blockquote>
    <p class="resurfaced-from">from <a href="/p/${escapeAttr(r.pieceSlug)}">${escapeHtml(r.pieceTitle)}</a></p>
    <form method="POST" action="/op/readings" class="resurfaced-note">
      <input type="hidden" name="piece_id" value="${escapeAttr(r.pieceId)}" />
      <input type="hidden" name="passage" value="${escapeAttr(r.text)}" />
      <textarea name="note" rows="2" placeholder="Note this — what it asks for, doubts, or is missing" required></textarea>
      <button type="submit" class="atom-run">Note this</button>
    </form>
    <form method="POST" action="/op/leads/dig" class="lead-dig-form">
      <input type="hidden" name="seed" value="${escapeAttr(r.text)}" />
      <input type="hidden" name="angle" value="${escapeAttr(r.angle)}" />
      <input type="hidden" name="kind" value="question" />
      <input type="hidden" name="piece_id" value="${escapeAttr(r.pieceId)}" />
      <input type="hidden" name="piece_slug" value="${escapeAttr(r.pieceSlug)}" />
      <button type="submit" class="lead-dig">Research this →</button>
    </form>
  </div>`;
}

/**
 * What just happened, where it happened. After an upload the operator lands
 * here, and the page's first line about the new document(s) is: it is live
 * at its URL (upload IS publication), the pipeline is at this step, and —
 * when the pipeline has finished — this is what the record made of it.
 *
 * Each part is the SAME renderer the row below uses: the status cell carries
 * the row's data-piece so the poller (process-live.ts) repaints both; the
 * consolidation line and the leads are the row's own, and the model only
 * fills them once the row is done, because before that the record has not
 * read the document. Nothing here is a second copy of a number.
 */
function renderUploadBanner(uploaded: LibraryUploaded[]): string {
  if (!uploaded.length) return "";
  const items = uploaded
    .map(
      (p) => `<li class="uploaded-doc" data-uploaded="${escapeAttr(p.id)}">
  <a href="/p/${escapeAttr(p.slug)}" class="uploaded-title">${escapeHtml(p.title)}</a>
  <span class="uploaded-live">Published — live now</span>
  ${renderProcessingCell(p.id, p.status)}
  ${renderConsolidation(p.consolidation)}${renderLeads(p.leads)}
</li>`,
    )
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
 * the record. The model only carries it for a row the pipeline has finished —
 * before that the counts would describe a document the record has not read.
 */
function renderConsolidation(s: LibraryConsolidation | null): string {
  if (!s) return "";
  return `<div class="rcpt-line rcpt-consol">${escapeHtml(s.line)}</div>`;
}

/** Lineage (§5): where a document grew from, and how many grew from it. */
function renderLineage(l: LibraryLineage | null): string {
  if (!l) return "";
  const parts: string[] = [];
  if (l.parentId) {
    const name = escapeHtml(l.parentTitle ?? l.parentSlug ?? "a document");
    parts.push(
      l.parentSlug
        ? `Grew from <a class="ac" href="/library/${escapeAttr(l.parentSlug)}">${name}</a>`
        : `Grew from ${name}`,
    );
  }
  if (l.branches > 0) parts.push(`${l.branches} branch${l.branches === 1 ? "" : "es"}`);
  if (!parts.length) return "";
  const origin = l.origin ? ` <span class="lib-lineage-origin">${escapeHtml(l.origin)}</span>` : "";
  return `<div class="lib-lineage">${parts.join(" · ")}${origin}</div>`;
}

// Essay lint notes, written into the piece's metadata at upload time. Shown
// here rather than only on the upload confirmation, which is seen once and
// then gone. Advisory — the piece published regardless.
function renderLintNotes(notes: LibraryLintNote[] | null): string {
  if (!notes?.length) return "";
  return `<details class="lint">
  <summary>${notes.length} note${notes.length === 1 ? "" : "s"} on this essay's structure</summary>
  <ul>${notes.map((n) => `<li>${escapeHtml(n.message)}</li>`).join("")}</ul>
</details>`;
}

/** One row of "All material". */
function renderRow(r: LibraryRowModel, operator: boolean): string {
  const pubChip = r.chip ? ` <span class="chip">${escapeHtml(r.chip)}</span>` : "";
  // The status column is the PIPELINE's status. Publication state is only
  // worth a chip when it is not the default — upload is publication, so
  // "published" said nothing.
  const status = operator ? `${renderProcessingCell(r.id, r.status)}${pubChip}` : pubChip.trim();
  const rawFilenameLine = r.rawFilename
    ? `<div class="lib-title-raw">${escapeHtml(r.rawFilename)}</div>`
    : "";
  const title = r.href
    ? `<a href="${escapeAttr(r.href)}" class="ac">${escapeHtml(r.title)}</a>${rawFilenameLine}`
    : `${escapeHtml(r.title)}${rawFilenameLine}`;
  const atomBlock =
    operator && r.isPublished ? renderAtomReview(r.findings, r.questions, r.leadPassage) : "";
  const receiptBlock = operator
    ? renderReceipt(r.receipt, r.leads) + renderConsolidation(r.consolidation)
    : "";
  const lineageBlock = operator ? renderLineage(r.lineage) : "";
  const actions = renderRowActions(r.actions);
  // A pipeline rename shows the original with a way back; the suggestion box
  // is only for a working title the pipeline could not improve on (it had no
  // candidate), so the two never stack.
  const titleBlock = r.workingTitle
    ? r.workingTitle.original !== null
      ? renderAutoTitle(r.id, r.workingTitle.original)
      : renderRename(r.id, r.title, r.workingTitle.candidates)
    : "";
  return `<tr>
  <td>${title}${lineageBlock}${titleBlock}${renderLintNotes(r.essayLint)}${receiptBlock}${atomBlock}${actions}</td>
  <td><span class="coord">${escapeHtml(r.kindLabel)}</span></td>
  <td class="lib-status">${status}</td>
  <td><span class="coord">${r.date ? escapeHtml(formatDate(r.date)) : "—"}</span></td>
</tr>`;
}

/** The upload strip: dropzone, video import, and the folded Maintenance panel. */
function renderOpStrip(m: LibraryModel): string {
  // One button drives the whole queue; the poller presses /op/process/advance
  // while the tab is open. Hidden when there is nothing left to queue.
  const processBtn =
    m.maintenance.processEverything.count > 0
      ? `<form method="POST" action="/op/process/all" style="display:inline;margin-right:8px">
  <button type="submit" class="op-strip-btn op-strip-btn-primary">Process everything (${m.maintenance.processEverything.count})</button>
</form>`
      : "";
  // Pass 2 of on-demand research was dispatched only by the cron, so with
  // the cron off a run that finds follow-up queries parks at pass2_pending.
  // Shown unconditionally rather than gated on a count, because the cheap
  // thing to get wrong here is not knowing a run is stuck.
  const advanceBtn = m.maintenance.advanceResearch
    ? `<form method="POST" action="/op/research/advance" style="display:inline;margin-right:8px">
  <button type="submit" class="op-strip-btn">Advance research</button>
</form>`
    : "";
  // The upload dropzone. Same backend (POST /op/feed/upload), auto-submits
  // on choose.
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

  // Video-as-source-material: the same "drop it in, no confirmation
  // gauntlet" philosophy, pointed at a video URL. POSTs to
  // /op/library/import-video — see graph/lib/video-intake.ts.
  const videoImportBanner = m.videoError
    ? `<div class="op-banner op-banner-error">${escapeHtml(m.videoError)}</div>`
    : "";
  const videoStatus = m.importing
    ? renderLiveStatusBanner(
        `/op/library/import-video/${encodeURIComponent(m.importing)}/status`,
        "Fetching and transcribing…",
      )
    : "";
  const videoImportForm = m.importing
    ? ""
    : `<form method="POST" action="/op/library/import-video" class="op-video-form">
  <input type="url" name="url" placeholder="Paste a video URL to transcribe and add" required class="op-video-input" />
  <button type="submit" class="op-strip-btn">Import video</button>
</form>`;

  // UPLOADING IS THE POINT OF THIS PAGE, so it is the first thing on it. The
  // batch buttons are maintenance, not the job, so they fold away behind a
  // native <details>. No JavaScript, so standing rule 7 holds.
  return `<div class="op-strip">
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

/** The page, from the model. Exported so a test can render a model it built. */
export function renderLibraryFromModel(m: LibraryModel): string {
  const operator = m.operator;

  const uploadBanner = m.notice
    ? `<div class="op-banner${m.notice.kind === "error" ? " op-banner-error" : ""}">${escapeHtml(m.notice.text)}</div>`
    : "";

  const opStrip = operator ? renderOpStrip(m) : "";

  // Questions these documents answer: an INDEX of what the documents
  // establish (and what the FAQ structured data is built from), not a
  // worklist — see graph/lib/standing-answer.ts openQuestions for the
  // history. Real leads come from ABSENCE and render per document above.
  const queueBlock = m.answered.length
    ? `<section class="op-queue wb-sec" id="answers">
  <div class="op-queue-head">Questions these documents answer
    <span class="op-queue-note">Extracted with the passage that answers each one, and used for the FAQ structured data. Not a to-do list — what to chase shows on each document above, as a lead.</span>
  </div>
  <ul class="op-queue-list">
${m.answered
  .map(
    (q) => `    <li>
      <span class="atom-q">${escapeHtml(q.question)}</span>
      <span class="atom-meta">answered in ${q.sources} document${q.sources === 1 ? "" : "s"} · ${q.evidenceCount} quote${q.evidenceCount === 1 ? "" : "s"}${q.hasDraft ? " · drafted" : ""}</span>
    </li>`,
  )
  .join("\n")}
  </ul>
</section>`
    : "";

  const uploadedBanner = operator ? renderUploadBanner(m.uploaded) : "";

  const rows = m.rows.map((r) => renderRow(r, operator)).join("");

  // One line above the table: what the pipeline is doing right now. The
  // poller writes into it; data-lib-active is what tells the poller to start.
  const queueParts = [
    m.counts.queued ? `${m.counts.queued} queued` : "",
    m.counts.processing ? `${m.counts.processing} processing` : "",
    m.counts.failed ? `${m.counts.failed} failed` : "",
  ].filter(Boolean);
  const queueLine = operator
    ? `<p id="lib-queue" class="lib-queue" data-lib-active="${m.counts.active}"${queueParts.length ? "" : " hidden"}>${escapeHtml(queueParts.join(" · "))}</p>`
    : "";

  const table = m.rows.length
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
  // 8,642 facts extracted, 4,712 subject pages fed, 1,682 open threads. Two
  // of those numbers meant nothing to the person reading them, and all four
  // pushed the upload box below the fold. Per-document counts live in each
  // row's receipt, where they answer a question somebody has.

  // Which model does the reading. Named on the page rather than assumed, and
  // "not configured" is said, never hidden behind a quiet downgrade.
  const modelLine = operator
    ? `<p class="lib-model${m.model.gatewayConfigured ? "" : " lib-model-fallback"}"><span class="label">Model</span> ${escapeHtml(m.model.name)}</p>`
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
  <a href="#documents">Documents <span class="wb-n">${m.counts.documents}</span></a>
  <a href="#op-wants">Worklist</a>
  <a href="${escapeAttr(m.research.href)}">Research</a>
</nav>
<div class="wb-main">
<section class="wb-sec" id="upload">
${uploadBanner}
${opStrip}
</section>
<section class="wb-sec" id="documents">${sectionHeader(`All material (${m.counts.documents})`)}${uploadedBanner}${queueLine}${table}</section>
${operator ? renderWorklist(m.worklist, m.resurfaced) : ""}
${queueBlock}
</div>
</div>
${operator ? PROCESS_LIVE_JS : ""}
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
  const model: LibraryModel = userId
    ? await libraryModel(env, { ...opts, userId, isOperator: opts.isOperator === true })
    : emptyLibraryModel(env, { ...opts, isOperator: opts.isOperator === true });
  return renderLibraryFromModel(model);
}
