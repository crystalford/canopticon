import type { Figures } from "../content/store";
import { esc } from "../layout";
import { inline } from "../md";
import { cycleSvg } from "./theory";

/** A bar chart drawn in HTML and CSS (no script, sharp at any width): one row
 *  per "Label|value", bars scaled to the largest, the value written beside
 *  each, and where the numbers come from under it. Every value is already in
 *  the piece's own text (the build checks), so the chart only shows what the
 *  piece says. */
export function chartHtml(f: Figures): string {
  const rows = (f.chart ?? [])
    .map((b) => {
      const [label = "", value = ""] = b.split("|").map((x) => x.trim());
      return { label, value, n: Number(value) };
    })
    .filter((r) => r.label && Number.isFinite(r.n));
  if (rows.length < 2) return "";
  const max = Math.max(...rows.map((r) => Math.abs(r.n))) || 1;
  const show = (v: string) => `${f.chart_prefix ?? ""}${v}${f.chart_unit ?? ""}`;
  return `<figure class="chart" aria-label="${esc(f.chart_title ?? "Chart")}">
  <figcaption class="ch-t">${esc(f.chart_title ?? "")}</figcaption>
  <ol class="ch-bars">${rows
    .map(
      (r) =>
        `<li><span class="ch-l">${esc(r.label)}</span><span class="ch-b"><span class="ch-fill" style="width:${Math.max(1, Math.round((Math.abs(r.n) / max) * 100))}%"></span></span><span class="ch-v">${esc(show(r.value))}</span></li>`,
    )
    .join("")}</ol>
  ${f.chart_note ? `<p class="ch-n">${inline(f.chart_note)}</p>` : ""}
  ${f.chart_source ? `<p class="ch-src">Source: ${inline(f.chart_source)}</p>` : ""}
</figure>`;
}

/** Text of a heading, without tags or its leading number. */
function headText(h: string): string {
  return h
    .replace(/<[^>]*>/g, "")
    .replace(/^\s*\d+[.)]?\s*/, "")
    .trim()
    .toLowerCase();
}

/** Put a figure after the first paragraph under the section whose heading
 *  starts with `after`; with no match, under the first section. */
export function placeAfter(html: string, after: string | undefined, figure: string): string {
  if (!figure) return html;
  const heads = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)];
  const want = (after ?? "").trim().toLowerCase();
  const head = (want && heads.find((m) => headText(m[1] ?? "").startsWith(want))) || heads[0];
  if (!head || head.index === undefined) return html + figure;
  const p = html.indexOf("</p>", head.index);
  if (p < 0) return html + figure;
  return html.slice(0, p + 4) + figure + html.slice(p + 4);
}

/** An essay's or paper's figures, placed in its body: the loop first, then
 *  the chart. */
export function withFigures(html: string, f: Figures): string {
  let out = html;
  if (f.cycle?.length)
    out = placeAfter(out, f.cycle_after, cycleSvg(f.cycle, f.cycle_exit, f.cycle_cut));
  if (f.chart?.length) out = placeAfter(out, f.chart_after, chartHtml(f));
  return out;
}
