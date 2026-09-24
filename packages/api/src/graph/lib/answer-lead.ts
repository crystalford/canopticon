// ANSWER ONE LEAD — narrow enough that you can check it instead of trusting it.
//
// "I do not trust the results built in our own system."
//
// That is the correct reaction to what "Dig here" used to do, which was fire
// the full deep-research pipeline at a question one sentence wide: a broad web
// search, twelve sources read to twelve percent each, and a three-thousand-word
// brief. A brief is untrustable BY CONSTRUCTION — it is too long to verify,
// every sentence is the model's, and nothing in it is checkable without
// redoing the work.
//
// This makes the opposite bet. A lead is already a specific question with a
// stated reason, so the answer to it should be:
//
//   · two or three sentences, and no more
//   · every supporting quote located VERBATIM in a stored document
//   · anything that fails that check thrown away, and the count shown
//
// You do not have to trust it, because you can read the whole thing and follow
// every quote in half a minute. That is a categorically different artifact
// from a brief, and it is the only kind this runtime can produce well.
//
// A CONTRADICTION NEEDS NO SEARCH
//
// The sharpest lead kind — two documents that disagree — is answerable from
// material already held, in full. No web fetch, no third-party page banked, no
// new population to guard (CLAUDE.md, record-expand). The model reads both
// documents and says which is right, or why they differ, and every word it
// quotes is checked against the documents themselves.
//
// The model runs at AUTHORING time and the answer is frozen into a row
// (standing rule 5). Nothing here is called to render a page.

import type { Env } from "../../env";
import { all, insertOne, one, run } from "../../lib/d1";
import { callResearchWriter } from "../../llm/router";
import { locateVerbatim } from "./digestion-typed";
import { readFullExtractedText } from "./extract";
import type { Lead } from "./leads";
import { expandRecord } from "./record-builder";

/** Enough of each document for a narrow question. A lead is not a survey. */
const CHARS_PER_DOCUMENT = 24_000;

/** Two or three sentences. The cap is the feature. */
const ANSWER_MAX_TOKENS = 900;

/** More than this and it has stopped being a lead answer. */
const MAX_QUOTES = 4;

export interface LeadAnswer {
  lead_key: string;
  status: "answered" | "nothing_found" | "failed";
  answer_md: string | null;
  quotes: VerifiedQuote[];
  discarded: number;
  error?: string | null;
  /** The model that wrote it, so a Claude answer and a free one are told apart. */
  model?: string | null;
  /**
   * The web pages an unsourced-figure answer quotes from, derived from its
   * quotes' `source_id`s. Absent on a contradiction answer, which quotes only
   * the documents already held.
   */
  sources?: AnswerSource[];
}

export interface AnswerSource {
  /** `sources.id` — a fetched page banked by record-builder, never a piece. */
  id: string;
  url: string | null;
  title: string | null;
}

export interface VerifiedQuote {
  /** THE DOCUMENT'S substring, never the model's — see verify() below. */
  text: string;
  /** Null when the quote is from a fetched web source rather than a piece. */
  piece_id: string | null;
  slug: string | null;
  title: string | null;
  /** Set when the span was located in a banked `sources` row (web page). */
  source_id?: string;
  url?: string | null;
}

/**
 * A stable key for a lead.
 *
 * Leads are computed by queries over the graph and have no id of their own, so
 * an answer keys on what the lead IS. When the underlying contradiction is
 * resolved the lead stops being generated and its answer stops being rendered,
 * which is the behaviour we want — a stale answer to a question nobody is
 * asking any more should disappear on its own.
 */
