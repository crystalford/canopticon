// "Questions these documents answer" — the block below the worklist on
// /library.

import { escapeHtml } from "../../layout";
import type { LibraryAnsweredQuestion } from "../../models/library";

// Questions these documents answer: an INDEX of what the documents
// establish (and what the FAQ structured data is built from), not a
// worklist — see graph/lib/standing-answer.ts openQuestions for the
// history. Real leads come from ABSENCE and render per document above.
export function renderAnswered(answered: LibraryAnsweredQuestion[]): string {
  return answered.length
    ? `<section class="op-queue wb-sec" id="answers">
  <div class="op-queue-head">Questions these documents answer
    <span class="op-queue-note">Extracted with the passage that answers each one, and used for the FAQ structured data. Not a to-do list — what to chase shows on each document above, as a lead.</span>
  </div>
  <ul class="op-queue-list">
${answered
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
}
