// One topic per document, so a corpus stops being a pile.
//
// The operator's read of the live site: "some of the things are political
// research, some are tech stacks, some are others, but they are all just
// dumped in one place." Fifty documents spanning several unrelated worlds, in
// one undifferentiated list.
//
// That is the largest topical-authority gap the site has. Search and answer
// engines accumulate authority per subject area; a corpus with no clusters
// accumulates it in none of them, and a reader arriving on housing research
// has no way to find the other four housing documents.
//
// A CLOSED VOCABULARY, AND WHY IT IS NOT LAZINESS
//
// The obvious build is to let a model name each document's topic freely. Done
// across fifty documents that produces forty near-duplicate labels — "Politics",
// "Political research", "Canadian politics", "Government" — which groups
// nothing and reads worse than no grouping at all. Every document gets its own
// bucket and the feature is a no-op with extra steps.
//
// So the model CHOOSES from the list below rather than writing a label. The
// list is short enough to keep clusters big enough to be worth having, and it
// is one editable constant rather than a taxonomy scattered through the code.
//
// UNMATCHED IS A REAL ANSWER. A document that fits nothing gets null and sits
// in "Everything else". Forcing a bad topic is worse than leaving it ungrouped:
// a wrong cluster actively misleads, an ungrouped document merely waits.
//
// Standing rule 5: the model runs at AUTHORING time and the answer is frozen
// into pieces.topic. Nothing calls a model to render a page.

import type { Env } from "../../env";
import { all, one, run } from "../../lib/d1";
import { callRole, modelForRole } from "../../llm/router";

/**
 * The buckets. Edit this list to reshape the site's sections.
 *
 * Deliberately broad. A topic that holds three documents is a section; a topic
 * that holds one is a label pretending to be a section.
 */
export const TOPICS = [
  "Politics & government",
  "Media & information",
  "Public health",
  "Housing & cities",
  "Money & markets",
  "Climate & energy",
  "Technology & systems",
  "Method & measurement",
] as const;

export type Topic = (typeof TOPICS)[number];

/** Where documents with no topic go. Not a topic — a holding pen. */
export const UNGROUPED = "Everything else";

const PROMPT = `You file research documents into a fixed set of sections.

Read the document and answer with the ONE section it belongs in, copied
exactly from this list:

${TOPICS.map((t) => `- ${t}`).join("\n")}

Rules:
- Answer with the section name alone. No explanation, no punctuation.
- Choose by what the document is ABOUT, not by who wrote it or why.
- If the document genuinely fits none of them, answer exactly: NONE.
- NONE is a real answer. A wrong section is worse than no section.`;

/**
 * Assign one topic to one document.
 *
 * Reads only the head of the body: a document announces its subject in its
 * first page, and sending 70KB to decide between eight buckets is waste.
 */
export async function assignTopic(
  env: Env,
  userId: string,
  pieceId: string,
  opts: { model?: string } = {},
): Promise<{ topic: string | null; model: string }> {
  const model = opts.model?.trim() || modelForRole("bulk_extraction").model;
  const piece = await one<{ body_md: string | null; title: string }>(
    env.DB,
    "SELECT body_md, title FROM pieces WHERE id = ? AND user_id = ?",
    [pieceId, userId],
  );
  if (!piece?.body_md) return { topic: null, model };

  const head = piece.body_md.slice(0, 6000);
  const out = await callRole(env, "bulk_extraction", {
    userId,
    model,
    system: PROMPT,
    messages: [
      { role: "user", content: [{ type: "text", text: `Title: ${piece.title}\n\n${head}` }] },
    ],
    max_tokens: 24,
    idempotency_key: `topic:${pieceId}:${model}`,
  }).catch(() => null);

  const topic = matchTopic(out?.text ?? "");
  await run(
    env.DB,
    "UPDATE pieces SET topic = ?, topic_model = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [topic, model, new Date().toISOString(), pieceId, userId],
  ).catch(() => {});
  return { topic, model };
}

/**
 * Match a model's answer to the closed list.
 *
 * Exported because this is the part worth testing: the failure that matters is
 * a near-miss silently becoming a new bucket. Anything that is not one of the
 * listed topics returns null, including "NONE", empty, and a plausible-looking
 * label the model made up.
 */
export function matchTopic(raw: string): Topic | null {
  const t = raw.trim().replace(/^["'`]+|["'`.]+$/g, "");
  if (!t || /^none$/i.test(t)) return null;
  const exact = TOPICS.find((x) => x.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  // A model that answers "Politics and government" or "politics & government."
  // meant the listed bucket; one that answers "Canadian politics" did not.
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s*&\s*|\s+and\s+/g, " ")
      .replace(/[^a-z ]/g, "")
      .trim();
  return TOPICS.find((x) => norm(x) === norm(t)) ?? null;
}

/** Every published document that has no topic yet, oldest first. */
export async function untopicedPieces(
  db: Env["DB"],
  userId: string,
  limit = 50,
): Promise<Array<{ id: string; title: string }>> {
  return all<{ id: string; title: string }>(
    db,
    `SELECT id, title FROM pieces
      WHERE user_id = ? AND (topic IS NULL OR TRIM(topic) = '')
        AND publication_status IN ('published','canonical')
      ORDER BY COALESCE(published_at, created_at) ASC
      LIMIT ?`,
    [userId, limit],
  ).catch(() => []);
}

/**
 * Topic every document that does not have one.
 *
 * Push-button, never scheduled (standing rule 4). Bounded per press so one
 * click cannot spend an unbounded amount on a corpus that grew overnight.
 */
export async function assignTopics(
  env: Env,
  userId: string,
  opts: { limit?: number; model?: string } = {},
): Promise<{ assigned: number; ungrouped: number; model: string }> {
  const model = opts.model?.trim() || modelForRole("bulk_extraction").model;
  const pending = await untopicedPieces(env.DB, userId, opts.limit ?? 25);
  let assigned = 0;
  let ungrouped = 0;
  for (const p of pending) {
    const r = await assignTopic(env, userId, p.id, { model }).catch(() => null);
    if (r?.topic) assigned++;
    else ungrouped++;
  }
  return { assigned, ungrouped, model };
}
