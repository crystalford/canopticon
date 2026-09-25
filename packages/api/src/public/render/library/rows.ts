// The document table of /library: one row per piece, with everything that
// hangs off it — the pipeline status cell, the ingestion receipt, the working-
// title suggestion, the lineage and consolidation lines, the essay lint notes,
// the findings/questions fold and the row actions. Renders from the model
// only (public/models/library.ts); nothing here runs a query.

import { escapeAttr, escapeHtml } from "../../layout";
import type {
  LibraryAction,
  LibraryConsolidation,
  LibraryLead,
  LibraryLineage,
  LibraryLintNote,
  LibraryQuestion,
  LibraryReceipt,
  LibraryRowModel,
  LibraryStatus,
} from "../../models/library";
import { formatDate } from "../components";
import { renderLeads } from "./leads";

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
export function renderProcessingCell(pieceId: string, s: LibraryStatus): string {
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
 * The consolidation line under a processed row: how the document now sits in
 * the record. The model only carries it for a row the pipeline has finished —
 * before that the counts would describe a document the record has not read.
 */
export function renderConsolidation(s: LibraryConsolidation | null): string {
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
export function renderRow(r: LibraryRowModel, operator: boolean): string {
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
