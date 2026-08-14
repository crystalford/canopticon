// WHICH WORDS DESERVE TO BE SEEN.
//
// The layer that decides what matters, separately from how to show it.
// Every assertion here is about the DECISION — what got promoted, at what
// level, and whether it is verbatim — because the realisation is a
// different question answered by a different layer.

import { describe, expect, it } from "vitest";
import { compile } from "../src/compile/index.ts";
import { promoteText } from "../src/compile/promote.ts";
import { segmentEssay } from "../src/compile/segment.ts";
import type { Alignment } from "../src/compile/solver.ts";
import { type EditorialIR, parseIR } from "../src/ir/schema.ts";

/* An argument with the shapes an argument has: a title, a denial and its
 * assertion across a full stop, two contrasts, a counter, and an ending
 * that is also a pair. Condensed — the real essay has paragraphs of
 * development between these — which is why the ratios here are looser
 * than they would be on a full piece. */
const ESSAY = `# The Logic Costume

There's a moment that shows up again and again in public argument.
Someone builds a reputation on rigour, then defends a position that cannot survive its own method.
The easy explanation is that they got worse at thinking.
The fallacy isn't a lapse. It's a diagnosis.
What it diagnoses is a position, not a person.
Logic was never really being tested. It was being displayed as a brand.
The move is always the same: manufacture the win, then cite it.
You can watch the ground showing through the figure.
Of course, a critic could say this is unfalsifiable.
But that is exposure, not corruption.
He is measuring himself against a ruler he built himself.
The position doesn't produce more distortion.
It produces the only distortion anyone can catch.`;

function ir(): EditorialIR {
  const seed = segmentEssay(ESSAY, { projectId: "proj_promote" });
  const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
  if (!parsed.ok) throw new Error(`fixture IR invalid: ${JSON.stringify(parsed.errors)}`);
  return parsed.ir;
}

const shown = (p: ReturnType<typeof promoteText>) => p.filter((x) => x.level > 0);
const textOf = (p: ReturnType<typeof promoteText>) =>
  shown(p)
    .map((x) => x.text.toLowerCase())
    .join(" | ");

describe("promotion is scarce", () => {
  it("most of the essay is spoken and not shown", () => {
    const p = promoteText(ir(), null);
    // The whole point. A film that promotes every sentence has promoted
    // nothing: the level-4 statement only takes over the screen because
    // the minute around it did not.
    expect(shown(p).length).toBeLessThan(p.length);
    expect(p.filter((x) => x.level === 0).length).toBeGreaterThan(0);
  });

  it("a level-4 statement is rare and is never a development paragraph", () => {
    const p = promoteText(ir(), null);
    const major = p.filter((x) => x.level === 4);
    expect(major.length).toBeGreaterThan(0);
    expect(major.length).toBeLessThanOrEqual(4);
    for (const m of major) {
      expect(["TITLE", "THESIS", "DIAGNOSTIC", "CONCLUSION", "STANDARD"]).toContain(m.role);
    }
  });

  it("the same essay always promotes the same moments", () => {
    expect(textOf(promoteText(ir(), null))).toEqual(textOf(promoteText(ir(), null)));
  });
});

describe("promotion never invents", () => {
  it("every promoted span is literally in the essay", () => {
    const film = ir();
    for (const p of shown(promoteText(film, null))) {
      // The same standard a figure is held to. What appears on screen is
      // something the essay actually says — checkable by the person who
      // wrote it, without trusting the compiler.
      expect(film.essay).toContain(p.text);
    }
  });

  it("the title is the essay's own, without its markdown", () => {
    const p = promoteText(ir(), null);
    const title = p.find((x) => x.role === "TITLE");
    expect(title?.text).toBe("The Logic Costume");
    // A title competes with nothing — a film withholding its own name to
    // save a slot for a sentence would be the scarcity rule misapplied.
    expect(title?.level).toBe(4);
  });

  it("a hedged sentence is not promoted to a statement", () => {
    const seed = segmentEssay(
      "# H\n\nThis probably suggests the programme might have been mismanaged.",
      { projectId: "proj_hedge" },
    );
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("invalid");
    // An essay is allowed to be uncertain. Dramatising an uncertainty into
    // a full-screen statement is the compiler putting words in the
    // author's mouth.
    const body = promoteText(parsed.ir, null).filter((x) => x.role !== "TITLE");
    expect(body.every((x) => x.level < 3)).toBe(true);
  });
});

