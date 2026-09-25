// Ask the record — one box; answers are passages first, documents second.
//
// A mind retrieves passages, not documents. Every verified quote is its
// own vector (kind "quote", written by the pipeline's "index" step), so
// the first thing a query returns is the words on file — verbatim, named
// to the document they came from, each with its /q/ receipt. The document
// hits follow under their own heading. No model composes anything here.
//
// Uses the existing Vectorize index (canopticon-embeddings, 1024-dim
// cosine) that already holds embeddings for entities, claims, pieces,
// theses, sources, and signed readings. The query embeds via Workers AI
// bge-large-en-v1.5 (same model used at upsert time) and queries
// Vectorize for the top matches.
//
// Results are resolved to public URLs by kind:
//   entity  → /s/<slug>          (Record page)
//   claim   → /s/<slug>#claim    (host page anchor)
//   piece   → /library/<slug>    (source document)
//   thesis  → /s/<slug>?mode=signed
//   article → /investigations/<slug>
//   source  → /q/<id>            (quote receipt)
//
// Empty query renders the search shell with no results panel — same URL
// for results and empty state so `/search?q=` is a valid landing.

import type { Env } from "../../env";
import { escapeAttr, escapeHtml, renderPage } from "../layout";
import {
  type SearchAnswer,
  type SearchDocument,
  type SearchDocumentKind,
  type SearchModel,
  type SearchOperator,
  type SearchPassage,
  searchModel,
} from "../models/search";

// The queries live in models/search.ts; this file only renders what they
// found. resolvePassages is re-exported so its existing importers keep
// working from here.
export { resolvePassages } from "../models/search";

const KIND_LABEL: Record<SearchDocumentKind, string> = {
  entity: "File",
  claim: "Claim",
  piece: "Source document",
  thesis: "Analysis",
  article: "Investigation",
  source: "Quote",
  quote: "Passage",
};

function renderPassages(passages: SearchPassage[]): string {
  if (passages.length === 0) return "";
  return `<h2 class="search-h2">Passages</h2>
<ol class="search-passages">${passages
    .map(
      (p) => `<li class="search-passage">
  <blockquote class="search-passage-text">${escapeHtml(p.text)}</blockquote>
  <div class="search-passage-from">— <a href="/p/${escapeAttr(p.slug)}">${escapeHtml(p.title)}</a>
    <a class="search-passage-receipt" href="/q/${escapeAttr(p.quoteId)}">verified ↗</a></div>
</li>`,
    )
    .join("")}</ol>`;
}

// ---- "From the record" — the record's own answer to the question ----------
//
// Frozen in a lead_answers row by answerQuestion (kind "question") when the
// operator pressed "Ask the record"; rendered here for EVERY reader, above
// the passages, with each quote linked to its document and its receipt. No
// model runs to render it (standing rule 5), and a question gets no URL of
// its own — this is the search page for it. The .lead-ans-* classes are the
// ones /library uses for a lead's answer: same artifact, same look.

function modelTag(a: SearchAnswer): string {
  if (!a.model) return "";
  return ` <span class="lead-ans-model">${escapeHtml(a.model)}</span>`;
}

function discardLine(a: SearchAnswer): string {
  if (!a.discarded) return "";
  return `<span class="lead-ans-disc">${a.discarded} proposed quote${
    a.discarded === 1 ? "" : "s"
  } failed the verbatim check and ${a.discarded === 1 ? "was" : "were"} dropped.</span>`;
}

export function renderStoredAnswer(query: string, a: SearchAnswer | null): string {
  if (!a || a.status === "failed") return "";
  if (a.status === "nothing_found") {
    return `<h2 class="search-h2">From the record</h2>
<div class="lead-ans lead-ans-none search-answer">
  <span class="lead-ans-k">The record does not settle this.${modelTag(a)}</span>
  <p class="search-answer-q">${escapeHtml(query)}</p>
  ${a.answerMd ? `<p>${escapeHtml(a.answerMd)}</p>` : ""}
  ${discardLine(a)}
</div>`;
  }
  const quotes = a.quotes
    .map((q) => {
      const doc = q.slug
        ? `<a class="lead-ans-src" href="/p/${escapeAttr(q.slug)}">${escapeHtml(q.title ?? q.slug)}</a>`
        : `<span class="lead-ans-src">${escapeHtml(q.title ?? "a stored document")}</span>`;
      const receipt = q.quoteId
        ? ` <a class="lead-ans-src search-passage-receipt" href="/q/${escapeAttr(q.quoteId)}">verified ↗</a>`
        : "";
      return `<li><span class="lead-ans-q">${escapeHtml(q.text)}</span>${doc}${receipt}</li>`;
    })
    .join("\n");
  return `<h2 class="search-h2">From the record</h2>
<div class="lead-ans search-answer">
  <span class="lead-ans-k">In the record's own words${modelTag(a)}</span>
  <p>${escapeHtml(a.answerMd ?? "")}</p>
  <ul class="lead-ans-quotes">
${quotes}
  </ul>
  ${discardLine(a)}
</div>`;
}

