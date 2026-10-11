// / — the front page. docs/blackbox/README.md §Front; pages/Canopticon
// Front.dc.html. Curated by the author: the McLuhan series as one numbered
// card, three starting points, a hand-picked run of articles, three concepts,
// the latest research and the topics. New articles do not appear here on
// their own (author decision, 10 Oct) — the counts are live, the picks are not.

import type { LibraryItem } from "../content/store";
import { article, paper, term } from "../content/store";
import {
  latestResearch,
  listedArticles,
  publicResearchCount,
  researchTopics,
  seriesPapers,
  writingFor,
} from "../data";
import { esc, pill, shell } from "../layout";
import { kindColours, longDate, shortDate, topicColours } from "../theme";

/** The author's picks, in order. A slug that disappears is skipped, not
 *  replaced: a curated page does not quietly re-curate itself. */
const START_HERE: Array<{ kind: "article" | "paper"; slug: string; title: string; why: string }> = [
  {
    kind: "article",
    slug: "self-extinguishing-maintenance",
    title: "Self-extinguishing maintenance",
    why: "The clearest example of what this site does: a pattern with no name, found in the research and named.",
  },
  {
    kind: "article",
    slug: "why-people-keep-scrolling",
    title: "Why people keep scrolling",
    why: "A popular explanation, checked against the evidence, and mostly wrong.",
  },
  {
    kind: "paper",
    slug: "krasis",
    title: "Krasis",
    why: "The long project: seven papers taking one of McLuhan’s claims literally.",
  },
];

const FRONT_ARTICLES = [
  "paying-yourself-to-do-your-own-tasks",
  "canadian-recessions-and-the-mortgage-channel",
  "temporary-foreign-workers-and-canadian-innovation",
  "whey-protein-in-hot-black-coffee",
  "bill-c-11-and-canadian-creators-in-2026",
];

const NAMED_HERE: Array<{ id: string; route: string; blurb: string }> = [
  {
    id: "self-extinguishing-maintenance",
    route: "/concepts/self-extinguishing-maintenance",
    blurb:
      "A routine that works so well it removes the thing that made you do it — so it stops, and the problem comes back.",
  },
  {
    id: "sensory-syncrasis",
    route: "/concepts/sensory-syncrasis",
    blurb:
      "The whole configuration of how the brain blends its senses: how much it trusts each one, how loud it turns them all, whether it fuses or separates them, the balance between body and world, and how long a setting lasts.",
  },
  {
    id: "typomora",
    route: "/concepts/typomora",
    blurb:
      "The typed delay in McLuhan's predicted return to voice: fifty years in which the keyboard, not the medium, kept networked communication typographic.",
  },
];

function seriesCard(): string {
  const series = seriesPapers();
  const rows = series
    .map(
      ({ item, paper: p }, i) =>
        `<a href="/articles/${esc(p.slug)}" class="ser-row${i ? "" : " first"}"><span class="ser-n">${String(i + 1).padStart(2, "0")}</span><span style="min-width:0"><span class="ser-t">${esc(p.title)}</span><span class="ser-d">${esc(item.blurb)}</span></span><span class="ser-r">${pill(item.tag, item.tagPair, "pill lg")}<span class="ser-m">${item.minutes} min</span></span></a>`,
    )
    .join("");
  const days = series.map((s) => s.paper.date).sort();
  const first = days[0] ?? "";
  const last = days[days.length - 1] ?? "";
  const d1 = shortDate(first).split(" ")[0] ?? "";
  const span = first === last ? longDate(first) : `${d1}–${longDate(last)}`;
  return `<section aria-label="The McLuhan paper series" class="ser"><div class="ser-head"><div class="pills" style="margin-bottom:14px"><span class="pill lg" style="background:#e9dcf5;color:#5a2d82">Paper series</span><span class="pill lg" style="background:var(--card);color:#5a2d82">${series.length} papers · read in order or dip in</span></div><h2 class="ser-h">McLuhan said every medium changes the ratio among our senses. Seven papers take that literally.</h2><p class="ser-p">Six papers test it — from ADHD and typing to drugs and addiction — and the synthesis finds one configuration that media, drugs and illness all re-temper.</p></div><div>${rows}</div><p class="ser-foot">Each paper cites the published literature with numbered references · published ${esc(span)}</p></section>`;
}

