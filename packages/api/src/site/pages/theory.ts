// /theories/<slug> — a theory: a named idea stated formally. Where a concept
// entry gives a name and a definition, a theory gives the claim, the
// mechanism, propositions graded by their evidence, the measures that make it
// checkable, a protocol, where it applies and where it does not, and what
// counts against it. The body is in the article dialect: every <q> is a
// quotation checked word for word at build, with a receipt to its passage.

import type { Proposition, Theory } from "../content/store";
import { docTitle } from "../data";
import { esc, linkPill, pill, shell } from "../layout";
import { articleHtml, articleQuotes, inline } from "../md";
import { kindColours, longDate, topicColours, topicSlug } from "../theme";
import { citationMeta, citeBlock, jsonLd, statbox, toc } from "./article";

const GRADE_COLOURS: Record<Proposition["grade"], readonly [string, string]> = {
  Strong: ["#e3f0e6", "#1f5e36"],
  Moderate: ["#e4ecf7", "#1f4e8c"],
  Proposed: ["#fbe9df", "#8a3a1f"],
};

const GRADE_MEANING: Record<Proposition["grade"], string> = {
  Strong: "Measured directly, in more than one setting",
  Moderate: "Follows from established findings; not tested as stated",
  Proposed: "Put forward here; not yet tested",
};

function gradeCounts(props: Proposition[]): string {
  return (["Strong", "Moderate", "Proposed"] as const)
    .map((g) => [g, props.filter((p) => p.grade === g).length] as const)
    .filter(([, n]) => n > 0)
    .map(([g, n]) => `${n} ${g.toLowerCase()}`)
    .join(" · ");
}

function propositions(props: Proposition[]): string {
  const rows = props
    .map(
      (p, i) => `<li class="prop" id="p${i + 1}">
  <span class="prop-n">P${i + 1}</span>
  <div class="prop-b"><p class="prop-s">${inline(p.statement)}</p>${
    p.basis ? `<p class="prop-basis">${inline(p.basis)}</p>` : ""
  }</div>
  <span class="prop-g" title="${esc(GRADE_MEANING[p.grade])}">${pill(p.grade, GRADE_COLOURS[p.grade])}</span>
</li>`,
    )
    .join("\n");
  const key = (["Strong", "Moderate", "Proposed"] as const)
    .map((g) => `<span>${pill(g, GRADE_COLOURS[g])} ${esc(GRADE_MEANING[g])}</span>`)
    .join("");
  return `<section class="props" id="propositions" aria-labelledby="props-h">
<h2 id="props-h">Propositions</h2>
<ol class="prop-list">
${rows}
</ol>
<div class="prop-key">${key}</div>
</section>`;
}

export function renderTheory(t: Theory, opts: { signedIn?: boolean } = {}): string {
  const ctx = { docTitle };
  const body = articleHtml(t.body, ctx);
  const quotes = articleQuotes(t.body).length;
  const url = `https://canopticon.com/theories/${t.slug}`;
  const cite =
    t.cite ??
    `Telford, C. (${t.date.slice(0, 4)}). ${t.title}. Canopticon. canopticon.com/theories/${t.slug}`;
  const based = (t.based_on ?? []).filter((b) => docTitle(b.id) !== null);
  const version = t.version ?? 1;

  const header = `<div style="margin-bottom:24px">
<div class="kicker">${pill("Theory", kindColours("Theory"))}${linkPill(`/topics/${topicSlug(t.topic)}`, t.topic, topicColours(t.topic))}${pill(`Version ${version}`, ["#efebe1", "#15171c"])}</div>
<h1 class="h-display">${esc(t.title)}</h1>
<p class="dek">${esc(t.dek)}</p>
<div class="byline"><a href="/about#m-author" class="who">Chris Telford</a><span class="chip">Coined <time datetime="${esc(t.date)}">${esc(longDate(t.date))}</time></span>${
    t.revised
      ? `<span class="chip">Revised <time datetime="${esc(t.revised)}">${esc(longDate(t.revised))}</time></span>`
      : ""
  }<span class="chip">${t.propositions.length} propositions</span><span class="chip">${quotes} quotes</span></div>
</div>
<section class="theory-card" aria-label="The theory in brief">
  <div class="tc-row"><span class="tc-l">Claim</span><p>${inline(t.claim)}</p></div>
  <div class="tc-row"><span class="tc-l">Evidence</span><p>${esc(gradeCounts(t.propositions))} propositions. Each is graded below by what stands behind it.</p></div>
  ${t.coined ? `<div class="tc-row"><span class="tc-l">Coined</span><p>${esc(t.coined)}</p></div>` : ""}
</section>`;

  const related = (t.related ?? [])
    .map((r) => `<a class="src-pill" href="${esc(r.route)}">${esc(r.label)}</a>`)
    .join("");
  const sources = `<section class="panel cols" aria-label="Sources and citation">${
    based.length
      ? `<div><h3>Based on</h3><div class="src-list">${based
          .map(
            (b) =>
              `<a class="src-pill" href="/p/${esc(b.id)}">${esc(b.label || docTitle(b.id) || "")}</a>`,
          )
          .join("")}</div></div>`
      : ""
  }${related ? `<div><h3>Elsewhere in the record</h3><div class="src-list">${related}</div></div>` : ""}${citeBlock(cite)}</section>`;

  const col = `<article class="col prose theory">${header}${propositions(t.propositions)}${body.html}${sources}</article>`;
  const rail = `<aside class="rail">${statbox(t.topic, [String(t.propositions.length), "Propositions"], [String(quotes), "Quotes"])}${toc("In this theory", body.heads, { text: "Propositions", href: "#propositions" })}</aside>`;

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ScholarlyArticle",
        "@id": url,
        headline: t.title,
        description: t.claim,
        url,
        datePublished: t.date,
        ...(t.revised ? { dateModified: t.revised } : {}),
        version: String(version),
        genre: "Theory",
        author: { "@type": "Person", name: "Chris Telford", url: "https://canopticon.com/about" },
        publisher: { "@type": "Organization", name: "Canopticon", url: "https://canopticon.com" },
        license: "https://creativecommons.org/licenses/by/4.0/",
        isBasedOn: based.map((b) => `https://canopticon.com/p/${b.id}`),
        about: { "@id": `${url}#term` },
      },
      {
        "@type": "DefinedTerm",
        "@id": `${url}#term`,
        name: t.title,
        description: t.dek,
        url,
        inDefinedTermSet: {
          "@type": "DefinedTermSet",
          name: "Canopticon theories",
          url: "https://canopticon.com/library?kind=Theory",
        },
      },
    ],
  };

  return shell({
    title: `${t.title}: a theory`,
    description: t.dek,
    path: `/theories/${t.slug}`,
    nav: "library",
    progress: true,
    ogType: "article",
    mainClass: "long",
    signedIn: opts.signedIn ?? false,
    head: `${citationMeta(t.title, t.date, url)}\n<link rel="alternate" type="text/markdown" href="/theories/${esc(t.slug)}.md" />\n${jsonLd(ld)}`,
    body: `<div class="rr">${col}${rail}</div>`,
  });
}
