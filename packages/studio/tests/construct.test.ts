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
import {
  type Beat,
  CONSTRUCTION_IDS,
  OPERATOR_IDS,
  type Style,
  constructPrograms,
} from "../src/compile/construct.ts";
import { segmentEssay } from "../src/compile/segment.ts";
import { detectSubjects } from "../src/compile/subject.ts";
import type { VisualLanguage } from "../src/ir/schema.ts";
import { parseIR } from "../src/ir/schema.ts";
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
    tier: "DECOMPOSED",
    language,
    ...over,
  };
}

const DETECTOR = "The smoke detector in room 214 had been disconnected for eleven months.";

describe("a construction is parameterised from the prose, not looked up", () => {
  it("builds the fixture the sentence named, with that fixture's own numbers", () => {
    const program = must(constructPrograms(beatFor(DETECTOR), styleFor("documentary"), 64)[0]);
    const fixture = must(program.nodes.find((n) => n.primitiveId === "mounted_fixture"));
    // A ceiling sensor vents and blinks. A camera housing domes and does
    // not. Both are `mounted_fixture`; they are different constructions.
    expect(Number(fixture.params.led)).toBe(1);
    expect(Number(fixture.params.vents)).toBeGreaterThan(8);
  });

  it("builds a camera housing differently from a detector, from the same primitive", () => {
    const detector = must(constructPrograms(beatFor(DETECTOR), styleFor("documentary"), 64)[0]);
    const camera = must(
      constructPrograms(
        beatFor("The security camera above the door had been repositioned."),
        styleFor("documentary"),
        64,
      )[0],
    );
    const a = must(detector.nodes.find((n) => n.primitiveId === "mounted_fixture")).params;
    const b = must(camera.nodes.find((n) => n.primitiveId === "mounted_fixture")).params;
    expect(a.dome).not.toBe(b.dome);
    expect(a.led).not.toBe(b.led);
  });

  it("reads a count out of the prose and builds that many things", () => {
    // "The centipede is not a primitive, it is a set of numbers."
    const few = must(
      constructPrograms(
        beatFor("The centipede moved through nine numbered rooms."),
        styleFor("documentary"),
        64,
      )[0],
    );
    const crowd = must(
      constructPrograms(
        beatFor("The crowd of residents waited in the corridor."),
        styleFor("documentary"),
        64,
      )[0],
    );
    const one = must(few.nodes.find((n) => n.primitiveId === "creature_chain")).params;
    const many = must(crowd.nodes.find((n) => n.primitiveId === "creature_chain")).params;
    // A crowd is many small bodies; a named creature is one large one.
    expect(Number(many.count)).toBeGreaterThan(Number(one.count));
    expect(Number(many.scale)).toBeLessThan(Number(one.scale));
  });
});

describe("visual language constrains, it does not template", () => {
  const languages: VisualLanguage[] = ["documentary", "pixel", "surreal"];

  it("renders the same sentence three genuinely different ways", () => {
    const programs = languages.map((language) =>
      must(constructPrograms(beatFor(DETECTOR), styleFor(language, { abstraction: 0.8 }), 64)[0]),
    );
    const chains = programs.map((p) => p.nodes.map((n) => n.primitiveId).join("→"));
    expect(new Set(chains).size).toBe(3);

    // And the difference is in the OPERATIONS, not in a swapped tail: each
    // language reaches for operators the others do not.
    const ops = programs.map((p) => new Set(p.operators));
    for (let i = 0; i < ops.length; i++) {
      for (let j = i + 1; j < ops.length; j++) {
        const a = must(ops[i]);
        const b = must(ops[j]);
        const shared = [...a].filter((x) => b.has(x));
        expect(shared.length).toBeLessThan(Math.max(a.size, b.size));
      }
    }
  });

  it("builds the SAME THING in all three — identity is invariant, depiction is not", () => {
    const programs = languages.map((language) =>
      must(constructPrograms(beatFor(DETECTOR), styleFor(language), 64)[0]),
    );
    for (const p of programs) expect(p.construction).toBe("fixture");
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
    const high = must(
      constructPrograms(beatFor(DETECTOR), styleFor("surreal", { abstraction: 0.9 }), 64)[0],
    );
    expect(["fragment", "sort", "split"].some((o) => high.operators.includes(o))).toBe(true);
  });

  it("does not change WHAT is built, only how far it may be taken", () => {
    const low = must(
      constructPrograms(beatFor(DETECTOR), styleFor("pixel", { abstraction: 0.1 }), 64)[0],
    );
    const high = must(
      constructPrograms(beatFor(DETECTOR), styleFor("pixel", { abstraction: 0.9 }), 64)[0],
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
    const scenes = composeAll(parsed.ir);

    const chains = scenes.map((s) => s.nodes.map((n) => n.primitiveId).join("→"));
    // Not one of them is a ladder rung.
    for (const chain of chains) expect(rungs.has(chain)).toBe(false);
    // Every scene was constructed rather than fetched.
    for (const scene of scenes) expect(scene.program).not.toBe(null);
    // And they are not all the same, which is the original complaint.
    expect(new Set(chains).size).toBeGreaterThan(1);
  });

  it("names its own vocabulary, so the Lab can list constructions rather than primitives", () => {
    expect(CONSTRUCTION_IDS).toContain("fixture");
    expect(CONSTRUCTION_IDS).toContain("body");
    expect(OPERATOR_IDS).toContain("fragment");
    expect(OPERATOR_IDS.length).toBeGreaterThan(8);
  });
});

describe("the paragraph the architecture is judged on", () => {
  // "If the result is particle field → particle field → particle field, the
  //  architecture is still wrong."
  const PARAGRAPH = `The City

They walked around the city like insects. At first nobody noticed. Then there were dozens of them, moving through the streets in strange synchronized waves.`;

  function sequence() {
    const seed = segmentEssay(PARAGRAPH, { projectId: "p" });
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("invalid IR");
    return composeAll(parsed.ir);
  }

  it("builds bodies for the sentence that names insects", () => {
    const first = must(sequence()[0]);
    expect(first.nodes.some((n) => n.primitiveId === "creature_chain")).toBe(true);
  });

  it("carries the creature across a sentence made of pronouns", () => {
    // "dozens of THEM" names nothing depictable and is entirely about the
    // insects two sentences earlier. Without the film's short-term memory
    // this fell back to setting type — every sentence inventing its own
    // world, which is the "isolated shots" failure.
    const last = must(sequence()[2]);
    expect(last.program?.construction).toBe("body");
  });

  it("ESCALATES rather than repeating — more of them, and in step", () => {
    const scenes = sequence();
    const first = must(
      must(scenes[0]).nodes.find((n) => n.primitiveId === "creature_chain"),
    ).params;
    const last = must(must(scenes[2]).nodes.find((n) => n.primitiveId === "creature_chain")).params;
    // "dozens of them" is more of them.
    expect(Number(last.count)).toBeGreaterThan(Number(first.count));
    // "strange synchronized waves" is the same bodies with the wander
    // taken out of them — the parameter that expresses synchronised is the
    // ABSENCE of wandering, not the presence of an effect.
    expect(Number(last.wander)).toBeLessThan(Number(first.wander));
  });

  it("is not three of the same shot", () => {
    const chains = sequence().map((s) => s.nodes.map((n) => n.primitiveId).join("→"));
    expect(new Set(chains).size).toBe(3);
  });
});
