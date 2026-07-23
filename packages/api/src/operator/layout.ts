// Operator console shell.
//
// This used to be a six (then three)-destination console with its own nav
// rail. It isn't anymore: "one site, permission layers" (spec v2.5 Part 9)
// moved operating Canopticon onto the public site itself — the operator
// logs in and the same pages grow affordances (sign/discard, Extract
// buttons, the "operator" nav overlay in public/routes.ts) rather than
// visiting a separate dashboard. The IN/OUT/Studio rail items that used to
// live here all just redirected back to public pages before this file
// caught up to that reality — see CLAUDE.md's Surfaces section for what's
// actually still reachable under /op/* (a prototype page, per-project
// workspaces, and POST action endpoints). OP_NAV is empty on purpose now,
// not an oversight.
//
// Layout per the design bundle:
//   168px rail (collapses to 60px under 820px), top bar (52px), surface area
//   (.wrap max-width 760px, .wrap.wide 920px, padding 26px 26px 80px).
//
// CSS lives in operator-styles.ts (lifted verbatim from the design's
// Operator Console.html). This file emits the shell HTML + icon SVGs.
//
// Cloudflare Access gates every /op/* route at the edge, so these screens
// are only reachable by the operator — no auth UI here.

import { escapeAttr, escapeHtml } from "../public/layout";
import { OPERATOR_CSS } from "./operator-styles";

// Icon SVG body fragments ported verbatim from console-ui.jsx ICONS. Each
// fragment renders inside an <svg viewBox="0 0 16 16" fill="none" stroke=…>
// wrapper. The design's strokes are currentColor with stroke-width 1.4.
const ICONS: Record<string, string> = {
  feed: `<path d="M2 13L6.5 5l3 5.5L12 6l3 5.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  chat: `<path d="M2 3h12a1 1 0 011 1v7a1 1 0 01-1 1H9l-3 3v-3H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke-linejoin="round"/>`,
  synthesis: `<rect x="2.2" y="2.2" width="5.2" height="5.2" rx="1.2"/><rect x="9.6" y="2.2" width="5.2" height="5.2" rx="1.2"/><rect x="2.2" y="9.6" width="5.2" height="5.2" rx="1.2"/><rect x="9.6" y="9.6" width="5.2" height="5.2" rx="1.2"/>`,
  library: `<rect x="2" y="3" width="3" height="10" rx=".5"/><rect x="6.5" y="3" width="3" height="10" rx=".5"/><rect x="11" y="3" width="3" height="10" rx=".5"/>`,
  briefs: `<path d="M4 2h6l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M10 2v4h4"/><path d="M6 9h5M6 11.5h3" stroke-linecap="round"/>`,
  studio: `<path d="M4.5 3l9 5-9 5z" stroke-linejoin="round"/>`,
  search: `<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14" stroke-linecap="round"/>`,
  settings: `<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4" stroke-linecap="round"/>`,
  arrow: `<path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  external: `<path d="M6 3H3.5A1.5 1.5 0 002 4.5v8A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5V10"/><path d="M9.5 2.5H13.5V6.5M13 3L7.5 8.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  check: `<path d="M3.5 8.5l3 3 6-6.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  chev: `<path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>`,
  doc: `<path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M9 2v3h3" stroke-linejoin="round"/>`,
  spark: `<path d="M8 1.5l1.6 4.4 4.4 1.6-4.4 1.6L8 13.5l-1.6-4.4L2 7.5l4.4-1.6z" stroke-linejoin="round"/>`,
  upload: `<path d="M8 11V3.5M5 6l3-3 3 3" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 11.5v1.5a1 1 0 001 1h8a1 1 0 001-1v-1.5" stroke-linecap="round"/>`,
};

