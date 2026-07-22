import { describe, expect, it } from "vitest";
import { INDEX_PARAMS } from "../src/content/capitalization-factors.ts";
import { channelSum, computeInvisibilityIndex } from "../src/data/index-calc.ts";

const seed = {
  surveyShare: 0.137,
  paretoShare: 0.24,
  capShare: 0.266,
  totalHouseholdWealthCad: 16_400_000_000_000,
  params: INDEX_PARAMS,
};

describe("the Invisibility Index", () => {
  it("the gap is (highest − lowest share) × total wealth", () => {
    const r = computeInvisibilityIndex(seed);
    const expected = (0.266 - 0.137) * 16_400_000_000_000;
    expect(r.total_gap_cad).toBeCloseTo(expected, 0);
  });

  it("identifies the endpoints: capitalization high, survey low", () => {
    const r = computeInvisibilityIndex(seed);
    expect(r.high_method).toBe("capitalization");
    expect(r.low_method).toBe("survey");
  });

  it("the four channels partition the gap exactly", () => {
    const r = computeInvisibilityIndex(seed);
    expect(channelSum(r)).toBeCloseTo(r.total_gap_cad, 2);
  });

  it("channel weights follow the stated shares", () => {
    const r = computeInvisibilityIndex(seed);
    expect(r.ch_unrealized_cad / r.total_gap_cad).toBeCloseTo(INDEX_PARAMS.unrealizedShare, 6);
    expect(r.ch_offshore_cad / r.total_gap_cad).toBeCloseTo(INDEX_PARAMS.offshoreShare, 6);
  });

  it("recovery ratio is pareto ÷ capitalization", () => {
    const r = computeInvisibilityIndex(seed);
    expect(r.recovery_ratio).toBeCloseTo(0.24 / 0.266, 6);
  });

  it("is robust to method ordering (finds max/min regardless)", () => {
    const r = computeInvisibilityIndex({ ...seed, surveyShare: 0.5, capShare: 0.1 });
    expect(r.high_method).toBe("survey");
    expect(r.low_method).toBe("capitalization");
  });
});
