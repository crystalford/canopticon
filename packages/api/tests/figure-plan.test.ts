// The figure plan (2026-11-28): one figure per move of the skeleton, drawn
// under its move on the page and listed in the Markdown twin. The same plan
// drives the short-maker (packages/shorts). A figure shows only what the
// piece says: cue words, quotations and numbers must be in its text (the
// build fails otherwise).

import { describe, expect, it } from "vitest";
import app from "../src/index";
import { allArticles, allPapers } from "../src/site/content/store";
import { moves, planFigure } from "../src/site/pages/build";

const env = { LOG_LEVEL: "error" };
const get = (path: string) => app.fetch(new Request(`http://test${path}`), env);
const flat = (s: string) => s.replace(/[*_]/g, "").replace(/\s+/g, " ").toLowerCase();

describe("figure plan", () => {
  it("the memory essay has a figure for every move", () => {
    const a = allArticles().find((x) => x.slug === "keep-three-words-rebuild-the-rest");
    expect(a?.figure_plan?.map((f) => f.move)).toEqual(moves(a ?? {}).map((_, i) => i + 1));
  });

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

  it("draws each figure under its move, and lists it in the twin", async () => {
    const html = await (await get("/articles/keep-three-words-rebuild-the-rest")).text();
    expect(html).toContain("How it's built · 9 moves · 9 figures");
    expect(html).toContain('<span class="fp fp-chain">');
    expect(html).toContain(
      '<span class="fp-row hot"><span class="fp-l">A change of meaning</span>',
    );
    expect(html).toContain('<span class="fp fp-loop">');
    const md = await (await get("/articles/keep-three-words-rebuild-the-rest.md")).text();
    expect(md).toContain("   Figure (Poiesis and praxis, in three words): make → do → end");
  });

  it("escapes what it draws", () => {
    const html = planFigure({ move: 1, kind: "steps", data: "a <b> || c" });
    expect(html).toContain("a &lt;b&gt;");
    expect(html).not.toContain("<b>");
  });
});
