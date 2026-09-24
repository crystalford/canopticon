// A purge of a document's typed graph must not take the operator's readings
// with it. quotes cascade from nodes and readings cascade from quotes, so the
// old blanket DELETE FROM nodes erased every note the moment the pipeline
// re-read the document (Re-process, New version, or the first digest after a
// note was written). The source node a reading hangs on is kept; only the
// machine's own quotes are cleared from it.
import { describe, expect, it } from "vitest";
import { purgeTypedGraphForPiece } from "../src/graph/lib/digestion-typed";

function fakeDb(anchored: Array<{ source_id: string | null }>) {
  const executed: Array<{ sql: string; args: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async all() {
              executed.push({ sql, args });
              return { results: /FROM readings r/.test(sql) ? anchored : [] };
            },
            async run() {
              executed.push({ sql, args });
              return { success: true, meta: {} };
            },
            async first() {
              executed.push({ sql, args });
              return null;
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, executed };
}

describe("purgeTypedGraphForPiece", () => {
  it("deletes every node when the operator has written no reading", async () => {
    const { db, executed } = fakeDb([]);
    await purgeTypedGraphForPiece({ DB: db } as never, "u1", "p1");
    const deletes = executed.filter((e) => /^DELETE/.test(e.sql.trim()));
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.sql).toMatch(/DELETE FROM nodes WHERE user_id = \? AND piece_id = \?$/);
    expect(deletes[0]?.args).toEqual(["u1", "p1"]);
  });

  it("keeps the source node a reading is anchored on and clears only the machine's quotes", async () => {
    const { db, executed } = fakeDb([{ source_id: "src-1" }]);
    await purgeTypedGraphForPiece({ DB: db } as never, "u1", "p1");
    const deletes = executed.filter((e) => /^DELETE/.test(e.sql.trim()));
    expect(deletes).toHaveLength(2);
    expect(deletes[0]?.sql).toMatch(/DELETE FROM nodes .* AND id NOT IN \(\?\)/);
    expect(deletes[0]?.args).toEqual(["u1", "p1", "src-1"]);
    expect(deletes[1]?.sql).toMatch(/DELETE FROM quotes/);
    expect(deletes[1]?.sql).toMatch(/id NOT IN \(SELECT quote_id FROM readings\)/);
    expect(deletes[1]?.args).toEqual(["u1", "src-1"]);
  });
});
