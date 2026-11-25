// The shell every Black Box page shares: head, header, footer, reading
// progress, skip link. docs/blackbox/README.md §Shared chrome.
//
// Server-rendered and complete without JavaScript (standing rule 7). /site.js
// adds the conveniences — the / shortcut, the progress bar, the TOC that
// follows the reader, passage links, hovercards, the cite button — and the
// page is whole without it.

import { siteStylesHash } from "./styles";
import { kindLabel } from "./theme";

export const SITE = "https://canopticon.com";

export interface ShellArgs {
  title: string;
  description: string;
  body: string;
  /** Path for the canonical link and og:url, e.g. "/library". */
  path: string;
  /** Which primary nav item is current. */
  nav?:
    | "library"
    | "theories"
    | "papers"
    | "writing"
    | "research"
    | "lexicon"
    | "open"
    | "about"
    | "search";
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
  /** A working page (Admin's desk, a conversation): the header runs the full
   *  width, the page fills the window with its own scrolling panes, and
   *  there is no footer. */
  app?: boolean;
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

/** The share card for a page (site/og/card.ts, served by the /card route):
 *  a content page gets its own, anything else the record's. */
export function cardPath(path: string): string {
  const clean = path.split(/[?#]/)[0] ?? "/";
  if (/^\/(articles|papers|theories|p|concepts|open|topics)\/[A-Za-z0-9_-]+$/.test(clean))
    return `/card${clean}.png`;
  return "/card/index.png";
}

/** The <title> a search result can show whole: about 60 characters. A long
 *  title keeps the part before its colon when that stands alone; otherwise it
 *  is cut at a word. The page's own heading and og:title keep it in full. */
export function searchTitle(t: string): string {
  if (t.length <= 60) return t;
  const head = t.split(/:\s/)[0] ?? t;
  if (head.length >= 15 && head.length <= 60) return head;
  return cutTitle(t);
}

/** A long title cut at a word, colon and all: for a page whose short form
 *  (the part before the colon) another page already uses. */
export function cutTitle(t: string): string {
  if (t.length <= 60) return t;
  return `${t.slice(0, 58).replace(/\s+\S*$/, "")}…`;
}

/** A description a result can show whole: at most 160 characters, cut at a
 *  sentence where one ends late enough, else at a word. */
export function searchDescription(d: string): string {
  const t = d.replace(/\s+/g, " ").trim();
  if (t.length <= 160) return t;
  const cut = t.slice(0, 160);
  const stop = cut.lastIndexOf(". ");
  if (stop >= 90) return cut.slice(0, stop + 1);
  return `${cut.slice(0, 157).replace(/\s+\S*$/, "")}…`;
}

export function shell(a: ShellArgs): string {
  const canonical = `${SITE}${a.path}`;
  const title = a.title ? `${esc(searchTitle(a.title))} · Canopticon` : "Canopticon";
  const desc = esc(searchDescription(a.description));
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
<meta property="og:image" content="${SITE}${cardPath(a.path)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(a.title || "Canopticon")}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@canoptics" />
<meta name="twitter:title" content="${esc(a.title || "Canopticon")}" />
<meta name="twitter:description" content="${desc}" />
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
<body${a.app ? ' class="app"' : ""}>
<a href="#main" class="skip">Skip to content</a>
${header(a)}
<main id="main" class="main${a.mainClass ? ` ${a.mainClass}` : ""}">
${a.body}
</main>
${a.app ? "" : footer()}
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
  return `<div class="hd${a.app ? " wide" : ""}"><header class="hd-in"><a href="/" class="wm">canopticon</a><nav aria-label="Primary" class="nav"><a href="/theories"${cur("theories")}>Theories</a><a href="/writing"${cur("writing")}>Writing</a><a href="/research"${cur("research")}>Research</a><a href="/lexicon"${cur("lexicon")}>Lexicon</a></nav><a href="/search" class="hd-search"${cur("search")}>Search</a>${admin}</header>${
    a.progress ? '<div class="rp"><div id="read-progress"></div></div>' : ""
  }</div>`;
}

function footer(): string {
  return `<footer class="ft"><div class="ft-in"><span class="ft-wm">canopticon</span><span class="ft-line">An independent research publication by Chris Telford. CC BY 4.0. <a href="/about">About this site →</a></span><nav aria-label="Footer" class="ft-nav"><div class="ft-col"><span class="ft-h">The work</span><a href="/theories">Theories</a><a href="/writing">Writing</a><a href="/research">Research</a><a href="/lexicon">Lexicon</a><a href="/open">Open questions</a></div><div class="ft-col"><span class="ft-h">Browse</span><a href="/library">Everything</a><a href="/papers">The McLuhan series</a><a href="/writing?kind=Essay">Essays</a><a href="/research?kind=Brief">Briefs</a><a href="/research?kind=Investigation">Investigations</a><a href="/search">Search</a></div><div class="ft-col"><span class="ft-h">The site</span><a href="/about">About</a><a href="/follow">Follow</a><a href="/feed.xml">RSS feed</a><a href="/llms.txt">llms.txt</a></div></nav></div></footer>`;
}

function beacon(token: string | undefined): string {
  const safe = (token ?? "").replace(/[^A-Za-z0-9_-]/g, "");
  return safe
    ? `<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${safe}"}'></script>\n`
    : "";
}

/** A pill whose colours are data (a kind or a topic). */
/** The sections, in order: the number and the job a section's pages carry
 *  in their header, the same words as the front page's strip. */
export const SECTIONS = {
  theories: ["01", "The ideas"],
  writing: ["02", "The arguments"],
  research: ["03", "The evidence"],
  lexicon: ["04", "The words"],
} as const;

/** The one header every index page wears (2026-11-24): a small label naming
 *  the section (or what the page is), one title size, one intro paragraph,
 *  optional actions, and a rule under it. Detail pages keep their own
 *  header: kind and topic pills, the title, the summary. */
export function pageHead(a: {
  title: string;
  dek?: string;
  section?: keyof typeof SECTIONS;
  label?: string;
  after?: string;
}): string {
  const sec = a.section ? SECTIONS[a.section] : null;
  const k = sec
    ? `<span class="ph-n">${sec[0]}</span><span>${esc(sec[1])}</span>${a.label ? `<span aria-hidden="true">·</span><span>${esc(a.label)}</span>` : ""}`
    : a.label
      ? `<span>${esc(a.label)}</span>`
      : "";
  return `<header class="ph">${k ? `<div class="ph-k">${k}</div>` : ""}<h1 class="ph-t">${esc(a.title)}</h1>${a.dek ? `<p class="ph-d">${a.dek}</p>` : ""}${a.after ?? ""}</header>`;
}

export function pill(label: string, pair: readonly [string, string], cls = "pill"): string {
  return `<span class="${cls}" style="background:${pair[0]};color:${pair[1]}">${esc(kindLabel(label))}</span>`;
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
