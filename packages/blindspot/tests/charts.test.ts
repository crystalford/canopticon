import { describe, expect, it } from "vitest";
import { behaviorStripSvg } from "../src/charts/behavior.ts";
import { channelsFromIndex, decompositionBarSvg } from "../src/charts/decomposition.ts";
import { percentileAxisSvg } from "../src/charts/percentile.ts";
import { spreadChartSvg } from "../src/charts/spread.ts";

describe("spread chart", () => {
  const rows = [
    { year: 2019, survey: 0.136, pareto: null, capitalization: 0.259 },
    { year: 2023, survey: 0.137, pareto: 0.24, capitalization: 0.266 },
  ];

  it("paints an SVG with the disagreement zone + method labels", () => {
    const svg = spreadChartSvg(rows);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<polygon"); // the filled zone (headline visual)
    expect(svg).toContain("the zone official statistics cannot resolve");
    expect(svg).toContain("Survey (SFS)");
    expect(svg).toContain("Capitalization (DHEA)");
    // The permanent scope-flag pill.
    expect(svg).toContain("Different denominators");
  });

  it("returns empty string for no rows (caller shows the placeholder)", () => {
    expect(spreadChartSvg([])).toBe("");
  });
});

describe("decomposition bar", () => {
  it("stacks four channel segments that fill the bar", () => {
    const svg = decompositionBarSvg(
      channelsFromIndex({
        year: 2023,
        total_gap_cad: 2_000_000_000_000,
        ch_unrealized_cad: 1_100_000_000_000,
        ch_private_equity_cad: 660_000_000_000,
        ch_offshore_cad: 160_000_000_000,
        ch_nonresponse_cad: 80_000_000_000,
        recovery_ratio: 0.9,
      }),
    );
    expect(svg).toContain("<svg");
    expect((svg.match(/<rect/g) ?? []).length).toBe(4);
    expect(svg).toContain("Unrealized gains");
  });
});

describe("behavior strip", () => {
  it("annotates the 2020 pandemic spike when present", () => {
    const svg = behaviorStripSvg([
      { year: 2019, finNonfin: 1.04, debtDti: 1.81 },
      { year: 2020, finNonfin: 1.15, debtDti: 1.72 },
      { year: 2023, finNonfin: 1.09, debtDti: 1.79 },
    ]);
    expect(svg).toContain("<svg");
    expect(svg).toContain("pandemic savings glut");
  });
});

describe("percentile axis", () => {
  it("marks the official edge and ships a positioned marker", () => {
    const svg = percentileAxisSvg();
    expect(svg).toContain('id="bs-marker"');
    expect(svg).toContain("official top-1% edge");
    expect(svg).toContain("unresolved");
  });
});
