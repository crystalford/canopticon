// Answering one lead — and the firewall that makes the answer checkable.
//
// The operator's reason for not using the built-in research: "I do not trust
// the results built in our own system." A three-thousand-word brief is
// untrustable by construction — too long to verify, every sentence the
// model's, nothing in it checkable without redoing the work.
//
// A lead answer is the opposite bet: three sentences and up to four quotes,
// every one of them located verbatim in a document we hold. So the tests that
// matter are not about the prose. They are about what happens to a quote the
// model got slightly wrong, because that is the difference between an artifact
// you can check and one you have to believe.

import { describe, expect, it } from "vitest";
import { leadKey, verify } from "../src/graph/lib/answer-lead";

const HOUSING = {
  id: "p1",
  slug: "budget-2026",
  title: "Budget 2026: Main Estimates",
  body_md:
    "Departmental spending for the 2026 cycle was tabled on 4 March.\n\n" +
    "The housing figure is the one worth pausing on. It is the largest " +
    "proportional increase in the table, and the estimate document attributes " +
    "it to a single program transfer rather than to new money.",
};

const TRANSFERS = {
  id: "p2",
  slug: "transfer-payments",
  title: "Transfer Payments 2025",
  body_md:
    "Housing funding was unchanged in 2026 relative to the prior cycle.\n\n" +
    "Every transfer over one million dollars is listed by registrant.",
};

const DOCS = [HOUSING, TRANSFERS];

describe("the verbatim firewall", () => {
  it("keeps a quote that is in the document", () => {
    const { quotes, discarded } = verify(
      [{ text: "Departmental spending for the 2026 cycle was tabled on 4 March." }],
      DOCS,
    );
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.piece_id).toBe("p1");
    expect(discarded).toBe(0);
  });

  it("stores THE DOCUMENT'S substring, not the model's string", () => {
    // The whole point. locateVerbatim is whitespace-tolerant, so a quote that
    // has been re-wrapped still matches — and what gets stored is the text as
    // the document has it, so a silently tidied quote cannot survive by being
    // close enough.
    const { quotes } = verify(
      [{ text: "The housing figure is the one   worth\n\tpausing on." }],
      DOCS,
    );
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.text).toBe("The housing figure is the one worth pausing on.");
  });

  it("discards a quote that is not in any document, and counts it", () => {
    // The failure mode this exists for: a fluent, plausible sentence that
    // nobody wrote. It must not reach the page, and the operator must be able
    // to see that it was attempted.
    const { quotes, discarded } = verify(
      [{ text: "Housing spending rose by forty percent according to the department." }],
      DOCS,
    );
    expect(quotes).toHaveLength(0);
    expect(discarded).toBe(1);
  });

  it("discards a paraphrase even when its meaning is right", () => {
    // "Housing funding was unchanged in 2026" is in TRANSFERS. This is what it
    // means, and it is not what it says.
    const { quotes, discarded } = verify(
      [{ text: "Funding for housing did not change in 2026." }],
      DOCS,
    );
    expect(quotes).toHaveLength(0);
    expect(discarded).toBe(1);
  });

  it("finds the right document when the model names the wrong one", () => {
    // The model's claim about WHERE it quoted from is not trusted either. A
    // right quote misattributed is still a right quote; a wrong one is caught
    // by no document having it.
    const { quotes } = verify(
      [
        {
          text: "Housing funding was unchanged in 2026 relative to the prior cycle.",
          document: "Budget 2026: Main Estimates",
        },
      ],
      DOCS,
    );
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.piece_id).toBe("p2");
    expect(quotes[0]?.title).toBe("Transfer Payments 2025");
  });

  it("keeps the good quotes from a batch that also contains a bad one", () => {
    // Partial credit is correct: one invented quote should cost that quote,
    // not the whole answer.
    const { quotes, discarded } = verify(
      [
        { text: "Departmental spending for the 2026 cycle was tabled on 4 March." },
        { text: "The minister confirmed this in a press conference." },
        { text: "Every transfer over one million dollars is listed by registrant." },
      ],
      DOCS,
    );
    expect(quotes.map((q) => q.piece_id)).toEqual(["p1", "p2"]);
    expect(discarded).toBe(1);
  });

  it("caps the number of quotes, because four is already a lot for one lead", () => {
    const many = Array.from({ length: 9 }, () => ({
      text: "Departmental spending for the 2026 cycle was tabled on 4 March.",
    }));
    expect(verify(many, DOCS).quotes.length).toBeLessThanOrEqual(4);
  });

  it("does not repeat the same span twice", () => {
    const { quotes } = verify(
      [
        { text: "Departmental spending for the 2026 cycle was tabled on 4 March." },
        { text: "Departmental spending for the 2026 cycle was tabled on 4 March." },
      ],
      DOCS,
    );
    expect(quotes).toHaveLength(1);
  });

  it("counts an empty or malformed proposal as discarded rather than crashing", () => {
    const { quotes, discarded } = verify([{ text: "" }, {}, null, "a bare string"], DOCS);
    expect(quotes).toHaveLength(0);
    expect(discarded).toBe(4);
  });

  it("survives a document with no body", () => {
    expect(verify([{ text: "anything at all here" }], []).quotes).toHaveLength(0);
  });
});

