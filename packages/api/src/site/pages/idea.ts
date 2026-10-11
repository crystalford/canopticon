// /concepts/<id> and /open/<id> — a concept the record named, or a gap a
// document stated. docs/blackbox/README.md §Concept · Open problem;
// pages/Canopticon Term.dc.html and Problem.dc.html. One renderer: the two
// differ only in colour, label and what the status says.

import type { Idea } from "../content/store";
import { article as articleBySlug, libraryItems, problems, terms } from "../content/store";
import { esc, pill, shell } from "../layout";
import { kindColours, topicColours } from "../theme";

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
  const listKind = concept ? "Concept" : "Open problem";
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
  const source = artLive
    ? `<a href="${esc(it.artRoute)}" class="meta-link">${pill(it.artKind ?? "Article", kindColours(it.artKind ?? "Article"))}<span class="t">${esc(it.artTitle ?? "")}</span></a>`
    : it.docRoute
      ? `<a href="${esc(it.docRoute)}" class="meta-link">${pill("Research", kindColours("Research"))}<span class="t">${esc(it.from || "The research")}</span></a>`
      : "";
  const citeTitle = /[?!.]$/.test(it.title) ? it.title : `${it.title}.`;

  const article = `<article class="idea-col"><div class="pills"><a href="/library?kind=${encodeURIComponent(listKind)}" class="pill lg" style="background:${kindColours(kind)[0]};color:${kindColours(kind)[1]}">${esc(kind)}</a>${topic ? pill(topic, topicColours(topic), "pill lg") : ""}</div><h1 class="h-display" style="max-width:none;margin:14px 0 22px">${esc(it.title)}</h1><section class="idea-def ${concept ? "concept" : "problem"}"><div class="idea-def-h">${concept ? "Definition" : "The problem"}</div><p>${esc(it.body)}</p></section><div class="idea-more">More ${concept ? "concepts" : "open problems"}</div><div style="display:flex;flex-direction:column">${others}</div></article>`;

  const rail = `<aside class="rail tight"><div class="meta"><div class="meta-r"><span>Kind</span><span>${pill(kind, kindColours(kind), "pill lg")}</span></div><div class="meta-r"><span>Topic</span><span>${topic ? pill(topic, topicColours(topic), "pill lg") : "—"}</span></div><div class="meta-r"><span>Status</span><span class="pills" style="justify-content:flex-end">${status
    .map(([l, bg, fg]) => pill(l, [bg, fg], "pill lg"))
    .join(
      "",
    )}</span></div>${when ? `<div class="meta-r"><span>${concept ? "Named" : "Added"}</span><span>${esc(when)}</span></div>` : ""}${source ? `<div class="meta-r stack-v"><span>${concept ? "Coined in" : "Stated in"}</span>${source}</div>` : ""}</div><div class="citebox"><div class="citebox-h">Cite this ${concept ? "concept" : "problem"}</div><div class="citebox-t">Telford, C. (2026). ${esc(citeTitle)} Canopticon.</div></div></aside>`;

  const ld = concept
    ? {
        "@context": "https://schema.org",
        "@type": "DefinedTerm",
        name: it.title,
        description: it.body,
        url: `https://canopticon.com${route}`,
        inDefinedTermSet: { "@type": "DefinedTermSet", name: "Canopticon concepts" },
        author: { "@type": "Person", name: "Chris Telford" },
      }
    : {
        "@context": "https://schema.org",
        "@type": "Question",
        name: it.title,
        text: it.body,
        url: `https://canopticon.com${route}`,
        author: { "@type": "Person", name: "Chris Telford" },
      };
  return shell({
    title: it.title,
    description: it.body,
    path: route,
    nav: "library",
    mainClass: "long",
    signedIn: opts.signedIn ?? false,
    head: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    body: `<div class="idea-wrap">${article}${rail}</div>`,
  });
}
