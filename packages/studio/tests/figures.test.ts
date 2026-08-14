// Figures — the verbatim floor, and what the palette does with a number.
//
// The IHAP essay is the reason this file exists. It is an institutional
// investigation whose argument is arithmetic, and it found two defects the
// abstract essay could not have: a hedge detector that fired on the words
// "asylum claims", and twenty-four DATA-consuming primitives with nothing
// upstream of them.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { looksContested } from "../src/compile/extract-reading.ts";
import {
  chartFor,
  extractFigures,
  extractRoute,
  parseSeries,
  serialiseFigures,
} from "../src/compile/figures.ts";
import { planTreatment } from "../src/compile/treatment.ts";
import type { SemanticReading } from "../src/ir/schema.ts";
import { must } from "./must.ts";

const reading = (over: Partial<SemanticReading> = {}): SemanticReading => ({
  sentence: "x",
  subjects: [{ label: "the program", kind: "concept", weight: 0.9 }],
  visualOpportunity: "establish",
  contested: false,
  ...over,
});

describe("figures are lifted verbatim", () => {
  it("keeps the exact substring, cents and all", () => {
    const f = extractFigures(
      "The City of Niagara Falls received a federal IHAP grant of $282,345.84 for 2024-2025.",
    );
    const money = must(f.find((x) => x.kind === "money"));
    // Not $282,346. Not $282.3K. The digits the essay printed.
    expect(money.text).toBe("$282,345.84");
    expect(money.value).toBeCloseTo(282345.84, 2);
  });

  it("every figure is literally present at the offset it claims", () => {
    const s = "Budget 2024 allocates $1.1 billion over three years (2024-2027).";
    for (const f of extractFigures(s)) {
      expect(s.slice(f.offset, f.offset + f.text.length)).toBe(f.text);
    }
  });

  it("money wins the span, so a year inside a sum is not a year", () => {
    const f = extractFigures("cost between $750 million and $1.1 billion");
    expect(f.map((x) => x.text)).toEqual(["$750 million", "$1.1 billion"]);
    expect(f.every((x) => x.kind === "money")).toBe(true);
  });

  it("a bare small number is not a figure", () => {
    // "three years" and "one purpose" would make every sentence a chart.
    expect(extractFigures("designated for one purpose").length).toBe(0);
  });

  it("a count needs separators or a unit noun", () => {
    expect(must(extractFigures("Peak occupancy: 7,000 people")[0]).text).toBe("7,000 people");
  });

  it("round-trips through the wire format the Lab reads", () => {
    const f = extractFigures("$912.3M to Ontario, 57,440 claims, in 2025");
    const back = parseSeries(serialiseFigures(f));
    expect(back.map((x) => x.text)).toEqual(f.map((x) => x.text));
  });

  it("the Lab's own parser agrees with the compiler's serialiser", () => {
    // The Lab is a static page with no build step, so it carries its own
    // copy of parseSeries. This runs THAT source — not a re-implementation
    // of it — so the two halves cannot drift apart unnoticed.
    const src = readFileSync(new URL("../lab/prims-i.js", import.meta.url), "utf8");
    const fn = must(/function parseSeries\(series\) \{[\s\S]*?\n\}/.exec(src))[0];
    const labParse = new Function(`${fn}; return parseSeries;`)() as (
      s: string,
    ) => { text: string; kind: string; value: number }[];

    const f = extractFigures("$750 million and 7,000 people in 2017");
    const wire = serialiseFigures(f);
    expect(labParse(wire).map((x) => x.text)).toEqual(f.map((x) => x.text));
    expect(labParse(wire).map((x) => x.kind)).toEqual(f.map((x) => x.kind));
  });
});

