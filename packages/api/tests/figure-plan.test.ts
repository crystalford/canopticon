// The figure plan (2026-11-28): one figure per move of the skeleton, drawn
// under its move on the page and listed in the Markdown twin. The same plan
// drives the short-maker (packages/shorts). A figure shows only what the
// piece says: cue words, quotations and numbers must be in its text (the
// build fails otherwise).

import { describe, expect, it } from "vitest";
import type { PlannedFigure } from "../src/site/content/store";
import { allArticles, allPapers } from "../src/site/content/store";
import { buildBlock, buildMarkdown, moves, planFigure } from "../src/site/pages/build";

// A piece of its own, so the drawing is tested whether or not a published
// piece carries a plan (the pilot essay was withdrawn on 2026-11-28).
const PLAN: PlannedFigure[] = [
  { move: 1, kind: "chain", data: "make|do", title: "Two words" },
  { move: 2, kind: "compare", data: "Meaning|kept || Wording|lost", hot: 1 },
  { move: 3, kind: "loop", data: "" },
];
const PIECE = {
  build: [
    { move: "Opening|One|" },
    { move: "Evidence|Two|1" },
    { move: "Method|Three" },
    { move: "So|Four" },
  ],
  figure_plan: PLAN,
  cycle: ["Handle|a", "Go deep|b", "Back up|c"],
};
const flat = (s: string) => s.replace(/[*_]/g, "").replace(/\s+/g, " ").toLowerCase();

describe("figure plan", () => {
  it("every figure names a real move and shows only what its piece says", () => {
    for (const p of [...allArticles(), ...allPapers()]) {
      const n = moves(p).length;
      const text = flat(p.body);
      for (const f of p.figure_plan ?? []) {
        expect(f.move, p.slug).toBeGreaterThanOrEqual(1);
        expect(f.move, p.slug).toBeLessThanOrEqual(n);
        if (f.kind === "chain")
          for (const w of f.data.split("|")) expect(text, `${p.slug}: ${w}`).toContain(w.trim());
        if (f.kind === "quote") expect(text, p.slug).toContain(flat(f.data));
        for (const num of f.data.match(/\d+(?:\.\d+)?/g) ?? []) expect(text).toContain(num);
      }
    }
  });

  it("draws each figure under its move, and lists it in the twin", () => {
    const html = buildBlock(PIECE);
    expect(html).toContain("How it's built · 4 moves · 3 figures");
    expect(html).toContain('<span class="fp fp-chain">');
    expect(html).toContain('<span class="fp-row hot"><span class="fp-l">Meaning</span>');
    expect(html).toContain('<span class="fp fp-loop">');
    expect(buildMarkdown(PIECE).join("\n")).toContain("   Figure (Two words): make → do");
  });

  it("escapes what it draws", () => {
    const html = planFigure({ move: 1, kind: "steps", data: "a <b> || c" });
    expect(html).toContain("a &lt;b&gt;");
    expect(html).not.toContain("<b>");
  });
});
