// Layout — the outer HTML shell for every public page.
// Pure string concatenation; no JSX, no templating library.
//
// THE RECORD shell (approved product design, design/the-record-mockup.html):
// one dark register for everyone — the brand is the instrument. Nav is three
// doors + the search affordance. The words on every public surface follow
// the plain-words rule (docs/site-design.md): no internal vocabulary, every
// term self-explanatory to a first-time reader.
//
// Strict no-JS contract: nothing here requires JavaScript to read.

import { stylesHash } from "./styles";

export interface NavItem {
  href: string;
  label: string;
}

// Three doors. The Record (home IS the front of the record), the signed
// Investigations, and Method (how verification works — absorbs About).
// Everything else is reached by walking the web, not by nav.
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Record" },
  { href: "/investigations", label: "Investigations" },
  { href: "/method", label: "Method" },
];

export interface RenderPageArgs {
  title: string;
  description?: string;
  body: string;
  /** Matching href to highlight in the nav, e.g. "/investigations" */
  activeNav?: string;
  /** "public" (default) or "operator" — same register now; kept for
   *  operator-screen markup compatibility. */
  mode?: "public" | "operator";
  zone?: string;
  canonical?: string;
  /** Record-design pages manage their own section widths (.hero/.sec/…)
   *  and render bare. Legacy renderers (not yet rebuilt) keep the old
   *  .container wrapper by default. */
  bare?: boolean;
}

export function renderPage(args: RenderPageArgs): string {
  const fullTitle = args.title
    ? `${escapeHtml(args.title)} — CANOPTICON`
    : "CANOPTICON — The standing record";
  const description = escapeHtml(
    args.description ??
      "CANOPTICON keeps files on power. Documented facts with their receipts, disputes shown as disputes, and signed analysis — every claim traceable to a stored source.",
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
${renderNav(args.activeNav)}
<main class="record-main">
${args.bare ? args.body : `<div class="container">${args.body}</div>`}
</main>
${mode === "public" ? renderTrustStrip() : ""}
${renderFooter()}
</body>
</html>`;
}

function renderNav(activeHref?: string): string {
  const items = PRIMARY_NAV.map((item) => {
    const isActive =
      item.href === "/"
        ? activeHref === "/"
        : activeHref === item.href || activeHref?.startsWith(`${item.href}/`);
    return `<a href="${escapeAttr(item.href)}"${isActive ? ` class="active"` : ""}>${escapeHtml(item.label)}</a>`;
  }).join("\n      ");
  return `<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="wordmark">CANOPTICON<span class="dot">·</span><span class="wordmark-sub">The standing record</span></a>
    <div class="nav-links">
      ${items}
      <a href="/search" class="nav-search"><span class="q">/</span> ask the record</a>
    </div>
  </div>
</nav>`;
}

// The trust strip — what makes this site honest, in plain words. Sits
// between the body and the footer on every public page.
function renderTrustStrip(): string {
  return `<aside class="trust" aria-label="How this site verifies">
  <div class="trust-inner">
    <span class="trust-mark" aria-hidden="true">✓</span>
    <p>
      Every documented fact on this site is backed by a word-for-word quote
      from a source document we have stored — checked by machine, not vouched
      for. Disputed claims are shown as disputed. Claims that fail
      verification are removed, and we say so.
      <a href="/method">How verification works →</a>
    </p>
  </div>
</aside>`;
}

function renderFooter(): string {
  return `<footer class="foot">
  <div class="foot-inner">
    <div>
      <a href="/" class="wordmark">CANOPTICON<span class="dot">·</span></a>
      <div class="coord" style="margin-top:8px">THE STANDING RECORD <span class="sep">·</span> canopticon.com <span class="sep">·</span> @canoptics</div>
    </div>
    <div class="foot-links">
      <a href="/">The Record</a>
      <a href="/investigations">Investigations</a>
      <a href="/method">Method</a>
      <a href="/search">Search</a>
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
