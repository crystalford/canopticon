// /concepts/<id> and /open/<id> — a concept the record named, or a gap a
// document stated. docs/blackbox/README.md §Concept · Open problem;
// pages/Canopticon Term.dc.html and Problem.dc.html. One renderer: the two
// differ only in colour, label and what the status says.

import { AUTHOR } from "../author";
import type { Idea } from "../content/store";
import {
  article as articleBySlug,
  conceptUses,
  ideaSourcePublic,
  libraryItems,
  paper as paperBySlug,
  problems,
  terms,
} from "../content/store";
import { esc, pill, shell } from "../layout";
import { kindColours, kindLabel, topicColours } from "../theme";

/** "prices & markets" → the library's "Prices & markets". */
function topicName(kick: string | undefined): string {
  if (!kick) return "";
  const known = libraryItems().find((r) => r.topic.toLowerCase() === kick.toLowerCase());
  return known?.topic ?? kick.charAt(0).toUpperCase() + kick.slice(1);
}

export function renderIdea(
  it: Idea,
  kind: "Concept" | "Open problem",
  opts: { signedIn?: boolean } = {},
): string {
  const concept = kind === "Concept";
  const topic = topicName(it.kick);
  const foot = it.foot ?? "";
  const pending = /pending/.test(foot);
  const when = /(\d+ \w{3})/.exec(foot)?.[1] ?? "";
  const status: Array<[string, string, string]> = concept
    ? [
        pending
          ? ["Name check pending", "#f3e9d4", "#6b4e14"]
          : ["No prior use found", "#e3f0e6", "#1f5e36"],
        ...(/counter-argument/.test(foot)
          ? ([["1 counter-argument", "#fbe9df", "#8a3a1f"]] as Array<[string, string, string]>)
          : []),
      ]
    : [["Open", "#fbe9df", "#8a3a1f"]];
  const route = concept ? `/concepts/${it.id}` : `/open/${it.id}`;
  // The prototype lists the other entries of the same register (terms.json or
  // problems.json), each with its topic as the register writes it.
  const others = (concept ? terms() : problems())
    .filter((o) => o.id !== it.id)
    .map(
      (o) =>
        `<a href="${esc(o.route)}" class="lrow"><span class="lrow-t">${esc(o.title)}</span><span class="lrow-k">${esc(o.kick ?? "")}</span></a>`,
    )
    .join("");
  // A withdrawn article is linked from nowhere; name the document instead.
  const artSlug = /^\/articles\/([^/#?]+)/.exec(it.artRoute ?? "")?.[1];
  const artLive = Boolean(it.artRoute) && !(artSlug && articleBySlug(artSlug)?.withdrawn);
  // A held document is never linked or named from a public page: the entry
  // stands without its source rather than pointing at one that is not served.
  const docLive = Boolean(it.docRoute) && ideaSourcePublic(it);
  const source = artLive
    ? `<a href="${esc(it.artRoute)}" class="meta-link">${pill(it.artKind ?? "Article", kindColours(it.artKind ?? "Article"))}<span class="t">${esc(it.artTitle ?? "")}</span></a>`
    : docLive
      ? `<a href="${esc(it.docRoute)}" class="meta-link">${pill("Research", kindColours("Research"))}<span class="t">${esc(it.from || "The research")}</span></a>`
      : "";
  const citeTitle = /[?!.]$/.test(it.title) ? it.title : `${it.title}.`;
  // Every document that names the concept — the same phrase match that links
  // the name inside those documents (site/links.ts).
  const uses = concept ? conceptUses(it.id) : [];
  const usesHtml = uses.length
    ? `<section class="idea-uses" aria-labelledby="uses-h"><div class="idea-more" id="uses-h">Where it appears</div><div style="display:flex;flex-direction:column">${uses
        .map(
          (u) =>
            `<a href="${esc(u.route)}" class="lrow"><span class="lrow-t">${esc(u.title)}</span><span class="lrow-k">${u.date ? esc(u.date.slice(0, 7)) : ""}</span></a>`,
        )
        .join("")}</div></section>`
    : "";

  // The term standard (terms.json): how to say it, where the word comes from,
  // the everyday questions it answers, examples, how it differs from the
  // nearest names, and related entries. Entries without them (added from the
  // workspace) render as before.
  const full = concept && Boolean(it.definition);
  const titleOf = (route: string) =>
    libraryItems().find((r) => r.route === route)?.title ?? route.split("/").pop() ?? route;
  const sec = (h: string, inner: string, id = "") =>
    `<section class="term-sec"${id ? ` id="${id}"` : ""}><h2>${esc(h)}</h2>${inner}</section>`;
  const termParts = full
    ? [
        it.etymology ? sec("Where the word comes from", `<p>${esc(it.etymology)}</p>`) : "",
        it.questions?.length
          ? sec(
              "Questions it answers",
              `<ul>${it.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>`,
            )
          : "",
        it.examples?.length
          ? sec("Examples", `<ul>${it.examples.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`)
          : "",
        it.differs?.length
          ? sec(
              "How it differs from existing terms",
              `<dl class="term-dl">${it.differs.map((d) => `<dt>${esc(d.term)}</dt><dd>${esc(d.how)}</dd>`).join("")}</dl>`,
            )
          : "",
        it.related?.length || it.family
          ? sec(
              "Related",
              `<p class="term-rel">${(it.related ?? [])
                .map((r) => `<a href="${esc(r)}" class="ulink">${esc(titleOf(r))}</a>`)
                .join(" · ")}${
                it.family
                  ? `${it.related?.length ? " · " : ""}<a href="/lexicon#${esc(it.family)}" class="ulink">${it.family === "krasis" ? "The krasis family" : "The return of voice"}, in the Lexicon</a>`
                  : ""
              }</p>`,
            )
          : "",
      ].join("")
    : "";
  const sayLine = full
    ? `<p class="term-say">${it.say ? `<span>Pronounced <b>${esc(it.say)}</b></span>` : ""}${it.plain ? `<span>In plain words: <b>${esc(it.plain)}</b></span>` : ""}</p>`
    : "";
  const artSlugFull = /^\/(?:articles|papers)\/([^/#?]+)/.exec(it.artRoute ?? "")?.[1];
  const coinedPaper = artSlugFull ? paperBySlug(artSlugFull) : null;
  const coinedYear = (it.coined ?? "2026").slice(0, 4);

  const article = `<article class="idea-col"><div class="pills"><a href="${concept ? "/lexicon" : "/open"}" class="pill lg" style="background:${kindColours(kind)[0]};color:${kindColours(kind)[1]}">${esc(kindLabel(kind))}</a>${topic ? pill(topic, topicColours(topic), "pill lg") : ""}</div><h1 class="h-display" style="max-width:none;margin:14px 0 ${full ? "10px" : "22px"}">${esc(it.title)}</h1>${sayLine}<section class="idea-def ${concept ? "concept" : "problem"}"><div class="idea-def-h">${concept ? "Definition" : "The problem"}</div><p>${esc(full ? (it.definition ?? it.body) : it.body)}</p></section>${termParts}${usesHtml}<div class="idea-more">More ${concept ? "terms" : "open questions"}</div><div style="display:flex;flex-direction:column">${others}</div></article>`;

  const rail = `<aside class="rail tight"><div class="meta"><div class="meta-r"><span>Kind</span><span>${pill(kind, kindColours(kind), "pill lg")}</span></div><div class="meta-r"><span>Topic</span><span>${topic ? pill(topic, topicColours(topic), "pill lg") : "—"}</span></div><div class="meta-r"><span>Status</span><span class="pills" style="justify-content:flex-end">${status
    .map(([l, bg, fg]) => pill(l, [bg, fg], "pill lg"))
    .join(
      "",
    )}</span></div>${when ? `<div class="meta-r"><span>${concept ? "Named" : "Added"}</span><span>${esc(when)}</span></div>` : ""}${source ? `<div class="meta-r stack-v"><span>${concept ? "Coined in" : "Stated in"}</span>${source}</div>` : ""}</div><div class="citebox"><div class="citebox-h">Cite this ${concept ? "concept" : "problem"}</div><div class="citebox-t">Telford, C. (${esc(coinedYear)}). ${esc(citeTitle)} Canopticon. canopticon.com${esc(route)}${full && it.artTitle ? `<br><span class="term-first">First stated in ${esc(it.artTitle)}${coinedPaper?.doi ? `, doi:${esc(coinedPaper.doi)}` : ""}.</span>` : ""}</div></div></aside>`;

  const ld = concept
    ? {
        "@context": "https://schema.org",
        "@type": "DefinedTerm",
        "@id": `https://canopticon.com${route}#term`,
        name: it.title,
        ...(full
          ? {
              alternateName: [it.plain, ...(it.aka ?? [])].filter(Boolean),
              dateCreated: it.coined,
              ...(it.artRoute
                ? {
                    subjectOf: {
                      "@type": coinedPaper ? "ScholarlyArticle" : "Article",
                      name: it.artTitle,
                      url: `https://canopticon.com${it.artRoute}`,
                      ...(coinedPaper?.doi
                        ? { identifier: `https://doi.org/${coinedPaper.doi}` }
                        : {}),
                    },
                  }
                : {}),
            }
          : {}),
        description: full ? it.definition : it.body,
        url: `https://canopticon.com${route}`,
        inDefinedTermSet: {
          "@type": "DefinedTermSet",
          "@id": "https://canopticon.com/lexicon#set",
          name: "Canopticon lexicon",
        },
        author: AUTHOR,
      }
    : {
        "@context": "https://schema.org",
        "@type": "Question",
        name: it.title,
        text: it.body,
        url: `https://canopticon.com${route}`,
        author: AUTHOR,
      };
  return shell({
    // A coined term's page and the paper that coined it would otherwise share
    // one <title> ("Heterocrasis") and compete for the one query that matters.
    // This page answers what the word means; the paper keeps the name.
    title: full ? `${it.title}: meaning and origin` : it.title,
    description: full ? (it.definition ?? it.body) : it.body,
    path: route,
    nav: concept ? "lexicon" : "open",
    mainClass: "long",
    signedIn: opts.signedIn ?? false,
    head: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    body: `<div class="idea-wrap">${article}${rail}</div>`,
  });
}
