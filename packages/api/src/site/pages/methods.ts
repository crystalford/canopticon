// /methods — procedures you can run (2026-11-28). A method is a theory's
// protocol made into a tool: steps a person can follow, the exact instruction
// for a language model, a worked example on a piece from this site, and where
// it fails. Each also downloads as a Claude skill (SKILL.md), so it can be
// installed and run on any piece of writing. Results shown here were run by
// the author and stored; nothing on these pages calls a model.

import { AUTHOR } from "../author";
import type { Method } from "../content/store";
import { allMethods, theory } from "../content/store";
import { esc, pageHead, pill, shell } from "../layout";
import { articleHtml, inline } from "../md";
import { kindColours, longDate } from "../theme";
import { citeBlock, statbox, toc } from "./article";

const SITE = "https://canopticon.com";
export const METHODS_URL = `${SITE}/methods`;

/** The body without the instruction's own section: the page shows the
 *  instruction in its own panel, with a copy button and the skill link. */
function bodyWithoutInstruction(m: Method): string {
  return m.body.replace(/^## The instruction\s*$[\s\S]*?(?=^## )/m, "");
}

/** A skill name Claude accepts: lowercase words joined by hyphens. */
export const skillName = (m: Method) => m.slug.replace(/[^a-z0-9-]/g, "").slice(0, 64);

function theoryLink(m: Method): string {
  const t = theory(m.theory);
  return t ? `<a href="/theories/${esc(t.slug)}" class="ulink">${esc(t.title)}</a>` : "";
}

export function renderMethods(opts: { signedIn?: boolean } = {}): string {
  const list = allMethods();
  const cards = list
    .map((m) => {
      const t = theory(m.theory);
      return `<a href="/methods/${esc(m.slug)}" class="card th-card"><span class="pills">${pill("Method", kindColours("Method"))}<span class="th-card-v">Version ${m.version} · ${esc(longDate(m.date))}</span></span><span class="th-card-t">${esc(m.title)}</span><span class="th-card-d">${esc(m.dek)}</span><span class="th-card-c"><span class="th-card-l">Use it</span>${inline(m.use_when)}</span><span class="th-card-m"><span>${m.steps.length} steps${t ? ` · from the theory ${esc(t.title)}` : ""}</span></span></a>`;
    })
    .join("\n");
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": METHODS_URL,
    url: METHODS_URL,
    name: "Methods",
    description:
      "Procedures built from the theories and the research behind them, each as steps for a person and an instruction for a language model.",
    author: AUTHOR,
    hasPart: list.map((m) => ({
      "@type": "HowTo",
      name: m.title,
      url: `${METHODS_URL}/${m.slug}`,
    })),
  };
  const body = `${pageHead({
    title: "Methods",
    section: "methods",
    dek: "Procedures you can run, each built from one of the theories and the research behind it. Every method gives the steps for a person, the exact instruction for a language model, a worked example and where it fails, and downloads as a skill for Claude.",
  })}
<div class="th-grid">
${cards}
</div>`;
  return shell({
    title: "Methods",
    description:
      "Procedures built from the theories and the research behind them: steps for a person, an instruction for a language model, a worked example, and where each fails.",
    path: "/methods",
    nav: "methods",
    signedIn: opts.signedIn ?? false,
    head: `<link rel="alternate" type="text/markdown" href="/methods.md" />\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    body,
  });
}

export function renderMethod(m: Method, opts: { signedIn?: boolean } = {}): string {
  const body = articleHtml(bodyWithoutInstruction(m), { docTitle: () => null });
  const url = `${METHODS_URL}/${m.slug}`;
  const t = theory(m.theory);
  const cite = `Telford, C. (${m.date.slice(0, 4)}). ${m.title} (version ${m.version}). Canopticon. canopticon.com/methods/${m.slug}`;
  const header = `<div style="margin-bottom:24px">
<div class="kicker">${pill("Method", kindColours("Method"))}${pill(`Version ${m.version}`, ["#efebe1", "#15171c"])}</div>
<h1 class="h-display">${esc(m.title)}</h1>
<p class="dek">${esc(m.dek)}</p>
<div class="byline"><a href="/about#m-author" class="who">Chris Telford</a><span class="chip"><time datetime="${esc(m.date)}">${esc(longDate(m.date))}</time></span><span class="chip">${m.steps.length} steps</span>${t ? `<span class="chip">From the theory ${theoryLink(m)}</span>` : ""}</div>
</div>
<section class="theory-card" aria-label="The method in brief">
  <div class="tc-row"><span class="tc-l">Use it</span><p>${inline(m.use_when)}</p></div>
  <div class="tc-row"><span class="tc-l">Takes</span><p>${inline(m.input)}</p></div>
  <div class="tc-row"><span class="tc-l">Gives</span><p>${inline(m.output)}</p></div>
</section>`;
  const instruction = `<section class="mth-inst" id="the-instruction" aria-labelledby="mth-inst-h"><div class="mth-inst-h"><h2 id="mth-inst-h">The instruction</h2><span class="mth-inst-a"><button type="button" class="btn sm" data-copy-target="mth-inst-t">Copy</button><a class="btn sm primary" href="/methods/${esc(m.slug)}/SKILL.md" download="SKILL.md">Download as a skill</a></span></div><p class="mth-inst-p">Paste it, followed by the piece, into a conversation with a language model. As a skill, save the file in a folder named <code>${esc(skillName(m))}</code> in your Claude skills.</p><pre class="mth-inst-t" id="mth-inst-t">${esc(m.instruction)}</pre></section>`;
  // The instruction panel sits where its section was: after Steps.
  const at = body.html.search(/<h2[^>]*>(?:<span[^>]*>\d+<\/span>)?Worked example<\/h2>/);
  const html =
    at >= 0 ? body.html.slice(0, at) + instruction + body.html.slice(at) : body.html + instruction;
  const sources = `<section class="panel cols" aria-label="Sources and citation">${
    t
      ? `<div><h3>The theory behind it</h3><div class="src-list"><a class="src-pill" href="/theories/${esc(t.slug)}">${esc(t.title)}</a></div></div>`
      : ""
  }<div><h3>Plain text</h3><div class="src-list"><a class="src-pill" href="/methods/${esc(m.slug)}.md">This method as Markdown</a><a class="src-pill" href="/methods/${esc(m.slug)}/SKILL.md">As a Claude skill</a></div></div>${citeBlock(cite)}</section>`;
  const heads = body.heads.flatMap((h) =>
    h.text === "Worked example"
      ? [{ n: "", text: "The instruction", href: "#the-instruction" }, h]
      : [h],
  );
  const col = `<article class="col prose theory">${header}${html}${sources}</article>`;
  const rail = `<aside class="rail">${statbox(t?.topic ?? "Methods", [String(m.steps.length), "Steps"], [`v${m.version}`, "Version"])}${toc("In this method", heads)}</aside>`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": url,
    name: m.title,
    description: m.dek,
    url,
    datePublished: m.date,
    version: String(m.version),
    author: AUTHOR,
    license: "https://creativecommons.org/licenses/by/4.0/",
    ...(t ? { isBasedOn: `${SITE}/theories/${t.slug}` } : {}),
    step: m.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
  };
  return shell({
    title: `${m.title}: a method`,
    description: m.dek,
    path: `/methods/${m.slug}`,
    nav: "methods",
    progress: true,
    ogType: "article",
    mainClass: "long",
    signedIn: opts.signedIn ?? false,
    head: `<link rel="alternate" type="text/markdown" href="/methods/${esc(m.slug)}.md" />\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    body: `<div class="rr">${col}${rail}</div>`,
  });
}

