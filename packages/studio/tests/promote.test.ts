// WHICH WORDS DESERVE TO BE SEEN.
//
// The layer that decides what matters, separately from how to show it.
// Every assertion here is about the DECISION — what got promoted, at what
// level, and whether it is verbatim — because the realisation is a
// different question answered by a different layer.

import { describe, expect, it } from "vitest";
import { compile } from "../src/compile/index.ts";
import { allocate, textOf } from "../src/compile/promote.ts";
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

const shown = (p: ReturnType<typeof allocate>) => p.filter((x) => x.intensity > 0);
const promotedLines = (p: ReturnType<typeof allocate>) =>
  shown(p)
    .map((x) => textOf(x)?.text.toLowerCase() ?? "")
    .join(" | ");

describe("promotion is scarce", () => {
  it("most of the essay is spoken and not shown", () => {
    const p = allocate(ir(), null);
    // The whole point. A film that promotes every sentence has promoted
    // nothing: the level-4 statement only takes over the screen because
    // the minute around it did not.
    expect(shown(p).length).toBeLessThan(p.length);
    expect(p.filter((x) => x.intensity === 0).length).toBeGreaterThan(0);
  });

  it("a level-4 statement is rare and is never a development paragraph", () => {
    const p = allocate(ir(), null);
    const major = p.filter((x) => x.intensity === 4);
    expect(major.length).toBeGreaterThan(0);
    expect(major.length).toBeLessThanOrEqual(4);
    for (const m of major) {
      expect(["TITLE", "THESIS", "DIAGNOSTIC", "CONCLUSION", "STANDARD"]).toContain(m.role);
    }
  });

  it("the same essay always promotes the same moments", () => {
    expect(promotedLines(allocate(ir(), null))).toEqual(promotedLines(allocate(ir(), null)));
  });
});

describe("promotion never invents", () => {
  it("every promoted span is literally in the essay", () => {
    const film = ir();
    for (const p of shown(allocate(film, null))) {
      // The same standard a figure is held to. What appears on screen is
      // something the essay actually says — checkable by the person who
      // wrote it, without trusting the compiler.
      expect(film.essay).toContain(textOf(p)?.text);
    }
  });

  it("the title is the essay's own, without its markdown", () => {
    const p = allocate(ir(), null);
    const title = p.find((x) => x.role === "TITLE");
    expect(title ? textOf(title)?.text : null).toBe("The Logic Costume");
    // A title competes with nothing — a film withholding its own name to
    // save a slot for a sentence would be the scarcity rule misapplied.
    expect(title?.intensity).toBe(4);
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
    const body = allocate(parsed.ir, null).filter((x) => x.role !== "TITLE");
    expect(body.every((x) => x.intensity < 3)).toBe(true);
  });
});

