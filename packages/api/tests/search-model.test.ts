// THE SEARCH MODEL — /search?q= as data, and /search.json as its surface.
//
// What matters: the frozen answer comes through with each quote's document
// and receipt; a question never asked gives null, not an empty answer; the
// operator block (the actions that spend a writer call) exists only for a
// signed-in operator; and the JSON route serves exactly the model the HTML
// page renders from, uncached.

import { describe, expect, it, vi } from "vitest";
import { buildSessionCookie, signSession } from "../src/auth/session.ts";

const PASSAGE = "The housing figure is the one worth pausing on.";

let vectorHits = true;
vi.mock("../src/graph/lib/embeddings", () => ({
  searchVectors: async (_env: unknown, args: { kinds?: string[] }) => {
    if (!vectorHits) return [];
    if (args.kinds?.includes("quote")) {
      return [
        { id: "quote:q1", score: 0.91, metadata: { kind: "quote", id: "q1", user_id: "op1" } },
      ];
    }
    return [{ id: "piece:p1", score: 0.8, metadata: { kind: "piece", id: "p1", user_id: "op1" } }];
  },
  rerankResults: async <T>(_env: unknown, _q: string, items: T[]) => items,
}));

vi.mock("../src/graph/lib/answers-preview", () => ({
  getAnswerPreview: async () => "A preview the model wrote. Not a fact.",
}));

import app from "../src/index.ts";
import { type SearchModel, searchModel } from "../src/public/models/search";
import { renderSearchModel } from "../src/public/render/search";

const STORED = {
  lead_key: "k1",
  status: "answered",
  answer_md: "Housing spending rose in 2026.",
  quotes: JSON.stringify([
    {
      text: PASSAGE,
      piece_id: "p1",
      slug: "budget-2026",
      title: "Budget 2026: Main Estimates",
      quote_id: "q1",
    },
    { text: "A quote with no receipt.", piece_id: "p2", slug: "transfers", title: "Transfers" },
  ]),
  discarded: 2,
  error: null,
  model: "@cf/openai/gpt-oss-120b",
  created_at: "2026-09-24T10:00:00.000Z",
};

