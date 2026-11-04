// The workspace on Workers AI: the same conversation, tools and checks as on
// Claude, with the model reached through env.AI.run in the OpenAI chat
// format, and the web through our own search and fetch.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import { renderWriteList } from "../src/site/pages/write";
import { runTurn, transcript } from "../src/write/agent";
import { type Message, memoryDrafts } from "../src/write/drafts";
import {
  CLAUDE,
  DEFAULT_ENGINE,
  draftEngine,
  fromChat,
  htmlText,
  toChat,
  toFunctions,
} from "../src/write/engines";
import { articleTopics } from "../src/write/publish";
import { memorySources } from "../src/write/research";

function stubDb(): D1Database {
  const stmt = {
    bind: () => stmt,
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ results: [], meta: { changes: 0 } }),
  };
  return { prepare: () => stmt } as unknown as D1Database;
}

// Typed as never: the reply type is internal to engines.ts.
const reply = (message: Record<string, unknown>, finish = "stop", usage = {}): never =>
  ({
    choices: [{ index: 0, message: { role: "assistant", ...message }, finish_reason: finish }],
    usage: { prompt_tokens: 1000, completion_tokens: 200, ...usage },
  }) as never;
const call = (id: string, name: string, args: unknown) => ({
  id,
  type: "function",
  function: { name, arguments: JSON.stringify(args) },
});

afterEach(() => vi.unstubAllGlobals());

describe("the conversation in the OpenAI chat format", () => {
  it("pairs tool calls and results by id, keeps what was said, and leaves reasoning out", () => {
    const history: Message[] = [
      { role: "user", content: [{ type: "text", text: "Did the bans lower rents?" }] },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "", signature: "s" },
          { type: "text", text: "Searching." },
          { type: "tool_use", id: "t1", name: "web_search", input: { query: "rent ban" } },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "t1", content: "1. A page", is_error: false },
        ],
      },
    ] as unknown as Message[];
    const chat = toChat("SYSTEM", history);
    expect(chat.map((m) => m.role)).toEqual(["system", "user", "assistant", "tool"]);
    expect(chat[2]).toMatchObject({
      content: "Searching.",
      tool_calls: [
        { id: "t1", function: { name: "web_search", arguments: '{"query":"rent ban"}' } },
      ],
    });
    expect(chat[3]).toMatchObject({ tool_call_id: "t1", content: "1. A page" });
    const fns = toFunctions([
      { name: "x", description: "d", input_schema: { type: "object", properties: {} } },
      { type: "web_search_20260209", name: "web_search" },
    ] as never);
    expect(fns).toEqual([
      {
        type: "function",
        function: { name: "x", description: "d", parameters: { type: "object", properties: {} } },
      },
    ]);
  });

  it("reads a reply back as tool_use blocks, with cached tokens counted apart", () => {
    const m = fromChat(
      reply(
        { content: null, tool_calls: [call("c1", "web_fetch", { url: "https://a.example" })] },
        "tool_calls",
        {
          prompt_tokens_details: { cached_tokens: 600 },
        },
      ),
      DEFAULT_ENGINE,
    );
    expect(m.stop_reason).toBe("tool_use");
    expect(m.content).toEqual([
      { type: "tool_use", id: "c1", name: "web_fetch", input: { url: "https://a.example" } },
    ]);
    expect(m.usage).toMatchObject({
      input_tokens: 400,
      cache_read_input_tokens: 600,
      output_tokens: 200,
    });
    expect(fromChat(reply({ content: "Done." }, "length"), DEFAULT_ENGINE).stop_reason).toBe(
      "max_tokens",
    );
  });

  it("turns HTML into text when the converter is missing", () => {
    expect(htmlText("<p>One &amp; two</p><script>x()</script><p>Three</p>")).toBe(
      "One & two\nThree",
    );
  });
});

