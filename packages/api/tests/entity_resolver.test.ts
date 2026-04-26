import { describe, expect, it } from "vitest";
import { jaccardTokenSimilarity, normalize } from "../src/orchestrator/entity_resolver.ts";

describe("normalize", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalize("Brookfield Asset Management Inc.")).toBe("brookfield asset management inc");
  });

  it("strips diacritics via NFKD + combining-mark removal", () => {
    expect(normalize("Carney")).toBe("carney");
    expect(normalize("Pétain")).toBe("petain");
    expect(normalize("Québec")).toBe("quebec");
  });

  it("collapses whitespace", () => {
    expect(normalize("  Mark   Carney  ")).toBe("mark carney");
  });

  it("returns empty string for empty / pure-punctuation input", () => {
    expect(normalize("")).toBe("");
    expect(normalize("...---...")).toBe("");
  });
});

describe("jaccardTokenSimilarity", () => {
  it("returns 1 for identical normalized strings", () => {
    expect(jaccardTokenSimilarity("mark carney", "mark carney")).toBe(1);
  });

  it("returns 0 for disjoint token sets", () => {
    expect(jaccardTokenSimilarity("mark carney", "linda mcquaig")).toBe(0);
  });

  it("partial overlap yields fractional similarity", () => {
    // "mark carney" vs "mark carney jr": intersect=2, union=3 → 2/3
    expect(jaccardTokenSimilarity("mark carney", "mark carney jr")).toBeCloseTo(2 / 3, 4);
  });

  it("returns 0 for empty input on either side", () => {
    expect(jaccardTokenSimilarity("", "mark")).toBe(0);
    expect(jaccardTokenSimilarity("mark", "")).toBe(0);
    expect(jaccardTokenSimilarity("", "")).toBe(0);
  });
});
