// THE PIPELINE walks one step per call and records where it got to.
//
// The state machine is what turns "Not extracted yet" into a finished page,
// so the thing to pin is the walk itself: each press does exactly one step,
// a paused digestion re-queues at its checkpoint, a thrown step retries and
// then fails AT ITS STEP (so Retry resumes there), a working title is
// replaced from the document's own words with the original kept, and a
// missing lead passage is an answer rather than a failure.

import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
let digestBehaviour: "ok" | "pause" | "fail" = "ok";
let findingsThrows = 0;

vi.mock("../src/graph/lib/digestion", () => ({
  digest: async (
    _env: unknown,
    _args: unknown,
    opts: { startChunk?: number; onProgress?: (a: number, b: number, c: number) => Promise<void> },
  ) => {
    calls.push(`digest@${opts.startChunk ?? 0}`);
    if (digestBehaviour === "pause") {
      await opts.onProgress?.(2, 7, 10);
      return { steps_completed: [], more_chunks: true, chunks_done: 2, chunk_count: 7 };
    }
    if (digestBehaviour === "fail") {
      return {
        steps_completed: [],
        failed_step: "extract_claims",
        failed_reason: "typed extraction failed on every chunk",
        chunk_count: 1,
        chunks_done: 0,
      };
    }
    return {
      steps_completed: [],
      more_chunks: false,
      chunks_done: 7,
      chunk_count: 7,
      quotes_created: 12,
      nodes_created: 40,
    };
  },
}));
vi.mock("../src/graph/lib/embeddings", () => ({
  embedQuotesForPiece: async () => ({ indexed: 0, skipped: 0 }),
}));
vi.mock("../src/graph/lib/extract", () => ({
  readFullExtractedText: async () => ({ text: "Body text.", title: "T" }),
}));
vi.mock("../src/graph/lib/aeo-extract", () => ({
  extractAeoAtoms: async () => {
    calls.push("findings");
    if (findingsThrows > 0) {
      findingsThrows--;
      throw new Error("model timed out");
    }
    return { findings: 3, questions_new: 1, questions_merged: 0, killed: 1, model: "m" };
  },
}));
vi.mock("../src/graph/lib/lede", () => ({
  proposeLede: async () => {
    calls.push("passage");
    return { ok: false, reason: "passage is not verbatim in the document" };
  },
  approveLede: async () => true,
}));
vi.mock("../src/graph/lib/topics", () => ({
  assignTopic: async () => {
    calls.push("section");
    return { topic: "Housing & cities", model: "m" };
  },
}));
vi.mock("../src/llm/router", () => ({
  gatewayConfigured: () => false,
  modelForRole: () => ({ model: "@cf/test/model" }),
}));

type Row = Record<string, unknown>;

