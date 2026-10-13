// /articles/<slug> — an article or a paper. docs/blackbox/README.md §Article,
// §Paper; pages/Canopticon Essay *.dc.html and Paper *.dc.html.
//
// An article is the author's argument made from the research: every <q> is a
// verbatim quote with a receipt chip to its passage, every other sentence is
// the author's own and is underlined to say so. A paper is entirely the
// author's work — no underlines — and sits in the McLuhan series.

import type { Article, ArticleExtras, Paper } from "../content/store";
import { articleExtras, researchPrompt } from "../content/store";
import {
  SERIES,
  SERIES_NAME,
  articleMinutes,
  docTitle,
  paperMinutes,
  seriesPapers,
  topicOf,
  writingFor,
} from "../data";
import { esc, linkPill, pill, shell } from "../layout";
import { type Head, articleHtml, articleQuotes, documentHtml, inline, plain } from "../md";
import { kindColours, longDate, monthYear, topicColours, topicSlug } from "../theme";

const COPY_ICON =
  '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="flex:none"><rect x="5.5" y="5.5" width="8" height="8" rx="1.8"></rect><path d="M10.5 5.5V3.8A1.3 1.3 0 0 0 9.2 2.5H3.8A1.3 1.3 0 0 0 2.5 3.8v5.4a1.3 1.3 0 0 0 1.3 1.3h1.7"></path></svg>';

function toc(label: string, heads: Head[], lead?: { text: string; href: string }): string {
  if (!heads.length) return "";
  const items = [
    ...(lead
      ? [`<li><a href="${lead.href}"><span class="n"></span>${esc(lead.text)}</a></li>`]
      : []),
    ...heads.map(
      (h) => `<li><a href="${h.href}"><span class="n">${h.n}</span>${esc(h.text)}</a></li>`,
    ),
  ];
  return `<div class="rail-sticky"><div class="toc-h">${esc(label)}</div><ol class="toc" data-toc>${items.join("")}</ol></div>`;
}

function statbox(
  topic: string,
  a: [string, string],
  b: [string, string],
  problem?: string,
): string {
  const open = problem
    ? linkPill(problem, "Open problem", kindColours("Open problem"), "tpill")
    : "";
  return `<div class="statbox"><div class="statbox-p">${linkPill(`/topics/${topicSlug(topic)}`, topic, topicColours(topic), "tpill")}${open}</div><div class="stats"><div class="stat"><div class="stat-v">${esc(a[0])}</div><div class="stat-k">${esc(a[1])}</div></div><div class="stat"><div class="stat-v">${esc(b[0])}</div><div class="stat-k">${esc(b[1])}</div></div></div></div>`;
}

/** "This thread is still open": the questions the article leaves, each with
 *  its prompt when one has been written — readable without the script (a
 *  disclosure), copyable with it. A missing prompt says so. */
function thread(t: ArticleExtras["thread"]): string {
  if (!t?.items.length) return "";
  const rows = t.items
    .map((it) => {
      const text = it.prompt ? researchPrompt(it.prompt) : null;
      const action = text
        ? `<button type="button" class="btn sm" data-copy-prompt>${COPY_ICON}<span>Copy prompt</span></button>`
        : `<span class="thread-none">Prompt not written yet</span>`;
      const show = text
        ? `<details class="thread-p"><summary>Show the prompt</summary><pre data-prompt-text>${esc(text)}</pre></details>`
        : "";
      return `<div class="thread-r"><div class="thread-b"><div class="thread-h">${pill("Not run yet", ["#f3e9d4", "#6b4e14"])}<span class="thread-t">${esc(it.title)}</span></div><div class="thread-d">${esc(it.desc)}</div>${show}</div>${action}</div>`;
    })
    .join("");
  return `<section class="thread" aria-label="Continue this research"><h2>This thread is still open</h2><p>${esc(t.intro)}</p>${rows}</section>`;
}

