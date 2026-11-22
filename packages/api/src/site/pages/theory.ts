// /theories/<slug> — a theory: a named idea stated formally. Where a concept
// entry gives a name and a definition, a theory gives the claim, the
// mechanism, propositions graded by their evidence, the measures that make it
// checkable, a protocol, where it applies and where it does not, and what
// counts against it. The body is in the article dialect: every <q> is a
// quotation checked word for word at build, with a receipt to its passage.

import type { Proposition, Reference, Theory } from "../content/store";
import { docTitle } from "../data";
import { esc, linkPill, pill, shell } from "../layout";
import { articleHtml, articleQuotes, inline } from "../md";
import { kindColours, longDate, topicColours, topicSlug } from "../theme";
import { citationMeta, citeBlock, doiChip, jsonLd, statbox, toc } from "./article";

const GRADE_COLOURS: Record<Proposition["grade"], readonly [string, string]> = {
  Strong: ["#e3f0e6", "#1f5e36"],
  Moderate: ["#e4ecf7", "#1f4e8c"],
  Proposed: ["#fbe9df", "#8a3a1f"],
};

/** The rubric, stated on every theory page and enforced at build: a Strong
 *  proposition names at least two studies, a Moderate one at least one. */
export const GRADE_MEANING: Record<Proposition["grade"], string> = {
  Strong: "Measured directly in at least two independent studies",
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

function refLine(refs: number[]): string {
  if (!refs.length) return `<p class="prop-refs">No study yet</p>`;
  const n = refs.length;
  return `<p class="prop-refs">${n} ${n === 1 ? "reference" : "references"}: ${refs
    .map((r) => `<a href="#ref-${r}">[${r}]</a>`)
    .join(" ")}</p>`;
}

function propositions(props: Proposition[]): string {
  const rows = props
    .map(
      (p, i) => `<li class="prop" id="p${i + 1}">
  <span class="prop-n">P${i + 1}</span>
  <div class="prop-b"><p class="prop-s">${inline(p.statement)}</p>${
    p.basis ? `<p class="prop-basis">${inline(p.basis)}</p>` : ""
  }${refLine(p.refs)}</div>
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
<div class="prop-key"><span class="prop-key-h">How propositions are graded</span>${key}</div>
</section>`;
}

function references(refs: Reference[], props: Proposition[], quoted: boolean): string {
  if (!refs.length) return "";
  const usedBy = (i: number) =>
    props.flatMap((p, k) => (p.refs.includes(i) ? [`<a href="#p${k + 1}">P${k + 1}</a>`] : []));
  const rows = refs
    .map((r, i) => {
      const by = usedBy(i + 1);
      return `<li id="ref-${i + 1}"><span class="ref-t">${inline(r.text)}</span>${
        r.url
          ? ` <a class="ref-u" href="${esc(r.url)}" rel="noopener">${esc(linkLabel(r.url))}</a>`
          : ` <span class="ref-u none">no open copy linked</span>`
      } · <span class="ref-read ${r.read}">${READ_LABEL[r.read]}</span>${by.length ? ` · <span class="ref-by">Supports ${by.join(", ")}</span>` : ""}</li>`;
    })
    .join("\n");
  return `<section class="refs" id="references" aria-labelledby="refs-h">
<h2 id="refs-h">References</h2>
<p class="refs-note">The studies behind the propositions${quoted ? ". The quotations above are checked word for word against the research document; these are its primary sources" : ""}. Each says what was read for this theory: ${readCounts(refs)}.</p>
<ol class="ref-list">
${rows}
</ol>
</section>`;
}

/** What the link opens: a free full text, the publisher's record, or a site. */
function linkLabel(url: string): string {
  const host = hostOf(url);
  if (/(^|\.)ncbi\.nlm\.nih\.gov$|europepmc\.org$/.test(host)) return "Free full text";
  if (host === "doi.org") return "Publisher";
  return host;
}

const READ_LABEL: Record<Reference["read"], string> = {
  full: "Read in full",
  abstract: "Abstract read",
  secondary: "Cited from a secondary account",
};

function readCounts(refs: Reference[]): string {
  const n = (k: Reference["read"]) => refs.filter((r) => r.read === k).length;
  return [
    `${n("full")} in full`,
    `${n("abstract")} from the abstract`,
    `${n("secondary")} from a secondary account`,
  ].join(", ");
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** The loop as a ring of steps, drawn on the server (no script). Each step is
 *  "Head|detail". The way out sits in the middle, marked in brick, with a cut
 *  on the arrow into the step it prevents (the one whose head starts
 *  "Routine stops", else the fifth). */
export function cycleSvg(steps: string[], exit?: string, cut?: number): string {
  const W = 720;
  const H = 440;
  const cx = W / 2;
  const cy = H / 2;
  const rx = 255;
  const ry = 160;
  const bw = 176;
  const bh = 58;
  const n = steps.length;
  const pts = steps.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
  const cutAt = cut ? cut - 1 : -1;
  const edge = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const t = Math.min(bw / 2 / Math.abs(dx || 1e-9), bh / 2 / Math.abs(dy || 1e-9)) + 0.04;
    return { x: from.x + dx * t, y: from.y + dy * t };
  };
  const f = (v: number) => v.toFixed(1);
  const arrows = pts
    .map((p, i) => {
      const q = pts[(i + 1) % n] ?? p;
      const a = edge(p, q);
      const b = edge(q, p);
      const cutHere = (i + 1) % n === cutAt;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      return `<line class="cy-a" x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" marker-end="url(#cy-head)"/>${
        cutHere
          ? `<g class="cy-cut"><circle cx="${f(mid.x)}" cy="${f(mid.y)}" r="11"/><path d="M${f(mid.x - 5)} ${f(mid.y - 5)}l10 10M${f(mid.x + 5)} ${f(mid.y - 5)}l-10 10"/></g>`
          : ""
      }`;
    })
    .join("");
  const boxes = pts
    .map((p, i) => {
      const [head = "", detail] = (steps[i] ?? "").split("|");
      return `<g class="cy-s"><rect x="${f(p.x - bw / 2)}" y="${f(p.y - bh / 2)}" width="${bw}" height="${bh}" rx="10"/><text x="${f(p.x)}" y="${f(p.y - (detail ? 4 : -5))}" class="cy-h">${esc(head.trim())}</text>${
        detail
          ? `<text x="${f(p.x)}" y="${f(p.y + 15)}" class="cy-d">${esc(detail.trim())}</text>`
          : ""
      }</g>`;
    })
    .join("");
  const exitLines = exit ? wrap(exit, 30) : [];
  const centre = exitLines.length
    ? `<g class="cy-x"><text x="${cx}" y="${f(cy - 8 - (exitLines.length - 1) * 9)}" class="cy-xl">Where it breaks</text>${exitLines
        .map(
          (l, i) =>
            `<text x="${cx}" y="${f(cy + 12 + i * 18 - (exitLines.length - 1) * 9)}">${esc(l)}</text>`,
        )
        .join("")}</g>`
    : "";
  const label = `A loop of ${n} steps: ${steps.map((s) => (s.split("|")[0] ?? "").trim()).join(", then ")}, and back to the start.${exit ? ` ${exit}` : ""}`;
  // On a phone the ring is too small to read, so the same steps stand as a list.
  const list = `<ol class="cycle-list">${steps
    .map((s, i) => {
      const [head = "", detail] = s.split("|");
      return `<li${i === cutAt ? ' class="cut"' : ""}><b>${esc(head.trim())}</b>${detail ? ` <span>${esc(detail.trim())}</span>` : ""}</li>`;
    })
    .join(
      "",
    )}<li class="back">Back to the first step</li></ol>${exit ? `<p class="cycle-exit"><b>Where it breaks.</b> ${esc(exit)}</p>` : ""}`;
  return `<figure class="cycle">${list}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"><defs><marker id="cy-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs>${arrows}${boxes}${centre}</svg><figcaption>The loop. Each step follows from the last${cutAt >= 0 ? "; the cross marks where it can be cut" : ""}.</figcaption></figure>`;
}

function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    if (line && `${line} ${w}`.length > width) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

/** Link "[n]" in the body to the nth reference, outside tags only. */
function linkRefs(html: string, count: number): string {
  return html.replace(/(<[^>]*>)|\[(\d{1,2})\]/g, (m, tag, n) => {
    if (tag) return tag;
    const k = Number(n);
    return k >= 1 && k <= count ? `<a class="ref-n" href="#ref-${k}">[${k}]</a>` : m;
  });
}

/** The loop's figure goes after the first paragraph of the Mechanism. */
function withCycle(html: string, figure: string): string {
  const h = html.search(/<h2[^>]*>(?:<span class="num">\d+<\/span>)?Mechanism<\/h2>/);
  if (h < 0) return figure + html;
  const p = html.indexOf("</p>", h);
  if (p < 0) return html + figure;
  return html.slice(0, p + 4) + figure + html.slice(p + 4);
}

export function renderTheory(t: Theory, opts: { signedIn?: boolean } = {}): string {
  const ctx = { docTitle };
  const body = articleHtml(t.body, ctx);
  const refs = t.references ?? [];
  let bodyHtml = linkRefs(body.html, refs.length);
  if (t.cycle?.length) bodyHtml = withCycle(bodyHtml, cycleSvg(t.cycle, t.cycle_exit, t.cycle_cut));
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
  }<span class="chip">${t.propositions.length} propositions</span><span class="chip">${refs.length} references</span>${doiChip(t.doi)}${quotes ? `<span class="chip">${quotes} quotes</span>` : ""}</div>
</div>
<section class="theory-card" aria-label="The theory in brief">
  <div class="tc-row"><span class="tc-l">Claim</span><p>${inline(t.claim)}</p></div>
  <div class="tc-row"><span class="tc-l">Evidence</span><p>${esc(gradeCounts(t.propositions))} propositions, resting on ${refs.length} primary references. Strong means measured directly in at least two independent studies; moderate, that it follows from established findings but has not been tested as stated; proposed, not yet tested.</p></div>
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

  const col = `<article class="col prose theory">${header}${propositions(t.propositions)}${bodyHtml}${references(refs, t.propositions, quotes > 0)}${sources}</article>`;
  const rail = `<aside class="rail">${statbox(t.topic, [String(t.propositions.length), "Propositions"], quotes ? [String(quotes), "Quotes"] : [String(refs.length), "References"])}${toc(
    "In this theory",
    [...body.heads, { n: "", text: "References", href: "#references" }],
    {
      text: "Propositions",
      href: "#propositions",
    },
  )}</aside>`;

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
        ...(t.doi
          ? {
              identifier: { "@type": "PropertyValue", propertyID: "DOI", value: t.doi },
              sameAs: `https://doi.org/${t.doi}`,
            }
          : {}),
        citation: refs.map((r) =>
          r.url
            ? { "@type": "CreativeWork", name: r.text, url: r.url }
            : { "@type": "CreativeWork", name: r.text },
        ),
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
    head: `${citationMeta(t.title, t.date, url, t.doi)}\n<link rel="alternate" type="text/markdown" href="/theories/${esc(t.slug)}.md" />\n${jsonLd(ld)}`,
    body: `<div class="rr">${col}${rail}</div>`,
  });
}
