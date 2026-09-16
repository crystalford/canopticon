// /figures — every verified number in the corpus, on one page.
//
// Why this page exists, and why it is ONE page:
//
// A statistic stated beside its named source and its date is the strongest
// evidenced citable primitive there is — GEO (Aggarwal et al., KDD 2024)
// measured Statistics Addition, Cite Sources and Quotation Addition as the top
// three of nine tactics tested. And compiling figures the corpus has verified
// is closer to publishing original data than commentary is, which is what the
// March 2026 core update rewarded (+22% visibility for sites publishing
// original data, against content farms losing 60-80% of traffic).
//
// But a site's own pages displace each other rather than compounding, so
// splitting this into one page per figure would spend that advantage
// cannibalising itself. One dense index, many passages.
//
// Every row carries the sentence the number came from and a link to that
// quote's receipt, because a figure without its provenance is exactly the
// unsourced statistic this publication exists not to produce.

import { type CorpusFinding, listCorpusFindings } from "../../graph/lib/aeo-extract";
import { displayTitle } from "../../lib/title";
import { type PublicEnv, resolveOperatorId } from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";
import { ldScript } from "../machine";
import { emptyState } from "./components";

function row(f: CorpusFinding): string {
  const meta = [f.period, f.attributed_to]
    .filter(Boolean)
    .map((x) => escapeHtml(String(x)))
    .join(' <span class="sep">·</span> ');
  const source = displayTitle(f.piece_title, f.body_head);
  return `  <li class="finding fig-row">
    <div class="finding-head">
      <span class="finding-figure">${escapeHtml(f.figure)}</span>
      <span class="finding-measures">${escapeHtml(f.measures)}</span>
    </div>
    ${meta ? `<div class="finding-meta">${meta}</div>` : ""}
    <blockquote class="finding-quote">${escapeHtml(f.verbatim_text)}</blockquote>
    <div class="fig-prov">
      <a href="/p/${escapeAttr(f.piece_slug)}">${escapeHtml(source)}</a>
      <span class="sep">·</span>
      <a class="finding-receipt" href="/q/${escapeAttr(f.quote_id)}">verified quote ↗</a>
    </div>
  </li>`;
}

export async function renderFiguresIndex(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const findings = userId ? await listCorpusFindings(env.DB, userId).catch(() => []) : [];

  // Distinct source documents, so the page can say what it is drawn from
  // rather than implying the corpus is larger than it is.
  const sources = new Set(findings.map((f) => f.piece_slug)).size;

  // Same shell as /answers — `.phead` on the page ground, not a raised card.
  // These two are siblings: one indexes the corpus's questions, the other its
  // numbers, and they should not look like different kinds of page.
  const body = `<header class="phead">
  <div class="eyebrow">Numbers</div>
  <h1>Every number, with its source</h1>
  <p class="phead-dek">Every number here comes from a document on this site, shown with the
  sentence it came from.${
    findings.length
      ? ` Currently <b>${findings.length}</b> figure${findings.length === 1 ? "" : "s"} from <b>${sources}</b> document${sources === 1 ? "" : "s"}.`
      : ""
  }</p>
</header>
${
  findings.length
    ? `<ul class="findings fig-list">\n${findings.map(row).join("\n")}\n  </ul>`
    : emptyState("No numbers yet — they appear as documents are processed.", {
        href: "/research",
        label: "Read the documents →",
      })
}`;

  return renderPage({
    title: "Numbers — Canopticon",
    description:
      "Every statistic extracted from the Canopticon corpus, each checked word-for-word against its source document and linked to a verifiable receipt.",
    body: `${body}\n${ldScript({
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Canopticon verified figures",
      description:
        "Statistics extracted from primary research documents, each verified as a literal substring of its source and linked to a receipt.",
      url: "https://canopticon.com/numbers",
      license: "https://creativecommons.org/licenses/by/4.0/",
      isAccessibleForFree: true,
      // Honest about size. A Dataset that overstates what it contains is the
      // same failure as a page that implies coverage it does not have.
      variableMeasured: [...new Set(findings.map((f) => f.measures))].slice(0, 50),
    })}`,
    activeNav: "/numbers",
    zone: "research",
    canonical: "https://canopticon.com/numbers",
  });
}
