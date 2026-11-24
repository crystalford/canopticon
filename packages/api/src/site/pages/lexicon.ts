// /lexicon — every term the publication coined, on one page: the theories,
// the krasis family, the return of voice, and the rest. Each entry gives the
// sentence that defines it, how to say it and where it was first stated.
// It is the DefinedTermSet every concept page's JSON-LD points to
// (…/lexicon#set), and the page to link when citing the vocabulary as a whole.

import { AUTHOR } from "../author";
import type { Idea } from "../content/store";
import { allTheories, libraryItems, terms } from "../content/store";
import { esc, pill, shell } from "../layout";
import { inline } from "../md";
import { kindColours, longDate } from "../theme";

export const LEXICON_URL = "https://canopticon.com/lexicon";
const SITE = "https://canopticon.com";

interface Entry {
  name: string;
  route: string;
  definition: string;
  say?: string | undefined;
  plain?: string | undefined;
  aka?: string[] | undefined;
  first?: string | undefined;
  firstRoute?: string | undefined;
  date?: string | undefined;
  kind: "Theory" | "Concept";
}

const GROUPS: Array<{ id: string; title: string; intro: string }> = [
  {
    id: "theories",
    title: "Theories",
    intro:
      "Named ideas stated formally, each with a claim, propositions graded by their evidence and the primary studies they rest on.",
  },
  {
    id: "krasis",
    title: "The krasis family",
    intro:
      "Six terms built on the Greek krasis, a tempered mixture, the word inside idiosyncrasy. They come from a series of papers that reads Marshall McLuhan's \u201csense ratios\u201d literally, and each names one way the configuration of the senses is set, shifted, held outside the body or reset.",
  },
  {
    id: "voice",
    title: "The return of voice",
    intro:
      "Three names from the papers on McLuhan's predicted return of the voice: why networked computing stayed typed for fifty years, and what changes as people talk to machines.",
  },
  {
    id: "other",
    title: "Other terms",
    intro: "Terms from articles on prices, advertising and AI agents.",
  },
];

function fromTerm(t: Idea): Entry {
  return {
    name: t.title,
    route: t.route,
    definition: t.definition ?? t.body,
    say: t.say,
    plain: t.plain,
    aka: t.aka,
    first: t.artTitle || t.from || undefined,
    firstRoute: t.artRoute || t.docRoute || undefined,
    date: t.coined,
    kind: "Concept",
  };
}

/** Every entry, grouped. Theories first; concept pages that carry no register
 *  entry (the hand-built ones) come from their Library rows. */
export function lexicon(): Array<{ id: string; title: string; intro: string; entries: Entry[] }> {
  const theoryEntries: Entry[] = [...allTheories()]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((t) => ({
      name: t.title,
      route: `/theories/${t.slug}`,
      definition: t.dek || t.claim,
      first: t.title,
      firstRoute: `/theories/${t.slug}`,
      date: t.date,
      kind: "Theory",
    }));
  const reg = terms();
  const inReg = new Set(reg.map((t) => t.route));
  const handBuilt: Entry[] = libraryItems()
    .filter((r) => r.kind === "Concept" && !inReg.has(r.route))
    .map((r) => ({
      name: r.title,
      route: r.route,
      definition: r.dek,
      date: r.date,
      kind: "Concept",
    }));
  const byFamily = (f: string) => reg.filter((t) => (t.family ?? "other") === f).map(fromTerm);
  const order = (list: Entry[]) => list.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const sets: Record<string, Entry[]> = {
    theories: theoryEntries,
    krasis: order(byFamily("krasis")),
    voice: order(byFamily("voice")),
    other: order([...byFamily("other"), ...handBuilt]),
  };
  return GROUPS.map((g) => ({ ...g, entries: sets[g.id] ?? [] })).filter((g) => g.entries.length);
}

function entryHtml(e: Entry): string {
  const meta = [
    e.say ? `Pronounced <b>${esc(e.say)}</b>` : "",
    e.plain ? `in plain words, <b>${esc(e.plain)}</b>` : "",
    e.first && e.firstRoute && e.kind === "Concept"
      ? `first stated in <a href="${esc(e.firstRoute)}" class="ulink">${esc(e.first)}</a>${e.date ? `, ${esc(longDate(e.date))}` : ""}`
      : e.date
        ? `stated ${esc(longDate(e.date))}`
        : "",
  ].filter(Boolean);
  return `<div class="lx-e" id="${esc(e.route.split("/").pop() ?? "")}"><dt><a href="${esc(e.route)}">${esc(e.name)}</a></dt><dd><p>${inline(e.definition)}</p>${meta.length ? `<p class="lx-m">${meta.join(" · ")}</p>` : ""}</dd></div>`;
}

