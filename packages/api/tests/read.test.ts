// Read it (docs/read-it.md) — what a read must always do, with a fake Claude:
// read the whole document, anchor every card in the document's own words
// (located in code, dropped and counted when not found), carry the
// document's labels and never its own, refuse a possible article the
// document already states or that no finding carries, and never bring back
// what the author dismissed.

import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { publicResearch } from "../src/site/content/store";
import { renderReadBoard } from "../src/site/pages/read";
import { type StreamFn, type WriteEvent, runTurn, transcript } from "../src/write/agent";
import { memoryDrafts } from "../src/write/drafts";
import {
  THIN_PROOF,
  ignoreKey,
  locateSpan,
  memoryReads,
  runReadTool,
  shapeOf,
} from "../src/write/read";

function stubDb(): D1Database {
  const stmt = {
    bind: () => stmt,
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ results: [], meta: { changes: 0 } }),
  };
  return {
    prepare: () => stmt,
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}
const env = { LOG_LEVEL: "error", DB: stubDb() } as unknown as Env;

const DOC_TEXT = `# Rent bans

## TL;DR
Rents fell after the ban, but supply fell too.

## Key Findings
- Rents fell by 4.1 percent in the first year after the ban [1].
- New listings fell by **a fifth** over the same period [2].

## How much did rents fall after the ban?
By 4.1 percent in the first year, according to the city's own registry.

Later paragraphs give the detail.

## Details
The registry counted 12,400 units in 2024, of which 3,100 were vacant. We call this pattern
the vacancy shadow, a coinage: no single name exists for it yet.
Build a tracker first, before anything else.
I found no study of what happened to tenants who moved away.

## Caveats
- The registry undercounts informal sublets, so the fall may be overstated.

## Sources
1. City of Example. Rent registry, 2025.
2. Listings Inc. Quarterly report, 2025.
`;

const ctx = async (doc = DOC_TEXT) => {
  const reads = memoryReads();
  const read = await reads.start("rent-bans", "draft1", doc.length);
  return { reads, readId: read.id, docId: "rent-bans", doc };
};

describe("finding a card's words in the document", () => {
  it("stores the document's own text: exact, whitespace aside, emphasis aside; nothing else", () => {
    expect(locateSpan(DOC_TEXT, "Rents fell by 4.1 percent")).toBe("Rents fell by 4.1 percent");
    // A line break in the document, a space in the span: the document's text comes back.
    expect(locateSpan(DOC_TEXT, "3,100 were vacant. We call this pattern the vacancy shadow")).toBe(
      "3,100 were vacant. We call this pattern\nthe vacancy shadow",
    );
    expect(locateSpan(DOC_TEXT, "New listings fell by a fifth")).toBeTruthy();
    expect(locateSpan(DOC_TEXT, "Rents rose by 4.1 percent")).toBeNull();
    expect(locateSpan(DOC_TEXT, "Rents")).toBeNull(); // too short to anchor anything
  });
});

describe("what the document's structure gives, with no model", () => {
  it("takes Key Findings, Caveats and question headings with their answers, and counts Sources", () => {
    const { cards, sources } = shapeOf(DOC_TEXT);
    expect(cards.filter((c) => c.kind === "finding")).toHaveLength(2);
    expect(cards.filter((c) => c.kind === "caveat")).toHaveLength(1);
    const q = cards.find((c) => c.kind === "question_answered");
    expect(q?.section).toBe("How much did rents fall after the ban?");
    expect(q?.answer).toBe(
      "By 4.1 percent in the first year, according to the city's own registry.",
    );
    expect(sources).toBe(2);
    for (const c of cards) expect(locateSpan(DOC_TEXT, c.span)).toBeTruthy();
  });
});