function emailPanel(): string {
  return `<section class="panel email" aria-label="Get new articles by email"><h2>Get the next one by email</h2><p>One email a week, only when something new is published. Unsubscribe any time.</p><form class="form-row" method="get" action="/follow"><label for="article-email" class="vh">Email address</label><input id="article-email" class="field" type="email" name="email" placeholder="you@example.com" autocomplete="email" required /><button type="submit" class="btn tall">Get the weekly email</button></form><div class="form-links"><a href="/follow" class="ulink">Choose topics</a><a href="/feed.xml" class="ulink">RSS feed</a></div></section>`;
}

function citeBlock(cite: string): string {
  return `<div><h3>Cite this</h3><div class="cite-row"><span class="cite-t" data-cite-text>${esc(cite)}</span><button type="button" class="btn sm" data-copy-cite>${COPY_ICON}<span>Copy</span></button></div></div>`;
}

function readNext(
  items: Array<{ route: string; kind: string; title: string; dek: string; minutes: number }>,
): string {
  if (!items.length) return "";
  return `<section class="sec" style="margin-top:40px" data-read-next><h2 style="font-size:18px;font-weight:600;letter-spacing:-.01em;margin:0 0 12px">Read next</h2><div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))">${items
    .map(
      (w) =>
        `<a href="${esc(w.route)}" class="card"><span class="pills">${pill(w.kind, kindColours(w.kind))}<span style="font-size:12px;color:var(--hint)">${w.minutes} min</span></span><span class="tile-t">${esc(w.title)}</span><span class="tile-d clamp">${esc(w.dek)}</span></a>`,
    )
    .join("")}</div></section>`;
}

function citationMeta(title: string, date: string, url: string): string {
  return [
    `<meta name="citation_title" content="${esc(title)}" />`,
    `<meta name="citation_author" content="Telford, Chris" />`,
    date
      ? `<meta name="citation_publication_date" content="${esc(date.replace(/-/g, "/"))}" />`
      : "",
    `<meta name="citation_publisher" content="Canopticon" />`,
    `<meta name="citation_public_url" content="${esc(url)}" />`,
    `<meta name="DC.rights" content="https://creativecommons.org/licenses/by/4.0/" />`,
  ]
    .filter(Boolean)
    .join("\n");
}

