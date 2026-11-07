// The engine test's bar, and the rule that only a Cloudflare engine is ever
// the remembered default.
import { describe, expect, it } from "vitest";
import { CLAUDE, DEFAULT_ENGINE, defaultEngine, setDefaultEngine } from "../src/write/engines";
import { BAR, EVAL_SET, grade } from "../src/write/eval";

describe("the engine test", () => {
  it("covers research of three kinds and an article", () => {
    expect(EVAL_SET.filter((t) => t.kind === "research")).toHaveLength(3);
    expect(EVAL_SET.filter((t) => t.kind === "article")).toHaveLength(1);
  });

  it("passes a report at the bar and names every miss below it", () => {
    const ok = {
      kind: "research" as const,
      finished: true,
      words: BAR.research.words,
      quotations: BAR.research.quotations,
      notFound: 0,
      unwritten: false,
      citations: 0,
      figuresNotInPages: 0,
      pages: BAR.research.pages,
    };
    expect(grade(ok)).toEqual({ pass: true, misses: [] });
    const bad = grade({ ...ok, words: 2000, notFound: 2, citations: 3, unwritten: true });
    expect(bad.pass).toBe(false);
    expect(bad.misses).toEqual([
      "parts left unwritten",
      `2000 words (bar ${BAR.research.words})`,
      "2 quotations not found",
      "3 citation problems",
    ]);
  });

  it("holds an article to what Publish would refuse", () => {
    const r = grade({
      kind: "article",
      finished: true,
      words: 1800,
      quotations: 12,
      notFound: 0,
      publishProblems: ["Its topic is not one of the record's topics."],
    });
    expect(r).toEqual({ pass: false, misses: ["Its topic is not one of the record's topics."] });
  });
});

describe("the remembered engine", () => {
  const db = (prefs: string | null) => {
    const writes: unknown[][] = [];
    return {
      writes,
      prepare: () => ({
        bind: (...p: unknown[]) => ({
          first: async () => ({ preferences: prefs }),
          run: async () => {
            writes.push(p);
            return {};
          },
        }),
      }),
    } as unknown as D1Database & { writes: unknown[][] };
  };

  it("is never Claude, so Claude runs only when chosen for a conversation", async () => {
    expect(await defaultEngine(db(JSON.stringify({ engine: CLAUDE })), "u")).toBe(DEFAULT_ENGINE);
    expect(await defaultEngine(db(JSON.stringify({ engine: "claude-sonnet-advised" })), "u")).toBe(
      DEFAULT_ENGINE,
    );
    const pro = "@cf/deepseek-ai/deepseek-v4-pro-0813";
    expect(await defaultEngine(db(JSON.stringify({ engine: pro })), "u")).toBe(pro);
    const d = db(null);
    await setDefaultEngine(d, "u", CLAUDE);
    expect(d.writes).toEqual([]);
    await setDefaultEngine(d, "u", pro);
    expect(d.writes).toHaveLength(1);
  });
});
