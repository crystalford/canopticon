// Piece-page renderer — ports the design build's research-report,
// documented-record, and essay templates so individual pieces actually
// read like the design promised, not like a basic CMS dump.
//
// The body_md content is parsed by `##` section headings to detect
// known structural sections (Short version, Key findings, Caveats,
// What this is, What this is not, Source log). Anything unrecognised
// renders as plain prose. The scaffolding (breadcrumb, page-head,
// download bar, deposit note, "keep exploring" rail) wraps every kind.
//
// CSS classes are all already in styles.ts (lifted verbatim from the
// design build); this file is template + section-parser only.

import { type FindingRow, findingsForPiece } from "../../graph/lib/aeo-extract";
import type { Lead } from "../../graph/lib/leads";
import { type LedeRow, ledeForPiece } from "../../graph/lib/lede";
import { resolveByline, showsUpdate } from "../../lib/byline";
import { documentStructure } from "../../lib/document-structure";
import { type ParsedTetrad, TETRAD_QUADRANTS, parseEssay, parseTetrad } from "../../lib/essay";
import { type ReadingRow, readingsForPiece } from "../../lib/readings";
import {
  type Lineage,
  type PieceDetail,
  type PieceSummary,
  type PublicEnv,
  getPieceBySlug,
  lineageForPiece,
  relatedBySubject,
  resolveOperatorId,
  topicForPiece,
  topicSlug,
  topicsForPiece,
} from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";
import {
  TETRAD_LABELS,
  citeApa,
  citeBibtex,
  essayFaq,
  essayTetradLd,
  isEssay,
  pieceJsonLd,
  pieceMarkdownUrl,
  pieceTitle,
  pieceUrl,
} from "../machine";
// The publication's own renderer, NOT the CMS one. A document is not a post:
// it arrives as an uploaded file carrying tables, nested lists and
// hard-wrapped prose, none of which the CMS renderer handles — which is what
// made a research dossier render as a wall of text. See render/markdown.ts.
import { renderInlineMarkdown, renderMarkdown } from "./markdown";
import { type CrossLinkSpan, spliceInline } from "./receipts";

/** Bylines that name the machinery rather than an author. Never rendered. */

// ---- public entry point -----------------------------------------------

export interface RenderPieceOptions {
  /**
   * The viewer is the signed-in operator. Only then does the page carry the
   * "Note this" form, the /op/notes.js script and the delete buttons on
   * readings. The caller (public/routes.ts) knows this from `is_operator`
   * on the Hono context; the renderer cannot learn it on its own.
   */
  isOperator?: boolean;
}

export async function renderPiece(
  env: PublicEnv,
  slug: string,
  opts: RenderPieceOptions = {},
): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;
  const piece = await getPieceBySlug(env.DB, userId, slug);
  if (!piece) return null;
  // Working-material chain passes are not publicly reachable (spec §2.6).
  if (piece.publication_status === "working-material") return null;

  const topics = await topicsForPiece(env.DB, userId, piece.id);
  // Related by shared subject, not by date (docs/the-record.md §6): the typed
  // graph already knows which entity and theme labels two documents share.
  const related = await relatedBySubject(env.DB, userId, piece.id, 4).catch(() => []);
  // The operator's readings (§5c) and the document's lineage (§5). Both are
  // plain queries; both render empty as nothing rather than as a claim.
  const readings = await readingsForPiece(env.DB, userId, piece.id).catch(() => []);
  const lineage = await lineageForPiece(env.DB, userId, piece.id).catch(
    () => ({ parent: null, children: [] }) as Lineage,
  );
  const fed = await loadWhatItFed(env, userId, piece.id);
  // Findings are the densest thing a research document produces and the only
  // primitive with strong evidence behind it. They live on the document's own
  // page — no new URL, so no thin-content exposure at all.
  const findings = await findingsForPiece(env.DB, userId, piece.id).catch(() => []);
  const lede = await ledeForPiece(env.DB, userId, piece.id).catch(() => null);
  // Subjects this document shares with other published documents. A query, not
  // a model call: the typed graph already records which piece every node came
  // from, so a label on two pieces IS an edge between them. Free, deterministic
  // and always current — a new document joins the web the moment it extracts.
  const { crossDocumentLinks } = await import("../../graph/lib/crosslinks");
  const crosslinks = await crossDocumentLinks(env.DB, userId, piece.id).catch(() => []);
  // The closed section (graph/lib/topics.ts) this document is filed in — the
  // third crumb, and the hub the page belongs to. Null when not yet filed.
  const section = await topicForPiece(env.DB, userId, piece.id).catch(() => null);
  // The operator's action bar (docs/the-record.md §6): this document's own
  // leads. A query, operator-only, never fetched for a reader.
  const leads = opts.isOperator
    ? await (await import("../../graph/lib/leads"))
        .leadsForCorpus(env.DB, userId, { pieceId: piece.id, limit: 6 })
        .catch(() => [] as Lead[])
    : [];

  const body = renderPieceBody(piece, {
    topics: topics.map((t) => ({ slug: t.slug, label: t.label })),
    related: related.filter((r) => r.id !== piece.id),
    fed,
    findings,
    lede,
    crosslinks,
    readings,
    lineage,
    section,
    leads,
    isOperator: opts.isOperator === true,
  });

  // The piece page emitted no structured data at all, while subject pages and
  // every arrangement did — the page type the publication is actually made of
  // was the least machine-legible one on the site.
  const essay = isEssay(piece.kind);
  // A tetrad is filed as an essay but has no question headings, so it gets
  // `about` and `hasPart` in place of a FAQPage.
  const tetrad = essay ? essayTetradLd(piece.body_md ?? "") : null;
  const faq = essay && !tetrad ? essayFaq(piece.body_md ?? "") : undefined;
  // The share card exists once the pipeline's og step has drawn it; the
  // route 404s until then, and a 404 og:image is worse than none, so it is
  // named only when the object is there.
  const ogKey = `og/${piece.slug}.png`;
  const hasCard = await env.FILES?.head(ogKey)
    .then((h) => Boolean(h))
    .catch(() => false);
  return renderPage({
    title: pieceTitle(piece),
    description: piece.subtitle ?? `${pieceTitle(piece)} — a Canopticon piece.`,
    ...(hasCard ? { ogImage: `https://canopticon.com/og/${piece.slug}.png` } : {}),
    body: `${body}\n${pieceJsonLd(piece, {
      ...(faq?.length ? { faq } : {}),
      ...(tetrad ? { tetrad } : {}),
      // Only once approved — the structured data must not carry a passage the
      // page itself is not showing.
      ...(lede?.approved_at ? { lede: lede.verbatim_text } : {}),
      // Each reading is a Comment on its Quotation — the operator's own
      // sentences, and the only ones on the page that are not the document's.
      ...(readings.length ? { readings } : {}),
      section,
      // Lineage (§5): the document this one grew from, as `isBasedOn`.
      basedOn: lineage.parent ? { slug: lineage.parent.slug, title: lineage.parent.title } : null,
    })}`,
    activeNav: essay ? "/essays" : "/research",
    zone: essay ? "essays" : "research",
    canonical: pieceUrl(piece.slug),
    // The body brings its own `.container.docpage`. Without `bare`, renderPage
    // wraps it in a second `.container` — two lots of side padding, and the
    // outer's max-width:1100px clamping before .docpage's 1260px can apply,
    // which squeezed the reading column to ~530px and pushed it off centre.
    bare: true,
    ogType: "article",
    markdownUrl: pieceMarkdownUrl(piece.slug),
    publishedTime: piece.published_at ?? piece.created_at,
    modifiedTime: piece.updated_at,
  });
}

