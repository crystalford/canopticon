// Inline receipts — putting a verified span back into the sentence it came from.
//
// The property under test is narrow and absolute: the text that ends up
// linked is THE DOCUMENT'S text, located in the document, and everything else
// is left exactly as it was. This function touches the body of every
// published page, so the failure modes worth pinning are the ones that would
// corrupt a document rather than merely fail to decorate it.

import { describe, expect, it } from "vitest";
import { type ReceiptSpan, spliceReceipts } from "../src/public/render/receipts";

/** Most tests care only about the rewritten markdown. */
const splice = (body: string, spans: ReceiptSpan[]): string => spliceReceipts(body, spans).markdown;

const span = (quote_id: string, verbatim_text: string): ReceiptSpan => ({
  quote_id,
  verbatim_text,
});

describe("placing a receipt", () => {
  it("links the span where it appears", () => {
    const body = "Spending rose by eighteen percent over the year.";
    const out = splice(body, [span("abc", "rose by eighteen percent")]);
    expect(out).toBe("Spending [rose by eighteen percent](/q/abc) over the year.");
  });

  it("finds a span that straddles a hard wrap, and keeps the document's wrapping", () => {
    // The case that makes this worth doing at render time at all: research
    // documents are hard-wrapped, so a quote routinely spans a newline. The
    // linked text must be the document's own characters, newline included —
    // not the model's re-flowed copy.
    const body = "Spending rose by\neighteen percent over the year.";
    const out = splice(body, [span("abc", "rose by eighteen percent")]);
    expect(out).toContain("[rose by\neighteen percent](/q/abc)");
  });

  it("links only the first occurrence", () => {
    const body = "The same wording here. And the same wording here.";
    const out = splice(body, [span("abc", "the same wording here")]);
    expect((out.match(/\/q\/abc/g) ?? []).length).toBe(1);
  });

  it("places several spans without disturbing each other's positions", () => {
    const body = "First the housing figure moved, then the transport figure moved.";
    const out = splice(body, [
      span("one", "the housing figure moved"),
      span("two", "the transport figure moved"),
    ]);
    expect(out).toContain("[the housing figure moved](/q/one)");
    expect(out).toContain("[the transport figure moved](/q/two)");
  });

  it("refuses to nest one receipt inside another", () => {
    const body = "Spending rose by eighteen percent over the year.";
    const out = splice(body, [
      span("long", "rose by eighteen percent over the year"),
      span("short", "eighteen percent"),
    ]);
    // Longest wins the position; the contained one is dropped rather than
    // producing a link inside a link.
    expect(out).toContain("/q/long");
    expect(out).not.toContain("/q/short");
  });
});

describe("a miss is normal and must be silent", () => {
  // body_md can be rewritten after extraction with no re-verification
  // (admin/ingest-library.ts, cms/tools/pieces.ts). A quote that no longer
  // appears in the document must simply not be linked — never linked to text
  // that is not there, and never an error on a published page.
  it("leaves the body untouched when the span is absent", () => {
    const body = "Nothing in here matches.";
    expect(splice(body, [span("abc", "a sentence from another document")])).toBe(body);
  });

  it("returns the body unchanged when there are no spans", () => {
    expect(splice("Some prose.", [])).toBe("Some prose.");
  });

  it("survives empty input", () => {
    expect(splice("", [span("abc", "anything at all")])).toBe("");
  });

  it("ignores a span with no quote id", () => {
    const body = "Spending rose by eighteen percent.";
    expect(splice(body, [span("", "rose by eighteen percent")])).toBe(body);
  });
});

describe("what must never be spliced into", () => {
  it("skips a heading — a link there would fight the section anchor", () => {
    const body = "## Spending rose sharply\n\nSome prose follows.";
    const out = splice(body, [span("abc", "Spending rose sharply")]);
    expect(out).toBe(body);
  });

  it("skips a table row — a pipe inside a cell would break the row", () => {
    const body = "| Health | 1,430 |\n| --- | --- |\n| Transport | 812 |";
    const out = splice(body, [span("abc", "Health | 1,430")]);
    expect(out).toBe(body);
  });

  it("skips fenced code, which is meant to be verbatim and unparsed", () => {
    const body = "```\nconst total = 1430;\n```";
    const out = splice(body, [span("abc", "const total = 1430;")]);
    expect(out).toBe(body);
  });

  it("refuses a span containing ] — it would close the link text early", () => {
    // Otherwise the raw URL ends up printed in the middle of a sentence.
    const body = "The estimate [see note] rose sharply that year.";
    const out = splice(body, [span("abc", "estimate [see note] rose sharply")]);
    expect(out).toBe(body);
  });

  it("refuses a span crossing a blank line — a link cannot straddle paragraphs", () => {
    const body = "The first paragraph ends here.\n\nAnd the second one begins.";
    const out = splice(body, [span("abc", "ends here. And the second one begins")]);
    expect(out).toBe(body);
  });
});

describe("the text linked is the document's, never the caller's", () => {
  // The firewall property, inherited from locateVerbatim: a span whose
  // whitespace differs still matches, but what gets rendered is the document's
  // characters. If this ever inverts, the page would show a model's wording
  // while claiming it was quoted word-for-word.
  it("renders the document's spacing, not the span's", () => {
    const body = "Spending   rose    sharply that year.";
    const out = splice(body, [span("abc", "Spending rose sharply")]);
    expect(out).toContain("[Spending   rose    sharply](/q/abc)");
  });
});

describe("reporting which spans landed", () => {
  // The findings block links "in context" to #q-<id>, and that anchor only
  // exists when the span was placed. Without this set, a finding whose quote
  // has gone missing from the body renders a link to nowhere — on the one
  // surface whose entire job is being believable.
  it("reports the ids that were placed", () => {
    const body = "Spending rose by eighteen percent over the year.";
    const { placed } = spliceReceipts(body, [span("abc", "rose by eighteen percent")]);
    expect([...placed]).toEqual(["abc"]);
  });

  it("omits an id whose span is not in the document", () => {
    const body = "Spending rose by eighteen percent over the year.";
    const { placed } = spliceReceipts(body, [
      span("here", "rose by eighteen percent"),
      span("gone", "a sentence from some other document entirely"),
    ]);
    expect(placed.has("here")).toBe(true);
    expect(placed.has("gone")).toBe(false);
  });

  it("omits an id that was rejected for landing in a heading", () => {
    const { placed } = spliceReceipts("## Spending rose sharply", [
      span("abc", "Spending rose sharply"),
    ]);
    expect(placed.size).toBe(0);
  });
});