describe("a research turn on Workers AI", () => {
  it("searches, reads, keeps the page, writes a checked report, and costs the model's price", async () => {
    const page =
      "<html><body><h1>Rent study</h1><p>The survey of 1,200 households found that rents fell by 4.1 percent in the first year after the ban.</p><p>Other factors also mattered, and the authors say so at length in the discussion that follows this paragraph of the study.</p></body></html>";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("api.search.brave.com")
          ? new Response(
              JSON.stringify({
                web: {
                  results: [
                    {
                      title: "Rent study",
                      url: "https://a.example/page",
                      description: "A <b>study</b>",
                    },
                  ],
                },
              }),
              { headers: { "content-type": "application/json" } },
            )
          : new Response(page, { headers: { "content-type": "text/html" } }),
      ),
    );
    const topic = articleTopics()[0] ?? "Housing";
    const body = `## TL;DR\nThe study says "rents fell by 4.1 percent in the first year after the ban" [1].\n\n## Sources\n1. [Rent study](https://a.example/page)`;
    const script = [
      reply(
        {
          content: "Searching first.",
          tool_calls: [call("s1", "web_search", { query: "rent ban study" })],
        },
        "tool_calls",
      ),
      reply(
        { content: null, tool_calls: [call("f1", "web_fetch", { url: "https://a.example/page" })] },
        "tool_calls",
      ),
      reply(
        {
          content: null,
          tool_calls: [call("w1", "write_report", { title: "Rent bans", topic, body })],
        },
        "tool_calls",
      ),
      reply({ content: "The report is on the right." }),
    ];
    const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
    const env = {
      LOG_LEVEL: "error",
      DB: stubDb(),
      BRAVE_SEARCH_API_KEY: "test",
      AI: {
        run: async (model: string, input: Record<string, unknown>) => {
          calls.push({ model, input: structuredClone(input) });
          return script.shift();
        },
        toMarkdown: async () => [{ format: "error", error: "unsupported in tests" }],
      },
    } as unknown as Env;
    const store = memoryDrafts();
    const sources = memorySources();
    const d = await store.create("research");
    const events: Array<{ type: string; text?: string; message?: string }> = [];
    await runTurn({
      stream: null,
      defaultEngine: DEFAULT_ENGINE,
      env,
      store,
      sources,
      draftId: d.id,
      text: "Did the bans lower rents?",
      emit: (e) => events.push(e as never),
    });

    expect(events.filter((e) => e.type === "error")).toEqual([]);
    expect(calls).toHaveLength(4);
    expect(calls[0]?.model).toBe(DEFAULT_ENGINE);
    const fnNames = (calls[0]?.input.tools as Array<{ function: { name: string } }>).map(
      (t) => t.function.name,
    );
    expect(fnNames).toEqual(expect.arrayContaining(["web_search", "web_fetch", "write_report"]));
    // The page was kept, so the report's quotation is checked against it.
    expect((await sources.texts(d.id)).map((p) => p.url)).toEqual(["https://a.example/page"]);
    const toolMessages = (
      calls[3]?.input.messages as Array<{ role: string; content: string }>
    ).filter((m) => m.role === "tool");
    expect(toolMessages.at(-1)?.content).toContain("all found word for word");
    const saved = await store.get(d.id);
    expect(saved?.meta).toMatchObject({ title: "Rent bans", engine: DEFAULT_ENGINE });
    expect(draftEngine(saved as never, CLAUDE)).toBe(DEFAULT_ENGINE);
    // 4 calls × (1000 in, 200 out) at $0.30 / $1.20 per million: 0.216 cents.
    expect(saved?.usage.cents).toBeCloseTo(0.216, 3);
    expect(events).toEqual(
      expect.arrayContaining([
        { type: "update", text: "Searching first." },
        { type: "text", text: "The report is on the right." },
        { type: "activity", text: "This message: 1 web search · 1 page read" },
      ]),
    );
    // The chat shows the same as it would for Claude.
    expect(transcript(await store.messages(d.id)).map((i) => i.who)).toContain("claude");
  });

  it("refuses a Claude conversation when Claude is not connected, without touching it", async () => {
    const store = memoryDrafts();
    const d = await store.create("article");
    const events: Array<{ type: string; message?: string }> = [];
    await runTurn({
      stream: null,
      defaultEngine: CLAUDE,
      env: { LOG_LEVEL: "error", DB: stubDb() } as unknown as Env,
      store,
      draftId: d.id,
      text: "Write.",
      emit: (e) => events.push(e as never),
    });
    expect(events[0]?.message).toMatch(/Claude is not connected/);
    expect(await store.messages(d.id)).toEqual([]);
  });
});

describe("choosing the engine", () => {
  it("offers every engine with its price, and needs no Claude key for a Workers AI default", () => {
    const page = renderWriteList([], { hasKey: false, engine: DEFAULT_ENGINE });
    expect(page).toContain('name="engine"');
    expect(page).toContain(`value="${DEFAULT_ENGINE}" selected`);
    expect(page).toContain("Claude Opus 5.5");
    expect(page).not.toContain("Claude is not connected yet");
    expect(renderWriteList([], { hasKey: false, engine: CLAUDE })).toContain(
      "Claude is not connected yet",
    );
  });
});

describe("a page as the model reads it", () => {
  it("keeps the words of links, drops images, front matter and entity codes", async () => {
    const { readable, entities } = await import("../src/write/engines");
    const md =
      '---\ntitle: Hamilton, Ontario - Wikipedia\n---\n\n![A view](https://x/y.jpg)\nHamilton is a [port city](https://en.wikipedia.org/wiki/Port_city "Port city") in [Ontario](https://en.wikipedia.org/wiki/Ontario_(province)).\n\n\n\nIt&#x27;s &amp; more.';
    expect(readable(md)).toBe("Hamilton is a port city in Ontario.\n\nIt's & more.");
    expect(entities("CMHC&#x27;s")).toBe("CMHC's");
  });
});

describe("searching the web", () => {
  it("asks Cloudflare's Web Search first, and Brave only when it fails", async () => {
    const { webSearch } = await import("../src/write/engines");
    const brave = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            web: { results: [{ title: "B", url: "https://b.example", description: "" }] },
          }),
        ),
    );
    vi.stubGlobal("fetch", brave);
    const asked: unknown[] = [];
    const env = (websearch: (i: unknown) => Promise<unknown>) =>
      ({
        SEARCH_GATEWAY_ID: "canopticon-search",
        BRAVE_SEARCH_API_KEY: "k",
        AI: { websearch },
      }) as unknown as Env;
    const hits = await webSearch(
      env(async (i) => {
        asked.push(i);
        return {
          result: { items: [{ title: "C&amp;D", url: "https://c.example", snippet: "s" }] },
        };
      }),
      "rents",
    );
    expect(hits).toEqual([{ title: "C&D", url: "https://c.example", description: "s" }]);
    expect(asked[0]).toMatchObject({ query: "rents", gatewayId: "canopticon-search" });
    expect(brave).not.toHaveBeenCalled();
    const fallback = await webSearch(
      env(async () => {
        throw new Error("Invalid gateway ID");
      }),
      "rents",
    );
    expect(fallback.map((h) => h.url)).toEqual(["https://b.example"]);
  });
});
