// CONSOLIDATION — what a document became once the record had read it.
//
// docs/the-record.md §1b: uploading is externalising memory, processing is
// the record's own pattern recognition. Consolidation is the moment after —
// the one line under a processed row that says how the document now sits in
// the record: which documents it links to, which disagree with it, which
// bridges it makes between sections, what questions it answers. It exists so
// a row can say "raised 2 questions · settled 1 contradiction · 0 branches
// yet" and be read as asking for its next move (§5).
//
// Everything here is a QUERY. No model, no stored column, nothing to go
// stale against an edited body. Counts are per-document tallies of what the
// document HOLDS, never a ranking between documents — leads.ts's rule holds:
// frequency is not the mechanism that decides what matters.

import type { D1Database } from "@cloudflare/workers-types";
import { all } from "../../lib/d1";
import { pickSpread } from "./crosslinks";
import { bridgeLeads, contradictionLeads, unsourcedFigureLeads } from "./leads";

export interface ConsolidationSummary {
  /** Other documents this one's page links to (crosslinks.ts, after pickSpread). */
  links_out: number;
  /** Other documents whose pages link to this one. */
  links_in: number;
  contradictions: number;
  unsourced: number;
  bridges: number;
  /** Questions this document answers (aeo_question_evidence). */
  questions: number;
}

export interface Lineage {
  parent_id: string | null;
  parent_slug: string | null;
  parent_title: string | null;
  /** The question or contradiction, verbatim, that started this document. */
  origin: string | null;
  /** How many documents were researched from this one. */
  branches: number;
}

const EMPTY: ConsolidationSummary = {
  links_out: 0,
  links_in: 0,
  contradictions: 0,
  unsourced: 0,
  bridges: 0,
  questions: 0,
};

// The same three limits as crosslinks.ts, so the count here is the count of
// links the document page actually shows. A summary that said "linked to 40"
// beside a page that links to 12 would be the second copy of a number.
const MIN_LABEL_CHARS = 8;
const STOPWORD_SHARE = 1 / 3;
const MIN_STOPWORD_CEILING = 4;
const MAX_LINKS_PER_DOC = 12;
const LINKABLE_KINDS = ["entity", "event", "theme"] as const;

/**
 * One document's summary. A convenience over the batch form: the library
 * renders a hundred rows and should call `consolidationSummaries` once.
 */
export async function consolidationSummary(
  db: D1Database,
  userId: string,
  pieceId: string,
): Promise<ConsolidationSummary> {
  const m = await consolidationSummaries(db, userId, [pieceId]);
  return m.get(pieceId) ?? { ...EMPTY };
}

/**
 * Summaries for many documents, in four queries and no model.
 *
 * Links: every (source, target) pair sharing a qualifying label, ordered the
 * way crosslinks.ts orders them, then pickSpread per source — so links_out
 * is exactly what that document's page links to, and links_in counts the
 * pages whose budget reached this one.
 */
