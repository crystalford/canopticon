// LEADS — where the corpus is strange.
//
// The posture here is investigative, not encyclopedic. A wiki accumulates what
// is known; this accumulates in order to find what is not yet known. So the
// graph's job is not to be a tidy record of what was extracted — it is to keep
// pointing at the places worth looking harder.
//
// A lead is MECHANICAL. Every one of these is a query that finds a SHAPE in
// the graph. Nothing here calls a model, nothing composes prose, and nothing
// asserts that a lead is important — it says what was found and leaves the
// judgement to a person. Standing rule 1 (verification is mechanical, never
// vouched for) and rule 5 (nothing calls a model at render time) both hold.
//
// ⚠ FREQUENCY IS NOT A LEAD TYPE AND MUST NEVER BECOME ONE.
//
// The tempting query — "this appears in N documents, so it matters" — is
// banned, and the reason is specific to this corpus rather than a matter of
// taste. These documents are the operator's own research output, not
// independent sources, so three of them "agreeing" may be one upstream page
// echoing three times. A tally would be laundering that repetition into
// apparent significance. A lead worth chasing is worth chasing the first time
// it appears, which is why this file sorts by recency and never by count.
//
// The signals below are about QUALITY, and none of them is a count:
//   · two stored sources that contradict each other
//   · a figure nobody in the corpus sources
//
// More types can be added — an entity appearing in documents that otherwise
// share nothing, a chain of events with a hole in it — and each one is a
// query, not an architecture. That is the point of the shape.

import type { D1Database } from "@cloudflare/workers-types";
import { all } from "../../lib/d1";

export type LeadKind = "contradiction" | "unsourced-figure";

export interface Lead {
  kind: LeadKind;
  /** What was found, in the corpus's own words wherever possible. */
  summary: string;
  /** The specific thing to look at, verbatim from a document. */
  detail: string;
  /** Receipt for `detail`, when the lead rests on a verified quote. */
  quote_id: string | null;
  /** The document this lead came out of. */
  piece_id: string;
  piece_slug: string | null;
  piece_title: string | null;
  /** The second document, for a lead that only exists across two. */
  other_piece_slug?: string | null;
  other_piece_title?: string | null;
  created_at: string;
}

/**
 * Two stored sources disagree.
 *
 * The classic investigative tell, and the strongest signal in the graph: an
 * `evidential` edge typed contradicts/rebuts/undercuts, where the two ends
 * come from DIFFERENT documents. Same-document disagreement is usually an
 * author laying out both sides; cross-document disagreement is two sources
 * that cannot both be right, and somebody should find out which.
 *
 * This reads the edges directly rather than `assertions.rank = 'contested'`,
 * which is computed by a sweep in the dormant settle pipeline and would be
 * stale or empty with the cron off.
 */
