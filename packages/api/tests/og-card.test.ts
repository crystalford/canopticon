import { describe, expect, it } from "vitest";
import { libraryItems } from "../src/site/content/store";
import { cardPath } from "../src/site/layout";
import { cardFromItem, cardSvg, measure, siteCard, topicCard, wrap } from "../src/site/og/card";

describe("share card", () => {
  it("measures with Geist's own widths", () => {
    // Geist Regular: "i" is narrow, "W" is wide; widths are 1/1000 em.
    expect(measure("W", 100, "Regular")).toBeGreaterThan(measure("i", 100, "Regular") * 3);
    expect(measure("abc", 10, "Medium")).toBeCloseTo(measure("abc", 20, "Medium") / 2, 5);
  });

  it("wraps within the width and ends a cut line with an ellipsis", () => {
    const text = "one two three four five six seven eight nine ten eleven twelve";
    const lines = wrap(text, 40, "Regular", 300, 2);
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(measure(l, 40, "Regular")).toBeLessThanOrEqual(300);
    expect(lines[1]?.endsWith("…")).toBe(true);
    expect(wrap("short", 40, "Regular", 300, 2)).toEqual(["short"]);
  });

  it("draws every public row without an empty title and escapes its text", () => {
    for (const row of libraryItems()) {
      const svg = cardSvg(cardFromItem(row));
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).not.toMatch(/<text[^>]*><\/text>/);
      expect(svg).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/);
    }
    const svg = cardSvg({ ...siteCard(), title: 'A < B & "C"' });
    expect(svg).toContain("A &lt; B &amp; &quot;C&quot;");
  });

  it("says what the page carries that can be checked", () => {
    const article = libraryItems().find((i) => i.kind === "Article" && (i.quotes ?? 0) > 0);
    expect(article).toBeTruthy();
    expect(cardFromItem(article as never).stat).toMatch(/quotations checked word for word$/);
    expect(topicCard("Housing", 3).stat).toBe("3 in the record");
  });

  it("gives content pages their own card and everything else the record's", () => {
    expect(cardPath("/articles/krasis")).toBe("/card/articles/krasis.png");
    expect(cardPath("/p/some-doc?fresh=1")).toBe("/card/p/some-doc.png");
    expect(cardPath("/topics/housing")).toBe("/card/topics/housing.png");
    expect(cardPath("/library")).toBe("/card/index.png");
    expect(cardPath("/admin/write/x")).toBe("/card/index.png");
  });
});