export async function leadKey(kind: string, seed: string): Promise<string> {
  const data = new TextEncoder().encode(`${kind}\n${seed}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const PROMPT = `You are answering ONE narrow question for an investigative record.

You will be given the question, why it is worth asking, and the full text of
the documents that raised it.

Answer in AT MOST THREE SENTENCES. Not an essay, not a summary of the
documents, not a restatement of the question — the answer itself.

Then give up to 4 quotes that support it.

HARD RULES:
- Every quote MUST be copied character for character from one of the documents
  below. Do not paraphrase, tidy, join or shorten. A quote that is not found
  verbatim is discarded and your answer loses its support.
- Quote whole sentences. A fragment cannot be checked.
- If the documents do not settle it, say exactly what they DO establish and
  what is still missing. That is a real answer and a useful one.
- If they contain nothing relevant at all, set "answer" to an empty string.
- No preamble. No "based on the documents provided".

Return ONLY minified JSON:
{"answer":"...","quotes":[{"text":"...","document":"<exact title>"}]}`;

interface RawAnswer {
  answer?: unknown;
  quotes?: unknown;
}

interface SourceDoc {
  id: string;
  slug: string | null;
  title: string;
  body_md: string;
  /** Present when the "document" is a fetched web page (`sources` row). */
  source_id?: string;
  url?: string | null;
}

/**
 * Answer a lead from the documents that raised it.
 *
 * Returns the answer AND persists it, so the caller can render immediately and
 * the library can render it again later without re-running anything.
 */
export async function answerLead(
  env: Env,
  userId: string,
  lead: Lead,
  opts: { writer?: string | null } = {},
): Promise<LeadAnswer> {
  const key = await leadKey(lead.kind, lead.seed);
  const docs = await sourceDocuments(env, userId, lead);

  if (!docs.length) {
    return persist(env, userId, key, lead, {
      lead_key: key,
      status: "failed",
      answer_md: null,
      quotes: [],
      discarded: 0,
      error: "the documents behind this lead are no longer readable",
    });
  }

  const corpus = docs
    .map((d) => `### ${d.title}\n${d.body_md.slice(0, CHARS_PER_DOCUMENT)}`)
    .join("\n\n");

  const out = await callResearchWriter(
    env,
    {
      userId,
      system: PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `QUESTION: ${lead.seed}\n\nWHY IT IS WORTH ASKING: ${lead.angle}\n\nDOCUMENTS:\n${corpus}`,
            },
          ],
        },
      ],
      max_tokens: ANSWER_MAX_TOKENS,
      // Distinct per writer, so choosing Claude after a free run does not hand
      // back the free run's cached answer.
      idempotency_key: `lead:${key}:${opts.writer ?? "default"}`,
    },
    { writer: opts.writer ?? null },
  ).catch((e: unknown) => {
    return {
      text: "",
      structured: null,
      model: null,
      error: e instanceof Error ? e.message : String(e),
    } as {
      text: string;
      structured: unknown;
      model: string | null;
      error?: string;
    };
  });

  const failed = (out as { error?: string }).error;
  if (failed) {
    return persist(env, userId, key, lead, {
      lead_key: key,
      status: "failed",
      answer_md: null,
      quotes: [],
      discarded: 0,
      error: failed,
    });
  }

  const parsed = (out.structured ?? safeParse(out.text) ?? null) as RawAnswer | null;
  const answer = typeof parsed?.answer === "string" ? parsed.answer.trim() : "";
  const proposed = Array.isArray(parsed?.quotes) ? parsed.quotes : [];

  const { quotes, discarded } = verify(proposed, docs);

  // An answer with no surviving quote is not "an answer with no quotes" — on a
  // record whose whole argument is provenance it is an unsupported assertion,
  // and the honest thing is to say nothing was established rather than to
  // publish the prose and let it look sourced.
  if (!answer || quotes.length === 0) {
    return persist(env, userId, key, lead, {
      lead_key: key,
      status: "nothing_found",
      answer_md: answer || null,
      quotes: [],
      discarded,
      model: out.model ?? null,
    });
  }

  return persist(env, userId, key, lead, {
    lead_key: key,
    status: "answered",
    answer_md: answer,
    quotes,
    discarded,
    model: out.model ?? null,
  });
}

/**
 * The verbatim firewall.
 *
 * The same one the extractor trusts: the model PROPOSES a span, and
 * locateVerbatim decides. What is stored is the DOCUMENT'S substring at the
 * located offset, never the string the model returned — so a quote that has
 * been silently tidied cannot survive by being close enough.
 *
 * Exported because this is the part that makes a lead answer checkable, and
 * therefore the part worth testing hardest.
 */
