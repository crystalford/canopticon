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

// ---- part 2: what the reads feed --------------------------------------------------

import app from "../src/index";
import { heldResearch, setShownReads, shownRead } from "../src/site/content/store";
import { evidence, publicCards } from "../src/site/pages/evidence";
import { type Derivation, cardKey, pitchBrief } from "../src/write/read";

const card = (over: Partial<Derivation>): Derivation => ({
  id: Math.random().toString(36).slice(2),
  readId: "r1",
  docId: "doc",
  kind: "finding",
  origin: "read",
  span: "a passage of the document",
  data: {},
  status: "kept",
  createdAt: "2026-10-14T00:00:00Z",
  ...over,
});
const readRow = (docId: string) => ({
  id: "r1",
  docId,
  draftId: "d1",
  status: "shown" as const,
  charsHeld: 10,
  charsRead: 10,
  verified: 3,
  dropped: 0,
  cents: 50,
  startedAt: "2026-10-14T00:00:00Z",
  shownAt: "2026-10-14T01:00:00Z",
});

describe("what a read puts on the page", () => {
  it("is only what was kept: never a possible article, advice, the author flag, or what the body already says", () => {
    const shown = publicCards([
      card({ kind: "pitch" }),
      card({ kind: "held" }),
      card({ role: "recommendation" }),
      card({ role: "premise" }),
      card({ origin: "shape", kind: "caveat" }),
      card({ origin: "shape", kind: "finding" }),
      card({ status: "proposed" }),
      card({ status: "dismissed" }),
      card({ role: "finding", span: "the one that stays" }),
      card({ origin: "shape", kind: "question_answered", data: { question: "Q?", answer: "A." } }),
    ]);
    expect(shown.map((c) => c.span)).toEqual(["the one that stays"]);
  });

  it("shows figures with their source, questions with their answers, and counts what is on the page", () => {
    const ev = evidence({
      read: readRow("doc"),
      cards: [
        card({
          kind: "figure",
          data: {
            figure: "4.1%",
            measures: "fall in rents",
            attributed_to: "City registry",
            period: "2025",
          },
        }),
        card({
          kind: "figure",
          data: { figure: "9%", measures: "a figure the document rejects", rejected: true },
        }),
        card({
          kind: "question_answered",
          data: { question: "Did rents fall?", answer: "By 4.1 percent." },
        }),
        card({ kind: "question_open", span: "I found no study of tenants who moved away." }),
        card({ kind: "finding", data: { standing: "emerging" } }),
      ],
    });
    if (!ev) throw new Error("no evidence");
    expect(ev.figures).toContain("4.1%");
    expect(ev.figures).toContain("City registry · 2025");
    expect(ev.figures).not.toContain("9%");
    expect(ev.after).toContain("Did rents fall?");
    expect(ev.after).toContain("By 4.1 percent.");
    expect(ev.after).toContain("emerging");
    expect(ev.after).toContain("#q=");
    expect(ev.strip).toContain("4 passages");
    expect(ev.strip).toContain("Chosen by Chris Telford from a read by Claude");
    expect(evidence({ read: readRow("doc"), cards: [card({ kind: "pitch" })] })).toBeNull();
  });

  it("never comes back for a held document", () => {
    const held = heldResearch()[0];
    if (!held) return;
    setShownReads([{ read: readRow(held.id), cards: [card({ docId: held.id })] }]);
    expect(shownRead(held.id)).toBeNull();
    setShownReads([]);
  });

  it("is on the public document page, server-rendered", async () => {
    const doc = publicResearch()[0];
    if (!doc) throw new Error("no public research");
    setShownReads([
      {
        read: readRow(doc.id),
        cards: [
          card({
            docId: doc.id,
            kind: "figure",
            data: { figure: "12,345", measures: "things counted", attributed_to: "A source" },
          }),
          card({
            docId: doc.id,
            kind: "question_answered",
            data: { question: "What does it answer?", answer: "This." },
          }),
        ],
      },
    ]);
    const html = await (await app.fetch(new Request(`http://test/p/${doc.id}`), env)).text();
    setShownReads([]);
    expect(html).toContain("12,345");
    expect(html).toContain("What does it answer?");
    expect(html).toContain("Questions it answers");
    expect(html).not.toContain("Read it</button>"); // signed out: no button
  });
});