export function icon(name: string, opts: { className?: string; size?: number } = {}): string {
  const body = ICONS[name] ?? "";
  const cls = opts.className ? ` class="${escapeAttr(opts.className)}"` : "";
  const size = opts.size ?? 16;
  return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${body}</svg>`;
}

export interface OpNavItem {
  href: string;
  label: string;
  icon: string;
  /** When true, render a pulsing amber nub indicating new activity. */
  nub?: boolean;
}

// No destination list — see the header comment above. renderRail() still
// reads this (an empty array just renders no items), so a genuine console
// screen with its own nav destinations remains possible later without
// touching renderRail's shape again.
export const OP_NAV: OpNavItem[] = [];

export interface OpPageArgs {
  /** Top bar h1 — e.g. "Feed" */
  title: string;
  /** Top bar subtitle/coord — e.g. "drop research reports · digest into the graph" */
  sub?: string;
  /** Right-aligned controls in the top bar (raw HTML). */
  topbarActions?: string;
  /** Surface content (raw HTML, goes inside .wrap by default). */
  body: string;
  /** Matching href for the active nav item. Default: /op (Feed). */
  activeNav?: string;
  /** Which nav items should show the activity nub. */
  nubs?: string[];
  /** "narrow" (760px max-width, default) or "wide" (920px max-width). */
  width?: "narrow" | "wide";
  /** Optional client-JS module attached at the end of body. */
  clientScript?: string;
  /** Optional JSON bootstrap embedded as a <script type=application/json>. */
  bootstrap?: { id: string; data: unknown };
  /** When true, body is the full surface content (no .wrap auto-wrap). */
  fullBleed?: boolean;
}

export function renderOpPage(args: OpPageArgs): string {
  const active = args.activeNav ?? "/op";
  const nubs = new Set(args.nubs ?? []);
  const nav = renderRail(active, nubs);
  const bootstrap = args.bootstrap
    ? `<script type="application/json" id="${escapeAttr(args.bootstrap.id)}">${jsonForScript(args.bootstrap.data)}</script>`
    : "";
  const clientScript = args.clientScript
    ? `<script type="module" src="${escapeAttr(args.clientScript)}"></script>`
    : "";
  const wrapClass = args.width === "wide" ? "wrap wide" : "wrap";
  const surfaceInner = args.fullBleed ? args.body : `<div class="${wrapClass}">${args.body}</div>`;

  return `<!doctype html>
<html lang="en" data-mode="operator">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(args.title)} · Operator · Canopticon</title>
<meta name="robots" content="noindex" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="alternate icon" href="/favicon.ico" />
<style>${OPERATOR_CSS}</style>
</head>
<body>
<div class="app">
  ${nav}
  <div class="stage">
    <div class="topbar">
      <h1>${escapeHtml(args.title)}</h1>
      ${args.sub ? `<span class="sub">${escapeHtml(args.sub)}</span>` : ""}
      <span class="spacer"></span>
      ${args.topbarActions ?? ""}
    </div>
    <div class="surface">${surfaceInner}</div>
  </div>
</div>
${bootstrap}
${clientScript}
<script type="module" src="/op/cmdk.js"></script>
</body>
</html>`;
}

function renderRail(activeHref: string, nubs: Set<string>): string {
  const items = OP_NAV.map((item) => {
    const isActive =
      activeHref === item.href || (item.href !== "/op" && activeHref.startsWith(`${item.href}/`));
    const nubHtml = nubs.has(item.href) ? `<span class="nub"></span>` : "";
    return `<a class="rail-item${isActive ? " active" : ""}" href="${escapeAttr(item.href)}">
  ${icon(item.icon)}
  <span class="lbl">${escapeHtml(item.label)}</span>
  ${nubHtml}
</a>`;
  }).join("");

  // OP_NAV is empty on purpose (see header comment) — without something in
  // its place the rail reads as broken, not as "nothing to show here."
  // A status line costs nothing and answers the one real question an
  // empty rail raises: am I actually logged in as the operator right now?
  const statusLine =
    items.length > 0
      ? items
      : `<div class="rail-status"><span class="rail-status-dot"></span><span class="fl">Operating</span></div>`;

  return `<nav class="rail">
  <div class="rail-logo"><span class="word">canopticon</span><span class="dot">.</span></div>
  <div class="rail-nav">${statusLine}</div>
  <button class="rail-kbd" type="button" aria-label="Command palette (Cmd+K)">
    ${icon("search")}
    <span class="fl">Command</span>
    <span class="keys"><span class="kkey">⌘</span><span class="kkey">K</span></span>
  </button>
  <div class="rail-foot">
    <a class="rail-foot-item link" href="/" target="_blank" rel="noopener">
      ${icon("external")}
      <span class="fl">public site</span>
    </a>
  </div>
</nav>`;
}

// Helper: build a topbar lens toggle (Synthesis "Findings | Corpus"). The
// `links` shape is [{label, href, active}].
export function lensToggle(
  links: Array<{ label: string; href: string; active?: boolean }>,
): string {
  return `<div class="lens">
${links
  .map(
    (l) =>
      `<a class="${l.active ? "on" : ""}" href="${escapeAttr(l.href)}">${escapeHtml(l.label)}</a>`,
  )
  .join("")}
</div>`;
}

// Eyebrow (mono uppercase label).
export function eyebrow(text: string): string {
  return `<div class="eyebrow">${escapeHtml(text)}</div>`;
}

// Empty-state helper — used by surfaces with no content yet.
export function emptyState(args: {
  iconName?: string;
  title: string;
  body?: string;
  action?: { href: string; label: string };
}): string {
  return `<div class="studio-empty">
  ${args.iconName ? `<div class="se-ico">${icon(args.iconName)}</div>` : ""}
  <div class="se-1">${escapeHtml(args.title)}</div>
  ${args.body ? `<div class="se-2">${escapeHtml(args.body)}</div>` : ""}
  ${
    args.action
      ? `<a class="se-link" href="${escapeAttr(args.action.href)}">${escapeHtml(args.action.label)} →</a>`
      : ""
  }
</div>`;
}

function jsonForScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function opHtml(html: string, init: ResponseInit = {}): Response {
  return new Response(html, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}
