// The read board: what Read it found in one document, as cards the author
// keeps or dismisses, with the read's receipt (docs/read-it.md). Shown in the
// workspace's right pane while Claude reads; nothing here is public until
// "Show on the page".

import {
  type Derivation,
  type DerivationKind,
  KIND_LABEL,
  type ReadRow,
  THIN_PROOF,
} from "../../write/read";
import { esc } from "../layout";
import { passageHref } from "../md";

const ORDER: DerivationKind[] = [
  "pitch",
  "thesis",
  "figure",
  "finding",
  "question_answered",
  "question_open",
  "coinage",
  "open_problem",
  "prediction",
  "caveat",
  "held",
];

const ROLE_LABEL: Record<string, string> = {
  finding: "Finding",
  reasoning: "Reasoning",
  recommendation: "Advice to the author — not evidence",
  premise: "The author's own decision — not evidence",
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : "");

/** The span as a reader sees it: the document's Markdown emphasis removed. */
const shown = (span: string) =>
  span.replace(/\*\*|__/g, "").replace(/(^|\W)[*_](\S[^*_]*?)[*_](?=\W|$)/g, "$1$2");

function quote(docId: string, span: string, section?: string): string {
  return `<blockquote class="rd-q">${esc(shown(span))}<a class="rd-src" href="${esc(passageHref(docId, shown(span)))}" target="_blank" rel="noopener">${esc(section || "in the document")}</a></blockquote>`;
}

/** One card, with Keep / Dismiss while it is only proposed. */
export function readCard(d: Derivation): string {
  const meta: string[] = [];
  // The role, unless the kind already says it ("Finding · Finding").
  if (d.role && d.role !== d.kind)
    meta.push(`<span class="rd-role ${d.role}">${esc(ROLE_LABEL[d.role] ?? d.role)}</span>`);
  if (d.origin === "shape") meta.push('<span class="rd-shape">From its own structure</span>');
  const standing = str(d.data.standing) || str(d.data.source_rating);
  if (standing) meta.push(`<span class="rd-standing">The document says: ${esc(standing)}</span>`);
  let body = "";
  if (d.kind === "figure") {
    body = `<div class="rd-fig"><strong>${esc(str(d.data.figure))}</strong> ${esc(str(d.data.measures))}${
      str(d.data.period) ? ` · ${esc(str(d.data.period))}` : ""
    }${str(d.data.attributed_to) ? ` · ${esc(str(d.data.attributed_to))}` : " · source not named"}${
      d.data.rejected
        ? ' · <span class="rd-rejected">the document says not to rely on it</span>'
        : ""
    }</div>${quote(d.docId, d.span, d.section)}`;
  } else if (d.kind === "question_answered") {
    body = `<div class="rd-t">${esc(str(d.data.question))}</div>${quote(d.docId, str(d.data.answer) || d.span, d.section)}`;
  } else if (d.kind === "coinage") {
    body = `${quote(d.docId, d.span, d.section)}<div class="rd-note">Marked as new:</div>${quote(d.docId, str(d.data.flag), d.section)}`;
  } else if (d.kind === "pitch") {
    const proof = Number(d.data.proof ?? 0);
    const supports =
      (d.data.supports as Array<{ span: string; role: string; section?: string }> | undefined) ??
      [];
    body = `<div class="rd-t">${esc(str(d.data.thesis))}</div><div class="rd-proof${proof < THIN_PROOF ? " thin" : ""}">${proof} verified findings or reasoning${proof < THIN_PROOF ? " · thin" : ""}</div><details class="rd-more"><summary>What carries it (${supports.length})</summary>${supports
      .map(
        (s) =>
          `<div class="rd-note">${esc(ROLE_LABEL[s.role] ?? s.role)}</div>${quote(d.docId, s.span, s.section)}`,
      )
      .join(
        "",
      )}${str(d.data.counter) ? `<div class="rd-note">The strongest counter</div>${quote(d.docId, str(d.data.counter))}` : ""}</details>`;
  } else {
    body = `${str(d.data.question) ? `<div class="rd-t">${esc(str(d.data.question))}</div>` : ""}${quote(d.docId, d.span, d.section)}${
      str(d.data.resolves_when)
        ? `<div class="rd-note">Resolves when: ${esc(str(d.data.resolves_when))}</div>`
        : ""
    }`;
  }
  const actions =
    d.status === "proposed"
      ? `<form method="post" action="/op/read/card/${esc(d.id)}/keep" class="rd-act"><button class="btn sm primary">Keep</button><button class="btn sm" formaction="/op/read/card/${esc(d.id)}/dismiss">Dismiss</button></form>`
      : d.status === "kept"
        ? `<form method="post" action="/op/read/card/${esc(d.id)}/dismiss" class="rd-act"><span class="rd-status kept">Kept</span><button class="btn sm quiet">Dismiss</button></form>`
        : '<span class="rd-status dismissed">Dismissed — it will not come back</span>';
  return `<div class="rd-card ${d.status}" id="c-${esc(d.id)}"><div class="rd-h"><span class="pill">${esc(KIND_LABEL[d.kind])}</span>${meta.join("")}</div>${body}${actions}</div>`;
}

export function receiptLine(r: ReadRow): string {
  const read =
    r.charsRead >= r.charsHeld && r.charsHeld > 0
      ? `Read in full: ${r.charsRead.toLocaleString("en-CA")} characters`
      : r.charsRead
        ? `Read ${r.charsRead.toLocaleString("en-CA")} of ${r.charsHeld.toLocaleString("en-CA")} characters`
        : "Not read yet";
  return `${read} · ${r.verified} passages found word for word · <span class="${r.dropped ? "rd-dropped" : ""}">${r.dropped} dropped</span>${r.cents ? ` · $${(r.cents / 100).toFixed(2)}` : ""}`;
}

/** The whole board, as a page for the workspace's preview frame. */
export function renderReadBoard(r: ReadRow, cards: Derivation[], docTitle: string): string {
  const live = cards.filter((c) => c.status !== "dismissed");
  const proposed = cards.filter((c) => c.status === "proposed").length;
  const groups = ORDER.map((k) => {
    const cs = live.filter((c) => c.kind === k);
    if (!cs.length) return "";
    return `<section class="rd-group"><h2>${esc(KIND_LABEL[k])} <span class="rd-n">${cs.length}</span></h2>${cs.map(readCard).join("")}</section>`;
  }).join("");
  const dismissed = cards.length - live.length;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/site.css"></head><body class="rd-body"><main class="rd-main">
<div class="rd-head"><div class="rd-kicker">Read it</div><h1>${esc(docTitle)}</h1><div class="rd-receipt">${receiptLine(r)}</div>${
    proposed
      ? `<form method="post" action="/op/read/${esc(r.id)}/keep-all" class="rd-act"><button class="btn sm">Keep all ${proposed} proposed</button></form>`
      : ""
  }</div>
${groups || '<p class="rd-empty">Nothing yet. The cards appear here as Claude reads.</p>'}
${dismissed ? `<p class="rd-empty">${dismissed} dismissed.</p>` : ""}
</main></body></html>`;
}
