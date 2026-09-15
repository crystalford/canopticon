// The AEO pass — what a research document yields that is worth citing.
//
// This is a SECOND, separate pass from digestion-typed.ts, not a replacement.
// That one extracts a knowledge-graph ontology and feeds /t/ timelines and /q/
// receipts; 13,075 nodes and 6,137 verified quotes already exist from it.
// Breaking it to build this would throw away working provenance.
//
// What this asks for instead is shaped by what the evidence says gets cited:
//
//   findings   a figure, what it measures, when, who reported it.  The
//              strongest-evidenced primitive by some distance — GEO
//              (Aggarwal et al., KDD 2024) measured Statistics Addition,
//              Cite Sources and Quotation Addition as the top three of nine
//              tactics tested.
//   questions  what a person would actually type, and the span that answers
//              it. Moderate evidence, and it works as PAGE STRUCTURE rather
//              than markup — FAQPage rich results were removed in 2026 and
//              QAPage requires user-submitted answers, so neither applies.
//
// Claims are deliberately absent: `assertions` already holds that concept with
// 1,902 rows. Adding a second table for it would be the old mistake.
//
// Nothing here runs at render time. The operator presses a button, the output
// is frozen into rows, and pages are built from the rows (CLAUDE.md rule 5).

import type { Env } from "../../env";
import {
  MIN_ANSWER_WORDS,
  MIN_EVIDENCE,
  countWords,
  gateQuestion,
  normaliseQuestion,
  questionSlug,
} from "../../lib/aeo";
import { all, one, run } from "../../lib/d1";
import { callRole, modelForRole } from "../../llm/router";
import { chunkText } from "./digestion";
import { locateVerbatim } from "./digestion-typed";

/** Matches the existing extractor's ceiling — about 72KB of any document. */
const MAX_CHUNKS = 3;
const MAX_TOKENS = 3000;

const PROMPT = `You read a research document and pull out only what can be CITED.

Return TWO lists and nothing else.

"findings" — measurable facts. Each needs:
  "figure"         the value exactly as the document writes it ("$4.2 billion", "14%", "1,208")
  "measures"       what that number is OF, in a short phrase
  "period"         the period or date it refers to, or null if the document gives none
  "attributed_to"  who produced or reported the number, or null if unstated
  "source_quote"   the sentence containing it

"questions" — questions a person would genuinely type into a search box, that
THIS document answers. Each needs:
  "question"       the question, phrased as a person asks it, not as a heading
  "answer_quote"   the sentence from the document that answers it

HARD RULES:
- "source_quote" and "answer_quote" MUST be copied character for character from
  the document. Do not paraphrase, tidy, join or shorten them. Anything that is
  not found verbatim is discarded and the item is lost.
- Never invent a figure, a date or an attribution that is not in the text. If
  the document does not say, use null.
- Prefer few and specific over many and vague. Eight good findings beat forty
  restatements.
- Do not ask questions the document cannot answer.

Return ONLY minified JSON:
{"findings":[...],"questions":[...]}`;

interface RawFinding {
  figure?: unknown;
  measures?: unknown;
  period?: unknown;
  attributed_to?: unknown;
  source_quote?: unknown;
}
interface RawQuestion {
  question?: unknown;
  answer_quote?: unknown;
}

export interface AeoStats {
  findings: number;
  questions_new: number;
  questions_merged: number;
  /** Spans the model returned that were not in the document. */
  killed: number;
  /** Which model actually ran, so the caller can report it back. */
  model: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function parse(text: string): { findings: RawFinding[]; questions: RawQuestion[] } {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : text) as Record<string, unknown>;
    return {
      findings: Array.isArray(j.findings) ? (j.findings as RawFinding[]) : [],
      questions: Array.isArray(j.questions) ? (j.questions as RawQuestion[]) : [],
    };
  } catch {
    return { findings: [], questions: [] };
  }
}

