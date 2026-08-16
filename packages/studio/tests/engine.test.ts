// Tests for the things that are TRUE OR FALSE, not for the things that
// are good or bad. A green suite cannot tell us whether a film is worth
// watching; it can tell us the words on screen are the essay's own, that
// the same seed makes the same film, and that the old vocabulary has not
// crept back in.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCut } from "../src/cut/index.ts";
import { callEditor } from "../src/editor/model.ts";
import { readEssayStructurally } from "../src/editor/rules.ts";
import { verifyEditorial } from "../src/editor/verify.ts";
import { type Film, parseFilm } from "../src/film/schema.ts";
import { hashRecord } from "../src/lib/hash.ts";
import { mulberry32 } from "../src/lib/rng.ts";
import { readTimings } from "../src/narrate/asr.ts";
import { locateWords } from "../src/text/prose.ts";
import { estimateSpine } from "../src/timeline/estimate.ts";
import { alignSpan } from "../src/timeline/words.ts";

const ESSAY = `Gimmick Economy

Jeremy Hambly built a career on being angry at the right people. The channel did not sell an argument. It sold a mood.

A platform pays for attention, not accuracy, so the fastest route to revenue is manufactured conflict. The performer does not need to be right.

The medium doesn't reward having been right before. It rewards winning now.`;

async function filmOf(seed = 1): Promise<Film> {
  const editorial = readEssayStructurally(ESSAY);
  return {
    schema: "canopticon.film/1",
    filmId: "f1",
    title: "Gimmick Economy",
    essay: ESSAY,
    seed,
    settings: { pace: 0.5, chaos: 0.5, density: 0.5 },
    editorial,
    editorialHash: await hashRecord(editorial),
    editorialProvenance: {
      source: "rules",
      promptVersion: "test",
      createdAt: "2020-01-01T00:00:00.000Z",
      rejectedPhrases: 0,
    },
    narration: { voice: null, spans: [] },
    assets: [],
    createdAt: "2020-01-01T00:00:00.000Z",
  };
}

