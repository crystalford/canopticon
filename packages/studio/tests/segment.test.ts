// Segmentation — the intake, and what it refuses to decide.
//
// These run the IHAP essay through the real path: prose → IR → compile.
// Before this existed the compiler could only be reached with a
// hand-authored IR, which meant every claim about it was a claim about a
// fixture rather than about an essay.

import { describe, expect, it } from "vitest";
import { compile } from "../src/compile/index.ts";
import { segmentEssay } from "../src/compile/segment.ts";
import { parseIR } from "../src/ir/schema.ts";
import { must } from "./must.ts";

/** A compressed IHAP essay: same register, same defects to catch. Headings,
 *  a bullet list, verbatim money, a chronology, an explicit route, and the
 *  institutional hedging the detector had to learn. */
const ESSAY = `The IHAP Shell-Game

The Official Story

On September 30, 2025, the federal government ended its direct funding of hotel accommodations. The program, which had cost between $750 million and $1.1 billion since 2017, was being phased out. This was presented as a policy shift.

What Actually Happened

Nothing changed. The federal government simply redirected the funding through a different mechanism.

The Timeline

* Program established: 2017
* Peak occupancy: 7,000 people (July 2023)
* Total spend: $750M–$1.1B

The Mechanics

IHAP Model (Post-Sept 2025): Ottawa → IHAP grants → Provincial governments → Hotel contracts

Niagara Falls

The City of Niagara Falls received a federal IHAP grant of $282,345.84 for 2024-2025. The building is the same. The residents are the same.`;

const seg = () => segmentEssay(ESSAY, { projectId: "proj_test" });

describe("the essay's own structure becomes the film's", () => {
  it("takes acts from the headings and the title from the first line", () => {
    const r = seg();
    expect(r.ir.title).toBe("The IHAP Shell-Game");
    expect(r.ir.acts.map((a) => a.title)).toEqual([
      "The Official Story",
      "What Actually Happened",
      "The Timeline",
      "The Mechanics",
      "Niagara Falls",
    ]);
  });

  it("an essay with no headings is one act, not a failure", () => {
    const r = segmentEssay("It has been renewed forty-one times. Nobody voted against.", {
      projectId: "p",
    });
    expect(r.ir.acts.length).toBe(1);
    expect(r.notes.join(" ")).toContain("one act");
  });

  it("every scene names a real span of the essay", () => {
    // The IR's central promise: the essay is the source of truth and scenes
    // bind into it by offset. A scene whose offsets do not contain its own
    // text is a scene that has drifted from the prose.
    for (const s of seg().ir.scenes) {
      expect(ESSAY.slice(s.sourceRange.startChar, s.sourceRange.endChar)).toBe(s.narration.text);
    }
  });

  it("offsets advance, so a repeated sentence binds to its own occurrence", () => {
    const twice = "Nothing changed.\n\nA Heading\n\nNothing changed.";
    const r = segmentEssay(twice, { projectId: "p" });
    const bodies = r.ir.scenes.filter((s) => s.narration.text === "Nothing changed.");
    expect(bodies.length).toBe(2);
    expect(must(bodies[1]).sourceRange.startChar).toBeGreaterThan(
      must(bodies[0]).sourceRange.startChar,
    );
  });

  it("keeps a bullet whole rather than splitting it off its figure", () => {
    const scene = must(seg().ir.scenes.find((s) => s.narration.text.startsWith("Peak occupancy")));
    expect(scene.narration.text).toBe("Peak occupancy: 7,000 people (July 2023)");
    expect((scene.figures ?? []).map((f) => f.text)).toContain("7,000 people");
  });
});

