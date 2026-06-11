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

  const body = renderPieceBody(piece, {
    topics: topics.map((t) => ({ slug: t.slug, label: t.label })),
    related: related.filter((r) => r.id !== piece.id).slice(0, 6),
    fed,
  });

  return renderPage({
    title: piece.title,
    description: piece.subtitle ?? `${piece.title} — a Canopticon piece.`,
    body,
    activeNav: isEditorialKind(piece.kind) ? "/investigations" : "/library",
    zone: isEditorialKind(piece.kind) ? "investigations" : "library",
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
  const kindClass = isEditorialKind(piece.kind) ? "container reading" : "container reading";

  return `<div class="${kindClass}">
${renderBreadcrumbs(piece)}
${renderPageHead(piece)}
${renderDownloadBar(piece)}
${renderBodyForKind(piece, sections, ctx)}
${renderWhatItFed(ctx.fed)}
${renderDepositNote(piece, ctx.topics)}
${renderOnward(piece, ctx)}
</div>`;
}

// ---- scaffolding -------------------------------------------------------

function renderBreadcrumbs(piece: PieceDetail): string {
  const editorial = isEditorialKind(piece.kind);
  const section = editorial
    ? { name: "Investigations", href: "/investigations" }
    : { name: "Library", href: "/library" };
  const id = piece.subtype ? piece.subtype.toUpperCase() : kindLabel(piece.kind);
  return `<div class="scope crumbs">
  <a href="/">Home</a>
  <span class="arr">›</span>
  <a href="${escapeAttr(section.href)}">${escapeHtml(section.name)}</a>
  <span class="arr">›</span>
  <span class="cur">${escapeHtml(id)}</span>
</div>`;
}

function renderPageHead(piece: PieceDetail): string {
  const label = kindLabel(piece.kind);
  const opinionLabel = isEditorialKind(piece.kind)
    ? piece.kind === "documented-record"
      ? "a documented record"
      : `signed ${label.toLowerCase()}`
    : "library entry";
  const confidence = readConfidence(piece);
  const confSection = isEditorialKind(piece.kind)
    ? `<span class="row" style="gap:7px">${confDots(confidence)}<span class="coord">${escapeHtml(confidence)} confidence</span></span>`
    : "";
  const reading = readingTime(piece.body_md ?? "");
  const dateBits = [
    piece.byline
      ? `<span class="sig" style="font-family:var(--serif);font-style:italic;color:var(--ink)">By ${escapeHtml(piece.byline)}</span>`
      : "",
    piece.published_at ? `<span>${escapeHtml(formatDate(piece.published_at))}</span>` : "",
    reading ? `<span>${escapeHtml(reading)}</span>` : "",
  ].filter(Boolean);
  const dateLine = dateBits.length
    ? `<div class="coord" style="margin-top:18px;gap:12px;flex-wrap:wrap">${dateBits.join('<span class="sep">·</span>')}</div>`
    : "";

  return `<div class="page-head">
  <div class="zone-label">${escapeHtml(label)}</div>
  <div class="row" style="gap:12px;margin-top:12px;margin-bottom:14px">
    <span class="opinion-tag">● ${escapeHtml(opinionLabel)}</span>
    ${confSection}
  </div>
  <h1>${escapeHtml(piece.title)}</h1>
  ${piece.subtitle ? `<p class="ph-sub" style="font-style:italic">${escapeHtml(piece.subtitle)}</p>` : ""}
  ${dateLine}
</div>`;
}

function renderDownloadBar(piece: PieceDetail): string {
  const wordCount = (piece.body_md ?? "").split(/\s+/).filter(Boolean).length;
  const meta =
    wordCount > 200 ? `<span class="dl-meta">${(wordCount / 1000).toFixed(1)}k words</span>` : "";
  return `<div class="dl-bar">
  <a class="dl-btn" href="/p/${escapeAttr(piece.slug)}.md" download>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>
    Download clean Markdown
    ${meta}
  </a>
  <span class="dl-pdf">The source of record · PDF on request, generated from this page so it never goes stale</span>
</div>`;
}

function renderDepositNote(piece: PieceDetail, topics: PieceCtx["topics"]): string {
  if (topics.length === 0 && !isEditorialKind(piece.kind)) return "";
  const lead =
    piece.kind === "essay"
      ? "This is a signed essay — interpretation, not primary evidence"
      : piece.kind === "documented-record"
        ? "This is a documented record; the source log below carries every external reference inline"
        : "This is a signed piece; its findings carry their sources inline, in the text";
  const topicLinks = topics
    .map(
      (t) =>
        `<a href="/topics/${escapeAttr(t.slug)}" style="color:var(--accent)">${escapeHtml(t.label)}</a>`,
    )
    .join(", ");
  const topicSentence = topicLinks
    ? ` Filed under ${topicLinks}. Reading it deposits its claims onto the corpus — each still pointing outward to the external sources named in the piece.`
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
    case "research-report":
    case "brief":
      return renderResearchReportBody(piece, sections);
    case "documented-record":
      return renderDocumentedRecordBody(piece, sections);
    default:
      return renderProseBody(piece, sections);
  }
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

function readConfidence(piece: PieceDetail): string {
  // The pieces table doesn't carry confidence today; default to medium.
  // When the lighthouse signs a piece with a confidence level, it'll be
  // stored on metadata or a dedicated column — plumb it through here.
  void piece;
  return "medium";
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
