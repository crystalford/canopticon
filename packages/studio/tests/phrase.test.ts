// What goes on screen, and what the sentence names.
//
// Two files, one complaint. The words on screen were a 26-character
// truncation of the scene's label, so they ended on prepositions and
// repeated whenever the prose opened the same way twice; and the palette's
// only two object generators were reachable only through a ratified
// reading, so no object ever rendered.

import { describe, expect, it } from "vitest";
import { composeAll } from "../src/compile/compose.ts";
import { choosePhrase, properNounRuns, trimPhrase } from "../src/compile/phrase.ts";
import { segmentEssay } from "../src/compile/segment.ts";
import { detectSubjects, subjectReading } from "../src/compile/subject.ts";
import { parseIR } from "../src/ir/schema.ts";
import { allActive } from "./active.ts";
import { must } from "./must.ts";

describe("trimming a phrase", () => {
  it("never ends on a function word — the reported bug", () => {
    // "instead of just saying for instance VIDEO ESSAY AND .. instead of
    // just VIDEO ESSAY"
    expect(trimPhrase("video essay and", 4)).toBe("VIDEO ESSAY");
    expect(trimPhrase("the program was wound down in", 6)).toBe("PROGRAM WAS WOUND DOWN");
    expect(trimPhrase("funding was redirected through the", 5)).toBe("FUNDING WAS REDIRECTED");
  });

  it("never starts on a connective or an article", () => {
    expect(trimPhrase("And the hotels stayed open", 4)).toBe("HOTELS STAYED OPEN");
    expect(trimPhrase("The building is the same", 4)).toBe("BUILDING IS THE SAME");
  });

  it("cuts at a clause boundary rather than mid-idea", () => {
    expect(trimPhrase("the program which had cost billions", 8)).toBe("PROGRAM");
  });

  it("returns nothing rather than a phrase made only of function words", () => {
    expect(trimPhrase("of the", 4)).toBe("");
    expect(trimPhrase("and", 4)).toBe("");
  });

  it("keeps a figure's own punctuation intact", () => {
    expect(trimPhrase("$282,345.84 for 2024-2025", 3)).toBe("$282,345.84 FOR 2024-2025");
  });
});

describe("proper-noun runs", () => {
  it("finds a name, and does not mistake a sentence's first word for one", () => {
    expect(properNounRuns("The City of Niagara Falls received a grant")).toContain("Niagara Falls");
    expect(properNounRuns("Nothing changed at all")).toEqual([]);
  });
});

describe("choosing the phrase", () => {
  const sentence = "The City of Niagara Falls received a federal IHAP grant of $282,345.84.";

  it("puts the verbatim figure first when the sentence carries one", () => {
    const got = choosePhrase(sentence, "City of Niagara Falls received", {
      figures: [{ text: "$282,345.84", value: 282345.84, kind: "money", offset: 58 }],
    });
    expect(got.text).toBe("$282,345.84");
    expect(got.source).toBe("figure");
  });

  it("falls to the next candidate rather than repeating a recent phrase", () => {
    const first = choosePhrase(sentence, "label");
    const second = choosePhrase(sentence, "label", { recent: [first.text] });
    expect(second.text).not.toBe(first.text);
    expect(first.alternatives.length).toBeGreaterThan(0);
  });

  it("says which rule chose it", () => {
    const got = choosePhrase("The smoke detector had been disconnected.", "");
    expect(["subject", "clause", "proper-noun"]).toContain(got.source);
  });

  it("is deterministic", () => {
    expect(choosePhrase(sentence, "x")).toEqual(choosePhrase(sentence, "x"));
  });
});

describe("what the sentence names", () => {
  it("finds a depictable thing, verbatim and at its offset", () => {
    const found = must(detectSubjects("The smoke detector in room 214 was disconnected.")[0]);
    expect(found.kind).toBe("object");
    expect("The smoke detector in room 214 was disconnected.".slice(found.offset)).toContain(
      found.text,
    );
  });

  it("matches whole words only — a border is not borderline", () => {
    expect(detectSubjects("a borderline case").length).toBe(0);
    expect(detectSubjects("recorded in the minutes").some((s) => s.text === "record")).toBe(false);
  });

  it("declines on prose that names nothing you can point a camera at", () => {
    expect(detectSubjects("This was presented as a policy shift.").length).toBe(0);
    expect(subjectReading("The framework was revised.", "")).toBe(null);
  });

  it("prefers the more specific noun when a sentence names several", () => {
    const found = detectSubjects("The building's smoke detector was removed.");
    expect(must(found[0]).text.toLowerCase()).toContain("detector");
  });

  it("reads several named things as a comparison, one as an inspection", () => {
    expect(must(subjectReading("The detector was removed.", "")).visualOpportunity).toBe("inspect");
    expect(
      must(subjectReading("The contract named a hotel and a warehouse.", "")).visualOpportunity,
    ).toBe("contrast");
  });
});

describe("an essay that names things renders them", () => {
  const ESSAY = `Hotels

The smoke detector in room 214 had been disconnected for eleven months.
The contract named a single warehouse. The residents were moved at night.
Nothing changed.`;

  /* WHAT A SENTENCE NAMES REACHES THE PICTURE, FROM PROSE ALONE.
   *
   * This test used to name four primitives, two of which were the
   * feasibility proofs deleted as concepts — so it was asserting that a
   * particular demo object still appears, which is the thing the suite is
   * not for. The capability it was actually defending is the one worth
   * keeping: an essay reaches a DIFFERENT picture for a sentence that
   * names a depictable thing than for one that names nothing, before a
   * model has seen a single sentence and with nothing ratified.
   *
   * `allActive` because this is a test of what gets BUILT — a scene the
   * allocator decided should hold never reaches the constructor. */
  it("draws a named thing differently from a sentence that names nothing", () => {
    const seed = segmentEssay(ESSAY, { projectId: "p" });
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("segmenter produced an invalid IR");
    const scenes = composeAll(parsed.ir, null, allActive(parsed.ir));

    const shape = (i: number) =>
      must(scenes[i], `scene ${i}`)
        .nodes.map((n) => n.primitiveId)
        .join(" → ");
    const named = parsed.ir.scenes.map((s) => detectSubjects(s.narration.text).length > 0);
    const withThing = named.indexOf(true);
    const without = named.indexOf(false);
    expect(withThing, "fixture should name something depictable").toBeGreaterThanOrEqual(0);
    expect(without, "fixture should also contain a sentence naming nothing").toBeGreaterThanOrEqual(
      0,
    );
    expect(shape(withThing)).not.toBe(shape(without));

    // And no scene carries a ratified reading — this is the whole point.
    expect(parsed.ir.scenes.every((s) => !s.reading)).toBe(true);
  });

  it("puts a different phrase on screen in each of the first scenes", () => {
    const seed = segmentEssay(ESSAY, { projectId: "p" });
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("segmenter produced an invalid IR");
    const scenes = composeAll(parsed.ir);
    const phrases = scenes.map((s) => s.phrase.text);
    expect(new Set(phrases).size).toBe(phrases.length);
    for (const p of phrases) expect(p).not.toMatch(/\b(IN|OF|THE|AND|TO|WAS|A)$/);
  });
});