/**
 * The operator's two buttons: ask the record (one writer call, answered from
 * the corpus, frozen in a row) or research it on the web (the existing
 * /op/leads/dig free question, kind=question — a brief, which is a document).
 * Anonymous readers never see either.
 */
function renderAskForms(
  query: string,
  answer: SearchAnswer | null,
  asked: boolean,
  op: SearchOperator,
): string {
  const research = `<form class="search-ask-form" method="POST" action="${escapeAttr(op.researchAction)}">
    <input type="hidden" name="kind" value="question">
    <input type="hidden" name="seed" value="${escapeAttr(query)}">
    <button type="submit" class="lead-dig">Research this on the web →</button>
  </form>`;
  if (asked && !answer) {
    return `<div class="search-ask">
  <p class="search-ask-wait">Answering… reload in a few seconds.</p>
  ${research}
</div>`;
  }
  const verb = answer ? "Ask the record again" : "Ask the record";
  return `<div class="search-ask">
  <form class="search-ask-form" method="POST" action="${escapeAttr(op.askAction)}">
    <input type="hidden" name="q" value="${escapeAttr(query)}">
    <button type="submit" class="lead-dig">${verb} →</button>
    <label class="lead-writer"><input type="checkbox" name="writer" value="anthropic"> with Claude</label>
  </form>
  ${research}
</div>`;
}

function renderDocuments(documents: SearchDocument[]): string {
  if (documents.length === 0) return "";
  return `<h2 class="search-h2">Documents</h2>
<ol class="search-hits">${documents
    .map(
      (h) => `<li class="search-hit">
  <a class="search-link" href="${escapeAttr(h.url)}">
    <span class="search-kind">${escapeHtml(KIND_LABEL[h.kind] ?? h.kind)}</span>
    <span class="search-title">${escapeHtml(h.title)}</span>
  </a>
  ${h.excerpt ? `<div class="search-snippet">${escapeHtml(h.excerpt)}</div>` : ""}
  <div class="search-score">${(h.score * 100).toFixed(1)}% match</div>
</li>`,
    )
    .join("")}</ol>`;
}

/** The miss: what to try instead and, for the operator, the labelled preview. */
function renderMiss(m: SearchModel): string {
  let block = `<div class="search-empty">Try a different phrasing, or check <a href="/topics">Topics</a> for browsable doorways.</div>`;
  const preview = m.operator?.preview;
  if (m.operator && preview) {
    const researchForm = `<form class="search-research-form" method="POST" action="${escapeAttr(
      m.operator.previewResearchAction,
    )}">
               <input type="hidden" name="q" value="${escapeAttr(m.query)}">
               <button class="search-research-go" type="submit">Research this for real →</button>
             </form>`;
    block += `<div class="search-preview">
  <div class="search-preview-label">AI-generated preview — not verified against any stored document. Not a fact.</div>
  <div class="search-preview-body">${escapeHtml(preview).replace(/\n/g, "<br>")}</div>
  ${researchForm}
</div>`;
  }
  return block;
}

function renderSummary(m: SearchModel): string {
  switch (m.outcome) {
    case "shell":
      return "Phrase queries work as well as keywords.";
    case "no-corpus":
      return "The record is empty so far.";
    case "miss":
      return `No matches for <b>${escapeHtml(m.query)}</b> yet.`;
    case "hits": {
      const parts: string[] = [];
      const np = m.passages.length;
      const nd = m.documents.length;
      if (np > 0) parts.push(`<b>${np}</b> passage${np === 1 ? "" : "s"}`);
      if (nd > 0)
        parts.push(
          m.candidates > nd
            ? `<b>${nd}</b> document${nd === 1 ? "" : "s"} (top-ranked of ${m.candidates})`
            : `<b>${nd}</b> document${nd === 1 ? "" : "s"}`,
        );
      return `${parts.join(" and ")} for <b>${escapeHtml(m.query)}</b>.`;
    }
  }
}