describe("a card", () => {
  it("is dropped and counted when its span is not in the document", async () => {
    const t = await ctx();
    const r = await runReadTool(
      "note",
      { kind: "finding", span: "Rents doubled overnight in the city" },
      t,
    );
    expect(r.error).toBe(true);
    expect(r.card).toBeUndefined();
    expect((await t.reads.get(t.readId))?.dropped).toBe(1);
  });

  it("keeps a figure only as the document writes it, with the document's own rating", async () => {
    const t = await ctx();
    const span = "The registry counted 12,400 units in 2024";
    const wrong = await runReadTool(
      "note",
      { kind: "figure", span, figure: "12400", measures: "units" },
      t,
    );
    expect(wrong.error).toBe(true);
    const ok = await runReadTool(
      "note",
      {
        kind: "figure",
        span,
        figure: "12,400",
        measures: "rental units registered",
        period: "2024",
        source_rating: "official",
      },
      t,
    );
    expect(ok.card?.data).toMatchObject({
      figure: "12,400",
      period: "2024",
      source_rating: "official",
      rejected: false,
    });
    expect(ok.card?.status).toBe("proposed");
    expect((await t.reads.get(t.readId))?.verified).toBe(1);
  });

  it("needs the answer for a question it answers, and the novelty line for a coined name", async () => {
    const t = await ctx();
    expect(
      (
        await runReadTool(
          "note",
          {
            kind: "question_answered",
            span: "By 4.1 percent in the first year",
            question: "How much?",
          },
          t,
        )
      ).error,
    ).toBe(true);
    const coin = await runReadTool(
      "note",
      {
        kind: "coinage",
        span: "the vacancy shadow",
        flag_span: "no single name exists for it yet",
      },
      t,
    );
    expect(coin.card?.data.flag).toBe("no single name exists for it yet");
    expect(
      (
        await runReadTool(
          "note",
          {
            kind: "coinage",
            span: "the vacancy shadow, a coinage",
            flag_span: "brand new idea here",
          },
          t,
        )
      ).error,
    ).toBe(true);
  });

  it("is noted once, and never again once dismissed", async () => {
    const t = await ctx();
    const span = "I found no study of what happened to tenants who moved away.";
    const first = await runReadTool("note", { kind: "question_open", span }, t);
    expect(first.card).toBeTruthy();
    expect((await runReadTool("note", { kind: "question_open", span }, t)).text).toBe(
      "Already noted.",
    );
    await t.reads.ignore(t.docId, "question_open", ignoreKey("question_open", span));
    const t2 = { ...t, readId: (await t.reads.start(t.docId, "draft2", DOC_TEXT.length)).id };
    const again = await runReadTool("note", { kind: "question_open", span }, t2);
    expect(again.card).toBeUndefined();
    expect(again.text).toMatch(/dismissed/);
  });
});

describe("a possible article", () => {
  it("is refused when the document already states it: that is a summary", async () => {
    const t = await ctx();
    const r = await runReadTool(
      "pitch",
      {
        thesis: "Rents fell after the ban, but supply fell too.",
        supports: [{ span: "Rents fell by 4.1 percent in the first year", role: "finding" }],
      },
      t,
    );
    expect(r.error).toBe(true);
    expect(r.text).toMatch(/summary/);
  });

  it("is never shown when only advice or the author's own decisions carry it", async () => {
    const t = await ctx();
    const r = await runReadTool(
      "pitch",
      {
        thesis: "A city should measure before it bans anything at all",
        supports: [
          { span: "Build a tracker first, before anything else.", role: "recommendation" },
        ],
      },
      t,
    );
    expect(r.error).toBe(true);
    expect(r.card).toBeUndefined();
  });

  it("counts its proof in code, drops what is not in the document, and marks it thin", async () => {
    const t = await ctx();
    const r = await runReadTool(
      "pitch",
      {
        thesis: "A rent ban trades a visible price for an invisible shortage",
        supports: [
          { span: "Rents fell by 4.1 percent in the first year after the ban", role: "finding" },
          { span: "New listings fell by a fifth over the same period", role: "finding" },
          { span: "Build a tracker first, before anything else.", role: "recommendation" },
          { span: "Landlords left the market in droves", role: "finding" },
        ],
        counter: "The registry undercounts informal sublets",
      },
      t,
    );
    expect(r.card?.data).toMatchObject({ proof: 2, thin: true });
    expect(r.card?.data.counter).toBe("The registry undercounts informal sublets");
    expect(2).toBeLessThan(THIN_PROOF);
    expect((await t.reads.get(t.readId))?.dropped).toBe(1);
  });
});

