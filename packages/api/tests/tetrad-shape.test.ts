// The tetrad as a Markdown shape (docs/the-record.md §1b).
//
// Four `##` headings — Enhances, Obsolesces, Retrieves, Reverses — in any
// order, and the page's 2×2 grid, its `about` and its `hasPart` all fall out
// of the file. Nothing calls a model; the parse IS the recognition.

import { describe, expect, it } from "vitest";
import app from "../src/index.ts";
import { looksLikeEssay, looksLikeTetrad, parseTetrad } from "../src/lib/essay";
import { essayTetradLd, pieceJsonLd } from "../src/public/machine";

const TETRAD = `# The smartphone

A tetrad on the pocket screen.

Every medium does four things at once.

## Reverses into
Anxiety and the compulsive check.

## Retrieves
The village: everyone within reach.

## Enhances
Reach, *speed*, and the always-on self.

- one
- two

## Obsolesces
The desk, the map, the wristwatch.

## Sources
1. McLuhan, M. Laws of Media. 1988.
`;

describe("parseTetrad", () => {
  it("recognises the four headings in any order", () => {
    const t = parseTetrad(TETRAD);
    expect(t).not.toBeNull();
    expect(t?.subject).toBe("The smartphone");
    expect(t?.dek).toBe("A tetrad on the pocket screen.");
    expect(t?.intro).toEqual(["Every medium does four things at once."]);
    expect(t?.quadrants.enhances).toContain("Reach, *speed*");
    expect(t?.quadrants.enhances).toContain("- two");
    expect(t?.quadrants.obsolesces).toBe("The desk, the map, the wristwatch.");
    expect(t?.quadrants.retrieves).toBe("The village: everyone within reach.");
    expect(t?.quadrants.reverses).toBe("Anxiety and the compulsive check.");
    expect(t?.sources).toEqual(["McLuhan, M. Laws of Media. 1988."]);
  });

  it("fails on three, on a fifth heading, and on a duplicate", () => {
    expect(parseTetrad(TETRAD.replace("## Obsolesces\n", ""))).toBeNull();
    expect(parseTetrad(`${TETRAD}\n## Notes\nmore\n`)).toBeNull();
    expect(parseTetrad(TETRAD.replace("## Retrieves", "## Enhances"))).toBeNull();
  });

  it("is case-insensitive and accepts 'Reverses' plain", () => {
    const t = parseTetrad(TETRAD.replace("## Reverses into", "## REVERSES").toLowerCase());
    expect(t).not.toBeNull();
  });

  it("looksLikeTetrad, and is not an essay by the question rule", () => {
    expect(looksLikeTetrad(TETRAD)).toBe(true);
    expect(looksLikeEssay(TETRAD)).toBe(false);
    expect(looksLikeTetrad("# T\n\n## What is it?\nx\n\n## Why?\ny\n")).toBe(false);
  });
});

const PIECE = {
  id: "p1",
  slug: "the-smartphone",
  title: "The smartphone",
  subtitle: "A tetrad on the pocket screen.",
  kind: "essay",
  subtype: null,
  publication_status: "published",
  byline: null,
  published_at: "2026-09-14T00:00:00.000Z",
  signed_by: null,
  body_md: TETRAD,
  body_html: null,
  chain_id: null,
  tags: "[]",
  metadata: JSON.stringify({ classification: "tetrad" }),
  argument_summary_md: null,
  created_at: "2026-09-14T00:00:00.000Z",
  updated_at: "2026-09-14T00:00:00.000Z",
};

function makeDb(): D1Database {
  const mk = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        bound = args;
        return stmt;
      },
      async first() {
        if (/FROM users/i.test(sql)) return { id: "u1" };
        if (/FROM pieces WHERE user_id = \? AND slug = \?/i.test(sql)) {
          return bound[1] === PIECE.slug ? PIECE : null;
        }
        if (/COUNT\(\*\)/i.test(sql)) return { n: 0 };
        return null;
      },
      async all() {
        return { results: [] };
      },
      async run() {
        return { results: [], meta: { changes: 0 } };
      },
    };
    return stmt;
  };
  return {
    prepare: (sql: string) => mk(sql),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

const env = { ANTHROPIC_API_KEY: "test", LOG_LEVEL: "error", DB: makeDb() };

describe("the tetrad page", () => {
  it("renders section.tetrad with four cells and no FAQ markup", async () => {
    const res = await app.fetch(new Request("http://test/p/the-smartphone"), env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<section class="tetrad"/);
    expect(html.match(/class="tetrad-cell"/g)).toHaveLength(4);
    for (const id of ["enhances", "obsolesces", "retrieves", "reverses"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("Reverses into");
    expect(html).toContain("<em>speed</em>");
    expect(html).toContain("<li>two</li>");
    expect(html).toContain("Every medium does four things at once.");
    expect(html).not.toContain("FAQPage");
    expect(html).not.toContain("In this essay");
    // Structured data: what it is about, and its four named parts.
    expect(html).toContain('"about":[{"@type":"Thing","name":"The smartphone"}]');
    expect(html).toContain('"@type":"WebPageElement","name":"Enhances"');
    expect(html).toContain("https://canopticon.com/p/the-smartphone#reverses");
    // Sources still list.
    expect(html).toContain("Laws of Media");
    // Nothing on the page needs JS.
    expect(html).not.toMatch(/<script(?![^>]*application\/ld\+json)[^>]*>/);
  });

  it("emits hasPart for the four quadrants and no FAQ", () => {
    const ld = pieceJsonLd(PIECE as never, { tetrad: essayTetradLd(TETRAD) });
    expect(ld).toContain('"hasPart":[');
    expect((ld.match(/"WebPageElement"/g) ?? []).length).toBe(4);
    expect(ld).not.toContain("FAQPage");
  });
});
