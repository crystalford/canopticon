import { describe, expect, it } from "vitest";
import { OFFICIAL_ANCHORS, placeOnPercentile, placementLabel } from "../src/data/percentile.ts";

describe("Where You Stand — percentile placement", () => {
  it("$7.4M lands at the top 1% (the official edge)", () => {
    const p = placeOnPercentile(7_400_000);
    expect(p.percentile).toBeCloseTo(0.99, 5);
    expect(p.extrapolated).toBe(false);
  });

  it("an anchor value returns its exact percentile", () => {
    const p = placeOnPercentile(470_000);
    expect(p.percentile).toBeCloseTo(0.5, 5);
  });

  it("past the official threshold, placement is flagged as extrapolation", () => {
    const p = placeOnPercentile(25_000_000);
    expect(p.extrapolated).toBe(true);
    expect(p.percentile).toBeGreaterThan(0.99);
    expect(p.percentile).toBeLessThan(1);
  });

  it("is monotonic — more wealth never means a lower percentile", () => {
    let prev = -1;
    for (const nw of [10_000, 470_000, 1_900_000, 7_400_000, 20_000_000, 100_000_000]) {
      const { percentile } = placeOnPercentile(nw);
      expect(percentile).toBeGreaterThanOrEqual(prev);
      prev = percentile;
    }
  });

  it("labels top-tail placements as 'top X%'", () => {
    expect(placementLabel(placeOnPercentile(7_400_000))).toContain("top");
    expect(placementLabel(placeOnPercentile(50_000_000))).toContain("top");
  });

  it("labels mid placements with an ordinal percentile", () => {
    expect(placementLabel(placeOnPercentile(470_000))).toMatch(/percentile/);
  });

  it("the official anchors are sorted and end at the 99th percentile edge", () => {
    const last = OFFICIAL_ANCHORS[OFFICIAL_ANCHORS.length - 1];
    expect(last?.percentile).toBe(0.99);
  });
});
