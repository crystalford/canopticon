// Ask the record — the record answers only in its own verified words, and
// says when it cannot.
//
// What matters is not the prose. It is that a quote the model invented never
// reaches the page, that an answer with no surviving quote is stored as
// "nothing_found" rather than as an unsupported assertion, and that the
// frozen row is shown to every reader while the buttons that spend a writer
// call are shown only to the operator.

import { beforeEach, describe, expect, it, vi } from "vitest";

const writer = vi.fn();
vi.mock("../src/llm/router", () => ({
  callResearchWriter: (...args: unknown[]) => writer(...args),
}));

vi.mock("../src/graph/lib/embeddings", () => ({
  searchVectors: async (_env: unknown, args: { kinds?: string[] }) => {
    if (args.kinds?.includes("quote")) {
      return [
        { id: "quote:q1", score: 0.9, metadata: { kind: "quote", id: "q1", user_id: "op1" } },
      ];
    }
    return [];
  },
  rerankResults: async <T>(_env: unknown, _q: string, items: T[]) => items,
}));

import {
  type RetrievedDoc,
  answerQuestion,
  questionKey,
  storedAnswerForQuestion,
  windowAround,
} from "../src/graph/lib/answer-question";
import { renderSearchPage } from "../src/public/render/search";

const HOUSING: RetrievedDoc = {
  id: "p1",
  slug: "budget-2026",
  title: "Budget 2026: Main Estimates",
  body_md:
    "Departmental spending for the 2026 cycle was tabled on 4 March.\n\n" +
    "The housing figure is the one worth pausing on. It is the largest " +
    "proportional increase in the table.",
};
const TRANSFERS: RetrievedDoc = {
  id: "p2",
  slug: "transfer-payments",
  title: "Transfer Payments 2025",
  body_md: "Housing funding was unchanged in 2026 relative to the prior cycle.",
};
const retrieve = async () => [HOUSING, TRANSFERS];

/** A D1 stub that records every INSERT so the persisted row can be inspected. */
function fakeEnv() {
  const inserts: Array<{ sql: string; params: unknown[] }> = [];
  const mk = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        bound = args;
        return stmt;
      },
      async first() {
        return null;
      },
      async all() {
        return { results: [] };
      },
      async run() {
        if (/^INSERT/i.test(sql)) inserts.push({ sql, params: bound });
        return { results: [], meta: { changes: 1 } };
      },
    };
    return stmt;
  };
  const env = { DB: { prepare: mk } } as unknown as Parameters<typeof answerQuestion>[0];
  return { env, inserts };
}

function reply(
  answer: string,
  quotes: Array<{ text: string; slug?: string }>,
  cannot_answer = false,
) {
  writer.mockResolvedValueOnce({
    text: "",
    structured: { answer, quotes, cannot_answer },
    model: "claude-test",
  });
}

function storedRow(inserts: Array<{ sql: string; params: unknown[] }>) {
  const ins = inserts.find((i) => /INSERT INTO lead_answers/.test(i.sql));
  if (!ins) throw new Error("no lead_answers row written");
  const cols =
    ins.sql
      .match(/\(([^)]+)\)/)?.[1]
      ?.split(",")
      .map((c) => c.trim()) ?? [];
  return Object.fromEntries(cols.map((c, i) => [c, ins.params[i]]));
}

beforeEach(() => writer.mockReset());

describe("questionKey", () => {
  it("treats the same question asked twice as the same question", async () => {
    const a = await questionKey("Did housing funding change in 2026?");
    const b = await questionKey("  did  HOUSING funding change in 2026 ");
    expect(a).toBe(b);
    expect(a).not.toBe(await questionKey("did housing funding change in 2025"));
  });
});

