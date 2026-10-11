// THE SEARCH MODEL — what /search?q= knows, before any HTML is written.
//
// /search used to build its queries and its markup in one function, so the
// only way to read what the page had found was to parse the page. This is
// the same data as one plain object: the stored answer (if the operator has
// asked the record this question), the verified passages, the documents, and
// — for the operator only — the actions the page offers. render/search.ts
// renders from it; /search.json serves it as is. One query set, two surfaces
// (standing rule 3: nothing is written twice).
//
// Nothing here calls a model to answer. The stored answer is a frozen
// lead_answers row (standing rule 5). The one exception is inherited and
// operator-only: on a miss, the operator is shown an AI preview to triage
// the miss, clearly labelled as not a fact. A reader never triggers it.

import type { Env } from "../../env";
import { type QuestionAnswer, storedAnswerForQuestion } from "../../graph/lib/answer-question";
import { getAnswerPreview } from "../../graph/lib/answers-preview";
import { type VectorMeta, rerankResults, searchVectors } from "../../graph/lib/embeddings";
import { all, insertOne, one } from "../../lib/d1";
import { resolveOperatorId } from "../data";

/** One quote in a stored answer, with its document and receipt when known. */
export interface SearchAnswerQuote {
  text: string;
  slug: string | null;
  title: string | null;
  /** The /q/ receipt id when the record already holds this span. */
  quoteId: string | null;
  /** The receipt URL, or null when there is none to link. */
  url: string | null;
}

/** The record's own frozen answer to this question, or null when never asked. */
export interface SearchAnswer {
  status: "answered" | "nothing_found" | "failed";
  answerMd: string | null;
  quotes: SearchAnswerQuote[];
  /** Proposed quotes that failed the verbatim check and were dropped. */
  discarded: number;
  /** The model that wrote it, short form ("gpt-oss-120b", "claude-opus-5"). */
  model: string | null;
  createdAt: string | null;
}

/** A verified passage: the words on file, the document, the receipt. */
export interface SearchPassage {
  quoteId: string;
  text: string;
  slug: string;
  title: string;
  score: number;
}

export type SearchDocumentKind = VectorMeta["kind"];

/** A document-level hit, resolved to its public URL by kind. */
export interface SearchDocument {
  slug: string;
  title: string;
  kind: SearchDocumentKind;
  excerpt: string;
  /** The closed section the piece is filed under; null when ungrouped or not a piece. */
  section: string | null;
  url: string;
  score: number;
}

/** What the operator can do from here. Never present for a reader. */
export interface SearchOperator {
  /** POST target for "Ask the record" (one writer call, frozen in a row). */
  askAction: string;
  /** POST target for "Research this on the web" (a brief, which is a document). */
  researchAction: string;
  /** A miss only: the labelled AI preview and the form that starts real research. */
  preview: string | null;
  previewResearchAction: string;
}

export interface SearchModel {
  /** The query, trimmed. Empty means the search shell. */
  query: string;
  /**
   * What the run found. "shell": no query. "no-corpus": no operator row, so
   * nothing to search. "miss": a query with no passage and no document.
   * "hits": at least one of either.
   */
  outcome: "shell" | "no-corpus" | "miss" | "hits";
  answer: SearchAnswer | null;
  passages: SearchPassage[];
  documents: SearchDocument[];
  /** Document candidates before the rerank cut; > documents.length when cut. */
  candidates: number;
  /** The page was reached from "Ask the record" and the row may not exist yet. */
  asked: boolean;
  operator: SearchOperator | null;
}

const PASSAGE_LIMIT = 12;
const RESULT_LIMIT = 12;
const CANDIDATE_LIMIT = 25;

const DOCUMENT_KINDS: SearchDocumentKind[] = [
  "piece",
  "entity",
  "claim",
  "thesis",
  "article",
  "source",
];

export const ASK_ACTION = "/op/ask";
export const RESEARCH_ACTION = "/op/leads/dig";
export const PREVIEW_RESEARCH_ACTION = "/op/search/research";

/** Quote hits → the verbatim text and the published document it lives in.
 *  One query; a hit whose document is no longer published resolves to
 *  nothing, so an unpublished piece never surfaces through its quotes. */
export async function resolvePassages(
  env: Env,
  hits: Array<{ id: string; score: number; metadata: VectorMeta }>,
): Promise<SearchPassage[]> {
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
  const out: SearchPassage[] = [];
  const seen = new Set<string>();
  for (const h of quoteHits) {
    const row = byId.get(h.metadata.id);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push({
      quoteId: row.id,
      text: row.verbatim_text,
      slug: row.slug,
      title: row.title,
      score: h.score,
    });
  }
  return out;
}