describe("Write this", () => {
  it("briefs the article with the thesis and the passages, advice named as advice", () => {
    const brief = pitchBrief(
      card({
        kind: "pitch",
        docId: "rent-bans",
        data: {
          thesis: "A rent ban trades a visible price for an invisible shortage",
          supports: [
            { span: "Rents fell by 4.1 percent", role: "finding", section: "Key Findings" },
            { span: "Build a tracker first", role: "recommendation" },
          ],
          counter: "The registry undercounts informal sublets",
        },
      }),
      "Rent bans",
    );
    expect(brief).toContain("Write an article arguing: A rent ban trades");
    expect(brief).toContain("(id: rent-bans)");
    expect(brief).toContain('(finding, Key Findings) "Rents fell by 4.1 percent"');
    expect(brief).toContain('(recommendation, not evidence) "Build a tracker first"');
    expect(brief).toContain("The strongest counter in the document");
  });
});

describe("Admin knows what each read found", () => {
  it("has the latest read of each document, with what was kept", async () => {
    const reads = memoryReads();
    const a = await reads.start("doc-a", "d1", 100);
    await reads.add({
      readId: a.id,
      docId: "doc-a",
      kind: "finding",
      origin: "read",
      span: "x x x x x x x x",
      data: {},
      status: "kept",
    });
    await reads.add({
      readId: a.id,
      docId: "doc-a",
      kind: "finding",
      origin: "read",
      span: "y y y y y y y y",
      data: {},
      status: "proposed",
    });
    const latest = await reads.latestAll();
    expect(latest.get("doc-a")?.kept).toBe(1);
    expect(await reads.shownAll()).toEqual([]);
    await reads.update(a.id, { status: "shown", shownAt: "2026-10-14T01:00:00Z" });
    expect((await reads.shownAll())[0]?.cards).toHaveLength(1);
  });
});

describe("what the review found, kept fixed", () => {
  it("never anchors a span that is short once its emphasis is gone", () => {
    expect(locateSpan("Rents fell 3.2% and then 3.2% again.", "**3.2%**")).toBeNull();
    expect(locateSpan("anything at all", "********")).toBeNull();
  });

  it("counts a passage once toward a possible article, and never brings back a dismissed one", async () => {
    const t = await ctx();
    const span = "Rents fell by 4.1 percent in the first year after the ban";
    const thesis = "A rent ban trades a visible price for an invisible shortage";
    const r = await runReadTool(
      "pitch",
      { thesis, supports: Array.from({ length: 9 }, () => ({ span, role: "finding" })) },
      t,
    );
    expect(r.card?.data).toMatchObject({ proof: 1, thin: true });
    expect(
      (await runReadTool("pitch", { thesis, supports: [{ span, role: "finding" }] }, t)).text,
    ).toBe("Already proposed.");
    if (!r.card) throw new Error("no card");
    await t.reads.ignore(t.docId, "pitch", cardKey(r.card));
    const t2 = { ...t, readId: (await t.reads.start(t.docId, "d2", 10)).id };
    const again = await runReadTool("pitch", { thesis, supports: [{ span, role: "finding" }] }, t2);
    expect(again.card).toBeUndefined();
  });

  it("puts nothing on the page when nothing kept would show", () => {
    expect(
      evidence({
        read: readRow("doc"),
        cards: [
          card({ kind: "coinage" }),
          card({ kind: "figure", data: { figure: "9%", measures: "x", rejected: true } }),
          card({
            origin: "shape",
            kind: "question_answered",
            data: { question: "Q?", answer: "A." },
          }),
        ],
      }),
    ).toBeNull();
  });

  it("leaves a read that stopped short as still reading, with its cost counted", async () => {
    const doc = publicResearch().find((d) => d.body.length > 2000);
    if (!doc) throw new Error("no doc");
    const store = memoryDrafts();
    const reads = memoryReads();
    const d = await store.create("read");
    const read = await reads.start(doc.id, d.id, doc.body.length);
    await store.save(d.id, { meta: { based_on: [doc.id], readId: read.id } });
    const { stream } = fakeStream([
      msg(
        [{ type: "tool_use", id: "r1", name: "read_document", input: { id: doc.id } }],
        "tool_use",
      ),
    ]);
    await runTurn({
      stream,
      env,
      store,
      reads,
      draftId: d.id,
      text: "Read it.",
      emit: () => {},
      maxSteps: 1,
    });
    const after = await reads.get(read.id);
    expect(after?.status).toBe("reading");
    expect(after?.cents).toBeGreaterThan(0);
  });
});

