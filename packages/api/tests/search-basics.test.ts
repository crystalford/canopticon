// What a search result shows, checked across the whole sitemap (2026-11-24):
// no two pages share a <title>, a research document describes itself in its
// own words, and every hand-built term belongs to the Lexicon's set.

import { describe, expect, it } from "vitest";
import app from "../src/index";
import { firstProse } from "../src/site/pages/document";

const env = { LOG_LEVEL: "error" };
const get = (path: string) => app.fetch(new Request(`http://test${path}`), env);
const titleOf = (h: string) => /<title>([^<]*)<\/title>/.exec(h)?.[1] ?? "";
const descOf = (h: string) => /<meta name="description" content="([^"]*)"/.exec(h)?.[1] ?? "";

describe("search results", () => {
  it("no two pages in the sitemap share a title, and none describes itself by a label", async () => {
    const sm = await (await get("/sitemap.xml")).text();
    const paths = [
      ...new Set(
        [...sm.matchAll(/<loc>https:\/\/canopticon\.com([^<]*)<\/loc>/g)].map((m) => m[1] || "/"),
      ),
    ];
    const seen = new Map<string, string>();
    for (const p of paths) {
      const h = await (await get(p)).text();
      const t = titleOf(h);
      expect(seen.get(t), `${p} and ${seen.get(t)} share "${t}"`).toBeUndefined();
      seen.set(t, p);
      if (p.startsWith("/p/")) expect(descOf(h), p).not.toMatch(/^Research[\w ]* · /);
    }
  }, 120_000);

  it("a coined term's page and the paper that coined it are titled apart", async () => {
    const concept = titleOf(await (await get("/concepts/heterocrasis")).text());
    const paper = titleOf(await (await get("/articles/heterocrasis")).text());
    expect(concept).toBe("Heterocrasis: meaning and origin · Canopticon");
    expect(paper).not.toBe(concept);
  });

  it("a document with no summary block is described by its first paragraph of prose", () => {
    const body =
      "Research brief · Housing\n\n## Scope\n\n- one\n- two\n\n| a | b |\n|---|---|\n\nStarts fell sharply in 2025 across the region, the steepest drop since the 1990s recession by most counts.";
    expect(firstProse(body)).toMatch(/^Starts fell sharply/);
  });

  it("hand-built terms are in the Lexicon's set and the hand-built problem is a Question", async () => {
    for (const slug of ["cpai", "the-overhearer"]) {
      const h = await (await get(`/concepts/${slug}`)).text();
      expect(h).toContain('"inDefinedTermSet":{"@id":"https://canopticon.com/lexicon#set"}');
    }
    expect(await (await get("/open/hot-coffee-whey")).text()).toContain('"@type":"Question"');
  });
});