function shortModel(model: string | null | undefined): string | null {
  if (!model) return null;
  return model.replace(/^@cf\/[^/]+\//, "");
}

export function answerFromStored(a: QuestionAnswer | null): SearchAnswer | null {
  if (!a) return null;
  return {
    status: a.status,
    answerMd: a.answer_md,
    quotes: a.quotes.map((q) => ({
      text: q.text,
      slug: q.slug ?? null,
      title: q.title ?? null,
      quoteId: q.quote_id ?? null,
      url: q.quote_id ? `/q/${q.quote_id}` : null,
    })),
    discarded: a.discarded,
    model: shortModel(a.model),
    createdAt: a.created_at ?? null,
  };
}

export async function searchModel(
  env: Env,
  q: string,
  opts: { isOperator?: boolean; asked?: boolean } = {},
): Promise<SearchModel> {
  const query = q.trim();
  const isOperator = opts.isOperator === true;
  const asked = opts.asked === true;
  const userId = await resolveOperatorId(env.DB);
  const operator = (preview: string | null): SearchOperator | null =>
    isOperator
      ? {
          askAction: ASK_ACTION,
          researchAction: RESEARCH_ACTION,
          preview,
          previewResearchAction: PREVIEW_RESEARCH_ACTION,
        }
      : null;

  if (query.length === 0) {
    return {
      query,
      outcome: "shell",
      answer: null,
      passages: [],
      documents: [],
      candidates: 0,
      asked,
      operator: null,
    };
  }
  if (!userId) {
    return {
      query,
      outcome: "no-corpus",
      answer: null,
      passages: [],
      documents: [],
      candidates: 0,
      asked,
      operator: null,
    };
  }

  const stored = await storedAnswerForQuestion(env.DB, userId, query).catch(() => null);
  const answer = answerFromStored(stored);

  // A wider net (25) than what's actually shown — cosine similarity is a
  // decent candidate filter but a mediocre final ranker (it scores the query
  // and each candidate separately, never together). The rerank pass reads
  // (query, candidate) as one input and reorders for real relevance;
  // RESULT_LIMIT caps what's shown to the reranked top slice.
  const [passageHits, hits] = await Promise.all([
    searchVectors(env, { query, userId, topK: PASSAGE_LIMIT, kinds: ["quote"] }).catch(() => []),
    searchVectors(env, { query, userId, topK: CANDIDATE_LIMIT, kinds: DOCUMENT_KINDS }).catch(
      () => [],
    ),
  ]);
  const passages = await resolvePassages(env, passageHits);
  const resolvedAll = await resolveHits(env, hits);
  const documents =
    resolvedAll.length > 1
      ? (await rerankResults(env, query, resolvedAll, (h) => `${h.title}. ${h.excerpt}`)).slice(
          0,
          RESULT_LIMIT,
        )
      : resolvedAll;

  if (documents.length === 0 && passages.length === 0) {
    // A real miss — log it (cheap; feeds the future "what readers are asking
    // for" research signal) and, for the operator only, fetch a fast
    // AI-generated preview to help triage the miss. That preview is the
    // model's own synthesis, not a quote from any stored document, so it can
    // never become a fact — it is labelled as such wherever it is shown.
    await insertOne(env.DB, "orchestrator_events", {
      user_id: userId,
      event_type: "search.miss",
      subject_kind: "search",
      subject_id: null,
      payload: JSON.stringify({ query }),
    }).catch(() => {});
    const preview = isOperator
      ? await getAnswerPreview(env, userId, query).catch(() => null)
      : null;
    return {
      query,
      outcome: "miss",
      answer,
      passages,
      documents,
      candidates: resolvedAll.length,
      asked,
      operator: operator(preview || null),
    };
  }

  return {
    query,
    outcome: "hits",
    answer,
    passages,
    documents,
    candidates: resolvedAll.length,
    asked,
    operator: operator(null),
  };
}

async function resolveHits(
  env: Env,
  hits: Array<{ id: string; score: number; metadata: VectorMeta }>,
): Promise<SearchDocument[]> {
  // Resolve in parallel — each kind has its own lookup, most a single SELECT.
  const resolved = await Promise.all(hits.map((h) => resolveOneHit(env, h)));
  return resolved.filter((r): r is SearchDocument => r !== null);
}

async function resolveOneHit(
  env: Env,
  hit: { id: string; score: number; metadata: VectorMeta },
): Promise<SearchDocument | null> {
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
        slug: row.slug,
        url: `/s/${row.slug}`,
        kind: "entity",
        title: row.label ?? md.title ?? md.id,
        excerpt: "",
        section: null,
        score: hit.score,
      };
    }
    if (md.kind === "piece") {
      const row = await one<{
        slug: string;
        title: string;
        excerpt: string | null;
        topic?: string | null;
      }>(
        env.DB,
        `SELECT slug, title, substr(body_md, 1, 220) AS excerpt, topic
           FROM pieces WHERE id = ? LIMIT 1`,
        [md.id],
      );
      if (!row) return null;
      return {
        slug: row.slug,
        url: `/p/${row.slug}`,
        kind: "piece",
        title: row.title ?? md.title ?? md.id,
        excerpt: (row.excerpt ?? "").replace(/\s+/g, " ").trim(),
        section: row.topic?.trim() || null,
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
        slug: row.page_slug,
        url: `/s/${row.page_slug}?mode=signed`,
        kind: "claim",
        title: row.claim_text.slice(0, 140),
        excerpt: "",
        section: null,
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
      const kind: SearchDocumentKind = md.kind;
      return {
        slug: row.slug,
        url: kind === "article" ? `/investigations/${row.slug}` : `/s/${row.slug}?mode=signed`,
        kind,
        title: row.thesis ?? md.title ?? md.id,
        excerpt: "",
        section: null,
        score: hit.score,
      };
    }
    if (md.kind === "source") {
      return {
        slug: md.id,
        url: `/q/${md.id}`,
        kind: "source",
        title: md.title ?? "Quote",
        excerpt: "",
        section: null,
        score: hit.score,
      };
    }
  } catch {
    return null;
  }
  return null;
}
