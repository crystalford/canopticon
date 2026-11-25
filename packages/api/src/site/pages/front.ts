// / — the front page, in the order of the site's four sections (2026-11-24):
// the masthead naming them (the idea, the argument, the evidence, the words),
// then Theories (live: every one is a deliberate act), Writing (the McLuhan
// series as one card, then the other papers and hand-picked essays),
// Research (hand-picked briefs beside the newest reports, then the topics)
// and the Lexicon with the open questions. New writing does not
// appear here on its own (author decision, 10 Oct) — the counts are live, the
// picks are not.

import { AUTHOR } from "../author";
import type { LibraryItem } from "../content/store";
import { allPapers, allTheories, article, libraryItems, sayOf, term } from "../content/store";
import {
  latestResearch,
  publicResearchCount,
  researchTopics,
  seriesPapers,
  writingFor,
} from "../data";
import { esc, pill, shell } from "../layout";
import { kindColours, longDate, shortDate, topicColours } from "../theme";

/** The author's picks, in order. A slug that disappears is skipped, not
 *  replaced: a curated page does not quietly re-curate itself. */
const FRONT_ESSAYS = [
  "guess-before-you-look",
  "self-extinguishing-maintenance",
  "the-counter-irritant-spiral",
  "unverified-hunches-in-ai-assisted-software-work",
  "seeing-what-you-rely-on",
];

const FRONT_ARTICLES = [
  "paying-yourself-to-do-your-own-tasks",
  "canadian-recessions-and-the-mortgage-channel",
  "temporary-foreign-workers-and-canadian-innovation",
  "whey-protein-in-hot-black-coffee",
  "bill-c-11-and-canadian-creators-in-2026",
];

/** The author's picks for the Lexicon section; each card is drawn from the
 *  term's own entry (terms.json), so it always says what the term page says. */
const NAMED_HERE = ["sensory-syncrasis", "narcocrasis", "typomora"];

function seriesCard(): string {
  const series = seriesPapers();
  const rows = series
    .map(
      ({ item, paper: p }, i) =>
        `<a href="/papers/${esc(p.slug)}" class="ser-row${i ? "" : " first"}"><span class="ser-n">${String(i + 1).padStart(2, "0")}</span><span style="min-width:0"><span class="ser-t">${esc(p.title)}</span><span class="ser-d">${esc(item.blurb)}</span></span><span class="ser-r">${pill(item.tag, item.tagPair, "pill lg")}<span class="ser-m">${item.minutes} min</span></span></a>`,
    )
    .join("");
  const days = series.map((s) => s.paper.date).sort();
  const first = days[0] ?? "";
  const last = days[days.length - 1] ?? "";
  const d1 = shortDate(first).split(" ")[0] ?? "";
  const span = first === last ? longDate(first) : `${d1}–${longDate(last)}`;
  return `<section aria-label="The McLuhan paper series" class="ser"><div class="ser-head"><div class="pills" style="margin-bottom:14px"><span class="pill lg" style="background:#e9dcf5;color:#5a2d82">Paper series</span><span class="pill lg" style="background:var(--card);color:#5a2d82">${series.length} papers · read in order or dip in</span></div><h3 class="ser-h">McLuhan said every medium changes the ratio among our senses. Seven papers take that literally.</h3><p class="ser-p">Six papers test it — from ADHD and typing to drugs and addiction — and the synthesis finds one configuration that media, drugs and illness all re-temper.</p></div><div>${rows}</div><p class="ser-foot">Each paper cites the published literature with numbered references · published ${esc(span)}</p></section>`;
}

/** Every theory, newest revision first: the publication's formal work, live
 *  (there are few, and each one is a deliberate act of the author's). */
function theoriesSection(): string {
  const list = [...allTheories()].sort((a, b) =>
    (b.revised ?? b.date).localeCompare(a.revised ?? a.date),
  );
  if (!list.length) return "";
  const cards = list
    .slice(0, 3)
    .map((t) => {
      const strong = t.propositions.filter((p) => p.grade === "Strong").length;
      return `<a href="/theories/${esc(t.slug)}" class="card" style="align-items:flex-start">${pill("Theory", kindColours("Theory"))}<span class="tile-t">${esc(t.title)}</span><span class="tile-d">${esc(t.dek)}</span><span style="font-size:var(--t-xs);color:var(--muted)">${t.propositions.length} propositions · ${strong} strong · ${t.references.length} references</span></a>`;
    })
    .join("");
  return `<section class="sec" aria-labelledby="t-h"><div class="sec-h"><h2 id="t-h">Theories</h2><a href="/theories" class="sec-a">All theories</a></div><p class="sec-p">Named ideas stated formally: a claim, propositions graded by the evidence behind them, the primary studies they rest on, and what counts against them.</p><div class="grid3">${cards}</div></section>`;
}

