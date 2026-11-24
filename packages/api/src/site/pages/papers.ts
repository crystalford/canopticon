// /papers — the long original work, at its own address (2026-11-24). The
// McLuhan series in its reading order, then the papers outside it. Each row
// names what the paper coined and the theory drawn from it, so the ladder
// (theory → paper → term) can be walked from here in either direction.

import { AUTHOR } from "../author";
import type { Paper } from "../content/store";
import { allPapers, terms, theory } from "../content/store";
import { SERIES_NAME, paperMinutes, paperRoute, seriesPapers } from "../data";
import { esc, pill, shell } from "../layout";
import { kindColours, longDate, shortDate } from "../theme";

const SITE = "https://canopticon.com";

/** The terms a paper first stated (terms.json names the paper it came from). */
function coinedIn(slug: string): Array<{ title: string; route: string }> {
  return terms()
    .filter((t) => t.artRoute === paperRoute(slug))
    .map((t) => ({ title: t.title, route: t.route }));
}

function facts(p: Paper, minutes: number): string {
  const coined = coinedIn(p.slug);
  const th = p.theory ? theory(p.theory) : null;
  const bits = [
    `<span>${minutes} min</span>`,
    `<span>${esc(shortDate(p.revised ?? p.date))}</span>`,
    ...(p.version && p.version > 1 ? [`<span>Version ${p.version}</span>`] : []),
    ...(p.doi ? [`<span>doi:${esc(p.doi)}</span>`] : []),
  ];
  const links = [
    ...(coined.length
      ? [
          `<span class="pp-l">Coins</span>${coined.map((c) => `<a href="${esc(c.route)}" class="pp-term">${esc(c.title)}</a>`).join("")}`,
        ]
      : []),
    ...(th
      ? [
          `<span class="pp-l">Theory</span><a href="/theories/${esc(th.slug)}" class="pp-term th">${esc(th.title)}</a>`,
        ]
      : []),
  ];
  return `<span class="pp-f">${bits.join("")}</span>${links.length ? `<span class="pp-x">${links.join("")}</span>` : ""}`;
}

export function renderPapers(opts: { signedIn?: boolean } = {}): string {
  const series = seriesPapers();
  const inSeries = new Set(series.map((s) => s.paper.slug));
  const others = allPapers()
    .filter((p) => !inSeries.has(p.slug))
    .sort((a, b) => (b.revised ?? b.date).localeCompare(a.revised ?? a.date));

  const seriesRows = series
    .map(
      ({ item, paper: p }, i) =>
        `<li class="pp-row"><span class="pp-n">${String(i + 1).padStart(2, "0")}</span><div class="pp-b"><a href="${esc(paperRoute(p.slug))}" class="pp-t">${esc(p.title)}</a><p class="pp-d">${esc(p.dek ?? item.blurb)}</p>${facts(p, item.minutes)}</div><span class="pp-tag">${pill(item.tag, item.tagPair, "pill lg")}</span></li>`,
    )
    .join("");

  const otherRows = others
    .map(
      (p) =>
        `<li class="pp-row"><span class="pp-n" aria-hidden="true">·</span><div class="pp-b"><a href="${esc(paperRoute(p.slug))}" class="pp-t">${esc(p.title)}</a><p class="pp-d">${esc(p.dek ?? "")}</p>${facts(p, paperMinutes(p))}</div><span class="pp-tag">${pill("Paper", kindColours("Paper"), "pill lg")}</span></li>`,
    )
    .join("");

  const days = series.map((s) => s.paper.date).sort();
  const first = days[0] ?? "";
  const last = days[days.length - 1] ?? "";
  // "4–5 October 2026" when the series falls within one month.
  const span =
    first === last || !first
      ? longDate(first)
      : first.slice(0, 7) === last.slice(0, 7)
        ? `${Number(first.slice(8))}\u2013${longDate(last)}`
        : `${longDate(first)} to ${longDate(last)}`;

  const all = [...series.map((s) => s.paper), ...others];
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE}/papers`,
    url: `${SITE}/papers`,
    name: "Papers",
    description:
      "Long original papers by Chris Telford: a seven-paper series reading McLuhan's sense ratios literally, and the papers that build on it.",
    author: AUTHOR,
    hasPart: all.map((p) => ({
      "@type": "ScholarlyArticle",
      headline: p.title,
      url: `${SITE}${paperRoute(p.slug)}`,
      datePublished: p.date,
      author: { "@id": AUTHOR["@id"] },
      ...(p.doi ? { identifier: `https://doi.org/${p.doi}` } : {}),
    })),
  };

  const body = `<div class="col prose pp-page">
<div class="kicker">${pill("Paper", kindColours("Paper"))}</div>
<h1 class="h-display">Papers</h1>
<p class="dek">Long original work. Each paper states a claim, works it through the published research with numbered references, and names what it finds. The terms they coin are in the <a href="/lexicon" class="ulink">Lexicon</a>; the ideas stated formally are the <a href="/theories" class="ulink">Theories</a>.</p>
<section class="pp-sec" aria-labelledby="pp-series">
<div class="pp-sh"><h2 id="pp-series">${esc(SERIES_NAME)}</h2><span class="pp-sm">${series.length} papers · ${esc(span)}</span></div>
<p class="pp-si">Marshall McLuhan said every medium changes \u201cthe ratio among our senses.\u201d The claim was filed as metaphor. These papers read it literally, test it against modern neuroscience from ADHD and typing to drugs and addiction, and end in a synthesis: one configuration of the senses that media, drugs and illness all re-temper. Read in order, or start anywhere.</p>
<ol class="pp-list">${seriesRows}</ol>
</section>
${
  otherRows
    ? `<section class="pp-sec" aria-labelledby="pp-more"><div class="pp-sh"><h2 id="pp-more">Building on the series</h2><span class="pp-sm">${others.length} ${others.length === 1 ? "paper" : "papers"}</span></div><ol class="pp-list">${otherRows}</ol></section>`
    : ""
}
</div>`;

  return shell({
    title: "Papers",
    description:
      "Long original papers by Chris Telford: seven read McLuhan's claim that media change the ratio among the senses literally, against modern neuroscience.",
    path: "/papers",
    nav: "papers",
    signedIn: opts.signedIn ?? false,
    head: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    body,
  });
}