describe("the board", () => {
  it("shows the receipt with what was dropped, Keep and Dismiss, and never passes advice off as evidence", async () => {
    const t = await ctx();
    await runReadTool(
      "note",
      {
        kind: "finding",
        span: "Build a tracker first, before anything else.",
        role: "recommendation",
      },
      t,
    );
    await runReadTool("note", { kind: "finding", span: "Nowhere in this document at all" }, t);
    const read = await t.reads.get(t.readId);
    if (!read) throw new Error("no read");
    const html = renderReadBoard(read, await t.reads.derivations(t.readId), "Rent bans");
    expect(html).toContain("1 dropped");
    expect(html).toContain("Advice to the author — not evidence");
    expect(html).toContain("/keep");
    expect(html).toContain("/dismiss");
    expect(html).toContain("noindex");
  });
});

type Block = Anthropic.Beta.BetaContentBlock;
const msg = (content: unknown[], stop: string): Anthropic.Beta.BetaMessage =>
  ({
    id: "m",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: content as Block[],
    stop_reason: stop,
    usage: {
      input_tokens: 1000,
      output_tokens: 500,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  }) as unknown as Anthropic.Beta.BetaMessage;

function fakeStream(script: Anthropic.Beta.BetaMessage[]) {
  const calls: unknown[] = [];
  const stream: StreamFn = (params) => {
    calls.push(structuredClone(params));
    const m = script.shift() ?? msg([{ type: "text", text: "(out of script)" }], "end_turn");
    return {
      on() {
        return this;
      },
      async finalMessage() {
        return m;
      },
    } as unknown as ReturnType<StreamFn>;
  };
  return { stream, calls };
}

describe("a read", () => {
  it("reads the document whole, notes cards, and leaves a receipt", async () => {
    const doc = publicResearch().find((d) => d.body.length > 2000);
    if (!doc) throw new Error("the store has no public research");
    const span = doc.body.slice(600, 680).trim();
    const store = memoryDrafts();
    const reads = memoryReads();
    const d = await store.create("read");
    const read = await reads.start(doc.id, d.id, doc.body.length);
    await store.save(d.id, {
      meta: { title: `Read: ${doc.title}`, based_on: [doc.id], readId: read.id },
    });
    const { stream, calls } = fakeStream([
      msg(
        [{ type: "tool_use", id: "r1", name: "read_document", input: { id: doc.id } }],
        "tool_use",
      ),
      msg(
        [
          {
            type: "tool_use",
            id: "n1",
            name: "note",
            input: { kind: "finding", span, role: "finding" },
          },
          {
            type: "tool_use",
            id: "n2",
            name: "note",
            input: { kind: "finding", span: "This sentence is not in the document at all." },
          },
        ],
        "tool_use",
      ),
      msg([{ type: "text", text: "One finding; one span did not match." }], "end_turn"),
    ]);
    const events: WriteEvent[] = [];
    await runTurn({
      stream,
      env,
      store,
      reads,
      draftId: d.id,
      text: "Read it.",
      emit: (e) => events.push(e),
    });

    const after = await reads.get(read.id);
    expect(after).toMatchObject({
      status: "read",
      charsRead: doc.body.length,
      verified: 1,
      dropped: 1,
    });
    expect(after?.cents).toBeGreaterThan(0);
    expect(after?.model).toBeTruthy();
    expect(events.filter((e) => e.type === "card")).toHaveLength(1);
    expect(events.some((e) => e.type === "activity" && /Dropped/.test(e.text))).toBe(true);
    const first = calls[0] as { tools: Array<{ name: string }>; system: Array<{ text: string }> };
    expect(first.tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["read_document", "note", "pitch"]),
    );
    expect(first.tools.some((t) => t.name === "write_draft")).toBe(false);
    expect(first.system[0]?.text).toContain('pressed "Read it"');
    expect(
      transcript(await store.messages(d.id)).some((i) => /^Noted · Finding/.test(i.text)),
    ).toBe(true);
  });
});