function jsonLd(o: Record<string, unknown>): string {
  return `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[’']/g, "'")
      .split(/[^a-z0-9']+/)
      .filter((w) => w.length > 2),
  );

/** Give each heading the short label that shares most words with it; a
 *  heading no label matches keeps its own text. */
const COUNT_WORDS = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

export function matchLabels(heads: Head[], labels: string[]): Head[] {
  if (!labels.length) return heads;
  // By position first: the labels are written in the headings' order. Then
  // swap any two whose words fit each other's heading better — the
  // prototype's own list swaps two on one article. Word-matching alone is
  // wrong more often than position ("Coffee's acidity" shares no word with
  // "Coffee is close to the worst possible liquid for it").
  const stem = (w: string) => w.replace(/'s?$/, "").slice(0, 5);
  const fit = (h: number, l: number) => {
    const hw = new Set([...words(heads[h]?.text ?? "")].map(stem));
    return [...words(labels[l] ?? "")].filter((w) => hw.has(stem(w))).length;
  };
  const at = heads.map((_, k) => (k < labels.length ? k : -1));
  for (let changed = true; changed; ) {
    changed = false;
    for (let x = 0; x < at.length; x++) {
      for (let y = x + 1; y < at.length; y++) {
        const lx = at[x] ?? -1;
        const ly = at[y] ?? -1;
        if (lx < 0 || ly < 0) continue;
        if (fit(x, ly) + fit(y, lx) > fit(x, lx) + fit(y, ly)) {
          at[x] = ly;
          at[y] = lx;
          changed = true;
        }
      }
    }
  }
  return heads.map((h, k) => {
    const l = at[k] ?? -1;
    return l < 0 ? h : { ...h, text: labels[l] ?? h.text };
  });
}

export interface ArticleRenderOptions {
  signedIn?: boolean;
  /** A draft's sources include Admin uploads the content store does not hold. */
  docTitle?: (id: string) => string | null;
  /** The workspace preview marks a quote that is not word for word in red. */
  quoteOk?: (doc: string, text: string) => boolean;
  /** A draft is never indexed. */
  noindex?: boolean;
}

export function renderArticle(a0: Article, opts: ArticleRenderOptions = {}): string {
  const a = { ...a0, topic: topicOf(a0) };
  const titleOf = opts.docTitle ?? docTitle;
  const ctx = { docTitle: titleOf, ...(opts.quoteOk ? { quoteOk: opts.quoteOk } : {}) };
  const body = articleHtml(a.body, ctx);
  const quotes = a.quotes ?? articleQuotes(a.body).length;
  const minutes = articleMinutes(a);
  const url = `https://canopticon.com/articles/${a.slug}`;
  const cite =
    a.cite ??
    `Telford, C. (${a.date.slice(0, 4)}). ${a.title}. Canopticon. canopticon.com/articles/${a.slug}`;
  const based = (a.based_on ?? []).filter((b) => titleOf(b.id) !== null);
  const extras = articleExtras(a.slug);
  // Short contents labels from the prototype, matched to headings by
  // position and corrected where two are plainly swapped (matchLabels).
  const heads = matchLabels(body.heads, extras.toc ?? []);
  // Named sources may carry <em> and nothing else.
  const sourceHtml = (s: string) => esc(s).replace(/&lt;(\/?)em&gt;/g, "<$1em>");

  const header = [
    extras.pair
      ? `<div class="pair-note"><strong>One of a pair.</strong> ${esc(extras.pair.before)} <a href="${esc(extras.pair.route)}">${esc(extras.pair.label)}</a>${esc(extras.pair.after)}</div>`
      : "",
    `<div style="margin-bottom:24px">`,
    `<div class="kicker">${pill("Article", kindColours("Article"))}${linkPill(`/topics/${topicSlug(a.topic)}`, a.topic, topicColours(a.topic))}</div>`,
    `<h1 class="h-display">${esc(a.title)}</h1>`,
    `<p class="dek">${esc(a.dek)}</p>`,
    `<div class="byline"><a href="/about#m-author" class="who">Chris Telford</a><time class="chip" datetime="${esc(a.date)}">${esc(longDate(a.date))}</time><span class="chip">${minutes} min</span><span class="chip">${quotes} quotes</span></div>`,
    // More than three and the header names the count; the list is below.
    based.length > 3
      ? `<div class="based"><span class="based-l">Based on</span><span>${COUNT_WORDS[based.length] ?? based.length} documents across the record</span></div>`
      : based.length
        ? `<div class="based"><span class="based-l">Based on</span>${based
            .map((b) => `<a href="/p/${esc(b.id)}">${esc(b.label)}</a>`)
            .join("")}</div>`
        : "",
    "</div>",
    a.why ? `<div class="aside-box"><strong>Why I asked.</strong> ${inline(a.why)}</div>` : "",
    a.thesis
      ? `<div class="aside-box thesis"><strong>Thesis.</strong> ${inline(a.thesis)}</div>`
      : "",
  ].join("");

  const sources = `<section class="panel cols" aria-label="Sources and citation">${
    based.length
      ? `<div><h3>Based on</h3><div class="src-list">${based
          .map(
            (b) =>
              `<a class="src-pill" href="/p/${esc(b.id)}">${esc(b.label || titleOf(b.id) || "")}</a>`,
          )
          .join("")}</div></div>`
      : ""
  }${
    extras.sources?.length
      ? `<div><h3>Sources</h3><div class="pills">${extras.sources
          .map((s) => `<span class="src-name">${sourceHtml(s)}</span>`)
          .join("")}</div></div>`
      : ""
  }${citeBlock(cite)}</section>`;

  // Read next is curated per article in the prototype, and absent where it
  // was not curated; a fallback would be a choice the author did not make.
  const next = (extras.readNext ?? []).map((r) => ({
    route: r.route,
    kind: r.kind === "Paper" ? ("Paper" as const) : ("Article" as const),
    title: r.title,
    dek: r.dek,
    minutes: Number.parseInt(r.min, 10) || 0,
  }));

  const withdrawn = a.withdrawn
    ? `<div class="withdrawn"><strong>Withdrawn draft.</strong> ${esc(a.withdrawn)}</div>`
    : "";
  const col = `<article class="col prose">${withdrawn}${header}${body.html}${thread(extras.thread)}${emailPanel()}${sources}${readNext(next)}</article>`;
  const rail = `<aside class="rail">${statbox(a.topic, [String(quotes), "Quotes"], [a.date.slice(8, 10).replace(/^0/, ""), monthYear(a.date)], extras.openProblem)}${toc("In this article", heads)}</aside>`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.dek,
    url,
    datePublished: a.date,
    author: { "@type": "Person", name: "Chris Telford", url: "https://canopticon.com/about" },
    publisher: { "@type": "Organization", name: "Canopticon", url: "https://canopticon.com" },
    license: "https://creativecommons.org/licenses/by/4.0/",
    isBasedOn: based.map((b) => `https://canopticon.com/p/${b.id}`),
    wordCount: a.words,
  };
  return shell({
    title: a.title,
    description: a.dek,
    path: `/articles/${a.slug}`,
    nav: "library",
    progress: true,
    ogType: "article",
    mainClass: "long",
    noindex: Boolean(a.withdrawn) || opts.noindex === true,
    signedIn: opts.signedIn ?? false,
    head: `${citationMeta(a.title, a.date, url)}\n<link rel="alternate" type="text/markdown" href="/articles/${esc(a.slug)}.md" />\n${jsonLd(ld)}`,
    body: `<div class="rr">${col}${rail}</div>`,
  });
}

