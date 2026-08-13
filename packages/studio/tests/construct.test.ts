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
import { hashSceneNodes } from "../src/compile/hash.ts";
import {
  type DirectorIntent,
  bendStyle,
  describeIntent,
  readIntent,
} from "../src/compile/intent.ts";
import { isComposite, planScene } from "../src/compile/scene-plan.ts";
import { segmentEssay } from "../src/compile/segment.ts";
import { buildStack } from "../src/compile/stack.ts";
import { detectSubjects } from "../src/compile/subject.ts";
import type { VisualLanguage } from "../src/ir/schema.ts";
import { parseIR } from "../src/ir/schema.ts";
import { PRIMITIVES } from "../src/primitives/registry.ts";
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
      population: 0.5,
      attention: 0.5,
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
      population: 0.5,
      attention: 0.5,
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

describe("the parameters the compiler sets are the parameters the primitive has", () => {
  // The check that found the largest bug in this system, and it fits in
  // twenty lines.
  //
  // Chasing why "the city watched its residents" and "the city appeared to
  // watch its residents" compiled byte-identically, the answer turned out
  // to be that the space construction set `depth` and `haze` on
  // `plate_scene`, which has neither — its knobs are `scene`, `cars`,
  // `dusk` and `life`. Every space in every film had therefore rendered
  // with the same eleven cars at the same dusk regardless of the film's
  // state.
  //
  // Auditing the rest found the same defect in eight more places:
  // `scanline` was given a `strength` it has never had, `halftone` a
  // `dot`, `threshold` a `cut`, `color_transform` a `warmth` and a `lift`,
  // `text_layout` a `weight`, `particle_trail` a `fade`, `ease_profile` a
  // `depth`, and every two-primitive operator handed both primitives one
  // bag of parameters meant for one of them.
  //
  // So most operators had been running at their DEFAULTS. That is very
  // likely the whole of the original complaint — "it uses the same filter
  // palettes" — and it was invisible because a canvas primitive reading
  // `p.dot` when nothing set `dot` does not throw. It draws its default
  // and looks like a decision.
  const STATE_BAG = new Set(["density", "energy", "abstraction", "human"]);

  it("holds across a film that reaches every construction", () => {
    const essay = `Rooms

The smoke detector in room 214 had been disconnected for eleven months.
The city watched its residents. They walked around the city like insects.
The contract named a single warehouse worth $282,345.84. Nine numbered companies held the lease.
Ottawa sent money to provincial governments, which paid hotel operators.
The residents were moved at night. The minister said the programme was working.`;
    const seed = segmentEssay(essay, { projectId: "p" });
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("invalid IR");

    const wrong: string[] = [];
    for (const scene of composeAll(parsed.ir)) {
      for (const node of scene.nodes) {
        const spec = PRIMITIVES[node.primitiveId];
        if (!spec) continue;
        for (const key of Object.keys(node.params)) {
          // The resolved creative state is deliberately passed to every
          // node as a bag the renderer may read generically. It does not
          // claim to be a parameter of anything.
          if (STATE_BAG.has(key)) continue;
          if (!(key in spec.parameters)) wrong.push(`${node.primitiveId}.${key}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("holds for every operator, on every primitive it is made of", () => {
    // Directly rather than through a film, so an operator that no essay
    // happens to reach is still checked.
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
      population: 0.5,
      attention: 0.5,
      tier: "DECOMPOSED",
      language: "documentary",
    };
    const beat: Beat = {
      sentence: "The detector was removed at night.",
      phrase: "THE DETECTOR",
      subjects: detectSubjects("The detector was removed at night."),
      figures: [],
      route: [],
      kind: "statement",
      contested: false,
      index: 0,
    };
    const wrong: string[] = [];
    for (const program of constructPrograms(beat, style, 40)) {
      for (const node of program.nodes) {
        const spec = PRIMITIVES[node.primitiveId];
        if (!spec) continue;
        for (const key of Object.keys(node.params)) {
          if (!(key in spec.parameters)) wrong.push(`${program.id} → ${node.primitiveId}.${key}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe("semantic accounting — does the program account for what the sentence says", () => {
  // The charge: "it has extracted 'insects' and produced insect-like
  // geometry, but discarded almost everything else — city, people,
  // walking, streets, dozens, temporal escalation, synchronization."
  //
  // Measured rather than accepted, and the measurement corrects the
  // charge in a specific and useful way. The compiler accounts for FIVE
  // of eight facts, and the ones it gets are not noun associations —
  // they are numbers read off the prose and escalated across scenes:
  // count 1 → 12, wander 0.30 → 0.16 (synchronised means LESS wander),
  // scale 0.53 → 0.22, speed 0.45 → 0.65. That is the paragraph's own
  // arc, in parameters.
  //
  // What it genuinely misses is not semantic. "city" and "streets" ARE
  // detected — they lose. A scene builds ONE construction, so the setting
  // always loses to the subject, and the temporal turn ("at first nobody
  // noticed") has no cross-scene mechanism to express.
  //
  // So this is the compositing-planes gap named in the palette map, not a
  // reading failure: the sentence is understood, and the renderer has no
  // way to hold an environment AND its agents at once.
  const PARA = `The City

They walked around the city like insects. At first nobody noticed. Then there were dozens of them, moving through the streets in strange synchronized waves.`;

  function compiled() {
    const seed = segmentEssay(PARA, { projectId: "p" });
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("invalid IR");
    return composeAll(parsed.ir);
  }

  it("reads the population off the prose and escalates it", () => {
    const scenes = compiled();
    const first = must(must(scenes[0]).nodes.find((n) => n.primitiveId === "creature_chain"));
    const last = must(must(scenes[2]).nodes.find((n) => n.primitiveId === "creature_chain"));
    expect(Number(last.params.count)).toBeGreaterThan(Number(first.params.count));
    // Smaller, faster, more of them — a crowd rather than a specimen.
    expect(Number(last.params.scale)).toBeLessThan(Number(first.params.scale));
    expect(Number(last.params.speed)).toBeGreaterThan(Number(first.params.speed));
  });

  it("expresses SYNCHRONIZED as the absence of wander, not as an effect", () => {
    const scenes = compiled();
    const first = must(must(scenes[0]).nodes.find((n) => n.primitiveId === "creature_chain"));
    const last = must(must(scenes[2]).nodes.find((n) => n.primitiveId === "creature_chain"));
    expect(Number(last.params.wander)).toBeLessThan(Number(first.params.wander));
  });

  it("DETECTS the setting it cannot yet build — the gap is the renderer, not the reading", () => {
    // This is the test that names the real defect. Both nouns are read;
    // neither reaches the picture, because a scene is one construction.
    // When compositing planes land, this test should be inverted — the
    // setting should appear ALONGSIDE the agents, not instead of them.
    const scene0 = detectSubjects("They walked around the city like insects.");
    const scene2 = detectSubjects(
      "Then there were dozens of them, moving through the streets in strange synchronized waves.",
    );
    expect(scene0.map((s) => s.text)).toContain("city");
    expect(scene2.map((s) => s.text)).toContain("streets");

    // INVERTED. This assertion used to read `.not.toContain` — the whole
    // point of the measurement was that both nouns were read and neither
    // reached the picture. The setting now paints, as the ground under its
    // own subject, which is what a setting is.
    const withGrounds = compiled().flatMap((s) =>
      s.nodes.flatMap((n) => [n.primitiveId, ...(n.ground ?? []).map((g) => g.primitiveId)]),
    );
    expect(withGrounds).toContain("plate_scene");
    // And the agents are still there — alongside, not instead of.
    expect(withGrounds).toContain("creature_chain");
  });
});

describe("the scene plan — a shot is several things at once", () => {
  // The fix for the 5/8 result. City and streets were never misread; they
  // were outranked, because a scene built exactly one construction and a
  // setting always loses to a subject. A plane is a semantic ROLE, so the
  // setting can sit behind the subject instead of losing to it.
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
    population: 0.5,
    attention: 0.5,
    tier: "DECOMPOSED",
    language: "documentary",
  };
  function beatFor(sentence: string, subjects = detectSubjects(sentence)): Beat {
    return {
      sentence,
      phrase: "CITIES LIKE INSECTS",
      subjects,
      figures: [],
      route: [],
      kind: "statement",
      contested: false,
      index: 0,
    };
  }

  it("holds the city AND the insects — the thing that was impossible", () => {
    const plan = planScene(beatFor("They walked around the city like insects."), style);
    expect(isComposite(plan)).toBe(true);
    const roles = plan.planes.map((p) => p.role);
    expect(roles).toContain("SETTING");
    expect(roles).toContain("SUBJECT");
    // Both are checkable against the prose, like a figure.
    const from = plan.planes.map((p) => p.from);
    expect(from).toContain("city");
    expect(from).toContain("insects");
  });

  it("puts the setting behind its subject, because that is what a setting is", () => {
    const plan = planScene(beatFor("They walked around the city like insects."), style);
    const setting = must(plan.planes.find((p) => p.role === "SETTING"));
    const subject = must(plan.planes.find((p) => p.role === "SUBJECT"));
    expect(setting.depth).toBeLessThan(subject.depth);
    // And is entitled to less of the frame — the sentence is about the
    // people, in a city, not about a city containing people.
    expect(setting.weight).toBeLessThan(subject.weight);
  });

  it("uses the film's memory, so a pronoun sentence still gets its subject", () => {
    // "Then there were dozens of THEM, moving through the streets" names
    // only a place on its own. Through the real compose path the carried
    // subject supplies the rest — which is what makes this scene a
    // composition rather than an empty street.
    const carried = must(detectSubjects("They walked around the city like insects.")[0]);
    const sentence =
      "Then there were dozens of them, moving through the streets in strange synchronized waves.";
    const withMemory = [carried, ...detectSubjects(sentence)];
    const plan = planScene(beatFor(sentence, withMemory), style);
    expect(isComposite(plan)).toBe(true);
    expect(plan.planes.map((p) => p.from)).toContain("streets");
    expect(plan.planes.map((p) => p.from)).toContain("insects");
  });

  it("leaves a one-thing sentence exactly as it was", () => {
    // A single-plane plan is not a regression — it is the same shot with
    // its composition made explicit. Paying for a composite to layer one
    // thing over nothing is how a render gets slow for no picture.
    const plan = planScene(
      beatFor("The smoke detector had been disconnected for eleven months."),
      style,
    );
    expect(isComposite(plan)).toBe(false);
    expect(must(plan.planes[0]).role).toBe("SUBJECT");
  });

  it("weights the metaphor by abstraction, not by taste", () => {
    // A literal film shows people who move like insects; an abstract one
    // shows the insects. Same scene graph, different composition.
    const sentence = "The residents moved through the corridor like insects.";
    const literal = planScene(beatFor(sentence), { ...style, abstraction: 0.1 });
    const far = planScene(beatFor(sentence), { ...style, abstraction: 0.9 });
    const lm = literal.planes.find((p) => p.role === "METAPHOR");
    const fm = far.planes.find((p) => p.role === "METAPHOR");
    if (lm && fm) expect(fm.weight).toBeGreaterThan(lm.weight);
  });
});

describe("the proposition test — does it change what enters the frame", () => {
  // The pushback that produced this: "Insects occupies city" is a ROLE
  // SUMMARY, not a proposition. It names what is in the frame instead of
  // what the viewer should understand from it. The real test is not "did
  // we detect city" — it is "did the proposition cause different things to
  // enter the frame".
  //
  // "At first nobody noticed" is the unfakeable case. It names NOTHING. A
  // noun reader gets nothing and falls through to typography, which is
  // exactly what happened. Any plane that appears must therefore have come
  // from the proposition, not from a noun — which makes this the one
  // sentence where the claim cannot be faked by better noun detection.
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
    population: 0.5,
    attention: 0.5,
    tier: "DECOMPOSED",
    language: "documentary",
  };
  const UNNOTICED = "At first nobody noticed.";
  function beatFor(sentence: string): Beat {
    return {
      sentence,
      phrase: "NOBODY NOTICED",
      subjects: detectSubjects(sentence),
      figures: [],
      route: [],
      kind: "statement",
      contested: false,
      index: 1,
    };
  }

  it("the sentence names nothing — established, so the rest cannot be noun detection", () => {
    expect(detectSubjects(UNNOTICED)).toEqual([]);
  });

  it("populates the frame anyway, from the proposition", () => {
    const carried = must(detectSubjects("They walked around the city like insects.")[0]);
    const plan = planScene(beatFor(UNNOTICED), style, carried);
    expect(isComposite(plan)).toBe(true);
    const roles = plan.planes.map((p) => p.role);
    // The ordinary world enters. No noun asked for it.
    expect(roles).toContain("COUNTERPOINT");
    expect(roles).toContain("SUBJECT");
    const counter = must(plan.planes.find((p) => p.role === "COUNTERPOINT"));
    expect(counter.from).toBe(null); // named by nothing in the sentence
    // And it dominates — that is what "nobody noticed" looks like.
    const subject = must(plan.planes.find((p) => p.role === "SUBJECT"));
    expect(counter.weight).toBeGreaterThan(subject.weight);
  });

  it("states a relationship, not an inventory", () => {
    const carried = must(detectSubjects("They walked around the city like insects.")[0]);
    const plan = planScene(beatFor(UNNOTICED), style, carried);
    // The proposition must not be a list of what is present.
    expect(plan.proposition).toMatch(/has not registered it/);
    expect(plan.proposition).not.toMatch(/insects/i);
  });

  it("changes as the paragraph turns", () => {
    // Same paragraph, three beats, three different claims — the arc is in
    // the propositions, not only in the parameters.
    const carried = must(detectSubjects("They walked around the city like insects.")[0]);
    const a = planScene(beatFor("They walked around the city like insects."), style).proposition;
    const b = planScene(beatFor(UNNOTICED), style, carried).proposition;
    // Built the way compose builds it: the film's memory supplies the
    // subject a pronoun sentence does not name.
    const third =
      "Then there were dozens of them, moving through the streets in strange synchronized waves.";
    const c = planScene(
      { ...beatFor(third), subjects: [carried, ...detectSubjects(third)] },
      style,
      carried,
    ).proposition;
    expect(new Set([a, b, c]).size).toBe(3);
    expect(c).toMatch(/too many|together/);
  });

  it("the ordinary world reaches the picture, not just the plan", () => {
    const seed = segmentEssay(
      "The City\n\nThey walked around the city like insects. At first nobody noticed. Then there were dozens of them, moving through the streets in strange synchronized waves.",
      { projectId: "p" },
    );
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("invalid IR");
    const scene = must(composeAll(parsed.ir)[1]);
    const grounds = scene.nodes.flatMap((n) => (n.ground ?? []).map((g) => g.primitiveId));
    expect(grounds).toContain("plate_scene");
    // The counterpoint is named in the stack, with its own depth and its
    // own weight. This used to assert a note that said "ordinary world"
    // and nothing more; the stack line is the same claim with the
    // arithmetic attached, so a plane that reached the report without
    // reaching a depth would now fail here.
    expect(scene.notes.join(" ")).toMatch(/stacked —.*counterpoint @0\.30×0\.70/);
  });
});

describe("N-plane composition", () => {
  function scenesOf(essay: string) {
    const seed = segmentEssay(essay, { projectId: "p" });
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("invalid IR");
    return composeAll(parsed.ir);
  }
  const CITY =
    "The City\n\nThey walked around the city like insects. At first nobody noticed. Then there were dozens of them, moving through the streets in strange synchronized waves.";

  it("a setting outlives the sentence that named it", () => {
    // "At first nobody noticed" names no place. The film is still in the
    // city, and before the setting was carried this scene had exactly one
    // background plane — so there was never anything to stack.
    const scene = must(scenesOf(CITY)[1]);
    expect(scene.notes.join(" ")).toMatch(/setting \(city\)/);
  });

  it("two background planes become a nested stack, not a choice between them", () => {
    const scene = must(scenesOf(CITY)[1]);
    const compositor = scene.nodes.find((n) => n.ground && n.ground.length > 0);
    expect(compositor).toBeDefined();
    // The outer ground is the nearer layer, and it carries the deeper one
    // on a compositor of its own. One level of nesting per extra plane.
    const inner = must(compositor?.ground).find((g) => g.ground && g.ground.length > 0);
    expect(inner).toBeDefined();
    expect(inner?.primitiveId).toBe("layer_over");
    expect(must(inner?.ground).some((g) => g.primitiveId === "plate_scene")).toBe(true);
  });

  it("each layer is built with its OWN weight, not the film's average", () => {
    const scene = must(scenesOf(CITY)[1]);
    const outer = must(scene.nodes.find((n) => n.ground && n.ground.length > 0)).ground ?? [];
    const near = must(outer.find((g) => g.primitiveId === "plate_scene"));
    const inner = must(outer.find((g) => g.ground && g.ground.length > 0));
    const far = must((inner.ground ?? []).find((g) => g.primitiveId === "plate_scene"));
    // Counterpoint 0.70 against an inherited setting 0.28. Same primitive,
    // same scene, same builder — and a different picture, which is the
    // whole claim the stack makes.
    expect(near.params.cars).not.toBe(far.params.cars);
    expect(Number(near.params.cars)).toBeGreaterThan(Number(far.params.cars));
  });

  it("the deepest layer is inside the hash", async () => {
    const scene = must(scenesOf(CITY)[1]);
    const node = must(scene.nodes.find((n) => n.ground && n.ground.length > 0));
    const w = { startMs: 0, endMs: 1000 };
    const before = must((await hashSceneNodes([node], w, []))[0]).hash;
    // Reach two levels down and change one number. A non-recursive
    // signature would leave this hash identical and the cache would serve
    // the old frames for a film whose furthest layer had changed.
    const nested = JSON.parse(JSON.stringify(node)) as typeof node;
    const inner = must((nested.ground ?? []).find((g) => g.ground && g.ground.length > 0));
    const deepest = must((inner.ground ?? [])[0]);
    deepest.params = { ...deepest.params, cars: Number(deepest.params.cars ?? 0) + 7 };
    const after = must((await hashSceneNodes([nested], w, []))[0]).hash;
    expect(after).not.toBe(before);
  });

  it("a stacked scene costs what its layers cost, all the way down", () => {
    const scene = must(scenesOf(CITY)[1]);
    const flat = (nodes: typeof scene.nodes): number =>
      nodes.reduce((n, x) => n + 1 + flat(x.ground ?? []), 0);
    const total = flat(scene.nodes);
    const shallow =
      scene.nodes.length + scene.nodes.reduce((n, x) => n + (x.ground?.length ?? 0), 0);
    // There is genuinely a level the old one-deep accounting could not see.
    expect(total).toBeGreaterThan(shallow);
    expect(scene.costMsPerFrame).toBeGreaterThan(0);
  });

  it("a stack it cannot afford loses its DEEPEST layer, and says so", () => {
    const planes = [
      {
        role: "SETTING" as const,
        construction: "space",
        from: "city",
        depth: 0.15,
        weight: 0.28,
        population: 0.5,
      },
      {
        role: "COUNTERPOINT" as const,
        construction: "space",
        from: null,
        depth: 0.3,
        weight: 0.7,
        population: 0.5,
      },
    ];
    const beat = beatFor("At first nobody noticed.", { index: 1 });
    const style = styleFor("documentary");
    const rich = must(buildStack(planes, beat, style, 1, {}, 999));
    expect(rich.layers.length).toBe(2);
    expect(rich.dropped).toBe(0);
    // One layer's worth of budget. The near layer survives — the film
    // keeps the backdrop its subject stands against and loses the city
    // behind it, rather than the other way round.
    const poor = must(buildStack(planes, beat, style, 1, {}, 1));
    expect(poor.layers.length).toBe(1);
    expect(must(poor.layers[0]).role).toBe("COUNTERPOINT");
    expect(poor.dropped).toBe(1);
  });

  it("a single-plane scene still compiles as one chain", () => {
    // Nothing to stack, nothing stacked. The conservative case has to stay
    // conservative or every scene pays for a composite it does not use.
    const scenes = scenesOf("A Note\n\nThe rule was written down.");
    const scene = must(scenes[0]);
    expect(scene.notes.join(" ")).not.toMatch(/stacked —/);
  });
});

describe("the acceptance test — the anomaly is BUILT, not just planned", () => {
  // The bar set for this step: the resulting scene must contain both an
  // anomaly and an ordinary world capable of failing to notice it, and the
  // ordinary world must be materially represented rather than merely named
  // as a role.
  //
  // The previous commit planned both and built neither: the scene still
  // composed as typography, because `refersBack` does not fire on "at
  // first nobody noticed" — it contains no anaphor — so the film's memory
  // never reached the constructor. The proposition was decoration.
  function scenes() {
    const seed = segmentEssay(
      "The City\n\nThey walked around the city like insects. At first nobody noticed. Then there were dozens of them, moving through the streets in strange synchronized waves.",
      { projectId: "p" },
    );
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("invalid IR");
    return composeAll(parsed.ir);
  }

  it("builds the anomaly in a sentence that names nothing", () => {
    const scene = must(scenes()[1]);
    const built = scene.nodes.map((n) => n.primitiveId);
    // Not typography. The thing that went unnoticed is on screen.
    expect(built).toContain("creature_chain");
    expect(built[0]).not.toBe("text_layout");
  });

  it("paints the ordinary world it goes unnoticed against", () => {
    const scene = must(scenes()[1]);
    const grounds = scene.nodes.flatMap((n) => (n.ground ?? []).map((g) => g.primitiveId));
    expect(grounds).toContain("plate_scene");
  });

  it("holds both at once — the whole point", () => {
    const scene = must(scenes()[1]);
    const everything = scene.nodes.flatMap((n) => [
      n.primitiveId,
      ...(n.ground ?? []).map((g) => g.primitiveId),
    ]);
    expect(everything).toContain("creature_chain");
    expect(everything).toContain("plate_scene");
  });

  it("keeps the anomaly small — it has not taken the frame yet", () => {
    // "Nobody noticed" is a statement about scale and salience, not only
    // about presence. A dominant anomaly would contradict the sentence.
    const body = must(must(scenes()[1]).nodes.find((n) => n.primitiveId === "creature_chain"));
    const escalated = must(must(scenes()[2]).nodes.find((n) => n.primitiveId === "creature_chain"));
    expect(Number(body.params.count)).toBeLessThan(Number(escalated.params.count));
  });
});

describe("weight and depth reach pixels", () => {
  // The capability map found `plane.weight` and `plane.depth` computed and
  // read by nothing — PLANNED, which looks finished from every angle
  // except the screen. These assert the loop is closed.
  function built() {
    const seed = segmentEssay(
      "The City\n\nThey walked around the city like insects. At first nobody noticed. Then there were dozens of them, moving through the streets in strange synchronized waves.",
      { projectId: "p" },
    );
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("invalid IR");
    return composeAll(parsed.ir).map((s) => ({
      body: s.nodes.find((n) => n.primitiveId === "creature_chain"),
      parallax: s.nodes.find((n) => n.primitiveId === "parallax_layers"),
      notes: s.notes.join(" "),
    }));
  }

  it("an unnoticed anomaly is smaller than a noticed one", () => {
    // Plumbing weight through immediately exposed this: once compose began
    // carrying the subject into "nobody noticed", the ordinary SUBJECT
    // branch claimed 0.85 of the frame — a swarm filling the screen while
    // the narration says nobody saw it.
    const [first, unnoticed] = built();
    expect(Number(must(unnoticed?.body).params.scale)).toBeLessThan(
      Number(must(first?.body).params.scale),
    );
    expect(unnoticed?.notes).toMatch(/subject at 0\.30/);
  });

  it("depth reaches the primitive that has always had a depth parameter", () => {
    const [first] = built();
    // Not style.density, which is what parallax_layers used to be given.
    expect(Number(must(first?.parallax).params.depth)).toBeCloseTo(0.55, 2);
  });

  it("escalation still reads, on top of weighting", () => {
    const scenes = built();
    expect(Number(must(scenes[2]?.body).params.count)).toBeGreaterThan(
      Number(must(scenes[1]?.body).params.count),
    );
  });
});

describe("the director model — expression changes, meaning does not", () => {
  // The claim under test, stated as the operator stated it: the same
  // sentence, the same proposition, the same visual grammar, rendered at
  // three world populations and three attentions. If the roles and the
  // proposition survive all nine while the picture does not, the system
  // has a director model rather than a scene generator.
  const ESSAY =
    "The City\n\nThey walked around the city like insects. At first nobody noticed. Then there were dozens of them, moving through the streets in strange synchronized waves.";

  function compile(over: Record<string, number>) {
    const seed = segmentEssay(ESSAY, { projectId: "p" });
    const raw = JSON.parse(JSON.stringify(seed.ir));
    for (const cp of raw.creativeState.controlPoints) Object.assign(cp.values, over);
    const parsed = parseIR(raw);
    if (!parsed.ok) throw new Error("invalid IR");
    return composeAll(parsed.ir);
  }
  /** The unnoticed scene, flattened through the whole stack. */
  function probe(worldPopulation: number, attention: number) {
    const scene = must(compile({ worldPopulation, attention })[1]);
    const flat: typeof scene.nodes = [];
    const walk = (ns: typeof scene.nodes) => {
      for (const n of ns) {
        flat.push(n);
        walk(n.ground ?? []);
      }
    };
    walk(scene.nodes);
    return {
      scene,
      cars: flat
        .filter((n) => n.primitiveId === "plate_scene")
        .reduce((a, n) => a + Number(n.params.cars ?? 0), 0),
      subjectScale: Number(
        must(flat.find((n) => n.primitiveId === "creature_chain")).params.scale ?? 0,
      ),
      roles: must(scene.notes.find((n) => n.startsWith("composed —"))),
    };
  }

  it("population populates the world and does NOT touch the subject", () => {
    const sparse = probe(0.1, 0.5);
    const middle = probe(0.5, 0.5);
    const dense = probe(0.9, 0.5);
    expect(sparse.cars).toBeLessThan(middle.cars);
    expect(middle.cars).toBeLessThan(dense.cars);
    // THE FIGURE FIREWALL, APPLIED TO POPULATION. "Dozens of them" is a
    // number the essay printed. A world dial that multiplied it would be
    // the director editing the prose, so the subject is untouched across
    // the entire range.
    expect(sparse.subjectScale).toBe(dense.subjectScale);
  });

  it("attention moves the subject and its world in opposite directions", () => {
    const env = probe(0.5, 0.1);
    const subj = probe(0.5, 0.9);
    expect(subj.subjectScale).toBeGreaterThan(env.subjectScale);
    expect(subj.cars).toBeLessThan(env.cars);
    // And the redistribution is visible in the plan, not only in pixels.
    expect(must(env.scene.notes.find((n) => n.startsWith("stacked —")))).toMatch(/×0\.9/);
    expect(must(subj.scene.notes.find((n) => n.startsWith("stacked —")))).toMatch(/×0\.[12]/);
  });

  it("the proposition and the roles are invariant across all nine", () => {
    const roles = new Set<string>();
    const pictures = new Set<string>();
    for (const p of [0.1, 0.5, 0.9]) {
      for (const a of [0.1, 0.5, 0.9]) {
        const r = probe(p, a);
        roles.add(r.roles);
        pictures.add(`${r.cars}/${r.subjectScale.toFixed(3)}`);
      }
    }
    // One claim. Nine cinematic arguments for it.
    expect(roles.size).toBe(1);
    expect(pictures.size).toBeGreaterThan(6);
  });

  it("0.5 is the identity — a film that sets neither composes as before", () => {
    const neutral = probe(0.5, 0.5);
    const unset = must(compile({})[1]);
    expect(JSON.stringify(neutral.scene.nodes)).toBe(JSON.stringify(unset.nodes));
  });

  it("a director reaches both dials in prose", () => {
    // The operator's own example. Neither word names a parameter.
    const read = readIntent({ feel: "Make the city feel huge and indifferent." });
    expect(read.registers).toContain("indifferent");
    expect(read.registers).toContain("scale");
    expect(must(read.style.population)).toBeGreaterThan(0.5);
    expect(must(read.style.attention)).toBeLessThan(-0.5);
  });

  it("indifference is not isolation — they disagree about population", () => {
    // An empty street and a crowded one that simply carries on are both
    // readings of "nobody noticed", and they are opposite pictures. A
    // register table that could not tell them apart would collapse the
    // Hopper reading and the Bruegel one into one look.
    const empty = readIntent({ feel: "Make it feel isolated and empty." });
    const busy = readIntent({ feel: "Make it feel ordinary and indifferent." });
    expect(must(empty.style.population)).toBeLessThan(0);
    expect(must(busy.style.population)).toBeGreaterThan(0);
    expect(must(empty.style.attention)).toBeGreaterThan(0);
    expect(must(busy.style.attention)).toBeLessThan(0);
  });
});
