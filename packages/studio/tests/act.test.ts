import { describe, expect, it } from "vitest";
import { type Act, type ActInput, readAct } from "../src/compile/act.ts";
import type { ArgumentRole } from "../src/compile/promote.ts";
import { detectSubjects } from "../src/compile/subject.ts";

const read = (
  sentence: string,
  extra: Partial<ActInput> = {},
  role: ArgumentRole = "DEVELOPMENT",
) => readAct({ sentence, role, ...extra });

const VOCABULARY: Act[] = [
  "DECLARE",
  "SUSTAIN",
  "WITHDRAW",
  "NONE",
  "ACCUMULATE",
  "CONVERGE",
  "CONTRAST",
  "QUALIFY",
  "REVEAL",
  "TRANSFORM",
  "INTENSIFY",
  "RECALL",
];

describe("the act layer", () => {
  /* THE ACCEPTANCE PROPERTY.
   *
   * Argumentative prose changes state constantly without naming anything.
   * The compiler's old rule was "new named entity? yes → intervene, no →
   * hold", so a whole essay of ideas came out as one held frame after
   * another. If any of these reads SUSTAIN, that rule is back. */
  it("reads a change in a sentence that names nothing depictable", () => {
    const abstract = [
      "That position has to be re-earned constantly.",
      "It's not a credential you get once.",
      "Logic was just never the load-bearing thing.",
      "The easy read is: everyone's human, nobody's perfectly rational.",
      "Instead, the whole thing runs on incentive.",
      "It collapses into the thing it was pretending not to be.",
    ];
    for (const s of abstract) {
      expect(detectSubjects(s), `"${s}" should name nothing depictable`).toHaveLength(0);
      const a = read(s, { standing: new Set(["something"]) });
      expect(a.act, `"${s}" fell through to a held frame`).not.toBe("SUSTAIN");
      expect(VOCABULARY).toContain(a.act);
    }
  });

  /* NEVER NULL, AND ALWAYS IN THE VOCABULARY. Same bar as the proposition
   * layer: a sentence the film cannot read is a sentence the film will
   * reach for a noun to explain. */
  it("always reads something, whatever it is handed", () => {
    for (const s of ["", ".", "Yes.", "A.", "   ", "Because."]) {
      const a = read(s);
      expect(VOCABULARY, `"${s}" produced ${a.act}`).toContain(a.act);
      expect(a.why.length).toBeGreaterThan(0);
    }
  });

  /* THE SAME SENTENCE ALWAYS READS THE SAME WAY. No seed, no clock, no
   * model — an act that moved between two compiles of one IR would make
   * every hash downstream a lie. */
  it("is deterministic", () => {
    const s = "The brand, under the same pressure, cannot do that.";
    const once = read(s, { standing: new Set(["brand"]) });
    for (let i = 0; i < 5; i++) {
      const again = read(s, { standing: new Set(["brand"]) });
      expect(again.act).toBe(once.act);
      expect(again.why).toBe(once.why);
      expect(again.confidence).toBe(once.confidence);
    }
  });

  /* THE RECOVERED BOOLEAN.
   *
   * A hedge has been detected on every scene since the allocator was
   * written and has only ever survived as `score *= 0.45`, so the film
   * could tell that a sentence scored lower and never that it was
   * qualified. It is carried whether or not it decided the act. */
  it("carries the hedge even when the hedge did not decide the act", () => {
    const hedged = read("It arguably collapses into a performance.");
    expect(hedged.hedged).toBe(true);
    // Something else won — the point is that the qualification survived.
    expect(hedged.act).not.toBe("SUSTAIN");

    const plain = read("It collapses into a performance.");
    expect(plain.hedged).toBe(false);
  });

  it("reads a qualification as an act when nothing else in the sentence speaks", () => {
    const a = read("The record is perhaps a little thinner than it looks.");
    expect(a.act).toBe("QUALIFY");
    expect(a.confidence).toBe("verbatim");
  });

  /* THE COMPILER MUST NOT CONTRADICT THE SENTENCE IT IS DRAWING. */
  it("does not draw a denied change as a change", () => {
    const denied = read("Memory was never storage.");
    expect(denied.negated).toBe(true);
    expect(denied.act).not.toBe("TRANSFORM");

    const asserted = read("Memory became storage.");
    expect(asserted.negated).toBe(false);
    expect(asserted.act).toBe("TRANSFORM");
  });

  /* THE SIGNAL THAT WAS DETECTED AND DESTROYED.
   *
   * A denial followed by an assertion is one claim in two sentences, and
   * the segmenter has already cut them apart. The allocator has found this
   * pair since it was written and used the finding only to merge two quota
   * slots — that the argument REVERSED across the cut never reached the
   * picture. */
  it("reads a reversal that spans the cut", () => {
    const a = read("It's a diagnosis.", {
      previous: { sentence: "The fallacy isn't a lapse.", act: "DECLARE" },
    });
    expect(a.act).toBe("CONTRAST");
    expect(a.confidence).toBe("verbatim");

    // And not on two ordinary consecutive sentences.
    const b = read("It runs on incentive.", {
      previous: { sentence: "The method is stated plainly.", act: "DECLARE" },
    });
    expect(b.act).not.toBe("CONTRAST");
  });

  /* AN ACT WITH NO LEXICAL SIGNAL AT ALL.
   *
   * `relativeRate` — this scene's measured speech rate against the film's
   * own median — has been computed on every narrated film and read at zero
   * call sites. It is the one signal in the vocabulary that no word list
   * can reach. */
  it("reads an act off the delivery, with nothing in the words", () => {
    // Deliberately a sentence with no signal in it at all — the first
    // draft of this test used one containing "accumulates", which the
    // verb table reads verbatim, so it proved nothing about delivery.
    const sentence = "And that is where the record stood at the time.";
    const normal = read(sentence, { relativeRate: 1.0 });
    const pressed = read(sentence, { relativeRate: 1.45 });
    expect(pressed.act).toBe("INTENSIFY");
    expect(pressed.act).not.toBe(normal.act);
    expect(pressed.confidence).toBe("structural");
  });

  it("reads a long sentence followed by a short one as a compression", () => {
    const runUp =
      "There is a moment that recurs across every one of these arcs, and it arrives without any announcement at all.";
    const a = read("Openly.", { previous: { sentence: runUp, act: "DECLARE" } });
    expect(a.act).toBe("INTENSIFY");
  });

  /* SILENCE IS THE ALLOCATOR'S DECISION.
   *
   * It is made at the author's own paragraph boundaries. An act layer that
   * could overrule it would be a second implementation of one rule,
   * disagreeing with the first — which is how the Lab and the Worker came
   * to disagree about 57 of 88 scenes. */
  it("never overrules a decision to be silent", () => {
    const loud = "It collapses into the thing it was pretending not to be.";
    expect(read(loud).act).not.toBe("NONE");
    expect(read(loud, { silent: true }).act).toBe("NONE");
  });

  /* A RETURN IS NOT AN ARRIVAL. */
  it("reads a refrain returning, and not its first use", () => {
    const s = "The debate bro at the fallacy moment has quietly become a bullshitter.";
    expect(read(s, { refrainOccurrence: 1 }).act).not.toBe("RECALL");
    const back = read(s, { refrainOccurrence: 2 });
    expect(back.act).toBe("RECALL");
    expect(back.why).toContain("second");
  });

  /* NAMING IS THE WEAKEST REASON TO DRAW SOMETHING.
   *
   * The compiler used to ask this question FIRST, which is how an
   * incidental noun in a subordinate clause became the subject of a shot.
   * A sentence that both names something new and states outright what is
   * happening must be read for what it says, not for what it mentions. */
  it("prefers what a sentence does to what it names", () => {
    const s = "The camera was never the point.";
    const named = detectSubjects(s).map((x) => x.text.toLowerCase());
    expect(
      named.length,
      "the trap has to still be there for this to test anything",
    ).toBeGreaterThan(0);
    const a = read(s, { named, standing: new Set() });
    // It names something the film has not established, so the old rule
    // would DECLARE. What the sentence says is that a change did not
    // happen.
    expect(a.act).not.toBe("DECLARE");
  });

  it("falls back to presence only when the sentence says nothing else", () => {
    const a = read("The lighthouse.", { named: ["lighthouse"], standing: new Set() });
    expect(a.act).toBe("DECLARE");
    expect(a.confidence).toBe("structural");
  });

  /* THE CONFIDENCE IS NOT DECORATION. Anything read off the argument's
   * shape rather than off the prose has to say so, or a guess becomes
   * indistinguishable from a reading. */
  it("labels an inference as an inference", () => {
    const a = read("And so the record stands.", { standing: new Set(["record"]) });
    expect(["inferred", "structural"]).toContain(a.confidence);
    if (a.confidence === "inferred") expect(a.because).toBe("");
  });

  it("points at the prose when it claims to have read it", () => {
    const a = read("Instead, the whole thing runs on incentive.");
    expect(a.confidence).toBe("verbatim");
    expect(a.because.length).toBeGreaterThan(0);
    expect(a.because.toLowerCase()).toBe("instead");
  });
});
