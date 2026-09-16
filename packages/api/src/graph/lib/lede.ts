// The passage a retriever is meant to lift.
//
// Retrieval is passage-level rather than page-level, and selection is the
// bottleneck rather than retrieval — ChatGPT cites roughly 15% of the pages it
// retrieves. So the work is not producing more pages; it is making one passage
// per document the obvious thing to quote.
//
// The model SELECTS, it never writes. A composed summary cannot be checked
// mechanically, and standing rule 1 is that verification is mechanical and
// never vouched for. A selected passage is a literal substring of the stored
// document, so it runs the same locateVerbatim firewall as every other quote
// and earns a /q/<id> receipt. It is also simply better: a reader who follows
// a citation arrives and finds the words they were promised.

import type { Env } from "../../env";
import { one, run } from "../../lib/d1";
import { callRole } from "../../llm/router";
import { locateVerbatim } from "./digestion-typed";

/** How much of the document the selector reads. The lede is near the front. */
const HEAD_CHARS = 6000;
const MAX_TOKENS = 600;

/**
 * Bounds on what counts as a lede.
 *
 * Too short and it is a fragment that answers nothing on its own; too long and
 * it is not a passage, it is the article. Roughly one to two solid paragraphs.
 */
const MIN_CHARS = 180;
const MAX_CHARS = 900;

const PROMPT = `You choose the single best passage to quote from a research document.

Pick the passage that best answers "what does this document establish?" for
someone who will read nothing else. Prefer a passage that names concrete
findings, figures or conclusions over one that describes the document's
structure or announces what it will do.

Rules:
- COPY the passage EXACTLY as it appears. Do not edit, join, shorten, reflow or
  fix it. It must be findable verbatim in the text.
- One continuous passage, not stitched from separate places.
- Between 180 and 900 characters.
- Never invent or paraphrase.

Return ONLY JSON: {"passage": "..."}`;

export interface LedeResult {
  ok: boolean;
  reason: string | null;
  text?: string;
  quoteId?: string;
}

/**
 * Propose a lede for one piece. Stores it unapproved — nothing renders until a
 * person says so, because the model can pick a passage that is perfectly
 * verbatim and still misrepresents the document's weight, and no substring
 * check catches that.
 */
export async function proposeLede(env: Env, userId: string, pieceId: string): Promise<LedeResult> {
  const piece = await one<{ body_md: string }>(
    env.DB,
    "SELECT body_md FROM pieces WHERE id = ? AND user_id = ?",
    [pieceId, userId],
  );
  if (!piece?.body_md) return { ok: false, reason: "piece has no text" };

  const sourceNode = await one<{ id: string }>(
    env.DB,
    "SELECT id FROM nodes WHERE user_id = ? AND piece_id = ? AND kind = 'source' LIMIT 1",
    [userId, pieceId],
  );
  if (!sourceNode) return { ok: false, reason: "run document extraction first" };

  const head = piece.body_md.slice(0, HEAD_CHARS);
  const out = await callRole(env, "bulk_extraction", {
    userId,
    system: PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: head }] }],
    max_tokens: MAX_TOKENS,
    idempotency_key: `${pieceId}:lede`,
  });

  let candidate = "";
  try {
    const m = out.text.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : out.text) as { passage?: unknown };
    candidate = typeof j.passage === "string" ? j.passage.trim() : "";
  } catch {
    return { ok: false, reason: "model did not return usable JSON" };
  }
  if (!candidate) return { ok: false, reason: "model returned no passage" };

  // The firewall. A passage that is not literally in the document is the
  // model's invention, and this publication does not publish those.
  const located = locateVerbatim(head, candidate);
  if (!located) return { ok: false, reason: "passage is not verbatim in the document" };
  if (located.text.length < MIN_CHARS) {
    return { ok: false, reason: `passage is ${located.text.length} chars; needs ${MIN_CHARS}` };
  }
  const text = located.text.slice(0, MAX_CHARS);

  const quoteId = crypto.randomUUID();
  await run(
    env.DB,
    `INSERT INTO quotes (id, user_id, source_id, node_id, verbatim_text, byte_offset, byte_length)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [quoteId, userId, sourceNode.id, sourceNode.id, text, located.offset, text.length],
  );
  // Replaces any previous proposal, and clears approval: a new passage has not
  // been read by anyone yet, and inheriting the old one's approval would put
  // unreviewed text on a live page.
  await run(
    env.DB,
    "UPDATE pieces SET lede_quote_id = ?, lede_approved_at = NULL WHERE id = ? AND user_id = ?",
    [quoteId, pieceId, userId],
  );
  return { ok: true, reason: null, text, quoteId };
}

/** Flip a proposed lede live. */
export async function approveLede(env: Env, userId: string, pieceId: string): Promise<boolean> {
  const row = await one<{ lede_quote_id: string | null }>(
    env.DB,
    "SELECT lede_quote_id FROM pieces WHERE id = ? AND user_id = ?",
    [pieceId, userId],
  );
  if (!row?.lede_quote_id) return false;
  await run(env.DB, "UPDATE pieces SET lede_approved_at = ? WHERE id = ? AND user_id = ?", [
    new Date().toISOString(),
    pieceId,
    userId,
  ]);
  return true;
}

export interface LedeRow {
  quote_id: string;
  verbatim_text: string;
  approved_at: string | null;
}

/** The lede for a piece, approved or not — the caller decides what to do. */
export async function ledeForPiece(
  db: D1Database,
  userId: string,
  pieceId: string,
): Promise<LedeRow | null> {
  return one<LedeRow>(
    db,
    `SELECT q.id AS quote_id, q.verbatim_text, p.lede_approved_at AS approved_at
       FROM pieces p JOIN quotes q ON q.id = p.lede_quote_id
      WHERE p.id = ? AND p.user_id = ?`,
    [pieceId, userId],
  );
}
