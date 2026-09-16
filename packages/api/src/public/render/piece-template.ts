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

import { renderMarkdown } from "../../cms/lib/render-post";
import { type FindingRow, findingsForPiece } from "../../graph/lib/aeo-extract";
import { type LedeRow, ledeForPiece } from "../../graph/lib/lede";
import { EDITOR, resolveByline, showsUpdate } from "../../lib/byline";
import { parseEssay } from "../../lib/essay";
import {
  type PieceDetail,
  type PieceSummary,
  type PublicEnv,
  getPieceBySlug,
  listInvestigations,
  resolveOperatorId,
  topicsForPiece,
} from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";
import {
  citeApa,
  citeBibtex,
  essayFaq,
  isEssay,
  pieceJsonLd,
  pieceMarkdownUrl,
  pieceTitle,
  pieceUrl,
} from "../machine";

/** Bylines that name the machinery rather than an author. Never rendered. */

// ---- public entry point -----------------------------------------------

export async function renderPiece(env: PublicEnv, slug: string): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;
  const piece = await getPieceBySlug(env.DB, userId, slug);
  if (!piece) return null;
  // Working-material chain passes are not publicly reachable (spec §2.6).
  if (piece.publication_status === "working-material") return null;

  const topics = await topicsForPiece(env.DB, userId, piece.id);
  const related = await listInvestigations(env.DB, userId);
  const fed = await loadWhatItFed(env, userId, piece.id);
  // Findings are the densest thing a research document produces and the only
  // primitive with strong evidence behind it. They live on the document's own
  // page — no new URL, so no thin-content exposure at all.
  const findings = await findingsForPiece(env.DB, userId, piece.id).catch(() => []);
  const lede = await ledeForPiece(env.DB, userId, piece.id).catch(() => null);

  const body = renderPieceBody(piece, {
    topics: topics.map((t) => ({ slug: t.slug, label: t.label })),
    related: related.filter((r) => r.id !== piece.id).slice(0, 6),
    fed,
    findings,
    lede,
  });

  // The piece page emitted no structured data at all, while subject pages and
  // every arrangement did — the page type the publication is actually made of
  // was the least machine-legible one on the site.
  const essay = isEssay(piece.kind);
  const faq = essay ? essayFaq(piece.body_md ?? "") : undefined;
  return renderPage({
    title: pieceTitle(piece),
    description: piece.subtitle ?? `${pieceTitle(piece)} — a Canopticon piece.`,
    body: `${body}\n${pieceJsonLd(piece, {
      ...(faq?.length ? { faq } : {}),
      // Only once approved — the structured data must not carry a passage the
      // page itself is not showing.
      ...(lede?.approved_at ? { lede: lede.verbatim_text } : {}),
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

// The figure, what it measures, when, who reported it, and the sentence it
// came from — with a link to that quote's own receipt. A statistic stated
// beside its named source and date is the single best-evidenced shape for
// being cited, and it is exactly what the verification layer already produces.
function renderFindings(findings: FindingRow[] | undefined): string {
  if (!findings?.length) return "";
  const rows = findings
    .map(
      (f) => `  <li class="finding">
    <div class="finding-head">
      <span class="finding-figure">${escapeHtml(f.figure)}</span>
      <span class="finding-measures">${escapeHtml(f.measures)}</span>
    </div>
    <div class="finding-meta">${[f.period, f.attributed_to]
      .filter(Boolean)
      .map((x) => escapeHtml(String(x)))
      .join(' <span class="sep">·</span> ')}</div>
    <blockquote class="finding-quote">${escapeHtml(f.verbatim_text)}</blockquote>
    <a class="finding-receipt" href="/q/${escapeAttr(f.quote_id)}">verified quote ↗</a>
  </li>`,
    )
    .join("\n");
  return `<section class="findings">
  <h2>What this document establishes</h2>
  <p class="note">Each figure below is quoted word-for-word from the document and
  checked against it by machine.</p>
  <ol class="finding-list">
${rows}
  </ol>
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
  const subjectLinks = fed.subjects.length
    ? ` → ${fed.subjects.map((s) => `<a href="/s/${escapeAttr(s.slug)}" class="ac">${escapeHtml(s.label)}</a>`).join(" · ")}`
    : "";
  return `<div class="piece-note" style="margin-top:30px">
  <span class="dr-h">This document fed the fabric</span>
  <p><b>${fed.facts}</b> fact${fed.facts === 1 ? "" : "s"} · <b>${fed.assertions}</b> assertion${fed.assertions === 1 ? "" : "s"}${fed.contested > 0 ? ` (${fed.contested} contested)` : ""}${subjectLinks}. Every one is a verbatim span; nothing was paraphrased into the graph.</p>
</div>`;
}

function renderPieceBody(piece: PieceDetail, ctx: PieceCtx): string {
  const sections = parseSections(piece.body_md ?? "");
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
  ${renderBodyForKind(piece, sections, ctx)}
</details>`
    : renderBodyForKind(piece, sections, ctx);

  // The rail sits OUTSIDE the reading card, not inside it. It was inside,
  // which meant 300px of sidebar came out of the document's own measure and
  // squeezed the prose to roughly 570px. The card now holds only the
  // document; the rail is a separate column beside it.
  return `<div class="container docpage">
<div class="docgrid">
  <article class="reading">
${renderBreadcrumbs(piece)}
${renderPageHead(piece)}
${renderLede(ctx.lede)}
${bodyBlock}
${renderFindings(ctx.findings)}
${renderCiteBox(piece)}
${renderWhatItFed(ctx.fed)}
${renderDepositNote(piece, ctx.topics)}
  </article>
${renderDocRail(piece)}
</div>
${renderOnward(piece, ctx)}
</div>
<style>
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

function renderBreadcrumbs(piece: PieceDetail): string {
  const section = isEssay(piece.kind)
    ? { name: "Essays", href: "/essays" }
    : { name: "Research", href: "/research" };
  // The last crumb was the kind ("essay"), which the eyebrow directly above
  // it already says. The title is what a breadcrumb is for.
  return `<div class="scope crumbs">
  <a href="/">Home</a>
  <span class="arr">›</span>
  <a href="${escapeAttr(section.href)}">${escapeHtml(section.name)}</a>
  <span class="arr">›</span>
  <span class="cur">${escapeHtml(pieceTitle(piece))}</span>
</div>`;
}

function renderPageHead(piece: PieceDetail): string {
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
  // What this used to say: "Unreviewed — written and published automatically.
  // No operator has read this."
  //
  // It was false — the operator directs, reads and publishes this work — and
  // it was the worst line on the page for the one thing this publication is
  // for. It sat above the H1 declaring the content both anonymous and
  // unreviewed, which is the exact profile the March 2026 core update hit
  // hardest (AI content farms lost 60-80% of traffic while sites publishing
  // original data gained 22% visibility).
  //
  // Deleting it outright would also have been wrong. Google does not penalise
  // AI content for being AI — across 600,000 pages the correlation between
  // AI share and ranking is about zero — but disclosure supports trust, which
  // is part of E-E-A-T, and the August 2026 EU rule expects it for
  // public-interest material. So the disclosure stays and becomes accurate:
  // a named editor, the review stated, and the mechanical verification that
  // is this site's actual claim to being believed.
  const warningTag = autoGenerated
    ? `<div class="provenance">Directed and reviewed by ${escapeHtml(EDITOR)}, who holds editorial responsibility. Drafted with AI assistance; every quote is checked verbatim against a stored source. <a href="/method">How this is verified →</a></div>`
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
  ].filter(Boolean);
  const dateLine = dateBits.length
    ? `<div class="coord" style="margin-top:18px;gap:12px;flex-wrap:wrap">${dateBits.join('<span class="sep">·</span>')}</div>`
    : "";

  const tagRow =
    warningTag || confSection
      ? `<div class="row" style="gap:12px;margin-top:12px;margin-bottom:14px">${warningTag}${confSection}</div>`
      : "";
  return `<div class="page-head">
  <div class="zone-label">${escapeHtml(label)}</div>
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
  <span class="dr-h">How this connects to the record</span>
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
  <div class="ow-h">Keep exploring</div>
  <div class="conn-inline" style="gap:8px">${pills.join("")}</div>
</div>`;
}

// ---- per-kind body -----------------------------------------------------

function renderBodyForKind(piece: PieceDetail, sections: ParsedSections, _ctx: PieceCtx): string {
  switch (piece.kind) {
    case "essay":
      return renderEssayBody(piece);
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
function renderEssayBody(piece: PieceDetail): string {
  const essay = parseEssay(piece.body_md ?? "");
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
  return `<section style="max-width:880px;margin:24px 0 0"><div class="prose">${renderMarkdown(all)}</div></section>`;
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
  let html = renderMarkdown(md);
  // Strip a single leading/trailing <p> for inline contexts.
  html = html.trim();
  html = html.replace(/^<p>/, "").replace(/<\/p>$/, "");
  return html;
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
