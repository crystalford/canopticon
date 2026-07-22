// Movement 4 — the Where You Stand axis. A log-scale net-worth axis,
// server-rendered static; the /where inline script moves a marker along
// it. The region past the official top-1% threshold is shaded in the
// same disagreement-zone colour as Movement 1 — the visual language
// repeats: past the edge, the official distribution cannot see.

// Geometry shared between this SVG and the /where client script, so both
// map net worth → x with the identical formula.
export const AXIS = {
  W: 880,
  H: 130,
  X0: 64, // left plot edge
  X1: 816, // right plot edge
  Y: 78, // baseline
  LOG_MIN: 4, // log10(10_000)
  LOG_MAX: 9, // log10(1_000_000_000)
  EDGE_CAD: 7_400_000, // official top-1% threshold
  ZONE: "rgba(58,99,160,0.12)",
} as const;

const TICKS: Array<{ cad: number; label: string }> = [
  { cad: 10_000, label: "$10k" },
  { cad: 100_000, label: "$100k" },
  { cad: 1_000_000, label: "$1M" },
  { cad: 10_000_000, label: "$10M" },
  { cad: 100_000_000, label: "$100M" },
  { cad: 1_000_000_000, label: "$1B" },
];

/** x pixel for a net-worth figure on the log axis. Mirrored in the
 *  client script (keep the two in sync). */
export function axisX(cad: number): number {
  const t = (Math.log10(cad) - AXIS.LOG_MIN) / (AXIS.LOG_MAX - AXIS.LOG_MIN);
  return AXIS.X0 + Math.max(0, Math.min(1, t)) * (AXIS.X1 - AXIS.X0);
}

export function percentileAxisSvg(): string {
  const edgeX = axisX(AXIS.EDGE_CAD);
  const ticks = TICKS.map((t) => {
    const x = axisX(t.cad).toFixed(1);
    return `<line x1="${x}" y1="${AXIS.Y - 6}" x2="${x}" y2="${AXIS.Y + 6}" stroke="#aea9a2"/>
<text x="${x}" y="${AXIS.Y + 24}" text-anchor="middle" class="bs-wax">${t.label}</text>`;
  }).join("");

  return `<svg viewBox="0 0 ${AXIS.W} ${AXIS.H}" role="img" aria-label="Net-worth log axis with the official-distribution edge marked" class="bs-where-svg">
<style>
.bs-wax { font-family: var(--mono); font-size: 11px; fill: #837e78; }
.bs-wedge { font-family: var(--mono); font-size: 10.5px; fill: #3a63a0; }
.bs-wmark-label { font-family: var(--mono); font-size: 12px; font-weight: 600; fill: #2c4d7e; }
</style>
<!-- unresolved zone: past the official top-1% edge -->
<rect x="${edgeX.toFixed(1)}" y="${AXIS.Y - 40}" width="${(AXIS.X1 - edgeX).toFixed(1)}" height="80" fill="${AXIS.ZONE}"/>
<line x1="${edgeX.toFixed(1)}" y1="${AXIS.Y - 40}" x2="${edgeX.toFixed(1)}" y2="${AXIS.Y + 12}" stroke="#3a63a0" stroke-width="1" stroke-dasharray="3 3"/>
<text x="${(edgeX + 6).toFixed(1)}" y="${AXIS.Y - 30}" class="bs-wedge">official top-1% edge (~$7.4M) →</text>
<text x="${(edgeX + 6).toFixed(1)}" y="${AXIS.Y - 18}" class="bs-wedge">beyond here: unresolved</text>
<!-- baseline -->
<line x1="${AXIS.X0}" y1="${AXIS.Y}" x2="${AXIS.X1}" y2="${AXIS.Y}" stroke="#56524e" stroke-width="1.5"/>
${ticks}
<!-- marker (positioned by the /where script) -->
<g id="bs-marker" opacity="0">
  <line id="bs-marker-line" x1="${AXIS.X0}" y1="${AXIS.Y - 44}" x2="${AXIS.X0}" y2="${AXIS.Y + 10}" stroke="#2c4d7e" stroke-width="2"/>
  <circle id="bs-marker-dot" cx="${AXIS.X0}" cy="${AXIS.Y}" r="5" fill="#2c4d7e"/>
  <text id="bs-marker-label" x="${AXIS.X0}" y="${AXIS.Y - 50}" text-anchor="middle" class="bs-wmark-label"></text>
</g>
</svg>`;
}
