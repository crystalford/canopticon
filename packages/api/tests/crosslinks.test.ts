// Cross-document links — the corpus linking itself, with no model involved.
//
// The operator set the bar: "we just need to figure out exactly what the
// system can do repeatedly, at scale, with no issues and do that." These
// tests are that bar written down. The failure mode of automatic cross-linking
// is never too few links; it is too many worthless ones, and it arrives
// quietly as the corpus grows.

import { describe, expect, it } from "vitest";
import { type CrossLink, pickSpread } from "../src/graph/lib/crosslinks";
import { spliceInline } from "../src/public/render/receipts";

const link = (label: string, slug: string, pieces = 2): CrossLink => ({
  label,
  slug,
  title: slug,
  pieces,
});

describe("what gets linked, and what does not", () => {
  it("links each phrase once, however many documents share it", () => {
    // A subject carried by six other documents would otherwise produce six
    // links from the same phrase — or, worse, six overlapping splices.
    const rows = [
      link("Canada Mortgage and Housing Corporation", "housing-starts"),
      link("Canada Mortgage and Housing Corporation", "wealth-estimates"),
      link("Canada Mortgage and Housing Corporation", "transfer-payments"),
    ];
    expect(pickSpread(rows, 12).map((r) => r.slug)).toEqual(["housing-starts"]);
  });

  it("links each destination once, so the budget spreads", () => {
    // Without this, a document sharing nine subjects with one neighbour spends
    // its whole budget pointing at that neighbour: maximum density, minimum
    // reach — the least useful web it could build.
    const rows = [
      link("Main Estimates 2026-27", "budget-2026"),
      link("Treasury Board Secretariat", "budget-2026"),
      link("supplementary estimates", "budget-2026"),
      link("Receiver General", "public-accounts"),
    ];
    expect(pickSpread(rows, 12).map((r) => r.slug)).toEqual(["budget-2026", "public-accounts"]);
  });

  it("respects the density cap", () => {
    // The AEO research is specific: inline links do not hurt comprehension,
    // density does.
    const rows = Array.from({ length: 40 }, (_, i) => link(`Subject number ${i}`, `doc-${i}`));
    expect(pickSpread(rows, 12)).toHaveLength(12);
  });

  it("is deterministic — the same rows give the same links", () => {
    const rows = [
      link("Treasury Board Secretariat", "budget-2026", 2),
      link("Receiver General", "public-accounts", 3),
      link("housing transfer", "transfer-payments", 2),
    ];
    expect(pickSpread(rows, 12)).toEqual(pickSpread(rows, 12));
  });

  it("drops rows missing a label or a destination rather than linking to nowhere", () => {
    const rows = [
      link("", "doc-a"),
      link("Real subject here", ""),
      link("Another subject", "doc-c"),
    ];
    expect(pickSpread(rows, 12).map((r) => r.slug)).toEqual(["doc-c"]);
  });
});

describe("placing them in the prose", () => {
  const body = "The Treasury Board Secretariat tabled the main estimates on 4 March.";

  it("links the document's own words, not the label's", () => {
    // Same firewall as receipts: locateVerbatim returns THE DOCUMENT's
    // substring, so a label that drifted from the text links nothing rather
    // than rewriting the document to match itself.
    const out = spliceInline(body, [], [{ label: "Treasury Board Secretariat", slug: "budget" }]);
    expect(out.markdown).toContain("[Treasury Board Secretariat](/p/budget)");
    expect(out.linked.has("budget")).toBe(true);
  });

  it("says nothing when the phrase is not in the document", () => {
    const out = spliceInline(body, [], [{ label: "Receiver General of Canada", slug: "accounts" }]);
    expect(out.markdown).toBe(body);
    expect(out.linked.size).toBe(0);
  });

  it("gives a contested span to the receipt, never to the link", () => {
    // Proof before navigation. A link that displaced a receipt would trade
    // the one thing this publication exists to provide for a way to leave it.
    const out = spliceInline(
      body,
      [
        {
          quote_id: "q1",
          verbatim_text: "The Treasury Board Secretariat tabled the main estimates",
        },
      ],
      [{ label: "Treasury Board Secretariat", slug: "budget" }],
    );
    expect(out.markdown).toContain("(/q/q1)");
    expect(out.markdown).not.toContain("/p/budget");
    expect(out.placed.has("q1")).toBe(true);
    expect(out.linked.size).toBe(0);
  });

  it("never nests a link inside a link", () => {
    // The reason both kinds are placed in ONE pass. Two passes would let the
    // second match inside the markdown the first just wrote.
    const out = spliceInline(
      body,
      [
        {
          quote_id: "q1",
          verbatim_text: "The Treasury Board Secretariat tabled the main estimates",
        },
      ],
      [{ label: "Treasury Board Secretariat", slug: "budget" }],
    );
    expect(out.markdown).not.toMatch(/\[[^\]]*\[/);
  });

  it("will not link inside a heading or a table row", () => {
    const md = "## The Treasury Board Secretariat\n\n| Treasury Board Secretariat | 1,204 |";
    const out = spliceInline(md, [], [{ label: "Treasury Board Secretariat", slug: "budget" }]);
    expect(out.markdown).toBe(md);
  });

  it("leaves the body untouched when there is nothing to place", () => {
    expect(spliceInline(body, [], []).markdown).toBe(body);
  });
});
