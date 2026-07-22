// The source registry — single source of truth for every input the
// instrument stands on. The /sources page renders this catalog; the
// method paper cites into it by id (so a citation and its catalog entry
// can never drift). Ingest adapters (Commit 4) also key off these ids.
//
// Two kinds: `official` statistics the instrument pulls and snapshots,
// and `academic` sources that ground the interpretive parameters (the
// four channels of the Invisibility Index). Only the official series
// produce fact rows; the academic sources justify the model.

export type SourceKind = "official" | "academic";
export type Method = "survey" | "pareto" | "capitalization";

export interface Source {
  id: string;
  name: string;
  publisher: string;
  kind: SourceKind;
  /** Which of the three methods this source feeds, if any. */
  method?: Method;
  /** How often the publisher releases it. */
  cadence: string;
  /** Landing / download URL. */
  url: string;
  /** StatCan product id where applicable (drives change detection). */
  cubePid?: string;
  /** One line: what this source contributes to the instrument. */
  role: string;
}

export const SOURCES: Source[] = [
  {
    id: "sfs",
    name: "Survey of Financial Security (SFS)",
    publisher: "Statistics Canada",
    kind: "official",
    method: "survey",
    cadence: "Roughly every 3 years (2012, 2016, 2019, 2023)",
    url: "https://www150.statcan.gc.ca/n1/en/surveys/2620",
    cubePid: "11-10-0049-01",
    role: "The direct household survey. Reports the top 1%'s share of net worth at roughly 13.7% — the lowest of the three methods, because the richest households are the least likely to respond.",
  },
  {
    id: "dhea",
    name: "Distributions of Household Economic Accounts (DHEA)",
    publisher: "Statistics Canada",
    kind: "official",
    method: "capitalization",
    cadence: "Quarterly",
    url: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610066001",
    cubePid: "36-10-0660-01",
    role: "StatCan's distributional accounts, benchmarked to the National Balance Sheet. Puts the top 1%'s share near 26.6% — the highest of the three — because it captures assets the survey misses.",
  },
  {
    id: "pbo-hnw",
    name: "High-net-worth family wealth estimates",
    publisher: "Parliamentary Budget Officer",
    kind: "official",
    method: "pareto",
    cadence: "Occasional (2020, 2023)",
    url: "https://www.pbo-dpb.ca/en/publications",
    role: "A Pareto extrapolation of the survey's upper tail, correcting for the top being under-sampled. Puts the top 1%'s share near 24%, with the top 1% threshold around $7.4M across ~169,400 families (2023).",
  },
  {
    id: "cra-t1",
    name: "T1 Final Statistics (income by asset-generating source)",
    publisher: "Canada Revenue Agency",
    kind: "official",
    method: "capitalization",
    cadence: "Annual",
    url: "https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency-cra/income-statistics-gst-hst-statistics/t1-final-statistics.html",
    role: "Capital-income flows (interest, dividends, business income) by income group. The raw material the capitalization method turns into wealth stocks via the capitalization factors.",
  },
  {
    id: "nbsa",
    name: "National Balance Sheet Accounts (NBSA)",
    publisher: "Statistics Canada",
    kind: "official",
    cadence: "Quarterly",
    url: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610058001",
    cubePid: "36-10-0580-01",
    role: "Aggregate household balance sheet: financial vs non-financial assets and debt-to-disposable-income. Feeds the behavior strip — the saving-glut → indebted-demand circuit — not the top-tail estimate.",
  },
  {
    id: "ksz-zwick",
    name: "Capitalization method (Kopczuk, Smith, Zidar, Zwick and predecessors)",
    publisher: "Academic literature",
    kind: "academic",
    method: "capitalization",
    cadence: "n/a",
    url: "https://www.nber.org/",
    role: "The methodological basis of the capitalization approach and its known sensitivity to the assumed rates of return. Grounds the capitalization factors.",
  },
  {
    id: "fox-liscow",
    name: "The unrealized-gains / buy–borrow–die literature",
    publisher: "Academic literature",
    kind: "academic",
    cadence: "n/a",
    url: "https://www.nber.org/",
    role: "Why unrealized capital gains are the largest channel of invisible wealth: gains that are never sold never become income, so income-based methods never see them. Grounds the unrealized-gains channel.",
  },
  {
    id: "ajz",
    name: "Offshore wealth (Alstadsæter, Johannesen, Zucman)",
    publisher: "Academic literature",
    kind: "academic",
    cadence: "n/a",
    url: "https://gabriel-zucman.eu/",
    role: "Estimates of wealth held through foreign structures that report no domestic income and escape domestic survey frames. Grounds the offshore channel.",
  },
  {
    id: "sfs-technical",
    name: "SFS technical + non-response documentation",
    publisher: "Statistics Canada",
    kind: "academic",
    method: "survey",
    cadence: "n/a",
    url: "https://www150.statcan.gc.ca/n1/en/surveys/2620",
    role: "The survey's own account of top-tail under-coverage and non-response. Grounds the survey non-response channel.",
  },
];

export function sourceById(id: string): Source | undefined {
  return SOURCES.find((s) => s.id === id);
}

/** Methods each source feeds — used to badge the three methods on the
 *  spread chart and the sources page. */
export const METHOD_LABELS: Record<Method, string> = {
  survey: "Survey (SFS)",
  pareto: "Pareto (PBO)",
  capitalization: "Capitalization (DHEA)",
};