export async function contradictionLeads(
  db: D1Database,
  userId: string,
  opts: { pieceId?: string; limit?: number } = {},
): Promise<Lead[]> {
  const limit = opts.limit ?? 20;
  const scope = opts.pieceId ? "AND (sn.piece_id = ? OR dn.piece_id = ?)" : "";
  const params: unknown[] = [userId];
  if (opts.pieceId) params.push(opts.pieceId, opts.pieceId);
  params.push(limit);

  const rows = await all<{
    src_label: string;
    dst_label: string;
    edge_type: string;
    quote_id: string | null;
    verbatim_text: string | null;
    piece_id: string;
    piece_slug: string | null;
    piece_title: string | null;
    other_slug: string | null;
    other_title: string | null;
    created_at: string;
  }>(
    db,
    `SELECT sn.label AS src_label, dn.label AS dst_label, e.edge_type,
            q.id AS quote_id, q.verbatim_text,
            sn.piece_id, sp.slug AS piece_slug, sp.title AS piece_title,
            dp.slug AS other_slug, dp.title AS other_title,
            e.created_at
       FROM edges e
       JOIN nodes sn ON sn.id = e.src_node_id
       JOIN nodes dn ON dn.id = e.dst_node_id
       LEFT JOIN pieces sp ON sp.id = sn.piece_id
       LEFT JOIN pieces dp ON dp.id = dn.piece_id
       LEFT JOIN quotes q ON q.node_id = sn.id
      WHERE e.user_id = ?
        AND e.family = 'evidential'
        AND e.edge_type IN ('contradicts', 'rebuts', 'undercuts')
        AND sn.piece_id IS NOT NULL
        AND dn.piece_id IS NOT NULL
        AND sn.piece_id <> dn.piece_id
        ${scope}
      GROUP BY e.id
      ORDER BY e.created_at DESC
      LIMIT ?`,
    params,
  ).catch(() => []);

  return rows.map((r) => ({
    kind: "contradiction" as const,
    summary: `Two documents disagree: "${r.src_label}" ${r.edge_type} "${r.dst_label}"`,
    detail: r.verbatim_text ?? r.src_label,
    quote_id: r.quote_id,
    piece_id: r.piece_id,
    piece_slug: r.piece_slug,
    piece_title: r.piece_title,
    other_piece_slug: r.other_slug,
    other_piece_title: r.other_title,
    created_at: r.created_at,
  }));
}

/**
 * A figure nobody in the corpus sources.
 *
 * The inverse of the strongest citable shape. A statistic stated beside a
 * named source and a date is the best-evidenced thing a document can carry;
 * the same statistic with no attribution at all is being repeated on trust,
 * and that is worth knowing before it gets quoted onward from here.
 *
 * Deliberately NOT a judgement that the figure is wrong. It says only that
 * this corpus cannot say where it came from.
 */
export async function unsourcedFigureLeads(
  db: D1Database,
  userId: string,
  opts: { pieceId?: string; limit?: number } = {},
): Promise<Lead[]> {
  const limit = opts.limit ?? 20;
  const scope = opts.pieceId ? "AND f.piece_id = ?" : "";
  const params: unknown[] = [userId];
  if (opts.pieceId) params.push(opts.pieceId);
  params.push(limit);

  const rows = await all<{
    figure: string;
    measures: string;
    quote_id: string;
    verbatim_text: string | null;
    piece_id: string;
    piece_slug: string | null;
    piece_title: string | null;
    created_at: string;
  }>(
    db,
    `SELECT f.figure, f.measures, f.quote_id, q.verbatim_text,
            f.piece_id, p.slug AS piece_slug, p.title AS piece_title, f.created_at
       FROM aeo_findings f
       LEFT JOIN quotes q ON q.id = f.quote_id
       LEFT JOIN pieces p ON p.id = f.piece_id
      WHERE f.user_id = ?
        AND (f.attributed_to IS NULL OR TRIM(f.attributed_to) = '')
        ${scope}
      ORDER BY f.created_at DESC
      LIMIT ?`,
    params,
  ).catch(() => []);

  return rows.map((r) => ({
    kind: "unsourced-figure" as const,
    summary: `${r.figure} — ${r.measures}, with no source named anywhere in the corpus`,
    detail: r.verbatim_text ?? r.figure,
    quote_id: r.quote_id,
    piece_id: r.piece_id,
    piece_slug: r.piece_slug,
    piece_title: r.piece_title,
    created_at: r.created_at,
  }));
}

/**
 * Every lead, newest first.
 *
 * Recency is a LIST ORDER, not a ranking. Nothing here scores a lead against
 * another, because the moment leads are ranked somebody will rank them by how
 * often the thing recurs, and that is the mechanism this file exists to avoid.
 */
export async function leadsForCorpus(
  db: D1Database,
  userId: string,
  opts: { pieceId?: string; limit?: number } = {},
): Promise<Lead[]> {
  const [contradictions, unsourced] = await Promise.all([
    contradictionLeads(db, userId, opts),
    unsourcedFigureLeads(db, userId, opts),
  ]);
  return [...contradictions, ...unsourced].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
