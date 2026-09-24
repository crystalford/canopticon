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
import { type QuestionAnswer, storedAnswerForQuestion } from "../../graph/lib/answer-question";
import { getAnswerPreview } from "../../graph/lib/answers-preview";
import { type VectorMeta, rerankResults, searchVectors } from "../../graph/lib/embeddings";
import { all, insertOne, one } from "../../lib/d1";
import { resolveOperatorId } from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";

interface ResolvedHit {
  url: string;
  kind: VectorMeta["kind"];
  title: string;
  snippet: string;
  score: number;
}

const KIND_LABEL: Record<VectorMeta["kind"], string> = {
  entity: "File",
  claim: "Claim",
  piece: "Source document",
  thesis: "Analysis",
  article: "Investigation",
  source: "Quote",
  quote: "Passage",
};

const DOCUMENT_KINDS: VectorMeta["kind"][] = [
  "piece",
  "entity",
  "claim",
  "thesis",
  "article",
  "source",
];
const PASSAGE_LIMIT = 12;

interface PassageHit {
  id: string;
  verbatim_text: string;
  slug: string;
  title: string;
  score: number;
}

/** Quote hits → the verbatim text and the published document it lives in.
 *  One query; a hit whose document is no longer published resolves to
 *  nothing, so an unpublished piece never surfaces through its quotes. */
export async function resolvePassages(
  env: Env,
  hits: Array<{ id: string; score: number; metadata: VectorMeta }>,
): Promise<PassageHit[]> {
  const quoteHits = hits.filter((h) => h.metadata.kind === "quote" && h.metadata.id);
  if (quoteHits.length === 0) return [];
  const ids = [...new Set(quoteHits.map((h) => h.metadata.id))];
  const rows = await all<{ id: string; verbatim_text: string; slug: string; title: string }>(
    env.DB,
    `SELECT q.id, q.verbatim_text, p.slug, p.title
       FROM quotes q
       JOIN nodes n ON n.id = q.source_id
       JOIN pieces p ON p.id = n.piece_id
      WHERE q.id IN (${ids.map(() => "?").join(",")})
        AND p.publication_status IN ('published','canonical')`,
    ids,
  ).catch(() => []);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: PassageHit[] = [];
  const seen = new Set<string>();
  for (const h of quoteHits) {
    const row = byId.get(h.metadata.id);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push({ ...row, score: h.score });
  }
  return out;
}

