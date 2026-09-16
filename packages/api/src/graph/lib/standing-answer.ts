// What the corpus establishes about one question.
//
// A question page gathers verified quotes from several documents. That is the
// right spine — it compounds as documents arrive rather than competing with
// them — but quotes alone are a list, and a list is not worth a URL. The
// standing answer is the two or three sentences that make it a page.
//
// Three rules hold it honest:
//
//   1. DRAFTED FROM THE EVIDENCE AND NOTHING ELSE. The model sees the verified
//      quotes and the question. It does not see the internet, the rest of the
//      corpus, or its own prior. If the quotes do not answer the question, the
//      correct output says so.
//   2. FROZEN, NOT GENERATED. Stored in a column and served from it (standing
//      rule 5: AI output is an input artifact, never a function). Two readers
//      of the same page get the same words, and so does a crawler.
//   3. APPROVED BY A PERSON. Unlike a quote, prose cannot be substring-checked
//      against anything. Nothing here is mechanically verifiable, so the only
//      honest gate is a human one — which is also why the page names its
//      editor.

import type { Env } from "../../env";
import { countWords } from "../../lib/aeo";
import { all, one, run } from "../../lib/d1";
import { callRole } from "../../llm/router";

const MAX_TOKENS = 700;

/** Below this the "answer" is a fragment and the page should stay unpublished. */
const MIN_WORDS = 25;

const PROMPT = `You state what a set of verified quotes establishes about one question.

You will be given a question and quotes taken verbatim from documents on file.

Write 2-4 sentences that answer the question USING ONLY those quotes.

Hard rules:
- Use only what the quotes say. Add no outside facts, names, figures or dates.
- If the quotes only partly answer the question, say what they establish and
  then say plainly what is still unresolved.
- If two quotes disagree, say that they disagree and what each says. Do not
  pick a winner and do not smooth it over.
- If the quotes do not answer the question at all, set "answers" to false and
  leave "standing_answer" empty.
- Plain declarative prose. No hedging filler, no "this article explores",
  no restating the question back.

Return ONLY JSON:
{"answers": true|false, "contested": true|false, "standing_answer": "..."}`;

export interface DraftResult {
  ok: boolean;
  reason: string | null;
  answer?: string;
  contested?: boolean;
}

/**
 * Draft the standing answer for one question from its verified evidence.
 *
 * Stores it unapproved. `contested` is set by the drafter when the quotes
 * disagree, because the model reading them is the cheapest place to notice —
 * but it is a proposal like the prose, and the operator sees both before
 * anything is public.
 */
export async function draftStandingAnswer(
  env: Env,
  userId: string,
  questionId: string,
): Promise<DraftResult> {
  const q = await one<{ question: string }>(
    env.DB,
    "SELECT question FROM questions WHERE id = ? AND user_id = ?",
    [questionId, userId],
  );
  if (!q) return { ok: false, reason: "no such question" };

  const evidence = await all<{ answer_text: string; piece_title: string }>(
    env.DB,
    `SELECT e.answer_text, p.title AS piece_title
       FROM question_evidence e JOIN pieces p ON p.id = e.piece_id
      WHERE e.user_id = ? AND e.question_id = ?
        AND p.publication_status IN ('published','canonical')
      ORDER BY e.created_at`,
    [userId, questionId],
  );
  if (!evidence.length) return { ok: false, reason: "no published evidence to draft from" };

  const quotes = evidence
    .map((e, i) => `[${i + 1}] From "${e.piece_title}":\n"${e.answer_text}"`)
    .join("\n\n");

  const out = await callRole(env, "bulk_extraction", {
    userId,
    system: PROMPT,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: `Question: ${q.question}\n\nQuotes:\n\n${quotes}` }],
      },
    ],
    max_tokens: MAX_TOKENS,
    // Keyed on the evidence count so adding a document re-drafts rather than
    // serving the answer written before that document existed.
    idempotency_key: `${questionId}:standing:${evidence.length}`,
  });

  let answer = "";
  let contested = false;
  let answers = true;
  try {
    const m = out.text.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : out.text) as Record<string, unknown>;
    answer = typeof j.standing_answer === "string" ? j.standing_answer.trim() : "";
    contested = j.contested === true;
    answers = j.answers !== false;
  } catch {
    return { ok: false, reason: "model did not return usable JSON" };
  }

  if (!answers || !answer) {
    return { ok: false, reason: "the evidence does not answer this question" };
  }
  const words = countWords(answer);
  if (words < MIN_WORDS) {
    return { ok: false, reason: `draft is ${words} words; needs at least ${MIN_WORDS}` };
  }

  // Clears approval. A redraft has not been read by anyone, and inheriting the
  // previous approval would put unreviewed prose on a live page — the exact
  // thing the approval step exists to prevent.
  await run(
    env.DB,
    `UPDATE questions
        SET standing_answer = ?, answer_approved_at = NULL, contested = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`,
    [answer, contested ? 1 : 0, new Date().toISOString(), questionId, userId],
  );
  return { ok: true, reason: null, answer, contested };
}

/** Flip a drafted standing answer live. */
export async function approveStandingAnswer(
  env: Env,
  userId: string,
  questionId: string,
): Promise<boolean> {
  const row = await one<{ standing_answer: string | null }>(
    env.DB,
    "SELECT standing_answer FROM questions WHERE id = ? AND user_id = ?",
    [questionId, userId],
  );
  if (!row?.standing_answer) return false;
  await run(
    env.DB,
    "UPDATE questions SET answer_approved_at = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [new Date().toISOString(), new Date().toISOString(), questionId, userId],
  );
  return true;
}

export interface OpenQuestion {
  id: string;
  question: string;
  evidence_count: number;
  answer_words: number;
  sources: number;
  has_draft: number;
  approved: string | null;
}

/**
 * Questions the corpus raised and cannot yet answer — the research queue.
 *
 * These have no URL and never will until they clear the gate. Their value is
 * as a worklist: each one is a question this corpus provoked, with the size of
 * the gap attached, which is a far better research prompt than a topic.
 */
export async function openQuestions(
  db: D1Database,
  userId: string,
  limit = 40,
): Promise<OpenQuestion[]> {
  return all<OpenQuestion>(
    db,
    `SELECT qs.id, qs.question,
            (SELECT COUNT(*) FROM question_evidence e WHERE e.question_id = qs.id)
              AS evidence_count,
            (SELECT COUNT(DISTINCT e2.piece_id) FROM question_evidence e2
              WHERE e2.question_id = qs.id) AS sources,
            (SELECT COALESCE(SUM(LENGTH(e3.answer_text) - LENGTH(REPLACE(e3.answer_text,' ','')) + 1), 0)
               FROM question_evidence e3 WHERE e3.question_id = qs.id) AS answer_words,
            CASE WHEN qs.standing_answer IS NULL THEN 0 ELSE 1 END AS has_draft,
            qs.answer_approved_at AS approved
       FROM questions qs
      WHERE qs.user_id = ? AND qs.status <> 'published'
      ORDER BY evidence_count DESC, qs.created_at
      LIMIT ?`,
    [userId, limit],
  );
}