describe("answerQuestion", () => {
  it("keeps a verbatim quote, links it to its document, and stores kind question", async () => {
    const { env, inserts } = fakeEnv();
    reply("Housing spending rose; the estimates attribute it to a transfer.", [
      { text: "The housing figure is the one worth pausing on.", slug: "budget-2026" },
    ]);
    const out = await answerQuestion(env, "op1", "Did housing spending change?", { retrieve });
    expect(out.status).toBe("answered");
    expect(out.quotes).toHaveLength(1);
    expect(out.quotes[0]?.slug).toBe("budget-2026");
    expect(out.discarded).toBe(0);
    const row = storedRow(inserts);
    expect(row.kind).toBe("question");
    expect(row.status).toBe("answered");
    expect(row.lead_key).toBe(await questionKey("Did housing spending change?"));
    // The prompt says the quotes will be checked and dropped, and tells the
    // model to say so rather than guess.
    const call = writer.mock.calls[0]?.[1] as { system: string; max_tokens: number };
    expect(call.system).toMatch(/MECHANICALLY CHECKED/);
    expect(call.system).toMatch(/cannot_answer/);
    expect(call.max_tokens).toBe(700);
  });

  it("keeps a right quote the model filed under the wrong document", async () => {
    const { env } = fakeEnv();
    reply("Funding was unchanged.", [
      {
        text: "Housing funding was unchanged in 2026 relative to the prior cycle.",
        slug: "budget-2026",
      },
    ]);
    const out = await answerQuestion(env, "op1", "Did housing funding change?", { retrieve });
    expect(out.status).toBe("answered");
    expect(out.quotes[0]?.slug).toBe("transfer-payments");
  });

  it("discards a fabricated quote and counts it, keeping the real one", async () => {
    const { env, inserts } = fakeEnv();
    reply("Two things.", [
      { text: "The minister confirmed this at a press conference.", slug: "budget-2026" },
      {
        text: "Departmental spending for the 2026 cycle was tabled on 4 March.",
        slug: "budget-2026",
      },
    ]);
    const out = await answerQuestion(env, "op1", "When was spending tabled?", { retrieve });
    expect(out.status).toBe("answered");
    expect(out.quotes).toHaveLength(1);
    expect(out.discarded).toBe(1);
    expect(storedRow(inserts).discarded).toBe(1);
  });

  it("stores nothing_found when the model says it cannot answer", async () => {
    const { env, inserts } = fakeEnv();
    reply(
      "The documents cover spending but not the minister's name.",
      [
        {
          text: "Departmental spending for the 2026 cycle was tabled on 4 March.",
          slug: "budget-2026",
        },
      ],
      true,
    );
    const out = await answerQuestion(env, "op1", "Who is the minister?", { retrieve });
    expect(out.status).toBe("nothing_found");
    expect(out.quotes).toHaveLength(0);
    expect(storedRow(inserts).status).toBe("nothing_found");
  });

  it("stores nothing_found when no quote survives — a finding, not an error", async () => {
    const { env, inserts } = fakeEnv();
    reply("Housing rose forty percent.", [
      { text: "Housing spending rose by forty percent according to the department." },
    ]);
    const out = await answerQuestion(env, "op1", "How much did housing rise?", { retrieve });
    expect(out.status).toBe("nothing_found");
    expect(out.discarded).toBe(1);
    expect(out.error ?? null).toBeNull();
    expect(storedRow(inserts).status).toBe("nothing_found");
  });

  it("stores nothing_found when nothing is retrieved, without calling the writer", async () => {
    const { env } = fakeEnv();
    const out = await answerQuestion(env, "op1", "Anything?", { retrieve: async () => [] });
    expect(out.status).toBe("nothing_found");
    expect(writer).not.toHaveBeenCalled();
  });

  it("uses an idempotency key distinct per writer", async () => {
    const { env } = fakeEnv();
    reply("x", [{ text: "Departmental spending for the 2026 cycle was tabled on 4 March." }]);
    await answerQuestion(env, "op1", "q", { retrieve, writer: "anthropic" });
    const call = writer.mock.calls[0]?.[1] as { idempotency_key: string };
    expect(call.idempotency_key).toMatch(/^ask:[0-9a-f]{32}:anthropic$/);
  });
});

describe("windowAround", () => {
  it("returns the whole body when it is short", () => {
    expect(windowAround("short", ["short"], 100)).toBe("short");
  });
  it("centres the window on the hit passage", () => {
    const body = `${"a".repeat(500)}NEEDLE${"b".repeat(500)}`;
    const w = windowAround(body, ["NEEDLE"], 100);
    expect(w).toHaveLength(100);
    expect(w).toContain("NEEDLE");
  });
});

// ---- the search page --------------------------------------------------------

