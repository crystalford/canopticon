// The per-run writer — chosen on the run, resolved loudly.
//
// RESEARCH_LLM_PROVIDER made one choice for every run, which is the wrong
// grain for "is the output better with Claude?" — that is answered by running
// the SAME question both ways. So the choice moved onto the run. Two things
// have to be true for that to be trustworthy: a run that asked for Claude and
// cannot have it must fail rather than quietly getting the free writer, and
// every step of a multi-step run must write with the model step one chose.

import { describe, expect, it, vi } from "vitest";
import { resolveWriter } from "../src/llm/router";

const env = (over: Record<string, unknown> = {}) => ({ ...over }) as never;

describe("resolving which model writes", () => {
  it("honours a run that chose Claude when a key is present", () => {
    const r = resolveWriter(env({ ANTHROPIC_API_KEY: "k" }), "anthropic");
    expect(r.provider).toBe("anthropic");
    expect(r.model).toMatch(/^claude-/);
  });

  it("FAILS LOUDLY when Claude was chosen but there is no key", () => {
    // The operator ticked a box expecting a particular model. Silently
    // substituting the free one is how "Claude did not help" gets concluded
    // from output Claude never wrote.
    expect(() => resolveWriter(env(), "anthropic")).toThrow(/ANTHROPIC_API_KEY is not set/);
  });

  it("honours an explicit Workers AI choice even when Claude is the deployment default", () => {
    const r = resolveWriter(
      env({ ANTHROPIC_API_KEY: "k", RESEARCH_LLM_PROVIDER: "anthropic" }),
      "workers_ai",
    );
    expect(r.provider).toBe("workers_ai");
  });

  it("falls to the deployment default when the run made no choice", () => {
    expect(
      resolveWriter(env({ ANTHROPIC_API_KEY: "k", RESEARCH_LLM_PROVIDER: "anthropic" }), null)
        .provider,
    ).toBe("anthropic");
    expect(resolveWriter(env({ RESEARCH_LLM_PROVIDER: "anthropic" }), null).provider).toBe(
      "workers_ai",
    );
    expect(resolveWriter(env(), undefined).provider).toBe("workers_ai");
  });

  it("does not pin the Claude path to a stale generation", () => {
    // This was claude-sonnet-4-6 for a whole model generation. A per-run
    // toggle that buys last year's model is a comparison rigged against Claude.
    const r = resolveWriter(env({ ANTHROPIC_API_KEY: "k" }), "anthropic");
    expect(r.model).not.toMatch(/-4-\d/);
  });
});

// The run stores the choice and every step reads it back — checked by
// walking the real state machine with the writer stubbed to record what it
// was asked for.
const asked: Array<string | null | undefined> = [];
vi.mock("../src/graph/lib/record-builder", () => ({
  expandRecord: async () => ({
    banked_source_ids: ["s1"],
    rejected: [],
    sources_rejected: 0,
    sources_found: 1,
    sources_fetched: 1,
    sources_banked: 1,
    sources_duplicate: 0,
    errors: [],
  }),
  getExpandStatus: async () => null,
}));
vi.mock("../src/llm/router", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/llm/router")>();
  return {
    ...real,
    callResearchWriter: async (
      _env: unknown,
      _args: unknown,
      opts?: { writer?: string | null },
    ) => {
      asked.push(opts?.writer);
      return {
        text: JSON.stringify({
          title: "T",
          body_md: `## F\n${"x ".repeat(120)}`,
          followup_queries: [],
        }),
        structured: null,
        model: "stub",
      };
    },
    callRole: async () => ({ text: "" }),
    modelForRole: () => ({ model: "m" }),
  };
});

describe("the choice rides the whole run", () => {
  it("is stored at start and handed to the synthesis in a later execution", async () => {
    const { researchOnDemand, advanceResearchRun } = await import("../src/graph/lib/deep-research");
    const runs = new Map<string, Record<string, unknown>>();
    const db = {
      prepare(sql: string) {
        const stmt = {
          args: [] as unknown[],
          bind(...a: unknown[]) {
            stmt.args = a;
            return stmt;
          },
          async first() {
            if (/FROM research_runs/i.test(sql)) return [...runs.values()][0] ?? null;
            if (/FROM sources/i.test(sql))
              return { title: "S", content_text: "Body.", metadata: "{}" };
            if (/FROM pieces/i.test(sql)) return { title: "S", body_md: "Body." };
            return null;
          },
          async all() {
            if (/FROM pieces/i.test(sql)) return { results: [{ title: "S", body_md: "Body." }] };
            return { results: [] };
          },
          async run() {
            if (/^INSERT INTO research_runs/i.test(sql.trim())) {
              const cols = (/\(([^)]*)\) VALUES/i.exec(sql)?.[1] ?? "")
                .split(",")
                .map((c) => c.trim());
              const row: Record<string, unknown> = {};
              cols.forEach((c, i) => (row[c] = stmt.args[i]));
              runs.set(row.id as string, row);
            } else if (/^UPDATE research_runs/i.test(sql.trim())) {
              const cols = [...sql.matchAll(/([a-z0-9_]+)\s*=\s*\?/gi)].map((m) => m[1] as string);
              const row = runs.get(stmt.args[stmt.args.length - 1] as string);
              if (row) cols.forEach((c, i) => (row[c] = stmt.args[i]));
            }
            return { results: [], meta: { changes: 1 } };
          },
        };
        return stmt as unknown as D1PreparedStatement;
      },
      dump: async () => new ArrayBuffer(0),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
    } as unknown as D1Database;

    asked.length = 0;
    await researchOnDemand({ DB: db } as never, "u1", "Q", undefined, { writer: "anthropic" });
    expect([...runs.values()][0]?.writer).toBe("anthropic");

    await advanceResearchRun({ DB: db } as never, "u1"); // the synthesis, a separate execution
    expect(asked).toEqual(["anthropic"]);
  });
});