// ---- main composer -----------------------------------------------------

interface FedSummary {
  facts: number;
  assertions: number;
  contested: number;
  subjects: Array<{ label: string; slug: string }>;
}

interface PieceCtx {
  topics: Array<{ slug: string; label: string }>;
  related: PieceSummary[];
  fed?: FedSummary;
  findings?: FindingRow[];
  lede?: LedeRow | null;
  /**
   * Subjects this document shares with other published documents, from
   * graph/lib/crosslinks.ts. A query over the typed graph, not a model call —
   * so it costs nothing, never fails, and returns the same answer every time.
   */
  crosslinks?: Array<CrossLinkSpan & { title: string }>;
  /** The operator's notes on passages of this document (§5c). */
  readings?: ReadingRow[];
  /** What this document grew from and into (§5). */
  lineage?: Lineage;
  /** The closed section this document is filed in, or null. */
  section?: string | null;
  /** This document's own leads, for the operator's action bar (§6). */
  leads?: Lead[];
  /** The viewer is the signed-in operator: render the note form and script. */
  isOperator?: boolean;
}

/**
 * The passage a retriever is meant to lift, placed before the body so it is
 * the first prose on the page.
 *
 * It is the document's OWN words — selected, never composed — so it carries a
 * /q/ receipt like any other quote. Rendered only once a person has approved
 * it: a passage can be perfectly verbatim and still misrepresent what the
 * document weighs, and no substring check catches that.
 */
function renderLede(lede: LedeRow | null | undefined): string {
  if (!lede?.approved_at) return "";
  return `<div class="tldr lede">
  <p>${escapeHtml(lede.verbatim_text)}</p>
  <a class="ev-receipt" href="/q/${escapeAttr(lede.quote_id)}">Verified passage →</a>
</div>`;
}

// The figure, what it measures, when, and who reported it. A statistic stated
// beside its named source and date is the single best-evidenced shape for
// being cited, and it is exactly what the verification layer already produces.
//
// ABOVE THE FOLD (docs/the-record.md §6, item 4): this is the block answer
// engines lift, so it sits directly under the lead passage and before the
// document's own promoted summary — compact, a table, six rows. Any further
// figures are listed under a fold in the same block, so the page never says
// "6" when it holds 20. There is no second copy lower down.
//
// THE QUOTE ITSELF IS NOT REPEATED HERE. The span is linked in the passage it
// came from; this block's job is to be the scannable index of what the
// document establishes and to point back into the prose — so "in context"
// goes to the sentence, and the receipt link goes to the proof.
const KEY_FIGURES_ABOVE_FOLD = 6;

function renderFindings(findings: FindingRow[] | undefined, placed: Set<string>): string {
  if (!findings?.length) return "";
  const row = (f: FindingRow) => `    <tr class="kf-row">
      <td class="kf-figure">${escapeHtml(f.figure)}</td>
      <td class="kf-measures">${escapeHtml(f.measures)}</td>
      <td class="kf-meta">${[f.period, f.attributed_to]
        .filter(Boolean)
        .map((x) => escapeHtml(String(x)))
        .join(' <span class="sep">·</span> ')}</td>
      <td class="kf-links">${
        // Only when the span was actually placed in the prose. A finding whose
        // quote no longer appears in the body (the document was edited after
        // extraction) has no anchor to jump to, and a dead link on the
        // provenance surface is worse than no link.
        placed.has(f.quote_id)
          ? `<a class="finding-context" href="#q-${escapeAttr(f.quote_id)}">in context ↓</a> `
          : ""
      }<a class="finding-receipt" href="/q/${escapeAttr(f.quote_id)}">verified quote ↗</a></td>
    </tr>`;
  const lead = findings.slice(0, KEY_FIGURES_ABOVE_FOLD);
  const rest = findings.slice(KEY_FIGURES_ABOVE_FOLD);
  const table = (rows: FindingRow[]) => `  <table class="key-figures">
    <thead><tr><th>Figure</th><th>What it measures</th><th>Period · source</th><th></th></tr></thead>
    <tbody>
${rows.map(row).join("\n")}
    </tbody>
  </table>`;
  return `<section class="findings key-figures-block">
  <h2>Key figures</h2>
  <p class="note">Every figure is quoted word-for-word from this document and checked
  against it by machine. Follow one to the sentence it came from.</p>
${table(lead)}
${
  rest.length
    ? `  <details class="key-figures-more">
    <summary>${rest.length} more figure${rest.length === 1 ? "" : "s"}</summary>
${table(rest)}
  </details>`
    : ""
}
</section>`;
}

// "This document fed the fabric" — the receipt loop. Counts the typed-graph
// rows this piece contributed and the subject pages they feed. Closes the
// loop: facts climb up to pages; the document shows what it gave.
async function loadWhatItFed(env: PublicEnv, userId: string, pieceId: string): Promise<FedSummary> {
  const { all, one } = await import("../../lib/d1");
  const counts = await one<{ facts: number; assertions: number; contested: number }>(
    env.DB,
    `SELECT
       COALESCE(SUM(CASE WHEN kind = 'neutral_fact' THEN 1 ELSE 0 END), 0) AS facts,
       COALESCE(SUM(CASE WHEN kind = 'assertion' THEN 1 ELSE 0 END), 0) AS assertions,
       COALESCE(SUM(CASE WHEN kind = 'assertion' AND id IN
         (SELECT node_id FROM assertions WHERE rank = 'contested') THEN 1 ELSE 0 END), 0) AS contested
     FROM nodes WHERE user_id = ? AND piece_id = ?`,
    [userId, pieceId],
  ).catch(() => null);

  const subjects = await all<{ label: string; slug: string }>(
    env.DB,
    `SELECT DISTINCT n.label, pg.slug
       FROM nodes n
       JOIN pages pg ON pg.subject_node_id = n.id
      WHERE n.user_id = ? AND n.piece_id = ? AND n.kind IN ('entity', 'event')
      LIMIT 8`,
    [userId, pieceId],
  ).catch(() => []);

  return {
    facts: counts?.facts ?? 0,
    assertions: counts?.assertions ?? 0,
    contested: counts?.contested ?? 0,
    subjects,
  };
}

function renderWhatItFed(fed: FedSummary | undefined): string {
  if (!fed || (fed.facts === 0 && fed.assertions === 0)) return "";
  // Subjects are named, not linked: the subject pages were unmounted on
  // 2026-09-24 (docs/the-record.md §9). Cross-document links in the body are
  // how a reader walks from here to the other documents on the same subject.
  const subjectLinks = fed.subjects.length
    ? ` → ${fed.subjects.map((s) => escapeHtml(s.label)).join(" · ")}`
    : "";
  return `<div class="piece-note" style="margin-top:30px">
  <span class="dr-h">This document fed the fabric</span>
  <p><b>${fed.facts}</b> fact${fed.facts === 1 ? "" : "s"} · <b>${fed.assertions}</b> assertion${fed.assertions === 1 ? "" : "s"}${fed.contested > 0 ? ` (${fed.contested} contested)` : ""}${subjectLinks}. Every one is a verbatim span; nothing was paraphrased into the graph.</p>
</div>`;
}

