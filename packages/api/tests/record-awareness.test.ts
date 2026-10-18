// What the workspace's Claude knows about the record, and what it shows while
// it works: it lists, searches and reads Chris's own articles and papers but
// can never quote one as a source; its progress notes between tool calls
// reach the chat and survive a reload; and the record's own titles and topics
// are the documents' real ones.

import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { allArticles, publicResearch, researchDoc } from "../src/site/content/store";
import { type StreamFn, type WriteEvent, runTurn, transcript } from "../src/write/agent";
import { checkQuotes } from "../src/write/check";
import { memoryDrafts } from "../src/write/drafts";
import { ownWriting, ownWritingText, searchOwnWriting, sourceTexts } from "../src/write/sources";

function stubDb(): D1Database {
  const stmt = {
    bind: () => stmt,
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ results: [], meta: { changes: 0 } }),
  };
  return {
    prepare: () => stmt,
    batch: async () => [],
    exec: async () => ({}),
  } as unknown as D1Database;
}
const env = { LOG_LEVEL: "error", DB: stubDb() } as unknown as Env;

type Block = Anthropic.Beta.BetaContentBlock;
const msg = (content: unknown[], stop: string) =>
  ({
    id: "m",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: content as Block[],
    stop_reason: stop,
    usage: {
      input_tokens: 10,
      output_tokens: 10,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  }) as unknown as Anthropic.Beta.BetaMessage;

/** A fake model that also streams its thinking blocks, as the SDK does. */
function fakeStream(script: Anthropic.Beta.BetaMessage[]) {
  const calls: unknown[] = [];
  const stream: StreamFn = (params) => {
    calls.push(structuredClone(params));
    const m = script.shift() ?? msg([{ type: "text", text: "(out of script)" }], "end_turn");
    const handlers: Record<string, Array<(x: unknown) => void>> = {};
    return {
      on(event: string, cb: (x: never) => void) {
        handlers[event] = [...(handlers[event] ?? []), cb as (x: unknown) => void];
        return this;
      },
      async finalMessage() {
        m.content.forEach((b, index) => {
          const fire = (e: unknown) => {
            for (const h of handlers.streamEvent ?? []) h(e);
          };
          fire({
            type: "content_block_start",
            index,
            content_block: { ...b, ...(b.type === "thinking" ? { thinking: "" } : {}) },
          });
          if (b.type === "thinking")
            fire({
              type: "content_block_delta",
              index,
              delta: { type: "thinking_delta", thinking: b.thinking },
            });
          if (b.type === "text") for (const h of handlers.text ?? []) h(b.text);
          fire({ type: "content_block_stop", index });
        });
        return m;
      },
    } as unknown as ReturnType<StreamFn>;
  };
  return { stream, calls };
}

describe("Claude knows Chris's own writing, and never quotes it", () => {
  it("lists, searches and reads articles and papers apart from the sources", async () => {
    const mine = ownWriting();
    expect(mine.length).toBeGreaterThanOrEqual(30);
    expect(mine.some((w) => w.kind === "Paper")).toBe(true);
    const a = allArticles().find((x) => !x.withdrawn);
    if (!a) throw new Error("no article");
    expect(ownWritingText(a.slug)?.text).toBe(a.body);
    expect(searchOwnWriting(a.title.split(/\s+/).slice(0, 2).join(" ")).length).toBeGreaterThan(0);
  });

  it("fails a quotation taken from an article: only research documents are sources", async () => {
    const a = allArticles().find((x) => !x.withdrawn && x.body.length > 400);
    if (!a) throw new Error("no article");
    const passage = a.body.slice(200, 260);
    const body = `<q doc="${a.slug}" section="x">${passage}</q>`;
    const texts = await sourceTexts(env, [a.slug]);
    expect(checkQuotes(body, texts).failed).toHaveLength(1);
  });

  it("tells Claude, in the list and when it reads one, that an article is not a source", async () => {
    const a = allArticles().find((x) => !x.withdrawn);
    const doc = publicResearch()[0];
    if (!a || !doc) throw new Error("no record");
    const store = memoryDrafts();
    const d = await store.create("article");
    const { stream } = fakeStream([
      msg(
        [
          { type: "tool_use", id: "l1", name: "list_documents", input: {} },
          { type: "tool_use", id: "r1", name: "read_document", input: { id: a.slug } },
        ],
        "tool_use",
      ),
      msg([{ type: "text", text: "Done." }], "end_turn"),
    ]);
    await runTurn({
      stream,
      env,
      store,
      draftId: d.id,
      text: "What have I written?",
      emit: () => {},
    });
    const results = JSON.stringify((await store.messages(d.id)).at(-2));
    expect(results).toContain("RESEARCH DOCUMENTS");
    expect(results).toContain("CHRIS'S OWN ARTICLES AND PAPERS");
    expect(results).toContain("it is not a source");
  });
});

describe("progress notes", () => {
  it("are requested, reach the chat as Claude works, and show again after a reload", async () => {
    const store = memoryDrafts();
    const d = await store.create("research");
    const { stream, calls } = fakeStream([
      msg(
        [
          { type: "thinking", thinking: "", signature: "s0" },
          {
            type: "thinking",
            thinking: "The registry counts listings, not homes; checking the city's own data next.",
            signature: "s1",
          },
          { type: "tool_use", id: "l1", name: "list_documents", input: {} },
        ],
        "tool_use",
      ),
      msg([{ type: "text", text: "Done." }], "end_turn"),
    ]);
    const events: WriteEvent[] = [];
    await runTurn({ stream, env, store, draftId: d.id, text: "Go.", emit: (e) => events.push(e) });
    const p = calls[0] as { thinking: { display: string }; betas: string[] };
    expect(p.thinking.display).toBe("updates");
    expect(p.betas).toContain("thinking-display-updates-2026-08-18");
    expect(events.filter((e) => e.type === "update")).toEqual([
      {
        type: "update",
        text: "The registry counts listings, not homes; checking the city's own data next.",
      },
    ]);
    const items = transcript(await store.messages(d.id));
    expect(items.filter((i) => i.who === "update").map((i) => i.text)).toEqual([
      "The registry counts listings, not homes; checking the city's own data next.",
    ]);
  });
});

describe("the record's titles and topics", () => {
  it("are the documents' real ones", () => {
    for (const d of publicResearch())
      expect(d.title, d.id).not.toMatch(
        /^(title and executive summary|compiled:|introduction:|carney as central banker|gary anandasangaree)/i,
      );
    expect(
      researchDoc("oral-only-interventions-across-every-layer-of-skin-structure-a-complet")?.topic,
    ).toBe("Health & self-care");
    expect(researchDoc("the-aldershot-product-bible-v1-0-september-2026")?.topic).toBe(
      "Video & design",
    );
    expect(
      researchDoc("the-telescope-problem-where-ai-and-real-time-data-make-the-invisible-e")?.date,
    ).toBe("2026-09-01");
  });
});
