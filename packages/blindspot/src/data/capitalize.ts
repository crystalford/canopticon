// The capitalization method, as pure functions.
//
// The capitalization method recovers a wealth stock from a capital-income
// flow: stock = flow × factor, where factor = 1 / (rate of return). Sum
// across asset classes to get the group's capitalized wealth. This is the
// arithmetic behind the DHEA-style estimate; the factors it uses are the
// documented assumptions in content/capitalization-factors.ts.

export interface CapitalInput {
  /** The capital-income flow for one asset class, in CAD. */
  amountCad: number;
  /** The capitalization factor for that asset class (1 / return). */
  factor: number;
}

/** Capitalize a set of income flows into a single wealth stock (CAD). */
export function capitalizeWealth(inputs: CapitalInput[]): number {
  return inputs.reduce((sum, i) => sum + i.amountCad * i.factor, 0);
}

/** The recovery ratio: how the two upper-tail methods relate. Published
 *  as pareto_share / capitalization_share. Near 1.0 = the methods agree
 *  at the top; well below the target = the capitalization method is
 *  recovering far more top wealth than the Pareto correction, and the
 *  period should be flagged unreliable. Guards against divide-by-zero. */
export function recoveryRatio(paretoShare: number, capShare: number): number {
  if (capShare <= 0) return 0;
  return paretoShare / capShare;
}

/** Whether a period should be flagged unreliable given its recovery
 *  ratio and the stated target (default from INDEX_PARAMS.recoveryTarget). */
export function isUnreliable(ratio: number, target: number): boolean {
  return ratio < target;
}
