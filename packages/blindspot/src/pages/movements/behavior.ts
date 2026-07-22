// Movement 3 renderer — the Behavior Strip. The wide/short dual-axis
// chart + a one-paragraph framing of the saving-glut → indebted-demand
// circuit.

import { behaviorStripSvg } from "../../charts/behavior.ts";
import type { BehaviorRow } from "../../data/queries.ts";

export function renderBehaviorMovement(rows: BehaviorRow[]): string {
  const chart = behaviorStripSvg(rows);
  const inner = chart
    ? `<figure class="bs-figure">${chart}
  <figcaption class="bs-figcaption">Two household-balance-sheet series from the National Balance Sheet Accounts: the ratio of financial to non-financial assets (solid) and debt to disposable income (dashed). Read together they sketch a circuit — a savings glut concentrated at the top financing indebted demand below it, most visible in the 2020 divergence.</figcaption>
</figure>`
    : `<div class="bs-empty">No data yet — the operator refreshes the sources to paint this strip.</div>`;

  return `<section class="bs-movement" id="behavior">
  <div class="bs-movement-head">
    <span class="bs-movement-num">03</span>
    <h2 class="bs-movement-h2">The Behavior Strip</h2>
  </div>
  <p class="bs-movement-dek">The supporting circuit: a savings glut at the top financing indebted demand below.</p>
  ${inner}
</section>`;
}
