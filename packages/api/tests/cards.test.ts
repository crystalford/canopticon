// Entries (2026-11-28): one card and one row across the site. A card is its
// title, one complete line, the one thing particular to its kind (a theory's
// or method's formula, a term's definition) and a quiet line of facts. No
// labels in capitals, no box inside the card, no pill where the section
// already names the kind, no numbers on lists that are not sequences.

import { describe, expect, it } from "vitest";
import app from "../src/index";
import { firstSentence, formulaHtml, metaLine } from "../src/site/pages/entry";

const env = { LOG_LEVEL: "error" };
const page = async (path: string) =>
  (await app.fetch(new Request(`http://test${path}`), env)).text();

describe("entry cards", () => {
  it("draws a formula's lines with arrows a screen reader hears as words", () => {
    const html = formulaHtml("a → b || c → d");
    expect(html.match(/class="fx-l"/g)?.length).toBe(2);
    expect(html).toContain('<span class="fx-a" aria-hidden="true">→</span>');
    expect(html).toContain("leads to");
  });

  it("joins facts with commas, never middle dots", () => {
    expect(metaLine(["9 sources · 6 min", "28 Nov"])).toBe(
      '<span class="e-meta">9 sources, 6 min, 28 Nov</span>',
    );
    expect(metaLine([undefined, false])).toBe("");
  });

  it("keeps a summary's first sentence whole", () => {
    expect(firstSentence("One thing. Another.")).toBe("One thing.");
    expect(firstSentence("No full stop here")).toBe("No full stop here");
  });

  it("theory and method cards carry a formula and no labelled boxes", async () => {
    for (const path of ["/theories", "/methods"]) {
      const html = await page(path);
      expect(html, path).toContain('class="card ec"');
      expect(html, path).toContain('class="fx"');
      expect(html, path).not.toContain("th-card");
    }
  });

  it("term cards say what a term means without a kind pill", async () => {
    const html = await page("/lexicon");
    expect(html).not.toContain("term-card");
    expect(html).toContain("First stated in");
  });

  it("library rows are not numbered", async () => {
    const html = await page("/writing");
    expect(html).not.toContain("lib-rank");
    expect(html).toContain('class="e-meta"');
  });
});