function searchDb(row: Record<string, unknown> | null): D1Database {
  const mk = (sql: string) => ({
    bind() {
      return mk(sql);
    },
    async first() {
      if (/FROM users/i.test(sql)) return { id: "op1" };
      if (/FROM lead_answers/i.test(sql)) return row;
      return null;
    },
    async all() {
      if (/FROM quotes q/i.test(sql))
        return {
          results: [
            {
              id: "q1",
              verbatim_text: "The housing figure is the one worth pausing on.",
              slug: "budget-2026",
              title: "Budget 2026",
            },
          ],
        };
      return { results: [] };
    },
    async run() {
      return { results: [], meta: { changes: 0 } };
    },
  });
  return { prepare: (sql: string) => mk(sql) } as unknown as D1Database;
}

const ANSWERED = {
  lead_key: "k",
  status: "answered",
  answer_md: "Housing spending rose in 2026.",
  quotes: JSON.stringify([
    {
      text: "The housing figure is the one worth pausing on.",
      piece_id: "p1",
      slug: "budget-2026",
      title: "Budget 2026",
      quote_id: "q1",
    },
  ]),
  discarded: 2,
  error: null,
  model: "@cf/openai/gpt-oss-120b",
};

describe("/search — From the record", () => {
  it("reads the stored row back in the shape answersForLeads uses", async () => {
    const a = await storedAnswerForQuestion(searchDb(ANSWERED), "op1", "did housing rise?");
    expect(a?.status).toBe("answered");
    expect(a?.quotes[0]?.quote_id).toBe("q1");
    expect(a?.discarded).toBe(2);
  });

  it("shows the frozen answer to every reader, above the passages, with no form", async () => {
    const env = { DB: searchDb(ANSWERED), AI: {} } as never;
    const html = await renderSearchPage(env, "did housing rise?");
    expect(html).toContain("From the record");
    expect(html).toContain("Housing spending rose in 2026.");
    expect(html).toContain('href="/p/budget-2026"');
    expect(html).toContain('href="/q/q1"');
    expect(html).toContain('class="lead-ans-disc">2 proposed quotes failed');
    expect(html).toContain('<span class="lead-ans-model">gpt-oss-120b</span>');
    expect(html.indexOf("From the record")).toBeLessThan(html.indexOf(">Passages<"));
    expect(html).not.toContain('action="/op/ask"');
    expect(html).not.toContain('action="/op/leads/dig"');
    expect(html).not.toMatch(/<script(?![^>]*application\/ld\+json)/);
    // A query page never competes with the documents it lists: canonical to
    // the bare search page, and out of the index.
    expect(html).toContain('<link rel="canonical" href="https://canopticon.com/search" />');
    expect(html).toContain('<meta name="robots" content="noindex,follow" />');
  });

  it("indexes the bare search page itself", async () => {
    const env = { DB: searchDb(null), AI: {} } as never;
    const html = await renderSearchPage(env, "");
    expect(html).toContain('<link rel="canonical" href="https://canopticon.com/search" />');
    expect(html).not.toContain('name="robots"');
  });

  it("renders nothing_found as the record not settling it", async () => {
    const env = {
      DB: searchDb({
        ...ANSWERED,
        status: "nothing_found",
        answer_md: null,
        quotes: "[]",
        discarded: 0,
      }),
      AI: {},
    } as never;
    const html = await renderSearchPage(env, "who is the minister?");
    expect(html).toContain("The record does not settle this.");
    expect(html).toContain("who is the minister?");
  });

  it("gives the operator the two buttons", async () => {
    const env = { DB: searchDb(null), AI: {} } as never;
    const html = await renderSearchPage(env, "did housing rise?", { isOperator: true });
    expect(html).toContain('action="/op/ask"');
    expect(html).toContain('name="q" value="did housing rise?"');
    expect(html).toContain('name="writer" value="anthropic"');
    expect(html).toContain('action="/op/leads/dig"');
    expect(html).toContain('name="kind" value="question"');
    expect(html).toContain('name="seed" value="did housing rise?"');
    expect(html).not.toContain("From the record");
  });

  it("says it is answering when asked=1 and no row exists yet — no poller, no JS", async () => {
    const env = { DB: searchDb(null), AI: {} } as never;
    const html = await renderSearchPage(env, "did housing rise?", {
      isOperator: true,
      asked: true,
    });
    expect(html).toContain("Answering… reload in a few seconds.");
    expect(html).not.toContain('action="/op/ask"');
    expect(html).not.toMatch(/<script(?![^>]*application\/ld\+json)/);
  });
});
