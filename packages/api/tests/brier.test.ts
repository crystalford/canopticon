import { describe, expect, it } from "vitest";
import { brierContribution, computeRollingBrier } from "../src/lib/brier.ts";

describe("brierContribution", () => {
  it("rewards confident correct predictions", () => {
    expect(brierContribution(0.9, "correct")).toBeCloseTo(0.01, 4);
  });

  it("punishes confident incorrect predictions", () => {
    expect(brierContribution(0.9, "incorrect")).toBeCloseTo(0.81, 4);
  });

  it("penalizes uninformative coin-flip on either resolution", () => {
    expect(brierContribution(0.5, "correct")).toBeCloseTo(0.25, 4);
    expect(brierContribution(0.5, "incorrect")).toBeCloseTo(0.25, 4);
  });

  it("treats ambiguous as fixed 0.25 regardless of probability", () => {
    expect(brierContribution(0.1, "ambiguous")).toBe(0.25);
    expect(brierContribution(0.9, "ambiguous")).toBe(0.25);
  });

  it("rounds to 4 decimal places", () => {
    const out = brierContribution(0.333, "correct");
    expect(Math.round(out * 10000) / 10000).toBe(out);
  });
});

describe("computeRollingBrier", () => {
  it("returns null rolling brier when nothing is resolved", () => {
    const r = computeRollingBrier([{ brier_contribution: null }, { brier_contribution: null }]);
    expect(r.rolling_brier).toBeNull();
    expect(r.active_count).toBe(2);
    expect(r.resolved_count).toBe(0);
  });

  it("averages resolved contributions and ignores unresolved", () => {
    const r = computeRollingBrier([
      { brier_contribution: 0.04 },
      { brier_contribution: 0.16 },
      { brier_contribution: null },
    ]);
    expect(r.rolling_brier).toBeCloseTo(0.1, 4);
    expect(r.resolved_count).toBe(2);
    expect(r.active_count).toBe(1);
  });

  it("rounds the rolling average to 4 decimal places", () => {
    const r = computeRollingBrier([
      { brier_contribution: 0.1 },
      { brier_contribution: 0.2 },
      { brier_contribution: 0.3 },
    ]);
    expect(r.rolling_brier).toBe(0.2);
  });
});
