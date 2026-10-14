// CROSS-DOCUMENT LINKS — the corpus linking itself, with no model involved.
//
// The operator's description of what this publication should feel like: "it's
// kind of like when you go on Wikipedia and then you click a link and then you
// find the Wikipedia page — but instead of that, it's almost like I'm building
// it, I'm building the graph by doing that."
//
// That is buildable today, because the graph already exists: 13,075 typed
// nodes over 116 pieces, each node carrying the piece it was extracted from. A
// label attached to two different documents IS an edge between those two
// documents. Nothing has to be generated to find it; it only has to be read.
//
// WHY THIS AND NOT A MODEL
//
// The bar the operator set is the one that matters: "we need to figure out
// exactly what the system can do repeatedly, at scale, with no issues, and do
// that." This qualifies on every clause. No model call, so no cost, no
// latency, no rate limit, no drift, no failure mode, and no authoring-time
// pass to remember to run. The same corpus produces the same links every
// time, and a new document joins the web the moment it is extracted.
//
// It also satisfies standing rule 5 in the strongest way available: there is
// no AI output here at all, frozen or otherwise. The links are a query.
//
// WHAT STOPS IT DEGRADING AS THE CORPUS GROWS
//
// The failure mode of automatic cross-linking is not missing links, it is too
// many worthless ones — every document linked to every other through a label
// like "Canada" or "2026". Three mechanical limits below prevent that, and
// they get STRICTER as the corpus grows rather than looser, because the
// stopword ceiling is a proportion.

import { all } from "../../lib/d1";

/**
 * A label shorter than this is almost always a bare surname, an acronym or a
 * year — and, more decisively, locateVerbatim refuses anything under 8
 * characters outright. A shorter floor here would not produce bad links, it
 * would produce candidates that silently never match, which is worse: the
 * budget gets spent and nothing shows.
 */
const MIN_LABEL_CHARS = 8;

/**
 * A label on more than this share of the corpus is a stopword for this corpus,
 * whatever it says. "Canada" in a corpus of Canadian policy research is not a
 * connection between two documents; it is the subject of all of them, and
 * linking on it would wire everything to everything.
 *
 * A proportion, not a count, so it tightens automatically: at 50 documents it
 * allows a label on up to 17, at 500 up to 166 — and the labels that carry
 * real signal stay in the low single digits either way.
 */
const STOPWORD_SHARE = 1 / 3;

/**
 * Floor for the above, so a corpus of four documents does not end up with a
 * ceiling of one and link nothing.
 */
const MIN_STOPWORD_CEILING = 4;

/**
 * Links per document.
 *
 * The AEO research this project commissioned is specific here: inline links do
 * not hurt comprehension, but link DENSITY does. Twelve is roughly one per
 * section on a document of the length this corpus actually holds, and the
 * one-link-per-target rule below spreads them across twelve different
 * documents rather than twelve times into one.
 */
const MAX_LINKS_PER_DOC = 12;

/**
 * Only these node kinds are things a reader would follow.
 *
 * entity/event/theme are subjects. assertion, neutral_fact, attribute and
 * source are statements and metadata — their labels are sentences or
 * bibliographic strings, not phrases that appear verbatim in prose, so they
 * would fail the verbatim check anyway and waste the budget getting there.
 */
const LINKABLE_KINDS = ["entity", "event", "theme"] as const;

export interface CrossLink {
  /** The node label, which is also the phrase to look for in the body. */
  label: string;
  /** The OTHER document this phrase also appears in. */
  slug: string;
  title: string;
  /** How many documents carry this label, this one included. */
  pieces: number;
}

/**
 * Every other published document that shares a subject with this one.
 *
 * Deterministic: ordered by how specific the shared label is (fewest documents
 * first — a label on two documents is a much stronger signal than one on
 * twelve), then by label and slug so ties never reorder between calls.
 *
 * Returns [] rather than throwing on any failure. A document page must render
 * whether or not the graph is reachable; links are an enhancement, and a
 * missing one costs a reader nothing while a 500 costs them the document.
 */