// ---- papers -----------------------------------------------------------------

/** A paper's own opening: "# Title", an italic subtitle, a dateline. The
 *  subtitle is the dek; the rest is shown by the page's own header. */
function paperParts(p: Paper): { subtitle: string; abstract: string; rest: string } {
  let src = p.body.trimStart().replace(/^#\s+.*\n+/, "");
  let subtitle = "";
  const sub = /^\*([^*\n]+)\*\s*\n+/.exec(src);
  if (sub) {
    subtitle = sub[1] ?? "";
    src = src.slice(sub[0].length);
  }
  src = src.replace(/^[A-Z][a-z]{2} \d{1,2}, \d{4} ·[^\n]*\n+/, "");
  let abstract = "";
  const ab = /^##\s+(Abstract|Summary)\s*\n([\s\S]*?)(?=\n##\s)/m.exec(src);
  if (ab) {
    abstract = (ab[2] ?? "").trim();
    src = src.replace(ab[0], "");
  }
  return { subtitle, abstract, rest: src };
}

function referenceCount(p: Paper): number {
  const i = p.body.search(/^##\s+References/m);
  if (i < 0) return 0;
  // Data rows of every table under the References heading: a table's first
  // row is its header and its second the --- separator.
  let n = 0;
  let inTable = false;
  for (const l of p.body.slice(i).split("\n")) {
    if (!/^\s*\|/.test(l)) {
      inTable = false;
      continue;
    }
    if (!inTable) {
      inTable = true;
      continue;
    }
    if (!/^\s*\|?\s*:?-{2,}/.test(l)) n++;
  }
  return n;
}

export function renderPaper(p: Paper, opts: { signedIn?: boolean } = {}): string {
  const { subtitle, abstract, rest } = paperParts(p);
  const body = documentHtml(rest);
  const topic = topicOf(p);
  const minutes = paperMinutes(p);
  const refs = Math.max(0, referenceCount(p));
  const url = `https://canopticon.com/articles/${p.slug}`;
  const cite = `Telford, C. (${p.date.slice(0, 4)}). ${p.title}${subtitle ? `: ${subtitle}` : ""}. Canopticon. canopticon.com/articles/${p.slug}`;
  const dek = subtitle || p.dek || "";

  const header = [
    `<div style="margin-bottom:24px">`,
    `<div class="kicker">${pill("Paper", kindColours("Paper"))}${linkPill(`/topics/${topicSlug(topic)}`, topic, topicColours(topic))}</div>`,
    `<h1 class="h-display">${esc(p.title)}</h1>`,
    dek ? `<p class="dek">${esc(dek)}</p>` : "",
    `<div class="byline"><a href="/about#m-author" class="who">Chris Telford</a><time class="chip" datetime="${esc(p.date)}">${esc(longDate(p.date))}</time><span class="chip">${minutes} min</span>${refs ? `<span class="chip">${refs} references</span>` : ""}</div>`,
    `<div class="based"><span class="based-l">Part of</span><a href="/articles/krasis">${esc(SERIES_NAME)}</a></div>`,
    "</div>",
    abstract
      ? `<section class="inshort" id="s-0"><div class="inshort-h">In short</div>${documentHtml(abstract).html}</section>`
      : "",
  ].join("");

  const series = seriesPapers();
  const seriesRail = `<div class="series"><div class="series-h"><span>In this series</span>${pill(`${series.length} papers`, kindColours("Paper"), "pill lg")}</div><ol>${series
    .map(({ item, paper }) =>
      paper.slug === p.slug
        ? `<li class="on" aria-current="page"><span class="t">${esc(paper.title)}</span><span class="s">${esc(item.short)}</span></li>`
        : `<li><a href="/articles/${esc(paper.slug)}"><span class="t">${esc(paper.title)}</span><span class="s">${esc(item.short)}</span></a></li>`,
    )
    .join("")}</ol></div>`;

  const others = series.filter((s) => s.paper.slug !== p.slug);
  const idx = SERIES.findIndex((s) => s.slug === p.slug);
  const next = [...others.slice(Math.max(0, idx)), ...others.slice(0, Math.max(0, idx))]
    .slice(0, 2)
    .map((s) => ({ ...writingFor(s.paper), dek: s.item.blurb }));

  const sources = `<section class="panel cols" aria-label="Sources and citation">${citeBlock(cite)}</section>`;
  const col = `<article class="col prose paper">${header}<div class="pbody">${body.html}</div>${emailPanel()}${sources}${readNext(next)}</article>`;
  const rail = `<aside class="rail">${seriesRail}${statbox(topic, [String(refs || "—"), "References"], [p.date.slice(8, 10).replace(/^0/, ""), monthYear(p.date)])}${toc("In this paper", body.heads, abstract ? { text: "Summary", href: "#s-0" } : undefined)}</aside>`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: p.title,
    alternativeHeadline: subtitle || undefined,
    description: plain(abstract).slice(0, 300) || dek,
    url,
    datePublished: p.date,
    author: { "@type": "Person", name: "Chris Telford", url: "https://canopticon.com/about" },
    publisher: { "@type": "Organization", name: "Canopticon", url: "https://canopticon.com" },
    isPartOf: { "@type": "CreativeWorkSeries", name: SERIES_NAME },
    license: "https://creativecommons.org/licenses/by/4.0/",
  };
  return shell({
    title: p.title,
    description: dek || plain(abstract).slice(0, 200),
    path: `/articles/${p.slug}`,
    nav: "library",
    progress: true,
    ogType: "article",
    mainClass: "long",
    signedIn: opts.signedIn ?? false,
    head: `${citationMeta(p.title, p.date, url)}\n<link rel="alternate" type="text/markdown" href="/articles/${esc(p.slug)}.md" />\n${jsonLd(ld)}`,
    body: `<div class="rr">${col}${rail}</div>`,
  });
}
