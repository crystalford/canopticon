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
import {
  type DirectorIntent,
  bendStyle,
  describeIntent,
  readIntent,
} from "../src/compile/intent.ts";
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

describe("director verbs", () => {
  it("bends the scene's state rather than pinning its chain", async () => {
    const { VERBS, applyVerb, verbById } = await import("../src/compile/verbs.ts");
    expect(VERBS.length).toBeGreaterThan(4);
    const stranger = must(verbById("stranger"));
    const once = applyVerb(undefined, stranger);
    expect(must(once).abstraction).toBeGreaterThan(0);
  });

  it("compounds when pressed twice, and walks back when reversed", async () => {
    const { applyVerb, verbById } = await import("../src/compile/verbs.ts");
    const stranger = must(verbById("stranger"));
    const ground = must(verbById("ground"));
    const once = applyVerb(undefined, stranger);
    const twice = applyVerb(once, stranger);
    expect(Number(twice.abstraction)).toBeGreaterThan(Number(once.abstraction));
    const back = applyVerb(twice, ground);
    expect(Number(back.abstraction)).toBeLessThan(Number(twice.abstraction));
  });

  it("cannot be pressed into a state the resolver cannot use", async () => {
    const { applyVerb, verbById } = await import("../src/compile/verbs.ts");
    const stranger = must(verbById("stranger"));
    let nudge = {};
    for (let i = 0; i < 20; i++) nudge = applyVerb(nudge, stranger);
    for (const v of Object.values(nudge)) expect(Math.abs(Number(v))).toBeLessThanOrEqual(0.6);
  });

  it("changes what the engine builds without freezing it", async () => {
    const { composeAll } = await import("../src/compile/compose.ts");
    const seed = segmentEssay("Rooms\n\nThe smoke detector in room 214 had been disconnected.", {
      projectId: "p",
    });
    const base = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!base.ok) throw new Error("invalid");
    const before = must(composeAll(base.ir)[0]);

    const directed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!directed.ok) throw new Error("invalid");
    directed.ir.overrides.push({
      sceneId: must(directed.ir.scenes[0]).sceneId,
      type: "constrain",
      styleNudge: { abstraction: 0.4, experimentalism: 0.3, restraint: -0.2 },
    });
    const after = must(composeAll(directed.ir)[0]);

    // The engine still composed it — it is not pinned.
    expect(after.override?.type).not.toBe("pin");
    expect(after.program).not.toBe(null);
    // And the direction reached the picture.
    expect(after.nodes.map((n) => n.primitiveId).join("→")).not.toBe(
      before.nodes.map((n) => n.primitiveId).join("→"),
    );
  });
});

describe("a look you can ask for again", () => {
  // "that's sorta the style I was envisioning... but it sorta happened
  // randomly." It did not happen randomly. Nothing captured it.
  it("captures what a film actually did, not what it might do", async () => {
    const { captureGrammar, describeGrammar } = await import("../src/compile/grammar.ts");
    const seed = segmentEssay(
      "Rooms\n\nThe smoke detector in room 214 had been disconnected.\nThe contract named a warehouse.\nNothing changed.",
      { projectId: "p" },
    );
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("invalid");
    const scenes = composeAll(parsed.ir);

    const grammar = captureGrammar("the glitch one", scenes, "p");
    expect(grammar.name).toBe("the glitch one");
    // Operators the film reached for score above the ones it did not.
    const used = new Set(scenes.flatMap((s) => s.program?.operators ?? []));
    for (const id of used) expect(must(grammar.ops)[id]).toBeGreaterThan(-0.25);
    // And it reads as a sentence, not a table of floats.
    expect(describeGrammar(grammar)).toMatch(/reaches for|avoids/);
  });

  it("changes what a DIFFERENT essay builds, without naming a primitive", async () => {
    const { captureGrammar } = await import("../src/compile/grammar.ts");
    const source = segmentEssay("A\n\nThe detector was removed at night.", { projectId: "a" });
    const src = parseIR(JSON.parse(JSON.stringify(source.ir)));
    if (!src.ok) throw new Error("invalid");
    const grammar = captureGrammar("captured", composeAll(src.ir), "a");
    // Force a strong, unambiguous preference so the effect is legible.
    grammar.ops.fragment = 0.6;
    grammar.ops.grade = -0.5;

    const other = segmentEssay("B\n\nThe warehouse stood behind the fence.", { projectId: "b" });
    const plain = parseIR(JSON.parse(JSON.stringify(other.ir)));
    const styled = parseIR(JSON.parse(JSON.stringify(other.ir)));
    if (!plain.ok || !styled.ok) throw new Error("invalid");
    styled.ir.grammar = grammar;

    const before = composeAll(plain.ir).map((s) => (s.program?.operators ?? []).join("+"));
    const after = composeAll(styled.ir).map((s) => (s.program?.operators ?? []).join("+"));
    expect(after.join("|")).not.toBe(before.join("|"));
    // A grammar names appetites, never a primitive.
    expect(Object.keys(grammar.ops).some((k) => k.includes("_"))).toBe(false);
  });
});