function renderPassages(passages: PassageHit[]): string {
  if (passages.length === 0) return "";
  return `<h2 class="search-h2">Passages</h2>
<ol class="search-passages">${passages
    .map(
      (p) => `<li class="search-passage">
  <blockquote class="search-passage-text">${escapeHtml(p.verbatim_text)}</blockquote>
  <div class="search-passage-from">— <a href="/p/${escapeAttr(p.slug)}">${escapeHtml(p.title)}</a>
    <a class="search-passage-receipt" href="/q/${escapeAttr(p.id)}">verified ↗</a></div>
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

function modelTag(a: QuestionAnswer): string {
  if (!a.model) return "";
  const short = a.model.replace(/^@cf\/[^/]+\//, "");
  return ` <span class="lead-ans-model">${escapeHtml(short)}</span>`;
}

function discardLine(a: QuestionAnswer): string {
  if (!a.discarded) return "";
  return `<span class="lead-ans-disc">${a.discarded} proposed quote${
    a.discarded === 1 ? "" : "s"
  } failed the verbatim check and ${a.discarded === 1 ? "was" : "were"} dropped.</span>`;
}

export function renderStoredAnswer(query: string, a: QuestionAnswer | null): string {
  if (!a || a.status === "failed") return "";
  if (a.status === "nothing_found") {
    return `<h2 class="search-h2">From the record</h2>
<div class="lead-ans lead-ans-none search-answer">
  <span class="lead-ans-k">The record does not settle this.${modelTag(a)}</span>
  <p class="search-answer-q">${escapeHtml(query)}</p>
  ${a.answer_md ? `<p>${escapeHtml(a.answer_md)}</p>` : ""}
  ${discardLine(a)}
</div>`;
  }
  const quotes = a.quotes
    .map((q) => {
      const doc = q.slug
        ? `<a class="lead-ans-src" href="/p/${escapeAttr(q.slug)}">${escapeHtml(q.title ?? q.slug)}</a>`
        : `<span class="lead-ans-src">${escapeHtml(q.title ?? "a stored document")}</span>`;
      const receipt = q.quote_id
        ? ` <a class="lead-ans-src search-passage-receipt" href="/q/${escapeAttr(q.quote_id)}">verified ↗</a>`
        : "";
      return `<li><span class="lead-ans-q">${escapeHtml(q.text)}</span>${doc}${receipt}</li>`;
    })
    .join("\n");
  return `<h2 class="search-h2">From the record</h2>
<div class="lead-ans search-answer">
  <span class="lead-ans-k">In the record's own words${modelTag(a)}</span>
  <p>${escapeHtml(a.answer_md ?? "")}</p>
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
function renderAskForms(query: string, answer: QuestionAnswer | null, asked: boolean): string {
  const research = `<form class="search-ask-form" method="POST" action="/op/leads/dig">
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
  <form class="search-ask-form" method="POST" action="/op/ask">
    <input type="hidden" name="q" value="${escapeAttr(query)}">
    <button type="submit" class="lead-dig">${verb} →</button>
    <label class="lead-writer"><input type="checkbox" name="writer" value="anthropic"> with Claude</label>
  </form>
  ${research}
</div>`;
}

export async function renderSearchPage(
  env: Env,
  q: string,
  opts: { isOperator?: boolean; asked?: boolean } = {},
): Promise<string> {
  const query = q.trim();
  const userId = await resolveOperatorId(env.DB);
  let resultsBlock = "";
  let summary = "";
  let answerBlock = "";

  if (query.length > 0 && userId) {
    const stored = await storedAnswerForQuestion(env.DB, userId, query).catch(() => null);
    answerBlock = renderStoredAnswer(query, stored);
    if (opts.isOperator) answerBlock += renderAskForms(query, stored, opts.asked === true);
  }

  if (query.length > 0 && userId) {
    // A wider net (25) than what's actually shown — cosine similarity is
    // a decent candidate filter but a mediocre final ranker (it scores
    // the query and each candidate separately, never together). The
    // rerank pass below reads (query, candidate) as one input and
    // reorders for real relevance; RESULT_LIMIT caps what's displayed
    // to the reranked top slice, not the raw vector-search order.
    const [passageHits, hits] = await Promise.all([
      searchVectors(env, { query, userId, topK: PASSAGE_LIMIT, kinds: ["quote"] }).catch(() => []),
      searchVectors(env, { query, userId, topK: 25, kinds: DOCUMENT_KINDS }).catch(() => []),
    ]);
    const passages = await resolvePassages(env, passageHits);
    const resolvedAll = await resolveHits(env, hits);
    const RESULT_LIMIT = 12;
    const resolved =
      resolvedAll.length > 1
        ? (await rerankResults(env, query, resolvedAll, (h) => `${h.title}. ${h.snippet}`)).slice(
            0,
            RESULT_LIMIT,
          )
        : resolvedAll;
    if (resolved.length === 0 && passages.length === 0) {
      // A real miss — log it (cheap; feeds the future "what readers are
      // asking for" research signal) and, for the operator only, show a
      // fast AI-generated preview to help triage the miss. That preview is
      // the model's own synthesis, not a quote from any stored document, so
      // it can never become a fact — it's shown clearly labeled, purely to
      // help decide whether the question is worth real (verified) research.
      await insertOne(env.DB, "orchestrator_events", {
        user_id: userId,
        event_type: "search.miss",
        subject_kind: "search",
        subject_id: null,
        payload: JSON.stringify({ query }),
      }).catch(() => {});

      summary = `No matches for <b>${escapeHtml(query)}</b> yet.`;
      resultsBlock = `<div class="search-empty">Try a different phrasing, or check <a href="/topics">Topics</a> for browsable doorways.</div>`;

      const preview =
        opts.isOperator && userId
          ? await getAnswerPreview(env, userId, query).catch(() => null)
          : null;
      if (preview) {
        const researchForm = opts.isOperator
          ? `<form class="search-research-form" method="POST" action="/op/search/research">
               <input type="hidden" name="q" value="${escapeAttr(query)}">
               <button class="search-research-go" type="submit">Research this for real →</button>
             </form>`
          : "";
        resultsBlock += `<div class="search-preview">
  <div class="search-preview-label">AI-generated preview — not verified against any stored document. Not a fact.</div>
  <div class="search-preview-body">${escapeHtml(preview).replace(/\n/g, "<br>")}</div>
  ${researchForm}
</div>`;
      }
    } else {
      const parts: string[] = [];
      if (passages.length > 0)
        parts.push(`<b>${passages.length}</b> passage${passages.length === 1 ? "" : "s"}`);
      if (resolved.length > 0)
        parts.push(
          resolvedAll.length > resolved.length
            ? `<b>${resolved.length}</b> document${resolved.length === 1 ? "" : "s"} (top-ranked of ${resolvedAll.length})`
            : `<b>${resolved.length}</b> document${resolved.length === 1 ? "" : "s"}`,
        );
      summary = `${parts.join(" and ")} for <b>${escapeHtml(query)}</b>.`;
      const documents =
        resolved.length === 0
          ? ""
          : `<h2 class="search-h2">Documents</h2>
<ol class="search-hits">${resolved
              .map(
                (h) => `<li class="search-hit">
  <a class="search-link" href="${escapeAttr(h.url)}">
    <span class="search-kind">${escapeHtml(KIND_LABEL[h.kind] ?? h.kind)}</span>
    <span class="search-title">${escapeHtml(h.title)}</span>
  </a>
  ${h.snippet ? `<div class="search-snippet">${escapeHtml(h.snippet)}</div>` : ""}
  <div class="search-score">${(h.score * 100).toFixed(1)}% match</div>
</li>`,
              )
              .join("")}</ol>`;
      resultsBlock = renderPassages(passages) + documents;
    }
  } else if (query.length === 0) {
    summary = "Phrase queries work as well as keywords.";
    resultsBlock = "";
  } else {
    summary = "The record is empty so far.";
    resultsBlock = "";
  }

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

async function resolveHits(
  env: Env,
  hits: Array<{ id: string; score: number; metadata: VectorMeta }>,
): Promise<ResolvedHit[]> {
  // Resolve in parallel — each kind has its own lookup. Most lookups are
  // a single SELECT.
  const resolved = await Promise.all(hits.map((h) => resolveOneHit(env, h)));
  return resolved.filter((r): r is ResolvedHit => r !== null);
}

async function resolveOneHit(
  env: Env,
  hit: { id: string; score: number; metadata: VectorMeta },
): Promise<ResolvedHit | null> {
  const md = hit.metadata;
  if (!md.kind) return null;
  try {
    if (md.kind === "entity") {
      const row = await one<{ slug: string; label: string }>(
        env.DB,
        `SELECT p.slug, n.label
           FROM pages p JOIN nodes n ON n.id = p.subject_node_id
          WHERE n.id = ? LIMIT 1`,
        [md.id],
      );
      if (!row) return null;
      return {
        url: `/s/${row.slug}`,
        kind: "entity",
        title: row.label ?? md.title ?? md.id,
        snippet: "",
        score: hit.score,
      };
    }
    if (md.kind === "piece") {
      const row = await one<{ slug: string; title: string; excerpt: string | null }>(
        env.DB,
        `SELECT slug, title, substr(body_md, 1, 220) AS excerpt
           FROM pieces WHERE id = ? LIMIT 1`,
        [md.id],
      );
      if (!row) return null;
      return {
        url: `/library/${row.slug}`,
        kind: "piece",
        title: row.title ?? md.title ?? md.id,
        snippet: (row.excerpt ?? "").replace(/\s+/g, " ").trim(),
        score: hit.score,
      };
    }
    if (md.kind === "claim") {
      const row = await one<{ claim_text: string; page_slug: string | null }>(
        env.DB,
        `SELECT pc.claim_text,
                (SELECT p.slug FROM pages p WHERE p.id = pc.page_id) AS page_slug
           FROM page_claims pc WHERE pc.id = ? LIMIT 1`,
        [md.id],
      );
      if (!row || !row.page_slug) return null;
      return {
        url: `/s/${row.page_slug}?mode=signed`,
        kind: "claim",
        title: row.claim_text.slice(0, 140),
        snippet: "",
        score: hit.score,
      };
    }
    if (md.kind === "thesis" || md.kind === "article") {
      const row = await one<{ slug: string; thesis: string | null }>(
        env.DB,
        "SELECT slug, thesis FROM pages WHERE id = ? LIMIT 1",
        [md.id],
      );
      if (!row) return null;
      const kind: VectorMeta["kind"] = md.kind;
      return {
        url: kind === "article" ? `/investigations/${row.slug}` : `/s/${row.slug}?mode=signed`,
        kind,
        title: row.thesis ?? md.title ?? md.id,
        snippet: "",
        score: hit.score,
      };
    }
    if (md.kind === "source") {
      return {
        url: `/q/${md.id}`,
        kind: "source",
        title: md.title ?? "Quote",
        snippet: "",
        score: hit.score,
      };
    }
  } catch {
    return null;
  }
  return null;
}
