// CRA adapter — T1 Final Statistics capital-income flows, by asset class.
//
// These flows are what the capitalization method turns into wealth stocks
// (flow × factor). v1 uses them for the recovery cross-check, not to
// replace the DHEA share. Documented aggregate flows for the top income
// group ship as the default; a live CSV pull can replace them later.

import { CAPITALIZATION_FACTORS } from "../content/capitalization-factors.ts";
import type { CapitalInput } from "../data/capitalize.ts";

const CRA_URL =
  "https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency-cra/income-statistics-gst-hst-statistics/t1-final-statistics.html";

// Documented order-of-magnitude capital-income flows attributable to the
// top 1% of tax filers (CAD, 2023). Interest / dividends / business /
// capital-gains proxy — the four classes the factors capitalize.
export const TOP_GROUP_FLOWS_CAD: Record<string, number> = {
  "Interest-bearing (deposits, bonds)": 18_000_000_000,
  "Dividends (listed equity)": 41_000_000_000,
  "Business + professional income": 55_000_000_000,
  "Realized capital gains (proxy)": 62_000_000_000,
};

/** Pair the documented flows with their capitalization factors, ready for
 *  capitalizeWealth(). Classes are matched to CAPITALIZATION_FACTORS by
 *  label; an unmatched class is skipped (never guessed). */
export function craCapitalInputs(): CapitalInput[] {
  const inputs: CapitalInput[] = [];
  for (const f of CAPITALIZATION_FACTORS) {
    const amount = TOP_GROUP_FLOWS_CAD[f.assetClass];
    if (amount !== undefined) inputs.push({ amountCad: amount, factor: f.factor });
  }
  return inputs;
}

export const CRA_SOURCE_URL = CRA_URL;
