// A mind retrieves passages: every verified quote long enough to be one
// gets its own vector, keyed on the quote id so re-running overwrites.
import { describe, expect, it } from "vitest";
import { QUOTE_MIN_CHARS, embedQuotesForPiece } from "../src/graph/lib/embeddings";

const long = (n: number, seed = "a") => `${seed} `.repeat(Math.ceil(n / 2)).slice(0, n);

function makeEnv(quotes: Array<{ id: string; verbatim_text: string }>) {
  const upserts: Array<{ id: string; metadata: Record<string, unknown> }> = [];
  const embedded: string[] = [];
  const sqls: string[] = [];
  const makeStmt = (sql: string, params: unknown[] = []) => ({
    bind(...p: unknown[]) {
      return makeStmt(sql, p);
    },
    async first() {
      if (/FROM pieces/i.test(sql)) return { slug: "the-doc", title: "The Document" };
      return null;
    },
    async all() {
      sqls.push(sql);
      if (/FROM quotes/i.test(sql)) {
        const min = params[2] as number;
        const limit = params[3] as number;
        return {
          results: quotes.filter((q) => q.verbatim_text.length >= min).slice(0, limit),
        };
      }
      return { results: [] };
    },
    async run() {
      return { results: [], meta: { changes: 0 } };
    },
  });
  const env = {
    DB: { prepare: (sql: string) => makeStmt(sql) },
    AI: {
      run: async (_m: string, input: { text: string[] }) => {
        embedded.push(input.text[0] ?? "");
        return { data: [[0.1, 0.2, 0.3]] };
      },
    },
    EMBEDDINGS: {
      upsert: async (vs: Array<{ id: string; metadata: Record<string, unknown> }>) => {
        upserts.push(...vs);
        return { count: vs.length };
      },
    },
  };
  return { env: env as never, upserts, embedded, sqls };
}

describe("embedQuotesForPiece", () => {
  it("indexes only passages of at least QUOTE_MIN_CHARS, deduped, as kind quote", async () => {
    const { env, upserts, embedded } = makeEnv([
      { id: "q1", verbatim_text: long(200, "x") },
      { id: "q2", verbatim_text: "too short to be a passage" },
      { id: "q3", verbatim_text: long(200, "x") }, // same text as q1
      { id: "q4", verbatim_text: long(QUOTE_MIN_CHARS + 10, "y") },
    ]);
    const r = await embedQuotesForPiece(env, "u", "p1");
    expect(r).toEqual({ indexed: 2, skipped: 1 });
    expect(embedded).toHaveLength(2);
    expect(upserts.map((u) => u.id)).toEqual(["quote:q1", "quote:q4"]);
    expect(upserts[0]?.metadata).toEqual({
      user_id: "u",
      kind: "quote",
      id: "q1",
      piece_id: "p1",
      slug: "the-doc",
      title: "The Document",
    });
  });

  it("is bounded by the limit and asks the database for it", async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `q${i}`,
      verbatim_text: long(150, String.fromCharCode(97 + i)),
    }));
    const { env, upserts } = makeEnv(many);
    const r = await embedQuotesForPiece(env, "u", "p1", { limit: 3 });
    expect(r.indexed).toBe(3);
    expect(upserts).toHaveLength(3);
  });

  it("does nothing for a piece it cannot find", async () => {
    const { env, upserts } = makeEnv([{ id: "q1", verbatim_text: long(200) }]);
    (env as { DB: { prepare: unknown } }).DB.prepare = (sql: string) => ({
      bind: () => ({
        first: async () => null,
        all: async () => ({ results: [] }),
      }),
      _sql: sql,
    });
    const r = await embedQuotesForPiece(env, "u", "missing");
    expect(r).toEqual({ indexed: 0, skipped: 0 });
    expect(upserts).toHaveLength(0);
  });
});