export async function consolidationSummaries(
  db: D1Database,
  userId: string,
  pieceIds: string[],
): Promise<Map<string, ConsolidationSummary>> {
  const out = new Map<string, ConsolidationSummary>();
  if (!pieceIds.length) return out;
  const wanted = new Set(pieceIds);
  for (const id of pieceIds) out.set(id, { ...EMPTY });

  const kinds = LINKABLE_KINDS.map(() => "?").join(",");
  const [linkRows, contradictions, unsourced, bridges, questionRows, slugRows] = await Promise.all([
    all<{
      label: string;
      src_id: string;
      dst_id: string;
      slug: string;
      title: string;
      pieces: number;
    }>(
      db,
      `WITH corpus AS (
         SELECT COUNT(DISTINCT piece_id) AS n FROM nodes
          WHERE user_id = ? AND piece_id IS NOT NULL
       ),
       spread AS (
         SELECT label, COUNT(DISTINCT piece_id) AS pieces FROM nodes
          WHERE user_id = ? AND piece_id IS NOT NULL AND kind IN (${kinds})
            AND LENGTH(label) >= ?
          GROUP BY label
       ),
       subj AS (
         SELECT DISTINCT piece_id, label FROM nodes
          WHERE user_id = ? AND piece_id IS NOT NULL AND kind IN (${kinds})
       )
       SELECT a.label AS label, a.piece_id AS src_id, b.piece_id AS dst_id,
              p.slug AS slug, p.title AS title, spread.pieces AS pieces
         FROM subj a
         JOIN subj b ON b.label = a.label AND b.piece_id <> a.piece_id
         JOIN spread ON spread.label = a.label
         JOIN pieces p ON p.id = b.piece_id
         CROSS JOIN corpus
        WHERE p.publication_status IN ('published','canonical')
          AND spread.pieces >= 2
          AND spread.pieces <= MAX(?, CAST(corpus.n * ? AS INTEGER))
        ORDER BY a.piece_id, spread.pieces ASC, LENGTH(a.label) DESC, a.label ASC, p.slug ASC
        LIMIT 20000`,
      [
        userId,
        userId,
        ...LINKABLE_KINDS,
        MIN_LABEL_CHARS,
        userId,
        ...LINKABLE_KINDS,
        MIN_STOPWORD_CEILING,
        STOPWORD_SHARE,
      ],
    ).catch(() => []),
    contradictionLeads(db, userId, { limit: 1000 }),
    unsourcedFigureLeads(db, userId, { limit: 1000 }),
    bridgeLeads(db, userId, { limit: 1000 }),
    all<{ piece_id: string; n: number }>(
      db,
      `SELECT piece_id, COUNT(DISTINCT question_id) AS n
         FROM aeo_question_evidence WHERE user_id = ? GROUP BY piece_id`,
      [userId],
    ).catch(() => []),
    all<{ id: string; slug: string }>(
      db,
      "SELECT id, slug FROM pieces WHERE user_id = ? AND slug IS NOT NULL",
      [userId],
    ).catch(() => []),
  ]);

  // Links, per source document, through the same spread rule as the page.
  const bySrc = new Map<string, { label: string; slug: string; title: string; pieces: number }[]>();
  for (const r of linkRows) {
    const list = bySrc.get(r.src_id) ?? [];
    list.push({ label: r.label, slug: r.slug, title: r.title, pieces: r.pieces });
    bySrc.set(r.src_id, list);
  }
  const idBySlug = new Map<string, string>();
  for (const r of slugRows) idBySlug.set(r.slug, r.id);
  for (const [src, rows] of bySrc) {
    const picked = pickSpread(rows, MAX_LINKS_PER_DOC);
    const s = out.get(src);
    if (s) s.links_out = picked.length;
    for (const link of picked) {
      const dst = idBySlug.get(link.slug);
      const t = dst ? out.get(dst) : undefined;
      if (t) t.links_in += 1;
    }
  }

  // Leads count for BOTH documents they sit between: a contradiction is as
  // much the other document's as this one's.
  const bump = (
    key: keyof Pick<ConsolidationSummary, "contradictions" | "unsourced" | "bridges">,
    pieceId: string,
    otherSlug: string | null | undefined,
  ) => {
    const a = out.get(pieceId);
    if (a) a[key] += 1;
    const otherId = otherSlug ? idBySlug.get(otherSlug) : undefined;
    if (otherId && otherId !== pieceId) {
      const b = out.get(otherId);
      if (b) b[key] += 1;
    }
  };
  for (const l of contradictions) bump("contradictions", l.piece_id, l.other_piece_slug);
  for (const l of unsourced) bump("unsourced", l.piece_id, null);
  for (const l of bridges) bump("bridges", l.piece_id, l.other_piece_slug);

  for (const q of questionRows) {
    const s = out.get(q.piece_id);
    if (s && wanted.has(q.piece_id)) s.questions = Number(q.n) || 0;
  }
  return out;
}

/**
 * Lineage for every document the operator holds (docs/the-record.md §5).
 *
 * A separate query on purpose: listLibrary in public/data.ts does not select
 * parent_piece_id, and this is the one place the tree is read for the
 * library, keyed by piece id.
 */
export async function lineageForPieces(
  db: D1Database,
  userId: string,
): Promise<Map<string, Lineage>> {
  const rows = await all<{
    id: string;
    slug: string | null;
    title: string | null;
    parent_piece_id: string | null;
    origin: string | null;
  }>(db, "SELECT id, slug, title, parent_piece_id, origin FROM pieces WHERE user_id = ?", [
    userId,
  ]).catch(() => []);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const branches = new Map<string, number>();
  for (const r of rows) {
    if (r.parent_piece_id)
      branches.set(r.parent_piece_id, (branches.get(r.parent_piece_id) ?? 0) + 1);
  }
  const out = new Map<string, Lineage>();
  for (const r of rows) {
    const parent = r.parent_piece_id ? byId.get(r.parent_piece_id) : undefined;
    const n = branches.get(r.id) ?? 0;
    if (!r.parent_piece_id && n === 0) continue;
    out.set(r.id, {
      parent_id: r.parent_piece_id,
      parent_slug: parent?.slug ?? null,
      parent_title: parent?.title ?? null,
      origin: r.origin,
      branches: n,
    });
  }
  return out;
}

/**
 * The one line under a processed row. Only the non-zero parts are said, and
 * a document that has nothing yet says so rather than printing five zeros.
 */
export function consolidationLine(s: ConsolidationSummary): string {
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const parts = [
    s.links_out > 0 ? `Linked to ${n(s.links_out, "document", "documents")}` : "",
    s.links_in > 0 ? `linked from ${s.links_in}` : "",
    s.contradictions > 0 ? n(s.contradictions, "contradiction", "contradictions") : "",
    s.unsourced > 0 ? n(s.unsourced, "unsourced figure", "unsourced figures") : "",
    s.bridges > 0 ? n(s.bridges, "bridge", "bridges") : "",
    s.questions > 0 ? n(s.questions, "question", "questions") : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nothing linked yet";
}