/** The method as Markdown: the .md twin, the feeds and llms-full.txt. */
export function methodMarkdown(m: Method): string {
  const t = theory(m.theory);
  return [
    `# ${m.title}`,
    "",
    `> ${m.dek}`,
    "",
    `- **Use it:** ${m.use_when}`,
    `- **Takes:** ${m.input}`,
    `- **Gives:** ${m.output}`,
    ...(t ? [`- **From the theory:** [${t.title}](${SITE}/theories/${t.slug})`] : []),
    `- **Version:** ${m.version}`,
    `- **As a Claude skill:** ${SITE}/methods/${m.slug}/SKILL.md`,
    "",
    m.body.trim(),
    "",
  ].join("\n");
}

/** Every method, for /methods.md. */
export function methodsMarkdown(): string {
  return [
    "# Methods",
    "",
    "> Procedures built from the theories on canopticon.com and the research behind them, by Chris Telford. Each gives steps for a person, the exact instruction for a language model, a worked example and where it fails, and downloads as a Claude skill. CC BY 4.0.",
    "",
    ...allMethods().flatMap((m) => [
      `## [${m.title}](${SITE}/methods/${m.slug})`,
      "",
      m.dek,
      "",
      `Use it: ${m.use_when}`,
      "",
    ]),
  ].join("\n");
}

/** The method as a Claude skill: name and description in front matter (the
 *  description says when to use it), then the instruction, the steps behind
 *  it and where it fails, with its address so it can be checked. */
export function methodSkill(m: Method): string {
  const fails = /^## Where it fails\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(m.body)?.[1]?.trim();
  const description = `${m.title}. ${m.use_when}`.replace(/\s+/g, " ").slice(0, 1000);
  return [
    "---",
    `name: ${skillName(m)}`,
    `description: ${JSON.stringify(description)}`,
    "---",
    "",
    `# ${m.title}`,
    "",
    m.dek,
    "",
    `Method version ${m.version}, from canopticon.com/methods/${m.slug} (Chris Telford, CC BY 4.0). The research behind it: canopticon.com/theories/${m.theory}.`,
    "",
    `**Takes:** ${m.input}`,
    "",
    `**Gives:** ${m.output}`,
    "",
    "## What to do",
    "",
    m.instruction,
    "",
    ...(fails ? ["## Where it fails", "", fails, ""] : []),
  ].join("\n");
}
