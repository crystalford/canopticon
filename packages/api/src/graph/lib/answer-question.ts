// ASK THE RECORD — the record as a mind you can question.
//
// /search already retrieves passages: the verbatim words on file, each with
// its receipt. This is the step after retrieval — the record ANSWERS, in at
// most four sentences, from the documents those passages came out of, and
// every quote it offers in support is located verbatim in one of them by
// the same firewall a lead answer passes through (answer-lead.ts, verify).
// A quote that is not on file is discarded and counted; an answer with no
// surviving quote is "nothing_found". The record does not hold this — is a
// finding, not an error (standing rule 6).
//
// The model runs at AUTHORING time, once, when the operator presses "Ask the
// record", and the answer is frozen into a lead_answers row under
// kind "question" (standing rule 5). /search renders the row for every
// reader; nothing here is called to render a page. A question gets no URL
// of its own — the answer lives on the search page for that question.

import type { Env } from "../../env";
import { all, insertOne, one, run } from "../../lib/d1";
import { callResearchWriter } from "../../llm/router";
import { type LeadAnswer, type VerifiedQuote, leadKey, verify } from "./answer-lead";
import { searchVectors } from "./embeddings";

/** Passages retrieved for one question, exactly as /search does it. */
const PASSAGE_TOP_K = 8;

/** Documents read. More than this is a survey, not an answer. */
const MAX_DOCUMENTS = 4;

/** Text read per document, centred on the hit passages. */
const CHARS_PER_DOCUMENT = 12_000;

/** Four sentences. The cap is the feature. */
const ANSWER_MAX_TOKENS = 700;

export const QUESTION_KIND = "question";

export interface RetrievedDoc {
  id: string;
  slug: string | null;
  title: string;
  /** The window the writer sees, and the text quotes are verified against. */
  body_md: string;
}

export interface AnswerQuestionOptions {
  writer?: string | null;
  /** Test seam: the documents to answer from. Vectorize + D1 by default. */
  retrieve?: (env: Env, userId: string, question: string) => Promise<RetrievedDoc[]>;
}

/** A verified quote, plus its receipt when the record already holds one. */
export type QuestionQuote = VerifiedQuote & { quote_id?: string | null };

export interface QuestionAnswer extends LeadAnswer {
  quotes: QuestionQuote[];
  /** When the row was frozen; read back for /search.json, null on a fresh answer. */
  created_at?: string | null;
}

/**
 * The same question asked twice is the same question: lower-cased, whitespace
 * collapsed, trailing question mark dropped.
 */
export function normaliseQuestion(q: string): string {
  return q.toLowerCase().replace(/\s+/g, " ").trim().replace(/\?+$/, "").trim();
}

export function questionKey(q: string): Promise<string> {
  return leadKey(QUESTION_KIND, normaliseQuestion(q));
}

const PROMPT = `You are answering ONE question for a research record, from the record's own
documents and nothing else.

You will be given the question and excerpts from the documents on file that
are closest to it.

Answer in AT MOST FOUR SENTENCES. Not a summary of the documents, not a
restatement of the question — the answer itself, as the documents give it.

Then give up to 4 quotes that support it.

HARD RULES:
- Answer ONLY from the documents below. Nothing you know from elsewhere.
- Every quote MUST be copied character for character from one of the
  documents. Each quote will be MECHANICALLY CHECKED against the documents'
  text and DROPPED if it is not verbatim. Do not paraphrase, tidy, join or
  shorten. Quote whole sentences — a fragment cannot be checked.
- If the documents do not answer the question, do not guess: set
  "cannot_answer" to true and say in "answer" what they DO establish, or
  leave "answer" empty. "The record does not hold this" is a real answer.
- No preamble. No "based on the documents provided".

Return ONLY minified JSON:
{"answer":"...","quotes":[{"text":"...","slug":"<document slug>"}],"cannot_answer":false}`;

interface RawAnswer {
  answer?: unknown;
  answer_md?: unknown;
  quotes?: unknown;
  cannot_answer?: unknown;
}

/**
 * Answer a question from the record.
 *
 * Returns the answer AND persists it under the question's key, replacing any
 * earlier answer, so /search can render it for every reader without
 * re-running anything.
 */