describe("the segmenter extracts, and declines to interpret", () => {
  it("lifts figures verbatim onto the scene", () => {
    const scene = must(seg().ir.scenes.find((s) => s.narration.text.includes("Niagara Falls")));
    expect((scene.figures ?? []).map((f) => f.text)).toContain("$282,345.84");
  });

  it("reads a route the prose drew", () => {
    const scene = must(seg().ir.scenes.find((s) => (s.route ?? []).length > 0));
    expect(scene.route).toEqual([
      "Ottawa",
      "IHAP grants",
      "Provincial governments",
      "Hotel contracts",
    ]);
  });

  it("proposes no readings at all", () => {
    // What a sentence is ABOUT is an interpretation. A segmenter that
    // guessed would override the film's own curve with a guess.
    expect(seg().ir.scenes.every((s) => s.reading === undefined)).toBe(true);
    expect(seg().notes.join(" ")).toContain("no readings proposed");
  });

  it("holds a figure-bearing scene rigid", () => {
    // A viewer reading a number off the screen cannot be hurried by a
    // neighbour's overflow.
    const withFig = must(seg().ir.scenes.find((s) => (s.figures ?? []).length > 0));
    expect(withFig.timing.elasticity).toBe("rigid");
  });

  it("calls a reversal a turn and a figure evidence", () => {
    const scenes = seg().ir.scenes;
    expect(must(scenes[0]).narrativeFunction).toBe("hook");
    expect(must(scenes[scenes.length - 1]).narrativeFunction).toBe("resolve");
    expect(
      must(scenes.find((s) => s.narration.text === "Nothing changed.")).narrativeFunction,
    ).toBe("turn");
    expect(
      must(scenes.find((s) => s.narration.text.startsWith("Total spend"))).narrativeFunction,
    ).toBe("evidence");
  });
});

describe("prose alone compiles", () => {
  it("segments to a valid IR", () => {
    const parsed = parseIR(JSON.parse(JSON.stringify(seg().ir)));
    expect(parsed.ok, parsed.ok ? "" : JSON.stringify(parsed.errors.slice(0, 3))).toBe(true);
  });

  it("plans data treatments with no reading and no model", async () => {
    // The point of separating figures from readings: an institutional essay
    // reaches the data family before anyone has read a single sentence.
    const parsed = parseIR(JSON.parse(JSON.stringify(seg().ir)));
    if (!parsed.ok) throw new Error("invalid");
    const report = await compile(parsed.ir);
    const dataLed = report.composed.filter((c) => c.nodes[0]?.primitiveId === "data_series");
    expect(dataLed.length).toBeGreaterThan(2);
    expect(report.ttsCalls).toBe(0);
    expect(report.composed.every((c) => c.nodes.length > 0)).toBe(true);
  });

  it("a lone year is a date, not a quantity to count up to", async () => {
    // "On September 30, 2025, the government ended its funding" is about an
    // ending. Its only figure is the year, and charting it put arithmetic
    // on a date.
    const parsed = parseIR(JSON.parse(JSON.stringify(seg().ir)));
    if (!parsed.ok) throw new Error("invalid");
    const report = await compile(parsed.ir);
    const scene = must(
      parsed.ir.scenes.find((s) => s.narration.text.startsWith("On September 30")),
    );
    expect((scene.figures ?? []).map((f) => f.kind)).toEqual(["year"]);
    const composed = must(report.composed.find((c) => c.sceneId === scene.sceneId));
    expect(composed.nodes[0]?.primitiveId).not.toBe("data_series");
  });

  it("the route reaches the sankey with its stages intact", async () => {
    const parsed = parseIR(JSON.parse(JSON.stringify(seg().ir)));
    if (!parsed.ok) throw new Error("invalid");
    const report = await compile(parsed.ir);
    const routed = must(
      report.composed.find((c) => c.nodes.some((n) => n.primitiveId === "sankey_flow")),
    );
    const sankey = must(routed.nodes.find((n) => n.primitiveId === "sankey_flow"));
    expect(String(sankey.params.route)).toContain("Ottawa → IHAP grants");
  });

  it("recompiling unchanged prose is a total cache hit", async () => {
    const parsed = parseIR(JSON.parse(JSON.stringify(seg().ir)));
    if (!parsed.ok) throw new Error("invalid");
    const first = await compile(parsed.ir);
    const again = await compile(parsed.ir, { snapshot: first.snapshot });
    expect(again.cache.misses).toBe(0);
    expect(again.cache.hits).toBe(again.cache.total);
  });

  it("editing one sentence recomputes only what depends on it", async () => {
    const parsed = parseIR(JSON.parse(JSON.stringify(seg().ir)));
    if (!parsed.ok) throw new Error("invalid");
    const first = await compile(parsed.ir);

    const edited = segmentEssay(
      ESSAY.replace("The building is the same.", "The building stands."),
      {
        projectId: "proj_test",
      },
    );
    const reparsed = parseIR(JSON.parse(JSON.stringify(edited.ir)));
    if (!reparsed.ok) throw new Error("invalid");
    const after = await compile(reparsed.ir, { snapshot: first.snapshot });
    expect(after.cache.scenesTouched).toBeGreaterThan(0);
    expect(after.cache.scenesTouched).toBeLessThan(after.composed.length);
  });
});