describe("a claim split across a full stop is one claim", () => {
  it("a denial and its assertion are promoted together or not at all", () => {
    const p = allocate(ir(), null);
    const t = promotedLines(p);
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
    const t = promotedLines(allocate(film, null));
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

  /* THE CAPABILITY, not the fixture's shape.
   *
   * This used to name one sentence and assert it was promoted, which made
   * it a claim about which scenes the allocator picks rather than about
   * timing. When the budget started coming off measured runtime the
   * fixture — thirty seconds, ten scenes, three anchors — stopped
   * including that particular line, and the test failed for a reason that
   * had nothing to do with what it was testing.
   *
   * What matters is: a promoted phrase is timed to ITS OWN words, not to
   * the top of the scene a proportional guess would give it. So: ask the
   * allocator what it promoted, hand THAT scene a recording, and check
   * the phrase lands where its words were actually spoken. */
  it("a promoted phrase lands on its own measured words", async () => {
    const film = ir();
    const dry = await compile(film);
    const anchor = dry.interventions.find((p) => p.intensity > 0 && (textOf(p)?.offset ?? -1) >= 0);
    if (!anchor) throw new Error("nothing promoted — the allocator has stopped allocating");
    const scene = film.scenes.find((s) => s.sceneId === anchor.sceneId);
    if (!scene) throw new Error("fixture changed");

    // 400ms per word, so a phrase starting at word N is spoken at N×400.
    const spoken = scene.narration.text.split(/\s+/);
    const before = scene.narration.text
      .slice(0, textOf(anchor)?.offset ?? -1)
      .split(/\s+/)
      .filter(Boolean).length;

    const report = await compile(film, {
      alignments: new Map([[scene.sceneId, aligned(scene.sceneId, spoken)]]),
    });
    const p = report.interventions.find((x) => x.sceneId === scene.sceneId);
    expect(p?.intensity).toBeGreaterThan(0);
    expect(p?.window?.measured).toBe(true);
    // The whole reason the words were frozen: not the scene's start.
    expect(p?.window?.startMs).toBe(before * 400);
  });

  it("an unmeasured scene falls back to its window and says so", async () => {
    const report = await compile(ir());
    for (const p of report.interventions.filter((x) => x.intensity > 0)) {
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
      const p = report.interventions.find((x) => x.sceneId === scene.sceneId);
      if (p?.intensity === 0) expect(scene.phrase.text).toBe("");
      else expect(scene.phrase.text).toBe(p ? (textOf(p)?.text ?? "") : "");
    }
    // And the film as a whole shows far less than it says.
    const withText = report.composed.filter((s) => s.phrase.text.length > 0);
    expect(withText.length).toBeLessThan(report.composed.length);
  });
});

/* THE BUDGET IS SPENT ACROSS THE FILM, NOT MERELY CAPPED.
 *
 * The allocator ranked every claim by score and took the top N. Scene
 * order was the tiebreak and nothing else consulted position, so the
 * quota said how MANY anchors a film could have and nothing about WHERE
 * — and since an argument puts its title and its thesis at the front,
 * that is where they went. Measured before this: seven of ten anchors
 * inside the first 40%, and nothing at all between 39% and 83%.
 *
 * These assert the DISTRIBUTION. A count alone cannot tell the two
 * behaviours apart, which is why the front-loading survived a test suite
 * that already checked scarcity. */
describe("the visual budget is distributed across the runtime", () => {
  const ESSAY = `The Costume

A claim to authority is a live, continuously-renewed performance. It is renewed in public. Nobody audits the renewal.

The fallacy isn't a lapse. It's a diagnosis.

Logic was never really being tested. It was being displayed as a brand.

When reality stops cooperating the brand has two options: concede, or manufacture the win.

Given a live audience and a persona built on winning, the manufacture option wins almost every time. Not through conscious deception, usually. Through the ordinary mechanism of motivated reasoning under identity threat.

The record can show this. A single clip cannot.

Total spend reached $282,345.84 across 2024-2025. Peak occupancy reached 7,000 people in July 2023.

Exposure, not corruption. The position doesn't produce more distortion. It produces the only distortion anyone can catch.`;

  const anchors = () => {
    const seed = segmentEssay(ESSAY, { projectId: "p" });
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("bad IR");
    const promotions = allocate(parsed.ir);
    const total = parsed.ir.scenes.length;
    return promotions.map((p, i) => ({ ...p, at: i / total })).filter((p) => p.intensity > 0);
  };

  it("reaches the last third of the film", () => {
    const late = anchors().filter((a) => a.at >= 0.66);
    expect(late.length, "no anchor in the final third").toBeGreaterThan(0);
  });

  it("does not spend most of the budget on the opening", () => {
    const all = anchors();
    const early = all.filter((a) => a.at < 0.4);
    expect(early.length / all.length).toBeLessThan(0.7);
  });

  it("puts an anchor in every third", () => {
    const all = anchors();
    for (const [lo, hi, name] of [
      [0, 1 / 3, "first"],
      [1 / 3, 2 / 3, "middle"],
      [2 / 3, 1.01, "last"],
    ] as const) {
      expect(
        all.some((a) => a.at >= lo && a.at < hi),
        `${name} third carries no anchor`,
      ).toBe(true);
    }
  });

  /* A band that has nothing worth showing yields nothing, so the count is
   * a CEILING rather than a target. The re-offer pass fills an unspent
   * slot only from a claim strong enough to have carried a band on its
   * own — so a film still cannot end up with an anchor on every scene. */
  it("stays scarce — the ceiling holds and most of the film is spoken", () => {
    const seed = segmentEssay(ESSAY, { projectId: "p" });
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("bad IR");
    const promotions = allocate(parsed.ir);
    const shown = promotions.filter((p) => p.intensity > 0).length;
    expect(shown).toBeLessThan(promotions.length * 0.6);
  });

  /* The budget follows how long the film LASTS, not how many sentences it
   * was cut into. Two essays with the same scene count and twice the
   * runtime between them were getting the same number of anchors. */
  it("takes its budget from measured runtime when there is one", () => {
    const seed = segmentEssay(ESSAY, { projectId: "p" });
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error("bad IR");
    const scenes = parsed.ir.scenes.map((s, i) => ({
      sceneId: s.sceneId,
      startMs: i * 1000,
      endMs: i * 1000 + 1000,
      durationMs: 1000,
      source: "measured" as const,
      leadPauseMs: 0,
      wordsPerMin: 140,
      relativeRate: 1,
      words: [],
    }));
    const short = allocate(parsed.ir, {
      totalMs: 40_000,
      measuredMs: 40_000,
      scenes,
      pauses: [],
      medianWordsPerMin: 140,
      spine: "measured",
      wordTimedScenes: scenes.length,
      describes: "test",
    });
    const long = allocate(parsed.ir, {
      totalMs: 400_000,
      measuredMs: 400_000,
      scenes,
      pauses: [],
      medianWordsPerMin: 140,
      spine: "measured",
      wordTimedScenes: scenes.length,
      describes: "test",
    });
    expect(short.filter((p) => p.intensity > 0).length).toBeLessThan(
      long.filter((p) => p.intensity > 0).length,
    );
  });
});