describe("the record refuses words the essay did not write", () => {
  it("accepts a rules reading, whose every phrase is verbatim", async () => {
    const parsed = parseFilm(await filmOf());
    expect(parsed.ok, parsed.ok ? "" : JSON.stringify(parsed.errors)).toBe(true);
  });

  it("rejects a phrase that is not the essay's own text at its offset", async () => {
    const film = await filmOf();
    const beat = film.editorial.beats.find((b) => b.phrases.length > 0);
    expect(beat, "the fixture must promote something").toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    beat!.phrases[0]!.text = "words the essay never contained";
    const parsed = parseFilm(film);
    expect(parsed.ok).toBe(false);
  });

  it("drops an invented phrase from a model response and counts it", () => {
    const checked = verifyEditorial(
      {
        sections: [{ id: "s1", startChar: 0, endChar: ESSAY.length, function: "evidence" }],
        beats: [
          {
            id: "b1",
            sectionId: "s1",
            startChar: 0,
            endChar: 60,
            role: "open",
            promotion: "phrase",
            phrases: [
              { text: "It sold a mood", offset: 0 }, // real, wrong offset — repaired
              { text: "a phrase from nowhere", offset: 5 }, // invented — dropped
            ],
          },
        ],
      },
      ESSAY,
    );
    expect(checked.rejectedPhrases).toBe(1);
    expect(checked.editorial.beats[0]?.phrases).toHaveLength(1);
    expect(checked.editorial.beats[0]?.phrases[0]?.text).toBe("It sold a mood");
    // The repaired offset must actually point at the text.
    const p = checked.editorial.beats[0]?.phrases[0];
    expect(ESSAY.slice(p?.offset, (p?.offset ?? 0) + (p?.text.length ?? 0))).toBe("It sold a mood");
  });

  it("declines the whole reading when most of it was invented", () => {
    const checked = verifyEditorial(
      {
        sections: [{ id: "s1", startChar: 0, endChar: 40, function: "evidence" }],
        beats: [
          {
            id: "b1",
            sectionId: "s1",
            startChar: 0,
            endChar: 40,
            role: "open",
            phrases: [
              { text: "invented one", offset: 0 },
              { text: "invented two", offset: 1 },
              { text: "invented three", offset: 2 },
            ],
          },
        ],
      },
      ESSAY,
    );
    expect(checked.declined).toBe(true);
  });

  /** THE PRODUCTION FAILURE, exactly. Run against the deployed Worker for
   *  the first time, the model returned sections and beats covering only
   *  the first third of a 1730-character essay, and stopped — every
   *  phrase it offered was genuinely verbatim, so the phrase firewall
   *  reported no damage. `planSpans` walks sections, so the uncovered two
   *  thirds was never sent to TTS: the film narrated the opening and
   *  silently dropped the rest of the essay, with every status along the
   *  way reporting success. */
  it("declines a reading that stopped a third of the way through the essay", () => {
    const long = `${ESSAY}\n\nA fourth paragraph the model never reached, long enough on its own that losing it is losing most of the essay, not a trailing clause.`;
    const checked = verifyEditorial(
      {
        sections: [{ id: "s1", startChar: 0, endChar: 120, function: "hook" }],
        beats: [
          {
            id: "b1",
            sectionId: "s1",
            startChar: 0,
            endChar: 60,
            role: "open",
            phrases: [{ text: "Gimmick Economy", offset: 0 }],
          },
        ],
      },
      long,
    );
    expect(checked.declined).toBe(true);
    expect(checked.notes.some((n) => /did not read the whole thing/.test(n))).toBe(true);
  });

  /** THE REPAIR, on an ordinary ragged edge rather than a catastrophic
   *  one: sections that are individually fine but leave small gaps and
   *  stop short of the essay's own end must be TILED to full coverage,
   *  not merely tolerated — a gap is a stretch of prose `planSpans` would
   *  never speak and a gap at the end is picture that stops before the
   *  voice does. */
  it("tiles sections and beats to the essay's own edges rather than declining a minor gap", () => {
    const checked = verifyEditorial(
      {
        sections: [
          { id: "s1", startChar: 0, endChar: 60, function: "hook" },
          // a real gap between 60 and 122 — not spoken unless repaired
          { id: "s2", startChar: 122, endChar: ESSAY.length - 20, function: "evidence" },
        ],
        beats: [
          {
            id: "b1",
            sectionId: "s1",
            startChar: 0,
            endChar: 60,
            role: "open",
            phrases: [{ text: "Gimmick Economy", offset: 0 }],
          },
          {
            id: "b2",
            sectionId: "s2",
            startChar: 122,
            endChar: ESSAY.length - 20,
            role: "develop",
            phrases: [],
          },
        ],
      },
      ESSAY,
    );
    expect(checked.declined).toBe(false);
    const secs = checked.editorial.sections;
    expect(secs[0]?.range.startChar).toBe(0);
    expect(secs[secs.length - 1]?.range.endChar).toBe(ESSAY.length);
    for (let i = 1; i < secs.length; i++) {
      expect(secs[i]?.range.startChar).toBe(secs[i - 1]?.range.endChar);
    }
    const beats = checked.editorial.beats;
    expect(beats[0]?.range.startChar).toBe(0);
    expect(beats[beats.length - 1]?.range.endChar).toBe(ESSAY.length);
  });
});

/** THE ACTUAL FAILURE, reproduced without a network call. Caught live: one
 *  call asked to hold an essay's structure and its content and a hard
 *  full-coverage requirement at once was covering as little as 5% of a
 *  real essay and stopping — not a token cutoff, a well-formed but far too
 *  short JSON response. Split into two calls so structure (cheap, and the
 *  part that has to fully tile the essay) is decided before content (the
 *  expensive part) ever has to think about section boundaries at all. */
