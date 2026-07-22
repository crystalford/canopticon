// Movement 2 — the four-channel decomposition, as a horizontal stacked
// bar. Each segment is a channel's share of the total gap, coloured
// #2c4d7e → #3a63a0 → #7ea6d8 → #b25f80. Pure inline SVG.

import type { IndexRow } from "../data/queries.ts";

const SEG_COLORS = ["#2c4d7e", "#3a63a0", "#7ea6d8", "#b25f80"];

export interface Channel {
  label: string;
  cad: number;
}

export function channelsFromIndex(i: IndexRow): Channel[] {
  return [
    { label: "Unrealized gains", cad: i.ch_unrealized_cad },
    { label: "Private equity", cad: i.ch_private_equity_cad },
    { label: "Offshore", cad: i.ch_offshore_cad },
    { label: "Non-response", cad: i.ch_nonresponse_cad },
  ];
}

export function decompositionBarSvg(channels: Channel[]): string {
  const total = channels.reduce((s, c) => s + c.cad, 0);
  if (total <= 0) return "";
  const W = 760;
  const H = 56;
  let xCursor = 0;
  const segs = channels
    .map((c, idx) => {
      const w = (c.cad / total) * W;
      const color = SEG_COLORS[idx % SEG_COLORS.length];
      const share = Math.round((c.cad / total) * 100);
      const label =
        w > 90
          ? `<text x="${(xCursor + 10).toFixed(1)}" y="${H / 2}" dominant-baseline="middle" class="bs-seg-label">${c.label} · ${share}%</text>`
          : "";
      const rect = `<rect x="${xCursor.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${H}" fill="${color}"/>${label}`;
      xCursor += w;
      return rect;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Decomposition of the invisibility gap into four channels" class="bs-decomp-svg" preserveAspectRatio="none">
<style>.bs-seg-label { font-family: var(--mono); font-size: 12px; fill: #fff; font-weight: 500; }</style>
${segs}
</svg>`;
}
