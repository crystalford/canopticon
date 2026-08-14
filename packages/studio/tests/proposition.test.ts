import { describe, expect, it } from "vitest";
import type { ArgumentRole } from "../src/compile/promote.ts";
import { describeProposition, readProposition } from "../src/compile/proposition.ts";
import { detectSubjects } from "../src/compile/subject.ts";

const read = (sentence: string, role: ArgumentRole = "DEVELOPMENT", extra = {}) =>
  readProposition({ sentence, role, ...extra });

describe("the proposition layer", () => {
  /* THE ACCEPTANCE PROPERTY, AND THE WHOLE REASON THIS LAYER EXISTS.
   *
   * `readRelation` declines unless the noun lexicon finds two subjects, so
   * an essay about ideas produced no reading at all and the picture fell
   * to `subjects[0].kind`. If this ever returns null the fallback comes
   * back and a noun starts choosing pictures again. */
  it("always reads a sentence that names nothing depictable", () => {
    const abstract = [
      "The fallacy isn't a lapse.",
      "It's a diagnosis.",
      "Logic was never really being tested.",
      "Every claim to authority is a live, continuously-renewed performance.",
      "This is the mechanism.",
      "Nothing changed, and that was the point.",
    ];
    for (const s of abstract) {
      expect(detectSubjects(s), `"${s}" should name nothing depictable`).toHaveLength(0);
      const p = read(s);
      expect(p.kind, `"${s}" produced no proposition`).toBeTruthy();
    }
  });

  /* THE CENTIPEDE.
   *
   * The exact sentence that put a thirty-segment, sixty-legged creature on
   * screen. The only lexicon hit in it is "person" — a function-word-grade
   * noun inside a negation, in a sentence that is not about a person. What
   * the sentence actually does is displace one reading with another. */
  it("reads the sentence that produced a centipede as a contrast, not a body", () => {
    const s = "The lolcow trajectory isn't a story about one person being uniquely self-deceived.";
    // The trap is still there, and this is what it looks like.
    expect(detectSubjects(s).map((x) => `${x.text}:${x.kind}`)).toContain("person:person");

    const p = read(s, "DIAGNOSTIC");
    expect(p.kind).toBe("OPPOSES");
    expect(p.confidence).toBe("verbatim");
    // Checkable against the prose, exactly like a figure.
    expect(s).toContain(p.because);
    expect(p.negated).toBe(true);
  });

  it("reads the argument's own memorable shapes off the contrast", () => {
    for (const s of [
      "A position, not a person.",
      "Exposure, not corruption.",
      "It was not a lapse but a diagnosis.",
    ]) {
      const p = read(s, "THESIS");
      expect(p.kind, s).toBe("OPPOSES");
      expect(p.confidence, s).toBe("verbatim");
      expect(s, s).toContain(p.because);
    }
  });

  it("reads a thing presented as what it is not", () => {
    const p = read("It was being displayed as a brand.", "DIAGNOSTIC");
    expect(p.kind).toBe("PERFORMS");
    expect(p.confidence).toBe("verbatim");
  });

  it("separates a becoming from a degrading", () => {
    expect(read("The method turned into a procedure.").kind).toBe("BECOMES");
    const worse = read("The method turned into a costume, and the argument rotted.");
    expect(worse.kind).toBe("DEGRADES");
    expect(worse.confidence).toBe("verbatim");
  });

  /* THE VERB TABLE RUNS WITHOUT A RELATION.
   *
   * `semantic-scene.ts` had this table and could only ever apply it to an
   * action span, which required two lexicon nouns. On the sentence itself
   * it reads prose that names nothing. */
  it("runs the verb reading on the sentence when no relation was found", () => {
    const p = read("What it reveals is the shape of the claim underneath.");
    expect(p.kind).toBe("REVEALS");
    expect(p.confidence).toBe("structural");
  });

  it("prefers a verbatim action span over the sentence when one exists", () => {
    const p = read("The city watched its residents.", "DEVELOPMENT", { action: "watched" });
    expect(p.kind).toBe("OBSERVES");
    expect(p.confidence).toBe("verbatim");
  });

  it("reads the film's own memory when the prose is quiet", () => {
    const quiet = "And so it went.";
    expect(read(quiet).confidence).toBe("inferred");
    expect(read(quiet, "DEVELOPMENT", { recurring: true }).kind).toBe("RECURS");
    expect(read(quiet, "DEVELOPMENT", { merging: true }).kind).toBe("COLLAPSES");
  });

  /* THE FLOOR IS LABELLED AS A FLOOR.
   *
   * A reading derived from what the sentence DOES in the argument is an
   * inference, not a claim about the text, and a construction weighing it
   * has to be able to tell the difference. */
  it("labels a role-derived reading as inferred, with no verbatim claim", () => {
    const p = read("And so it went.", "CONCLUSION");
    expect(p.kind).toBe("BECOMES");
    expect(p.confidence).toBe("inferred");
    expect(p.because).toBe("");
  });

  it("describes itself in words a director can read", () => {
    const p = read("A position, not a person.", "THESIS");
    expect(describeProposition(p)).toContain("displacing");
    const inferred = read("And so it went.", "DEVELOPMENT");
    expect(describeProposition(inferred)).toContain("inferred");
  });

  it("is deterministic", () => {
    const s = "The fallacy isn't a lapse.";
    expect(read(s, "THESIS")).toEqual(read(s, "THESIS"));
  });
});