describe("a coined name or open problem joins Ideas", () => {
  it("offers the author's own paragraph only once a card is kept, then links to it", () => {
    const coin = card({ kind: "coinage", status: "kept", data: { flag: "no single name exists" } });
    const board = (cs: Derivation[]) =>
      renderReadBoard(readRow("doc"), cs, "Doc", { topics: ["Housing"] });
    expect(board([coin])).toContain(`/op/read/card/${coin.id}/idea`);
    expect(board([coin])).toContain("What it names — in your words");
    expect(board([{ ...coin, status: "proposed" }])).not.toContain("/idea");
    expect(board([{ ...coin, data: { ideaRoute: "/concepts/the-vacancy-shadow" } }])).toContain(
      'href="/concepts/the-vacancy-shadow"',
    );
  });
});

describe("a shown read's figures and open questions join the record's lists", () => {
  it("lists them with the Library's figures and questions, linked to the passage, never for a held document", async () => {
    const { keyFigures, questions } = await import("../src/site/content/store");
    const doc = publicResearch()[0];
    const held = heldResearch()[0];
    if (!doc) throw new Error("no public research");
    const fig = (docId: string) =>
      card({
        docId,
        kind: "figure",
        span: "The registry counted 98,765 units in 2024",
        data: { figure: "98,765", measures: "units" },
      });
    setShownReads([
      {
        read: readRow(doc.id),
        cards: [
          fig(doc.id),
          card({
            docId: doc.id,
            kind: "question_open",
            span: "No study has measured what happened to tenants who left.",
          }),
        ],
      },
      ...(held
        ? [
            {
              read: { ...readRow(held.id), id: "r2" },
              cards: [
                card({ ...fig(held.id), readId: "r2", span: "A held figure of 55,555 people" }),
              ],
            },
          ]
        : []),
    ]);
    const f = keyFigures().find((r) => r.v === "98,765");
    expect(f?.route).toContain(`/p/${doc.id}#q=`);
    expect(f?.topic).toBe(doc.topic);
    expect(questions().some((q) => q.title.startsWith("No study has measured"))).toBe(true);
    expect(keyFigures().some((r) => r.title.includes("55,555"))).toBe(false);
    setShownReads([]);
    expect(keyFigures().some((r) => r.v === "98,765")).toBe(false);
  });
});

describe("documents that cite the same pages", () => {
  it("normalises a cited page: scheme, www, trailing slash and punctuation aside", async () => {
    const { citedUrls } = await import("../src/site/content/store");
    expect(
      citedUrls(
        "See https://www.Example.org/a/ and (http://example.org/a). Also https://b.example/x?id=2#top.",
      ),
    ).toEqual(["example.org/a", "b.example/x?id=2"]);
  });

  it("links both ways, newest first, only to public documents", async () => {
    const { sharedSources, citedUrls } = await import("../src/site/content/store");
    const docs = publicResearch();
    const a = docs.find((d) => sharedSources(d.id).length > 0);
    if (!a) throw new Error("no two public documents share a cited page");
    const links = sharedSources(a.id);
    const b = links[0];
    if (!b) throw new Error("no link");
    const bId = b.route.slice("/p/".length);
    expect(sharedSources(bId).some((x) => x.route === `/p/${a.id}`)).toBe(true);
    const common = citedUrls(a.body).filter((u) =>
      citedUrls(publicResearch().find((d) => d.id === bId)?.body ?? "").includes(u),
    );
    expect(b.common).toBe(common.length);
    expect([...links].sort((x, y) => y.date.localeCompare(x.date))).toEqual(links);
    const heldIds = new Set(heldResearch().map((d) => d.id));
    for (const d of docs)
      for (const l of sharedSources(d.id)) expect(heldIds.has(l.route.slice(3))).toBe(false);
  });
});
