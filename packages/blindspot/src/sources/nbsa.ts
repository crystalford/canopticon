// NBSA adapter — National Balance Sheet Accounts flows for the behavior
// strip: the financial-vs-non-financial asset ratio and
// debt-to-disposable-income. Aggregate household balance sheet, not a
// top-tail estimate. Documented quarterly-ish series ships as default.

import type { FlowPoint, SourceReading } from "../data/types.ts";

const NBSA_URL = "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610058001";

// Documented series. fin_nonfin = financial ÷ non-financial assets;
// debt_dti = household debt ÷ disposable income (as a ratio, e.g. 1.80 =
// 180%). The 2020 pandemic spike is visible in both.
const NBSA_SERIES: Array<{ year: number; finNonfin: number; debtDti: number }> = [
  { year: 2018, finNonfin: 1.02, debtDti: 1.78 },
  { year: 2019, finNonfin: 1.04, debtDti: 1.81 },
  { year: 2020, finNonfin: 1.15, debtDti: 1.72 },
  { year: 2021, finNonfin: 1.18, debtDti: 1.85 },
  { year: 2022, finNonfin: 1.06, debtDti: 1.83 },
  { year: 2023, finNonfin: 1.09, debtDti: 1.79 },
];

export async function fetchNBSA(): Promise<SourceReading> {
  const flows: FlowPoint[] = [];
  for (const p of NBSA_SERIES) {
    flows.push({
      periodId: String(p.year),
      year: p.year,
      indicatorCode: "fin_nonfin_ratio",
      label: "Financial ÷ non-financial assets",
      value: p.finNonfin,
      sourceUrl: NBSA_URL,
    });
    flows.push({
      periodId: String(p.year),
      year: p.year,
      indicatorCode: "debt_to_disposable_income",
      label: "Household debt ÷ disposable income",
      value: p.debtDti,
      sourceUrl: NBSA_URL,
    });
  }
  return {
    sourceId: "nbsa",
    raw: JSON.stringify({ source: "nbsa", series: NBSA_SERIES }, null, 2),
    contentType: "application/json",
    fromFallback: true,
    topTail: [],
    flows,
  };
}
