// Investigations — the signed-analysis index + the Library (raw research
// archive). The piece page itself is rendered by piece-template.ts, not
// here — see that file for the public face of a single document.

import type { LeadAnswer } from "../../graph/lib/answer-lead";
import type { IngestionReceipt } from "../../graph/lib/ingestion-receipt";
import type { Lead } from "../../graph/lib/leads";
import * as GATE from "../../lib/aeo";
import { looksLikeMachineFilename, looksLikeWorkingTitle } from "../../lib/title";
import { titleCandidates } from "../../lib/title-candidates";
import { modelForRole } from "../../llm/router";
import { type PublicEnv, listInvestigations, resolveOperatorId } from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";
import { emptyState, formatDate, kindLabel, pieceCard, sectionHeader } from "./components";
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

/**
 * Models worth trying, as autocomplete hints only — the field takes anything.
 *
 * Measured 2026-09-15 on an AEO-shaped prompt (see aeo-extract.ts): scout
 * answers in ~12s, gpt-oss-120b did not answer at all inside 30s because it
 * spends the budget reasoning. Both are listed anyway: the point of the
 * toggle is to see that for yourself on a real document rather than take a
 * one-chunk benchmark's word for it.
 */
/** "@cf/meta/llama-4-scout-17b-16e-instruct" -> "llama-4-scout-17b-16e-instruct". */
function shortModel(model: string): string {
  return model.split("/").pop() ?? model;
}

const AEO_MODEL_SUGGESTIONS = [
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/openai/gpt-oss-120b",
  "@cf/google/gemma-4-26b-a4b-it",
  "@cf/nvidia/nemotron-3-120b-a12b",
];

