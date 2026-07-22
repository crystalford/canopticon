// Movement 3 — the behavior strip. Wide and short by design (supporting
// evidence, not headline). Dual axis: financial/non-financial asset ratio
// (accent, solid) on the left, debt-to-disposable-income (rose, dashed)
// on the right. One annotation at the 2020 pandemic spike. viewBox
// 0 0 880 220.

import type { BehaviorRow } from "../data/queries.ts";

const W = 880;
const H = 220;
const M = { top: 24, right: 54, bottom: 34, left: 54 };
const PLOT_R = W - M.right;
const PLOT_B = H - M.bottom;

const COL = { fin: "#3a63a0", debt: "#b25f80", grid: "#e7e4df", axis: "#837e78" };

function pathFor(
  rows: BehaviorRow[],
  pick: (r: BehaviorRow) => number | null,
  x: (y: number) => number,
  y: (v: number) => number,
): { d: string; last: { x: number; y: number } | null } {
  const pts = rows
    .map((r) => ({ year: r.year, v: pick(r) }))
    .filter((p): p is { year: number; v: number } => p.v != null);
  if (pts.length === 0) return { d: "", last: null };
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year).toFixed(1)} ${y(p.v).toFixed(1)}`)
    .join(" ");
  const lp = pts[pts.length - 1];
  if (!lp) return { d, last: null };
  return { d, last: { x: x(lp.year), y: y(lp.v) } };
}

export function behaviorStripSvg(rows: BehaviorRow[]): string {
  if (rows.length === 0) return "";
  const years = rows.map((r) => r.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const xSpan = Math.max(1, maxYear - minYear);
  const x = (year: number) => M.left + ((year - minYear) / xSpan) * (PLOT_R - M.left);

  const finVals = rows.map((r) => r.finNonfin).filter((v): v is number => v != null);
  const debtVals = rows.map((r) => r.debtDti).filter((v): v is number => v != null);
  const finMax = Math.max(1.3, ...finVals);
  const debtMax = Math.max(2, ...debtVals);
  const yFin = (v: number) => M.top + (1 - v / finMax) * (PLOT_B - M.top);
  const yDebt = (v: number) => M.top + (1 - v / debtMax) * (PLOT_B - M.top);

  const finPath = pathFor(rows, (r) => r.finNonfin, x, yFin);
  const debtPath = pathFor(rows, (r) => r.debtDti, x, yDebt);

  const xticks = rows
    .map(
      (r) =>
        `<text x="${x(r.year).toFixed(1)}" y="${PLOT_B + 20}" text-anchor="middle" class="bs-bax">${r.year}</text>`,
    )
    .join("");

  // Annotation at 2020 if present.
  const has2020 = rows.some((r) => r.year === 2020);
  const annot = has2020
    ? `<line x1="${x(2020).toFixed(1)}" y1="${M.top}" x2="${x(2020).toFixed(1)}" y2="${PLOT_B}" stroke="#aea9a2" stroke-width="1" stroke-dasharray="3 3"/>
<text x="${x(2020).toFixed(1)}" y="${M.top - 8}" text-anchor="middle" class="bs-annot">2020 · pandemic savings glut</text>`
    : "";

  const finLabel = finPath.last
    ? `<text x="${(finPath.last.x + 6).toFixed(1)}" y="${finPath.last.y.toFixed(1)}" dominant-baseline="middle" class="bs-blabel" fill="${COL.fin}">fin/non-fin</text>`
    : "";
  const debtLabel = debtPath.last
    ? `<text x="${(debtPath.last.x + 6).toFixed(1)}" y="${debtPath.last.y.toFixed(1)}" dominant-baseline="middle" class="bs-blabel" fill="${COL.debt}">debt/income</text>`
    : "";

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Household financial-to-non-financial asset ratio and debt-to-disposable-income" class="bs-behavior-svg">
<style>
.bs-bax { font-family: var(--mono); font-size: 11px; fill: ${COL.axis}; }
.bs-blabel { font-family: var(--mono); font-size: 11px; font-weight: 500; }
.bs-annot { font-family: var(--mono); font-size: 10.5px; fill: #837e78; }
</style>
<line x1="${M.left}" y1="${PLOT_B}" x2="${PLOT_R}" y2="${PLOT_B}" stroke="${COL.grid}"/>
${annot}
<path d="${finPath.d}" fill="none" stroke="${COL.fin}" stroke-width="2"/>
<path d="${debtPath.d}" fill="none" stroke="${COL.debt}" stroke-width="2" stroke-dasharray="5 4"/>
${finLabel}${debtLabel}
${xticks}
</svg>`;
}
