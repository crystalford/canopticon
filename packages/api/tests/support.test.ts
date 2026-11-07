// The support check: every cited sentence, one calibrated yes/no each.
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { citedSentences, probability, supportCheck } from "../src/write/support";

const body = [
  "## TL;DR",
  "Short [1].",
  "",
  "## Details",
  "",
  "### 1. How many?",
  "",
  "Manitoba signed in February 2025 [1]. Rents fell by half because of the ban [2].",
  "",
  "#### A subheading",
  "",
  "A sentence with no citation at all, which is not checked.",
  "",
  "### 2. Why?",
  "",
  "_(to write)_",
  "",
  "## Sources",
  "",
  "1. [A](https://a.example)",
  "2. [B](https://b.example)",
].join("\n");

const notes = [
  {
    n: 1,
    url: "https://a.example",
    quote: "Manitoba signed on 27 February 2025.",
    claim: "",
    section: 1,
  },
  { n: 2, url: "https://b.example", quote: "Rents fell 4 percent.", claim: "", section: 1 },
];

describe("the support check", () => {
  it("finds the cited sentences of the Details, not the summary or uncited ones", () => {
    expect(citedSentences(body).map((c) => [c.section, c.cites, c.sentence])).toEqual([
      [1, [1], "Manitoba signed in February 2025 [1]."],
      [1, [2], "Rents fell by half because of the ban [2]."],
    ]);
  });

  it("asks one question per sentence with the cited passages, and reads the answers", async () => {
    const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
    const env = {
      AI: {
        run: async (model: string, input: Record<string, unknown>) => {
          calls.push({ model, input });
          return {
            answers: { s1: { type: "noul", noul: 0.93 }, s2: { type: "noul", noul: 0.04 } },
          };
        },
      },
    } as unknown as Env;
    const r = await supportCheck(env, body, notes as never);
    expect(r.map((x) => [x.sentence.slice(0, 15), x.p])).toEqual([
      ["Manitoba signed", 0.93],
      ["Rents fell by h", 0.04],
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.model).toBe("@cf/cloudflare/clef-flash");
    const state = JSON.parse(String(calls[0]?.input.state));
    expect(state.evidence["[2]"]).toEqual(["Rents fell 4 percent."]);
    expect(Object.keys(calls[0]?.input.questions as object)).toEqual(["s1", "s2"]);
  });

  it("reads a probability however the answer is shaped, and nothing from nonsense", () => {
    expect(probability(0.3)).toBe(0.3);
    expect(probability({ p: 0.7 })).toBe(0.7);
    expect(probability("yes")).toBeNull();
  });
});
