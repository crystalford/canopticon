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

// Three doors, because there are three things: the essays, the research, and
// an explanation of what this is.
//
// It was five — Record, Investigations, Watchlist, Videos, Method — and four
// of those led to surfaces built for a version of this project that tried to
// grow itself. Advertising empty rooms in the nav is how the site came to
// feel like scaffolding; thin pages are also a ranking liability rather than
// a neutral one. The retired routes still resolve, they are just no longer
// announced. Everything else is reached by walking the site, not by nav.
export const PRIMARY_NAV: NavItem[] = [
  { href: "/essays", label: "Essays" },
  { href: "/research", label: "Research" },
  { href: "/answers", label: "Answers" },
  { href: "/about", label: "About" },
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
  /** og:type — "article" for a piece, "website" for an index. */
  ogType?: "website" | "article";
  /** Absolute URL of this page's plain-text twin, advertised to crawlers as
   *  rel=alternate and to readers as a link on the page itself. */
  markdownUrl?: string;
  /** ISO dates for article metadata, emitted as OpenGraph article:* tags. */
  publishedTime?: string;
  modifiedTime?: string;
}

const SITE_ORIGIN = "https://canopticon.com";

export function renderPage(args: RenderPageArgs): string {
  const fullTitle = args.title
    ? `${escapeHtml(args.title)} — CANOPTICON`
    : "CANOPTICON — The standing record";
  // The fallback description for any page that doesn't set its own. It used
  // to describe the graph era ("documented facts with their receipts …
  // signed analysis"), which is no longer what the site is.
  const description = escapeHtml(
    args.description ??
      "Canopticon publishes research documents kept whole and essays that argue from them — every quote verified word-for-word against its stored source, and everything free to read and quote.",
  );
  const mode = args.mode ?? "public";
  const zone = args.zone ?? "home";
  const cssHref = `/styles.css?v=${stylesHash()}`;
  const canonical = args.canonical ?? "";
  const ogType = args.ogType ?? "website";
  // Social + answer-engine metadata. None of this existed: no OpenGraph, no
  // Twitter card, and `canonical` was supported but passed on exactly one
  // page in the repo, so every other URL was free to be indexed under any
  // query string that reached it.
  const social = [
    `<meta property="og:site_name" content="Canopticon" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:title" content="${escapeAttr(args.title || "Canopticon")}" />`,
    `<meta property="og:description" content="${description}" />`,
    canonical ? `<meta property="og:url" content="${escapeAttr(canonical)}" />` : "",
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:site" content="@canoptics" />`,
    `<meta name="twitter:title" content="${escapeAttr(args.title || "Canopticon")}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    args.publishedTime
      ? `<meta property="article:published_time" content="${escapeAttr(args.publishedTime)}" />`
      : "",
    args.modifiedTime
      ? `<meta property="article:modified_time" content="${escapeAttr(args.modifiedTime)}" />`
      : "",
    args.markdownUrl
      ? `<link rel="alternate" type="text/markdown" href="${escapeAttr(args.markdownUrl)}" />`
      : "",
    `<link rel="alternate" type="application/feed+json" title="Canopticon" href="${SITE_ORIGIN}/feed.json" />`,
  ]
    .filter(Boolean)
    .join("\n");
  return `<!doctype html>
<html lang="en" data-mode="${mode}" data-zone="${escapeAttr(zone)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${fullTitle}</title>
<meta name="description" content="${description}" />
${canonical ? `<link rel="canonical" href="${escapeAttr(canonical)}" />` : ""}
${social}
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500;1,6..72,600&display=swap" />
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
  // Mobile nav: a checkbox-hack toggle, not client JS — the shell's own
  // comment says "nothing here requires JavaScript to read" and a real
  // small-screen menu shouldn't be the exception. :checked drives the
  // dropdown purely in CSS (see .nav-toggle / .nav-burger / .nav-links in
  // styles.ts under the max-width:680px block).
  return `<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="wordmark">canopticon</a>
    <input type="checkbox" id="nav-toggle" class="nav-toggle" />
    <label for="nav-toggle" class="nav-burger" aria-label="Menu"><span></span></label>
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
      <a href="/" class="wordmark">canopticon</a>
      <div class="coord" style="margin-top:8px">THE STANDING RECORD <span class="sep">·</span> canopticon.com <span class="sep">·</span> @canoptics</div>
      <form class="sub-form" method="post" action="/subscribe">
        <label for="sub-email" class="visually-hidden">Email address</label>
        <input id="sub-email" type="email" name="email" placeholder="you@example.com" required autocomplete="email" />
        <button type="submit">Get new work</button>
      </form>
    </div>
    <div class="foot-links">
      <a href="/essays">Essays</a>
      <a href="/research">Research</a>
      <a href="/answers">Answers</a>
      <a href="/about">About</a>
      <a href="/method">Method</a>
      <a href="/search">Search</a>
      <a href="/llms.txt">llms.txt</a>
      <a href="/feed.json">Feed</a>
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
