import { describe, expect, it } from "vitest";
import { INDEX_PARAMS } from "../src/content/capitalization-factors.ts";
import { capitalizeWealth, isUnreliable, recoveryRatio } from "../src/data/capitalize.ts";
import { craCapitalInputs } from "../src/sources/cra.ts";

describe("capitalization arithmetic", () => {
  it("capitalizes flow × factor and sums across classes", () => {
    const stock = capitalizeWealth([
      { amountCad: 100, factor: 25 },
      { amountCad: 10, factor: 40 },
    ]);
    expect(stock).toBe(100 * 25 + 10 * 40); // 2900
  });

  it("capitalizes the documented CRA flows to a large positive stock", () => {
    const stock = capitalizeWealth(craCapitalInputs());
    expect(stock).toBeGreaterThan(1_000_000_000_000); // > $1T
  });

  it("recovery ratio is pareto ÷ capitalization", () => {
    expect(recoveryRatio(0.24, 0.266)).toBeCloseTo(0.902, 3);
  });

  it("guards divide-by-zero", () => {
    expect(recoveryRatio(0.24, 0)).toBe(0);
  });

  it("flags a period unreliable only below the target", () => {
    // seed shares give ~0.90 recovery, above the 0.80 target → reliable
    expect(isUnreliable(recoveryRatio(0.24, 0.266), INDEX_PARAMS.recoveryTarget)).toBe(false);
    expect(isUnreliable(0.6, INDEX_PARAMS.recoveryTarget)).toBe(true);
  });
});
