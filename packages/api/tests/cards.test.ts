// Entries (2026-11-28): cards open with a drawing of the idea (a theory's
// loop, a method's track), terms are set like a dictionary entry, and rows
// carry one complete line and a quiet line of facts. No
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

  it("theory cards draw their loop, way out and grades", async () => {
    const html = await page("/theories");
    expect(html).toContain('class="card fc"');
    expect(html).toContain('<svg class="rg"');
    expect(html).toContain("Way out");
    expect(html).toContain('class="gb-bar"');
    expect(html).not.toContain("th-card");
    // Each card's arrowheads are its own.
    const ids = [...html.matchAll(/<marker id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("method cards draw a track from what they take to what they give", async () => {
    const html = await page("/methods");
    expect(html).toContain('class="tk"');
    expect(html).not.toContain("Use it</span>");
  });

  it("term cards are set like a dictionary entry", async () => {
    const html = await page("/lexicon");
    expect(html).toContain('class="card tw"');
    expect(html).toContain('class="tw-et"');
    expect(html).not.toContain("term-card");
  });

  it("library rows are not numbered", async () => {
    const html = await page("/writing");
    expect(html).not.toContain("lib-rank");
    expect(html).toContain('class="e-meta"');
  });
});