export async function answerQuestion(
  env: Env,
  userId: string,
  question: string,
  opts: AnswerQuestionOptions = {},
): Promise<QuestionAnswer> {
  const asked = question.replace(/\s+/g, " ").trim();
  const key = await questionKey(asked);
  const fail = (error: string) =>
    persist(env, userId, key, asked, {
      lead_key: key,
      status: "failed",
      answer_md: null,
      quotes: [],
      discarded: 0,
      error,
    });
  if (!asked) return fail("no question was asked");

  let docs: RetrievedDoc[];
  try {
    docs = (await (opts.retrieve ?? retrieveDocuments)(env, userId, asked))
      .filter((d) => d.body_md.length > 0)
      .slice(0, MAX_DOCUMENTS);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  // Nothing retrieved is not a failure: the record has nothing near this
  // question, and that is what the row should say.
  if (!docs.length) {
    return persist(env, userId, key, asked, {
      lead_key: key,
      status: "nothing_found",
      answer_md: null,
      quotes: [],
      discarded: 0,
    });
  }

  const corpus = docs
    .map((d) => `### ${d.title} (slug: ${d.slug ?? d.id})\n${d.body_md}`)
    .join("\n\n");

  const out = await callResearchWriter(
    env,
    {
      userId,
      system: PROMPT,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: `QUESTION: ${asked}\n\nDOCUMENTS:\n${corpus}` }],
        },
      ],
      max_tokens: ANSWER_MAX_TOKENS,
      // Distinct per writer, so choosing Claude after a free run does not hand
      // back the free run's cached answer.
      idempotency_key: `ask:${key}:${opts.writer ?? "default"}`,
    },
    { writer: opts.writer ?? null },
  ).catch((e: unknown) => ({
    text: "",
    structured: null as unknown,
    model: null as string | null,
    error: e instanceof Error ? e.message : String(e),
  }));

  const failed = (out as { error?: string }).error;
  if (failed) return fail(failed);

  const parsed = (out.structured ?? safeParse(out.text) ?? null) as RawAnswer | null;
  const rawAnswer = typeof parsed?.answer === "string" ? parsed.answer : parsed?.answer_md;
  const answer = typeof rawAnswer === "string" ? rawAnswer.trim() : "";
  const cannot = parsed?.cannot_answer === true;
  const proposed = Array.isArray(parsed?.quotes) ? parsed.quotes : [];

  // The firewall. The model names a slug per quote; verify() searches every
  // retrieved document regardless and keeps the one the span is actually in.
  const { quotes, discarded } = verify(proposed, docs);

  // "cannot_answer" from the model, or an answer no document supports: both
  // are the record saying it does not hold this. Neither is an error.
  if (cannot || !answer || quotes.length === 0) {
    return persist(env, userId, key, asked, {
      lead_key: key,
      status: "nothing_found",
      answer_md: answer || null,
      quotes: [],
      discarded,
      model: out.model ?? null,
    });
  }

  return persist(env, userId, key, asked, {
    lead_key: key,
    status: "answered",
    answer_md: answer,
    quotes: await withReceipts(env, quotes),
    discarded,
    model: out.model ?? null,
  });
}

/**
 * The documents a question is answerable from: the top passages by vector
 * search (kind "quote", the same query /search runs), grouped by the
 * published document each lives in, at most four documents, and for each a
 * window of text around its hit passages.
 */