describe("a claim split across a full stop is one claim", () => {
  it("a denial and its assertion are promoted together or not at all", () => {
    const p = promoteText(ir(), null);
    const t = textOf(p);
    /* THE MEASURED FAILURE THIS EXISTS FOR. Run per-scene, the segmenter
     * has already cut "The fallacy isn't a lapse." from "It's a
     * diagnosis.", so one is a fragment and the other is a pronoun with
     * nothing to refer to, and neither was promoted while a weaker line
     * three scenes later took a slot. */
    expect(t).toContain("the fallacy isn't a lapse");
    expect(t).toContain("it's a diagnosis");
    expect(t).toContain("the position doesn't produce more distortion");
    expect(t).toContain("it produces the only distortion anyone can catch");
  });

  it("a contrast is found, and trimmed without leaving the prose", () => {
    const film = ir();
    const t = textOf(promoteText(film, null));
    // `trimPhrase` uppercases, which is right for type and fatal here: the
    // uppercased span stopped being a literal substring and the promotion
    // was dropped in silence. "a position, not a person" scored 0.9 and
    // never appeared.
    expect(t).toContain("not a person");
    expect(t).toContain("exposure, not corruption");
  });
});

describe("promotion is timed to the voice when the voice was measured", () => {
  const aligned = (sceneId: string, words: string[], from = 0): Alignment => ({
    sceneId,
    chunks: [{ chunkId: `${sceneId}_c0`, startMs: 0, endMs: 400 * words.length }],
    words: words.map((word, i) => ({
      word,
      startMs: from + i * 400,
      endMs: from + i * 400 + 380,
    })),
  });

  it("a promoted phrase lands on its own measured words", async () => {
    const film = ir();
    const target = film.scenes.find((s) => /exposure, not corruption/i.test(s.narration.text));
    if (!target) throw new Error("fixture changed");
    const report = await compile(film, {
      alignments: new Map([
        [
          target.sceneId,
          aligned(target.sceneId, ["but", "that", "is", "exposure", "not", "corruption"]),
        ],
      ]),
    });
    const p = report.promotions.find((x) => x.sceneId === target.sceneId);
    expect(p?.level).toBeGreaterThan(0);
    // "exposure" is the fourth word, so the phrase starts at 1200ms — not
    // at the scene's start, which is where a proportional guess would put
    // it. That difference is the whole reason the words were frozen.
    expect(p?.window?.measured).toBe(true);
    expect(p?.window?.startMs).toBe(1200);
  });

  it("an unmeasured scene falls back to its window and says so", async () => {
    const report = await compile(ir());
    for (const p of report.promotions.filter((x) => x.level > 0)) {
      // Nominal windows exist for every scene, so a promotion still has a
      // window — it is simply not a measurement, and the flag is what
      // stops a guess being read as one.
      expect(p.window?.measured).toBe(false);
    }
  });
});

describe("promotion gates what reaches the screen", () => {
  it("a scene at level 0 sets no words", async () => {
    const report = await compile(ir());
    for (const scene of report.composed) {
      const p = report.promotions.find((x) => x.sceneId === scene.sceneId);
      if (p?.level === 0) expect(scene.phrase.text).toBe("");
      else expect(scene.phrase.text).toBe(p?.text);
    }
    // And the film as a whole shows far less than it says.
    const withText = report.composed.filter((s) => s.phrase.text.length > 0);
    expect(withText.length).toBeLessThan(report.composed.length);
  });
});
