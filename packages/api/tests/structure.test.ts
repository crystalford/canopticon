// The site's four sections, in one order everywhere (2026-11-24): Theories
// (the idea) · Writing (the argument: essays and papers) · Research (the
// evidence: reports, and the briefs written from them) · Lexicon (the words),
// with open questions beside the Lexicon. Papers keep their own address, and
// the McLuhan series its page at /papers.

import { describe, expect, it } from "vitest";
import app from "../src/index";
import { allArticles, allPapers, libraryItems } from "../src/site/content/store";

const env = { LOG_LEVEL: "error" };
const get = (path: string) => app.fetch(new Request(`http://test${path}`), env);
const SECTIONS = ["/theories", "/writing", "/research", "/lexicon"];

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
    expect(order(foot).slice(0, 4)).toEqual(SECTIONS);
  });

  it("each answers on its own address, and the old ones land there", async () => {
    for (const p of [...SECTIONS, "/open", "/papers"]) expect((await get(p)).status, p).toBe(200);
    for (const [from, to] of [
      ["/ideas", "/lexicon"],
      ["/articles", "/writing"],
      ["/investigations", "/research?kind=Investigation"],
      ["/briefs", "/research?kind=Brief"],
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

  it("Writing holds the essays and papers; Research holds the reports and briefs", async () => {
    const count = (k: string) => libraryItems().filter((r) => r.kind === k).length;
    const writing = await (await get("/writing")).text();
    expect(writing).toContain(`Essays<span class="n">${count("Essay")}</span>`);
    expect(writing).toContain(`Papers<span class="n">${count("Paper")}</span>`);
    expect(writing).not.toContain("Briefs<span");
    const research = await (await get("/research")).text();
    expect(research).toContain(`Briefs<span class="n">${count("Brief")}</span>`);
    expect(writing + research).not.toMatch(/class="pill[^"]*"[^>]*>Article</);
  });

  it("a brief lights up Research in the top bar, an essay or paper Writing", async () => {
    const cur = (html: string) =>
      /<nav aria-label="Primary"[^]*?<a href="(\/[a-z]+)" aria-current="page"/.exec(html)?.[1];
    const brief = allArticles().find((a) => a.form === "Brief" && !a.withdrawn);
    const essay = allArticles().find((a) => a.form === "Essay" && !a.withdrawn);
    expect(cur(await (await get(`/articles/${brief?.slug}`)).text())).toBe("/research");
    expect(cur(await (await get(`/articles/${essay?.slug}`)).text())).toBe("/writing");
    expect(cur(await (await get("/papers/krasis")).text())).toBe("/writing");
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
