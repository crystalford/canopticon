// READINGS — the operator's half of verification (docs/the-record.md §5c).
//
// A reading is a short note the operator writes on a passage. The passage is
// a quotes row like any receipt — located verbatim by locateVerbatim, so
// /q/<id> works for it — and the note is the operator's own words. No model
// is involved at any point. A document with at least one reading is "read by
// the operator": the one trust signal the machine cannot supply, and a claim
// the page makes only when the row exists.

import type { Env } from "../env";
import { ensureSourceNode, locateVerbatim } from "../graph/lib/digestion-typed";
import type { Lead } from "../graph/lib/leads";
import { all, one, run } from "./d1";

/** A passage shorter than this is a phrase, not a reading anchor. */
export const MIN_PASSAGE_CHARS = 40;
/** A note this short says nothing worth signing. */
export const MIN_NOTE_CHARS = 3;

export type ReadingResult =
  | { ok: true; id: string; quoteId: string }
  | { ok: false; reason: string };

export interface ReadingRow {
  id: string;
  quote_id: string;
  verbatim_text: string;
  note_md: string;
  created_at: string;
}

/**
 * Anchor a note to a passage of a document.
 *
 * The passage must be literally in `body_md` (whitespace-normalised, as every
 * receipt is) and at least MIN_PASSAGE_CHARS long; otherwise nothing is
 * written. What is stored is the DOCUMENT's bytes for the passage, never the
 * submitted text. An unprocessed document has no source node yet, so one is
 * created — the reading must not wait on extraction.
 */
export async function createReading(
  env: Env,
  userId: string,
  pieceId: string,
  passage: string,
  noteMd: string,
): Promise<ReadingResult> {
  const note = noteMd.trim();
  if (note.length < MIN_NOTE_CHARS) return { ok: false, reason: "the note is empty" };
  const piece = await one<{ body_md: string | null; title: string }>(
    env.DB,
    "SELECT body_md, title FROM pieces WHERE id = ? AND user_id = ?",
    [pieceId, userId],
  );
  if (!piece?.body_md) return { ok: false, reason: "document has no text" };

  const located = locateVerbatim(piece.body_md, passage);
  if (!located) return { ok: false, reason: "passage is not verbatim in the document" };
  if (located.text.length < MIN_PASSAGE_CHARS) {
    return {
      ok: false,
      reason: `passage is ${located.text.length} chars; needs ${MIN_PASSAGE_CHARS}`,
    };
  }

  const sourceNodeId = await ensureSourceNode(env, userId, pieceId, piece.title);
  const quoteId = crypto.randomUUID();
  await run(
    env.DB,
    `INSERT INTO quotes (id, user_id, source_id, node_id, verbatim_text, byte_offset, byte_length)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      quoteId,
      userId,
      sourceNodeId,
      sourceNodeId,
      located.text,
      located.offset,
      located.text.length,
    ],
  );
  const id = crypto.randomUUID();
  await run(
    env.DB,
    "INSERT INTO readings (id, user_id, piece_id, quote_id, note_md) VALUES (?, ?, ?, ?, ?)",
    [id, userId, pieceId, quoteId, note],
  );
  return { ok: true, id, quoteId };
}

/**
 * Remove a reading and its passage. The quotes row goes too: it exists only
 * as this reading's anchor, and a /q/ receipt with nothing behind it would be
 * the unmoored-quote problem in miniature.
 */
export async function deleteReading(db: D1Database, userId: string, id: string): Promise<boolean> {
  const row = await one<{ quote_id: string; piece_id: string }>(
    db,
    "SELECT quote_id, piece_id FROM readings WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!row) return false;
  await run(db, "DELETE FROM readings WHERE id = ? AND user_id = ?", [id, userId]);
  await run(db, "DELETE FROM quotes WHERE id = ? AND user_id = ?", [row.quote_id, userId]);
  return true;
}

export async function readingsForPiece(
  db: D1Database,
  userId: string,
  pieceId: string,
): Promise<ReadingRow[]> {
  return all<ReadingRow>(
    db,
    `SELECT r.id, r.quote_id, q.verbatim_text, r.note_md, r.created_at
       FROM readings r JOIN quotes q ON q.id = r.quote_id
      WHERE r.user_id = ? AND r.piece_id = ?
      ORDER BY r.created_at ASC`,
    [userId, pieceId],
  );
}

export interface ReadingLeadRow extends ReadingRow {
  piece_id: string;
  piece_slug: string | null;
  piece_title: string | null;
}

/** First `n` characters of a note, on one line, for a list. */
function firstLine(note: string, n: number): string {
  const flat = note.replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n - 1).trimEnd()}…` : flat;
}

/**
 * Readings as leads for the worklist (docs/the-record.md §5c): a reading is
 * a lead because the operator's note names what a passage is missing or what
 * it provokes, which is a better research prompt than a topic.
 *
 * Typed as `Lead & { kind: "reading" }` so a caller can tell readings apart
 * from the graph-derived leads without narrowing on the union.
 */
export async function readingsAsLeads(
  db: D1Database,
  userId: string,
  opts: { limit?: number } = {},
): Promise<Array<Lead & { kind: "reading" }>> {
  const limit = Math.max(1, Math.min(200, opts.limit ?? 50));
  const rows = await all<ReadingLeadRow>(
    db,
    `SELECT r.id, r.quote_id, q.verbatim_text, r.note_md, r.created_at,
            r.piece_id, p.slug AS piece_slug, p.title AS piece_title
       FROM readings r
       JOIN quotes q ON q.id = r.quote_id
       LEFT JOIN pieces p ON p.id = r.piece_id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
      LIMIT ?`,
    [userId, limit],
  );
  return rows.map((r) => ({
    kind: "reading" as const,
    summary: firstLine(r.note_md, 120),
    detail: r.verbatim_text,
    quote_id: r.quote_id,
    piece_id: r.piece_id,
    piece_slug: r.piece_slug,
    piece_title: r.piece_title,
    created_at: r.created_at,
    seed: `${r.note_md.trim()}\n\n> ${r.verbatim_text}`,
    angle:
      "The operator read this passage and wrote the note above. Answer the note against the passage: what it asks for, what it doubts, what it says is missing.",
  }));
}