function renderPieceBody(piece: PieceDetail, ctx: PieceCtx): string {
  // Receipts are spliced into the markdown BEFORE sectioning, so every
  // per-kind body path below inherits them without knowing they exist. The
  // findings are the only spans linked: at roughly 53 verified quotes per
  // piece, linking them all would be the density problem the reader research
  // warns about, and a figure with a named source and a date is the
  // best-evidenced citable shape there is.
  // ONE pass, not two. Receipts and cross-document links compete for the same
  // prose, and splicing them separately would let the second pass match inside
  // the markdown the first just wrote — a link nested in a link. Receipts win
  // any contested span (see spliceInline): proof before navigation.
  const receipts = spliceInline(piece.body_md ?? "", ctx.findings ?? [], ctx.crosslinks ?? []);
  const withReceipts = receipts.markdown;
  const sections = parseSections(withReceipts);
  const videoMeta = parseVideoMetadata(piece);

  // A video-transcript piece: lead with the argument summary (Phase 2,
  // 2026-07-24) — the faithful, source-side account of what was argued —
  // and fold the raw transcript (still the same body_md every other kind
  // renders inline) behind a <details> so it reads as backing material,
  // not the main event. Every other kind is untouched.
  const bodyBlock = videoMeta
    ? `${renderArgumentSummary(piece, videoMeta)}
<details class="video-transcript-fold">
  <summary>Full transcript</summary>
  ${renderBodyForKind(piece, sections, ctx, withReceipts)}
</details>`
    : renderBodyForKind(piece, sections, ctx, withReceipts);

  // The rail sits OUTSIDE the reading card, not inside it. It was inside,
  // which meant 300px of sidebar came out of the document's own measure and
  // squeezed the prose to roughly 570px. The card now holds only the
  // document; the rail is a separate column beside it.
  return `<div class="container docpage">
<div class="docgrid">
  <article class="reading">
${renderBreadcrumbs(piece, ctx.section)}
${renderPageHead(piece, ctx)}
${renderActionBar(piece, ctx)}
${renderLede(ctx.lede)}
${renderFindings(ctx.findings, receipts.placed)}
${bodyBlock}
${renderReadings(ctx)}
${renderNoteForm(piece, ctx)}
${renderLineage(ctx.lineage)}
${renderCiteBox(piece)}
${renderWhatItFed(ctx.fed)}
${renderDepositNote(piece, ctx.topics)}
  </article>
${renderDocRail(piece)}
</div>
${renderOnward(piece, ctx)}
</div>
${ctx.isOperator ? '<script src="/op/notes.js" defer></script>' : ""}
<style>
  .key-figures-block { margin: 26px 0 0; padding-top: 18px; }
  .key-figures-block h2 { font-size: 15px; letter-spacing: 0.02em; text-transform: uppercase; }
  .key-figures-block .note { margin: 0 0 10px; }
  .key-figures { width: 100%; border-collapse: collapse; font-family: var(--sans); font-size: 14px;
    border: 1px solid var(--rule); border-radius: var(--r-lg); overflow: hidden; }
  .key-figures th { text-align: left; font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--ink-mute); padding: 8px 10px; border-bottom: 1px solid var(--rule); }
  .key-figures td { padding: 9px 10px; border-bottom: 1px solid var(--rule); vertical-align: top; background: var(--paper-2); }
  .key-figures tr:last-child td { border-bottom: 0; }
  .kf-figure { font-weight: 700; color: var(--accent); white-space: nowrap; letter-spacing: -0.01em; }
  .kf-measures { color: var(--ink); }
  .kf-meta { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-mute); }
  .kf-links { white-space: nowrap; }
  .kf-links .finding-receipt, .kf-links .finding-context { margin-top: 0; }
  .key-figures-more { margin-top: 10px; }
  .key-figures-more summary { cursor: pointer; font-family: var(--mono); font-size: 11px;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-mute); margin-bottom: 8px; }
  @media (max-width: 640px) {
    .key-figures thead { display: none; }
    .key-figures tr { display: block; padding: 8px 0; }
    .key-figures td { display: block; border: 0; padding: 2px 10px; }
    .kf-figure { white-space: normal; }
  }
  .readings { margin-top: 32px; border-top: 1px solid var(--rule); padding-top: 18px; }
  .readings .ow-h, .lineage .ow-h { margin-bottom: 12px; }
  .reading-note { margin: 0 0 22px; }
  .reading-note blockquote { margin: 0 0 8px; padding-left: 14px; border-left: 2px solid var(--accent);
    font-family: var(--serif); font-style: italic; color: var(--ink-2); }
  .reading-note blockquote a { color: inherit; text-decoration: none; }
  .reading-note .note-body { font-family: var(--serif); }
  .reading-note .note-sig { font-family: var(--mono); font-size: 12px; color: var(--ink-3);
    display: flex; gap: 12px; align-items: center; }
  .reading-note .note-sig button { font: inherit; color: var(--ink-3); background: none; border: 0;
    padding: 0; cursor: pointer; text-decoration: underline; }
  .lineage { margin-top: 28px; border-top: 1px solid var(--rule); padding-top: 18px; }
  .lineage ul { list-style: none; margin: 0; padding: 0; }
  .lineage li { margin: 0 0 10px; }
  .lineage .origin { display: block; font-family: var(--serif); font-style: italic; color: var(--ink-2); }
  .note-form { margin-top: 24px; padding: 16px; border: 1px solid var(--rule); }
  .note-form textarea { width: 100%; box-sizing: border-box; font: inherit; background: transparent;
    color: var(--ink); border: 1px solid var(--rule); padding: 8px; margin: 6px 0 12px; }
  .note-form .note-status { font-family: var(--mono); font-size: 12px; color: var(--accent); }
  .note-this { position: absolute; z-index: 20; font-family: var(--mono); font-size: 12px;
    letter-spacing: .06em; text-transform: uppercase; background: var(--accent); color: #fff;
    border: 0; padding: 6px 10px; cursor: pointer; display: flex; gap: 1px; }
  .note-this button { font: inherit; color: inherit; background: none; border: 0; padding: 0 4px; cursor: pointer; }
  .op-bar { margin: 14px 0 6px; padding: 12px 14px; border: 1px solid var(--rule); font-family: var(--sans); font-size: 13px; }
  .op-bar .ow-h { margin-bottom: 8px; }
  .op-bar ul { list-style: none; margin: 0 0 10px; padding: 0; }
  .op-bar li { margin: 0 0 8px; display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
  .op-bar .lead-k { font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); }
  .op-bar .lead-dig-form { display: inline-flex; gap: 8px; align-items: baseline; }
  .op-bar .lead-dig { font: inherit; color: var(--accent); background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; }
  .op-bar .op-ask { display: flex; gap: 8px; }
  .op-bar .op-ask input[name=seed] { flex: 1; font: inherit; background: transparent; color: var(--ink); border: 1px solid var(--rule); padding: 6px 8px; }
  .video-transcript-fold summary { cursor: pointer; font-family: var(--mono); font-size: 12px;
    letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); padding: 10px 0;
    border-top: 1px solid var(--rule); margin-top: 24px; }
  .video-transcript-fold[open] summary { border-bottom: 1px solid var(--rule); margin-bottom: 18px; }
</style>`;
}

