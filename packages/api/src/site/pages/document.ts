// /p/<id> — a research document, whole. docs/blackbox/README.md §Document;
// pages/Canopticon Doc.dc.html is the reference and its logic is ported here
// to the server: the summary block lifted out of the body, up to three key
// figures picked from it, numbered section anchors (#s-N), and a rail that
// follows the reader. Passage links (#q=…) are found and marked by /site.js.

import { esc, linkPill, pill, shell } from "../layout";
import { documentHtml, plain } from "../md";
import { kindColours, topicColours, topicSlug } from "../theme";

export interface DocView {
  id: string;
  title: string;
  /** The document's own kind: "Research brief", "Dossier", "Fact-check"… */
  kind: string;
  topic: string;
  /** ISO date and the label to print for it ("22 Jul", or "Sep" when only
   *  the month is known — the record does not invent a day). */
  date: string;
  dateLabel: string;
  shelf: string;
  body: string;
  /** Articles and papers that quote this document. */
  citedBy: Array<{ route: string; title: string; kind: string; quotes: number }>;
}

const SUMMARY =
  /^#{2,3}\s*(TL;?DR|Executive summary|Summary|Key findings|Bottom line)[^\n]*\n([\s\S]*?)(?=\n#{1,3}\s)/im;

/** Split the summary block out of the body (it renders above, and is cut
 *  from below so nothing is shown twice). */
export function splitSummary(body: string): { summary: string; label: string; rest: string } {
  const m = SUMMARY.exec(body);
  if (!m) return { summary: "", label: "Summary", rest: body };
  return {
    summary: (m[2] ?? "").trim(),
    label: /key findings/i.test(m[1] ?? "") ? "Key findings" : "Summary",
    rest: body.replace(m[0], ""),
  };
}

const NUM =
  /(\$\s?[\d,.]+\s?(?:billion|million|B|M|k)?|[\d,.]+\s?(?:%|×|x\b|per cent|percent)|\b\d{1,3}(?:,\d{3})+\b)/i;
const MARK =
  /(~?\$\d[\d,]*(?:\.\d+)?(?: ?(?:billion|million|B|M|k)\b)?|~?\d[\d,]*(?:\.\d+)?(?:%|×| per cent| percent)|~?\d{1,3}(?:,\d{3})+)/g;

function pickNum(sen: string): string | null {
  const ft =
    /from\s+(\$?[\d,.]+\s?(?:%|×|billion|million|B|M)?)\s+to\s+(\$?[\d,.]+\s?(?:%|×|billion|million|B|M)?)/i.exec(
      sen,
    );
  if (ft) return (ft[2] ?? "").trim();
  const noPar = sen.replace(/\([^)]*\)/g, " ");
  const pc = [...noPar.matchAll(/([\d,.]+\s?(?:%|×|per cent|percent))/gi)].map((m) =>
    (m[1] ?? "").trim(),
  );
  if (pc.length) return pc[pc.length - 1] ?? null;
  const m = NUM.exec(noPar);
  return m ? (m[1] ?? "").replace(/\s+/g, " ").trim() : null;
}

export interface KeyFigure {
  num: string;
  html: string;
  where: string;
  href: string;
}

/** Up to three figures, one per section, each a sentence carrying a number.
 *  Selected verbatim from the document, never composed. */