async function retrieveDocuments(
  env: Env,
  userId: string,
  question: string,
): Promise<RetrievedDoc[]> {
  const hits = await searchVectors(env, {
    query: question,
    userId,
    topK: PASSAGE_TOP_K,
    kinds: ["quote"],
  });
  const ids = [
    ...new Set(
      hits.filter((h) => h.metadata.kind === "quote" && h.metadata.id).map((h) => h.metadata.id),
    ),
  ];
  if (!ids.length) return [];
  const rows = await all<{
    id: string;
    verbatim_text: string;
    piece_id: string;
    slug: string;
    title: string;
  }>(
    env.DB,
    `SELECT q.id, q.verbatim_text, p.id AS piece_id, p.slug, p.title
       FROM quotes q
       JOIN nodes n ON n.id = q.source_id
       JOIN pieces p ON p.id = n.piece_id
      WHERE q.id IN (${ids.map(() => "?").join(",")})
        AND p.user_id = ?
        AND p.publication_status IN ('published','canonical')`,
    [...ids, userId],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  // Pieces in hit order, so the closest passage's document is read first.
  const pieces = new Map<string, { slug: string; title: string; passages: string[] }>();
  for (const id of ids) {
    const r = byId.get(id);
    if (!r) continue;
    const p = pieces.get(r.piece_id) ?? { slug: r.slug, title: r.title, passages: [] };
    p.passages.push(r.verbatim_text);
    pieces.set(r.piece_id, p);
  }
  const chosen = [...pieces.entries()].slice(0, MAX_DOCUMENTS);
  const docs: RetrievedDoc[] = [];
  for (const [pieceId, p] of chosen) {
    const row = await one<{ body_md: string | null }>(
      env.DB,
      "SELECT body_md FROM pieces WHERE id = ? AND user_id = ?",
      [pieceId, userId],
    ).catch(() => null);
    const body = row?.body_md ?? "";
    if (!body) continue;
    docs.push({
      id: pieceId,
      slug: p.slug,
      title: p.title,
      body_md: windowAround(body, p.passages),
    });
  }
  return docs;
}

/**
 * Up to CHARS_PER_DOCUMENT of a document, centred on where its hit passages
 * sit — or the whole body when it is shorter. Passages that cannot be found
 * (whitespace drift) simply do not pull the window; it then opens at the top.
 */
export function windowAround(body: string, passages: string[], size = CHARS_PER_DOCUMENT): string {
  if (body.length <= size) return body;
  const offsets: number[] = [];
  for (const p of passages) {
    const i = body.indexOf(p.trim());
    if (i >= 0) offsets.push(i);
  }
  if (!offsets.length) return body.slice(0, size);
  const lo = Math.min(...offsets);
  const hi = Math.max(...offsets);
  const centre = Math.floor((lo + hi) / 2);
  let start = Math.max(0, centre - Math.floor(size / 2));
  if (start + size > body.length) start = body.length - size;
  return body.slice(start, start + size);
}

/**
 * A verified quote may already be one of the record's own quotes, in which
 * case it has a /q/ receipt. One query over the documents quoted; a miss
 * costs nothing but the link.
 */
async function withReceipts(env: Env, quotes: VerifiedQuote[]): Promise<QuestionQuote[]> {
  const pieceIds = [...new Set(quotes.map((q) => q.piece_id).filter((x): x is string => !!x))];
  if (!pieceIds.length) return quotes;
  const rows = await all<{ id: string; verbatim_text: string }>(
    env.DB,
    `SELECT q.id, q.verbatim_text
       FROM quotes q JOIN nodes n ON n.id = q.source_id
      WHERE n.piece_id IN (${pieceIds.map(() => "?").join(",")})
        AND q.verbatim_text IN (${quotes.map(() => "?").join(",")})`,
    [...pieceIds, ...quotes.map((q) => q.text)],
  ).catch(() => []);
  const byText = new Map(rows.map((r) => [r.verbatim_text, r.id]));
  return quotes.map((q) => {
    const id = byText.get(q.text);
    return id ? { ...q, quote_id: id } : q;
  });
}

/** One answer per question: asking again replaces, never stacks. */
async function persist(
  env: Env,
  userId: string,
  key: string,
  question: string,
  answer: QuestionAnswer,
): Promise<QuestionAnswer> {
  await run(env.DB, "DELETE FROM lead_answers WHERE user_id = ? AND lead_key = ?", [
    userId,
    key,
  ]).catch(() => {});
  await insertOne(env.DB, "lead_answers", {
    user_id: userId,
    lead_key: key,
    kind: QUESTION_KIND,
    seed: question,
    angle: null,
    piece_id: null,
    status: answer.status,
    answer_md: answer.answer_md,
    quotes: JSON.stringify(answer.quotes),
    discarded: answer.discarded,
    model: answer.model ?? null,
    error: answer.error ?? null,
  }).catch(() => {});
  return answer;
}

/** The stored answer for a question, shaped like answersForLeads' output, or null. */
export async function storedAnswerForQuestion(
  db: D1Database,
  userId: string,
  question: string,
): Promise<QuestionAnswer | null> {
  const key = await questionKey(question);
  const r = await one<{
    lead_key: string;
    status: LeadAnswer["status"];
    answer_md: string | null;
    quotes: string | null;
    discarded: number;
    error: string | null;
    model: string | null;
    created_at?: string | null;
  }>(
    db,
    `SELECT lead_key, status, answer_md, quotes, discarded, error, model, created_at
       FROM lead_answers WHERE user_id = ? AND lead_key = ? AND kind = ?`,
    [userId, key, QUESTION_KIND],
  ).catch(() => null);
  if (!r) return null;
  let quotes: QuestionQuote[] = [];
  try {
    const v = r.quotes ? JSON.parse(r.quotes) : [];
    quotes = Array.isArray(v) ? (v as QuestionQuote[]) : [];
  } catch {
    quotes = [];
  }
  return {
    lead_key: r.lead_key,
    status: r.status,
    answer_md: r.answer_md,
    quotes,
    discarded: r.discarded ?? 0,
    error: r.error,
    model: r.model,
    created_at: r.created_at ?? null,
  };
}

function safeParse(text: string): unknown {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
