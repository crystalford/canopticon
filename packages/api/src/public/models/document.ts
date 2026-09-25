// The document page as DATA.
//
// `/p/<slug>` used to do its queries and its HTML in one file. This is the
// seam between them: everything the page shows, as a typed model with no
// markup in it, built once and consumed twice — by the HTML renderer
// (render/piece-template.ts) and by `GET /p/<slug>.json`. Rule 3: nothing is
// written twice, so the JSON face and the HTML face cannot disagree about
// what the document holds.
//
// Where the source is Markdown that a renderer must render (the body, a
// reading's note, a tetrad quadrant), the model carries the Markdown. Where
// the page derives something from the Markdown by parsing it (the table of
// contents, an essay's sources), the model carries the parsed result too, so
// a front end can lay the page out without re-implementing the parser.
//
// Every helper the renderer used to call is called from here — the same
// queries, the same parsers, the same verbatim check — so the model IS what
// the page was computing, not a second opinion about it.

import { type FindingRow, findingsForPiece } from "../../graph/lib/aeo-extract";
import { crossDocumentLinks } from "../../graph/lib/crosslinks";
import { locateVerbatim } from "../../graph/lib/digestion-typed";
import { ingestionReceipt } from "../../graph/lib/ingestion-receipt";
import type { Lead } from "../../graph/lib/leads";
import { ledeForPiece } from "../../graph/lib/lede";
import { resolveByline, showsUpdate } from "../../lib/byline";
import { all, one } from "../../lib/d1";
import { documentStructure } from "../../lib/document-structure";
import { TETRAD_QUADRANTS, parseEssay, parseTetrad } from "../../lib/essay";
import { readingsForPiece } from "../../lib/readings";
import {
  type Lineage,
  type PieceDetail,
  type PublicEnv,
  getPieceBySlug,
  lineageForPiece,
  relatedBySubject,
  resolveOperatorId,
  topicForPiece,
  topicSlug,
  topicsForPiece,
} from "../data";
import {
  LICENSE,
  TETRAD_LABELS,
  citeApa,
  citeBibtex,
  essayFaq,
  essayTetradLd,
  isEssay,
  pieceJsonLdDocs,
  pieceMarkdownUrl,
  pieceTitle,
  pieceUrl,
} from "../machine";
import { markReadingPassages } from "../render/margin-readings";

// ---- the model ---------------------------------------------------------------

export type DocumentClassification = "essay" | "tetrad" | "research";

export interface DocumentSectionRef {
  slug: string;
  label: string;
}

export interface DocumentCrumb {
  name: string;
  /** Null for the current page (the last crumb). */
  href: string | null;
}

export interface DocumentLeadPassage {
  /** Verbatim from the document, selected never composed (graph/lib/lede.ts). */
  text: string;
  quoteId: string;
}

export interface DocumentKeyFigure {
  figure: string;
  measures: string;
  /** Who reported it (`attributed_to`), or null. */
  source: string | null;
  /** When (`period`), or null. */
  date: string | null;
  quoteId: string;
  /** True when the quote is verbatim in the current body — "in context" can link. */
  located: boolean;
}

export interface DocumentTocEntry {
  anchor: string;
  text: string;
}

export interface DocumentReceipt {
  quoteId: string;
  /** The DOCUMENT's substring, as locateVerbatim returned it. */
  text: string;
  /** Character offsets into `bodyMd`. Not quotes.byte_offset — see CLAUDE.md. */
  start: number;
  end: number;
}

export interface DocumentCrosslink {
  /** The shared subject, which is also the phrase looked for in the body. */
  phrase: string;
  slug: string;
  title: string;
}

export interface DocumentReading {
  id: string;
  quoteId: string;
  noteMd: string;
  verbatimText: string;
  createdAt: string;
  /**
   * True when the passage is verbatim in the current body and its end does
   * not fall in a heading, i.e. the note can sit beside its passage. False
   * means the page keeps the note after the body and says the passage is
   * no longer in the text.
   */
  located: boolean;
}

export interface DocumentLineageRef {
  slug: string;
  title: string;
  /** The question, lead or contradiction, verbatim, that started the child. */
  origin: string | null;
}

export interface DocumentLineage {
  parent: DocumentLineageRef | null;
  children: DocumentLineageRef[];
}

export interface DocumentRelated {
  slug: string;
  title: string;
  /** The related document's own closed section, or null when unfiled. */
  section: DocumentSectionRef | null;
}