export function keyFigures(summary: string, label: string, rest: string): KeyFigure[] {
  const secOf: Array<[string, string]> = [];
  let cur = "Summary";
  let k = 0;
  for (const ln of `${summary}\n${rest}`.split("\n")) {
    if (/^##\s+/.test(ln)) {
      k++;
      cur = String(k);
    }
    secOf.push([ln, cur]);
  }
  const figs: KeyFigure[] = [];
  const seen = new Set<string>();
  const used = new Set<string>();
  for (const [ln0, s] of secOf) {
    if (figs.length >= 3) break;
    if (used.has(s) || /^\s*(#|\|)/.test(ln0)) continue;
    const ln = plain(ln0.replace(/^\s*([-*+]|\d+[.)])\s+/, ""));
    for (const sen of ln.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
      if (sen.length < 40 || sen.length > 230) continue;
      const num = pickNum(sen);
      if (!num || num.length < 2 || /^(19|20)\d\d$/.test(num) || seen.has(num)) continue;
      if (/^0?\.\d+%?$/.test(num)) continue;
      seen.add(num);
      used.add(s);
      figs.push({
        num,
        html: esc(sen).replace(MARK, "<strong>$1</strong>"),
        where: s === "Summary" ? label : `Section ${s}`,
        href: s === "Summary" ? "#doc-summary" : `#s-${s}`,
      });
      break;
    }
  }
  return figs;
}

export function renderDocument(
  d: DocView,
  /** readIt: offer Read it; with the draft of a read already made, open it. */
  opts: { signedIn?: boolean; readIt?: boolean | { draftId: string; when: string } } = {},
): string {
  const inv = d.shelf === "investigation";
  const { summary, label, rest } = splitSummary(d.body.replace(/^---[\s\S]*?---\s*/, ""));
  const B = documentHtml(rest);
  const summaryHtml = summary ? documentHtml(summary).html : "";
  const figs = keyFigures(summary, label, rest);
  const chars = d.body.length;
  const minutes = Math.max(1, Math.round(chars / 1500));
  const topicHref = inv ? "/investigations" : `/topics/${topicSlug(d.topic)}`;
  const back = inv
    ? { href: "/investigations", label: "Investigations" }
    : { href: "/library?kind=Research", label: "Research" };

  const head = [
    `<div class="crumbs"><a href="${back.href}">${back.label}</a>${back.label === d.kind ? "" : `<span aria-hidden="true" class="sep">/</span><span>${esc(d.kind)}</span>`}</div>`,
    `<div class="pills" style="margin-top:14px">${pill(d.kind, kindColours("Research"), "pill lg")}${linkPill(topicHref, d.topic, topicColours(d.topic), "pill lg")}${d.dateLabel ? pill(d.dateLabel, kindColours("Research"), "pill lg") : ""}${pill(`${minutes} min read`, kindColours("Research"), "pill lg")}</div>`,
    `<h1 class="h-doc">${esc(d.title)}</h1>`,
    inv
      ? `<div class="inv-note"><strong>Working file. </strong>An investigation — an open line of inquiry, sourced but not a conclusion, kept on its own shelf.</div>`
      : "",
    summaryHtml
      ? `<section aria-label="${esc(label)}" class="summary"><div class="summary-h">${esc(label)}</div><div class="summary-b" id="doc-summary">${summaryHtml}</div></section>`
      : "",
    figs.length >= 2
      ? `<section aria-label="Key figures" class="figs"><div class="figs-h">Key figures</div>${figs
          .map(
            (f) =>
              `<div class="fig"><span class="fig-t">${f.html}</span><a href="${f.href}">${esc(f.where)} →</a></div>`,
          )
          .join("")}</section>`
      : "",
  ].join("");

  const cite = `Telford, C. (${d.date.slice(0, 4) || "n.d."}). ${d.title}. Canopticon research document. canopticon.com/p/${d.id}`;
  const article = `<article class="dcol">${head}<div class="dbody" id="doc-body">${B.html}</div><div class="dcite"><div class="dcite-h">Cite this</div>${esc(cite)}</div></article>`;

  const toc =
    B.heads.length > 1
      ? `<nav aria-label="In this document"><div class="drail-h">In this document</div><ol class="dtoc" data-toc>${B.heads
          .map(
            (h) => `<li><span class="n">${h.n}</span><a href="${h.href}">${esc(h.text)}</a></li>`,
          )
          .join("")}</ol></nav>`
      : "";
  const meta = `<div class="dmeta"><div><span>Kind</span><span>${esc(d.kind)}</span></div><div><span>Topic</span><span>${esc(d.topic)}</span></div><div><span>Published</span><span>${esc(d.dateLabel || "date unknown")}</span></div><div><span>Length</span><span>${Math.round(chars / 1000)}k characters</span></div></div>`;
  const citedBy = d.citedBy.length
    ? `<div class="citedby"><div class="drail-h">Cited by</div>${d.citedBy
        .map(
          (c) =>
            `<a href="${esc(c.route)}">${pill(c.kind, kindColours(c.kind))}${esc(c.title)}</a>`,
        )
        .join("")}</div>`
    : "";
  // Signed in, the author can have Claude read it (docs/read-it.md).
  const readIt =
    !opts.signedIn || !opts.readIt
      ? ""
      : typeof opts.readIt === "object"
        ? `<div class="dread"><a class="btn sm" href="/admin/write/${esc(opts.readIt.draftId)}">Open its read</a><span>Read ${esc(opts.readIt.when)}.</span></div>`
        : `<form method="post" action="/op/read/${esc(d.id)}" class="dread"><button type="submit" class="btn sm">Read it</button><span>Claude reads it whole and lays out what is in it, for you to keep or dismiss.</span></form>`;
  const rail = `<aside class="drail">${toc}${meta}${readIt}${citedBy}</aside>`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "Report",
    headline: d.title,
    name: d.title,
    url: `https://canopticon.com/p/${d.id}`,
    ...(d.date ? { datePublished: d.date } : {}),
    author: { "@type": "Person", name: "Chris Telford", url: "https://canopticon.com/about" },
    publisher: { "@type": "Organization", name: "Canopticon", url: "https://canopticon.com" },
    license: "https://creativecommons.org/licenses/by/4.0/",
    about: d.topic,
    isAccessibleForFree: true,
  };
  return shell({
    title: d.title,
    description: plain(summary).slice(0, 300) || `${d.kind} · ${d.topic}`,
    path: `/p/${d.id}`,
    nav: "library",
    progress: true,
    ogType: "article",
    signedIn: opts.signedIn ?? false,
    head: `<link rel="alternate" type="text/markdown" href="/p/${esc(d.id)}.md" />\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    body: `<div class="dwrap">${article}${rail}</div>`,
  });
}
