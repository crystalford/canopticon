// Walk a research run from banked sources to a finished draft.
//
// The shape tests next door check that no branch runs two model-heavy steps in
// one execution. They cannot tell you the machine actually REACHES the end —
// and "it got to step five", then "sources banked, but no brief written", were
// both failures of reaching the end, not of shape.
//
// So this drives advanceResearchRun repeatedly against an in-memory
// research_runs row, with the model and the web fetcher stubbed, and asserts
// the run lands on `done` with a draft. Nothing here proves the writing is
// good; it proves the pipeline terminates.

import { beforeEach, describe, expect, it, vi } from "vitest";

// synthesizeBrief rejects anything under 200 characters as "writer produced
// too little text" — a real guard, so the stub has to clear it rather than be
// exempted from it.
const BRIEF = `## Findings\n${"Something the sources support. ".repeat(12)}`;

// One expand = one banked source. The real one fetches pages; what matters to
// the state machine is only what it returns — and what it returns are
// `sources` ids (migration 0059), never piece ids.
const expandRecord = vi.fn(async (_env: unknown, _u: string, q: string) => ({
  banked_source_ids: [`src-${q.replace(/\W+/g, "-").slice(0, 12)}`],
  rejected: [],
  sources_rejected: 0,
  sources_found: 1,
  sources_fetched: 1,
  sources_banked: 1,
  sources_duplicate: 0,
  errors: [],
}));
vi.mock("../src/graph/lib/record-builder", () => ({
  expandRecord,
  getExpandStatus: async () => null,
}));

// The writer. First call proposes two follow-ups; the final call proposes
// none, which is what lets the run terminate.
const writer = vi.fn();
vi.mock("../src/llm/router", () => ({
  callResearchWriter: (...a: unknown[]) => writer(...a),
  callRole: async () => ({ text: "" }),
  modelForRole: () => ({ model: "test-model" }),
  // Workers AI writes this run, so it finishes the single way — one call.
  // The sectioned walk is tests/research-sections-walk.test.ts.
  resolveWriter: () => ({ provider: "workers_ai", model: "test-model" }),
}));

import { advanceResearchRun, researchOnDemand } from "../src/graph/lib/deep-research";

