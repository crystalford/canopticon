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
    const html = await (await get("/papers/krasis")).text();
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

describe("what changed", () => {
  it("diffs words inside a changed paragraph and leaves the rest equal", async () => {
    const { diffParagraphs } = await import("../src/site/diff");
    const blocks = diffParagraphs(
      "One.\n\nThe cost is amputation.\n\nThree.",
      "One.\n\nThe cost is reweighting.\n\nThree.",
    );
    expect(blocks.map((b) => b.kind)).toEqual(["same", "changed", "same"]);
    const changed = blocks[1] as Extract<(typeof blocks)[number], { kind: "changed" }>;
    expect(changed.removed).toBe(1);
    expect(changed.added).toBe(1);
  });

  it("a paper never revised has no changes page", async () => {
    expect((await get("/papers/krasis/changes")).status).toBe(404);
    expect((await get("/papers/krasis/v1")).status).toBe(404);
  });
});
