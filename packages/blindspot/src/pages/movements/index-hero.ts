// Movement 2 renderer — the Invisibility Index. The hero number, the
// recovery-ratio honesty line, the four-channel stacked bar, and the
// four channel cards.

import { channelsFromIndex, decompositionBarSvg } from "../../charts/decomposition.ts";
import { CHANNELS, INDEX_PARAMS } from "../../content/capitalization-factors.ts";
import type { IndexRow } from "../../data/queries.ts";
import { sourceById } from "../../sources/registry.ts";
import { formatCadLong } from "../format.ts";
import { escapeAttr, escapeHtml } from "../shell.ts";

const CHANNEL_SOURCE: Record<string, string> = {
  unrealizedShare: "fox-liscow",
  privateEquityShare: "ksz-zwick",
  offshoreShare: "ajz",
  nonresponseShare: "sfs-technical",
};

function channelCards(): string {
  return CHANNELS.map((ch) => {
    const src = sourceById(CHANNEL_SOURCE[ch.key] ?? "");
    const cite = src
      ? `<a class="bs-cite" href="${escapeAttr(src.url)}" rel="noreferrer"><span class="bs-cite-method">source</span><span>${escapeHtml(src.name)}</span></a>`
      : "";
    const share = Math.round((INDEX_PARAMS[ch.key] as number) * 100);
    return `<article class="bs-channel-card">
  <div class="bs-channel-kicker">${share}% of the gap</div>
  <h3 class="bs-channel-h3">${escapeHtml(ch.label)}</h3>
  <p class="bs-channel-blurb">${escapeHtml(ch.blurb)}</p>
  ${cite}
</article>`;
  }).join("");
}

export function renderIndexHero(index: IndexRow | null): string {
  if (!index) {
    return `<section class="bs-movement" id="index">
  <div class="bs-movement-head"><span class="bs-movement-num">02</span><h2 class="bs-movement-h2">The Invisibility Index</h2></div>
  <p class="bs-movement-dek">The size of the disagreement at the top, as a single number.</p>
  <div class="bs-empty">No data yet — the operator refreshes the sources to compute the Index.</div>
</section>`;
  }

  const bar = decompositionBarSvg(channelsFromIndex(index));
  const recovery =
    index.recovery_ratio != null
      ? `recovery ratio ${(index.recovery_ratio * 100).toFixed(0)}% ${index.recovery_ratio < INDEX_PARAMS.recoveryTarget ? "· flagged unreliable" : "· within tolerance"}`
      : "";

  return `<section class="bs-movement bs-index" id="index">
  <div class="bs-movement-head"><span class="bs-movement-num">02</span><h2 class="bs-movement-h2">The Invisibility Index</h2></div>
  <div class="bs-index-hero">
    <div class="bs-index-number">${escapeHtml(formatCadLong(index.total_gap_cad))}</div>
    <p class="bs-index-caption">The wealth the highest official method sees at the top 1% (${index.year}) that the lowest official method does not. A CANOPTICON construction with stated assumptions.</p>
    <div class="bs-index-recovery">${escapeHtml(recovery)}</div>
  </div>
  ${bar ? `<figure class="bs-figure bs-decomp">${bar}</figure>` : ""}
  <div class="bs-channels">${channelCards()}</div>
</section>`;
}