export async function crossDocumentLinks(
  db: D1Database,
  userId: string,
  pieceId: string,
  opts: { limit?: number } = {},
): Promise<CrossLink[]> {
  const limit = opts.limit ?? MAX_LINKS_PER_DOC;
  if (!pieceId) return [];

  const kinds = LINKABLE_KINDS.map(() => "?").join(",");
  const rows = await all<{ label: string; slug: string; title: string; pieces: number }>(
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
     mine AS (
       SELECT DISTINCT label FROM nodes
        WHERE user_id = ? AND piece_id = ? AND kind IN (${kinds})
     )
     SELECT n.label AS label, p.slug AS slug, p.title AS title, spread.pieces AS pieces
       FROM nodes n
       JOIN mine   ON mine.label = n.label
       JOIN spread ON spread.label = n.label
       JOIN pieces p ON p.id = n.piece_id
       CROSS JOIN corpus
      WHERE n.user_id = ?
        AND n.piece_id IS NOT NULL
        AND n.piece_id <> ?
        AND n.kind IN (${kinds})
        AND p.publication_status IN ('published','canonical')
        AND spread.pieces >= 2
        AND spread.pieces <= MAX(?, CAST(corpus.n * ? AS INTEGER))
      GROUP BY n.label, p.slug
      ORDER BY spread.pieces ASC, LENGTH(n.label) DESC, n.label ASC, p.slug ASC
      LIMIT 400`,
    [
      userId,
      userId,
      ...LINKABLE_KINDS,
      MIN_LABEL_CHARS,
      userId,
      pieceId,
      ...LINKABLE_KINDS,
      userId,
      pieceId,
      ...LINKABLE_KINDS,
      MIN_STOPWORD_CEILING,
      STOPWORD_SHARE,
    ],
  ).catch(() => []);

  return pickSpread(rows, limit);
}

/**
 * One link per label and one link per destination.
 *
 * Both halves matter. Without the first, a label carried by six other
 * documents produces six links from one phrase. Without the second, a document
 * that shares nine subjects with one neighbour spends its entire link budget
 * pointing at that single neighbour — which is the least useful web possible:
 * maximum density, minimum reach.
 *
 * Exported for the tests, because this is where the quality actually lives.
 */
export function pickSpread(rows: CrossLink[], limit: number): CrossLink[] {
  const out: CrossLink[] = [];
  const usedLabels = new Set<string>();
  const usedTargets = new Set<string>();
  for (const r of rows) {
    if (out.length >= limit) break;
    if (!r.label || !r.slug) continue;
    const key = r.label.toLowerCase();
    if (usedLabels.has(key) || usedTargets.has(r.slug)) continue;
    usedLabels.add(key);
    usedTargets.add(r.slug);
    out.push(r);
  }
  return out;
}

/**
 * Every document's links at once, for the site's overlay (site/uploads.ts):
 * one query a minute per isolate instead of one per page view. The same
 * limits as crossDocumentLinks — a label of at least 8 characters, on at
 * least two documents and at most a third of the corpus, one link per label
 * and per destination — and one more: never a person, an organisation or an
 * institution. A link is a subject two documents share, not a claim about
 * someone (docs/read-it.md, "Links").
 *
 * Keyed by the document's slug; the destinations are slugs too, and the
 * site decides at render time which of them it may link to (a held
 * document never).
 */
export async function allCrossLinks(
  db: D1Database,
  userId: string,
  ownUploadsSql: string,
): Promise<Map<string, CrossLink[]>> {
  const kinds = LINKABLE_KINDS.map(() => "?").join(",");
  const rows = await all<{ label: string; slug: string; title: string; pieces: number }>(
    db,
    `WITH own AS (
       SELECT id, slug, title FROM pieces
        WHERE user_id = ? AND publication_status IN ('published','canonical') AND ${ownUploadsSql}
     ),
     linkable AS (
       SELECT n.label AS label, own.slug AS slug, own.title AS title FROM nodes n
         JOIN own ON own.id = n.piece_id
        WHERE n.user_id = ? AND n.kind IN (${kinds}) AND LENGTH(n.label) >= ?
          AND COALESCE(json_extract(n.metadata, '$.entity_type'), '') NOT IN ('person', 'organization', 'institution')
        GROUP BY n.label, own.slug
     ),
     spread AS (
       SELECT label, COUNT(*) AS pieces FROM linkable GROUP BY label
     )
     SELECT linkable.label AS label, linkable.slug AS slug, linkable.title AS title, spread.pieces AS pieces
       FROM linkable JOIN spread ON spread.label = linkable.label
      WHERE spread.pieces >= 2
        AND spread.pieces <= MAX(?, CAST((SELECT COUNT(*) FROM own) * ? AS INTEGER))
      ORDER BY spread.pieces ASC, LENGTH(linkable.label) DESC, linkable.label ASC, linkable.slug ASC
      LIMIT 20000`,
    [userId, userId, ...LINKABLE_KINDS, MIN_LABEL_CHARS, MIN_STOPWORD_CEILING, STOPWORD_SHARE],
  ).catch(() => [] as Array<{ label: string; slug: string; title: string; pieces: number }>);
  // More candidates than will show: a label the text does not carry
  // verbatim is skipped at render time, and the next one takes its place.
  return linksByDocument(rows, MAX_LINKS_PER_DOC * 3);
}

/** Per document: the other documents carrying each of its labels, most
 *  specific label first, spread by pickSpread. Pure, for the tests. */
export function linksByDocument(rows: CrossLink[], limit: number): Map<string, CrossLink[]> {
  const byLabel = new Map<string, CrossLink[]>();
  for (const r of rows) {
    const list = byLabel.get(r.label) ?? [];
    list.push(r);
    byLabel.set(r.label, list);
  }
  const candidates = new Map<string, CrossLink[]>();
  // rows arrive ordered by specificity, so each document's candidates do too.
  for (const r of rows)
    for (const other of byLabel.get(r.label) ?? [])
      if (other.slug !== r.slug) {
        const list = candidates.get(r.slug) ?? [];
        list.push(other);
        candidates.set(r.slug, list);
      }
  const out = new Map<string, CrossLink[]>();
  for (const [slug, list] of candidates) out.set(slug, pickSpread(list, limit));
  return out;
}
