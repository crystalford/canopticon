// The publication's markdown renderer.
//
// This is pinned harder than a rendering helper normally would be, because
// the failure it was written to fix was invisible to every check in the repo.
// A research document rendered as a wall of text with raw pipe characters in
// it, and the typecheck, the lint and 329 tests all passed — while the person
// reading the site saw the problem immediately. The fixture rendered an essay
// for every piece, so even the screenshot tool never showed it.
//
// The rule these encode: a research document is not the same shape as a post.
// It carries tables, nested lists, quotes and hard-wrapped prose, and every
// one of those is load-bearing for citability, not decoration — retrieval is
// passage-level, so structure is what makes a passage liftable.

import { describe, expect, it } from "vitest";
import { headingSlug, renderInlineMarkdown, renderMarkdown } from "../src/public/render/markdown";

describe("tables — the construct whose absence looked worst", () => {
  const table = `| Department | 2025 | 2026 |
| --- | ---: | ---: |
| Health | 1,200 | 1,430 |
| Transport | 880 | 812 |`;

  it("renders a pipe table as a table", () => {
    const html = renderMarkdown(table);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Department</th>");
    expect(html).toContain("<td>Health</td>");
    // Four cells of data across two rows.
    expect((html.match(/<td/g) ?? []).length).toBe(6);
  });

  it("honours column alignment", () => {
    const html = renderMarkdown(table);
    expect(html).toContain('style="text-align:right"');
  });

  it("wraps the table so a wide one scrolls instead of breaking the page", () => {
    // Without this a 9-column table pushes the whole document sideways on a
    // phone, which is worse than the wall of text it replaced.
    expect(renderMarkdown(table)).toContain('<div class="table-wrap">');
  });

  it("pads short rows rather than dropping the row", () => {
    const ragged = `| A | B | C |
| --- | --- | --- |
| 1 | 2 |`;
    const html = renderMarkdown(ragged);
    expect((html.match(/<td/g) ?? []).length).toBe(3);
  });

  it("leaves a lone pipe line alone — a table needs its delimiter row", () => {
    const html = renderMarkdown("This | that | the other");
    expect(html).not.toContain("<table>");
    expect(html).toContain("<p>");
  });
});

describe("hard-wrapped prose", () => {
  // THE single biggest contributor to the mechanical look. Research documents
  // arrive hard-wrapped; rendering every wrap as a line break made ordinary
  // paragraphs look like verse.
  it("joins a hard-wrapped paragraph with spaces, not line breaks", () => {
    const html = renderMarkdown(
      "The estimate was revised\ntwice in the same quarter,\nwithout notice.",
    );
    expect(html).not.toContain("<br");
    expect(html).toContain(
      "<p>The estimate was revised twice in the same quarter, without notice.</p>",
    );
  });

  it("still separates paragraphs on a blank line", () => {
    const html = renderMarkdown("First para.\n\nSecond para.");
    expect((html.match(/<p>/g) ?? []).length).toBe(2);
  });
});

describe("headings are citation targets", () => {
  it("gives every heading a stable slug id and a self-link", () => {
    const html = renderMarkdown("## What the estimates show");
    expect(html).toContain('id="what-the-estimates-show"');
    expect(html).toContain('href="#what-the-estimates-show"');
  });

  it("starts at h2 so it sits under the page title, and nests from there", () => {
    const html = renderMarkdown("# Top\n\n## Under it");
    expect(html).toContain("<h2 ");
    expect(html).toContain("<h3 ");
  });

  it("disambiguates repeated headings instead of producing two of the same id", () => {
    // Two sections called "Method" is normal in a research document, and a
    // duplicated id silently breaks the second one as a citation target.
    const html = renderMarkdown("## Method\n\ntext\n\n## Method\n\nmore");
    expect(html).toContain('id="method"');
    expect(html).toContain('id="method-2"');
  });

  it("slugs are stable against edits above them, unlike positional anchors", () => {
    // The point of slugs over s1/s2: inserting a section must not repoint
    // every citation below it.
    const before = renderMarkdown("## Alpha\n\n## Beta");
    const after = renderMarkdown("## New\n\n## Alpha\n\n## Beta");
    expect(before).toContain('id="beta"');
    expect(after).toContain('id="beta"');
  });
});

describe("lists", () => {
  it("nests by indentation rather than flattening", () => {
    const html = renderMarkdown("- one\n  - one a\n- two");
    expect(html).toContain("<ul>");
    // A nested list lives inside its parent item.
    expect(html).toMatch(/<li>one<ul>/);
  });

  it("renders ordered lists as ordered", () => {
    expect(renderMarkdown("1. first\n2. second")).toContain("<ol>");
  });

  it("attaches a continuation line to the item above it", () => {
    const html = renderMarkdown("- a claim that runs\n  onto a second line");
    expect(html).toContain("<li>a claim that runs onto a second line</li>");
  });
});

describe("blockquotes", () => {
  it("groups consecutive quoted lines into one quote", () => {
    const html = renderMarkdown("> first line\n> second line");
    expect((html.match(/<blockquote>/g) ?? []).length).toBe(1);
  });

  it("does not put anchors on headings inside a quote", () => {
    // A quoted heading is not a section of this document and must not compete
    // for the same citation surface.
    const html = renderMarkdown("> ## Quoted heading");
    expect(html).toContain("<blockquote>");
    expect(html).not.toContain("anchor-link");
  });
});

describe("the content is content, not markup", () => {
  // Documents are uploaded files. The CMS renderer passes HTML through
  // because posts are typed by the operator into a form; an uploaded file is
  // not the same trust model.
  it("escapes HTML in body text", () => {
    const html = renderMarkdown("A <script>alert(1)</script> in the text");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML inside table cells too", () => {
    const html = renderMarkdown("| a |\n| --- |\n| <img src=x onerror=1> |");
    expect(html).not.toContain("<img");
  });

  it("refuses a javascript: link but keeps the text", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("click");
  });

  it("marks external links nofollow and same-site links plain", () => {
    expect(renderMarkdown("[x](https://example.com)")).toContain('rel="nofollow noopener"');
    expect(renderMarkdown("[x](/research)")).not.toContain("nofollow");
  });
});

describe("inline", () => {
  it("handles bold, italic and code", () => {
    const html = renderInlineMarkdown("**bold** and *italic* and `code`");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<code>code</code>");
  });

  it("does not read emphasis inside inline code", () => {
    expect(renderInlineMarkdown("`a * b * c`")).not.toContain("<em>");
  });

  it("returns no block wrapper", () => {
    expect(renderInlineMarkdown("plain")).toBe("plain");
  });
});

describe("fenced code", () => {
  it("keeps its contents verbatim and unparsed", () => {
    const html = renderMarkdown("```\n| not | a table |\n## not a heading\n```");
    expect(html).toContain("<pre><code>");
    expect(html).not.toContain("<table>");
    expect(html).not.toContain("<h2");
  });
});

describe("headingSlug", () => {
  it("strips punctuation and lowercases", () => {
    expect(headingSlug("What *this* is (really)?")).toBe("what-this-is-really");
  });

  it("never returns empty", () => {
    expect(headingSlug("???")).toBe("section");
  });
});