export function verify(
  proposed: unknown[],
  docs: SourceDoc[],
): { quotes: VerifiedQuote[]; discarded: number } {
  const quotes: VerifiedQuote[] = [];
  let discarded = 0;

  for (const raw of proposed) {
    if (quotes.length >= MAX_QUOTES) break;
    const text =
      typeof (raw as { text?: unknown })?.text === "string" ? (raw as { text: string }).text : "";
    if (!text.trim()) {
      discarded++;
      continue;
    }

    // The model names which document it quoted, but that claim is not trusted
    // either: every document is searched, and the one that actually contains
    // the span wins. A right quote attributed to the wrong document is still a
    // right quote, and a wrong one is caught by nobody having it.
    let found: { doc: SourceDoc; text: string } | null = null;
    for (const doc of docs) {
      const hit = locateVerbatim(doc.body_md, text);
      if (hit) {
        found = { doc, text: hit.text };
        break;
      }
    }

    if (!found) {
      discarded++;
      continue;
    }
    if (quotes.some((q) => q.text === found.text)) continue;

    quotes.push({
      text: found.text,
      piece_id: found.doc.source_id ? null : found.doc.id,
      slug: found.doc.slug,
      title: found.doc.title,
      ...(found.doc.source_id
        ? { source_id: found.doc.source_id, url: found.doc.url ?? null }
        : {}),
    });
  }

  return { quotes, discarded };
}

// ---- an unsourced figure — the narrow way ---------------------------------
//
// "$1.2B — no source named anywhere" used to fire the broad research
// pipeline: twelve sources, a three-thousand-word brief. A missing
// attribution needs the web, but not that. This fetches a handful of pages
// for ONE focused query, banks them as `sources` rows (never pieces — that
// population is guarded, CLAUDE.md), and asks the writer once for three
// sentences: who reports the figure, where, when. Every quote is located
// verbatim in one of the fetched pages or discarded and counted, exactly as
// a contradiction answer is, and the row lands in lead_answers under the
// lead's key with the source ids carried on the quotes.

/** Pages read for one figure. More than this is a research run, not an answer. */
const MAX_WEB_SOURCES = 3;

/** Enough of a web page for one figure. */
const CHARS_PER_SOURCE = 16_000;

const FIGURE_PROMPT = `You are settling ONE narrow question for an investigative record: a figure
appears in a document with no source named. Who reports this figure, where,
and when?

You will be given the figure, the sentence it appears in, and the text of a
few web pages fetched for it.

Answer in AT MOST THREE SENTENCES: who reports the figure (the organisation
or author), where (the publication or document), and when (the date, as
precisely as the pages allow). If the pages give a different figure, say so.

Then give up to 4 quotes that support it.

HARD RULES:
- Every quote MUST be copied character for character from one of the pages
  below. Do not paraphrase, tidy, join or shorten. A quote that is not found
  verbatim is discarded and your answer loses its support.
- Quote whole sentences. A fragment cannot be checked.
- If the pages do not settle it, say exactly what they DO establish and what
  is still missing. That is a real answer and a useful one.
- If they contain nothing relevant at all, set "answer" to an empty string.
- No preamble. No "based on the pages provided".

Return ONLY minified JSON:
{"answer":"...","quotes":[{"text":"...","document":"<exact page title>"}]}`;

export interface WebSource {
  id: string;
  url: string | null;
  title: string;
  text: string;
}

export interface UnsourcedFigureOptions {
  writer?: string | null;
  /**
   * Test seams. `bank` searches and fetches, returning the banked source ids
   * (record-builder's expandRecord by default — sources only, never pieces).
   * `read` returns one banked source in full.
   */
  bank?: (env: Env, userId: string, query: string) => Promise<string[]>;
  read?: (env: Env, userId: string, sourceId: string) => Promise<WebSource | null>;
}

/**
 * The search query for a figure: the figure with what it measures, plus the
 * sentence it sits in — trimmed, unquoted, and without the figure repeated.
 * A bare number finds nothing; a whole paragraph finds everything.
 */