interface VideoMeta {
  source_url: string | null;
  video_channel: string | null;
}

/** Detect a video-transcript piece (Phase 1 ingestion, 2026-07-24) from
 *  its metadata JSON rather than a dedicated column — matches how every
 *  other piece-origin marker (ingested_from) is already stored. */
function parseVideoMetadata(piece: PieceDetail): VideoMeta | null {
  try {
    const meta = JSON.parse(piece.metadata || "{}") as {
      ingested_from?: string;
      source_url?: string;
      video_channel?: string;
    };
    if (meta.ingested_from !== "video-transcript") return null;
    return { source_url: meta.source_url ?? null, video_channel: meta.video_channel ?? null };
  } catch {
    return null;
  }
}

/** "What this video argued" — the Phase 2 summary, or (while it's still
 *  queued — advanceArgumentSummaries runs one piece per cron tick) an
 *  honest note that it's on its way rather than a blank gap. */
function renderArgumentSummary(piece: PieceDetail, meta: VideoMeta): string {
  const sourceLine = [
    meta.video_channel ? escapeHtml(meta.video_channel) : null,
    meta.source_url
      ? `<a href="${escapeAttr(meta.source_url)}" target="_blank" rel="noopener noreferrer">watch the original ↗</a>`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = piece.argument_summary_md
    ? renderMarkdown(piece.argument_summary_md)
    : `<p class="piece-note-pending">Summarizing what was argued in this video — checks in on the next processing pass. The full transcript below is already searchable and feeding the record.</p>`;

  return `<div class="piece-note video-argument-summary">
  <span class="dr-h">What this video argued</span>
  ${sourceLine ? `<p class="coord" style="margin:2px 0 14px">${sourceLine}</p>` : ""}
  ${body}
</div>`;
}

// ---- scaffolding -------------------------------------------------------

function renderBreadcrumbs(piece: PieceDetail, topic?: string | null): string {
  const essay = isEssay(piece.kind);
  const section = essay
    ? { name: "Essays", href: "/essays" }
    : { name: "Research", href: "/research" };
  // Home › Research › Section › Title (docs/the-record.md §6). The section
  // crumb appears only for a filed research document: it links to a hub that
  // exists. The same trail is emitted as BreadcrumbList in machine.ts.
  const hub =
    !essay && topic
      ? `
  <span class="arr">›</span>
  <a href="/research/${escapeAttr(topicSlug(topic))}">${escapeHtml(topic)}</a>`
      : "";
  // The last crumb was the kind ("essay"), which the eyebrow directly above
  // it already says. The title is what a breadcrumb is for.
  return `<div class="scope crumbs">
  <a href="/">Home</a>
  <span class="arr">›</span>
  <a href="${escapeAttr(section.href)}">${escapeHtml(section.name)}</a>${hub}
  <span class="arr">›</span>
  <span class="cur">${escapeHtml(pieceTitle(piece))}</span>
</div>`;
}

function renderPageHead(piece: PieceDetail, ctx: PieceCtx): string {
  const label = kindLabel(piece.kind);
  // The tag now appears ONLY as a warning. It used to label every piece
  // ("signed essay", "library entry") — a third restatement of what the
  // eyebrow and breadcrumb already said, in an .analysis-scoped class that
  // this page never matched, so it rendered as unstyled wrapping text. The
  // one case that carries real information is an auto-generated piece no
  // human has read, so that is the only case that still renders.
  const autoGenerated = isAutoGenerated(piece);
  // Its own class, not .opinion-tag — that one is scoped to `.analysis`,
  // which a piece page is not, so this rendered as unstyled text wrapping
  // one word per line down the left of the page.
  // DISCLOSURE, KEPT SHORT ON PURPOSE.
  //
  // This said "Unreviewed — written and published automatically. No operator
  // has read this." That was false, so it was replaced with a fuller line
  // naming the editor and the review. Checking that properly says the fuller
  // line was the wrong instinct:
  //
  //   - Schilke & Reimann's transparency-dilemma experiments found disclosing
  //     AI use lowered trust in ALL SIX framing conditions tested, and that the
  //     mere acknowledgment does it regardless of framing.
  //   - Detailed disclosures measured WORSE than one-line ones; a one-line
  //     disclosure did not reduce trust at all against saying nothing.
  //   - Human-oversight framing was tested specifically and does not rescue it.
  //     "Directed and reviewed by X, who holds editorial responsibility" was
  //     therefore the worst clause available: long, and leaning on the framing
  //     the experiments show fails.
  //   - What DID mitigate the effect was naming the sources — which is this
  //     site's whole differentiator, so it leads.
  //
  // Editorial responsibility did not leave the page, only this box: it is in
  // the byline under the H1 and in the JSON-LD author as a named Person, which
  // is where the citation signal lives and what the EU carve-out asks for.
  const warningTag = autoGenerated
    ? `<div class="provenance">Every quote here is checked word-for-word against a stored source. Drafted with AI assistance. <a href="/method">How this is verified →</a></div>`
    : "";
  const confidence = readConfidence(piece);
  const confSection =
    isEditorialKind(piece.kind) && confidence
      ? `<span class="row" style="gap:7px">${confDots(confidence)}<span class="coord">${escapeHtml(confidence)} confidence</span></span>`
      : "";
  const reading = readingTime(piece.body_md ?? "");
  // "the operator" is internal vocabulary — createAndExtract deliberately
  // leaves byline unset for exactly this reason, but older rows still carry
  // it and it renders on the page as "By the operator".
  const byline = resolveByline(piece.byline);
  const dateBits = [
    byline
      ? `<span class="sig" style="font-family:var(--serif);font-style:italic;color:var(--ink)">By ${escapeHtml(byline)}</span>`
      : "",
    piece.published_at ? `<span>${escapeHtml(formatDate(piece.published_at))}</span>` : "",
    // An update date is a ranking input, not decoration — freshness is a large
    // share of some engines' signal and the citation research names
    // update-date visibility directly. Only when it is genuinely later; a page
    // that says "Updated" on its publication day is noise.
    showsUpdate(piece.published_at, piece.updated_at)
      ? `<span class="updated">Updated ${escapeHtml(formatDate(piece.updated_at ?? ""))}</span>`
      : "",
    reading ? `<span>${escapeHtml(reading)}</span>` : "",
    // The one trust signal the machine cannot supply. Said only when a
    // readings row exists; a document without one does not claim it.
    ctx.readings?.length ? `<a href="#readings" class="read-by">Read by the operator</a>` : "",
  ].filter(Boolean);
  const dateLine = dateBits.length
    ? `<div class="coord" style="margin-top:18px;gap:12px;flex-wrap:wrap">${dateBits.join('<span class="sep">·</span>')}</div>`
    : "";

  // The banner is a SIBLING of the row, not inside it. `.row` is display:flex,
  // so a block child becomes a flex item and shrinks to its content — which is
  // what rendered this as a column one or two words wide. The previous fix
  // changed its colours and left it in the flex parent, so the same bug
  // survived a rewrite. Only confSection, which really is a chip, stays.
  const tagRow = confSection
    ? `<div class="row" style="gap:12px;margin-top:12px;margin-bottom:14px">${confSection}</div>`
    : "";
  return `<div class="page-head">
  <div class="zone-label">${escapeHtml(label)}</div>
  ${warningTag}
  ${tagRow}
  <h1>${escapeHtml(pieceTitle(piece))}</h1>
  ${piece.subtitle ? `<p class="ph-sub" style="font-style:italic">${escapeHtml(piece.subtitle)}</p>` : ""}
  ${dateLine}
</div>`;
}

// The sticky rail: what this document is, when it was published, and the two
// ways to take it away with you.
function renderDocRail(piece: PieceDetail): string {
  const wordCount = (piece.body_md ?? "").split(/\s+/).filter(Boolean).length;
  const published = piece.published_at ?? piece.created_at;
  const updated = piece.updated_at;
  const sameDay = published.slice(0, 10) === updated.slice(0, 10);
  const rows: Array<[string, string]> = [
    ["Kind", kindLabel(piece.kind)],
    ["Words", wordCount >= 1000 ? `${(wordCount / 1000).toFixed(1)}k` : String(wordCount)],
    ["Published", formatDate(published)],
    ...(sameDay ? [] : ([["Updated", formatDate(updated)]] as Array<[string, string]>)),
    ["License", "CC BY 4.0"],
  ];
  const md = `/p/${escapeAttr(piece.slug)}.md`;
  return `<aside class="docrail">
  <dl style="margin:0">
${rows
  .map(
    ([k, v]) =>
      `    <div class="docrail-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`,
  )
  .join("\n")}
  </dl>
  <div class="docrail-actions">
    <a class="docrail-btn primary" href="${md}">Read as markdown</a>
    <a class="docrail-btn" href="${md}" download>Download .md</a>
  </div>
