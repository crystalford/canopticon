// THE INGESTION RECEIPT — what the system did with the document you dropped in.
//
// The complaint this answers, in the operator's words: "I feel like things are
// a little bit obscured and I don't really know what's going on with it… it
// should be definitive: what is the system doing with the research that I'm
// dropping into the system?"
//
// It was a fair complaint. You dropped a 140KB document in and got a page
// back. Nothing ever said how much of it had been read, how many spans
// survived verification, or what it turned up — so the graph was doing real
// work (13,000 nodes, 6,000 verified quotes) entirely out of sight.
//
// TWO RULES SHAPE WHAT THIS SAYS.
//
// Rule 6, say what is true: extraction reads a ceiling of the document and
// stops. A receipt that reported "47 quotes verified" and said nothing about
// the other 70KB would imply full coverage, which is the specific dishonesty
// this publication cannot afford. So the gap is stated first and plainly.
//
// Rule 4, nothing runs unattended: this is computed when the operator looks at
// it. No sweep, no cache, no background job keeping a counter warm.

import type { D1Database } from "@cloudflare/workers-types";
import { all, one } from "../../lib/d1";
import { EXTRACTION_CHAR_CEILING } from "./aeo-extract";
import { type Lead, leadsForCorpus } from "./leads";

export interface IngestionReceipt {
  piece_id: string;
  /** Characters in the stored document. */
  total_chars: number;
  /** Characters extraction actually read — capped at the ceiling. */
  read_chars: number;
  /** True when the document is longer than extraction reads. */
  truncated: boolean;
  /** Verified spans: quotes that survived the literal-substring check. */
  quotes: number;
  /** Typed-graph rows this document contributed. */
  nodes: number;
  /** Figures with what they measure, a period and (usually) a named source. */
  findings: number;
  /** Where this document made the corpus strange. */
  leads: Lead[];
}

/**
 * Build the receipt for one document.
 *
 * Returns null when the document has not been extracted at all, so the caller
 * can say "not extracted yet" rather than rendering a row of confident zeros —
 * which would read identically to "extracted, found nothing".
 */
export async function ingestionReceipt(
  db: D1Database,
  userId: string,
  pieceId: string,
): Promise<IngestionReceipt | null> {
  const counts = await one<{
    total_chars: number | null;
    quotes: number;
    nodes: number;
    findings: number;
  }>(
    db,
    `SELECT
       (SELECT body_chars FROM pieces WHERE id = ? AND user_id = ?) AS total_chars,
       (SELECT COUNT(*) FROM quotes q JOIN nodes sn ON sn.id = q.source_id
          WHERE q.user_id = ? AND sn.piece_id = ?) AS quotes,
       (SELECT COUNT(*) FROM nodes WHERE user_id = ? AND piece_id = ?
          AND kind IN ('neutral_fact', 'event', 'assertion', 'entity')) AS nodes,
       (SELECT COUNT(*) FROM aeo_findings WHERE user_id = ? AND piece_id = ?) AS findings`,
    [pieceId, userId, userId, pieceId, userId, pieceId, userId, pieceId],
  ).catch(() => null);

  if (!counts) return null;
  // Nothing extracted at all is a different state from "extracted, empty", and
  // conflating them is how a failed run looks like a boring document.
  if (counts.quotes === 0 && counts.nodes === 0 && counts.findings === 0) return null;

  const total = counts.total_chars ?? 0;
  const read = Math.min(total, EXTRACTION_CHAR_CEILING);

  return {
    piece_id: pieceId,
    total_chars: total,
    read_chars: read,
    truncated: total > EXTRACTION_CHAR_CEILING,
    quotes: counts.quotes,
    nodes: counts.nodes,
    findings: counts.findings,
    leads: await leadsForCorpus(db, userId, { pieceId, limit: 6 }),
  };
}

/**
 * Receipts for many documents in one pass, for the library index.
 *
 * The per-document version above issues its own queries, which is fine for one
 * document and wrong for fifty. This does the counts as three grouped queries
 * and the leads once, then assembles.
 */
export async function ingestionReceipts(
  db: D1Database,
  userId: string,
): Promise<Map<string, IngestionReceipt>> {
  const [pieces, quoteRows, nodeRows, findingRows, leads] = await Promise.all([
    all<{ id: string; body_chars: number | null }>(
      db,
      "SELECT id, body_chars FROM pieces WHERE user_id = ?",
      [userId],
    ).catch(() => []),
    all<{ piece_id: string; n: number }>(
      db,
      `SELECT sn.piece_id, COUNT(*) AS n
         FROM quotes q JOIN nodes sn ON sn.id = q.source_id
        WHERE q.user_id = ? AND sn.piece_id IS NOT NULL
        GROUP BY sn.piece_id`,
      [userId],
    ).catch(() => []),
    all<{ piece_id: string; n: number }>(
      db,
      `SELECT piece_id, COUNT(*) AS n FROM nodes
        WHERE user_id = ? AND piece_id IS NOT NULL
          AND kind IN ('neutral_fact', 'event', 'assertion', 'entity')
        GROUP BY piece_id`,
      [userId],
    ).catch(() => []),
    all<{ piece_id: string; n: number }>(
      db,
      "SELECT piece_id, COUNT(*) AS n FROM aeo_findings WHERE user_id = ? GROUP BY piece_id",
      [userId],
    ).catch(() => []),
    leadsForCorpus(db, userId, { limit: 60 }),
  ]);

  const byPiece = <T extends { piece_id: string; n: number }>(rows: T[]) =>
    new Map(rows.map((r) => [r.piece_id, r.n] as const));
  const quotes = byPiece(quoteRows);
  const nodes = byPiece(nodeRows);
  const findings = byPiece(findingRows);

  const leadsByPiece = new Map<string, Lead[]>();
  for (const lead of leads) {
    const list = leadsByPiece.get(lead.piece_id) ?? [];
    list.push(lead);
    leadsByPiece.set(lead.piece_id, list);
  }

  const out = new Map<string, IngestionReceipt>();
  for (const p of pieces) {
    const q = quotes.get(p.id) ?? 0;
    const n = nodes.get(p.id) ?? 0;
    const f = findings.get(p.id) ?? 0;
    if (q === 0 && n === 0 && f === 0) continue;
    const total = p.body_chars ?? 0;
    out.set(p.id, {
      piece_id: p.id,
      total_chars: total,
      read_chars: Math.min(total, EXTRACTION_CHAR_CEILING),
      truncated: total > EXTRACTION_CHAR_CEILING,
      quotes: q,
      nodes: n,
      findings: f,
      leads: leadsByPiece.get(p.id) ?? [],
    });
  }
  return out;
}