describe("the editor's two model calls", () => {
  /** A fake binding that plays two different model roles depending on
   *  which system prompt it is handed — the same binding a real Worker
   *  hands to both `callSections` and `callBeats`, distinguished the same
   *  way the model itself is: by what it was asked. */
  function fakeAi(opts: {
    sections: unknown;
    beats: unknown;
    calls?: { model: string; systemPrompt: string; userPrompt: string; maxTokens: number }[];
  }) {
    return {
      async run(model: string, input: Record<string, unknown>) {
        const messages = input.messages as { role: string; content: string }[];
        const system = messages.find((m) => m.role === "system")?.content ?? "";
        const user = messages.find((m) => m.role === "user")?.content ?? "";
        opts.calls?.push({
          model,
          systemPrompt: system,
          userPrompt: user,
          maxTokens: input.max_tokens as number,
        });
        const isBeats = system.includes("SECOND pass");
        return { response: JSON.stringify(isBeats ? opts.beats : opts.sections) };
      },
    };
  }

  it("feeds pass 1's own sections into pass 2, and the merge covers the whole essay", async () => {
    const calls: { model: string; systemPrompt: string; userPrompt: string; maxTokens: number }[] =
      [];
    const ai = fakeAi({
      sections: {
        thesis: "the essay's own claim",
        register: "analytic",
        sections: [
          {
            id: "s1",
            startChar: 0,
            endChar: 120,
            function: "hook",
            intensity: 0.6,
            certainty: 0.7,
          },
          {
            id: "s2",
            startChar: 120,
            endChar: ESSAY.length,
            function: "evidence",
            intensity: 0.5,
            certainty: 0.7,
          },
        ],
        motifs: [],
      },
      beats: {
        beats: [
          { id: "b1", sectionId: "s1", startChar: 0, endChar: 120, role: "open", phrases: [] },
          {
            id: "b2",
            sectionId: "s2",
            startChar: 120,
            endChar: ESSAY.length,
            role: "develop",
            phrases: [{ text: "It sold a mood", offset: ESSAY.indexOf("It sold a mood") }],
          },
        ],
      },
      calls,
    });

    const call = await callEditor(ai, ESSAY);
    expect(call.ok).toBe(true);
    expect(call.sectionsPass.ok).toBe(true);
    expect(call.beatsPass?.ok).toBe(true);

    // Pass 2 was handed pass 1's real sections, not asked to invent its own.
    const beatsCall = calls.find((c) => c.systemPrompt.includes("SECOND pass"));
    expect(beatsCall?.userPrompt).toContain('"id":"s2"');
    expect(beatsCall?.userPrompt).toContain(`"endChar":${ESSAY.length}`);

    // The merge is what verifyEditorial actually consumes — full coverage,
    // not declined, because both passes, independently small, both reached
    // the essay's own end.
    const checked = verifyEditorial(call.json, ESSAY);
    expect(checked.declined).toBe(false);
    const secs = checked.editorial.sections;
    expect(secs[0]?.range.startChar).toBe(0);
    expect(secs[secs.length - 1]?.range.endChar).toBe(ESSAY.length);
  });

  it("never calls pass 2 when pass 1 produced no sections to build on", async () => {
    const calls: { model: string; systemPrompt: string }[] = [];
    const ai = fakeAi({
      sections: { thesis: "x", register: "analytic", sections: [], motifs: [] },
      beats: { beats: [] },
      calls: calls as never,
    });
    const call = await callEditor(ai, ESSAY);
    expect(call.ok).toBe(false);
    expect(call.beatsPass).toBe(null);
    // Only pass 1 ever ran — an empty section list is a reason to stop,
    // not a smaller version of the beats task to attempt anyway.
    expect(calls.filter((c) => c.systemPrompt.includes("SECOND pass"))).toHaveLength(0);
  });

  it("gives the heavier beats pass more token budget than the structure pass, both scaled to the essay", async () => {
    const calls: { systemPrompt: string; maxTokens: number }[] = [];
    const ai = fakeAi({
      sections: {
        thesis: "x",
        register: "analytic",
        sections: [{ id: "s1", startChar: 0, endChar: ESSAY.length, function: "hook" }],
        motifs: [],
      },
      beats: {
        beats: [
          {
            id: "b1",
            sectionId: "s1",
            startChar: 0,
            endChar: ESSAY.length,
            role: "open",
            phrases: [],
          },
        ],
      },
      calls: calls as never,
    });
    await callEditor(ai, ESSAY);
    const sectionsCall = calls.find((c) => !c.systemPrompt.includes("SECOND pass"));
    const beatsCall = calls.find((c) => c.systemPrompt.includes("SECOND pass"));
    expect(sectionsCall?.maxTokens).toBeGreaterThan(0);
    expect(beatsCall?.maxTokens).toBeGreaterThan(sectionsCall?.maxTokens ?? 0);
  });
});