</aside>`;
}

// APA and BibTeX, generated from the same helpers the markdown twin and the
// JSON-LD use, so a reader who copies a citation from the page and a machine
// that reads it from the structured data get identical strings.
function renderCiteBox(piece: PieceDetail): string {
  return `<div class="citebox">
  <div class="citebox-k">Cite this</div>
  <pre>${escapeHtml(citeApa(piece))}</pre>
  <pre>${escapeHtml(citeBibtex(piece))}</pre>
</div>`;
}

function renderDepositNote(piece: PieceDetail, topics: PieceCtx["topics"]): string {
  if (topics.length === 0 && !isEditorialKind(piece.kind)) return "";
  // "Signed" was the graph era's word for an operator-approved reading. An
  // uploaded essay or document isn't signed by anyone, so saying so was a
  // claim the system could no longer back.
  const lead =
    piece.kind === "essay"
      ? "This is an essay — an argument, not primary evidence"
      : piece.kind === "documented-record"
        ? "This is a documented record; the source log below carries every external reference inline"
        : "This is a research document, published as itself; its sources are named in the text";
  const topicLinks = topics
    .map(
      (t) =>
        `<a href="/topics/${escapeAttr(t.slug)}" style="color:var(--accent)">${escapeHtml(t.label)}</a>`,
    )
    .join(", ");
  const topicSentence = topicLinks
    ? ` Filed under ${topicLinks}. Its claims feed the record — each one still pointing outward to the external sources named in the piece.`
    : "";
  return `<div class="piece-note">
  <span class="dr-h">Where this came from</span>
  <p>${escapeHtml(lead)}.${topicSentence ? topicSentence : ""} The piece argues; the sources carry the proof.</p>
</div>`;
}

function renderOnward(piece: PieceDetail, ctx: PieceCtx): string {
  const pills: string[] = [];
  for (const t of ctx.topics) {
    pills.push(
      `<a href="/topics/${escapeAttr(t.slug)}" class="conn-pill">Topic: ${escapeHtml(t.label)}</a>`,
    );
  }
  for (const r of ctx.related.slice(0, 4)) {
    if (r.slug === piece.slug) continue;
    pills.push(`<a href="/p/${escapeAttr(r.slug)}" class="conn-pill">${escapeHtml(r.title)}</a>`);
  }
  if (pills.length === 0) return "";
  return `<div class="onward">
  <div class="ow-h">Related documents</div>
  <div class="conn-inline" style="gap:8px">${pills.join("")}</div>
</div>`;
}

// ---- readings and lineage ----------------------------------------------------

/**
 * The operator's notes, each anchored to a passage that carries its own /q/
 * receipt. Placed after the body as one block rather than spliced into the
 * prose: the passage is linked, the reader can follow it, and nothing in the
 * document's own text is rewritten to make room.
 */
function renderReadings(ctx: PieceCtx): string {
  const readings = ctx.readings ?? [];
  if (readings.length === 0) return "";
  const items = readings
    .map(
      (r) => `<div class="reading-note" id="reading-${escapeAttr(r.id)}">
  <blockquote><a href="/q/${escapeAttr(r.quote_id)}">${escapeHtml(r.verbatim_text)}</a></blockquote>
  <div class="note-body prose">${renderMarkdown(r.note_md, { anchors: false })}</div>
  <div class="note-sig">— the operator, ${escapeHtml(formatDate(r.created_at))}${
    ctx.isOperator
      ? `<form method="post" action="/op/readings/${escapeAttr(r.id)}/delete"><button type="submit">delete</button></form><form method="post" action="/op/readings/${escapeAttr(r.id)}/draft-essay"><button type="submit">draft an essay from this</button></form>`
      : ""
  }</div>
</div>`,
    )
    .join("\n");
  return `<section class="readings" id="readings">
  <div class="ow-h">Readings</div>
${items}
</section>`;
}

/**
 * The form "Note this" fills. Server-rendered and hidden; /op/notes.js reveals
 * it with the selected passage in place. Operator only — an anonymous reader
 * never sees a form that posts to a route Cloudflare Access would refuse.
 */
function renderNoteForm(piece: PieceDetail, ctx: PieceCtx): string {
  if (!ctx.isOperator) return "";
  return `<form class="note-form" id="note-form" method="post" action="/op/readings" hidden>
  <input type="hidden" name="piece_id" value="${escapeAttr(piece.id)}">
  <label class="coord">Passage (verbatim)</label>
  <textarea name="passage" rows="3" readonly></textarea>
  <label class="coord">Note</label>
  <textarea name="note" rows="4" required></textarea>
  <div class="note-status"></div>
  <div class="row" style="gap:12px"><button type="submit">Save reading</button><button type="button" class="note-cancel">Cancel</button></div>