/**
 * Store a verified span as a `quotes` row and return its id, or null if the
 * span is not actually in the document.
 *
 * This is the firewall, and it is the same one the typed extractor uses —
 * `locateVerbatim` returns the ORIGINAL document substring, never the model's
 * version of it, so what gets stored is always real document bytes even when
 * the model reformatted whitespace.
 */
async function storeVerifiedQuote(
  env: Env,
  userId: string,
  sourceNodeId: string,
  nodeId: string,
  chunk: string,
  candidate: string,
): Promise<string | null> {
  const located = locateVerbatim(chunk, candidate);
  if (!located) return null;
  const id = crypto.randomUUID();
  await run(
    env.DB,
    `INSERT INTO quotes (id, user_id, source_id, node_id, verbatim_text, byte_offset, byte_length)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, sourceNodeId, nodeId, located.text, located.offset, located.text.length],
  );
  return id;
}

/**
 * Run the pass over one piece. Idempotent by replacement: a re-run clears this
 * piece's findings and its evidence rows first, so pressing the button twice
 * does not double everything. Questions themselves survive, because other
 * documents may be citing them.
 */
export async function extractAeoAtoms(
  env: Env,
  userId: string,
  pieceId: string,
  opts: { model?: string } = {},
): Promise<AeoStats> {
  // The role's own model unless the operator picked one, and either way it is
  // recorded on every row this run writes — see migration 0051.
  const model = opts.model?.trim() || modelForRole("bulk_extraction").model;
  const piece = await one<{ body_md: string; title: string }>(
    env.DB,
    "SELECT body_md, title FROM pieces WHERE id = ? AND user_id = ?",
    [pieceId, userId],
  );
  if (!piece?.body_md)
    return { findings: 0, questions_new: 0, questions_merged: 0, killed: 0, model };

  // The source node this piece's quotes hang from. The typed extractor makes
  // one per piece; reuse it so /q/ receipts resolve back to the document
  // through the same join they already use.
  const sourceNode = await one<{ id: string }>(
    env.DB,
    "SELECT id FROM nodes WHERE user_id = ? AND piece_id = ? AND kind = 'source' LIMIT 1",
    [userId, pieceId],
  );
  if (!sourceNode) {
    // No extraction has ever run for this piece, so there is nothing for a
    // quote to point at. Say so rather than writing dangling rows.
    throw new Error("piece has no source node — run document extraction first");
  }

  await clearAeoAtoms(env, userId, pieceId);

  const chunks = chunkText(piece.body_md).slice(0, MAX_CHUNKS);
  const stats: AeoStats = { findings: 0, questions_new: 0, questions_merged: 0, killed: 0, model };

  for (const [i, chunk] of chunks.entries()) {
    // Reuses the `bulk_extraction` role deliberately, and a bigger model is
    // NOT an upgrade here. Measured live 2026-09-15 via /v1/admin/debug-model
    // on an AEO-shaped prompt at this exact max_tokens:
    //
    //   llama-4-scout-17b (this role)  11.7s — clean JSON, verbatim quotes,
    //                                  questions phrased as a searcher types
    //   gpt-oss-120b                   >30s, no response at all
    //
    // The catalog's stronger models are REASONING models, and reasoning_content
    // scales with task difficulty until it eats the token budget and the call
    // dies — the same failure that zeroed the corpus's yield across 50
    // documents in July (see bulk_extraction's `why` in llm/router.ts). The
    // trap is that they look fine when probed: gpt-oss-120b answered a
    // one-sentence version of this prompt in 2.4s. Difficulty, not size, is
    // what sets the latency, so a cheap sanity ping proves nothing.
    //
    // So this is not a cost-vs-quality tradeoff. The 17B non-reasoning model
    // is the one that produces output; the 120B one produces none.
    const out = await callRole(env, "bulk_extraction", {
      userId,
      system: PROMPT,
      messages: [{ role: "user", content: [{ type: "text", text: chunk }] }],
      max_tokens: MAX_TOKENS,
      // Keyed on the model too: re-running the same piece under a different
      // model is a DIFFERENT call, and sharing a key would serve the first
      // model's cached answer for the second — silently comparing a model
      // against itself, which is the one way this toggle could lie.
      idempotency_key: `${pieceId}:aeo:${model}:${i}`,
      model,
    });
    const { findings, questions } = parse(out.text);

    for (const f of findings) {
      const figure = str(f.figure);
      const measures = str(f.measures);
      const quote = str(f.source_quote);
      if (!figure || !measures || !quote) continue;
      const quoteId = await storeVerifiedQuote(
        env,
        userId,
        sourceNode.id,
        sourceNode.id,
        chunk,
        quote,
      );
      if (!quoteId) {
        stats.killed++;
        continue;
      }
      await run(
        env.DB,
        `INSERT INTO findings
           (id, user_id, piece_id, quote_id, figure, measures, period, attributed_to, model)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          userId,
          pieceId,
          quoteId,
          figure,
          measures,
          str(f.period) || null,
          str(f.attributed_to) || null,
          model,
        ],
      );
      stats.findings++;
    }

    for (const q of questions) {
      const question = str(q.question);
      const answer = str(q.answer_quote);
      if (!question || !answer) continue;
      const quoteId = await storeVerifiedQuote(
        env,
        userId,
        sourceNode.id,
        sourceNode.id,
        chunk,
        answer,
      );
      if (!quoteId) {
        stats.killed++;
        continue;
      }
      const merged = await upsertQuestion(env, userId, question);
      if (!merged) {
        stats.killed++;
        continue;
      }
      if (merged.created) stats.questions_new++;
      else stats.questions_merged++;
      // The unique index absorbs a repeat of the same (question, piece, quote).
      await run(
        env.DB,
        `INSERT OR IGNORE INTO question_evidence
           (id, user_id, question_id, piece_id, quote_id, answer_text, model)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), userId, merged.id, pieceId, quoteId, located(chunk, answer), model],
      );
    }
  }

  return stats;
}

/** The stored answer text is the verified span, never the model's rewrite. */
function located(chunk: string, candidate: string): string {
  return locateVerbatim(chunk, candidate)?.text ?? candidate;
}

/**
 * Find or create the canonical question row. Returns whether it was new, so
 * the operator can see how much a document added versus corroborated.
 */
async function upsertQuestion(
  env: Env,
  userId: string,
  question: string,
): Promise<{ id: string; created: boolean } | null> {
  const norm = normaliseQuestion(question);
  // A question made only of filler normalises to nothing. Every such question
  // would share the empty merge key and fuse into a single nonsense page —
  // the exact false merge the key is written to avoid. Drop it instead.
  if (!norm) return null;
  const existing = await one<{ id: string }>(
    env.DB,
    "SELECT id FROM questions WHERE user_id = ? AND question_norm = ?",
    [userId, norm],
  );
  if (existing) return { id: existing.id, created: false };

  const id = crypto.randomUUID();
  // Slugs must be unique per operator; a collision on a different question is
  // rare but would otherwise fail the insert.
  let slug = questionSlug(question);
  const clash = await one<{ id: string }>(
    env.DB,
    "SELECT id FROM questions WHERE user_id = ? AND slug = ?",
    [userId, slug],
  );
  if (clash) slug = `${slug}-${id.slice(0, 6)}`;

  await run(
    env.DB,
    `INSERT INTO questions (id, user_id, question, question_norm, slug, status)
     VALUES (?, ?, ?, ?, ?, 'proposed')`,
    [id, userId, question, norm, slug],
  );
  return { id, created: true };
}

/**
 * Drop this piece's atoms. Questions are left standing — another document may
 * be answering them, and the row is the merge point.
 */
export async function clearAeoAtoms(env: Env, userId: string, pieceId: string): Promise<void> {
  // Which questions this piece was answering, read BEFORE the delete — after
  // it there is no way back to them, and they are exactly the rows whose
  // evidence just changed.
  const touched = await all<{ question_id: string }>(
    env.DB,
    "SELECT DISTINCT question_id FROM question_evidence WHERE user_id = ? AND piece_id = ?",
    [userId, pieceId],
  );

  await run(env.DB, "DELETE FROM findings WHERE user_id = ? AND piece_id = ?", [userId, pieceId]);
  await run(env.DB, "DELETE FROM question_evidence WHERE user_id = ? AND piece_id = ?", [
    userId,
    pieceId,
  ]);
  // A question nothing answers any more is not a page. Clean it up rather than
  // leaving an empty shell that the gate would refuse anyway.
  await run(
    env.DB,
    `DELETE FROM questions WHERE user_id = ?
       AND NOT EXISTS (SELECT 1 FROM question_evidence e WHERE e.question_id = questions.id)`,
    [userId],
  );

  await regateQuestions(
    env,
    userId,
    touched.map((t) => t.question_id),
  );
}

/**
 * Re-apply the gate to questions whose evidence changed, demoting any that no
 * longer clear it.
 *
 * The gate runs at the publish transition, but evidence is not frozen after
 * it: re-extracting a document deletes that document's answers, and a page
 * that published on three sources can be left standing on one. Without this
 * the site accumulates live URLs below the substance floor — which is the
 * failure the gate exists to prevent, and enforcement for it lands on the
 * whole domain rather than the page.
 *
 * Demotion, not deletion: the question is still a real question, and the next
 * document to answer it re-earns the page through `publishQuestion`.
 */
export async function regateQuestions(
  env: Env,
  userId: string,
  questionIds: string[],
): Promise<number> {
  let demoted = 0;
  for (const questionId of questionIds) {
    const q = await one<{ status: string }>(
      env.DB,
      "SELECT status FROM questions WHERE id = ? AND user_id = ?",
      [questionId, userId],
    );
    if (!q || q.status !== "published") continue;

    const rows = await all<{ answer_text: string }>(
      env.DB,
      "SELECT answer_text FROM question_evidence WHERE user_id = ? AND question_id = ?",
      [userId, questionId],
    );
    const gate = gateQuestion({
      evidenceCount: rows.length,
      answerWords: rows.reduce((n, r) => n + countWords(r.answer_text), 0),
    });
    if (gate.publishable) continue;

    await run(
      env.DB,
      "UPDATE questions SET status = 'proposed', updated_at = ? WHERE id = ? AND user_id = ?",
      [new Date().toISOString(), questionId, userId],
    );
    demoted++;
  }
  return demoted;
}

// ---------------------------------------------------------------------------
// Reads for the render and operator surfaces.

export interface FindingRow {
  id: string;
  figure: string;
  measures: string;
  period: string | null;
  attributed_to: string | null;
  quote_id: string;
  verbatim_text: string;
  model: string | null;
}

export async function findingsForPiece(
  db: D1Database,
  userId: string,
  pieceId: string,
): Promise<FindingRow[]> {
  return all<FindingRow>(
    db,
    `SELECT f.id, f.figure, f.measures, f.period, f.attributed_to,
            f.quote_id, q.verbatim_text, f.model
       FROM findings f JOIN quotes q ON q.id = f.quote_id
      WHERE f.user_id = ? AND f.piece_id = ?
      ORDER BY f.created_at`,
    [userId, pieceId],
  );
}

export interface QuestionRow {
  id: string;
  question: string;
  slug: string;
  status: string;
  evidence_count: number;
  answer_words: number;
  /** Distinct models behind this question's evidence, comma-separated. */
  models: string | null;
}

/** Questions touched by one piece, with the numbers the gate reads. */
export async function questionsForPiece(
  db: D1Database,
  userId: string,
  pieceId: string,
): Promise<QuestionRow[]> {
  return all<QuestionRow>(
    db,
    `SELECT qs.id, qs.question, qs.slug, qs.status,
            (SELECT COUNT(*) FROM question_evidence e2 WHERE e2.question_id = qs.id) AS evidence_count,
            (SELECT COALESCE(SUM(LENGTH(e3.answer_text) - LENGTH(REPLACE(e3.answer_text,' ','')) + 1), 0)
               FROM question_evidence e3 WHERE e3.question_id = qs.id) AS answer_words,
            (SELECT GROUP_CONCAT(DISTINCT e4.model)
               FROM question_evidence e4 WHERE e4.question_id = qs.id) AS models
       FROM questions qs
      WHERE qs.user_id = ?
        AND EXISTS (SELECT 1 FROM question_evidence e WHERE e.question_id = qs.id AND e.piece_id = ?)
      ORDER BY evidence_count DESC, qs.created_at`,
    [userId, pieceId],
  );
}

export interface AnswerEvidence {
  answer_text: string;
  quote_id: string;
  piece_slug: string;
  piece_title: string;
  body_head: string | null;
}

export async function evidenceForQuestion(
  db: D1Database,
  userId: string,
  questionId: string,
): Promise<AnswerEvidence[]> {
  return all<AnswerEvidence>(
    db,
    `SELECT e.answer_text, e.quote_id, p.slug AS piece_slug, p.title AS piece_title,
            SUBSTR(p.body_md, 1, 400) AS body_head
       FROM question_evidence e JOIN pieces p ON p.id = e.piece_id
      WHERE e.user_id = ? AND e.question_id = ?
        AND p.publication_status IN ('published','canonical')
      ORDER BY e.created_at`,
    [userId, questionId],
  );
}

/**
 * Published questions, for the index and the machine surfaces.
 *
 * `status = 'published'` alone is not enough to promise a URL. The page itself
 * renders only evidence drawn from published pieces and only above the gate,
 * so a question whose sources were later unpublished — or whose evidence fell
 * under the floor — resolves to a 404. Listing it in the sitemap, llms.txt and
 * the feed would be advertising a missing page to exactly the crawlers this
 * publication is trying to be citable by. So the list applies the page's own
 * two conditions rather than trusting the flag.
 */
export async function listPublishedQuestions(
  db: D1Database,
  userId: string,
): Promise<Array<{ id: string; question: string; slug: string; updated_at: string }>> {
  return all(
    db,
    `SELECT qs.id, qs.question, qs.slug, qs.updated_at
       FROM questions qs
       JOIN question_evidence e ON e.question_id = qs.id
       JOIN pieces p ON p.id = e.piece_id
      WHERE qs.user_id = ? AND qs.status = 'published'
        AND p.publication_status IN ('published','canonical')
      GROUP BY qs.id
     HAVING COUNT(*) >= ?
        AND SUM(LENGTH(e.answer_text) - LENGTH(REPLACE(e.answer_text,' ','')) + 1) >= ?
      ORDER BY qs.updated_at DESC LIMIT 2000`,
    [userId, MIN_EVIDENCE, MIN_ANSWER_WORDS],
  );
}

export async function getQuestionBySlug(
  db: D1Database,
  userId: string,
  slug: string,
): Promise<{ id: string; question: string; slug: string; status: string } | null> {
  return one(
    db,
    "SELECT id, question, slug, status FROM questions WHERE user_id = ? AND slug = ?",
    [userId, slug],
  );
}

/** Flip a proposed question live, refusing anything the gate rejects. */
export async function publishQuestion(
  env: Env,
  userId: string,
  questionId: string,
): Promise<{ ok: boolean; reason: string | null }> {
  const rows = await all<{ answer_text: string }>(
    env.DB,
    "SELECT answer_text FROM question_evidence WHERE user_id = ? AND question_id = ?",
    [userId, questionId],
  );
  const gate = gateQuestion({
    evidenceCount: rows.length,
    answerWords: rows.reduce((n, r) => n + countWords(r.answer_text), 0),
  });
  if (!gate.publishable) return { ok: false, reason: gate.reason };
  await run(
    env.DB,
    "UPDATE questions SET status = 'published', updated_at = ? WHERE id = ? AND user_id = ?",
    [new Date().toISOString(), questionId, userId],
  );
  return { ok: true, reason: null };
}