/** The page, from a model already built — the HTML of /search?q=. */
export function renderSearchModel(m: SearchModel): string {
  const query = m.query;
  const summary = renderSummary(m);
  let answerBlock = "";
  if (m.outcome === "hits" || m.outcome === "miss") {
    answerBlock = renderStoredAnswer(query, m.answer);
    if (m.operator) answerBlock += renderAskForms(query, m.answer, m.asked, m.operator);
  }
  const resultsBlock =
    m.outcome === "hits"
      ? renderPassages(m.passages) + renderDocuments(m.documents)
      : m.outcome === "miss"
        ? renderMiss(m)
        : "";

  const body = `
<section class="search-section">
  <h1 class="search-h1">Ask the record</h1>
  <p class="search-dek">Answers are passages from documents on file, word for word, each with its receipt.</p>
  <form class="search-form" method="GET" action="/search">
    <input
      class="search-input"
      type="search"
      name="q"
      value="${escapeAttr(query)}"
      placeholder="A question, a claim, a phrase…"
      autofocus
    >
    <button class="search-go" type="submit">Search</button>
  </form>
  <div class="search-summary">${summary}</div>
  ${answerBlock}
  ${resultsBlock}
</section>
<style>
  .search-section { max-width: 760px; margin: 32px 0 0; padding: 0 0 80px; }
  .search-h1 { font-family: var(--serif); font-size: 28px; margin: 0 0 18px; color: var(--ink); }
  .search-dek { font-family: var(--serif); font-size: 15px; color: var(--ink-3); margin: -8px 0 18px; line-height: 1.5; }
  .search-h2 { font-family: var(--mono); font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
    color: var(--ink-3); margin: 26px 0 6px; }
  .search-passages { list-style: none; padding: 0; margin: 0; }
  .search-passage { padding: 14px 0; border-top: 1px solid var(--rule-soft); }
  .search-passage-text { font-family: var(--serif); font-size: 16px; line-height: 1.55; color: var(--ink);
    margin: 0 0 8px; padding: 0 0 0 14px; border-left: 2px solid var(--accent, var(--ink)); }
  .search-passage-from { font-family: var(--serif); font-size: 13.5px; color: var(--ink-3); }
  .search-passage-from a { color: var(--ink); }
  .search-passage-receipt { font-family: var(--mono); font-size: 11px; margin-left: 10px; color: var(--ink-3) !important; }
  .search-form { display: flex; gap: 10px; margin-bottom: 14px; }
  .search-input { flex: 1; padding: 12px 16px; font-family: var(--serif); font-size: 16px;
    border: 1px solid var(--rule); border-radius: 8px; background: var(--surface); color: var(--ink); }
  .search-input:focus { outline: 2px solid var(--ink); outline-offset: 0; }
  .search-go { padding: 12px 22px; font-family: var(--mono); font-size: 13px;
    background: var(--ink); color: var(--paper); border: none; border-radius: 8px; cursor: pointer; }
  .search-go:hover { background: var(--accent-2); color: var(--paper); }
  .search-summary { font-family: var(--serif); font-style: italic; font-size: 14px;
    color: var(--ink-3); margin-bottom: 22px; }
  .search-hits { list-style: none; padding: 0; margin: 0; }
  .search-hit { padding: 14px 0; border-top: 1px solid var(--rule-soft); }
  .search-link { display: flex; align-items: baseline; gap: 12px; text-decoration: none; color: var(--ink); }
  .search-kind { font-family: var(--mono); font-size: 10.5px; padding: 2px 7px; border-radius: 3px;
    background: var(--paper-2); color: var(--ink-3); letter-spacing: .04em; }
  .search-title { font-family: var(--serif); font-size: 17px; line-height: 1.3; flex: 1; }
  .search-link:hover .search-title { text-decoration: underline; text-decoration-color: var(--ink-3); text-underline-offset: 4px; }
  .search-snippet { font-family: var(--serif); font-size: 13.5px; color: var(--ink-3);
    margin-top: 6px; line-height: 1.5; }
  .search-score { font-family: var(--mono); font-size: 10.5px; color: var(--ink-3);
    margin-top: 4px; letter-spacing: .03em; }
  .search-empty { font-family: var(--serif); font-style: italic; color: var(--ink-3);
    font-size: 14.5px; padding: 16px 0; }
  .search-preview { margin-top: 10px; padding: 16px 18px; border: 1px dashed var(--rule);
    border-radius: 8px; background: var(--paper-2, var(--surface)); }
  .search-preview-label { font-family: var(--mono); font-size: 10.5px; letter-spacing: .04em;
    text-transform: uppercase; color: var(--ink-3); margin-bottom: 10px; }
  .search-preview-body { font-family: var(--serif); font-size: 14.5px; line-height: 1.6; color: var(--ink); }
  .search-research-form { margin-top: 14px; }
  .search-research-go { padding: 9px 16px; font-family: var(--mono); font-size: 12px;
    background: var(--ink); color: var(--paper); border: none; border-radius: 6px; cursor: pointer; }
  .search-research-go:hover { background: var(--accent-2); color: var(--paper); }
  .search-answer { margin-bottom: 8px; }
  .search-answer .lead-ans-quotes li { flex-direction: row; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; }
  .search-answer .lead-ans-q { flex: 1 1 100%; }
  .search-answer-q { font-style: italic; }
  .search-ask { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; margin: 8px 0 18px; }
  .search-ask-form { display: inline-flex; align-items: center; gap: 8px; margin: 0; }
  .search-ask-wait { font-family: var(--mono); font-size: 12px; color: var(--ink-3); margin: 0; }
</style>`;

  return renderPage({
    title: query ? `Ask the record · "${query}" · canopticon` : "Ask the record · canopticon",
    description:
      "Ask the record — answers are passages from documents on file, word for word, each with its receipt.",
    body,
    activeNav: "/search",
    // The bare search page is in the sitemap; a query page is not, and says
    // so — the passages it lists belong to their documents, not to it.
    canonical: "https://canopticon.com/search",
    noindex: Boolean(query),
  });
}

export async function renderSearchPage(
  env: Env,
  q: string,
  opts: { isOperator?: boolean; asked?: boolean } = {},
): Promise<string> {
  return renderSearchModel(await searchModel(env, q, opts));
}