describe("the sentence test — does direction change the IDEA, or only the effect", () => {
  // The challenge, verbatim: "Take the sentence 'They walked around the
  // cities like insects.' Generate five candidates. Do not use the same
  // underlying construction or simply vary parameters... Then change
  // DirectorIntent from 'make this feel inevitable' to 'make this feel
  // absurd' and demonstrate that the candidate space changes, rather than
  // merely changing colour, speed, or an effect parameter."
  //
  // Run before any of this existed, the compiler answered with four
  // programs across two constructions whose top two were the same
  // construction differing by one operator. The cause was a type
  // signature — `fit(beat: Beat)` took no Style, so the director's state
  // could not influence WHAT was built, only what was done to it. These
  // tests exist so that can never quietly come back.
  const SENTENCE = "They walked around the cities like insects.";

  function candidates(intent?: DirectorIntent) {
    const beat: Beat = {
      sentence: SENTENCE,
      phrase: "CITIES LIKE INSECTS",
      subjects: detectSubjects(SENTENCE),
      figures: [],
      route: [],
      kind: "statement",
      contested: false,
      index: 7,
      intent: readIntent(intent),
    };
    const style: Style = {
      abstraction: 0.5,
      density: 0.5,
      energy: 0.6,
      human: 0.7,
      typography: 0.4,
      archival: 0.3,
      data: 0.2,
      experimentalism: 0.5,
      restraint: 0.4,
      tier: "DECOMPOSED",
      language: "documentary",
    };
    return constructPrograms(beat, style, 40);
  }

  it("offers five candidates that BUILD DIFFERENT THINGS", () => {
    const top = candidates().slice(0, 5);
    expect(top.length).toBe(5);
    // Five distinct constructions — not one construction wearing five
    // operator stacks, which is the failure this replaced.
    expect(new Set(top.map((p) => p.construction)).size).toBe(5);
  });

  it("sees the city, which it could not before", () => {
    // The lexicon had been grown entirely from one institutional housing
    // essay, so it knew "corridor" and not "city" — which made the space
    // construction UNREACHABLE for this sentence rather than merely
    // outranked. A missing noun is a worse failure than a losing one.
    const found = detectSubjects(SENTENCE).map((s) => s.text.toLowerCase());
    expect(found).toContain("cities");
    expect(found).toContain("insects");
  });

  it("keeps the literal reading when the direction is INEVITABLE", () => {
    const best = must(candidates({ feel: "Make this feel inevitable." })[0]);
    // Inevitability is a property of watching the thing itself continue.
    expect(best.construction).toBe("body");
    expect(best.dislocated).toBeFalsy();
  });

  it("builds it as something it is NOT when the direction is ABSURD", () => {
    const best = must(candidates({ feel: "Make this feel absurd." })[0]);
    expect(best.dislocated).toBe(true);
    expect(best.construction).not.toBe("body");
  });

  it("changes the candidate SPACE, not one effect parameter", () => {
    const inevitable = candidates({ feel: "Make this feel inevitable." }).slice(0, 5);
    const absurd = candidates({ feel: "Make this feel absurd." }).slice(0, 5);
    // The ORDER of interpretations differs — this is the whole claim.
    expect(absurd.map((p) => p.construction)).not.toEqual(inevitable.map((p) => p.construction));
    // And it is not merely that the same programs were re-sorted by a
    // recoloured tail: the winning construction is a different one.
    expect(must(absurd[0]).construction).not.toBe(must(inevitable[0]).construction);
  });

  it("never invents an axis to satisfy a mood", () => {
    // The figure firewall, applied to direction. A chart drawn from a
    // sentence that printed no numbers is a picture of a chart, and no
    // directorial appetite may reach one.
    for (const intent of [
      { feel: "Make this feel absurd." },
      { feel: "Make it overwhelming and vast and strange." },
    ]) {
      for (const p of candidates(intent)) {
        expect(p.construction).not.toBe("quantity");
      }
    }
  });

  it("reports what it HEARD, so a misread direction is visible", () => {
    const reading = readIntent({ feel: "Make this feel absurd and overwhelming." });
    expect(reading.registers).toContain("absurd");
    expect(reading.registers).toContain("overwhelm");
    expect(reading.matched).toContain("absurd");
    expect(describeIntent(reading)).toMatch(/absurd/);
    // A direction it cannot read says so rather than pretending.
    expect(describeIntent(readIntent({ feel: "make it good" }))).toMatch(/nothing read/);
  });

  it("leaves an undirected film exactly as it was", () => {
    // Standing rule 3 in its quietest form: a feature the director did not
    // ask for must not move their film.
    const none = candidates().map((p) => p.id);
    const empty = candidates({}).map((p) => p.id);
    expect(empty).toEqual(none);
  });
});

