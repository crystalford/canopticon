// Movement 1 renderer — The Spread. The chart + a caption + the receipt
// strip (one cite chip per method: method · last-fetched · linked source).

import { spreadChartSvg } from "../../charts/spread.ts";
import type { SpreadRow } from "../../data/queries.ts";
import { SOURCES } from "../../sources/registry.ts";
import { formatDate } from "../format.ts";
import { escapeAttr, escapeHtml } from "../shell.ts";

const METHOD_SOURCE: Record<string, string> = {
  survey: "sfs",
  pareto: "pbo-hnw",
  capitalization: "dhea",
};

function receiptStrip(lastFetched: Record<string, string>): string {
  const chips = (["survey", "pareto", "capitalization"] as const)
    .map((method) => {
      const sid = METHOD_SOURCE[method];
      const src = SOURCES.find((s) => s.id === sid);
      if (!src) return "";
      const when = formatDate(lastFetched[src.id]) || "not yet fetched";
      return `<a class="bs-cite" href="${escapeAttr(src.url)}" rel="noreferrer">
  <span class="bs-cite-method">${escapeHtml(method)}</span>
  <span>${escapeHtml(src.publisher)}</span>
  <span class="bs-cite-sha">· ${escapeHtml(when)}</span>
</a>`;
    })
    .join("");
  return `<div class="bs-cites" style="margin-top:18px">${chips}</div>`;
}

export function renderSpreadMovement(
  rows: SpreadRow[],
  lastFetched: Record<string, string>,
): string {
  const chart = spreadChartSvg(rows);
  const inner = chart
    ? `<figure class="bs-figure">${chart}
  <figcaption class="bs-figcaption">Each line is one official method's estimate of the top 1%'s share, year by year. The shaded band is the space between them — not a margin of error, but the disagreement between three equally-official measurements. It widens toward the present.</figcaption>
</figure>
${receiptStrip(lastFetched)}`
    : `<div class="bs-empty">No data yet — the operator refreshes the sources to paint this chart.</div>`;

  return `<section class="bs-movement" id="spread">
  <div class="bs-movement-head">
    <span class="bs-movement-num">01</span>
    <h2 class="bs-movement-h2">The Spread</h2>
  </div>
  <p class="bs-movement-dek">Three official methods, drawn together — and the zone between them that official statistics cannot resolve.</p>
  ${inner}
</section>`;
}
