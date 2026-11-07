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

// One model on its own (the default is the research team).
const FLASH = "@cf/deepseek-ai/deepseek-v4.1-flash-1017";

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
      vi.fn(async () => new Response(page, { headers: { "content-type": "text/html" } })),
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
    const calls: Array<{ model: string; input: Record<string, unknown>; opts?: unknown }> = [];
    const env = {
      LOG_LEVEL: "error",
      DB: stubDb(),
      SEARCH_GATEWAY_ID: "canopticon-search",
      AI: {
        websearch: async () => ({
          items: [{ title: "Rent study", url: "https://a.example/page", snippet: "Rents fell." }],
        }),
        run: async (model: string, input: Record<string, unknown>, opts?: unknown) => {
          calls.push({ model, input: structuredClone(input), opts });
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
      defaultEngine: FLASH,
      env,
      store,
      sources,
      draftId: d.id,
      text: "Did the bans lower rents?",
      emit: (e) => events.push(e as never),
    });

    expect(events.filter((e) => e.type === "error")).toEqual([]);
    expect(calls).toHaveLength(4);
    expect(calls[0]?.model).toBe(FLASH);
    // Every step of one conversation goes to the instance holding its cache.
    expect(calls.map((c) => c.opts)).toEqual(
      calls.map(() => ({ headers: { "x-session-affinity": `ses_${d.id}` } })),
    );
    const fnNames = (calls[0]?.input.tools as Array<{ function: { name: string } }>).map(
      (t) => t.function.name,
    );
    expect(fnNames).toEqual(
      expect.arrayContaining([
        "web_search",
        "web_fetch",
        "write_outline",
        "note_evidence",
        "write_section",
      ]),
    );
    // The page was kept, so the report's quotation is checked against it.
    expect((await sources.texts(d.id)).map((p) => p.url)).toEqual(["https://a.example/page"]);
    const toolMessages = (
      calls[3]?.input.messages as Array<{ role: string; content: string }>
    ).filter((m) => m.role === "tool");
    expect(toolMessages.at(-1)?.content).toContain("all found word for word");
    const saved = await store.get(d.id);
    expect(saved?.meta).toMatchObject({ title: "Rent bans", engine: FLASH });
    expect(draftEngine(saved as never, CLAUDE)).toBe(FLASH);
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
  it("uses Cloudflare's Web Search when it is set up and answers", async () => {
    const { webSearch } = await import("../src/write/engines");
    const outside = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", outside);
    const asked: unknown[] = [];
    const env = {
      SEARCH_GATEWAY_ID: "canopticon-search",
      AI: {
        websearch: async (i: unknown) => {
          asked.push(i);
          return {
            result: { items: [{ title: "C&amp;D", url: "https://c.example", snippet: "s" }] },
          };
        },
      },
    } as unknown as Env;
    const hits = await webSearch(env, "rents");
    expect(hits).toEqual([{ title: "C&D", url: "https://c.example", description: "s" }]);
    expect(asked[0]).toMatchObject({ query: "rents", gatewayId: "canopticon-search" });
    // The free finder (tests/finder.test.ts) is not asked when it answers.
    expect(outside).not.toHaveBeenCalled();
  });
});