describe("the second sentence test — same construction, different execution", () => {
  // The follow-up challenge: "hold the construction constant and test
  // whether the system can generate substantially different cinematic
  // executions... The resulting videos should not merely differ in colour,
  // speed, or post processing."
  //
  // Run before `bendStyle` existed, a body built under five different
  // directions came out with IDENTICAL segments, gait, wander, scale,
  // speed, stride and wave. Only the operator tail changed — which is
  // precisely the "different colour and post-processing" failure, with the
  // argument moved one layer down from the one it had just been fixed at.
  //
  // The cause was the same shape as the first: `build(beat, style)` takes
  // a Style, and a register could only reach two of that Style's nine
  // dials. A direction now bends the whole creative state, and every
  // construction already reads it.
  const SENTENCE = "They walked around the cities like insects.";
  const DIRECTIONS = [
    "clinical and precise, matter of fact",
    "make this feel absurd",
    "sinister, ominous, increasing dread",
    "relentless, steadily accumulating, inevitable",
    "overwhelming, drowning, too much",
  ];

  function bodyUnder(feel: string) {
    const beat: Beat = {
      sentence: SENTENCE,
      phrase: "CITIES LIKE INSECTS",
      subjects: detectSubjects(SENTENCE),
      figures: [],
      route: [],
      kind: "statement",
      contested: false,
      index: 7,
      intent: readIntent({ feel }),
    };
    const style: Style = {
      abstraction: 0.5,
      density: 0.5,
      energy: 0.6,
      human: 0.7,
      typography: 0.4,
      archival: 0.3,
      data: 0.2,
      experimentalism: 0.5,
      restraint: 0.4,
      tier: "DECOMPOSED",
      language: "documentary",
    };
    return constructPrograms(beat, style, 40).find((p) => p.construction === "body");
  }

  it("moves the CONSTRUCTION'S OWN NUMBERS, not just the operators", () => {
    const built = DIRECTIONS.map((d) => must(bodyUnder(d)).nodes[0]?.params ?? {});
    // Every parameter derived from the film's curves must differ across
    // directions. Named individually rather than counted, so a regression
    // says which one went flat.
    for (const key of ["segments", "scale", "speed", "gait", "wander", "wave", "stride"]) {
      const values = new Set(built.map((p) => String(p[key])));
      expect(values.size).toBeGreaterThan(1);
    }
  });

  it("leaves the numbers the PROSE decided alone", () => {
    // The other half, and the one a "make everything respond to mood"
    // change would quietly break. `count` is how many things the sentence
    // said there were and `legPairs` is what kind of thing it named —
    // neither is a matter of taste, and a direction that could move them
    // would be editing the essay rather than directing it.
    const built = DIRECTIONS.map((d) => must(bodyUnder(d)).nodes[0]?.params ?? {});
    expect(new Set(built.map((p) => String(p.count))).size).toBe(1);
    expect(new Set(built.map((p) => String(p.legPairs))).size).toBe(1);
  });

  it("bends the film's curves rather than setting them", () => {
    // A bias, not a value — so the same words over a restrained film and
    // an experimental one land in different places, which is what a
    // director means by "make it stranger".
    const reading = readIntent({ feel: "make it stranger" });
    const calm = bendStyle({ abstraction: 0.2 }, reading).abstraction;
    const wild = bendStyle({ abstraction: 0.7 }, reading).abstraction;
    expect(calm).toBeGreaterThan(0.2);
    expect(wild).toBeGreaterThan(calm);
    // And it can never leave the dial's own range.
    expect(bendStyle({ abstraction: 0.98 }, reading).abstraction).toBeLessThanOrEqual(1);
  });
});

