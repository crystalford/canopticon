// Leads on /library: a lead and its answer, the dig form, the corpus-wide
// worklist ("What the record wants") and "Resurfaced today". Each lead is a
// query result over the graph, never a count (CLAUDE.md, "Leads").

import type { LeadAnswer } from "../../../graph/lib/answer-lead";
import type { Lead } from "../../../graph/lib/leads";
import { escapeAttr, escapeHtml } from "../../layout";
import {
  HAS_ANYONE_SAID_THIS_ANGLE,
  type LibraryLead,
  type LibraryLeadAnswer,
  type LibraryResurfaced,
  leadAnswerView,
  leadView,
} from "../../models/library";

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
                  ? `<a class="lead-ans-src" href="/p/${escapeAttr(q.slug)}">${escapeHtml(
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
export function renderLeads(leads: LibraryLead[], opts: { showPiece?: boolean } = {}): string {
  if (!leads.length) return "";
  const items = leads
    .map((l) => {
      // In the corpus-wide worklist a lead must say which document it came
      // out of; under a document's own receipt that is already the row.
      const piece =
        opts.showPiece && l.pieceSlug
          ? ` <a class="lead-piece" href="/p/${escapeAttr(l.pieceSlug)}">${escapeHtml(l.pieceTitle ?? l.pieceSlug)}</a>`
          : "";
      const other =
        (l.kind === "contradiction" || l.kind === "bridge") && l.otherSlug
          ? ` <a class="lead-other" href="/p/${escapeAttr(l.otherSlug)}">${escapeHtml(l.otherTitle ?? "the other document")}</a>`
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
export function renderWorklist(leads: LibraryLead[], resurfaced: LibraryResurfaced | null): string {
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