/** A research_runs row plus the handful of other tables the path touches. */
function makeEnv() {
  const runs = new Map<string, Record<string, unknown>>();
  let n = 0;

  const db = {
    prepare(sql: string) {
      const stmt = {
        args: [] as unknown[],
        bind(...a: unknown[]) {
          stmt.args = a;
          return stmt;
        },
        async first() {
          if (/FROM research_runs/i.test(sql)) {
            const want = /status IN \(([^)]*)\)/i.exec(sql)?.[1] ?? "";
            const states = [...want.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
            const hit = [...runs.values()].find((r) => states.includes(r.status as string));
            return hit ?? null;
          }
          // synthesizeBrief's source lookup — any banked id resolves, and it
          // is read from `sources`, not `pieces`.
          if (/FROM sources/i.test(sql)) {
            return { title: "A source", content_text: "Body text.", metadata: "{}" };
          }
          // persistBrief's slug probe on pieces is fine — the brief IS a
          // piece. Only the legacy source read is forbidden for a new run.
          if (/SELECT title, body_md FROM pieces/i.test(sql)) {
            throw new Error("a new run must never read its sources from pieces");
          }
          return null;
        },
        async all() {
          if (/SELECT title, body_md FROM pieces/i.test(sql)) {
            throw new Error("a new run must never read its sources from pieces");
          }
          return { results: [] };
        },
        async run() {
          if (/^INSERT INTO research_runs/i.test(sql.trim())) {
            // insertOne generates the id itself and binds it, so read the row
            // out of the statement rather than inventing one — an id the code
            // has never seen means every later UPDATE silently misses.
            const cols = (/\(([^)]*)\) VALUES/i.exec(sql)?.[1] ?? "")
              .split(",")
              .map((c) => c.trim());
            const row: Record<string, unknown> = {};
            cols.forEach((c, i) => (row[c] = stmt.args[i]));
            const id = (row.id as string) ?? `run-${++n}`;
            runs.set(id, { ...row, id });
            return { results: [], meta: { changes: 1 } };
          }
          if (/^UPDATE research_runs/i.test(sql.trim())) {
            // updateById builds "SET a = ?, b = ? WHERE id = ?"
            const cols = [...sql.matchAll(/([a-z0-9_]+)\s*=\s*\?/gi)].map((m) => m[1] as string);
            const id = stmt.args[stmt.args.length - 1] as string;
            const row = runs.get(id);
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

  return { env: { DB: db } as never, runs };
}

const only = (runs: Map<string, Record<string, unknown>>) =>
  [...runs.values()][0] as Record<string, unknown>;

describe("a research run reaches a draft", () => {
  beforeEach(() => {
    expandRecord.mockClear();
    writer.mockReset();
    let call = 0;
    writer.mockImplementation(async () => ({
      text: JSON.stringify({
        title: "A brief",
        body_md: BRIEF,
        // Only the FIRST synthesis asks for follow-ups. A writer that kept
        // asking would loop forever, which is its own bug and not this one.
        followup_queries: ++call === 1 ? ["query one", "query two"] : [],
      }),
    }));
  });

  it("banks sources and stops, rather than synthesizing in the same execution", async () => {
    const { env, runs } = makeEnv();
    await researchOnDemand(env, "u1", "What is the white space?");
    expect(only(runs).status).toBe("synth_pending");
    // The failure this whole change exists for: a synthesis on top of an
    // expand that just extracted 273 facts.
    expect(writer).not.toHaveBeenCalled();
  });

  it("walks synth → follow-ups one at a time → final brief → done", async () => {
    const { env, runs } = makeEnv();
    await researchOnDemand(env, "u1", "What is the white space?");

    const seen: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await advanceResearchRun(env, "u1");
      if (!r.advanced) break;
      seen.push(only(runs).status as string);
      if (only(runs).status === "done") break;
    }

    expect(seen).toEqual([
      "pass2_pending", // first synthesis proposed two follow-ups
      "pass2_pending", // one search run, one still queued
      "pass2_synth_pending", // second search run, nothing left to search
      "done", // final brief written
    ]);
    expect(only(runs).final_piece_id).toBeTruthy();
    expect(only(runs).mode).toBe("single");
    // The run recorded source ids in the new columns and left the legacy
    // piece-id columns alone.
    expect(JSON.parse(only(runs).pass1_source_ids as string)).toHaveLength(1);
    expect(JSON.parse(only(runs).pass2_source_ids as string)).toHaveLength(2);
    expect(only(runs).pass1_piece_ids).toBeUndefined();
    expect(only(runs).pass2_piece_ids).toBeUndefined();
  });

  it("runs exactly one web expand per advance", async () => {
    const { env, runs } = makeEnv();
    await researchOnDemand(env, "u1", "Q");
    expect(expandRecord).toHaveBeenCalledTimes(1); // pass 1's own

    await advanceResearchRun(env, "u1"); // synthesis, no expand
    expect(expandRecord).toHaveBeenCalledTimes(1);

    await advanceResearchRun(env, "u1"); // one follow-up
    expect(expandRecord).toHaveBeenCalledTimes(2);

    await advanceResearchRun(env, "u1"); // the other follow-up
    expect(expandRecord).toHaveBeenCalledTimes(3);
    expect(only(runs).status).toBe("pass2_synth_pending");
  });

  it("terminates when the first synthesis wants no follow-ups", async () => {
    writer.mockImplementation(async () => ({
      text: JSON.stringify({ title: "T", body_md: BRIEF, followup_queries: [] }),
    }));
    const { env, runs } = makeEnv();
    await researchOnDemand(env, "u1", "Q");
    await advanceResearchRun(env, "u1");
    expect(only(runs).status).toBe("done");
  });

  it("does nothing, harmlessly, when no run is due", async () => {
    // The banner may press this more than once; a second press must not throw
    // or invent work.
    const { env } = makeEnv();
    expect((await advanceResearchRun(env, "u1")).advanced).toBe(false);
  });

  it("fails the run rather than hanging when the writer returns nothing usable", async () => {
    writer.mockImplementation(async () => ({ text: "not json" }));
    const { env, runs } = makeEnv();
    await researchOnDemand(env, "u1", "Q");
    await advanceResearchRun(env, "u1");
    expect(only(runs).status).toBe("failed");
    expect(only(runs).error).toBeTruthy();
  });
});
