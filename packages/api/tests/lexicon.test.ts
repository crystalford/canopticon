// The term standard and the Lexicon (2026-11-23): every coined term carries a
// full entry, its page says it in the shape answer engines lift ("X is …"),
// the Lexicon is the DefinedTermSet the term pages point to, and one page owns
// each term.

import { describe, expect, it } from "vitest";
import app from "../src/index";
import { terms } from "../src/site/content/store";

const env = { LOG_LEVEL: "error" };
const get = (path: string) => app.fetch(new Request(`http://test${path}`), env);
const ldOf = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1] ?? "{}"),
  );

describe("the term standard", () => {
  it("every coined term opens its definition with its own name", () => {
    for (const t of terms()) {
      expect(t.definition?.toLowerCase().startsWith(t.title.toLowerCase())).toBe(true);
      expect(t.questions?.length).toBeGreaterThanOrEqual(2);
      expect(t.examples?.length).toBeGreaterThanOrEqual(2);
      expect(t.differs?.length).toBeGreaterThanOrEqual(1);
      expect(t.say && t.etymology && t.plain && t.coined && t.checked).toBeTruthy();
    }
  });

  it("a term page shows the full entry and points to the Lexicon's set", async () => {
    const res = await get("/concepts/heterocrasis");
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const h of ["Where the word comes from", "Questions it answers", "Examples", "How it differs from existing terms"])
      expect(html).toContain(h);
    expect(html).toContain("Pronounced <b>het-uh-ROK-ruh-sis</b>");
    expect(html).toContain('href="/lexicon#krasis"');
    expect(html).not.toContain("Name check pending");
    const term = ldOf(html).find((x) => x["@type"] === "DefinedTerm");
    expect(term["@id"]).toBe("https://canopticon.com/concepts/heterocrasis#term");
    expect(term.inDefinedTermSet["@id"]).toBe("https://canopticon.com/lexicon#set");
    expect(term.alternateName).toContain("a different starting mix of the senses");
    expect(term.description.startsWith("Heterocrasis is")).toBe(true);
  });
});

describe("the lexicon", () => {
  it("lists every theory and every coined term, grouped, as one DefinedTermSet", async () => {
    const res = await get("/lexicon");
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const id of ["theories", "krasis", "voice", "other"]) expect(html).toContain(`id="${id}"`);
    for (const t of terms()) expect(html).toContain(`href="${t.route}"`);
    const set = ldOf(html)[0]["@graph"].find((x: { "@type": string }) => x["@type"] === "DefinedTermSet");
    expect(set["@id"]).toBe("https://canopticon.com/lexicon#set");
    expect(set.hasDefinedTerm.length).toBeGreaterThanOrEqual(terms().length + 3);
  });

  it("has a Markdown twin, a sitemap entry and a line in llms.txt", async () => {
    const md = await (await get("/lexicon.md")).text();
    expect(md).toContain("# Lexicon");
    expect(md).toContain("**[Sensory syncrasis](https://canopticon.com/concepts/sensory-syncrasis)**");
    expect(await (await get("/sitemap.xml")).text()).toContain("https://canopticon.com/lexicon<");
    expect(await (await get("/llms.txt")).text()).toContain("https://canopticon.com/lexicon");
  });
});

describe("one page per term", () => {
  it("the old concept page for self-extinguishing maintenance sends readers to the theory", async () => {
    const res = await get("/concepts/self-extinguishing-maintenance");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/theories/self-extinguishing-maintenance");
  });
});