function startHere(): string {
  const cards = START_HERE.flatMap((s) => {
    const exists = s.kind === "article" ? article(s.slug) : paper(s.slug);
    if (!exists) return [];
    const kind = s.kind === "article" ? "Article" : "Paper";
    return [
      `<a href="/articles/${esc(s.slug)}" class="card" style="align-items:flex-start">${pill(kind, kindColours(kind))}<span class="tile-t">${esc(s.title)}</span><span class="tile-d">${esc(s.why)}</span></a>`,
    ];
  });
  return `<section style="margin-top:56px" aria-label="Start here"><div class="sec-h"><h2>New here? Start with these three</h2></div><div class="grid3">${cards.join("")}</div></section>`;
}

function articlesList(): string {
  const picks = FRONT_ARTICLES.flatMap((slug) => {
    const a = article(slug);
    return a ? [writingFor(a)] : [];
  });
  const total = listedArticles().length;
  const rows = picks
    .map(
      (w) =>
        `<a href="${esc(w.route)}" class="row"><span style="min-width:0"><span class="row-t">${esc(w.title)}</span><span class="row-d">${esc(w.dek)}</span></span><span class="row-r"><span class="row-date">${esc(shortDate(w.date))}</span><span style="margin-top:4px">${pill(w.topic, topicColours(w.topic))}</span></span></a>`,
    )
    .join("");
  return `<section class="sec"><div class="sec-h"><h2>Articles &amp; papers</h2></div><div class="rows">${rows}<a href="/library?kind=Article" class="row-more">See all ${total} articles</a></div></section>`;
}

function namedHere(): string {
  const cards = NAMED_HERE.flatMap((n) => {
    const t = term(n.id);
    const title =
      t?.title ??
      (n.id === "self-extinguishing-maintenance" ? "Self-extinguishing maintenance" : "");
    if (!title) return [];
    return [
      `<a href="${esc(n.route)}" class="card" style="padding:22px 22px 24px"><span style="font-size:20px;line-height:1.25;font-weight:500;letter-spacing:-.012em;color:var(--ink)">${esc(title)}</span><span style="font-size:15px;line-height:1.55;color:var(--ink-2)">${esc(n.blurb)}</span></a>`,
    ];
  });
  return `<section class="sec"><div class="sec-h"><h2>Named here</h2></div><div class="grid3 wide">${cards.join("")}</div><div style="margin-top:14px"><a href="/library?kind=Concept" class="btn">See all concepts and open problems</a></div></section>`;
}

function researchRow(r: LibraryItem, last: boolean): string {
  return `<a href="${esc(r.route)}" class="row rrow${last ? " last" : ""}"><span class="rrow-d tnum">${esc(r.dateLabel ?? shortDate(r.date))}</span><span style="min-width:0"><span class="rrow-t">${esc(r.title)}</span><span class="pills" style="margin-top:6px">${pill(r.sub ?? "Research", kindColours("Research"))}${pill(r.topic, topicColours(r.topic))}</span></span></a>`;
}

function latest(): string {
  const items = latestResearch(4);
  const topics = researchTopics();
  return `<section class="sec"><div class="sec-h"><h2>Latest research</h2></div><div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start"><div style="flex:2 1 480px;min-width:0"><div class="rows slim">${items
    .map((r) => researchRow(r, false))
    .join(
      "",
    )}<a href="/library?kind=Research" class="row-more" style="border-top:0">See all ${publicResearchCount()} research documents</a></div></div><div class="card" style="flex:1 1 300px;min-width:0;padding:20px"><div style="font-size:16px;font-weight:600;color:var(--ink)">Browse by topic</div><div style="font-size:14px;color:var(--ink-2);margin:4px 0 14px">Everything in the library on one subject.</div><div class="pills" style="gap:8px">${topics
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
        founder: { "@type": "Person", name: "Chris Telford", url: "https://canopticon.com/about" },
      },
      {
        "@type": "WebSite",
        "@id": "https://canopticon.com/#site",
        name: "Canopticon",
        url: "https://canopticon.com/",
        description: "A research and development notebook by Chris Telford.",
        publisher: { "@id": "https://canopticon.com/#org" },
        author: { "@type": "Person", name: "Chris Telford", url: "https://canopticon.com/about" },
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
      "A research and development notebook by Chris Telford. Every quote links back to its source.",
    path: "/",
    signedIn: opts.signedIn ?? false,
    head: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    body: `<h1 class="vh">canopticon — research, kept whole and written from</h1>${seriesCard()}${startHere()}${articlesList()}${namedHere()}${latest()}${checkable()}`,
  });
}