</form>`;
}

const LEAD_LABEL: Record<string, string> = {
  contradiction: "Contradiction",
  "unsourced-figure": "Unsourced figure",
  bridge: "Bridge",
  reading: "Reading",
};

/**
 * The operator's action bar (docs/the-record.md §6): this document's own
 * leads with the same dig form /library uses, and a free question box. Both
 * post to /op/leads/dig carrying piece_id, so the brief a run produces is
 * this document's child (§5). "Research this" (notes-live.ts) prefills the
 * question box from a selection — no new route.
 */
function renderActionBar(piece: PieceDetail, ctx: PieceCtx): string {
  if (!ctx.isOperator) return "";
  const hidden = (name: string, value: string) =>
    `<input type="hidden" name="${name}" value="${escapeAttr(value)}">`;
  const items = (ctx.leads ?? [])
    .map((l) => {
      const verb = l.kind === "contradiction" ? "Settle this" : "Dig here";
      const other =
        l.other_piece_slug && l.other_piece_slug !== piece.slug
          ? ` <a href="/p/${escapeAttr(l.other_piece_slug)}">${escapeHtml(l.other_piece_title ?? "the other document")}</a>`
          : "";
      const receipt = l.quote_id ? ` <a href="/q/${escapeAttr(l.quote_id)}">quote ↗</a>` : "";
      const dig = l.seed
        ? `<form method="post" action="/op/leads/dig" class="lead-dig-form">${hidden("seed", l.seed)}${hidden("angle", l.angle)}${hidden("kind", l.kind)}${hidden("piece_id", l.piece_id)}${hidden("piece_slug", l.piece_slug ?? "")}${hidden("other_slug", l.other_piece_slug ?? "")}<button type="submit" class="lead-dig">${verb} →</button></form>`
        : "";
      return `<li class="lead lead-${escapeAttr(l.kind)}"><span class="lead-k">${escapeHtml(LEAD_LABEL[l.kind] ?? l.kind)}</span> <span class="lead-sum">${escapeHtml(l.summary)}</span>${other}${receipt} ${dig}</li>`;
    })
    .join("");
  return `<section class="op-bar" id="op-bar">
  <div class="ow-h">This document's leads</div>
  ${items ? `<ul>${items}</ul>` : `<p class="note">Nothing yet — leads appear once the pipeline has processed this document.</p>`}
  <form method="post" action="/op/leads/dig" class="op-ask" id="op-ask">
    ${hidden("kind", "question")}${hidden("piece_id", piece.id)}${hidden("piece_slug", piece.slug)}
    <input type="text" name="seed" placeholder="Ask the record a question — the brief becomes this document's child" required>
    <button type="submit" class="lead-dig">Research →</button>
  </form>
</section>`;
}

/** "Grew from" and "Grew into" (docs/the-record.md §5). Empty renders nothing. */
function renderLineage(lineage: Lineage | undefined): string {
  if (!lineage || (!lineage.parent && lineage.children.length === 0)) return "";
  const ref = (r: { slug: string; title: string; origin: string | null }) =>
    `<li><a href="/p/${escapeAttr(r.slug)}">${escapeHtml(r.title)}</a>${
      r.origin ? `<span class="origin">${escapeHtml(r.origin)}</span>` : ""
    }</li>`;
  const from = lineage.parent
    ? `<div class="ow-h">Grew from</div><ul>${ref(lineage.parent)}</ul>`
    : "";
  const into = lineage.children.length
    ? `<div class="ow-h">Grew into</div><ul>${lineage.children.map(ref).join("")}</ul>`
    : "";
  return `<section class="lineage" id="lineage">
${from}
${into}
</section>`;
}

// ---- per-kind body -----------------------------------------------------

function renderBodyForKind(
  piece: PieceDetail,
  sections: ParsedSections,
  _ctx: PieceCtx,
  bodyMd: string,
): string {
  switch (piece.kind) {
    case "essay":
      // The essay path parses body_md itself rather than using `sections`,
      // so it needs the spliced copy handed to it explicitly — otherwise an
      // essay would be the one kind that silently never showed a receipt.
      //
      // A tetrad (docs/the-record.md §1b) is filed as an essay — the
      // classifier marks it `metadata.classification = "tetrad"` — but its
      // shape is four quadrants, not a run of questions. The parse is the
      // test: if the body has the four headings it renders as the grid, and
      // if it has been edited out of that shape it falls back to the essay
      // layout rather than to a broken grid.
      return renderTetradBody(parseTetrad(bodyMd)) ?? renderEssayBody(bodyMd);
    case "research-report":
    case "brief":
      return renderResearchReportBody(piece, sections);
    case "documented-record":
      return renderDocumentedRecordBody(piece, sections);
    default:
      return renderProseBody(piece, sections);
  }
}

// An essay renders from its own structure (lib/essay.ts), not from the
// heading-matching used for research reports: the summary becomes the
// answer-first block, each `##` becomes an anchored, self-linking section,
// and the jump list is generated from those same anchors. The anchors are
// also the URLs this page's Q&A structured data points at, so a quoted
// answer links to the exact passage it came from.
function renderEssayBody(bodyMd: string): string {
  const essay = parseEssay(bodyMd);
  if (!essay.sections.length && !essay.summary) {
    return `<section class="prose" style="margin:24px 0 0"><em style="color:var(--ink-mute)">This essay has no body yet.</em></section>`;
  }

  const tldr = essay.summary
    ? `<div class="tldr">
  <div class="tldr-k">In one paragraph</div>
  <p>${escapeHtml(essay.summary)}</p>
</div>`
    : "";

  const toc = essay.sections.length
    ? `<nav class="toc" aria-label="Sections">
  <div class="toc-k">In this essay</div>
  <ol>
${essay.sections
  .map((s) => `    <li><a href="#${s.anchor}">${escapeHtml(s.heading)}</a></li>`)
  .join("\n")}
  </ol>
</nav>`
    : "";

  const body = essay.sections
    .map(
      (s) => `<section id="${s.anchor}">
  <h2><a href="#${s.anchor}" class="anchor-link">${escapeHtml(s.heading)}</a></h2>
  ${s.paragraphs
    .map((p, i) => `<p${i === 0 ? ' class="lead"' : ""}>${renderEssayInline(p)}</p>`)
    .join("\n  ")}
</section>`,
    )
    .join("\n");

  const sources = essay.sources.length
    ? `<section class="essay-sources">
  <h2>Sources</h2>
  <ol>
${essay.sources.map((s, i) => `    <li id="src-${i + 1}">${renderInline(s)}</li>`).join("\n")}
  </ol>
</section>`
    : "";

  return `<div class="essay-body">
${tldr}
${toc}
${body}
${sources}
</div>`;
}

// The tetrad: four quadrants in a 2×2 grid, after the intro and before any
// sources. Each cell is anchored by its quadrant name, which is also what the
// page's `hasPart` structured data points at. No Q&A layout, no FAQ — a
// tetrad's headings are labels, not questions. The grid is inline CSS so the
// stylesheet gains no rule for one page shape; auto-fit collapses it to one
// column at phone width.
function renderTetradBody(t: ParsedTetrad | null): string | null {
  if (!t) return null;
  const intro = t.intro.length
    ? `<div class="tldr">
  <div class="tldr-k">In one paragraph</div>
  ${t.intro.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n  ")}
</div>`
    : "";
  const cells = TETRAD_QUADRANTS.map(
    (
      q,
    ) => `  <div class="tetrad-cell" id="${q}" style="border:1px solid var(--rule);border-radius:var(--r);padding:var(--s-4) var(--s-5);background:var(--paper-2)">
    <h2 style="font-family:var(--mono);font-size:var(--t-3);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-mute);margin:0 0 var(--s-3)"><a href="#${q}" class="anchor-link">${escapeHtml(TETRAD_LABELS[q])}</a></h2>
    ${
      t.quadrants[q]
        ? renderMarkdown(t.quadrants[q], { headingBase: 3, anchors: false })
        : `<p><em style="color:var(--ink-mute)">Nothing written here yet.</em></p>`
    }
  </div>`,
  ).join("\n");
  const sources = t.sources.length
    ? `<section class="essay-sources">
  <h2>Sources</h2>
  <ol>
${t.sources.map((s, i) => `    <li id="src-${i + 1}">${renderInline(s)}</li>`).join("\n")}
  </ol>
</section>`
    : "";
  return `<div class="essay-body">
${intro}
<section class="tetrad" aria-label="Tetrad" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--s-5);margin:0 0 var(--s-6)">
${cells}
</section>
${sources}
</div>`;
}

