// The document page with readings and lineage (docs/the-record.md §5, §5c).
//
// "Read by the operator" is a claim, so it renders only when a readings row
// exists. Lineage renders both directions. The operator affordances appear
// only when the renderer is told the viewer is the operator.

import { describe, expect, it } from "vitest";
import type { PublicEnv } from "../src/public/data";
import {
  markReadingPassages,
  placeReadings,
  readingMark,
} from "../src/public/render/margin-readings";
import { renderMarkdown } from "../src/public/render/markdown";
import { renderPiece } from "../src/public/render/piece-template";

const PIECE = {
  id: "p1",
  slug: "housing-record",
  title: "Housing in the record",
  subtitle: null,
  kind: "research",
  subtype: null,
  publication_status: "published",
  byline: "Chris Telford",
  published_at: "2026-09-01T00:00:00Z",
  signed_by: null,
  body_md:
    "# Housing in the record\n\nProvincial health spending grew 4.8 percent over the same period, outpacing the transfer escalator of 3.0 percent set in 2023.\n",
  body_html: null,
  chain_id: null,
  tags: "[]",
  metadata: "{}",
  argument_summary_md: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const READING = {
  id: "r1",
  quote_id: "q1",
  verbatim_text:
    "Provincial health spending grew 4.8 percent over the same period, outpacing the transfer escalator of 3.0 percent set in 2023.",
  note_md: "Which escalator? The **2023** figure needs a source.",
  created_at: "2026-09-24T10:00:00Z",
};

function makeEnv(opts: { readings?: (typeof READING)[]; parent?: boolean; children?: boolean }) {
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
        if (/JOIN pieces parent ON parent\.id = child\.parent_piece_id/.test(sql)) {
          return opts.parent
            ? { slug: "root-doc", title: "The root document", origin: "Why did transfers lag?" }
            : null;
        }
        if (/COUNT\(\*\)/i.test(sql)) return { n: 0 };
        return null;
      },
      async all() {
        if (/FROM readings r JOIN quotes q/.test(sql)) return { results: opts.readings ?? [] };
        if (/WHERE user_id = \? AND parent_piece_id = \?/.test(sql)) {
          return {
            results: opts.children
              ? [
                  {
                    slug: "child-doc",
                    title: "A child brief",
                    origin: "What replaced the escalator?",
                  },
                ]
              : [],
          };
        }
        return { results: [] };
      },
      async run() {
        return { results: [], meta: { changes: 0 } };
      },
    };
    return stmt as unknown as D1PreparedStatement;
  };
  const DB = {
    prepare: (sql: string) => mk(sql),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
  return { DB } as unknown as PublicEnv;
}

describe("the document page — readings", () => {
  it("does not claim to have been read when it has not", async () => {
    const html = await renderPiece(makeEnv({}), PIECE.slug);
    expect(html).not.toBeNull();
    expect(html).not.toContain("Read by the operator");
    expect(html).not.toContain('id="readings"');
    expect(html).not.toContain('"@type":"Comment"');
  });

  it("renders a reading in the margin of its passage and says so on the byline", async () => {
    const html = (await renderPiece(makeEnv({ readings: [READING] }), PIECE.slug)) ?? "";
    expect(html).toContain("Read by the operator");
    expect(html).toContain('href="#reading-r1" class="read-by"');
    // Beside the paragraph, not in a block after the body: the paragraph and
    // its aside share one .annotated wrapper, and the aside comes AFTER it.
    const wrap = html.slice(html.indexOf('<div class="annotated">'));
    expect(wrap).toMatch(
      /^<div class="annotated"><p>Provincial health spending grew 4\.8 percent[\s\S]*?<\/p><aside class="reading" id="reading-r1">/,
    );
    expect(html).not.toContain('id="readings"');
    expect(html).not.toContain("Passage not found");
    expect(html).toContain('href="/q/q1"');
    expect(html).toContain("<strong>2023</strong>");
    expect(html).toContain("— the operator, ");
    // The marker that placed it never reaches the reader.
    expect(html).not.toContain("\uE000");
    expect(html).not.toContain("\uE001");
    // The reader page needs no script: the only <script> is the JSON-LD.
    for (const m of html.matchAll(/<script\b[^>]*>/g)) {
      expect(m[0]).toContain('type="application/ld+json"');
    }
    // JSON-LD: a Comment about the Quotation, by the page's named Person.
    expect(html).toContain('"@type":"Comment"');
    expect(html).toContain('"about":{"@type":"Quotation"');
    expect(html).toContain('"url":"https://canopticon.com/q/q1"');
    expect(html).toContain('"author":{"@type":"Person","name":"Chris Telford"}');
    // Anonymous: no form, no script, no delete button.
    expect(html).not.toContain("/op/notes.js");
    expect(html).not.toContain('id="note-form"');
    expect(html).not.toContain("/op/readings/r1/delete");
  });

  it("keeps a reading whose passage is not in the current text, and says so", async () => {
    const lost = {
      ...READING,
      id: "r2",
      quote_id: "q2",
      verbatim_text:
        "A sentence the document no longer contains, kept from an earlier version of it.",
    };
    const html = (await renderPiece(makeEnv({ readings: [READING, lost] }), PIECE.slug)) ?? "";
    // r1 still lands in the margin; r2 takes the block after the body.
    expect(html).toContain('<aside class="reading" id="reading-r1">');
    expect(html).not.toContain('<aside class="reading" id="reading-r2">');
    const block = html.slice(html.indexOf('<section class="readings" id="readings">'));
    expect(block).toContain('id="reading-r2"');
    expect(block).toContain("Passage not found in the current text");
    expect(block).toContain('href="/q/q2"');
    expect(block).not.toContain('id="reading-r1"');
    // Both are still Comments in the structured data — placement changes
    // nothing about what the page claims.
    expect(html.match(/"@type":"Comment"/g)?.length).toBe(2);
    expect(html).toContain('"url":"https://canopticon.com/q/q2"');
  });

  it("carries the note form, the script and delete only for the operator", async () => {
    const html =
      (await renderPiece(makeEnv({ readings: [READING] }), PIECE.slug, { isOperator: true })) ?? "";
    expect(html).toContain('<script src="/op/notes.js" defer></script>');
    expect(html).toContain('id="note-form"');
    expect(html).toContain('action="/op/readings"');
    expect(html).toContain('name="piece_id" value="p1"');
    expect(html).toContain('name="passage"');
    expect(html).toContain('name="note"');
    expect(html).toContain('action="/op/readings/r1/delete"');
    expect(html).toContain('action="/op/readings/r1/draft-essay"');
  });
});

