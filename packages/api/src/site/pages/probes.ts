// /probes — ideas in progress (2026-11-28): story ideas, scenes, characters,
// short probes, poems and lyrics, and notes on what is being built. Less
// formal than the theories and essays, and dated as they grow from a seed to a
// draft to a finished piece. A scene can be written in screenplay form inside
// a ```screenplay block, and is set the way a script page is.

import { AUTHOR } from "../author";
import type { Probe } from "../content/store";
import { allProbes, theory } from "../content/store";
import { esc, pageHead, pill, shell } from "../layout";
import { articleHtml, inline } from "../md";
import { kindColours, longDate } from "../theme";
import { citeBlock } from "./article";
import { kindWord, metaLine } from "./entry";

const SITE = "https://canopticon.com";
export const PROBES_URL = `${SITE}/probes`;

export const PROBE_FORMS = [
  "Story idea",
  "Scene",
  "Character",
  "Probe",
  "Poem",
  "Lyrics",
  "Build note",
] as const;

// ---- screenplay ------------------------------------------------------------

const HEADING = /^(INT\.|EXT\.|INT\/EXT\.|INT\.\/EXT\.|I\/E\.?|EST\.)\s/i;
const TRANSITION = /^[A-Z][A-Z .']*TO:$/;
/** A character cue: capitals (and an extension such as (V.O.)), short. */
const CUE = /^[A-Z][A-Z0-9 .'\-]{0,38}(\s*\([A-Z.' ]+\))?$/;

/** A screenplay block, set as a script page: scene headings, action,
 *  character cues, parentheticals, dialogue and transitions, read from the
 *  plain text the way screenwriting software reads it (a subset of Fountain). */
export function screenplayHtml(text: string): string {
  const blocks = text
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n/);
  const out: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    const first = (lines[0] ?? "").trim();
    if (HEADING.test(first) && lines.length === 1) {
      out.push(`<p class="sp-h">${esc(first.toUpperCase())}</p>`);
      continue;
    }
    if (TRANSITION.test(first) && lines.length === 1) {
      out.push(`<p class="sp-t">${esc(first)}</p>`);
      continue;
    }
    if (lines.length > 1 && CUE.test(first) && first === first.toUpperCase()) {
      out.push(`<p class="sp-c">${esc(first)}</p>`);
      for (const l of lines.slice(1)) {
        const t = l.trim();
        if (!t) continue;
        out.push(
          /^\(.*\)$/.test(t) ? `<p class="sp-p">${esc(t)}</p>` : `<p class="sp-d">${esc(t)}</p>`,
        );
      }
      continue;
    }
    out.push(`<p class="sp-a">${lines.map((l) => esc(l.trim())).join("<br />")}</p>`);
  }
  return `<div class="sp" role="group" aria-label="Screenplay">${out.join("")}</div>`;
}

/** The body, with each ```screenplay block set as a script page and the rest
 *  in the article dialect. */
function probeBody(p: Probe): string {
  const parts = p.body.split(/^```screenplay\s*\n([\s\S]*?)^```\s*$/m);
  return parts
    .map((part, i) =>
      i % 2
        ? screenplayHtml(part)
        : part.trim()
          ? articleHtml(part, { docTitle: () => null }).html
          : "",
    )
    .join("");
}

// ---- pages -----------------------------------------------------------------

function row(p: Probe): string {
  return `<a href="/probes/${esc(p.slug)}" class="wrow"><span class="er-t">${esc(p.title)}</span><span class="er-h">${esc(p.dek)}</span>${metaLine([p.stage, longDate(p.date)], kindWord("Probe", p.form))}</a>`;
}

