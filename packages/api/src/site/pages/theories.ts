// /theories — every theory on one page: its claim, what its propositions rest
// on, and the scale they are graded on. The page is the DefinedTermSet each
// theory's JSON-LD points to, so a search engine finds the set and its terms
// in one place.

import { AUTHOR } from "../author";
import type { Theory } from "../content/store";
import { allTheories } from "../content/store";
import { esc, pageHead, shell } from "../layout";
import { formulaHtml, gradeBar, ringFigure } from "./entry";
import { GRADE_MEANING } from "./theory";

export const THEORIES_URL = "https://canopticon.com/theories";

/** A theory's card, wherever theories are listed: a drawing of the idea
 *  (its loop with the cut marked, or its formula where it has no loop), then
 *  its name, the idea in one sentence, the way out, and how its propositions
 *  are graded. */
export function theoryCard(t: Theory, id = ""): string {
  const fig = t.cycle?.length
    ? ringFigure(`rg-${t.slug}`, t.cycle, t.cycle_cut)
    : t.glance_formula
      ? formulaHtml(t.glance_formula, 3)
      : "";
  const way = t.cycle_exit
    ? `<span class="fc-way"><span>Way out</span>${esc(t.cycle_exit)}</span>`
    : "";
  return `<a href="/theories/${esc(t.slug)}" class="card fc"${id ? ` id="${esc(id)}"` : ""}><span class="fc-fig">${fig}</span><span class="fc-b"><span class="fc-t">${esc(t.title)}</span><span class="fc-h">${esc(t.glance_sentence ?? t.dek)}</span>${way}${gradeBar(
    t.propositions.map((p) => p.grade),
    t.references.length,
  )}</span></a>`;
}

export function renderTheories(opts: { signedIn?: boolean } = {}): string {
  const list = [...allTheories()].sort((a, b) =>
    (b.revised ?? b.date).localeCompare(a.revised ?? a.date),
  );
  const rows = list.map((t) => theoryCard(t)).join("\n");
  const scale = (["Strong", "Moderate", "Proposed"] as const)
    .map(
      (g) =>
        `<span><span class="gb-key gb-${g.toLowerCase()}" aria-hidden="true"></span><b>${g}</b> ${esc(GRADE_MEANING[g])}</span>`,
    )
    .join("");

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": THEORIES_URL,
        url: THEORIES_URL,
        name: "Theories",
        description:
          "Named ideas stated formally, each with a claim, propositions graded by their evidence, primary references, measures and the evidence against it.",
        author: AUTHOR,
        mainEntity: { "@id": `${THEORIES_URL}#set` },
      },
      {
        "@type": "DefinedTermSet",
        "@id": `${THEORIES_URL}#set`,
        name: "Canopticon theories",
        url: THEORIES_URL,
        hasDefinedTerm: list.map((t) => ({
          "@type": "DefinedTerm",
          "@id": `https://canopticon.com/theories/${t.slug}#term`,
          name: t.title,
          description: t.dek,
          url: `https://canopticon.com/theories/${t.slug}`,
        })),
      },
    ],
  };

  const body = `${pageHead({
    title: "Theories",
    section: "theories",
    dek: "Named ideas stated formally. Each gives its claim, the mechanism, propositions graded by the evidence behind them, the primary studies they rest on, how to measure it, what to do about it, where it applies, and what counts against it.",
  })}
<div class="th-grid">
${rows}
</div>
<div class="prop-key"><span class="prop-key-h">How propositions are graded</span>${scale}</div>`;

  return shell({
    title: "Theories",
    description:
      "Named ideas stated formally: a claim, propositions graded by their evidence, primary references, measures, and what counts against each.",
    path: "/theories",
    nav: "theories",
    signedIn: opts.signedIn ?? false,
    head: `<link rel="alternate" type="text/markdown" href="/theories.md" />\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    body,
  });
}

/** The same list as Markdown, for machines that read the .md twins. */
export function theoriesMarkdown(): string {
  const out = [
    "# Theories",
    "",
    "> Named ideas stated formally, by Chris Telford. Each gives its claim, graded propositions, primary references, measures, protocol, scope and counter-evidence. CC BY 4.0.",
    "",
    "Grades: Strong = measured directly in at least two independent studies. Moderate = follows from established findings; not tested as stated. Proposed = put forward here; not yet tested.",
    "",
  ];
  for (const t of allTheories()) {
    out.push(
      `## [${t.title}](https://canopticon.com/theories/${t.slug})`,
      "",
      t.claim,
      "",
      ...t.propositions.map((p, i) => `- P${i + 1} (${p.grade}): ${p.statement}`),
      "",
    );
  }
  return out.join("\n");
}
