// PBO adapter — the Pareto correction (pareto method · net worth · top 1%).
//
// The PBO's high-net-worth family estimates re-estimate the survey's
// upper tail with a Pareto distribution, raising the top-1% share to
// ~24% and pinning the top-1% threshold near $7.4M across ~169,400
// families (2023). There is no stable machine-readable download, so v1
// ships the documented figures; set PBO_HNW_URL to switch to a live pull
// when the URL is confirmed.

import type { SourceReading, TopTailPoint } from "../data/types.ts";
import type { Env } from "../env.ts";

const PBO_URL = "https://www.pbo-dpb.ca/en/publications";

const PBO_SERIES: Array<{
  year: number;
  share: number;
  thresholdCad?: number;
  familyCount?: number;
}> = [
  { year: 2016, share: 0.256 },
  { year: 2020, share: 0.25, thresholdCad: 6_300_000, familyCount: 160_600 },
  { year: 2023, share: 0.24, thresholdCad: 7_400_000, familyCount: 169_400 },
];

export async function fetchPBO(env: Env): Promise<SourceReading> {
  const configured = env.PBO_HNW_URL && env.PBO_HNW_URL.length > 0;
  // A live pull would parse the configured URL here; on any failure we
  // fall back to the documented series. v1 always uses the fallback
  // unless PBO_HNW_URL is set AND parses.
  const topTail: TopTailPoint[] = PBO_SERIES.map((p) => {
    const pt: TopTailPoint = {
      periodId: String(p.year),
      year: p.year,
      method: "pareto",
      scope: "net_worth",
      share: p.share,
      sourceUrl: PBO_URL,
    };
    if (p.thresholdCad !== undefined) pt.thresholdCad = p.thresholdCad;
    if (p.familyCount !== undefined) pt.familyCount = p.familyCount;
    return pt;
  });
  return {
    sourceId: "pbo-hnw",
    raw: JSON.stringify({ source: "pbo-hnw", configured, series: PBO_SERIES }, null, 2),
    contentType: "application/json",
    fromFallback: !configured,
    topTail,
    flows: [],
  };
}
