// The shell every Black Box page shares: head, header, footer, reading
// progress, skip link. docs/blackbox/README.md §Shared chrome.
//
// Server-rendered and complete without JavaScript (standing rule 7). /site.js
// adds the conveniences — the / shortcut, the progress bar, the TOC that
// follows the reader, passage links, hovercards, the cite button — and the
// page is whole without it.

import { siteStylesHash } from "./styles";

export const SITE = "https://canopticon.com";

export interface ShellArgs {
  title: string;
  description: string;
  body: string;
  /** Path for the canonical link and og:url, e.g. "/library". */
  path: string;
  /** Which primary nav item is current. */
  nav?: "library" | "about" | "search";
  /** Long pages carry the 2px reading-progress bar. */
  progress?: boolean;
  /** Signed in: shows the Admin pill (with its waiting count when known). */
  signedIn?: boolean;
  waiting?: number;
  ogType?: "website" | "article";
  /** Extra <head> lines: JSON-LD, citation_* meta, alternates. */
  head?: string;
  noindex?: boolean;
  /** Cloudflare Web Analytics token; nothing is emitted without one. */
  analyticsToken?: string | undefined;
  /** Extra class on <main> (e.g. "long" for the deeper bottom padding). */
  mainClass?: string;
}

export function esc(s: string | number | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** How many things are waiting in Admin, for the header pill on every page
 *  (set per request by the site middleware, signed-in requests only). */
let WAITING = 0;
export function setWaiting(n: number): void {
  WAITING = n;
}

export function shell(a: ShellArgs): string {
  const canonical = `${SITE}${a.path}`;
  const title = a.title ? `${esc(a.title)} · Canopticon` : "Canopticon";
  const desc = esc(a.description);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${esc(canonical)}" />
${a.noindex ? '<meta name="robots" content="noindex,follow" />\n' : ""}<meta property="og:site_name" content="Canopticon" />
<meta property="og:type" content="${a.ogType ?? "website"}" />
<meta property="og:title" content="${esc(a.title || "Canopticon")}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:site" content="@canoptics" />
<link rel="alternate" type="application/rss+xml" title="Canopticon" href="/feed.xml" />
<link rel="alternate" type="application/feed+json" title="Canopticon (JSON Feed)" href="/feed.json" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&amp;family=IBM+Plex+Mono:wght@400;500&amp;display=swap" />
<link rel="stylesheet" href="/site.css?v=${siteStylesHash()}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
${a.head ?? ""}
<script defer src="/site.js?v=${siteStylesHash()}"></script>
</head>
<body>
<a href="#main" class="skip">Skip to content</a>
${header(a)}
<main id="main" class="main${a.mainClass ? ` ${a.mainClass}` : ""}">
${a.body}
</main>
${footer()}
${beacon(a.analyticsToken)}</body>
</html>`;
}

function header(a: ShellArgs): string {
  const cur = (k: ShellArgs["nav"]) => (a.nav === k ? ' aria-current="page"' : "");
  const waiting = a.waiting ?? WAITING;
  const admin = a.signedIn
    ? `<a href="/admin" class="admin">Admin${
        waiting ? `<span class="admin-n" title="${waiting} things waiting">${waiting}</span>` : ""
      }</a>`
    : "";
  return `<div class="hd"><header class="hd-in"><a href="/" class="wm">canopticon</a><nav aria-label="Primary" class="nav"><a href="/library"${cur("library")}>Library</a><a href="/about"${cur("about")}>About</a></nav><a href="/search" class="hd-search"${cur("search")}>Search <span aria-hidden="true" class="kbd">/</span></a>${admin}</header>${
    a.progress ? '<div class="rp"><div id="read-progress"></div></div>' : ""
  }</div>`;
}

function footer(): string {
  return `<footer class="ft"><div class="ft-in"><span class="ft-wm">canopticon</span><span class="ft-line">A research and development notebook by Chris Telford. Every quote links back to its source. CC BY 4.0. <a href="/about">About this site →</a></span><nav aria-label="Footer" class="ft-nav"><a href="/library?kind=Article">Articles</a><a href="/library?kind=Research">Research</a><a href="/library?kind=Concept">Ideas</a><a href="/investigations">Investigations</a><a href="/follow">Follow</a><a href="/about">About</a><a href="/about#m-machines">Feed</a><a href="/about#m-machines">llms.txt</a></nav></div></footer>`;
}

function beacon(token: string | undefined): string {
  const safe = (token ?? "").replace(/[^A-Za-z0-9_-]/g, "");
  return safe
    ? `<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${safe}"}'></script>\n`
    : "";
}

/** A pill whose colours are data (a kind or a topic). */
export function pill(label: string, pair: readonly [string, string], cls = "pill"): string {
  return `<span class="${cls}" style="background:${pair[0]};color:${pair[1]}">${esc(label)}</span>`;
}

export function linkPill(
  href: string,
  label: string,
  pair: readonly [string, string],
  cls = "pill",
): string {
  return `<a href="${esc(href)}" class="${cls}" style="background:${pair[0]};color:${pair[1]}">${esc(label)}</a>`;
}

export function html(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Pages carry the signed-in operator's Admin pill, so nothing shared may
      // keep a copy. The data under them is static per deploy anyway.
      "cache-control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}
