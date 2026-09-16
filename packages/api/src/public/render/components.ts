// Shared render components — small HTML-string builders reused across
// public surfaces. All use the design build's class system.

import type { EntitySummary, PatternSummary, PieceSummary } from "../data";
import { escapeAttr, escapeHtml } from "../layout";

// Map a piece kind to its design-system card-type class + label.
export function pieceTypeChip(kind: string, subtype: string | null): string {
  const label = subtype || kindLabel(kind);
  const cls = kindClass(kind);
  return `<div class="card-type ${cls}">${escapeHtml(label)}</div>`;
}

export function kindLabel(kind: string): string {
  switch (kind) {
    case "research-report":
      return "research report";
    case "documented-record":
      return "documented record";
    case "thesis":
      return "thesis";
    case "synthesis":
      return "synthesis";
    case "essay":
      return "essay";
    case "brief":
      return "brief";
    case "note":
      return "note";
    default:
      return kind;
  }
}

function kindClass(kind: string): string {
  switch (kind) {
    case "research-report":
      return "t-research-report";
    case "documented-record":
      return "t-research-report";
    case "thesis":
      return "t-thesis";
    case "synthesis":
      return "t-pattern";
    case "essay":
      return "t-essay";
    default:
      return "t-essay";
  }
}

export function pieceCard(p: PieceSummary, hrefBase = "/investigations"): string {
  const date = p.published_at ? formatDate(p.published_at) : "";
  const meta = [date, kindLabel(p.kind), p.byline ? `by ${p.byline}` : ""]
    .filter(Boolean)
    .map((m) => `<span>${escapeHtml(m)}</span>`)
    .join("");
  const sub = p.subtitle ? `<div class="card-dek">${escapeHtml(p.subtitle)}</div>` : "";
  return `<a class="cardlink" href="${hrefBase}/${escapeHtml(p.slug)}">
  ${pieceTypeChip(p.kind, p.subtype)}
  <div class="card-title">${escapeHtml(p.title)}</div>
  ${sub}
  <div class="card-meta">${meta}</div>
</a>`;
}

export function entityCard(e: EntitySummary): string {
  const kindText = e.current_role
    ? escapeHtml(e.current_role)
    : escapeHtml(entityKindLabel(e.kind ?? e.entity_type));
  const slug = e.public_slug ?? "";
  const inner = `${entityKindChip(e.kind ?? e.entity_type)}
  <div class="card-title" style="font-size:17px">${escapeHtml(e.canonical_name)}</div>
  <div class="card-dek">${kindText}</div>`;
  if (!slug) {
    return `<div class="cardlink" style="cursor:default">${inner}</div>`;
  }
  return `<a class="cardlink" href="/record/${escapeHtml(slug)}">${inner}</a>`;
}

function entityKindChip(kind: string): string {
  return `<div class="card-type t-entity">${escapeHtml(entityKindLabel(kind))}</div>`;
}

export function entityKindLabel(kind: string): string {
  switch (kind) {
    case "person":
      return "Person";
    case "org":
    case "organization":
    case "corporation":
      return "Organization";
    case "institution":
    case "department":
    case "office":
      return "Institution";
    case "concept":
    case "legislation":
      return "Concept";
    case "work":
      return "Work";
    case "event":
      return "Event";
    case "place":
    case "location":
      return "Place";
    default:
      return "Entity";
  }
}

export function patternCard(p: PatternSummary): string {
  const conf = p.confidence;
  const dek = firstSentence(p.statement_md);
  return `<a class="cardlink pattern-card ${escapeHtml(conf)}" href="/patterns/${escapeHtml(p.slug)}">
  <div class="card-type t-pattern">${escapeHtml(patternKindLabel(p.kind))}</div>
  <div class="card-title">${escapeHtml(p.title)}</div>
  <div class="card-dek">${escapeHtml(dek)}</div>
  <div class="card-meta">
    <span class="cg-dot ${escapeHtml(conf)}"></span>
    <span>${escapeHtml(conf)} confidence</span>
    ${p.signed_at ? `<span>signed ${escapeHtml(formatDate(p.signed_at))}</span>` : ""}
  </div>
</a>`;
}

function patternKindLabel(kind: string): string {
  switch (kind) {
    case "recurring-actor":
      return "Recurring actor";
    case "frame":
      return "Frame";
    case "contradiction":
      return "Contradiction";
    case "rules-for-thee":
      return "Structural pattern";
    case "measurement":
      return "Measurement";
    case "net-zero":
      return "Climate retreat";
    default:
      return "Pattern";
  }
}

/**
 * An empty section, with somewhere to go from it.
 *
 * `onward` is not decoration. A crawl of the site from the nav found exactly
 * one dead end — a link on the front page to a page that said "nothing here
 * yet" and offered no way forward. That is the shape of thing the operator
 * kept running into and having to report. An empty state that names the next
 * step is a signpost; one that does not is a full stop.
 */
export function emptyState(message: string, onward?: { href: string; label: string }): string {
  return `<div class="card soft" style="padding:28px;text-align:center;color:var(--ink-3)">
  <p style="font-family:var(--serif);font-size:15.5px;margin:0">${escapeHtml(message)}</p>
  ${
    onward
      ? `<p style="margin:12px 0 0"><a href="${escapeAttr(onward.href)}">${escapeHtml(onward.label)}</a></p>`
      : ""
  }
</div>`;
}

export function sectionHeader(label: string, allHref?: string, allLabel?: string): string {
  const right =
    allHref && allLabel
      ? `<a href="${escapeHtml(allHref)}" class="coord ac">${escapeHtml(allLabel)} →</a>`
      : "";
  return `<div class="row between" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:16px">
  <div class="label">${escapeHtml(label)}</div>
  ${right}
</div>`;
}

export function formatDate(iso: string): string {
  // Render ISO dates as YYYY-MM-DD, which the design build uses.
  return iso.slice(0, 10);
}

function firstSentence(md: string): string {
  const text = md.replace(/[#*_`>]/g, "").trim();
  const m = text.match(/^.*?[.!?](\s|$)/);
  const s = (m ? m[0] : text).trim();
  return s.length > 180 ? `${s.slice(0, 177)}…` : s;
}