// What a document produced, and whether each question is allowed to become a
// page. Operator-only — a proposed question has no URL, so this is the one
// place it can be seen and judged before it becomes public.
function renderAtomReview(
  pieceId: string,
  atoms: { findings: number; questions: QuestionReview[] } | undefined,
  lede?: { verbatim_text: string; approved_at: string | null } | null,
): string {
  // The model picker. A re-run replaces this piece's atoms, so the way to
  // compare two models is to run one, read it, then run the other — and the
  // model is recorded on every row, so which produced what survives the page.
  //
  // Free text rather than a fixed list on purpose: Cloudflare's catalog churns
  // faster than this file gets edited, and a hardcoded <select> would quietly
  // become a list of models that no longer exist. Blank means the role's own.
  // Name the default rather than saying "default". An empty field that does
  // something unnamed is a field you cannot reason about: you can't tell
  // whether you have already run this model, and "blank vs the one I typed"
  // is not a comparison you can describe afterwards.
  const fallback = modelForRole("bulk_extraction").model;
  const options = [fallback, ...AEO_MODEL_SUGGESTIONS.filter((m) => m !== fallback)]
    .map((m) => `<option value="${escapeAttr(m)}">${m === fallback ? "default" : ""}</option>`)
    .join("");
  // The lede sits with the other per-document actions: propose a passage, read
  // it, approve it. Unapproved means nothing renders publicly, so this is the
  // only place it can be judged.
  const ledeBlock = lede
    ? `<div class="atom-lede">
    <div class="atom-lede-text">${escapeHtml(lede.verbatim_text)}</div>
    <div class="atom-lede-act">${
      lede.approved_at
        ? `<span class="atom-live">live</span>`
        : `<form method="POST" action="/op/library/${escapeHtml(pieceId)}/lede/approve" style="display:inline"><button type="submit" class="atom-pub">Approve passage</button></form>`
    }
    <form method="POST" action="/op/library/${escapeHtml(pieceId)}/lede" style="display:inline"><button type="submit" class="atom-run">Re-select</button></form></div>
  </div>`
    : `<form method="POST" action="/op/library/${escapeHtml(pieceId)}/lede" style="display:inline"><button type="submit" class="atom-run">Select lead passage</button></form>`;
  const extract = `<form method="POST" action="/op/library/${escapeHtml(pieceId)}/extract-atoms" class="atom-form">
  <input list="aeo-models" name="model" class="atom-model" autocomplete="off"
         placeholder="${escapeAttr(shortModel(fallback))} (default)"
         title="${escapeAttr(`Leave blank to use ${fallback}`)}">
  <datalist id="aeo-models">${options}</datalist>
  <button type="submit" class="atom-run">${atoms ? "Re-extract" : "Extract findings & questions"}</button>
</form>`;
  // FOLDED. Every row carried a lead-passage button, a model override box and
  // an extract button — three controls times fifty documents, with the model
  // name truncated mid-word, above the documents themselves. They are real
  // actions and stay one click away; they are not what the page is for.
  //
  // A native <details>, so nothing here needs JavaScript (rule 7).
  const fold = (inner: string, label: string) =>
    `<details class="atom-more"><summary>${escapeHtml(label)}</summary>${inner}</details>`;

  if (!atoms || (atoms.findings === 0 && atoms.questions.length === 0)) {
    return fold(`<div class="atoms">${ledeBlock}${extract}</div>`, "Extract");
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
  ${ledeBlock}
  <div class="atom-head"><b>${atoms.findings}</b> finding${atoms.findings === 1 ? "" : "s"} · <b>${atoms.questions.length}</b> question${atoms.questions.length === 1 ? "" : "s"} ${extract}</div>
  ${atoms.questions.length ? `<ul class="atom-list">\n${rows}\n  </ul>` : ""}
</div>`,
    `${atoms.findings} finding${atoms.findings === 1 ? "" : "s"} · ${atoms.questions.length} question${atoms.questions.length === 1 ? "" : "s"}`,
  );
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
        <span class="lead-ans-k">Not settled by these documents</span>
        ${a.answer_md ? `<p>${escapeHtml(a.answer_md)}</p>` : ""}
        ${discardLine(a)}
      </div>\n`;
  }

  const quotes = a.quotes
    .map(
      (q) => `          <li>
            <span class="lead-ans-q">${escapeHtml(q.text)}</span>
            ${
              q.slug
                ? `<a class="lead-ans-src" href="/library/${escapeAttr(q.slug)}">${escapeHtml(
                    q.title ?? q.slug,
                  )}</a>`
                : `<span class="lead-ans-src">${escapeHtml(q.title ?? "a stored document")}</span>`
            }
          </li>`,
    )
    .join("\n");

  return `      <div class="lead-ans">
        <span class="lead-ans-k">What the documents settle</span>
        <p>${escapeHtml(a.answer_md ?? "")}</p>
        <ul class="lead-ans-quotes">
${quotes}
        </ul>
        ${discardLine(a)}
      </div>\n`;
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

function renderLeads(leads: Lead[], answers?: Map<string, LeadAnswer>): string {
  if (!leads.length) return "";
  const items = leads
    .map((l) => {
      const answer = answers?.get(l.answer_key ?? "");
      const label = l.kind === "contradiction" ? "sources disagree" : "no source named";
      const other =
        l.kind === "contradiction" && l.other_piece_slug
          ? ` <a class="lead-other" href="/library/${escapeAttr(l.other_piece_slug)}">${escapeHtml(l.other_piece_title ?? "the other document")}</a>`
          : "";
      const receipt = l.quote_id
        ? ` <a class="lead-receipt" href="/q/${escapeAttr(l.quote_id)}">quote ↗</a>`
        : "";
      // The dig button. The seed and angle ride along in the form because a
      // lead is a query result, not a stored row — and the angle is what
      // makes the run worth starting: a run seeded with a bare topic returns
      // a topic's worth of material.
      // A contradiction is answerable from documents already held, in full,
      // with no web search — so the button says what it will actually do
      // rather than promising research it is not going to perform.
      const verb = answer ? "Dig again" : l.kind === "contradiction" ? "Settle this" : "Dig here";
      const dig = l.seed
        ? `
      <form method="POST" action="/op/leads/dig" class="lead-dig-form">
        <input type="hidden" name="seed" value="${escapeAttr(l.seed)}" />
        <input type="hidden" name="angle" value="${escapeAttr(l.angle)}" />
        <input type="hidden" name="kind" value="${escapeAttr(l.kind)}" />
        <input type="hidden" name="piece_id" value="${escapeAttr(l.piece_id)}" />
        <input type="hidden" name="piece_slug" value="${escapeAttr(l.piece_slug ?? "")}" />
        <input type="hidden" name="other_slug" value="${escapeAttr(l.other_piece_slug ?? "")}" />
        <button type="submit" class="lead-dig">${escapeHtml(verb)} →</button>
      </form>`
        : "";
      return `    <li class="lead lead-${escapeAttr(l.kind)}">
      <span class="lead-k">${escapeHtml(label)}</span>
      <span class="lead-sum">${escapeHtml(l.summary)}</span>${other}${receipt}${dig}
${renderLeadAnswer(answer)}    </li>`;
    })
    .join("\n");
  return `<ul class="lead-list">
${items}
  </ul>`;
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
    /** Count of jobs started by the "Process queue" button. */
    draining?: string;
    /** "findings.new.merged.killed" from the atom extraction button. */
    atoms?: string;
    /** Which model produced that run, so the banner can name it. */
    model?: string;
    published?: string;
    /** Set after a working title was replaced from /op/pieces/:id/title. */
    renamed?: string;
    /** "assigned.ungrouped" from the topic pass. */
    topics?: string;
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
      ? `<div class="op-banner">Uploaded ${escapeHtml(opts.ingested)} document${opts.ingested === "1" ? "" : "s"} — extraction started automatically.</div>`
      : opts.atoms
        ? (() => {
            const [f, n, m, k] = opts.atoms.split(".");
            const by = opts.model ? ` using <b>${escapeHtml(shortModel(opts.model))}</b>` : "";
            return `<div class="op-banner">Extracted <b>${escapeHtml(f ?? "0")}</b> findings and <b>${escapeHtml(n ?? "0")}</b> new questions (<b>${escapeHtml(m ?? "0")}</b> merged into existing ones)${by}.${Number(k) > 0 ? ` ${escapeHtml(k ?? "0")} span${k === "1" ? " was" : "s were"} discarded for not matching the document verbatim.` : ""} Nothing is public until you publish it.</div>`;
          })()
        : opts.topics
          ? (() => {
              const [a, u] = opts.topics.split(".");
              return `<div class="op-banner">Filed <b>${escapeHtml(a ?? "0")}</b> document${a === "1" ? "" : "s"} into sections.${Number(u) > 0 ? ` <b>${escapeHtml(u ?? "0")}</b> fit none of them and sit in Everything else — a real answer, not a failure.` : ""} Press again for the next batch.</div>`;
            })()
          : opts.renamed
            ? `<div class="op-banner">Title updated. The old one is kept on the row.</div>`
            : opts.published
              ? `<div class="op-banner">Answer published.</div>`
              : opts.draining
                ? `<div class="op-banner">${
                    opts.draining === "0"
                      ? "Nothing was waiting in the queue."
                      : `Started ${escapeHtml(opts.draining)} queued job${opts.draining === "1" ? "" : "s"}. They run in the background — reload in a minute, and press again if more are still queued.`
                  }</div>`
                : "";

  // Operator affordance strip — only rendered when logged in. Surfaces the
  // bulk extract action (the work behind it lives at POST /op/library/extract
  // and is unchanged). Spec v2.5 Part 9: same URL, controls woven in. Visual
  // treatment is deliberately minimal — a band, two buttons. The handoff doc
  // says "implement the model and leave the exact visual treatment for review".
  let opStrip = "";
  if (opts.isOperator && userId) {
    const { one } = await import("../../lib/d1");
    const counts = await one<{ total: number; unextracted: number; queued: number }>(
      env.DB,
      `SELECT
         (SELECT COUNT(*) FROM pieces WHERE user_id = ?) AS total,
         (SELECT COUNT(*) FROM pieces p
            WHERE p.user_id = ? AND NOT EXISTS (
              SELECT 1 FROM digest_jobs j
               WHERE j.user_id = p.user_id AND j.piece_id = p.id AND j.status = 'completed')
         ) AS unextracted,
         (SELECT COUNT(*) FROM digest_jobs
            WHERE user_id = ? AND status IN ('queued','running')) AS queued`,
      [userId, userId, userId],
    ).catch(() => null);
    const total = counts?.total ?? 0;
    const unextracted = counts?.unextracted ?? 0;
    const queued = counts?.queued ?? 0;
    const extractBtn =
      unextracted > 0
        ? `<form method="POST" action="/op/library/extract" style="display:inline;margin-right:8px">
  <input type="hidden" name="mode" value="all-unextracted" />
  <button type="submit" class="op-strip-btn op-strip-btn-primary">Extract all (${unextracted})</button>
</form>`
        : "";
    const reextractBtn =
      total > 0
        ? `<form method="POST" action="/op/library/extract" style="display:inline" onsubmit="return confirm('Re-extract all ${total} documents?');">
  <input type="hidden" name="mode" value="all" />
  <button type="submit" class="op-strip-btn">Re-extract all (${total})</button>
</form>`
        : "";
    // Queued jobs used to be drained by the every-2-minute cron. The cron is
    // off (nothing runs unattended any more), so anything enqueued without
    // being run inline — zip entries past the first three — would otherwise
    // sit in the queue forever with no way to move it. A button the operator
    // presses is the whole mechanism, and it costs nothing unpressed.
    const drainBtn =
      queued > 0
        ? `<form method="POST" action="/op/library/drain" style="display:inline;margin-right:8px">
  <button type="submit" class="op-strip-btn op-strip-btn-primary">Process queue (${queued})</button>
</form>`
        : "";
    // Same reasoning as the drain button above: pass 2 of on-demand research
    // was dispatched only by the cron, so with the cron off a run that finds
    // follow-up queries parks at pass2_pending and shows "Researching…"
    // forever. Shown unconditionally rather than gated on a count, because the
    // cheap thing to get wrong here is not knowing a run is stuck.
    const topicsBtn = `<form method="POST" action="/op/library/topics" style="display:inline;margin-right:8px">
  <button type="submit" class="op-strip-btn">File into sections</button>
</form>`;
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
    <div class="op-dz-2">Markdown · plain text · PDF · a .zip of any of these</div>
    <input type="file" id="feed-file" name="file" accept=".md,.txt,.pdf,.zip,text/markdown,text/plain,application/pdf,application/zip,application/x-zip-compressed" required style="display:none" />
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
    <div class="op-strip-actions">${drainBtn}${topicsBtn}${advanceBtn}${extractBtn}${reextractBtn}</div>
  </details>
  <style>
    .op-video-form { display:flex; gap:8px; margin-top:10px; }
    .op-video-input { flex:1; font-size:13px; padding:8px 10px; border-radius:6px;
      border:1px solid var(--rule); background:var(--surface); color:var(--ink); }
  </style>
</div>
<style>
  .op-strip { padding:16px; margin:0 0 28px;
    border:1px solid var(--rule); border-radius:8px; background:rgba(0,0,0,.03); }

  /* Maintenance folds away. Five batch verbs in front of the upload box made
     the page look like a control panel instead of a place to put a document.
     A native <details> keeps them one click away with no JavaScript. */
  .op-more { margin-top: 12px; border-top: 1px solid var(--rule); padding-top: 10px; }
  .op-more > summary {
    cursor: pointer; list-style: none;
    font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em;
    text-transform: uppercase; color: var(--ink-mute);
  }
  .op-more > summary::-webkit-details-marker { display: none; }
  .op-more > summary::before { content: "+ "; color: var(--ink-faint); }
  .op-more[open] > summary::before { content: "− "; }
  .op-more > summary:hover { color: var(--ink-2); }
  .op-more .op-strip-actions { margin-top: 12px; }

  /* Per-row machinery, folded. Same idiom as .op-more so the page has one
     way of saying "there is more here if you want it". */
  .atom-more { margin-top: 6px; }
  .atom-more > summary {
    cursor: pointer; list-style: none;
    font-family: var(--mono); font-size: 10px; letter-spacing: .07em;
    text-transform: uppercase; color: var(--ink-mute);
  }
  .atom-more > summary::-webkit-details-marker { display: none; }
  .atom-more > summary::before { content: "+ "; color: var(--ink-faint); }
  .atom-more[open] > summary::before { content: "− "; }
  .atom-more > summary:hover { color: var(--ink-2); }
  .op-strip-top { display:flex; align-items:center; gap:14px; margin-bottom:12px; }
  .op-strip-label { font-size:11px; letter-spacing:.12em; text-transform:uppercase;
    color:var(--ink-3); font-weight:600; }
  .op-strip-actions { display:flex; gap:8px; flex-wrap:wrap; margin-left:auto; }
  .op-strip-btn { font-size:12.5px; padding:6px 14px; border-radius:6px; cursor:pointer;
    border:1px solid var(--rule); background:var(--surface); color:var(--ink); }
  .op-strip-btn-primary { background:var(--ink); color:#fff; border-color:var(--ink); }
  .op-dropzone-form { margin:0; }
  .op-dropzone {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:5px; padding:34px 16px; border:1px dashed var(--rule-bright, var(--rule));
    border-radius:8px; background:var(--surface); cursor:pointer; text-align:center;
    transition: border-color .12s, background .12s;
  }
  .op-dropzone:hover { border-color: var(--accent); background: var(--accent-bg, var(--surface)); }
  .op-dz-1 { font-size:13.5px; color:var(--ink); font-weight:500; }
  .op-dz-2 { font-size:11.5px; color:var(--ink-3); }
  .op-dz-uploading { padding:14px; text-align:center; font-size:12.5px; color:var(--ink-3); }
  .op-banner { padding:11px 14px; margin:0 0 16px; border-radius:8px; font-size:13px;
    border:1px solid var(--conf-bd, var(--rule)); background:var(--conf-bg, var(--surface)); color:var(--ink); }
  .op-banner-error { border-color:var(--corr-bd, var(--rule)); background:var(--corr-bg, var(--surface)); }
</style>`;
  }

  // Proposed atoms, per document. Operator-only: these have no URL until they
  // pass the gate AND the operator publishes them, so this list is the only
  // place they are visible.
  const atomsByPiece = new Map<string, { findings: number; questions: QuestionReview[] }>();
  const ledeByPiece = new Map<string, { verbatim_text: string; approved_at: string | null }>();
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

  // Stored answers for whatever leads those receipts carry. One query for all
  // of them, keyed by the lead's own identity — see leads.ts's answer_key.
  const leadKeys = [...receipts.values()]
    .flatMap((r) => r.leads)
    .map((l) => l.answer_key)
    .filter((k): k is string => !!k);
  const leadAnswers =
    opts.isOperator && userId && leadKeys.length
      ? await (await import("../../graph/lib/answer-lead"))
          .answersForLeads(env.DB, userId, leadKeys)
          .catch(() => new Map<string, LeadAnswer>())
      : new Map<string, LeadAnswer>();

  // WORKING TITLES. Candidates are computed here rather than stored, for the
  // handful of rows that need them: the function is pure and cheap, so a
  // stored column would only add a backfill and a way to go stale against an
  // edited body. Bodies are fetched for the flagged pieces alone.
  const flagged = opts.isOperator
    ? pieces.filter((p) => looksLikeWorkingTitle(p.title)).slice(0, 12)
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
    ? `<section class="op-queue">
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

  const rows = pieces.length
    ? pieces
        .map((p) => {
          const isOnDemandDraft =
            p.publication_status === "working-material" && onDemandDrafts.has(p.id);
          const status = isOnDemandDraft
            ? `<span class="chip">draft — awaiting review</span>`
            : p.publication_status === "working-material"
              ? `<span class="chip">working material</span>`
              : p.publication_status === "canonical"
                ? `<span class="chip">canonical</span>`
                : `<span class="chip">published</span>`;
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
            opts.isOperator && p.publication_status !== "working-material"
              ? renderAtomReview(p.id, atoms, ledeByPiece.get(p.id))
              : "";
          const receiptBlock = opts.isOperator
            ? renderReceipt(receipts.get(p.id), leadAnswers)
            : "";
          const renameBlock = opts.isOperator
            ? renderRename(p.id, p.title, candidatesByPiece.get(p.id))
            : "";
          return `<tr>
  <td>${title}${renameBlock}${renderLintNotes(p.metadata)}${receiptBlock}${atomBlock}</td>
  <td><span class="coord">${escapeHtml(kindLabel(p.kind))}</span></td>
  <td>${status}</td>
  <td><span class="coord">${p.published_at ? escapeHtml(formatDate(p.published_at)) : "—"}</span></td>
</tr>`;
        })
        .join("")
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

  const body = `
<header class="phead">
  <div class="eyebrow">The raw research</div>
  <h1>Library</h1>
  <p class="phead-dek">
    Every document the rest is built on, kept whole. Each row shows what it fed —
    facts extracted, subjects it touched. Working material feeds the rest but
    doesn't get its own public page.
  </p>
</header>
${uploadBanner}
${opStrip}
<section>${sectionHeader(`All material (${pieces.length})`)}${table}</section>
${queueBlock}
<style>
  .lib-weight {
    display: flex; flex-wrap: wrap;
    gap: 20px 36px;
    padding: 22px 24px;
    margin: 0 0 28px;
    border: 1px solid var(--rule);
    border-radius: 11px;
    background: var(--surface, #fff);
  }
  .lw-cell { display: flex; flex-direction: column; gap: 2px; }
  .lw-cell b {
    font-family: var(--serif);
    font-size: 28px; line-height: 1;
    color: var(--ink);
    font-weight: 600;
  }
  .lw-cell span {
    font-size: 12.5px;
    color: var(--ink-3);
    letter-spacing: .02em;
  }
  .lib-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-family: var(--serif); }
  .lib-table th { text-align: left; padding: 10px 14px 10px 0; border-bottom: 1px solid var(--rule); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); font-weight: 600; }
  .lib-table td { padding: 14px 14px 14px 0; border-bottom: 1px solid var(--rule-soft, var(--rule)); vertical-align: top; font-size: 15px; line-height: 1.4; }
  .lib-table td.coord { font-family: var(--mono); font-size: 12.5px; color: var(--ink-3); }
  .lib-table tr:hover td { background: rgba(0,0,0,0.015); }
  .lib-title-raw { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); margin-top: 3px; word-break: break-all; }

  /* On a phone the five-column table pushed the page 552px wide inside a
     390px viewport. Nobody had seen it, because /library 401s without a
     session and the screenshot tool could not log in until now. The table
     becomes a stack of cards: each row a block, the secondary columns
     labelled inline rather than by a header off the side of the screen. */
  @media (max-width: 720px) {
    .lib-table, .lib-table tbody, .lib-table tr, .lib-table td { display: block; width: 100%; }
    .lib-table thead { display: none; }
    .lib-table tr {
      padding: 14px 0; border-bottom: 1px solid var(--rule-soft, var(--rule));
    }
    .lib-table td { border: none; padding: 0 0 4px; }
    .lib-table td.coord { display: inline-block; width: auto; margin-right: 10px; }
  }
</style>
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
