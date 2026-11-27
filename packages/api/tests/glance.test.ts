// The short version (2026-11-26): every theory, essay and paper opens with
// it — a few words, a formula, one sentence and thirty seconds said aloud —
// on the page, above the long version, and in the Markdown twin.

import { describe, expect, it } from "vitest";
import app from "../src/index";
import { allArticles, allPapers } from "../src/site/content/store";

const env = { LOG_LEVEL: "error" };
const get = (path: string) => app.fetch(new Request(`http://test${path}`), env);
const FIELDS = ["glance_words", "glance_formula", "glance_sentence", "glance_aloud"] as const;

describe("at a glance", () => {
  it("every essay and brief opens with its short version, above the thesis", async () => {
    const essays = allArticles();
    expect(essays.length).toBeGreaterThan(30);
    for (const a of essays) {
      for (const k of FIELDS) expect(a[k], `${a.slug} ${k}`).toBeTruthy();
      const html = await (await get(`/articles/${a.slug}`)).text();
      expect(html, a.slug).toContain('<section class="glance"');
      if (a.thesis)
        expect(html.indexOf('class="glance"')).toBeLessThan(
          html.indexOf("<strong>Thesis.</strong>"),
        );
      const md = await (await get(`/articles/${a.slug}.md`)).text();
      expect(md, a.slug).toContain("## At a glance");
    }
  });

  it("every paper opens with its short version, hand-built or not", async () => {
    for (const p of allPapers()) {
      for (const k of FIELDS) expect(p[k], `${p.slug} ${k}`).toBeTruthy();
      const html = await (await get(`/papers/${p.slug}`)).text();
      expect(html, p.slug).toContain('<section class="glance"');
      expect(html.indexOf('class="glance"')).toBeGreaterThan(html.indexOf("</h1>"));
      const md = await (await get(`/papers/${p.slug}.md`)).text();
      expect(md, p.slug).toContain("## At a glance");
    }
  });

  it("draws the formula's arrows and folds the thirty seconds", async () => {
    const html = await (await get("/articles/why-you-leave-it-for-the-morning")).text();
    expect(html).toContain('<span class="gl-arrow" aria-hidden="true">→</span>');
    expect(html).toContain("<summary>Say it in thirty seconds</summary>");
  });
});
