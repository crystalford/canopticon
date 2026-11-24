// / — the front page, in the order of the site's sections (2026-11-24): the
// masthead with the five sections as one strip, then Theories (live: every one
// is a deliberate act), Papers (the McLuhan series as one numbered card),
// Writing (hand-picked essays beside hand-picked briefs), the Lexicon and open
// questions, and the newest research with the topics. New writing does not
// appear here on its own (author decision, 10 Oct) — the counts are live, the
// picks are not.

import { AUTHOR } from "../author";
import type { LibraryItem } from "../content/store";
import { allPapers, allTheories, article, isWriting, libraryItems, term } from "../content/store";
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

/** The masthead: what the site is, in its own plain words, and its five
 *  sections as one strip, each with its count. The order is the ladder:
 *  from the author's own ideas down to the evidence under them. */
function masthead(): string {
  const rows = libraryItems();
  const writing = rows.filter((r) => isWriting(r.kind));
  const steps: Array<[string, string, number, string]> = [
    [
      "/theories",
      "Theories",
      allTheories().length,
      "Named ideas, stated formally and graded by their evidence.",
    ],
    ["/papers", "Papers", allPapers().length, "Long original work, with numbered references."],
    [
      "/writing",
      "Writing",
      writing.length,
      "Essays that argue an idea; briefs that answer one question.",
    ],
    [
      "/research",
      "Research",
      publicResearchCount(),
      "The reports underneath it all, each kept whole.",
    ],
    [
      "/lexicon",
      "Lexicon",
      rows.filter((r) => r.kind === "Concept").length,
      "Every term coined here, defined.",
    ],
  ];
  const strip = steps
    .map(
      ([href, name, n, what], i) =>
        `<a href="${href}" class="lad-s"><span class="lad-top"><span class="lad-i">${String(i + 1).padStart(2, "0")}</span><span class="lad-n tnum">${n}</span></span><span class="lad-t">${name}</span><span class="lad-d">${what}</span></a>`,
    )
    .join("");
  return `<section class="mast" aria-labelledby="mast-h"><h1 id="mast-h" class="mast-h">An independent research publication by Chris Telford.</h1><p class="mast-p">Theories and papers of his own, the essays and briefs written from them, and the research they stand on. Every quotation is copied word for word from a stored source and links back to it.</p><nav class="lad" aria-label="Sections">${strip}</nav></section>`;
}

/** Writing: the essays and the briefs side by side, each column the
 *  author's own picks. */
function writingSection(): string {
  const col = (slugs: string[]) =>
    slugs
      .flatMap((slug) => {
        const a = article(slug);
        return a && !a.withdrawn ? [writingFor(a)] : [];
      })
      .map(
        (w) =>
          `<a href="${esc(w.route)}" class="wrow"><span class="wrow-t">${esc(w.title.split(/:\s/)[0] ?? w.title)}</span><span class="wrow-d">${esc(w.dek)}</span><span class="wrow-m"><span class="tnum">${esc(shortDate(w.date))}</span><span aria-hidden="true">·</span><span>${w.minutes} min</span><span aria-hidden="true">·</span><span>${esc(w.topic)}</span></span></a>`,
      )
      .join("");
  const n = (form: string) => libraryItems().filter((r) => r.kind === form).length;
  return `<section class="sec" aria-labelledby="w-h"><div class="sec-h"><h2 id="w-h">Writing</h2></div><div class="wcols"><div class="wcol"><div class="wcol-h">${pill("Essay", kindColours("Essay"), "pill lg")}<span>Argue one of the author\u2019s ideas</span></div>${col(FRONT_ESSAYS)}<a href="/writing?kind=Essay" class="row-more">All ${n("Essay")} essays</a></div><div class="wcol"><div class="wcol-h">${pill("Brief", kindColours("Brief"), "pill lg")}<span>Answer one question from the evidence</span></div>${col(FRONT_ARTICLES)}<a href="/writing?kind=Brief" class="row-more">All ${n("Brief")} briefs</a></div></div></section>`;
}