describe("the audit's fixes", () => {
  it("does not take the prose between two short quoted terms for a quotation", async () => {
    const { reportQuotations } = await import("../src/write/research");
    const body =
      'The plan calls itself "net zero" but the accounting behind it, which this report examines at length, counts only "scope 1" emissions.\n\nThe filing says "the company will reach net zero across all three scopes by the year 2040" [1].';
    expect(reportQuotations(body)).toEqual([
      "the company will reach net zero across all three scopes by the year 2040",
    ]);
  });

  it("gives the page's own words when a quotation is not found", async () => {
    const { checkReport, describeReportCheck } = await import("../src/write/research");
    const pages = [
      {
        url: "https://a.example",
        title: null,
        retrievedAt: null,
        kind: "text" as const,
        text: "The survey of 1,200 households found that rents fell by 4.1 percent in the first year after the ban.",
      },
    ];
    const body =
      'It found "rents fell by 4.1 percent in the first twelve months after the ban took effect" [1].';
    const line = describeReportCheck(checkReport(body, pages), pages);
    expect(line).toContain("NOT FOUND");
    expect(line).toContain("The page https://a.example says, word for word:");
    expect(line).toContain("rents fell by 4.1 percent in the first year after the ban");
  });

  it("treats a reply cut off mid-call as cut off, and says so for unreadable arguments", async () => {
    const m = fromChat(
      reply({ content: null, tool_calls: [call("c1", "write_report", { title: "x" })] }, "length"),
      DEFAULT_ENGINE,
    );
    expect(m.stop_reason).toBe("max_tokens");
    const bad = fromChat(
      reply(
        {
          content: null,
          tool_calls: [
            {
              id: "c2",
              type: "function",
              function: { name: "write_report", arguments: '{"title": "x", "bo' },
            },
          ],
        },
        "tool_calls",
      ),
      DEFAULT_ENGINE,
    );
    expect((bad.content[0] as { input: Record<string, unknown> }).input).toHaveProperty(
      "_unreadable",
    );
  });

  it("sheds older page reads from a long Workers AI conversation, in batches", async () => {
    const { CHAT_CLEAR_CHARS } = await import("../src/write/engines");
    const big = "x".repeat(Math.ceil(CHAT_CLEAR_CHARS / 10));
    const history: Message[] = [{ role: "user", content: [{ type: "text", text: "Go." }] }];
    for (let i = 0; i < 18; i++) {
      history.push({
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: `f${i}`,
            name: "web_fetch",
            input: { url: `https://p${i}.example` },
          },
        ],
      } as Message);
      history.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: `f${i}`, content: big }],
      } as Message);
    }
    const chat = toChat("S", history);
    const tools = chat.filter((m) => m.role === "tool");
    // 18 reads: the oldest 8 cleared (a batch of eight), the latest 10 whole.
    expect(tools.filter((m) => m.content?.startsWith("[Cleared")).length).toBe(8);
    expect(tools.at(-1)?.content).toBe(big);
    expect(toChat("S", history.slice(0, 7)).some((m) => m.content?.startsWith("[Cleared"))).toBe(
      false,
    );
  });

  it("reads a page once: the second ask comes from what was kept, and parallel reads all run", async () => {
    const fetches: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        fetches.push(String(url));
        return new Response(`<p>${"A long enough page about rents. ".repeat(20)}</p>`, {
          headers: { "content-type": "text/html" },
        });
      }),
    );
    const script = [
      reply(
        {
          content: null,
          tool_calls: [
            call("a", "web_fetch", { url: "https://one.example" }),
            call("b", "web_fetch", { url: "https://two.example" }),
          ],
        },
        "tool_calls",
      ),
      reply(
        { content: null, tool_calls: [call("c", "web_fetch", { url: "https://one.example" })] },
        "tool_calls",
      ),
      reply({ content: "Done." }),
    ];
    const seen: Array<Record<string, unknown>> = [];
    const env = {
      LOG_LEVEL: "error",
      DB: stubDb(),
      AI: {
        run: async (_m: string, input: Record<string, unknown>) => {
          seen.push(structuredClone(input));
          return script.shift();
        },
      },
    } as unknown as Env;
    const store = memoryDrafts();
    const sources = memorySources();
    const d = await store.create("research");
    await runTurn({
      stream: null,
      defaultEngine: DEFAULT_ENGINE,
      env,
      store,
      sources,
      draftId: d.id,
      text: "Go.",
      emit: () => {},
    });
    expect(fetches.sort()).toEqual(["https://one.example", "https://two.example"]);
    expect((await sources.texts(d.id)).length).toBe(2);
    const last = (seen[2]?.messages as Array<{ role: string; content: string }>)
      .filter((m) => m.role === "tool")
      .at(-1);
    expect(last?.content).toContain("You have read this page already");
  });
});

describe("trial engines", () => {
  it("run through the test probe but are not offered", async () => {
    const { TRIAL_ENGINES, ENGINES, engine, isWorkersAi } = await import("../src/write/engines");
    for (const t of TRIAL_ENGINES) {
      expect(engine(t.id).id).toBe(t.id);
      expect(isWorkersAi(t.id)).toBe(true);
      expect(ENGINES.some((e) => e.id === t.id)).toBe(false);
    }
  });
});

describe("Workers AI's limits", () => {
  it("waits and asks again after the per-minute limit, and gives up after four", async () => {
    const { workersStep, setSleep, RETRY_WAITS } = await import("../src/write/engines");
    const waits: number[] = [];
    setSleep(async (ms) => {
      waits.push(ms);
    });
    let calls = 0;
    const ok = {
      choices: [{ message: { role: "assistant", content: "Fine." }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    };
    const env = {
      AI: {
        run: async () => {
          calls++;
          if (calls < 3)
            throw new Error("3021: rate limiting: inference request per min rate reached");
          return ok;
        },
      },
    } as unknown as Env;
    const m = await workersStep(env, "@cf/x/y", "sys", [], [{ role: "user", content: "Hi" }]);
    expect(m.content).toMatchObject([{ type: "text", text: "Fine." }]);
    // Each wait is the step's, plus up to five seconds so retries spread out.
    expect(waits).toHaveLength(2);
    waits.forEach((w, i) => {
      expect(w).toBeGreaterThanOrEqual(RETRY_WAITS[i] ?? 0);
      expect(w).toBeLessThan((RETRY_WAITS[i] ?? 0) + 5_000);
    });

    calls = -100;
    await expect(
      workersStep(env, "@cf/x/y", "sys", [], [{ role: "user", content: "Hi" }]),
    ).rejects.toThrow(/3021/);
    expect(waits).toHaveLength(2 + RETRY_WAITS.length);
    setSleep((ms) => new Promise((r) => setTimeout(r, ms)));
  });
});

describe("the per-model gate", () => {
  it("lets a few requests run at once, and fewer after Workers AI says too many", async () => {
    const { workersStep, setSleep, gate } = await import("../src/write/engines");
    setSleep(async () => {});
    let now = 0;
    let most = 0;
    let first = true;
    const env = {
      AI: {
        run: async () => {
          now++;
          most = Math.max(most, now);
          await new Promise((r) => setTimeout(r, 5));
          now--;
          if (first) {
            first = false;
            throw new Error("3021: rate limiting: inference request per min rate reached");
          }
          return {
            choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          };
        },
      },
    } as unknown as Env;
    const model = "@cf/test/gate";
    const before = gate(model).limit;
    await Promise.all(
      Array.from({ length: 12 }, () =>
        workersStep(env, model, "s", [], [{ role: "user", content: "Hi" }]),
      ),
    );
    expect(most).toBeLessThanOrEqual(before);
    expect(gate(model).active).toBe(0);
    setSleep((ms) => new Promise((r) => setTimeout(r, ms)));
  });
});
