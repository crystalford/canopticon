// The Invisibility Index calculation, as a pure function.
//
// The Index is the dollar value of the gap at the top: the wealth the
// highest method sees and the lowest method does not, for the top 1%.
// It is then split into the four channels by the stated shares. The
// channels partition the gap exactly (they sum to the total), which the
// tests assert.

import type { IndexParams } from "../content/capitalization-factors.ts";
import type { Method } from "./types.ts";

export interface IndexInput {
  surveyShare: number; // top-1% share, survey (lowest)
  paretoShare: number; // top-1% share, Pareto
  capShare: number; // top-1% share, capitalization (highest)
  /** Total household wealth (CAD) the shares are shares OF. */
  totalHouseholdWealthCad: number;
  params: IndexParams;
}

export interface IndexResult {
  total_gap_cad: number;
  ch_unrealized_cad: number;
  ch_private_equity_cad: number;
  ch_offshore_cad: number;
  ch_nonresponse_cad: number;
  recovery_ratio: number;
  /** Which method sat highest / lowest (the gap's endpoints). */
  high_method: Method;
  low_method: Method;
}

/** Compute the Invisibility Index + its four-channel decomposition. The
 *  gap is (highest share − lowest share) × total wealth; each channel is
 *  its stated share of that gap. Robust to which method is highest. */
export function computeInvisibilityIndex(input: IndexInput): IndexResult {
  const points: Array<{ method: Method; share: number }> = [
    { method: "survey", share: input.surveyShare },
    { method: "pareto", share: input.paretoShare },
    { method: "capitalization", share: input.capShare },
  ];
  const high = points.reduce((a, b) => (b.share > a.share ? b : a));
  const low = points.reduce((a, b) => (b.share < a.share ? b : a));

  const gapShare = high.share - low.share;
  const total = gapShare * input.totalHouseholdWealthCad;

  const p = input.params;
  return {
    total_gap_cad: total,
    ch_unrealized_cad: total * p.unrealizedShare,
    ch_private_equity_cad: total * p.privateEquityShare,
    ch_offshore_cad: total * p.offshoreShare,
    ch_nonresponse_cad: total * p.nonresponseShare,
    recovery_ratio: input.capShare > 0 ? input.paretoShare / input.capShare : 0,
    high_method: high.method,
    low_method: low.method,
  };
}

/** The four channel dollar amounts, summed — should equal total_gap_cad. */
export function channelSum(r: IndexResult): number {
  return r.ch_unrealized_cad + r.ch_private_equity_cad + r.ch_offshore_cad + r.ch_nonresponse_cad;
}
