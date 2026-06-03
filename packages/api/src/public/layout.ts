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

export const PRIMARY_NAV: NavItem[] = [
  { href: "/topics", label: "Topics" },
  { href: "/investigations", label: "Investigations" },
  { href: "/record", label: "The Record" },
  { href: "/patterns", label: "Patterns" },
  { href: "/library", label: "Library" },
];

const FOOTER_EXPLORE: NavItem[] = [
  { href: "/topics", label: "Topics" },
  { href: "/investigations", label: "Investigations" },
  { href: "/record", label: "The Record" },
  { href: "/patterns", label: "Patterns" },
  { href: "/library", label: "Library" },
];

const FOOTER_ABOUT: NavItem[] = [
  { href: "/about", label: "How this works" },
  { href: "/sources", label: "Sources & corrections" },
  { href: "/methodology", label: "Methodology" },
  { href: "/feed", label: "Feed (RSS)" },
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
    : "CANOPTICON — the standing record";
  const description = escapeHtml(
    args.description ??
      "Sourced claims about Canadian power. Investigations, patterns, the record beneath the headlines.",
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
</head>
<body>
${renderTopStrip(mode)}
${renderPubNav(args.activeNav)}
<div class="app-shell" style="display:block">
<div><div class="container">
${args.body}
</div></div>
</div>
${renderFooter()}
</body>
</html>`;
}

function renderTopStrip(mode: "public" | "operator"): string {
  const opLink =
    mode === "public"
      ? `<a class="op-link" href="/op">operator console →</a>`
      : `<a class="op-link" href="/">public site →</a>`;
  return `<div class="top-strip">
<div class="ts-left">
  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent)"></span>
  <span>Canada · Federal</span>
  <span class="dim">·</span>
  <span>the standing record</span>
</div>
<div class="ts-right">${opLink}</div>
</div>`;
}

function renderPubNav(activeHref?: string): string {
  const items = PRIMARY_NAV.map((item) => {
    const isActive = activeHref === item.href || activeHref?.startsWith(`${item.href}/`);
    return `<a href="${escapeAttr(item.href)}" class="${isActive ? "active" : ""}">${escapeHtml(item.label)}</a>`;
  }).join("");
  return `<div class="pub-nav">
<a href="/" style="display:flex;align-items:center">
  <div class="wordmark">canopticon<span class="dot">.</span><span class="wordmark-sub">the standing record</span></div>
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
  <p class="muted" style="font-size:13px;margin-top:12px;line-height:1.55;font-family:var(--serif)">An invisible graph of sourced claims about power in Canada — projected outward as tight, citable pages and signed investigations. The facts are the commodity; the analysis is the moat.</p>
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
