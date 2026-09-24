// RESURFACE — an old passage shown again (docs/HANDOFF.md "what is next").
//
// One verified quote a day from a document the operator has not touched
// lately, with "Note this" and "Research this" beside it. A rehearsal, not a
// ranking: the candidate set is documents with NO reading in the last `days`
// days, ordered by the oldest `pieces.last_opened_at` — set when the operator,
// signed in, renders /p/<slug> (migration 0063) — with `updated_at` standing
// in for documents never opened since that column existed (COALESCE), and
// ties are broken by a hash of today's date and the piece id — so the pick
// changes each day but not on each reload. A query over rows the pipeline
// already verified; no model, no count.

import { all } from "./d1";

/** A passage shorter than this is a phrase, not something worth re-reading. */
export const MIN_RESURFACE_CHARS = 160;

export interface ResurfacedPassage {
  quote_id: string;
  verbatim_text: string;
  piece_id: string;
  piece_slug: string;
  piece_title: string;
}

interface CandidateRow extends ResurfacedPassage {
  /** COALESCE(last_opened_at, updated_at): the last look, or the last write. */
  last_touched: string;
}

/** FNV-1a over a string: small, deterministic, no crypto (the renderer cannot await). */
export function dailyHash(dateKey: string, pieceId: string): number {
  let h = 0x811c9dc5;
  const s = `${dateKey}|${pieceId}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export async function resurfacePassage(
  db: D1Database,
  userId: string,
  opts: { days?: number; now?: Date } = {},
): Promise<ResurfacedPassage | null> {
  const days = opts.days ?? 14;
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  // One quote per document, the longest, from published + processed documents
  // without a recent reading. Small enough to sort in JS; the daily rotation
  // needs the piece ids anyway.
  const rows = await all<CandidateRow>(
    db,
    `SELECT q.id AS quote_id, q.verbatim_text, p.id AS piece_id, p.slug AS piece_slug,
            p.title AS piece_title, COALESCE(p.last_opened_at, p.updated_at) AS last_touched
       FROM pieces p
       JOIN piece_processing pp ON pp.piece_id = p.id AND pp.status = 'done'
       JOIN nodes n ON n.piece_id = p.id
       JOIN quotes q ON q.source_id = n.id AND q.user_id = p.user_id
      WHERE p.user_id = ? AND p.publication_status IN ('published','canonical')
        AND length(q.verbatim_text) >= ?
        AND NOT EXISTS (SELECT 1 FROM readings r
                         WHERE r.piece_id = p.id AND r.user_id = p.user_id AND r.created_at >= ?)
        AND NOT EXISTS (SELECT 1 FROM readings r2 WHERE r2.quote_id = q.id)
      ORDER BY COALESCE(p.last_opened_at, p.updated_at) ASC, length(q.verbatim_text) DESC
      LIMIT 200`,
    [userId, MIN_RESURFACE_CHARS, since],
  );
  if (!rows.length) return null;
  const dateKey = now.toISOString().slice(0, 10);
  const oldest = rows[0]?.last_touched ?? "";
  // Among the least-recently-opened documents, rotate by day; within the
  // chosen document, rotate by day across its qualifying quotes too.
  const tied = rows.filter((r) => r.last_touched === oldest);
  const byPiece = new Map<string, CandidateRow[]>();
  for (const r of tied) byPiece.set(r.piece_id, [...(byPiece.get(r.piece_id) ?? []), r]);
  const pieceIds = [...byPiece.keys()].sort(
    (a, b) => dailyHash(dateKey, a) - dailyHash(dateKey, b) || a.localeCompare(b),
  );
  const pieceId = pieceIds[0];
  const quotes = (pieceId && byPiece.get(pieceId)) || [];
  const pick = quotes[dailyHash(dateKey, pieceId ?? "") % Math.max(1, quotes.length)];
  if (!pick) return null;
  const { last_touched: _t, ...passage } = pick;
  return passage;
}
