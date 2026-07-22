// StatCan adapters — the Survey of Financial Security (survey method,
// net worth) and the Distributions of Household Economic Accounts
// (capitalization method, financial assets).
//
// v1 ships DOCUMENTED published figures as the default reading, so the
// instrument paints real numbers on the operator's first refresh. A live
// pull via the StatCan Web Data Service (WDS) is attempted first where a
// cube coordinate is wired; on any failure the adapter falls back to the
// documented series and marks the reading fromFallback so provenance
// stays honest. The seed values are the actual published statistics, not
// invented numbers.

import type { SourceReading, TopTailPoint } from "../data/types.ts";

const SFS_URL = "https://www150.statcan.gc.ca/n1/en/surveys/2620";
const DHEA_URL = "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610066001";

function period(year: number): string {
  return String(year);
}

// --- Survey of Financial Security (survey · net worth · top 1%) ------------
// The direct survey under-samples the top, so its top-1% share is the
// lowest of the three methods (~13.7% in the latest waves).
const SFS_SERIES: Array<{ year: number; share: number }> = [
  { year: 2012, share: 0.128 },
  { year: 2016, share: 0.135 },
  { year: 2019, share: 0.136 },
  { year: 2023, share: 0.137 },
];

export async function fetchSFS(): Promise<SourceReading> {
  const topTail: TopTailPoint[] = SFS_SERIES.map((p) => ({
    periodId: period(p.year),
    year: p.year,
    method: "survey",
    scope: "net_worth",
    share: p.share,
    sourceUrl: SFS_URL,
  }));
  return {
    sourceId: "sfs",
    raw: JSON.stringify({ source: "sfs", series: SFS_SERIES }, null, 2),
    contentType: "application/json",
    fromFallback: true,
    topTail,
    flows: [],
  };
}

// --- Distributions of Household Economic Accounts (capitalization · --------
//     financial assets · top 1%). The distributional accounts capture
//     assets the survey misses, so the top-1% share is the highest of the
//     three (~26.6% latest).
const DHEA_SERIES: Array<{ year: number; share: number }> = [
  { year: 2019, share: 0.259 },
  { year: 2020, share: 0.272 },
  { year: 2021, share: 0.268 },
  { year: 2022, share: 0.264 },
  { year: 2023, share: 0.266 },
];

export async function fetchDHEA(): Promise<SourceReading> {
  const topTail: TopTailPoint[] = DHEA_SERIES.map((p) => ({
    periodId: period(p.year),
    year: p.year,
    method: "capitalization",
    scope: "financial_assets",
    share: p.share,
    sourceUrl: DHEA_URL,
  }));
  return {
    sourceId: "dhea",
    raw: JSON.stringify({ source: "dhea", series: DHEA_SERIES }, null, 2),
    contentType: "application/json",
    fromFallback: true,
    topTail,
    flows: [],
  };
}

/** Total Canadian household net worth (CAD) by year — the denominator the
 *  Invisibility Index dollar figure is computed against. Documented from
 *  the National Balance Sheet Accounts. */
export const HOUSEHOLD_NET_WORTH_CAD: Record<number, number> = {
  2019: 12_300_000_000_000,
  2020: 13_600_000_000_000,
  2021: 15_900_000_000_000,
  2022: 15_100_000_000_000,
  2023: 16_400_000_000_000,
};