function namedHere(): string {
  const cards = NAMED_HERE.flatMap((id) => {
    const t = term(id);
    if (!t) return [];
    return [
      `<a href="${esc(t.route)}" class="card term-card"><span class="pills">${pill("Concept", kindColours("Concept"))}${sayOf(t) ? `<span class="term-card-say">${esc(sayOf(t) ?? "")}</span>` : ""}</span><span class="tile-t">${esc(t.title)}</span><span class="tile-d">${esc(t.definition ?? t.body)}</span>${t.plain ? `<span class="term-card-p">In plain words: ${esc(t.plain)}</span>` : ""}</a>`,
    ];
  });
  const open = libraryItems().filter((r) => r.kind === "Open problem").length;
  return `<section class="sec" aria-labelledby="l-h"><div class="sec-h"><h2 id="l-h">Lexicon</h2><a href="/lexicon" class="sec-a">Every term</a></div><p class="sec-p">Names for patterns the work found that had none. Each has its own page with a definition, examples and how it differs from existing terms.</p><div class="grid3 wide">${cards.join("")}</div><a href="/open" class="open-line"><span class="open-n tnum">${open}</span><span><strong>Open questions.</strong> What the research raised and could not settle, each with what is known and what is missing.</span><span aria-hidden="true" class="open-arrow">\u2192</span></a></section>`;
}

function researchRow(r: LibraryItem, last: boolean): string {
  return `<a href="${esc(r.route)}" class="row rrow${last ? " last" : ""}"><span class="rrow-d tnum">${esc(r.dateLabel ?? shortDate(r.date))}</span><span style="min-width:0"><span class="rrow-t">${esc(r.title)}</span><span class="pills" style="margin-top:6px">${pill(r.sub ?? "Research", kindColours("Research"))}${pill(r.topic, topicColours(r.topic))}</span></span></a>`;
}

/** The masthead: what the site is, in its own plain words, and its four
 *  sections as one strip — the idea, the argument, the evidence, the words.
 *  No counts: what a section is for says more than how full it is. */
function masthead(): string {
  const steps: Array<[string, string, string]> = [
    ["/theories", "Theories", "The ideas: named, stated formally and graded by their evidence."],
    ["/writing", "Writing", "The arguments: essays and papers, short and long."],
    ["/research", "Research", "The evidence: reports kept whole, and briefs written from them."],
    ["/lexicon", "Lexicon", "The words: every term coined here, defined."],
  ];
  const strip = steps
    .map(
      ([href, name, what], i) =>
        `<a href="${href}" class="lad-s"><span class="lad-i">${String(i + 1).padStart(2, "0")}</span><span class="lad-t">${name}</span><span class="lad-d">${what}</span></a>`,
    )
    .join("");
  return `<section class="mast" aria-labelledby="mast-h"><h1 id="mast-h" class="mast-h">An independent research publication by Chris Telford.</h1><p class="mast-p">Theories of his own, the essays and papers that argue them, and the research they stand on. Every quotation is copied word for word from a stored source and links back to it.</p><nav class="lad" aria-label="Sections">${strip}</nav></section>`;
}

/** One row of writing: title, summary, date · length · topic, and its form. */
function wrow(w: ReturnType<typeof writingFor>, kind = true): string {
  return `<a href="${esc(w.route)}" class="wrow">${kind ? `<span class="wrow-k">${pill(w.kind, kindColours(w.kind))}</span>` : ""}<span class="wrow-t">${esc(w.title.split(/:\s/)[0] ?? w.title)}</span><span class="wrow-d">${esc(w.dek)}</span><span class="wrow-m"><span class="tnum">${esc(shortDate(w.date))}</span><span aria-hidden="true">·</span><span>${w.minutes} min</span><span aria-hidden="true">·</span><span>${esc(w.topic)}</span></span></a>`;
}

const picks = (slugs: string[]) =>
  slugs.flatMap((slug) => {
    const a = article(slug);
    return a && !a.withdrawn ? [writingFor(a)] : [];
  });

/** Writing: the McLuhan series as one card, then the papers outside it and
 *  the author's picked essays, side by side. */
