// Spoken cards: a paper decanted into pieces of about a minute. The rules are
// the record's: every card names the passage it shortens, word for word, and
// the page links each card to that passage and says what it leaves out.

import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFrontMatter, parseSpoken, verbatimNormal } from "../scripts/build-content.mjs";
import app from "../src/index";
import { spokenCards } from "../src/site/content/store";

const env = { LOG_LEVEL: "error" };
const get = (path: string) => app.fetch(new Request(`http://test${path}`), env);

const FILES = readdirSync("content/spoken").filter((f) => f.endsWith(".md"));

describe("spoken cards", () => {
  it.each(FILES)("%s: every card's passage is in its paper word for word", (f) => {
    const { meta, body } = parseFrontMatter(readFileSync(`content/spoken/${f}`, "utf8"));
    const slug = String(meta.paper);
    const paper = parseFrontMatter(readFileSync(`content/papers/${slug}.md`, "utf8")).body;
    const whole = verbatimNormal(paper).replace(/\s+/g, " ");
    const cards = parseSpoken(body);
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      expect(c.from, c.title).not.toBe("");
      expect(whole).toContain(verbatimNormal(c.from).replace(/\s+/g, " "));
      expect(c.caveat, c.title).not.toBe("");
      // About a minute read aloud, never a lecture.
      expect(c.seconds, c.title).toBeLessThanOrEqual(75);
    }
  });

  it("reads From, Caveat and paragraphs, and drops author notes", () => {
    const [c] = parseSpoken(
      "<!-- a note -->\n## A title\n\nFrom: the passage.\nCaveat: what it leaves out.\n\nOne paragraph\nwrapped.\n\nTwo.\n",
    );
    expect(c?.title).toBe("A title");
    expect(c?.from).toBe("the passage.");
    expect(c?.caveat).toBe("what it leaves out.");
    expect(c?.paras).toEqual(["One paragraph wrapped.", "Two."]);
  });

  it("Krasis shows its cards before the back matter, each linked to its passage", async () => {
    const html = await (await get("/articles/krasis")).text();
    const cards = spokenCards("krasis");
    expect(cards.length).toBe(5);
    const at = html.indexOf('id="spoken"');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(html.indexOf("The papers in the series"));
    expect(html.match(/class="spoken-card"/g)?.length).toBe(5);
    expect(html).toContain('href="#q=');
    expect(html).toContain("<dt>Leaves out</dt>");
  });

  it("a paper with no cards is unchanged", async () => {
    const html = await (await get("/articles/typomora")).text();
    expect(html).not.toContain('id="spoken"');
  });
});

describe("versions", () => {
  it("Krasis says how it changed and links the version it replaced", async () => {
    const html = await (await get("/articles/krasis")).text();
    expect(html).toContain('id="versions"');
    expect(html).toContain('href="/articles/krasis/v1"');
    expect(html).not.toContain("Every extension is also an amputation</h3>");
    // How it changed comes before the cards, and both before the back matter.
    expect(html.indexOf('id="versions"')).toBeLessThan(html.indexOf('id="spoken"'));
  });

  it("version 1 is kept whole, says what it is, and carries no cards", async () => {
    const res = await get("/articles/krasis/v1");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Version 1 of 2.");
    expect(html).toContain("Every extension is also an amputation</h3>");
    expect(html).not.toContain('id="spoken"');
  });

  it("an unknown version is not a page", async () => {
    expect((await get("/articles/krasis/v9")).status).toBe(404);
  });
});