// Essay prose: the existing inline markdown pass, plus the one thing the
// essay convention adds — a bare [n] is a reference to the nth entry in the
// Sources block, and becomes a superscript link to it.
function renderEssayInline(md: string): string {
  return renderInline(md).replace(/\[(\d+)\]/g, '<sup><a href="#src-$1">$1</a></sup>');
}

function renderResearchReportBody(piece: PieceDetail, sections: ParsedSections): string {
  const tldr = sections.matched("short version", "tldr", "tl;dr", "the short version", "summary");
  const findings = sections.matched("key findings", "findings");
  const caveats = sections.matched("caveats", "caveats & confidence", "limitations");

  const tldrHtml = tldr
    ? `<div class="rr-tldr">
  <div class="rr-h">The short version</div>
  ${renderBulletList(tldr.content)}
</div>`
    : "";

  const findingsHtml = findings
    ? `<section style="max-width:880px;margin:14px 0 0">
  <div class="label" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:18px">Key findings <span class="faint">· ${findings.children.length || countListItems(findings.content)}</span></div>
  ${renderNumberedFindings(findings)}
</section>`
    : "";

  const caveatsHtml = caveats
    ? `<section style="max-width:880px;margin:30px 0 0">
  <div class="label" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:14px">Caveats &amp; confidence</div>
  <ul class="rr-caveats">${listItems(caveats.content)
    .map((l) => `<li>${renderInline(l)}</li>`)
    .join("")}</ul>
</section>`
    : "";

  // Render the remainder (any sections not used above + the leading prose
  // before the first H2) as a prose block.
  const used = new Set<string>();
  if (tldr) used.add(tldr.key);
  if (findings) used.add(findings.key);
  if (caveats) used.add(caveats.key);
  const remainder = sections.remainder(used);
  const proseHtml = remainder
    ? `<section style="max-width:880px;margin:30px 0 0"><div class="prose">${renderMarkdown(remainder)}</div></section>`
    : "";

  // If NO sections matched, the piece is unstructured — fall back cleanly
  // to a single prose block so the page still reads.
  if (!tldr && !findings && !caveats) {
    return renderProseBody(piece, sections);
  }
  return tldrHtml + findingsHtml + caveatsHtml + proseHtml;
}

function renderDocumentedRecordBody(piece: PieceDetail, sections: ParsedSections): string {
  const isThis = sections.matched("what this is", "this is");
  const isNot = sections.matched("what this is not", "this is not");
  const sourceLog = sections.matched("source log", "sources");

  let frame = "";
  if (isThis || isNot) {
    frame = `<div class="dr-frame">
  ${
    isThis
      ? `<div class="dr-is"><div class="dr-h">What this is</div><ul>${listItems(isThis.content)
          .map((l) => `<li>${renderInline(l)}</li>`)
          .join("")}</ul></div>`
      : ""
  }
  ${
    isNot
      ? `<div class="dr-isnot"><div class="dr-h">What this is not</div><ul>${listItems(
          isNot.content,
        )
          .map((l) => `<li>${renderInline(l)}</li>`)
          .join("")}</ul></div>`
      : ""
  }
</div>`;
  }

  const log = sourceLog
    ? `<section style="max-width:880px;margin:36px 0">
  <div class="label" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:6px">Source log</div>
  <p class="prose" style="font-size:15px;color:var(--ink-3);margin:10px 0 14px">Every claim above rests on one of these. External sources only — the record never cites itself.</p>
  <div class="srclog">${renderSourceLog(sourceLog.content)}</div>
</section>`
    : "";

  const used = new Set<string>();
  if (isThis) used.add(isThis.key);
  if (isNot) used.add(isNot.key);
  if (sourceLog) used.add(sourceLog.key);
  const remainder = sections.remainder(used);
  const proseHtml = remainder
    ? `<div class="prose" style="max-width:880px;margin-top:24px">${renderMarkdown(remainder)}</div>`
    : "";

  if (!isThis && !isNot && !sourceLog) {
    return renderProseBody(piece, sections);
  }
  return frame + proseHtml + log;
}

function renderProseBody(_piece: PieceDetail, sections: ParsedSections): string {
  // Render the whole body as prose, regardless of sectioning.
  const all = sections.fullMarkdown();
  if (!all.trim()) {
    return `<section style="max-width:880px;margin:24px 0 0"><div class="prose" style="color:var(--ink-mute)"><em>This piece has no body yet. Edit it in <a href="/op/editorial" style="color:var(--accent)">Editorial</a>.</em></div></section>`;
  }
  return `<section style="max-width:880px;margin:24px 0 0">${renderStructured(all)}</section>`;
}

/**
 * STRUCTURE FIRST, THEN THE DOCUMENT.
 *
 * A 3.3k-word dossier opening on paragraph one is, in the operator's words,
 * "absolutely insane to comb through if you aren't a machine". The answer is
 * not to summarise it — standing rules forbid summarising a research document
 * away, and it would be the wrong instinct anyway, because the document
 * already distilled itself. The live PASS 7 dossier carries nine sections, a
 * sixteen-row table of hardened facts, and its own DOCUMENTARY GAPS REMAINING.
 * All of it was a thousand words down.
 *
 * So the page opens with what the document wrote about itself, and the
 * document follows underneath, entire.
 *
 * The lead table is MOVED rather than copied — rule 3, nothing written twice —
 * and the `.md` twin stays byte-exact, so "published as itself" holds where it
 * does the most work: the machine-readable artifact is the document, the HTML
 * page is a reading of it.
 */
function renderStructured(bodyMd: string): string {
  const doc = documentStructure(bodyMd);

  // Below four sections a rail is clutter — the page is already scannable.
  const contents =
    doc.contents.length >= 4
      ? `<nav class="doc-toc" aria-label="Sections">
  <div class="doc-toc-k">In this document</div>
  <ol>
${doc.contents
  .filter((c) => c.level <= 3)
  .map((c) => `    <li><a href="#${escapeAttr(c.anchor)}">${escapeHtml(c.text)}</a></li>`)
  .join("\n")}
  </ol>
</nav>`
      : "";

  // The document's own summary, promoted. Labelled as the document's, because
  // a reader should never have to wonder whether a page wrote this itself.
  const lead = doc.leadTable
    ? `<section class="doc-lead">
  <div class="doc-lead-k">${escapeHtml(doc.leadTableHeading ?? "What this document establishes")}</div>
  <p class="doc-lead-note">The document's own summary, moved to the top. Nothing here is written by this site.</p>
  <div class="prose">${renderMarkdown(doc.leadTable, { anchors: false })}</div>
</section>`
    : "";

  // What the document says it could NOT establish. On a publication whose
  // whole argument is provenance, this is the most valuable block on the page,
  // and it was at the bottom. Left in place in the body as well: it is short,
  // and cutting a section out of the argument it belongs to would change the
  // document rather than reorder it.
  const gaps = doc.gaps
    ? `<section class="doc-gaps">
  <div class="doc-gaps-k">${escapeHtml(doc.gapsHeading ?? "What this document could not establish")}</div>
  <div class="prose">${renderMarkdown(doc.gaps, { anchors: false })}</div>
</section>`
    : "";

  return `${lead}${gaps}${contents}<div class="prose">${renderMarkdown(doc.remainder)}</div>`;
}

