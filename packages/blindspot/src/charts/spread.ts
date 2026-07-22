// Movement 1 — The Spread. Three methods on one grid; the zone between
// the highest and lowest method filled. That fill is the headline visual:
// "the zone official statistics cannot resolve". Pure inline SVG, no
// chart library. viewBox 0 0 1040 520.

import type { SpreadRow } from "../data/queries.ts";

const W = 1040;
const H = 520;
const M = { top: 44, right: 168, bottom: 52, left: 62 };
const PLOT_R = W - M.right;
const PLOT_B = H - M.bottom;
const Y_MAX = 0.35; // 35%

const COL = {
  survey: "#56524e",
  pareto: "#3a63a0",
  capitalization: "#b25f80",
  zone: "rgba(58,99,160,0.09)",
  grid: "#d9d6d1",
  axis: "#837e78",
};

const METHOD_LABEL: Record<string, string> = {
  survey: "Survey (SFS)",
  pareto: "Pareto (PBO)",
  capitalization: "Capitalization (DHEA)",
};

type Key = "survey" | "pareto" | "capitalization";
const KEYS: Key[] = ["survey", "pareto", "capitalization"];

export function spreadChartSvg(rows: SpreadRow[]): string {
  if (rows.length === 0) return "";
  const years = rows.map((r) => r.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const xSpan = Math.max(1, maxYear - minYear);

  const x = (year: number) => M.left + ((year - minYear) / xSpan) * (PLOT_R - M.left);
  const y = (share: number) => M.top + (1 - share / Y_MAX) * (PLOT_B - M.top);

  // Y gridlines at 0,10,20,30%.
  const grid = [0, 0.1, 0.2, 0.3]
    .map((v) => {
      const yy = y(v).toFixed(1);
      return `<line x1="${M.left}" y1="${yy}" x2="${PLOT_R}" y2="${yy}" stroke="${COL.grid}" stroke-width="1"/>
<text x="${M.left - 10}" y="${yy}" text-anchor="end" dominant-baseline="middle" class="bs-ax">${Math.round(v * 100)}%</text>`;
    })
    .join("");

  // X ticks (years).
  const xticks = rows
    .map(
      (r) =>
        `<text x="${x(r.year).toFixed(1)}" y="${PLOT_B + 22}" text-anchor="middle" class="bs-ax">${r.year}</text>`,
    )
    .join("");

  // The disagreement zone: per year, the band between max and min share
  // across whichever methods reported that year.
  const band = rows
    .map((r) => {
      const vals = KEYS.map((k) => r[k]).filter((v): v is number => v != null);
      if (vals.length === 0) return null;
      return { year: r.year, hi: Math.max(...vals), lo: Math.min(...vals) };
    })
    .filter((b): b is { year: number; hi: number; lo: number } => b !== null);

  let zone = "";
  if (band.length >= 2) {
    const top = band.map((b) => `${x(b.year).toFixed(1)},${y(b.hi).toFixed(1)}`).join(" ");
    const bottom = [...band]
      .reverse()
      .map((b) => `${x(b.year).toFixed(1)},${y(b.lo).toFixed(1)}`)
      .join(" ");
    zone = `<polygon points="${top} ${bottom}" fill="${COL.zone}" stroke="none"/>`;
  }

  // The three method lines + end labels.
  const lines = KEYS.map((k) => {
    const pts = rows.filter((r) => r[k] != null).map((r) => ({ year: r.year, v: r[k] as number }));
    if (pts.length === 0) return "";
    const d = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year).toFixed(1)} ${y(p.v).toFixed(1)}`)
      .join(" ");
    const dash = k === "survey" ? ` stroke-dasharray="6 5"` : "";
    const last = pts[pts.length - 1];
    if (!last) return "";
    const lx = x(last.year);
    const ly = y(last.v);
    const dots = pts
      .map(
        (p) =>
          `<circle cx="${x(p.year).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3" fill="${COL[k]}"/>`,
      )
      .join("");
    const label = `<text x="${(lx + 12).toFixed(1)}" y="${ly.toFixed(1)}" dominant-baseline="middle" class="bs-endlabel" fill="${COL[k]}">${METHOD_LABEL[k]}</text>
<text x="${(lx + 12).toFixed(1)}" y="${(ly + 15).toFixed(1)}" dominant-baseline="middle" class="bs-endval" fill="${COL[k]}">${(last.v * 100).toFixed(1)}%</text>`;
    return `<path d="${d}" fill="none" stroke="${COL[k]}" stroke-width="2.5"${dash} stroke-linejoin="round"/>${dots}${label}`;
  }).join("");

  // The permanent scope-flag pill (top-left of the plot).
  const pill = `<g transform="translate(${M.left},${M.top - 26})">
  <rect x="0" y="0" width="470" height="20" rx="10" fill="#fff" stroke="${COL.grid}"/>
  <text x="12" y="10" dominant-baseline="middle" class="bs-pill">Net worth (survey, Pareto) ≠ Financial assets (capitalization). Different denominators.</text>
</g>`;

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Three official methods of estimating the top 1% wealth share, and the zone between them" class="bs-spread-svg">
<style>
.bs-ax { font-family: var(--mono); font-size: 12px; fill: ${COL.axis}; }
.bs-endlabel { font-family: var(--mono); font-size: 12px; font-weight: 500; }
.bs-endval { font-family: var(--mono); font-size: 13px; font-weight: 600; }
.bs-pill { font-family: var(--mono); font-size: 10.5px; fill: #56524e; }
.bs-zonelabel { font-family: var(--serif); font-style: italic; font-size: 15px; fill: #3a63a0; }
</style>
<rect x="0" y="0" width="${W}" height="${H}" fill="none"/>
${grid}
${zone}
<text x="${((M.left + PLOT_R) / 2).toFixed(0)}" y="${(M.top + 18).toFixed(0)}" text-anchor="middle" class="bs-zonelabel">the zone official statistics cannot resolve</text>
${lines}
${xticks}
${pill}
</svg>`;
}