export interface DocumentVideo {
  sourceUrl: string | null;
  channel: string | null;
  /** The Phase 2 argument summary, or null while it is still queued. */
  argumentSummaryMd: string | null;
}

export interface DocumentFed {
  facts: number;
  assertions: number;
  contested: number;
  subjects: Array<{ label: string; slug: string }>;
}

export interface DocumentIngestion {
  charsRead: number;
  charsTotal: number;
  truncated: boolean;
  verifiedSpans: number;
  nodes: number;
  figures: number;
}

/** A form the operator's page posts. `fields` are hidden inputs; `input` names a free-text field. */
export interface DocumentAction {
  label: string;
  method: "post";
  action: string;
  fields: Record<string, string>;
  input?: string;
}

export interface DocumentOperator {
  /** This document's own leads (graph/lib/leads.ts), for the action bar. */
  leads: Lead[];
  actions: DocumentAction[];
}

export interface DocumentModel {
  id: string;
  slug: string;
  url: string;
  kind: string;
  kindLabel: string;
  classification: DocumentClassification;
  title: string;
  /** The dek. */
  subtitle: string | null;
  /** The page's meta description: the dek, or a fallback naming the title. */
  description: string;
  /** The working title a machine-chosen title replaced, when one did. */
  originalTitle: string | null;
  titleAutoAt: string | null;
  /** The name the page publishes under (lib/byline.ts). Never empty. */
  author: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Whether the update is a full day after publication — the byline shows it only then. */
  updatedShown: boolean;
  /** Null below fifty words. */
  readMinutes: number | null;
  words: number;
  license: { name: string; url: string };
  /** Tagged `auto-research`: the page carries the AI-assistance disclosure line. */
  draftedWithAi: boolean;
  section: DocumentSectionRef | null;
  breadcrumbs: DocumentCrumb[];
  /** Only once approved: the structured data must not carry a passage the page is not showing. */
  leadPassage: DocumentLeadPassage | null;
  keyFigures: DocumentKeyFigure[];
  /**
   * Essay: its `##` sections. Tetrad: the four quadrants. Research: every
   * heading to depth 3 (the page shows the list only at four or more, and
   * only on the plain-prose path).
   */
  toc: DocumentTocEntry[];
  bodyMd: string;
  video: DocumentVideo | null;
  /** The key figures' spans located in `bodyMd`; unlocated figures are absent. */
  receipts: DocumentReceipt[];
  crosslinks: DocumentCrosslink[];
  readings: DocumentReading[];
  readByOperator: boolean;
  lineage: DocumentLineage;
  related: DocumentRelated[];
  /** Legacy `/topics/` filing, shown under "Where this came from". */
  topics: Array<{ slug: string; label: string }>;
  /** An essay's or tetrad's `## Sources` entries, verbatim Markdown. Empty for research. */
  sources: string[];
  cite: { apa: string; bibtex: string };
  machine: {
    mdUrl: string;
    jsonUrl: string;
    /** The share card, once the pipeline's og step has drawn it. */
    ogImage: string | null;
    /** The page's JSON-LD blocks, as objects (machine.ts builds them). */
    jsonLd: unknown[];
  };
  /** "This document fed the fabric": typed-graph rows it contributed, or null when none. */
  fed: DocumentFed | null;
  /** What extraction read and what survived verification; null when nothing ran. */
  ingestion: DocumentIngestion | null;
  /** Only for the signed-in operator; absent (null) for a reader. */
  operator: DocumentOperator | null;
}

export interface DocumentModelOptions {
  isOperator?: boolean;
}

// ---- building it -------------------------------------------------------------

export function pieceJsonUrl(slug: string): string {
  return `${pieceUrl(slug)}.json`;
}

export function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    essay: "Essay",
    "research-report": "Research report",
    "documented-record": "Documented record",
    thesis: "Thesis",
    synthesis: "Synthesis",
    brief: "Brief",
    note: "Library entry",
  };
  return map[kind] ?? kind;
}

function wordCount(md: string): number {
  return md.split(/\s+/).filter(Boolean).length;
}

function readMinutesOf(words: number): number | null {
  if (words < 50) return null;
  return Math.max(1, Math.round(words / 200));
}

// A piece written and published by graph/lib/deep-research.ts with no operator
// reading it first — tagged at creation time. The page carries the disclosure.
function isAutoGenerated(piece: PieceDetail): boolean {
  try {
    const tags = JSON.parse(piece.tags || "[]") as unknown;
    return Array.isArray(tags) && tags.includes("auto-research");
  } catch {
    return false;
  }
}

