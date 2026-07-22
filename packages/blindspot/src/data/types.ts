// Shared domain types for the data layer.

export type Method = "survey" | "pareto" | "capitalization";
export type Scope = "net_worth" | "financial_assets";

/** A single top-tail observation from one source, for one period. */
export interface TopTailPoint {
  periodId: string;
  year: number;
  method: Method;
  scope: Scope;
  /** Top-1% share, 0..1. */
  share: number;
  /** Net-worth cut for the top 1%, CAD, where the source reports it. */
  thresholdCad?: number;
  familyCount?: number;
  sourceUrl: string;
}

/** One aggregate balance-sheet flow (for the behavior strip). */
export interface FlowPoint {
  periodId: string;
  year: number;
  indicatorCode: string;
  label: string;
  value: number;
  sourceUrl: string;
}

/** What every source adapter returns: the parsed facts plus the raw
 *  bytes to snapshot (provenance) and the origin metadata. */
export interface SourceReading {
  sourceId: string;
  /** Raw bytes to store in R2 — the exact thing we read. */
  raw: string;
  contentType: string;
  /** True when the values came from the documented fallback rather than
   *  a live pull. Surfaced in update_log so provenance stays honest. */
  fromFallback: boolean;
  topTail: TopTailPoint[];
  flows: FlowPoint[];
}
