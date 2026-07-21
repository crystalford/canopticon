// Layout — the outer HTML shell for every public page.
// Pure string concatenation; no JSX, no templating library.
//
// Uses the class system from the PROBE design build directly:
//   data-mode="public"     · the warm-paper theme (default)
//   data-mode="operator"   · the dark-instrument theme (for /op/*)
//   .top-strip · .pub-nav · .container · .pub-footer
// All defined in styles.ts (lifted verbatim from the design build's
// site/styles.css), so the Phase 1 shell renders polished immediately.
//
// Strict no-JS contract: nothing here requires JavaScript to read.

import { stylesHash } from "./styles";

export interface NavItem {
  href: string;
  label: string;
}

// Lean nav per canonical-spec v2.4 Part 18: Investigations (the signed
// front door) · Topics (the browsable doorway into the factual substrate) ·
// Library (the receipts) · About. "The Record" and "Patterns" are DISSOLVED
// as destinations — their pages stay addressable (unmarked substrate),
// reached via links, search, and citation rather than nav.
export const PRIMARY_NAV: NavItem[] = [
  { href: "/investigations", label: "Investigations" },
  { href: "/topics", label: "Topics" },
  { href: "/library", label: "Library" },
  { href: "/instruments", label: "Instruments" },
  { href: "/about", label: "About" },
];

const FOOTER_EXPLORE: NavItem[] = [
  { href: "/investigations", label: "Investigations" },
  { href: "/topics", label: "Topics" },
  { href: "/library", label: "Library" },
  { href: "/instruments", label: "Instruments" },
  { href: "/methodology", label: "Methodology" },
];

const FOOTER_ABOUT: NavItem[] = [
  { href: "/about", label: "How this works" },
  { href: "/methodology", label: "Methodology" },
  { href: "/library", label: "Source documents" },
];

export interface RenderPageArgs {
  title: string;
  description?: string;
  body: string;
  /** Matching href to highlight in the nav, e.g. "/topics" */
  activeNav?: string;
  /** "public" (default) or "operator" — picks the theme via data-mode */
  mode?: "public" | "operator";
  /** "topics" | "investigations" | "record" | "patterns" | "library" | "home" | "op" */
  zone?: string;
  canonical?: string;
}

export function renderPage(args: RenderPageArgs): string {
  const fullTitle = args.title
    ? `${escapeHtml(args.title)} — Canopticon`
    : "CANOPTICON — Forensic intelligence";
  const description = escapeHtml(
    args.description ??
      "Forensic intelligence. Sourced, structured, permanent. Mapping the architecture of systems and institutions through sourced claims and signed analysis.",
  );
  const mode = args.mode ?? "public";
  const zone = args.zone ?? "home";
  const cssHref = `/styles.css?v=${stylesHash()}`;
  const canonical = args.canonical ?? "";
  return `<!doctype html>
<html lang="en" data-mode="${mode}" data-zone="${escapeAttr(zone)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${fullTitle}</title>
<meta name="description" content="${description}" />
${canonical ? `<link rel="canonical" href="${escapeAttr(canonical)}" />` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400;1,6..72,500&display=swap" />
<link rel="stylesheet" href="${cssHref}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="alternate icon" href="/favicon.ico" />
</head>
<body>
${renderTopStrip(mode)}
${renderPubNav(args.activeNav)}
<div class="app-shell" style="display:block">
<div><div class="container">
${args.body}
</div></div>
</div>
${mode === "public" ? renderTrustStrip() : ""}
${renderFooter()}
</body>
</html>`;
}

// The trust strip — what makes this site honest, in two lines.
// Sits between the body and the footer on every public page. Plain
// language, no jargon. This is the firewall made legible to a reader
// who has never heard of "the firewall".
function renderTrustStrip(): string {
  return `<aside class="trust-strip" aria-label="How this site verifies">
  <div class="trust-inner">
    <div class="trust-line">
      <span class="trust-mark" aria-hidden="true">✓</span>
      <p>
        Every fact you read here is a verbatim quote from a real document we have stored.
        Contested claims are shown as contested. An attributed assertion is never silently rendered as a neutral fact.
        <a href="/methodology">How verification works →</a>
      </p>
    </div>
  </div>
</aside>`;
}

function renderTopStrip(mode: "public" | "operator"): string {
  // Operator drops to public via this strip; public viewers see no
  // mention of an "operator console" — that destination dissolved in
  // PR 1 (spec v2.5 Part 9 — one site, permission layers). The session
  // cookie reveals operator affordances inline on public pages; the
  // strip is just the live-mark.
  const right = mode === "operator" ? `<a class="op-link" href="/">public site →</a>` : "";
  return `<div class="top-strip">
<div class="ts-left">
  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent)"></span>
  <span>live · kept current</span>
</div>
<div class="ts-right">${right}</div>
</div>`;
}

function renderPubNav(activeHref?: string): string {
  const items = PRIMARY_NAV.map((item) => {
    const isActive = activeHref === item.href || activeHref?.startsWith(`${item.href}/`);
    return `<a href="${escapeAttr(item.href)}" class="${isActive ? "active" : ""}">${escapeHtml(item.label)}</a>`;
  }).join("");
  return `<div class="pub-nav">
<a href="/" style="display:flex;align-items:center">
  <div class="wordmark">canopticon<span class="dot">.</span><span class="wordmark-sub">forensic intelligence</span></div>
</a>
<div class="pub-nav-links">${items}</div>
<a href="/search" class="pub-nav-search">
  <span style="display:flex;align-items:center;gap:8px">Search the record</span>
  <kbd>/</kbd>
</a>
</div>`;
}

function renderFooter(): string {
  const explore = FOOTER_EXPLORE.map(
    (i) => `<a href="${escapeAttr(i.href)}">${escapeHtml(i.label)}</a>`,
  ).join("");
  const about = FOOTER_ABOUT.map(
    (i) => `<a href="${escapeAttr(i.href)}">${escapeHtml(i.label)}</a>`,
  ).join("");
  return `<footer class="pub-footer">
<div class="inner foot-cols">
<div style="max-width:340px">
  <div class="wordmark">canopticon<span class="dot">.</span></div>
  <p class="muted" style="font-size:13px;margin-top:12px;line-height:1.55;font-family:var(--serif)">CANOPTICON is a forensic intelligence system — mapping the architecture of systems and institutions through sourced claims, signed analysis, and a growing graph of verified connections. The facts are the foundation. The patterns are the point.</p>
</div>
<div>
  <div class="label" style="margin-bottom:12px">Explore</div>
  <div class="pub-footer-links" style="flex-direction:column;gap:9px">${explore}</div>
</div>
<div>
  <div class="label" style="margin-bottom:12px">About</div>
  <div class="pub-footer-links" style="flex-direction:column;gap:9px">${about}</div>
</div>
<div>
  <div class="label" style="margin-bottom:12px">This page</div>
  <div class="coord" style="flex-direction:column;align-items:flex-start;gap:6px">
    <span>Living URL · kept current</span>
    <span class="dim">Dated editions retained</span>
  </div>
</div>
</div>
</footer>`;
}

export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function htmlResponse(html: string, init: ResponseInit = {}): Response {
  return new Response(html, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}