function makeDb(opts: { answered?: boolean } = {}): D1Database {
  const makeStmt = (sql: string) => ({
    bind() {
      return makeStmt(sql);
    },
    async first() {
      if (/FROM users/i.test(sql)) return { id: "op1" };
      if (/FROM lead_answers/i.test(sql)) return opts.answered ? STORED : null;
      if (/FROM pieces WHERE id/i.test(sql))
        return {
          slug: "budget-2026",
          title: "Budget 2026: Main Estimates",
          excerpt: "Departmental spending…",
          topic: "Money & markets",
        };
      return null;
    },
    async all() {
      if (/FROM quotes q/i.test(sql)) {
        return {
          results: [
            { id: "q1", verbatim_text: PASSAGE, slug: "budget-2026", title: "Budget 2026" },
          ],
        };
      }
      return { results: [] };
    },
    async run() {
      return { results: [], meta: { changes: 0 } };
    },
  });
  return {
    prepare: (sql: string) => makeStmt(sql) as unknown as D1PreparedStatement,
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

const SECRET = "test-secret-search-model";
const envFor = (db: D1Database) =>
  ({ DB: db, AI: {}, SESSION_SECRET: SECRET, LOG_LEVEL: "error" }) as never;

async function operatorRequest(path: string): Promise<Request> {
  const cookie = await signSession(
    { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
    SECRET,
  );
  const cookieValue = buildSessionCookie(cookie).split(";")[0] as string;
  return new Request(`http://test${path}`, { headers: { cookie: cookieValue } });
}

describe("searchModel", () => {
  it("carries the stored answer with each quote's document and receipt", async () => {
    vectorHits = true;
    const m = await searchModel(envFor(makeDb({ answered: true })), " did housing rise? ");
    expect(m.query).toBe("did housing rise?");
    expect(m.outcome).toBe("hits");
    expect(m.answer).not.toBeNull();
    expect(m.answer?.status).toBe("answered");
    expect(m.answer?.answerMd).toBe("Housing spending rose in 2026.");
    expect(m.answer?.discarded).toBe(2);
    expect(m.answer?.model).toBe("gpt-oss-120b");
    expect(m.answer?.createdAt).toBe("2026-09-24T10:00:00.000Z");
    expect(m.answer?.quotes[0]).toEqual({
      text: PASSAGE,
      slug: "budget-2026",
      title: "Budget 2026: Main Estimates",
      quoteId: "q1",
      url: "/q/q1",
    });
    expect(m.answer?.quotes[1]?.quoteId).toBeNull();
    expect(m.answer?.quotes[1]?.url).toBeNull();
    // Passages and documents beside it.
    expect(m.passages).toEqual([
      { quoteId: "q1", text: PASSAGE, slug: "budget-2026", title: "Budget 2026", score: 0.91 },
    ]);
    expect(m.documents[0]).toMatchObject({
      slug: "budget-2026",
      kind: "piece",
      section: "Money & markets",
      url: "/library/budget-2026",
    });
    expect(m.candidates).toBe(1);
  });

  it("gives null, not an empty answer, when the question was never asked", async () => {
    vectorHits = true;
    const m = await searchModel(envFor(makeDb()), "did housing rise?");
    expect(m.answer).toBeNull();
    expect(m.outcome).toBe("hits");
  });

  it("builds the operator block only for the operator", async () => {
    vectorHits = true;
    const reader = await searchModel(envFor(makeDb()), "did housing rise?");
    expect(reader.operator).toBeNull();
    const op = await searchModel(envFor(makeDb()), "did housing rise?", {
      isOperator: true,
      asked: true,
    });
    expect(op.operator).toMatchObject({
      askAction: "/op/ask",
      researchAction: "/op/leads/dig",
      preview: null,
    });
    expect(op.asked).toBe(true);
  });

  it("names a miss, and shows the labelled preview to the operator alone", async () => {
    vectorHits = false;
    const reader = await searchModel(envFor(makeDb()), "who is the minister?");
    expect(reader.outcome).toBe("miss");
    expect(reader.operator).toBeNull();
    const op = await searchModel(envFor(makeDb()), "who is the minister?", { isOperator: true });
    expect(op.operator?.preview).toBe("A preview the model wrote. Not a fact.");
    const html = renderSearchModel(op);
    expect(html).toContain("No matches for <b>who is the minister?</b> yet.");
    expect(html).toContain("AI-generated preview — not verified");
    expect(html).toContain('action="/op/search/research"');
    expect(renderSearchModel(reader)).not.toContain("AI-generated preview");
    vectorHits = true;
  });

  it("is the shell with no query, and says the record is empty with no operator row", async () => {
    const shell = await searchModel(envFor(makeDb()), "");
    expect(shell.outcome).toBe("shell");
    expect(shell.operator).toBeNull();
    const empty = makeDb();
    const stmt = empty.prepare;
    const noUsers = {
      ...empty,
      prepare: (sql: string) => {
        const s = stmt(sql);
        if (/FROM users/i.test(sql))
          return { ...s, bind: () => ({ ...s, first: async () => null }) };
        return s;
      },
    } as unknown as D1Database;
    const m = await searchModel(envFor(noUsers), "anything");
    expect(m.outcome).toBe("no-corpus");
    expect(renderSearchModel(m)).toContain("The record is empty so far.");
  });
});

describe("GET /search.json", () => {
  it("serves the model as JSON, uncached, with no operator block for a reader", async () => {
    vectorHits = true;
    const res = await app.fetch(
      new Request("http://test/search.json?q=did%20housing%20rise%3F"),
      envFor(makeDb({ answered: true })),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const m = (await res.json()) as SearchModel;
    expect(m.query).toBe("did housing rise?");
    expect(m.answer?.quotes[0]?.url).toBe("/q/q1");
    expect(m.passages).toHaveLength(1);
    expect(m.operator).toBeNull();
  });

  it("includes the operator block for a signed-in operator", async () => {
    vectorHits = true;
    const res = await app.fetch(
      await operatorRequest("/search.json?q=did%20housing%20rise%3F&asked=1"),
      envFor(makeDb()),
    );
    expect(res.status).toBe(200);
    const m = (await res.json()) as SearchModel;
    expect(m.answer).toBeNull();
    expect(m.asked).toBe(true);
    expect(m.operator).toMatchObject({ askAction: "/op/ask", researchAction: "/op/leads/dig" });
  });

  it("renders the same model the HTML page renders from", async () => {
    vectorHits = true;
    const env = envFor(makeDb({ answered: true }));
    const [json, html] = await Promise.all([
      app.fetch(new Request("http://test/search.json?q=did%20housing%20rise%3F"), env),
      app.fetch(new Request("http://test/search?q=did%20housing%20rise%3F"), env),
    ]);
    const m = (await json.json()) as SearchModel;
    expect(await html.text()).toBe(renderSearchModel(m));
  });
});