// ---- section parser ----------------------------------------------------

interface Section {
  key: string;
  heading: string;
  content: string;
  children: Array<{ heading: string; body: string }>;
}

interface ParsedSections {
  preamble: string;
  sections: Section[];
  matched(...candidates: string[]): Section | null;
  remainder(used: Set<string>): string;
  fullMarkdown(): string;
}

function parseSections(body_md: string): ParsedSections {
  const lines = body_md.split("\n");
  let preamble = "";
  const sections: Section[] = [];
  let current: Section | null = null;
  let currentChild: { heading: string; body: string } | null = null;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h2) {
      if (currentChild && current) current.children.push(currentChild);
      currentChild = null;
      if (current) sections.push(current);
      const heading = h2[1] ?? "";
      current = {
        key: normalize(heading),
        heading,
        content: "",
        children: [],
      };
      continue;
    }
    if (h3 && current) {
      if (currentChild) current.children.push(currentChild);
      currentChild = { heading: h3[1] ?? "", body: "" };
      continue;
    }
    if (currentChild) {
      currentChild.body += `${line}\n`;
    } else if (current) {
      current.content += `${line}\n`;
    } else {
      preamble += `${line}\n`;
    }
  }
  if (currentChild && current) current.children.push(currentChild);
  if (current) sections.push(current);

  return {
    preamble,
    sections,
    matched(...candidates: string[]): Section | null {
      const set = new Set(candidates.map((c) => normalize(c)));
      for (const s of sections) {
        if (set.has(s.key)) return s;
      }
      return null;
    },
    remainder(used: Set<string>): string {
      const parts: string[] = [];
      if (preamble.trim()) parts.push(preamble);
      for (const s of sections) {
        if (used.has(s.key)) continue;
        parts.push(`## ${s.heading}\n${s.content}`);
        for (const c of s.children) {
          parts.push(`### ${c.heading}\n${c.body}`);
        }
      }
      return parts.join("\n").trim();
    },
    fullMarkdown(): string {
      const parts: string[] = [];
      if (preamble.trim()) parts.push(preamble);
      for (const s of sections) {
        parts.push(`## ${s.heading}\n${s.content}`);
        for (const c of s.children) {
          parts.push(`### ${c.heading}\n${c.body}`);
        }
      }
      return parts.join("\n").trim();
    },
  };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// ---- helpers -----------------------------------------------------------

function renderNumberedFindings(section: Section): string {
  // Prefer H3 children if they exist (heading + body).
  if (section.children.length > 0) {
    return section.children
      .map(
        (c, i) => `<div class="rr-finding">
  <div class="rr-fn">${String(i + 1).padStart(2, "0")}</div>
  <div class="rr-fbody">
    <h3 class="rr-fh">${escapeHtml(c.heading)}</h3>
    <p class="rr-ft">${renderInline(c.body.trim())}</p>
  </div>
</div>`,
      )
      .join("");
  }
  // Fall back to top-level list items as findings (less structured but valid).
  const items = listItems(section.content);
  if (items.length === 0) {
    return `<div class="prose">${renderMarkdown(section.content)}</div>`;
  }
  return items
    .map(
      (text, i) => `<div class="rr-finding">
  <div class="rr-fn">${String(i + 1).padStart(2, "0")}</div>
  <div class="rr-fbody"><p class="rr-ft">${renderInline(text)}</p></div>
</div>`,
    )
    .join("");
}

function renderBulletList(md: string): string {
  const items = listItems(md);
  if (items.length === 0) {
    return `<div class="prose" style="font-size:15px">${renderMarkdown(md)}</div>`;
  }
  return `<ul>${items.map((l) => `<li>${renderInline(l)}</li>`).join("")}</ul>`;
}

function listItems(md: string): string[] {
  const lines = md.split("\n");
  const items: string[] = [];
  let current = "";
  for (const line of lines) {
    const m = line.match(/^[-*]\s+(.+)$/);
    if (m) {
      if (current) items.push(current.trim());
      current = m[1] ?? "";
    } else if (current && /^\s+\S/.test(line)) {
      current += ` ${line.trim()}`;
    } else if (current && line.trim() === "") {
      items.push(current.trim());
      current = "";
    }
  }
  if (current) items.push(current.trim());
  return items.filter(Boolean);
}

function countListItems(md: string): number {
  return listItems(md).length;
}

function renderSourceLog(md: string): string {
  const items = listItems(md);
  if (items.length === 0) {
    // Fall back to whatever's there.
    return `<div class="prose">${renderMarkdown(md)}</div>`;
  }
  return items
    .map((line) => {
      // Heuristic split: "Title — Org · Date" or "Title - Org - Date"
      const parts = line.split(/\s+[—\-]\s+/).map((p) => p.trim());
      const title = parts[0] ?? line;
      const org = parts[1] ?? "";
      const date = parts[2] ?? "";
      return `<div class="srclog-row">
  <div class="srclog-main">
    <span class="srclog-title">${renderInline(title)}</span>
    <span class="srclog-meta">${[org, date]
      .filter(Boolean)
      .map((s) => escapeHtml(s))
      .join(" · ")}</span>
  </div>
  ${org ? `<span class="srclog-kind">source</span>` : ""}
</div>`;
    })
    .join("");
}

// Render Markdown inline (no <p> wrap). Used for list items + finding
// bodies where we want emphasis/links but not paragraph spacing.
function renderInline(md: string): string {
  return renderInlineMarkdown(md);
}

function confDots(level: string): string {
  const filled = level === "high" ? 5 : level === "low" ? 1 : 3;
  return `<span class="conf-dots">${Array.from({ length: 5 })
    .map((_, i) => `<span class="d${i < filled ? " on" : ""}"></span>`)
    .join("")}</span>`;
}

function readingTime(md: string): string {
  const words = md.split(/\s+/).filter(Boolean).length;
  if (words < 50) return "";
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

// Was hardcoded to always return "medium" regardless of the piece — a
// fabricated confidence badge on every editorial piece, autonomous or
// not. The pieces table genuinely doesn't carry a real confidence value
// yet (no lighthouse-style judgment stored anywhere per-piece), so the
// honest fix is to not claim one: no confidence badge at all until
// there's a real value to show, rather than making one up.
function readConfidence(_piece: PieceDetail): string | null {
  return null;
}

// A piece written and published entirely by graph/lib/deep-research.ts's
// synthesizeDueBeatReport, with no operator ever reading it before it
// went live — tagged at creation time (see deep-research.ts). These
// still get the SAME extraction/firewall treatment as anything uploaded
// (every claim is a verbatim quote), but nobody signed off on the
// synthesis itself, so the page must not claim otherwise.
function isAutoGenerated(piece: PieceDetail): boolean {
  try {
    const tags = JSON.parse(piece.tags || "[]") as unknown;
    return Array.isArray(tags) && tags.includes("auto-research");
  } catch {
    return false;
  }
}

function isEditorialKind(kind: string): boolean {
  return ["essay", "research-report", "documented-record", "thesis", "synthesis", "brief"].includes(
    kind,
  );
}

function kindLabel(kind: string): string {
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

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}