/** A fake D1 that really keeps piece_processing and pieces rows. */
function makeDb(pieces: Row[]) {
  const proc = new Map<string, Row>();
  const db = {
    prepare(sql: string) {
      const stmt = {
        args: [] as unknown[],
        bind(...a: unknown[]) {
          stmt.args = a;
          return stmt;
        },
        async first() {
          const q = sql.trim();
          if (/^SELECT \* FROM piece_processing WHERE user_id = \? AND piece_id = \?/i.test(q)) {
            const r = proc.get(stmt.args[1] as string);
            return r && pickable(r) ? r : null;
          }
          if (/^SELECT \* FROM piece_processing WHERE user_id = \?\s+AND \(status/i.test(q)) {
            return [...proc.values()].find(pickable) ?? null;
          }
          if (/^SELECT \* FROM piece_processing WHERE piece_id = \?/i.test(q)) {
            return proc.get(stmt.args[0] as string) ?? null;
          }
          if (/COUNT\(\*\) AS n FROM piece_processing/i.test(q)) {
            return { n: [...proc.values()].filter(pickable).length };
          }
          if (/FROM pieces WHERE id = \?/i.test(q)) {
            return pieces.find((p) => p.id === stmt.args[0]) ?? null;
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          const q = sql.trim();
          if (/^INSERT INTO piece_processing/i.test(q)) {
            proc.set(stmt.args[0] as string, {
              piece_id: stmt.args[0],
              user_id: stmt.args[1],
              status: "queued",
              step: "title",
              chunks_done: 0,
              chunk_count: 0,
              error: null,
              model: null,
              attempts: 0,
              heartbeat_at: null,
              started_at: null,
              finished_at: null,
              updated_at: stmt.args[2],
            });
            return { results: [], meta: { changes: 1 } };
          }
          if (/^UPDATE piece_processing/i.test(q)) {
            // SET a=?, b='lit', c=COALESCE(c, ?) ... WHERE piece_id = ? AND user_id = ?
            const setPart = q.slice(q.indexOf("SET") + 3, q.indexOf("WHERE"));
            const whereArgs = 2;
            const setArgs = stmt.args.slice(0, stmt.args.length - whereArgs - countWhereParams(q));
            const pid = stmt.args[setArgs.length] as string;
            const row = proc.get(pid);
            if (!row) return { results: [], meta: { changes: 0 } };
            const claimGate = /status = 'queued' OR \(status = 'running'/i.test(q);
            if (claimGate && !pickable(row)) return { results: [], meta: { changes: 0 } };
            if (/status = 'failed'/i.test(q) && row.status !== "failed") {
              return { results: [], meta: { changes: 0 } };
            }
            let ai = 0;
            for (const piece of setPart.split(",")) {
              const m = /([a-z_]+)\s*=\s*(.+)$/i.exec(piece.trim());
              if (!m) continue;
              const col = m[1] ?? "";
              const expr = m[2] ?? "";
              if (expr === "?") row[col] = stmt.args[ai++];
              else if (/^COALESCE\([a-z_]+, \?\)$/i.test(expr)) {
                const v = stmt.args[ai++];
                if (row[col] == null) row[col] = v;
              } else if (/^'.*'$/.test(expr)) row[col] = expr.slice(1, -1);
              else if (expr === "NULL") row[col] = null;
            }
            return { results: [], meta: { changes: 1 } };
          }
          if (/^UPDATE pieces/i.test(q)) {
            const p = pieces.find((x) => x.id === stmt.args[stmt.args.length - 2]);
            if (p) {
              p.original_title = p.original_title ?? p.title;
              p.title = stmt.args[0];
              p.title_auto_at = stmt.args[1];
            }
            return { results: [], meta: { changes: 1 } };
          }
          return { results: [], meta: { changes: 0 } };
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
  return { db, proc };
}

function countWhereParams(q: string): number {
  const where = q.slice(q.indexOf("WHERE"));
  // piece_id = ? AND user_id = ? are the two we subtract already; anything
  // else (the stale-heartbeat cutoff) is extra.
  return (where.match(/\?/g)?.length ?? 0) - 2;
}
function pickable(r: Row): boolean {
  return r.status === "queued" || (r.status === "running" && r.heartbeat_at == null);
}

const env = (db: D1Database) => ({ DB: db }) as unknown as import("../src/env").Env;

beforeEach(() => {
  calls.length = 0;
  digestBehaviour = "ok";
  findingsThrows = 0;
});

describe("one step per press", () => {
  it("walks title → digest → findings → passage → section → done, one step each", async () => {
    const { advanceProcessing, enqueueProcessing } = await import("../src/graph/lib/processing");
    const pieces: Row[] = [
      {
        id: "p1",
        title: "PASS 7-MINI — HARDENING DOSSIER",
        body_md:
          "Departmental spending for the 2026 cycle was tabled on 4 March. Three departments account for most of the movement.",
        title_approved_at: null,
        slug: "p1",
        metadata: JSON.stringify({ source_id: "s1" }),
      },
    ];
    const { db, proc } = makeDb(pieces);
    await enqueueProcessing(env(db), "u", "p1");
    expect(proc.get("p1")?.step).toBe("title");

    const steps: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await advanceProcessing(env(db), "u");
      if (!r.piece_id) break;
      steps.push(`${r.row?.step}:${r.row?.status}`);
    }
    expect(steps).toEqual([
      "digest:queued",
      "findings:queued",
      "passage:queued",
      "section:queued",
      "index:queued",
      "done:done",
    ]);
    expect(calls).toEqual(["digest@0", "findings", "passage", "section"]);
    // The working title was replaced from the document's own words, the
    // original kept, and the machine's choice marked so it can be put back.
    expect(pieces[0]?.title).toBe("Departmental spending for the 2026 cycle was tabled on 4 March");
    expect(pieces[0]?.original_title).toBe("PASS 7-MINI — HARDENING DOSSIER");
    expect(pieces[0]?.title_auto_at).toBeTruthy();
    // Nothing left waiting.
    const idle = await advanceProcessing(env(db), "u");
    expect(idle.piece_id).toBeNull();
    expect(idle.remaining).toBe(0);
  });

  it("re-queues a paused digestion at its checkpoint and resumes there", async () => {
    const { advanceProcessing, enqueueProcessing, describeProcessing } = await import(
      "../src/graph/lib/processing"
    );
    const { db, proc } = makeDb([
      { id: "p1", title: "A real title", body_md: "x", slug: "p1", metadata: '{"source_id":"s1"}' },
    ]);
    await enqueueProcessing(env(db), "u", "p1");
    await advanceProcessing(env(db), "u"); // title
    digestBehaviour = "pause";
    const r = await advanceProcessing(env(db), "u");
    expect(r.row?.step).toBe("digest");
    expect(r.row?.status).toBe("queued");
    expect(r.row?.chunks_done).toBe(2);
    expect(describeProcessing(proc.get("p1") as never).text).toBe("Queued 2/6 · reading (2/7)");
    digestBehaviour = "ok";
    await advanceProcessing(env(db), "u");
    expect(calls).toEqual(["digest@0", "digest@2"]);
  });

  it("a step that throws is retried, then fails AT that step so Retry resumes there", async () => {
    const { advanceProcessing, enqueueProcessing, retryProcessing, describeProcessing } =
      await import("../src/graph/lib/processing");
    const { db, proc } = makeDb([
      { id: "p1", title: "A real title", body_md: "x", slug: "p1", metadata: '{"source_id":"s1"}' },
    ]);
    await enqueueProcessing(env(db), "u", "p1");
    await advanceProcessing(env(db), "u"); // title
    await advanceProcessing(env(db), "u"); // digest
    findingsThrows = 3;
    for (let i = 0; i < 3; i++) await advanceProcessing(env(db), "u");
    const row = proc.get("p1") as never;
    expect(describeProcessing(row).state).toBe("failed");
    expect(describeProcessing(row).text).toBe("Failed at finding figures: model timed out");
    // Retry starts again at findings, not at title.
    expect(await retryProcessing(env(db), "u", "p1")).toBe(true);
    await advanceProcessing(env(db), "u");
    expect(calls.filter((c) => c === "findings")).toHaveLength(4);
    expect(proc.get("p1")?.step).toBe("passage");
  });

  it("a deterministic extraction failure fails at once", async () => {
    const { advanceProcessing, enqueueProcessing } = await import("../src/graph/lib/processing");
    const { db, proc } = makeDb([
      { id: "p1", title: "A real title", body_md: "x", slug: "p1", metadata: '{"source_id":"s1"}' },
    ]);
    await enqueueProcessing(env(db), "u", "p1");
    await advanceProcessing(env(db), "u");
    digestBehaviour = "fail";
    await advanceProcessing(env(db), "u");
    expect(proc.get("p1")?.status).toBe("failed");
    expect(proc.get("p1")?.step).toBe("digest");
    expect(proc.get("p1")?.error).toContain("failed on every chunk");
  });

  it("a title a person chose is never touched", async () => {
    const { advanceProcessing, enqueueProcessing } = await import("../src/graph/lib/processing");
    const pieces: Row[] = [
      {
        id: "p1",
        title: "PASS 7-MINI — HARDENING DOSSIER",
        title_approved_at: "2026-09-20T00:00:00Z",
        body_md: "Departmental spending for the 2026 cycle was tabled on 4 March.",
        slug: "p1",
        metadata: '{"source_id":"s1"}',
      },
    ];
    const { db } = makeDb(pieces);
    await enqueueProcessing(env(db), "u", "p1");
    const r = await advanceProcessing(env(db), "u");
    expect(r.note).toContain("chosen by you");
    expect(pieces[0]?.title).toBe("PASS 7-MINI — HARDENING DOSSIER");
  });
});