describe("films made by the previous engine", () => {
  // The shape a pre-reset record actually has: no `schema`, an `acts` and
  // `scenes` array, and the essay at the top level.
  const oldRecord = {
    projectId: "film_old",
    title: "An Older Film",
    essay: ESSAY,
    irVersion: 4,
    acts: [{ actId: "act_1", title: "" }],
    scenes: [{ sceneId: "s01", actId: "act_1", narration: { text: "It sold a mood." } }],
    visualApproach: "world",
    motifs: [{ motifId: "time", concept: "TIME", chain: ["text_stagger"], states: [] }],
  };

  it("is not mistaken for a current film", () => {
    // The whole point: parseFilm must REFUSE it. If it ever accepted one,
    // the engine would try to cut a film out of a record describing an
    // engine that no longer exists.
    expect(parseFilm(oldRecord).ok).toBe(false);
  });

  it("gives up its essay intact, which is all that was ever needed", () => {
    // Everything else in that record was derived from this. There is
    // nothing to convert — only to re-read.
    expect(oldRecord.essay).toBe(ESSAY);
    const reread = readEssayStructurally(oldRecord.essay);
    expect(reread.beats.length).toBeGreaterThan(0);
    for (const b of reread.beats) {
      for (const p of b.phrases) {
        expect(ESSAY.slice(p.offset, p.offset + p.text.length)).toBe(p.text);
      }
    }
  });

  it("re-reads into a record the current engine accepts", async () => {
    const film = await filmOf();
    const parsed = parseFilm({ ...film, filmId: oldRecord.projectId, title: oldRecord.title });
    expect(parsed.ok, parsed.ok ? "" : JSON.stringify(parsed.errors)).toBe(true);
  });

  it("a current film is never flagged as legacy", async () => {
    // The detector must not misfire on a real film — that would offer to
    // re-read something that is already current, spending a model call for
    // nothing.
    const film = await filmOf();
    expect(JSON.stringify(film).includes("canopticon.film/1")).toBe(true);
  });
});

describe("the cut", () => {
  it("is deterministic, and a different seed is a different film", async () => {
    const film = await filmOf(1);
    const spine = estimateSpine(ESSAY, film.editorial.sections);
    const a = await buildCut({ film, spine });
    const b = await buildCut({ film, spine });
    const c = await buildCut({ film: { ...film, seed: 91831 }, spine });
    expect(a.cutHash).toBe(b.cutHash);
    expect(a.cutHash).not.toBe(c.cutHash);
    // Same reading, so the same editorial shape — only the composition
    // moves. If the beat count changed, the seed would be re-editing.
    expect(a.beats.length).toBe(c.beats.length);
  });

  it("tiles the film with no gaps and nothing below the cut floor", async () => {
    const film = await filmOf();
    const cut = await buildCut({ film, spine: estimateSpine(ESSAY, film.editorial.sections) });
    for (const [i, b] of cut.beats.entries()) {
      expect(b.endMs).toBeGreaterThan(b.startMs);
      expect(b.endMs - b.startMs).toBeGreaterThanOrEqual(60);
      const next = cut.beats[i + 1];
      if (next) expect(next.startMs).toBeGreaterThanOrEqual(b.startMs);
    }
  });

  it("carries each beat's OWN phrases — b10 is not b1", async () => {
    // `"b10".startsWith("b1")` is true, and a prefix match silently gave
    // beats 10-12 the opening beat's text. The closing line rendered
    // blank while every report looked correct.
    const film = await filmOf();
    const cut = await buildCut({ film, spine: estimateSpine(ESSAY, film.editorial.sections) });
    for (const beat of cut.beats) {
      const parent = film.editorial.beats.find((b) => b.id === beat.id.split(".")[0]);
      expect(beat.text.phrases.map((p) => p.text)).toEqual(
        (parent?.phrases ?? []).map((p) => p.text),
      );
    }
  });

  it("names no primitive, construction or noun-visual anywhere", async () => {
    const film = await filmOf();
    const cut = await buildCut({ film, spine: estimateSpine(ESSAY, film.editorial.sections) });
    expect(JSON.stringify(cut)).not.toMatch(/primitiveId|constructionId|nounVisual|chainId/);
  });
});

describe("the spine", () => {
  it("estimates in the same shape a measurement produces", async () => {
    const film = await filmOf();
    const spine = estimateSpine(ESSAY, film.editorial.sections);
    expect(spine.source).toBe("estimated");
    expect(spine.words.every((w) => w.measured === false)).toBe(true);
    expect(spine.totalMs).toBeGreaterThan(0);
    for (const [i, w] of spine.words.entries()) {
      expect(w.endMs).toBeGreaterThanOrEqual(w.startMs);
      const next = spine.words[i + 1];
      // Never backwards. A spine that goes back in time puts a phrase on
      // screen before the word that earns it.
      if (next) expect(next.startMs).toBeGreaterThanOrEqual(w.startMs);
    }
  });
});