describe("the document page — lineage", () => {
  it("renders nothing for a root with no branches", async () => {
    const html = (await renderPiece(makeEnv({}), PIECE.slug)) ?? "";
    expect(html).not.toContain("Grew from");
    expect(html).not.toContain("Grew into");
  });

  it("renders Grew from and Grew into with the question each answered", async () => {
    const html = (await renderPiece(makeEnv({ parent: true, children: true }), PIECE.slug)) ?? "";
    expect(html).toContain("Grew from");
    expect(html).toContain('href="/p/root-doc"');
    expect(html).toContain("Why did transfers lag?");
    expect(html).toContain("Grew into");
    expect(html).toContain('href="/p/child-doc"');
    expect(html).toContain("What replaced the escalator?");
  });

  it("names the related list by subject, not by date", async () => {
    const html = (await renderPiece(makeEnv({}), PIECE.slug)) ?? "";
    expect(html).not.toContain("Keep exploring");
  });
});

describe("margin-readings — placing an aside after the block that holds the passage", () => {
  const aside = (id: string) => `<aside class="reading" id="reading-${id}">note</aside>`;

  it("marks the end of a located passage and skips one it cannot find", () => {
    const md = "First para.\n\nSecond para with the passage in it.\n";
    const r = markReadingPassages(md, [
      { id: "a", verbatim_text: "with the passage" },
      { id: "b", verbatim_text: "not here at all" },
    ]);
    expect([...r.located]).toEqual(["a"]);
    expect(r.markdown).toBe(
      `First para.\n\nSecond para with the passage${readingMark("a")} in it.\n`,
    );
  });

  it("is whitespace-tolerant across a hard wrap, like a receipt", () => {
    const md = "Figures are as tabled, not as spent. Actuals\ndiverge from estimates.";
    const r = markReadingPassages(md, [
      { id: "a", verbatim_text: "Actuals diverge from estimates." },
    ]);
    expect(r.located.has("a")).toBe(true);
  });

  it("will not mark a passage that ends in a heading", () => {
    const md = "## A heading with the passage\n\nBody.\n";
    const r = markReadingPassages(md, [{ id: "a", verbatim_text: "heading with the passage" }]);
    expect(r.located.size).toBe(0);
    expect(r.markdown).toBe(md);
  });

  it("wraps a paragraph and puts the aside after it", () => {
    const html = renderMarkdown(`One.\n\nTwo ${readingMark("a")}here.\n\nThree.`);
    const out = placeReadings(html, [{ id: "a", verbatim_text: "" }], aside);
    expect(out.placed.has("a")).toBe(true);
    expect(out.html).toBe(
      `<p>One.</p>\n<div class="annotated"><p>Two here.</p>${aside("a")}</div>\n<p>Three.</p>`,
    );
  });

  it("wraps a list item's own text, inside the item, before any nested list", () => {
    const html = renderMarkdown(`- Outer ${readingMark("a")}item\n  - nested\n- Second`);
    const out = placeReadings(html, [{ id: "a", verbatim_text: "" }], aside);
    expect(out.html).toBe(
      `<ul><li><div class="annotated"><div class="annotated-text">Outer item</div>${aside("a")}</div><ul><li>nested</li></ul></li><li>Second</li></ul>`,
    );
  });

  it("puts a reading on a table cell after the whole table", () => {
    const html = renderMarkdown(
      `| A | B |\n| --- | --- |\n| x ${readingMark("a")} | y |\n\nAfter.`,
    );
    const out = placeReadings(html, [{ id: "a", verbatim_text: "" }], aside);
    expect(out.html).not.toContain("\uE000");
    expect(out.html).toMatch(
      /<\/table><\/div><aside class="reading" id="reading-a">note<\/aside>\n<p>After\.<\/p>$/,
    );
    expect(out.html).not.toContain("annotated");
  });

  it("puts two readings on one paragraph in one wrapper, in order", () => {
    const html = renderMarkdown(`Alpha ${readingMark("a")}beta ${readingMark("b")}gamma.`);
    const out = placeReadings(
      html,
      [
        { id: "a", verbatim_text: "" },
        { id: "b", verbatim_text: "" },
      ],
      aside,
    );
    expect(out.html).toBe(
      `<div class="annotated"><p>Alpha beta gamma.</p>${aside("a")}${aside("b")}</div>`,
    );
  });

  it("strips a marker for a reading the page does not know and reports it unplaced", () => {
    const html = renderMarkdown(`Text ${readingMark("ghost")}here.`);
    const out = placeReadings(html, [], aside);
    expect(out.html).toBe("<p>Text here.</p>");
    expect(out.placed.size).toBe(0);
  });
});
