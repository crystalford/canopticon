// Where You Stand — the percentile placement, as a pure function.
//
// Given a net-worth figure, place it on the official Canadian
// distribution by log-linear interpolation between published anchor
// points (percentile ↔ net-worth threshold). Wealth is heavy-tailed, so
// interpolation is done in log(net worth) space. Past the top official
// anchor (the top-1% threshold), the placement is an EXTRAPOLATION into
// the exact region the instrument exists to say is unresolved — flagged
// so the UI can shade it in the disagreement-zone colour.

export interface PercentileAnchor {
  /** Cumulative percentile as a fraction, e.g. 0.99 for the top-1% cut. */
  percentile: number;
  /** Net-worth threshold at that percentile, CAD. */
  thresholdCad: number;
}

// Documented anchors for the Canadian net-worth distribution. The top-1%
// threshold (~$7.4M, 2023) is the PBO figure; the rest are order-of-
// magnitude anchors from the SFS distribution. The p99 anchor is the
// official edge — beyond it, placement is extrapolation.
export const OFFICIAL_ANCHORS: PercentileAnchor[] = [
  { percentile: 0.2, thresholdCad: 20_000 },
  { percentile: 0.5, thresholdCad: 470_000 },
  { percentile: 0.8, thresholdCad: 1_200_000 },
  { percentile: 0.9, thresholdCad: 1_900_000 },
  { percentile: 0.95, thresholdCad: 3_100_000 },
  { percentile: 0.99, thresholdCad: 7_400_000 },
];

/** The official edge percentile — the last anchor. At or above its
 *  threshold, placement is extrapolation. */
export const OFFICIAL_EDGE = 0.99;

export interface Placement {
  /** Cumulative percentile, 0..1 (fraction of households below). */
  percentile: number;
  /** True when the figure is past the official top anchor — the number
   *  is an extrapolation into the unresolved zone. */
  extrapolated: boolean;
}

/** Place a net-worth figure on the distribution. Anchors are assumed
 *  sorted ascending by threshold. */
export function placeOnPercentile(
  netWorthCad: number,
  anchors: PercentileAnchor[] = OFFICIAL_ANCHORS,
): Placement {
  const sorted = [...anchors].sort((a, b) => a.thresholdCad - b.thresholdCad);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return { percentile: 0, extrapolated: false };

  // Below the first anchor: clamp toward 0.
  if (netWorthCad <= first.thresholdCad) {
    const frac = Math.max(0, netWorthCad / first.thresholdCad);
    return { percentile: first.percentile * frac, extrapolated: false };
  }

  // Between two anchors: log-linear interpolation.
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (lo && hi && netWorthCad >= lo.thresholdCad && netWorthCad <= hi.thresholdCad) {
      const t =
        (Math.log(netWorthCad) - Math.log(lo.thresholdCad)) /
        (Math.log(hi.thresholdCad) - Math.log(lo.thresholdCad));
      return {
        percentile: lo.percentile + t * (hi.percentile - lo.percentile),
        extrapolated: false,
      };
    }
  }

  // Above the top anchor: extrapolate a Pareto tail. The percentile
  // asymptotes toward 1 but never reaches it. Flagged extrapolated.
  const extra = paretoTailPercentile(netWorthCad, last);
  return { percentile: extra, extrapolated: true };
}

/** Extrapolate above the official edge with a Pareto tail. Uses a fixed
 *  tail index (alpha ≈ 1.5, typical for top wealth) so the curve is
 *  smooth and monotonic; the point is to VISUALISE the unresolved zone,
 *  not to assert a precise percentile there. */
function paretoTailPercentile(netWorthCad: number, edge: PercentileAnchor): number {
  const alpha = 1.5;
  const remaining = 1 - edge.percentile; // mass above the edge, e.g. 0.01
  // Fraction of the above-edge mass that is ALSO above netWorthCad.
  const aboveShare = (edge.thresholdCad / netWorthCad) ** alpha;
  const percentile = 1 - remaining * aboveShare;
  return Math.min(0.999999, percentile);
}

/** Human label for a placement (e.g. "top 0.4%" or "62nd percentile"). */
export function placementLabel(p: Placement): string {
  const topPct = (1 - p.percentile) * 100;
  if (p.percentile >= 0.99) {
    const top = topPct < 0.1 ? topPct.toFixed(3) : topPct.toFixed(2);
    return `top ${top}%`;
  }
  const nth = Math.round(p.percentile * 100);
  return `${nth}${ordinalSuffix(nth)} percentile`;
}

function ordinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}
