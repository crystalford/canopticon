// /theories — every theory on one page: its claim, what its propositions rest
// on, and the scale they are graded on. The page is the DefinedTermSet each
// theory's JSON-LD points to, so a search engine finds the set and its terms
// in one place.

import { AUTHOR } from "../author";
import type { Theory } from "../content/store";
import { allTheories } from "../content/store";
import { esc, pill, shell } from "../layout";
import { inline } from "../md";
import { kindColours, longDate } from "../theme";
import { GRADE_COLOURS, GRADE_MEANING } from "./theory";

export const THEORIES_URL = "https://canopticon.com/theories";

function counts(t: Theory): string {
  const n = (g: "Strong" | "Moderate" | "Proposed") =>
    t.propositions.filter((p) => p.grade === g).length;
  return (["Strong", "Moderate", "Proposed"] as const)
    .filter((g) => n(g) > 0)
    .map((g) => `${pill(`${n(g)} ${g.toLowerCase()}`, GRADE_COLOURS[g])}`)
    .join(" ");
}

export function renderTheories(opts: { signedIn?: boolean } = {}): string {
  const list = [...allTheories()].sort((a, b) =>
    (b.revised ?? b.date).localeCompare(a.revised ?? a.date),
  );
  const rows = list
    .map(
      (t) => `<li class="th-row">
  <h2 class="th-t"><a href="/theories/${esc(t.slug)}">${esc(t.title)}</a></h2>
  <p class="th-claim">${inline(t.claim)}</p>
  <p class="th-meta">${counts(t)} <span>${t.propositions.length} propositions · ${t.references.length} primary references · version ${t.version ?? 1}, ${esc(longDate(t.revised ?? t.date))}</span></p>
</li>`,
    )
    .join("\n");
  const scale = (["Strong", "Moderate", "Proposed"] as const)
    .map((g) => `<span>${pill(g, GRADE_COLOURS[g])} ${esc(GRADE_MEANING[g])}</span>`)
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

  const body = `<div class="col prose th-page">
<div class="kicker">${pill("Theory", kindColours("Theory"))}</div>
<h1 class="h-display">Theories</h1>
<p class="dek">Named ideas stated formally. Each gives its claim, the mechanism, propositions graded by the evidence behind them, the primary studies they rest on, how to measure it, what to do about it, where it applies, and what counts against it.</p>
<ol class="th-list">
${rows}
</ol>
<div class="prop-key"><span class="prop-key-h">How propositions are graded</span>${scale}</div>
</div>`;

  return shell({
    title: "Theories",
    description:
      "Named ideas stated formally: a claim, propositions graded by their evidence, primary references, measures, and what counts against each.",
    path: "/theories",
    nav: "library",
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
