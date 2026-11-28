// How an essay is built (2026-11-27): every essay carries its argument as a
// chain of moves — role, one line, what it rests on — shown on the page under
// the short version and in the Markdown twin. A move that rests on nothing
// cited says so, unless its role never needs a source.

import { describe, expect, it } from "vitest";
import app from "../src/index";
import { allArticles } from "../src/site/content/store";
import { moves } from "../src/site/pages/build";

const env = { LOG_LEVEL: "error" };
const get = (path: string) => app.fetch(new Request(`http://test${path}`), env);

describe("how an essay is built", () => {
  const essays = allArticles().filter((a) => a.form === "Essay");

  it("every essay has a skeleton of at least four moves", () => {
    expect(essays.length).toBeGreaterThan(15);
    for (const a of essays) {
      const ms = moves(a);
      expect(ms.length, a.slug).toBeGreaterThanOrEqual(4);
      for (const m of ms) {
        expect(m.role, a.slug).toBeTruthy();
        expect(m.text, a.slug).toBeTruthy();
      }
    }
  });

  it("shows the chain on the page, after the short version, and in the twin", async () => {
    for (const a of essays) {
      const html = await (await get(`/articles/${a.slug}`)).text();
      expect(html, a.slug).toContain('<details class="bld"');
      expect(html.indexOf('class="glance"')).toBeLessThan(html.indexOf('class="bld"'));
      const md = await (await get(`/articles/${a.slug}.md`)).text();
      expect(md, a.slug).toContain("## How it's built");
    }
  });

  it("marks a move that rests on nothing cited", async () => {
    const a = essays.find((e) => e.slug === "why-you-cant-see-your-own-addiction");
    expect(a).toBeTruthy();
    const html = await (await get(`/articles/${a?.slug}`)).text();
    expect(html).toContain("reasoned, no source");
  });
});
