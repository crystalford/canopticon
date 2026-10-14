// What a read found, on the document's own page (docs/read-it.md, "Show on
// the page"). Only cards the author kept, of a read the author put on the
// page; every one is the document's own words, located in code when it was
// noted, and links to where it sits. Nothing here is written by a model:
// the structured fields (what a figure measures, who it is attributed to)
// are labels, the passages are the document's.
//
// Not shown: possible articles (the author's worklist), the "about the
// author" flag, recommendations and premises (advice is never evidence),
// and the document's own Key Findings and Caveats bullets — they are in the
// body already, and nothing is written twice.

import type { Derivation, ShownRead } from "../../write/read";
import { esc } from "../layout";
import { passageHref } from "../md";
import { shortDate } from "../theme";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");

/** The span as a reader sees it, without the document's Markdown emphasis. */
const plainSpan = (s: string) =>
  s.replace(/\*\*|__/g, "").replace(/(^|\W)[*_](\S[^*_]*?)[*_](?=\W|$)/g, "$1$2");

/** A link to the passage on this same page (#q=…, found by /site.js). */
const here = (docId: string, span: string) => {
  const h = passageHref(docId, plainSpan(span));
  return h.slice(h.indexOf("#"));
};

const where = (d: Derivation) =>
  `<a href="${esc(here(d.docId, d.span))}">${esc(d.section || "In the document")} →</a>`;

const quote = (d: Derivation, span = d.span) =>
  `<blockquote class="ev-q">${esc(plainSpan(span))}</blockquote>`;

/** Which kept cards may be public at all. */
export function publicCards(cards: Derivation[]): Derivation[] {
  return cards.filter((c) => {
    if (c.status !== "kept") return false;
    if (c.kind === "pitch" || c.kind === "held") return false;
    if (c.role === "recommendation" || c.role === "premise") return false;
    // The document's own Key Findings and Caveats are already in its body.
    if (c.origin === "shape" && (c.kind === "finding" || c.kind === "caveat")) return false;
    return true;
  });
}

export interface Evidence {
  /** Replaces the page's picked key figures, when the read kept any. */
  figures: string;
  /** The line under the figures: what was checked, and how it got here. */
  strip: string;
  /** The sections after the body. */
  after: string;
  /** For the rail's "In this document". */
  heads: Array<{ id: string; text: string }>;
}

export function evidence(shown: ShownRead | null | undefined): Evidence | null {
  if (!shown) return null;
  const cards = publicCards(shown.cards);
  if (!cards.length) return null;
  const of = (k: Derivation["kind"]) => cards.filter((c) => c.kind === k);

  const figs = of("figure").filter((f) => !f.data.rejected);
  const figures = figs.length
    ? `<section aria-label="Key figures" class="figs"><div class="figs-h">Key figures</div>${figs
        .map((f) => {
          const by = [str(f.data.attributed_to), str(f.data.period)].filter(Boolean).join(" · ");
          return `<div class="fig"><span class="fig-t"><strong>${esc(str(f.data.figure))}</strong> ${esc(str(f.data.measures))}${
            by ? `<span class="ev-by"> — ${esc(by)}</span>` : ""
          }${str(f.data.source_rating) ? `<span class="ev-standing">${esc(str(f.data.source_rating))}</span>` : ""}</span>${where(f)}</div>`;
        })
        .join("")}</section>`
    : "";

  const thesis = of("thesis")[0];
  const findings = of("finding");
  const answered = of("question_answered");
  const open = [
    ...of("question_open"),
    ...of("prediction"),
    ...of("open_problem"),
    ...of("caveat"),
  ];

  const sections: Array<{ id: string; text: string; html: string }> = [];
  if (thesis || findings.length)
    sections.push({
      id: "ev-findings",
      text: "What it finds",
      html: `${
        thesis
          ? `<div class="ev-item"><div class="ev-l">Its central claim</div>${quote(thesis)}${where(thesis)}</div>`
          : ""
      }${findings
        .map(
          (f) =>
            `<div class="ev-item">${
              str(f.data.standing)
                ? `<div class="ev-l"><span class="ev-standing">${esc(str(f.data.standing))}</span></div>`
                : f.role === "reasoning"
                  ? '<div class="ev-l">The document\'s own reasoning</div>'
                  : ""
            }${quote(f)}${where(f)}</div>`,
        )
        .join("")}`,
    });
  if (answered.length)
    sections.push({
      id: "ev-answers",
      text: "Questions it answers",
      html: answered
        .map(
          (q) =>
            `<div class="ev-item"><div class="ev-t">${esc(str(q.data.question))}</div>${quote(q, str(q.data.answer) || q.span)}${where(q)}</div>`,
        )
        .join(""),
    });
  if (open.length)
    sections.push({
      id: "ev-open",
      text: "What it leaves open",
      html: open
        .map(
          (o) =>
            `<div class="ev-item"><div class="ev-l">${
              o.kind === "prediction"
                ? `Prediction${str(o.data.resolves_when) ? ` · settled when ${esc(str(o.data.resolves_when))}` : ""}`
                : o.kind === "open_problem"
                  ? "Open problem"
                  : o.kind === "caveat"
                    ? "Caveat"
                    : "Not found"
            }</div>${quote(o)}${where(o)}</div>`,
        )
        .join(""),
    });

  // What the page shows, counted: a rejected figure is not on it.
  const n = figs.length + (thesis ? 1 : 0) + findings.length + answered.length + open.length;
  const when = shortDate(shown.read.startedAt.slice(0, 10));
  const strip = `<p class="ev-strip"><span class="ev-check" aria-hidden="true">✓</span> ${n} ${
    n === 1 ? "passage" : "passages"
  } on this page ${n === 1 ? "is" : "are"} the document's own words, each checked against it and linked to where it is. Chosen by Chris Telford from a read by Claude, ${esc(when)}.${
    sections[0] ? ` <a href="#${sections[0].id}">${esc(sections[0].text)} ↓</a>` : ""
  }</p>`;

  const after = sections.length
    ? `<div class="ev">${sections
        .map(
          (s) =>
            `<section class="ev-sec" aria-labelledby="${s.id}"><h2 id="${s.id}" class="ev-h">${s.text}</h2>${s.html}</section>`,
        )
        .join("")}</div>`
    : "";
  return { figures, strip, after, heads: sections.map((s) => ({ id: s.id, text: s.text })) };
}