describe("routes are read, never inferred", () => {
  it("reads an arrow route", () => {
    const r = extractRoute(
      "IHAP Model (Post-Sept 2025): Ottawa → IHAP grants → Provincial governments → Hotel contracts",
    );
    expect(r).toEqual(["Ottawa", "IHAP grants", "Provincial governments", "Hotel contracts"]);
  });

  it("refuses to invent a route from prose", () => {
    // "flows through" describes a route; it does not draw one. Inferring
    // here would manufacture a claim about where money goes.
    expect(extractRoute("The money still flows from Ottawa through local governments.")).toEqual(
      [],
    );
  });
});

describe("the hedge detector reads the register, not substrings", () => {
  it("does not fire on asylum claims or claimants", () => {
    // The original list contained bare "claims"/"claimed" and produced
    // three false positives on this essay — the subject matter itself.
    expect(looksContested("Asylum claims received (H1 2025): 57,440")).toBe(false);
    expect(looksContested("housing provided to asylum claimants")).toBe(false);
  });

  it("still fires on real attribution", () => {
    expect(looksContested("He claimed that the detector was on the ceiling.")).toBe(true);
    expect(looksContested("According to the department, nothing changed.")).toBe(true);
  });

  it("fires on institutional framing", () => {
    for (const s of [
      "This was presented as a policy shift.",
      "Framed as supporting sustainable solutions",
      "Positioned as a supplementary program",
      "Federal government declares program complete",
      "The official explanation: cost-effectiveness.",
    ]) {
      expect(looksContested(s), s).toBe(true);
    }
  });

  it("fires on a quoted span — the government's own vocabulary", () => {
    expect(looksContested('It "ended the hotel program", which is technically true.')).toBe(true);
    // An apostrophe is not a quotation.
    expect(looksContested("The government's position changed in September.")).toBe(false);
  });
});

describe("the chart is chosen by what the figures are", () => {
  it("a route always wins", () => {
    expect(chartFor([], true)).toBe("sankey_flow");
  });
  it("two years is a chronology, not a bar chart", () => {
    expect(chartFor(extractFigures("2019-2024 funding"), false)).toBe("timeline_linear");
  });
  it("one figure is a counter", () => {
    expect(chartFor(extractFigures("Ontario's share: $912.3M"), false)).toBe("counter");
  });
  it("comparable magnitudes go cartesian", () => {
    expect(chartFor(extractFigures("$750M–$1.1B and $912.3M"), false)).toBe("chart_cartesian");
  });
});

describe("the planner reaches the data family", () => {
  it("a routed sentence plans a labelled sankey", () => {
    const t = planTreatment(
      reading({ route: ["Ottawa", "IHAP grants", "Provinces", "Hotels"] }),
      "documentary",
    );
    expect(t.nodes.map((n) => n.primitiveId).slice(0, 2)).toEqual(["data_series", "sankey_flow"]);
    expect(must(t.nodes[1]).params.route).toBe("Ottawa → IHAP grants → Provinces → Hotels");
    expect(t.valid).toBe(true);
  });

  it("the verbatim series travels to the primitive as a parameter", () => {
    const figures = extractFigures("$282,345.84 for 2024-2025");
    const t = planTreatment(reading({ figures }), "documentary");
    expect(String(must(t.nodes[0]).params.series)).toContain("$282,345.84");
  });

  it("every visual language plans a valid chain for a figure-led scene", () => {
    const figures = extractFigures("cost between $750 million and $1.1 billion");
    for (const lang of ["documentary", "technical", "pixel", "surreal", "kinetic"] as const) {
      const t = planTreatment(reading({ figures }), lang);
      expect(t.valid, `${lang}: ${t.errors[0]?.message}`).toBe(true);
    }
  });

  it("a terminal head skips the tail it cannot feed, and says so", () => {
    // `counter` emits ANIMATION and nothing rasterises ANIMATION. The tail
    // is applied selectively rather than producing an invalid chain.
    const t = planTreatment(reading({ figures: extractFigures("$912.3M") }), "documentary");
    expect(t.nodes.map((n) => n.primitiveId)).toEqual(["data_series", "counter", "ease_profile"]);
    expect(t.valid).toBe(true);
    expect(t.rationale).toContain("parallax_layers skipped");
  });
});