/** A video-transcript piece, detected from its metadata JSON. */
function videoOf(piece: PieceDetail): DocumentVideo | null {
  try {
    const meta = JSON.parse(piece.metadata || "{}") as {
      ingested_from?: string;
      source_url?: string;
      video_channel?: string;
    };
    if (meta.ingested_from !== "video-transcript") return null;
    return {
      sourceUrl: meta.source_url ?? null,
      channel: meta.video_channel ?? null,
      argumentSummaryMd: piece.argument_summary_md ?? null,
    };
  } catch {
    return null;
  }
}

// "This document fed the fabric": the typed-graph rows this piece contributed
// and the subjects they feed.
async function loadWhatItFed(
  db: D1Database,
  userId: string,
  pieceId: string,
): Promise<DocumentFed | null> {
  const counts = await one<{ facts: number; assertions: number; contested: number }>(
    db,
    `SELECT
       COALESCE(SUM(CASE WHEN kind = 'neutral_fact' THEN 1 ELSE 0 END), 0) AS facts,
       COALESCE(SUM(CASE WHEN kind = 'assertion' THEN 1 ELSE 0 END), 0) AS assertions,
       COALESCE(SUM(CASE WHEN kind = 'assertion' AND id IN
         (SELECT node_id FROM assertions WHERE rank = 'contested') THEN 1 ELSE 0 END), 0) AS contested
     FROM nodes WHERE user_id = ? AND piece_id = ?`,
    [userId, pieceId],
  ).catch(() => null);

  const subjects = await all<{ label: string; slug: string }>(
    db,
    `SELECT DISTINCT n.label, pg.slug
       FROM nodes n
       JOIN pages pg ON pg.subject_node_id = n.id
      WHERE n.user_id = ? AND n.piece_id = ? AND n.kind IN ('entity', 'event')
      LIMIT 8`,
    [userId, pieceId],
  ).catch(() => []);

  const fed = {
    facts: counts?.facts ?? 0,
    assertions: counts?.assertions ?? 0,
    contested: counts?.contested ?? 0,
    subjects,
  };
  return fed.facts === 0 && fed.assertions === 0 ? null : fed;
}

function sectionRef(label: string | null): DocumentSectionRef | null {
  return label ? { slug: topicSlug(label), label } : null;
}

function tocOf(classification: DocumentClassification, bodyMd: string): DocumentTocEntry[] {
  if (classification === "tetrad") {
    return TETRAD_QUADRANTS.map((q) => ({ anchor: q, text: TETRAD_LABELS[q] }));
  }
  if (classification === "essay") {
    return parseEssay(bodyMd).sections.map((s) => ({ anchor: s.anchor, text: s.heading }));
  }
  return documentStructure(bodyMd)
    .contents.filter((c) => c.level <= 3)
    .map((c) => ({ anchor: c.anchor, text: c.text }));
}

function sourcesOf(classification: DocumentClassification, bodyMd: string): string[] {
  if (classification === "tetrad") return parseTetrad(bodyMd)?.sources ?? [];
  if (classification === "essay") return parseEssay(bodyMd).sources;
  return [];
}

/** The key figures' spans, located in the body the way the page will splice them. */
function receiptsOf(bodyMd: string, findings: FindingRow[]): DocumentReceipt[] {
  const out: DocumentReceipt[] = [];
  for (const f of findings) {
    if (!f.quote_id || !f.verbatim_text) continue;
    const found = locateVerbatim(bodyMd, f.verbatim_text);
    if (!found) continue;
    out.push({
      quoteId: f.quote_id,
      text: found.text,
      start: found.offset,
      end: found.offset + found.text.length,
    });
  }
  return out;
}

/** The forms the operator's page posts, as data. */
function actionsOf(
  piece: PieceDetail,
  leads: Lead[],
  readings: DocumentReading[],
): DocumentAction[] {
  const actions: DocumentAction[] = [];
  for (const l of leads) {
    if (!l.seed) continue;
    actions.push({
      label: l.kind === "contradiction" ? "Settle this" : "Dig here",
      method: "post",
      action: "/op/leads/dig",
      fields: {
        seed: l.seed,
        angle: l.angle,
        kind: l.kind,
        piece_id: l.piece_id,
        piece_slug: l.piece_slug ?? "",
        other_slug: l.other_piece_slug ?? "",
      },
    });
  }
  actions.push({
    label: "Research",
    method: "post",
    action: "/op/leads/dig",
    fields: { kind: "question", piece_id: piece.id, piece_slug: piece.slug },
    input: "seed",
  });
  actions.push({
    label: "Draft a tetrad (labelled)",
    method: "post",
    action: `/op/pieces/${piece.id}/draft-tetrad`,
    fields: {},
  });
  actions.push({
    label: "Save reading",
    method: "post",
    action: "/op/readings",
    fields: { piece_id: piece.id },
    input: "note",
  });
  for (const r of readings) {
    actions.push({
      label: "delete",
      method: "post",
      action: `/op/readings/${r.id}/delete`,
      fields: {},
    });
    actions.push({
      label: "draft an essay from this",
      method: "post",
      action: `/op/readings/${r.id}/draft-essay`,
      fields: {},
    });
  }
  return actions;
}