export function figureQuery(lead: Pick<Lead, "seed" | "detail">): string {
  const seed = lead.seed.replace(/\s+/g, " ").trim();
  const context = (lead.detail ?? "").replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
  if (!context || context === seed) return seed;
  // The sentence around the figure, capped so the query stays a query.
  const words = context.split(" ").filter((w) => !seed.includes(w));
  const clipped = words.slice(0, 14).join(" ");
  return clipped ? `${seed} ${clipped}` : seed;
}

async function defaultBank(env: Env, userId: string, query: string): Promise<string[]> {
  const report = await expandRecord(env, userId, query);
  if (!report.configured) throw new Error("web search is not configured (BRAVE_SEARCH_API_KEY)");
  return report.banked_source_ids.slice(0, MAX_WEB_SOURCES);
}

async function defaultRead(env: Env, userId: string, sourceId: string): Promise<WebSource | null> {
  const meta = await one<{ url: string | null; title: string | null }>(
    env.DB,
    "SELECT url, title FROM sources WHERE id = ? AND user_id = ?",
    [sourceId, userId],
  ).catch(() => null);
  if (!meta) return null;
  const full = await readFullExtractedText(env, sourceId, userId);
  if (!full.text) return null;
  return { id: sourceId, url: meta.url, title: full.title || meta.title || "", text: full.text };
}

/**
 * Answer an unsourced-figure lead from a few fetched pages.
 *
 * Same contract as answerLead: returns the answer AND persists it under the
 * lead's key, three sentences, up to four verbatim quotes, discards counted,
 * zero survivors → "nothing_found". The only difference is where the quotes
 * are allowed to come from: the pages fetched for this figure, each of which
 * is a `sources` row the answer can cite by url and title.
 */
export async function answerUnsourcedFigure(
  env: Env,
  userId: string,
  lead: Lead,
  opts: UnsourcedFigureOptions = {},
): Promise<LeadAnswer> {
  const key = await leadKey(lead.kind, lead.seed);
  const fail = (error: string) =>
    persist(env, userId, key, lead, {
      lead_key: key,
      status: "failed",
      answer_md: null,
      quotes: [],
      discarded: 0,
      error,
    });

  const query = figureQuery(lead);
  if (!query) return fail("nothing to search for");

  let ids: string[];
  try {
    ids = (await (opts.bank ?? defaultBank)(env, userId, query)).slice(0, MAX_WEB_SOURCES);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  const read = opts.read ?? defaultRead;
  const pages = (
    await Promise.all(ids.map((id) => read(env, userId, id).catch(() => null)))
  ).filter((p): p is WebSource => p !== null && p.text.length > 0);
  if (!pages.length) return fail("no page could be fetched for this figure");

  const docs: SourceDoc[] = pages.map((p) => ({
    id: p.id,
    slug: null,
    title: p.title || p.url || p.id,
    body_md: p.text,
    source_id: p.id,
    url: p.url,
  }));
  const corpus = docs
    .map(
      (d) => `### ${d.title}${d.url ? ` (${d.url})` : ""}\n${d.body_md.slice(0, CHARS_PER_SOURCE)}`,
    )
    .join("\n\n");

  const out = await callResearchWriter(
    env,
    {
      userId,
      system: FIGURE_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `FIGURE: ${lead.seed}\n\nWHERE IT APPEARS: ${lead.detail}\n\nWHY IT IS WORTH ASKING: ${lead.angle}\n\nPAGES:\n${corpus}`,
            },
          ],
        },
      ],
      max_tokens: ANSWER_MAX_TOKENS,
      idempotency_key: `lead:${key}:${opts.writer ?? "default"}:${ids.join(",")}`,
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
  const answer = typeof parsed?.answer === "string" ? parsed.answer.trim() : "";
  const proposed = Array.isArray(parsed?.quotes) ? parsed.quotes : [];
  const { quotes, discarded } = verify(proposed, docs);

  if (!answer || quotes.length === 0) {
    return persist(env, userId, key, lead, {
      lead_key: key,
      status: "nothing_found",
      answer_md: answer || null,
      quotes: [],
      discarded,
      model: out.model ?? null,
      sources: [],
    });
  }
  return persist(env, userId, key, lead, {
    lead_key: key,
    status: "answered",
    answer_md: answer,
    quotes,
    discarded,
    model: out.model ?? null,
    sources: sourcesOf(quotes),
  });
}

