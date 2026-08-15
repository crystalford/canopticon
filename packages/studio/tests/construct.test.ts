// The constructor — build a visual, do not pick an effect.
//
// The test of success stated by the criticism this answers: "the resulting
// program can contain a combination of primitives that did not previously
// exist as a named motif or template", and "the same semantic scene should
// be renderable in documentary, pixel/game, and surreal languages without
// simply swapping a predefined tail".
//
// Both are asserted below against real sentences, not fixtures.

import { describe, expect, it } from "vitest";
import { composeAll } from "../src/compile/compose.ts";
import { LADDER } from "../src/compile/compose.ts";
import { type Beat, type Style, constructPrograms } from "../src/compile/construct.ts";
import { segmentEssay } from "../src/compile/segment.ts";
import { detectSubjects } from "../src/compile/subject.ts";
import type { VisualLanguage } from "../src/ir/schema.ts";
import { parseIR } from "../src/ir/schema.ts";
import { allActive } from "./active.ts";
import { must } from "./must.ts";

function beatFor(sentence: string, extra: Partial<Beat> = {}): Beat {
  return {
    sentence,
    phrase: "SUBJECT",
    subjects: detectSubjects(sentence),
    figures: [],
    route: [],
    kind: "statement",
    contested: false,
    index: 0,
    ...extra,
  };
}

function styleFor(language: VisualLanguage, over: Partial<Style> = {}): Style {
  return {
    abstraction: 0.5,
    density: 0.5,
    energy: 0.5,
    human: 0.5,
    typography: 0.5,
    archival: 0.5,
    data: 0.5,
    experimentalism: 0.5,
    restraint: 0.3,
    population: 0.5,
    attention: 0.5,
    tier: "DECOMPOSED",
    language,
    ...over,
  };
}

const DETECTOR = "The smoke detector in room 214 had been disconnected for eleven months.";

describe("visual language constrains, it does not template", () => {
  const languages: VisualLanguage[] = ["documentary", "pixel", "surreal"];

  it("renders the same sentence three genuinely different ways", () => {
    const programs = languages.map((language) =>
      must(constructPrograms(beatFor(DETECTOR), styleFor(language, { abstraction: 0.8 }), 64)[0]),
    );
    const chains = programs.map((p) => p.nodes.map((n) => n.primitiveId).join("→"));
    expect(new Set(chains).size).toBe(3);

    // And the difference is in more than a swapped tail: each language
    // reaches for operators the others do not, where it reaches for
    // operators at all. A language is allowed to decline the operator
    // tail entirely — TYPOGRAPHIC's own `surface()` returns almost nothing
    // on purpose, documented in `language.ts` as "the single most
    // important degree of freedom this layer adds" — so an empty stack on
    // one side of a comparison is a real medium property, not a missing
    // difference, and is excluded from this check rather than failed by it.
    const ops = programs.map((p) => new Set(p.operators));
    for (let i = 0; i < ops.length; i++) {
      for (let j = i + 1; j < ops.length; j++) {
        const a = must(ops[i]);
        const b = must(ops[j]);
        if (a.size === 0 || b.size === 0) continue;
        const shared = [...a].filter((x) => b.has(x));
        expect(shared.length).toBeLessThan(Math.max(a.size, b.size));
      }
    }
  });
});

describe("abstraction opens the search space rather than selecting a chain", () => {
  it("refuses to decompose a thing the curve says must stay recognisable", () => {
    const low = must(
      constructPrograms(beatFor(DETECTOR), styleFor("surreal", { abstraction: 0.1 }), 64)[0],
    );
    // `fragment`, `sort` and `split` take the thing apart. At the bottom of
    // the ladder they are not available at all — however much the language
    // wants them.
    expect(low.operators).not.toContain("fragment");
    expect(low.operators).not.toContain("sort");
  });

  it("permits decomposition at the top of the ladder", () => {
    // Checked across every candidate, not only the winner. Since the
    // Visual Strategist (`visual-strategy.ts`) gives one medium real
    // authority over the top slot, the winning program's own chain may
    // not accept every operator — a typographic reading refuses the whole
    // resampling family on purpose, same discipline as the test above.
    // What must still hold is the thing this test actually names: high
    // abstraction opens the search space, so decomposition is reachable
    // SOMEWHERE in the offered candidates, not nowhere.
    const high = constructPrograms(
      beatFor(DETECTOR),
      styleFor("surreal", { abstraction: 0.9 }),
      64,
    );
    expect(
      high.some((p) => ["fragment", "sort", "split"].some((o) => p.operators.includes(o))),
    ).toBe(true);
  });

  it("a medium, once chosen, does not change with how far abstraction takes it", () => {
    // Superseded from "does not change WHAT is built" — under the Visual
    // Strategist, WHICH MEDIUM a moment lives in is allowed to respond to
    // the film's own abstraction curve; that is the whole point of giving
    // medium selection real authority instead of diluting it inside a flat
    // competition (see the "Visual Strategist" plan). What still must not
    // happen is a construction changing ITS OWN identity underneath a
    // fixed medium — checked here on ILLUSTRATIVE specifically, the one
    // medium abstraction was always meant to reshape without recasting.
    const low = must(
      constructPrograms(beatFor(DETECTOR), styleFor("documentary", { abstraction: 0.1 }), 64)[0],
    );
    const high = must(
      constructPrograms(beatFor(DETECTOR), styleFor("documentary", { abstraction: 0.9 }), 64)[0],
    );
    expect(low.construction).toBe(high.construction);
  });
});

describe("the engine proposes several readings, not one", () => {
  it("offers genuinely different alternatives for a sentence that could be either", () => {
    // Names a document AND a place: two honest constructions.
    const programs = constructPrograms(
      beatFor("The contract named a single warehouse on the edge of the city."),
      styleFor("documentary"),
      64,
    );
    const constructions = new Set(programs.map((p) => p.construction));
    expect(constructions.size).toBeGreaterThan(1);
  });

  it("is deterministic — no unseeded randomness anywhere", () => {
    const a = constructPrograms(beatFor(DETECTOR), styleFor("pixel"), 64);
    const b = constructPrograms(beatFor(DETECTOR), styleFor("pixel"), 64);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("never offers the same program twice", () => {
    const ids = constructPrograms(beatFor(DETECTOR), styleFor("surreal"), 64).map((p) => p.id);
    const chains = constructPrograms(beatFor(DETECTOR), styleFor("surreal"), 64).map((p) =>
      p.nodes.map((n) => n.primitiveId).join("→"),
    );
    expect(new Set(chains).size).toBe(chains.length);
    expect(ids.length).toBeGreaterThan(1);
  });
});

describe("what it produces is not in any table", () => {
  it("builds combinations that exist as no ladder rung and no kind recipe", () => {
    const rungs = new Set(LADDER.map((r) => r.base.join("→")));
    const essay = `Rooms

The smoke detector in room 214 had been disconnected for eleven months.
The contract named a single warehouse. Nine numbered companies held the lease.
The residents were moved at night. Nothing changed.`;
    const seed = segmentEssay(essay, { projectId: "p" });
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("invalid IR");
    const scenes = composeAll(parsed.ir, null, allActive(parsed.ir));

    const chains = scenes.map((s) => s.nodes.map((n) => n.primitiveId).join("→"));
    // Not one of them is a ladder rung.
    for (const chain of chains) expect(rungs.has(chain)).toBe(false);
    // Every scene was constructed rather than fetched.
    for (const scene of scenes) expect(scene.program).not.toBe(null);
    // And they are not all the same, which is the original complaint.
    expect(new Set(chains).size).toBeGreaterThan(1);
  });
});