describe("the third sentence test — prose with nothing to point a camera at", () => {
  // "The current test uses a very conveniently visual sentence. Try: 'The
  //  policy was designed to make people feel as though they were being
  //  watched.' Now there isn't an obvious object like 'centipede.' What
  //  does the system do?"
  //
  // Honestly: it builds bodies, because the sentence does name people, and
  // then the direction decides the rest. What it did NOT do before this
  // test was admit which of those two had made the decision. A sentence
  // the compiler could not read got an answer indistinguishable from one
  // it had read closely — and `namesOnlyAbstractions` had existed the
  // whole time, exported and documented for exactly this, and was called
  // by nothing.
  //
  // This is deliberately not a claim to understand metaphor, causality or
  // narrative function. It is the smaller, checkable claim: when the prose
  // did not choose the picture, the report says so.
  function notesFor(sentence: string) {
    const seed = segmentEssay(`A\n\n${sentence}`, { projectId: "p" });
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("invalid IR");
    return must(composeAll(parsed.ir)[0]).notes.join(" · ");
  }

  it("says so when the sentence names nothing depictable", () => {
    expect(notesFor("Nobody noticed what was happening until it was too late.")).toMatch(
      /not from the sentence/,
    );
  });

  it("stays quiet when the sentence DID choose the picture", () => {
    expect(notesFor("The smoke detector had been disconnected for eleven months.")).not.toMatch(
      /not from the sentence/,
    );
  });

  it("knows the ordinary word for people, not only institutional roles", () => {
    // The lexicon knew "claimant" and "tenant" because it was grown from
    // one institutional essay, and had never needed "people".
    const found = detectSubjects(
      "The policy was designed to make people feel as though they were being watched.",
    );
    expect(found.map((s) => s.text)).toContain("people");
    // And it is weighted BELOW a named role, because "people" says nothing
    // about which people.
    const role = must(detectSubjects("The inspectors arrived on Tuesday.")[0]);
    expect(must(found[0]).weight).toBeLessThan(role.weight);
  });

  it("still compiles it — degrade, flag, continue", () => {
    const seed = segmentEssay("A\n\nNobody noticed what was happening until it was too late.", {
      projectId: "p",
    });
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("invalid IR");
    const scene = must(composeAll(parsed.ir)[0]);
    expect(scene.nodes.length).toBeGreaterThan(0);
  });
});