function writingSection(): string {
  const inSeries = new Set(seriesPapers().map((s) => s.paper.slug));
  const papers = allPapers()
    .filter((p) => !inSeries.has(p.slug))
    .map((p) => writingFor(p));
  const rows = [...papers, ...picks(FRONT_ESSAYS)].map((w) => wrow(w)).join("");
  const n = libraryItems().filter((r) => r.kind === "Essay" || r.kind === "Paper").length;
  return `<section class="sec" aria-labelledby="w-h"><div class="sec-h"><h2 id="w-h">Writing</h2><a href="/writing" class="sec-a">All ${n} essays and papers</a></div><p class="sec-p">The arguments. Essays make one in a few minutes; papers work an idea through the published research with numbered references.</p>${seriesCard()}<div class="wgrid">${rows}</div></section>`;
}

/** Research: briefs beside the newest reports, then the topics. */
function researchSection(): string {
  const briefs = picks(FRONT_ARTICLES)
    .map((w) => wrow(w, false))
    .join("");
  const nBriefs = libraryItems().filter((r) => r.kind === "Brief").length;
  const reports = latestResearch(6)
    .map((r) => researchRow(r, false))
    .join("");
  const topics = researchTopics()
    .map(
      (t) =>
        `<a href="/topics/${esc(t.slug)}" class="tpill" style="background:${topicColours(t.name)[0]};color:${topicColours(t.name)[1]}">${esc(t.name)}<span class="n">${t.count}</span></a>`,
    )
    .join("");
  return `<section class="sec" aria-labelledby="r-h"><div class="sec-h"><h2 id="r-h">Research</h2><a href="/research" class="sec-a">All research</a></div><p class="sec-p">The evidence everything above stands on. Reports are kept whole, as they were written; briefs answer one question from them, quoting them word for word.</p><div class="wcols"><div class="wcol"><div class="wcol-h">${pill("Brief", kindColours("Brief"), "pill lg")}<span>One question, answered from the reports</span></div>${briefs}<a href="/research?kind=Brief" class="row-more">All ${nBriefs} briefs</a></div><div class="wcol"><div class="wcol-h">${pill("Research", kindColours("Research"), "pill lg")}<span>The newest reports</span></div><div class="rows slim wcol-rows">${reports}</div><a href="/research?kind=Report" class="row-more">All ${publicResearchCount()} reports</a></div></div><div class="topics-card"><span class="topics-h">Browse by topic</span><div class="pills" style="gap:8px">${topics}</div></div></section>`;
}

function checkable(): string {
  return `<section class="sec card checkable"><div class="checkable-l"><strong>Everything here can be checked.</strong>Every figure and quote is copied word for word from a stored document, and links back to it. Nothing goes live until the author publishes it. <a href="/about" class="glink">How the record is read</a></div><div class="checkable-r"><span style="font-size:14px;line-height:1.5;color:var(--body)"><strong style="font-weight:600;color:var(--ink)">Get new research by email.</strong> One email a week, only when something new is published. Unsubscribe any time.</span><form class="form-row" method="get" action="/follow"><label for="home-email" class="vh">Email address</label><input id="home-email" class="field" style="height:40px;border-radius:8px;font-size:14px" type="email" name="email" placeholder="you@example.com" autocomplete="email" required /><button type="submit" class="btn" style="height:40px;border-radius:8px;padding:0 16px">Get the weekly email</button></form><div style="display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px;color:var(--ink-2)"><a href="/follow" class="ulink">Follow one topic</a><a href="/about#m-machines" class="ulink">RSS feed</a><a href="/about#m-machines" class="ulink">llms.txt for agents</a></div></div></section>`;
}

export function renderFront(opts: { signedIn?: boolean } = {}): string {
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://canopticon.com/#org",
        name: "Canopticon",
        url: "https://canopticon.com/",
        founder: AUTHOR,
      },
      {
        "@type": "WebSite",
        "@id": "https://canopticon.com/#site",
        name: "Canopticon",
        url: "https://canopticon.com/",
        description: "An independent research publication by Chris Telford.",
        publisher: { "@id": "https://canopticon.com/#org" },
        author: AUTHOR,
        potentialAction: {
          "@type": "SearchAction",
          target: "https://canopticon.com/search?q={query}",
          "query-input": "required name=query",
        },
      },
    ],
  };
  return shell({
    title: "",
    description:
      "An independent research publication by Chris Telford. Every quote links back to its source.",
    path: "/",
    signedIn: opts.signedIn ?? false,
    head: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    body: `${masthead()}${theoriesSection()}${writingSection()}${researchSection()}${namedHere()}${checkable()}`,
  });
}
