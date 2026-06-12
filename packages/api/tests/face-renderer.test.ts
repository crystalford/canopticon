import { describe, expect, it } from "vitest";
import { generateAllFaces, generateSingleFace } from "../src/graph/lib/face-renderer.ts";

// Stub DB that lets us assert which writes happened. The face renderer reads
// the page, then upserts four page_faces rows (queued → rendering → ready),
// each driven by a writer-role call we stub out via env.AI.run.
function makeDb(opts: {
  pageRow?: { id: string; slug: string; thesis: string; body_md: string; confidence: string };
  captureRuns?: Array<{ sql: string; binds: unknown[] }>;
  captureInserts?: Array<Record<string, unknown>>;
}): D1Database {
  const captureRuns = opts.captureRuns ?? [];
  const captureInserts = opts.captureInserts ?? [];
  const makeStmt = (sql: string, binds: unknown[] = []) => ({
    bind(...vs: unknown[]) {
      return makeStmt(sql, vs);
    },
    async first() {
      if (/FROM pages WHERE/i.test(sql) && opts.pageRow) return opts.pageRow;
      return null;
    },
    async all() {
      return { results: [] };
    },
    async run() {
      // Detect inserts on page_faces and capture the values from binds.
      if (/^INSERT INTO page_faces/i.test(sql)) {
        captureInserts.push({ sql, binds });
      } else {
        captureRuns.push({ sql, binds });
      }
      return { results: [], meta: { changes: 1 } };
    },
  });
  return {
    prepare(sql: string) {
      return makeStmt(sql) as unknown as D1PreparedStatement;
    },
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

// Workers-AI stub that returns a text response with the requested face label.
// The router calls env.AI.run for the writer role.
function makeAi(fail = false): Ai {
  return {
    async run(_model: unknown, _input: unknown) {
      if (fail) throw new Error("AI exploded");
      return { response: "the rendered face body" };
    },
  } as unknown as Ai;
}

interface EnvOpts {
  fail?: boolean;
  pageRow?: Parameters<typeof makeDb>[0]["pageRow"];
}
function makeEnv(opts: EnvOpts = {}) {
  const runs: Array<{ sql: string; binds: unknown[] }> = [];
  const inserts: Array<Record<string, unknown>> = [];
  const dbArgs: Parameters<typeof makeDb>[0] = { captureRuns: runs, captureInserts: inserts };
  if (opts.pageRow) dbArgs.pageRow = opts.pageRow;
  const env = {
    ANTHROPIC_API_KEY: "test",
    LOG_LEVEL: "info",
    OPERATOR_EMAIL: "op@test",
    GRAPH_ENABLED: "true",
    STUDIO_ENABLED: "false",
    AI: makeAi(opts.fail ?? false),
    DB: makeDb(dbArgs),
  } as unknown as Parameters<typeof generateAllFaces>[0];
  return { env, runs, inserts };
}

const PAGE = {
  id: "page1",
  slug: "carney",
  thesis: "the framework moves",
  body_md: "Across four institutions, the same architecture recurs.",
  confidence: "high",
};

describe("generateAllFaces — only LLM-seasoned faces pre-render on signing (v2.6 Part 8)", () => {
  it("queues only script + chapter (thread + meme are template+query, rendered at view time)", async () => {
    const { env, runs } = makeEnv({ pageRow: PAGE });
    const report = await generateAllFaces(env, "u1", "page1");
    expect(report.queued).toEqual(["script", "chapter"]);
    expect(report.rendered.length).toBe(2);
    expect(report.failed.length).toBe(0);
    // Each LLM face goes through queued → rendering → ready. Two ready-updates.
    const readyUpdates = runs.filter((r) => /status\s*=\s*'ready'/i.test(r.sql));
    expect(readyUpdates.length).toBe(2);
  });

  it("returns empty queued list when the page has no signed body", async () => {
    const { env } = makeEnv({});
    const report = await generateAllFaces(env, "u1", "page1");
    expect(report.queued).toEqual([]);
    expect(report.rendered).toEqual([]);
  });

  it("captures per-face errors without sinking the others", async () => {
    // The AI stub always fails. Both LLM faces error; the renderer still
    // attempts both (Promise.allSettled) and reports each failure
    // separately, not as one global error.
    const { env } = makeEnv({ fail: true, pageRow: PAGE });
    const report = await generateAllFaces(env, "u1", "page1");
    expect(report.queued).toEqual(["script", "chapter"]);
    expect(report.failed.length).toBe(2);
    expect(report.rendered).toEqual([]);
  });
});

describe("generateSingleFace — operator re-render path", () => {
  it("renders one face without touching the others", async () => {
    const { env, runs } = makeEnv({ pageRow: PAGE });
    await generateSingleFace(env, "u1", "page1", "thread");
    // Single render: status=rendering then ready, no queueing wave.
    const readyUpdates = runs.filter((r) => /status\s*=\s*'ready'/i.test(r.sql));
    expect(readyUpdates.length).toBe(1);
  });
});