export function renderLexicon(opts: { signedIn?: boolean } = {}): string {
  const groups = lexicon();
  const all = groups.flatMap((g) => g.entries);
  const toc = groups
    .map(
      (g) =>
        `<a href="#${g.id}" class="chipb">${esc(g.title)} <span>${g.entries.length}</span></a>`,
    )
    .join("");
  const krasisTable = (entries: Entry[]) =>
    `<div class="tbl-wrap"><table class="lx-t"><thead><tr><th>Term</th><th>Pronounced</th><th>In plain words</th></tr></thead><tbody>${entries
      .map(
        (e) =>
          `<tr><td><a href="${esc(e.route)}">${esc(e.name)}</a></td><td>${esc(e.say ?? "")}</td><td>${esc(e.plain ?? "")}</td></tr>`,
      )
      .join("")}</tbody></table></div>`;
  const sections = groups
    .map(
      (g) =>
        `<section class="lx-g" id="${g.id}" aria-labelledby="${g.id}-h"><h2 id="${g.id}-h">${esc(g.title)}</h2><p class="lx-i">${esc(g.intro)}</p>${g.id === "krasis" ? krasisTable(g.entries) : ""}<dl>${g.entries.map(entryHtml).join("")}</dl></section>`,
    )
    .join("");

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": LEXICON_URL,
        url: LEXICON_URL,
        name: "Lexicon",
        description:
          "Every term coined at Canopticon, with its definition, pronunciation and the paper or theory where it was first stated.",
        author: AUTHOR,
        mainEntity: { "@id": `${LEXICON_URL}#set` },
      },
      {
        "@type": "DefinedTermSet",
        "@id": `${LEXICON_URL}#set`,
        name: "Canopticon lexicon",
        url: LEXICON_URL,
        author: AUTHOR,
        hasDefinedTerm: all.map((e) => ({
          "@type": "DefinedTerm",
          "@id": `${SITE}${e.route}#term`,
          name: e.name,
          ...(e.plain || e.aka?.length
            ? { alternateName: [e.plain, ...(e.aka ?? [])].filter(Boolean) }
            : {}),
          description: e.definition,
          url: `${SITE}${e.route}`,
        })),
      },
    ],
  };

  const body = `<div class="col prose lx-page">
<div class="kicker">${pill("Concept", kindColours("Concept"))}</div>
<h1 class="h-display">Lexicon</h1>
<p class="dek">Every term coined at Canopticon, with the sentence that defines it, how to say it and where it was first stated. Each links to its own page, with the questions it answers, examples, how it differs from existing terms and how to cite it.</p>
<nav class="lx-toc" aria-label="Sections">${toc}</nav>
${sections}
<p class="lx-foot">Questions nobody has answered yet are on <a href="/ideas" class="ulink">Ideas</a>. The Markdown of this page: <a href="/lexicon.md" class="ulink">/lexicon.md</a>.</p>
</div>`;

  return shell({
    title: "Lexicon",
    description:
      "Every term coined at Canopticon: theories, the krasis family and the return of voice, each with its definition and the paper where it was first stated.",
    path: "/lexicon",
    nav: "lexicon",
    signedIn: opts.signedIn ?? false,
    head: `<link rel="alternate" type="text/markdown" href="/lexicon.md" />\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    body,
  });
}

/** The same lexicon as Markdown: for the .md twin and llms-full.txt. */
export function lexiconMarkdown(): string {
  const out = [
    "# Lexicon",
    "",
    "> Every term coined at Canopticon by Chris Telford, with its definition and where it was first stated. CC BY 4.0. Cite a term by its own page.",
    "",
  ];
  for (const g of lexicon()) {
    out.push(`## ${g.title}`, "", g.intro, "");
    for (const e of g.entries) {
      const bits = [
        e.say ? `pronounced ${e.say}` : "",
        e.plain ? `in plain words, ${e.plain}` : "",
        e.first && e.firstRoute && e.kind === "Concept"
          ? `first stated in ${e.first} (${SITE}${e.firstRoute})`
          : "",
      ].filter(Boolean);
      out.push(
        `- **[${e.name}](${SITE}${e.route})**: ${e.definition}${bits.length ? ` (${bits.join("; ")})` : ""}`,
      );
    }
    out.push("");
  }
  return out.join("\n");
}