/** The distinct web sources a set of verified quotes came from, in quote order. */
export function sourcesOf(quotes: VerifiedQuote[]): AnswerSource[] {
  const seen = new Map<string, AnswerSource>();
  for (const q of quotes) {
    if (q.source_id && !seen.has(q.source_id)) {
      seen.set(q.source_id, { id: q.source_id, url: q.url ?? null, title: q.title });
    }
  }
  return [...seen.values()];
}

/**
 * The documents a lead is answerable from.
 *
 * A contradiction names two pieces and both are held in full, so this needs no
 * web search at all — which is why this lead kind is the one worth answering
 * first. Nothing enters the corpus to answer it.
 */
async function sourceDocuments(env: Env, userId: string, lead: Lead): Promise<SourceDoc[]> {
  const slugs = [lead.piece_slug, lead.other_piece_slug].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  if (slugs.length === 0) {
    const row = await one<SourceDoc>(
      env.DB,
      "SELECT id, slug, title, COALESCE(body_md,'') AS body_md FROM pieces WHERE id = ? AND user_id = ?",
      [lead.piece_id, userId],
    ).catch(() => null);
    return row?.body_md ? [row] : [];
  }
  const marks = slugs.map(() => "?").join(",");
  const rows = await all<SourceDoc>(
    env.DB,
    `SELECT id, slug, title, COALESCE(body_md,'') AS body_md
       FROM pieces WHERE user_id = ? AND slug IN (${marks})`,
    [userId, ...slugs],
  ).catch(() => []);
  return rows.filter((r) => r.body_md.length > 0);
}

/** One answer per lead: digging again replaces, never stacks. */
async function persist(
  env: Env,
  userId: string,
  key: string,
  lead: Lead,
  answer: LeadAnswer,
): Promise<LeadAnswer> {
  await run(env.DB, "DELETE FROM lead_answers WHERE user_id = ? AND lead_key = ?", [
    userId,
    key,
  ]).catch(() => {});
  await insertOne(env.DB, "lead_answers", {
    user_id: userId,
    lead_key: key,
    kind: lead.kind,
    seed: lead.seed,
    angle: lead.angle,
    piece_id: lead.piece_id,
    status: answer.status,
    answer_md: answer.answer_md,
    quotes: JSON.stringify(answer.quotes),
    discarded: answer.discarded,
    model: answer.model ?? null,
    error: answer.error ?? null,
  }).catch(() => {});
  return answer;
}

/** Stored answers for a set of leads, keyed by lead_key. */
export async function answersForLeads(
  db: D1Database,
  userId: string,
  keys: string[],
): Promise<Map<string, LeadAnswer>> {
  if (!keys.length) return new Map();
  const marks = keys.map(() => "?").join(",");
  const rows = await all<{
    lead_key: string;
    status: LeadAnswer["status"];
    answer_md: string | null;
    quotes: string | null;
    discarded: number;
    error: string | null;
    model: string | null;
  }>(
    db,
    `SELECT lead_key, status, answer_md, quotes, discarded, error, model
       FROM lead_answers WHERE user_id = ? AND lead_key IN (${marks})`,
    [userId, ...keys],
  ).catch(() => []);

  const out = new Map<string, LeadAnswer>();
  for (const r of rows) {
    const quotes = parseQuotes(r.quotes);
    const sources = sourcesOf(quotes);
    out.set(r.lead_key, {
      lead_key: r.lead_key,
      status: r.status,
      answer_md: r.answer_md,
      quotes,
      discarded: r.discarded ?? 0,
      error: r.error,
      model: r.model,
      ...(sources.length ? { sources } : {}),
    });
  }
  return out;
}

function parseQuotes(s: string | null): VerifiedQuote[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as VerifiedQuote[]) : [];
  } catch {
    return [];
  }
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
