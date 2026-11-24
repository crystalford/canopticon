// The site's sections, in one order everywhere (2026-11-24): Theories ·
// Papers · Writing · Research · Lexicon, with open questions beside the
// Lexicon. Writing holds two forms — essays argue an idea of the author's,
// briefs answer one question from the evidence — and papers have their own
// address.

import { describe, expect, it } from "vitest";
import app from "../src/index";
import { allArticles, allPapers, libraryItems } from "../src/site/content/store";

const env = { LOG_LEVEL: "error" };
const get = (path: string) => app.fetch(new Request(`http://test${path}`), env);
const SECTIONS = ["/theories", "/papers", "/writing", "/research", "/lexicon"];

describe("the sections", () => {
  it("run in one order in the top bar, the footer and the front page", async () => {
    const html = await (await get("/")).text();
    const order = (part: string) =>
      [...part.matchAll(/href="(\/[a-z]+)"/g)]
        .map((m) => m[1])
        .filter((h) => SECTIONS.includes(h ?? ""));
    const top = html.slice(
      html.indexOf('aria-label="Primary"'),
      html.indexOf("</nav>", html.indexOf('aria-label="Primary"')),
    );
    expect(order(top)).toEqual(SECTIONS);
    const strip = html.slice(
      html.indexOf('class="lad"'),
      html.indexOf("</nav>", html.indexOf('class="lad"')),
    );
    expect(order(strip)).toEqual(SECTIONS);
    const foot = html.slice(html.indexOf('aria-label="Footer"'));
    expect(order(foot).slice(0, 5)).toEqual(SECTIONS);
  });

  it("each answers on its own address, and the old ones land there", async () => {
    for (const p of [...SECTIONS, "/open"]) expect((await get(p)).status, p).toBe(200);
    for (const [from, to] of [
      ["/ideas", "/lexicon"],
      ["/articles", "/writing"],
      ["/investigations", "/research?kind=Investigation"],
    ]) {
      const res = await get(from as string);
      expect(res.headers.get("location"), from).toBe(to);
    }
  });
});

describe("writing", () => {
  it("every article is an essay or a brief, and its Library row says the same", () => {
    const rows = new Map(libraryItems().map((r) => [r.route, r]));
    for (const a of allArticles()) {
      expect(["Essay", "Brief"]).toContain(a.form);
      const row = rows.get(`/articles/${a.slug}`);
      if (row && row.kind !== "Project") expect(row.kind, a.slug).toBe(a.form);
    }
  });

  it("the Writing page counts both forms and nothing labels itself an article", async () => {
    const html = await (await get("/writing")).text();
    const essays = libraryItems().filter((r) => r.kind === "Essay").length;
    const briefs = libraryItems().filter((r) => r.kind === "Brief").length;
    expect(html).toContain(`Essays<span class="n">${essays}</span>`);
    expect(html).toContain(`Briefs<span class="n">${briefs}</span>`);
    expect(html).not.toMatch(/class="pill[^"]*"[^>]*>Article</);
  });
});

describe("papers", () => {
  it("live at /papers/, are all on the Papers page, and the old address redirects", async () => {
    const html = await (await get("/papers")).text();
    for (const p of allPapers()) {
      expect(html).toContain(`href="/papers/${p.slug}"`);
      const old = await get(`/articles/${p.slug}`);
      expect(old.status).toBe(301);
      expect(old.headers.get("location")).toBe(`/papers/${p.slug}`);
      expect((await get(`/papers/${p.slug}`)).status).toBe(200);
    }
  });
});
