// The ingestion receipt — what the system did with the document you dropped in.
//
// The distinction this file defends hardest is the one a careless
// implementation collapses: "not extracted yet" and "extracted, found nothing"
// are DIFFERENT STATES, and a row of zeros reads identically for both. One
// means press the button; the other means this document is thin. Conflating
// them is how a failed extraction run looks like a boring document forever.
//
// Second: the coverage figure must be the real one. Extraction stops at a
// ceiling, and a receipt that implies full coverage is precisely the
// dishonesty standing rule 6 exists to prevent.

import { describe, expect, it } from "vitest";
import { ingestionReceipt, ingestionReceipts } from "../src/graph/lib/ingestion-receipt";

type Db = Parameters<typeof ingestionReceipt>[0];

/** A D1 stub that answers by which table and shape each query asks for. */
function db(opts: {
  counts?: { total_chars: number | null; quotes: number; nodes: number; findings: number } | null;
  pieces?: Array<{ id: string; body_chars: number | null }>;
  quotes?: Array<{ piece_id: string; n: number }>;
  nodes?: Array<{ piece_id: string; n: number }>;
  findings?: Array<{ piece_id: string; n: number }>;
}): Db {
  const mk = (sql: string) => {
    const stmt = {
      bind: () => stmt,
      first: async () => (opts.counts === undefined ? null : opts.counts),
      all: async () => {
        if (/FROM pieces/i.test(sql)) return { results: opts.pieces ?? [] };
        if (/FROM quotes/i.test(sql)) return { results: opts.quotes ?? [] };
        if (/FROM nodes/i.test(sql)) return { results: opts.nodes ?? [] };
        if (/FROM aeo_findings/i.test(sql)) return { results: opts.findings ?? [] };
        return { results: [] };
      },
      run: async () => ({ results: [], meta: { changes: 0 } }),
    };
    return stmt;
  };
  return {
    prepare: (sql: string) => mk(sql),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as Db;
}

describe("not extracted is not the same as extracted and empty", () => {
  it("returns null when nothing was extracted", async () => {
    // The caller needs to be able to say "not extracted yet" rather than
    // print three zeros, which would read as a finished run that found
    // nothing and would never prompt anyone to press the button.
    const r = await ingestionReceipt(
      db({ counts: { total_chars: 9000, quotes: 0, nodes: 0, findings: 0 } }),
      "u1",
      "p1",
    );
    expect(r).toBeNull();
  });

  it("returns a receipt as soon as anything was extracted", async () => {
    const r = await ingestionReceipt(
      db({ counts: { total_chars: 9000, quotes: 0, nodes: 4, findings: 0 } }),
      "u1",
      "p1",
    );
    expect(r).not.toBeNull();
    expect(r?.nodes).toBe(4);
    expect(r?.quotes).toBe(0);
  });

  it("omits an unextracted document from the batch rather than zeroing it", async () => {
    const map = await ingestionReceipts(
      db({
        pieces: [
          { id: "p1", body_chars: 500 },
          { id: "p2", body_chars: 500 },
        ],
        quotes: [{ piece_id: "p1", n: 3 }],
      }),
      "u1",
    );
    expect(map.has("p1")).toBe(true);
    expect(map.has("p2")).toBe(false);
  });
});

describe("coverage is stated honestly", () => {
  // 3 chunks x 24,000 chars MINUS the 800-char overlap carried into each
  // subsequent chunk = 70,400. Not 72,000, which is the rounder, friendlier,
  // wrong number.
  const CEILING = 70400;

  it("reports the real ceiling, overlap included", async () => {
    const r = await ingestionReceipt(
      db({ counts: { total_chars: 145300, quotes: 47, nodes: 112, findings: 6 } }),
      "u1",
      "p1",
    );
    expect(r?.read_chars).toBe(CEILING);
    expect(r?.truncated).toBe(true);
  });

  it("never claims to have read more than the document holds", async () => {
    const r = await ingestionReceipt(
      db({ counts: { total_chars: 800, quotes: 2, nodes: 5, findings: 1 } }),
      "u1",
      "p1",
    );
    expect(r?.read_chars).toBe(800);
    expect(r?.truncated).toBe(false);
  });

  it("does not mark a document exactly at the ceiling as truncated", async () => {
    const r = await ingestionReceipt(
      db({ counts: { total_chars: CEILING, quotes: 1, nodes: 1, findings: 0 } }),
      "u1",
      "p1",
    );
    expect(r?.truncated).toBe(false);
  });

  it("treats an unknown body length as zero rather than guessing", async () => {
    const r = await ingestionReceipt(
      db({ counts: { total_chars: null, quotes: 1, nodes: 1, findings: 0 } }),
      "u1",
      "p1",
    );
    expect(r?.total_chars).toBe(0);
    expect(r?.truncated).toBe(false);
  });
});

describe("it must not be able to take the library down", () => {
  // This renders on the page carrying the upload dropzone. If a query failure
  // threw, the operator would lose the ability to add a document — which is
  // the one thing that page exists for.
  it("returns null when the counts query fails", async () => {
    const broken = {
      prepare: () => {
        throw new Error("no such table: aeo_findings");
      },
    } as unknown as Db;
    await expect(ingestionReceipt(broken, "u1", "p1")).resolves.toBeNull();
  });

  it("returns an empty map when the batch queries fail", async () => {
    const broken = {
      prepare: () => {
        throw new Error("no such table");
      },
    } as unknown as Db;
    await expect(ingestionReceipts(broken, "u1")).resolves.toEqual(new Map());
  });
});