/**
 * Everything `/p/<slug>` shows, as data. Null when there is no such published
 * document: working-material is not a public page and must not have a JSON
 * face either.
 */
export async function documentModel(
  env: PublicEnv,
  slug: string,
  opts: DocumentModelOptions = {},
): Promise<DocumentModel | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;
  const piece = await getPieceBySlug(env.DB, userId, slug);
  if (!piece) return null;
  // Working-material chain passes are not publicly reachable (spec §2.6).
  if (piece.publication_status === "working-material") return null;

  const isOperator = opts.isOperator === true;
  const bodyMd = piece.body_md ?? "";
  const essay = isEssay(piece.kind);
  // A tetrad is filed as an essay; the parse is the test, so a file edited out
  // of the four-quadrant shape reads as an essay again.
  const tetrad = essay ? parseTetrad(bodyMd) : null;
  const classification: DocumentClassification = tetrad ? "tetrad" : essay ? "essay" : "research";

  const topics = await topicsForPiece(env.DB, userId, piece.id);
  // Related by shared subject, not by date (docs/the-record.md §6).
  const relatedRows = (await relatedBySubject(env.DB, userId, piece.id, 4).catch(() => [])).filter(
    (r) => r.id !== piece.id,
  );
  // The operator's readings (§5c) and the document's lineage (§5). Both are
  // plain queries; both come back empty as nothing rather than as a claim.
  const readingRows = await readingsForPiece(env.DB, userId, piece.id).catch(() => []);
  const lineage = await lineageForPiece(env.DB, userId, piece.id).catch(
    () => ({ parent: null, children: [] }) as Lineage,
  );
  const fed = await loadWhatItFed(env.DB, userId, piece.id);
  // Findings: the densest thing a research document produces and the only
  // primitive with strong evidence behind it. On the document's own page.
  const findings = await findingsForPiece(env.DB, userId, piece.id).catch(() => []);
  const lede = await ledeForPiece(env.DB, userId, piece.id).catch(() => null);
  // Subjects shared with other published documents — a query over the typed
  // graph, not a model call.
  const crosslinkRows = await crossDocumentLinks(env.DB, userId, piece.id).catch(() => []);
  // The closed section (graph/lib/topics.ts) this document is filed in.
  const sectionLabel = await topicForPiece(env.DB, userId, piece.id).catch(() => null);
  const titleRow = await one<{ original_title: string | null; title_auto_at: string | null }>(
    env.DB,
    "SELECT original_title, title_auto_at FROM pieces WHERE id = ? AND user_id = ?",
    [piece.id, userId],
  ).catch(() => null);
  // What extraction read and what survived (graph/lib/ingestion-receipt.ts).
  // Null when nothing ran, so "not extracted" never reads as confident zeros.
  const receipt = await ingestionReceipt(env.DB, userId, piece.id).catch(() => null);
  // The operator's action bar (docs/the-record.md §6): this document's own
  // leads. Operator-only, never fetched for a reader. The ingestion receipt
  // already carries them when it exists; otherwise the same query, same limit.
  const leads: Lead[] = isOperator
    ? (receipt?.leads ??
      (await (
        await import("../../graph/lib/leads")
      )
        .leadsForCorpus(env.DB, userId, { pieceId: piece.id, limit: 6 })
        .catch(() => [] as Lead[])))
    : [];
  const related: DocumentRelated[] = await Promise.all(
    relatedRows.map(async (r) => ({
      slug: r.slug,
      title: r.title,
      section: sectionRef(await topicForPiece(env.DB, userId, r.id).catch(() => null)),
    })),
  );
  // The share card exists once the pipeline's og step has drawn it; a 404
  // og:image is worse than none, so it is named only when the object is there.
  const ogKey = `og/${piece.slug}.png`;
  const hasCard = await env.FILES?.head(ogKey)
    .then((h) => Boolean(h))
    .catch(() => false);

  // Located the way the page places them: markReadingPassages is the same
  // check the renderer runs, heading rule included.
  const located = markReadingPassages(
    bodyMd,
    readingRows.map((r) => ({ id: r.id, verbatim_text: r.verbatim_text })),
  ).located;
  const readings: DocumentReading[] = readingRows.map((r) => ({
    id: r.id,
    quoteId: r.quote_id,
    noteMd: r.note_md,
    verbatimText: r.verbatim_text,
    createdAt: r.created_at,
    located: located.has(r.id),
  }));

  const receipts = receiptsOf(bodyMd, findings);
  const locatedFigures = new Set(receipts.map((r) => r.quoteId));
  const keyFigures: DocumentKeyFigure[] = findings.map((f) => ({
    figure: f.figure,
    measures: f.measures,
    source: f.attributed_to,
    date: f.period,
    quoteId: f.quote_id,
    located: locatedFigures.has(f.quote_id),
  }));

  const title = pieceTitle(piece);
  const section = sectionRef(sectionLabel);
  // Home › Research › Section › Title. The section crumb appears only for a
  // filed research document. The same trail is emitted as BreadcrumbList.
  const breadcrumbs: DocumentCrumb[] = [
    { name: "Home", href: "/" },
    essay ? { name: "Essays", href: "/essays" } : { name: "Research", href: "/research" },
    ...(!essay && section ? [{ name: section.label, href: `/research/${section.slug}` }] : []),
    { name: title, href: null },
  ];

  const tetradLd = essay ? essayTetradLd(bodyMd) : null;
  const faq = essay && !tetradLd ? essayFaq(bodyMd) : undefined;
  const jsonLd = pieceJsonLdDocs(piece, {
    ...(faq?.length ? { faq } : {}),
    ...(tetradLd ? { tetrad: tetradLd } : {}),
    ...(lede?.approved_at ? { lede: lede.verbatim_text } : {}),
    ...(readingRows.length ? { readings: readingRows } : {}),
    section: sectionLabel,
    basedOn: lineage.parent ? { slug: lineage.parent.slug, title: lineage.parent.title } : null,
  });

  const words = wordCount(bodyMd);

  return {
    id: piece.id,
    slug: piece.slug,
    url: pieceUrl(piece.slug),
    kind: piece.kind,
    kindLabel: kindLabel(piece.kind),
    classification,
    title,
    subtitle: piece.subtitle ?? null,
    description: piece.subtitle ?? `${title} — a Canopticon piece.`,
    originalTitle: titleRow?.original_title ?? null,
    titleAutoAt: titleRow?.title_auto_at ?? null,
    author: resolveByline(piece.byline),
    publishedAt: piece.published_at ?? null,
    createdAt: piece.created_at,
    updatedAt: piece.updated_at,
    updatedShown: showsUpdate(piece.published_at, piece.updated_at),
    readMinutes: readMinutesOf(words),
    words,
    license: { name: LICENSE.name, url: LICENSE.url },
    draftedWithAi: isAutoGenerated(piece),
    section,
    breadcrumbs,
    leadPassage: lede?.approved_at ? { text: lede.verbatim_text, quoteId: lede.quote_id } : null,
    keyFigures,
    toc: tocOf(classification, bodyMd),
    bodyMd,
    video: videoOf(piece),
    receipts,
    crosslinks: crosslinkRows.map((c) => ({ phrase: c.label, slug: c.slug, title: c.title })),
    readings,
    readByOperator: readings.length > 0,
    lineage: { parent: lineage.parent, children: lineage.children },
    related,
    topics: topics.map((t) => ({ slug: t.slug, label: t.label })),
    sources: sourcesOf(classification, bodyMd),
    cite: { apa: citeApa(piece), bibtex: citeBibtex(piece) },
    machine: {
      mdUrl: pieceMarkdownUrl(piece.slug),
      jsonUrl: pieceJsonUrl(piece.slug),
      ogImage: hasCard ? `https://canopticon.com/og/${piece.slug}.png` : null,
      jsonLd,
    },
    fed,
    ingestion: receipt
      ? {
          charsRead: receipt.read_chars,
          charsTotal: receipt.total_chars,
          truncated: receipt.truncated,
          verifiedSpans: receipt.quotes,
          nodes: receipt.nodes,
          figures: receipt.findings,
        }
      : null,
    operator: isOperator ? { leads, actions: actionsOf(piece, leads, readings) } : null,
  };
}