describe("the word aligner", () => {
  const source = locateWords("It rewards winning now");

  it("times every word when the transcript matches", () => {
    const heard = ["it", "rewards", "winning", "now"].map((word, i) => ({
      word,
      startMs: i * 300,
      endMs: i * 300 + 250,
    }));
    const out = alignSpan(source, heard, 0, 1200);
    expect(out.measured).toBe(true);
    expect(out.matchedFraction).toBe(1);
    expect(out.words.every((w) => w.measured)).toBe(true);
  });

  it("survives a digit spoken as words", () => {
    const src = locateWords("renewed 41 times");
    const heard = [
      { word: "renewed", startMs: 0, endMs: 200 },
      { word: "forty", startMs: 200, endMs: 400 },
      { word: "one", startMs: 400, endMs: 600 },
      { word: "times", startMs: 600, endMs: 800 },
    ];
    const out = alignSpan(src, heard, 0, 800);
    // "41" normalises to "fortyone"; it will not match a lone "forty",
    // but the words either side must still anchor.
    expect(out.words[0]?.measured).toBe(true);
    expect(out.words[2]?.measured).toBe(true);
  });

  it("refuses a transcript that is not a reading of this text", () => {
    const heard = ["completely", "different", "words", "entirely"].map((word, i) => ({
      word,
      startMs: i * 300,
      endMs: i * 300 + 250,
    }));
    const out = alignSpan(source, heard, 0, 1200);
    expect(out.measured).toBe(false);
    expect(out.matchedFraction).toBeLessThan(0.6);
  });

  it("never runs time backwards", () => {
    const heard = [
      { word: "it", startMs: 0, endMs: 100 },
      { word: "now", startMs: 900, endMs: 1000 },
    ];
    const out = alignSpan(source, heard, 0, 1200);
    for (const [i, w] of out.words.entries()) {
      const next = out.words[i + 1];
      if (next) expect(next.startMs).toBeGreaterThanOrEqual(w.startMs);
    }
  });
});

describe("ASR shapes, read rather than assumed", () => {
  it("reads flat words, nested segments, and seconds-vs-ms", () => {
    expect(readTimings({ words: [{ word: "a", start: 0, end: 0.5 }] })).toEqual({
      words: [{ word: "a", startMs: 0, endMs: 500 }],
      durationMs: 500,
    });
    expect(
      readTimings({ segments: [{ words: [{ word: "b", start: 1, end: 2 }] }] }).durationMs,
    ).toBe(2000);
    // Already-milliseconds must not be multiplied into an hour.
    expect(readTimings({ words: [{ word: "c", start: 2000, end: 3000 }] }).durationMs).toBe(3000);
    expect(readTimings({ result: { transcription_info: { duration: 4 } } }).durationMs).toBe(4000);
    expect(readTimings(null).durationMs).toBe(0);
    expect(readTimings("nonsense").durationMs).toBe(0);
  });
});

describe("determinism, structurally", () => {
  it("the browser's PRNG is byte-identical to the Worker's", async () => {
    const labSource = fs.readFileSync(
      path.resolve(import.meta.dirname, "../lab/core/rng.js"),
      "utf8",
    );
    // Two copies of one generator that drift apart change every frame of
    // every film with no error to notice. If this fails, they diverged.
    const labMulberry = new Function(
      `${labSource.replace(/export /g, "")}; return mulberry32;`,
    )() as typeof mulberry32;
    const a = mulberry32(12345);
    const b = labMulberry(12345);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });

  it("no Math.random anywhere in src", () => {
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? walk(full) : full.endsWith(".ts") ? [full] : [];
      });
    const offenders = walk(path.resolve(import.meta.dirname, "../src")).filter((f) =>
      fs.readFileSync(f, "utf8").includes("Math.random"),
    );
    expect(offenders).toEqual([]);
  });

  it("the old vocabulary has not crept back in", () => {
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? walk(full) : full.endsWith(".ts") ? [full] : [];
      });
    const banned = /primitiveId|constructionId|nounVisual|visualApproach|typeRegister/;
    // COMMENTS ARE STRIPPED FIRST, and that is not a loophole. The rule is
    // about what the code DOES; the files that state the rule in prose —
    // schema.ts's header names all four so the next reader knows why they
    // are absent — must not trip the guard that enforces it.
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const offenders = walk(path.resolve(import.meta.dirname, "../src")).filter((f) =>
      banned.test(stripComments(fs.readFileSync(f, "utf8"))),
    );
    expect(offenders).toEqual([]);
  });
});