export function renderProbes(
  query: { form?: string | undefined } = {},
  opts: { signedIn?: boolean } = {},
) {
  const all = allProbes();
  const form = PROBE_FORMS.find((f) => f === query.form) ?? "";
  const list = form ? all.filter((p) => p.form === form) : all;
  const present = PROBE_FORMS.filter((f) => all.some((p) => p.form === f));
  const chips =
    present.length > 1
      ? `<nav class="tchips" aria-label="Forms"><a href="/probes"${form ? "" : ' aria-current="true"'}>All<span class="n">${all.length}</span></a>${present
          .map(
            (f) =>
              `<a href="/probes?form=${encodeURIComponent(f)}"${f === form ? ' aria-current="true"' : ""}>${esc(f)}<span class="n">${all.filter((p) => p.form === f).length}</span></a>`,
          )
          .join("")}</nav>`
      : "";
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": PROBES_URL,
    url: PROBES_URL,
    name: "Probes",
    description:
      "Ideas in progress by Chris Telford: story ideas, scenes, characters, short probes, poems and notes on what he is building.",
    author: AUTHOR,
    hasPart: all.map((p) => ({
      "@type": "CreativeWork",
      name: p.title,
      genre: p.form,
      url: `${PROBES_URL}/${p.slug}`,
    })),
  };
  const body = `${pageHead({
    title: "Probes",
    section: "probes",
    dek: "Ideas in progress: story ideas, scenes, characters, short probes in the manner of McLuhan's, poems and lyrics, and notes on what is being built. Each starts as a seed and is dated as it grows.",
  })}
${chips}
<div class="wgrid one">${list.length ? list.map(row).join("") : '<p class="muted">Nothing in this form yet.</p>'}</div>`;
  return shell({
    title: "Probes",
    description:
      "Ideas in progress by Chris Telford: story ideas, scenes, characters, short probes, poems and notes on what he is building.",
    path: form ? `/probes?form=${encodeURIComponent(form)}` : "/probes",
    nav: "probes",
    signedIn: opts.signedIn ?? false,
    head: `<link rel="alternate" type="text/markdown" href="/probes.md" />\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    body,
  });
}

export function renderProbe(p: Probe, opts: { signedIn?: boolean } = {}): string {
  const url = `${PROBES_URL}/${p.slug}`;
  const t = p.theory ? theory(p.theory) : null;
  const cite = `Telford, C. (${p.date.slice(0, 4)}). ${p.title}. Canopticon. canopticon.com/probes/${p.slug}`;
  const header = `<div style="margin-bottom:24px">
<div class="kicker">${pill(p.form, kindColours("Probe"))}${pill(p.stage, ["#efebe1", "#15171c"])}</div>
<h1 class="h-display">${esc(p.title)}</h1>
<p class="dek">${esc(p.dek)}</p>
<div class="byline"><a href="/about#m-author" class="who">Chris Telford</a><span class="chip"><time datetime="${esc(p.date)}">${esc(longDate(p.date))}</time></span></div>
</div>`;
  const spark =
    p.sparked_by || t
      ? `<section class="panel cols" aria-label="Where it came from"><div><h3>Sparked by</h3>${
          p.sparked_by
            ? `<p class="sp-src">${p.source_url ? `<a href="${esc(p.source_url)}" class="ulink">${inline(p.sparked_by)}</a>` : inline(p.sparked_by)}</p>`
            : ""
        }${t ? `<div class="src-list"><a class="src-pill" href="/theories/${esc(t.slug)}">${esc(t.title)}</a></div>` : ""}</div><div><h3>Plain text</h3><div class="src-list"><a class="src-pill" href="/probes/${esc(p.slug)}.md">This probe as Markdown</a></div></div>${citeBlock(cite)}</section>`
      : `<section class="panel cols" aria-label="Citation"><div><h3>Plain text</h3><div class="src-list"><a class="src-pill" href="/probes/${esc(p.slug)}.md">This probe as Markdown</a></div></div>${citeBlock(cite)}</section>`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": url,
    name: p.title,
    description: p.dek,
    genre: p.form,
    creativeWorkStatus: p.stage,
    url,
    dateCreated: p.date,
    author: AUTHOR,
    license: "https://creativecommons.org/licenses/by/4.0/",
    ...(t ? { isBasedOn: `${SITE}/theories/${t.slug}` } : {}),
  };
  return shell({
    title: `${p.title}: ${p.form.toLowerCase()}`,
    description: p.dek,
    path: `/probes/${p.slug}`,
    nav: "probes",
    ogType: "article",
    signedIn: opts.signedIn ?? false,
    head: `<link rel="alternate" type="text/markdown" href="/probes/${esc(p.slug)}.md" />\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    body: `<article class="col prose probe">${header}${probeBody(p)}${spark}</article>`,
  });
}

/** A probe as Markdown: its facts, then the body as written. */
export function probeMarkdown(p: Probe): string {
  return [
    `# ${p.title}`,
    "",
    `> ${p.dek}`,
    "",
    `- **Form:** ${p.form}`,
    `- **Stage:** ${p.stage}`,
    `- **Date:** ${p.date}`,
    ...(p.sparked_by
      ? [`- **Sparked by:** ${p.sparked_by}${p.source_url ? ` (${p.source_url})` : ""}`]
      : []),
    "",
    p.body.trim(),
    "",
  ].join("\n");
}

export function probesMarkdown(): string {
  return [
    "# Probes",
    "",
    "> Ideas in progress by Chris Telford: story ideas, scenes, characters, short probes, poems and lyrics, and notes on what is being built.",
    "",
    ...allProbes().map(
      (p) =>
        `- [${p.title}](${PROBES_URL}/${p.slug}) (${p.form}, ${p.stage.toLowerCase()}): ${p.dek}`,
    ),
    "",
  ].join("\n");
}