/** Papers: the series card, then the papers that build on it. */
function papersSection(): string {
  const inSeries = new Set(seriesPapers().map((s) => s.paper.slug));
  const more = allPapers()
    .filter((p) => !inSeries.has(p.slug))
    .map(
      (p) =>
        `<a href="/papers/${esc(p.slug)}" class="card pp-more"><span class="pills">${pill("Paper", kindColours("Paper"))}<span class="pp-mm">Builds on the series</span></span><span class="tile-t">${esc(p.title)}</span><span class="tile-d">${esc(p.dek ?? "")}</span></a>`,
    )
    .join("");
  return `<section class="sec" aria-labelledby="p-h"><div class="sec-h"><h2 id="p-h">Papers</h2><a href="/papers" class="sec-a">All papers</a></div>${seriesCard()}${more ? `<div class="grid3" style="margin-top:12px">${more}</div>` : ""}</section>`;
}

function namedHere(): string {
  const cards = NAMED_HERE.flatMap((id) => {
    const t = term(id);
    if (!t) return [];
    return [
      `<a href="${esc(t.route)}" class="card term-card"><span class="pills">${pill("Concept", kindColours("Concept"))}${t.say ? `<span class="term-card-say">${esc(t.say)}</span>` : ""}</span><span class="tile-t">${esc(t.title)}</span><span class="tile-d">${esc(t.definition ?? t.body)}</span>${t.plain ? `<span class="term-card-p">In plain words: ${esc(t.plain)}</span>` : ""}</a>`,
    ];
  });
  const open = libraryItems().filter((r) => r.kind === "Open problem").length;
  return `<section class="sec" aria-labelledby="l-h"><div class="sec-h"><h2 id="l-h">Lexicon</h2><a href="/lexicon" class="sec-a">Every term</a></div><p class="sec-p">Names for patterns the work found that had none. Each has its own page with a definition, examples and how it differs from existing terms.</p><div class="grid3 wide">${cards.join("")}</div><a href="/open" class="open-line"><span class="open-n tnum">${open}</span><span><strong>Open questions.</strong> What the research raised and could not settle, each with what is known and what is missing.</span><span aria-hidden="true" class="open-arrow">\u2192</span></a></section>`;
}

function researchRow(r: LibraryItem, last: boolean): string {
  return `<a href="${esc(r.route)}" class="row rrow${last ? " last" : ""}"><span class="rrow-d tnum">${esc(r.dateLabel ?? shortDate(r.date))}</span><span style="min-width:0"><span class="rrow-t">${esc(r.title)}</span><span class="pills" style="margin-top:6px">${pill(r.sub ?? "Research", kindColours("Research"))}${pill(r.topic, topicColours(r.topic))}</span></span></a>`;
}

function latest(): string {
  const items = latestResearch(4);
  const topics = researchTopics();
  return `<section class="sec" aria-labelledby="r-h"><div class="sec-h"><h2 id="r-h">Research</h2><a href="/research" class="sec-a">All ${publicResearchCount()} reports</a></div><p class="sec-p">The reports everything above stands on, each kept whole and published as it was written. The newest:</p><div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start"><div style="flex:2 1 480px;min-width:0"><div class="rows slim">${items
    .map((r) => researchRow(r, false))
    .join(
      "",
    )}<a href="/research" class="row-more" style="border-top:0">See all ${publicResearchCount()} reports</a></div></div><div class="card" style="flex:1 1 300px;min-width:0;padding:20px"><div style="font-size:16px;font-weight:600;color:var(--ink)">Browse by topic</div><div style="font-size:14px;color:var(--ink-2);margin:4px 0 14px">Everything on one subject: theories, papers, writing and research.</div><div class="pills" style="gap:8px">${topics
    .map(
      (t) =>
        `<a href="/topics/${esc(t.slug)}" class="tpill" style="background:${topicColours(t.name)[0]};color:${topicColours(t.name)[1]}">${esc(t.name)}<span class="n">${t.count}</span></a>`,
    )
    .join("")}</div></div></div></section>`;
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
    body: `${masthead()}${theoriesSection()}${papersSection()}${writingSection()}${namedHere()}${latest()}${checkable()}`,
  });
}