describe("the lead key", () => {
  it("is stable for the same lead", async () => {
    const a = await leadKey("contradiction", "did housing funding change in 2026");
    const b = await leadKey("contradiction", "did housing funding change in 2026");
    expect(a).toBe(b);
  });

  it("differs by kind and by seed", async () => {
    const base = await leadKey("contradiction", "same seed");
    expect(await leadKey("unsourced-figure", "same seed")).not.toBe(base);
    expect(await leadKey("contradiction", "other seed")).not.toBe(base);
  });

  it("is short enough to read in a log line", async () => {
    expect((await leadKey("contradiction", "x")).length).toBe(32);
  });
});

// How the answer is SHOWN matters as much as how it is made. A block that
// quietly drops the discard count, or that renders "not settled" as an error,
// would undo the property the whole thing exists for.
describe("how a settled lead reads", () => {
  it("shows the discard count even when the answer stands", async () => {
    // The single most useful signal on the block: a high count means the model
    // was reaching. Hiding it makes a shaky answer look identical to a solid
    // one, which is precisely the thing that costs trust.
    const { renderLeadAnswerForTest } = await import("../src/public/render/investigations");
    const html = renderLeadAnswerForTest({
      lead_key: "k",
      status: "answered",
      answer_md: "They measure different things.",
      quotes: [{ text: "A quote", piece_id: "p1", slug: "doc-a", title: "Doc A" }],
      discarded: 3,
    });
    expect(html).toContain("3 proposed quotes discarded");
  });

  it("does not render a discard line when nothing was discarded", () => {
    // The counterpart: a clean answer should not carry a "0 discarded" badge
    // that reads like a warning.
    return import("../src/public/render/investigations").then(({ renderLeadAnswerForTest }) => {
      const html = renderLeadAnswerForTest({
        lead_key: "k",
        status: "answered",
        answer_md: "Settled.",
        quotes: [{ text: "A quote", piece_id: "p1", slug: "doc-a", title: "Doc A" }],
        discarded: 0,
      });
      expect(html).not.toContain("discarded");
    });
  });

  it("renders 'not settled' as a finding, not as an error", async () => {
    // "These documents raised it and do not answer it" says the gap is real
    // and still open. Colouring it like a failure would tell the operator to
    // go looking for a bug that is not there.
    const { renderLeadAnswerForTest } = await import("../src/public/render/investigations");
    const html = renderLeadAnswerForTest({
      lead_key: "k",
      status: "nothing_found",
      answer_md: "Neither document names a source for the figure.",
      quotes: [],
      discarded: 0,
    });
    expect(html).toContain("Not settled by these documents");
    expect(html).not.toContain("lead-ans-warn");
  });

  it("renders nothing at all for a lead that has never been dug", async () => {
    const { renderLeadAnswerForTest } = await import("../src/public/render/investigations");
    expect(renderLeadAnswerForTest(undefined)).toBe("");
  });

  it("links every quote to the document it was found in", async () => {
    const { renderLeadAnswerForTest } = await import("../src/public/render/investigations");
    const html = renderLeadAnswerForTest({
      lead_key: "k",
      status: "answered",
      answer_md: "Settled.",
      quotes: [{ text: "A quote", piece_id: "p1", slug: "doc-a", title: "Doc A" }],
      discarded: 0,
    });
    expect(html).toContain('href="/library/doc-a"');
    expect(html).toContain("Doc A");
  });
});
