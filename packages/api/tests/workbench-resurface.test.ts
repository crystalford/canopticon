// RESURFACE (lib/resurface.ts): one verified passage a day from a document
// the operator has not read lately. A query with a daily rotation — never a
// count — so the pick is stable within a day and nothing appears when the
// corpus has no candidate. "Lately" is pieces.last_opened_at (migration
// 0063, set when the operator renders /p/<slug>), with updated_at standing in
// for rows never opened since the column existed.

import { describe, expect, it } from "vitest";
import { MIN_RESURFACE_CHARS, dailyHash, resurfacePassage } from "../src/lib/resurface";

const LONG =
  "Provincial health spending grew 4.8 percent over the same period, outpacing the transfer escalator of 3.0 percent set in 2023, and the Parliamentary Budget Officer noted in March 2026 that the gap would compound.";

interface Call {
  sql: string;
  params: unknown[];
}

function makeDb(rows: Record<string, unknown>[]) {
  const calls: Call[] = [];
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
        calls.push({ sql, params: bound });
        return { results: rows };
      },
      async run() {
        return { results: [], meta: { changes: 0 } };
      },
    };
    return stmt as unknown as D1PreparedStatement;
  };
  const db = {
    prepare: (sql: string) => mk(sql),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
  return { db, calls };
}

const row = (piece: string, quote: string, touched: string) => ({
  quote_id: quote,
  verbatim_text: LONG,
  piece_id: piece,
  piece_slug: piece,
  piece_title: `Document ${piece}`,
  last_touched: touched,
});

describe("resurfacePassage", () => {
  it("returns nothing when the corpus has no candidate", async () => {
    const { db } = makeDb([]);
    expect(await resurfacePassage(db, "u1")).toBeNull();
  });

  it("asks only for long verified quotes from processed, published documents without a recent reading", async () => {
    const { db, calls } = makeDb([row("a", "q1", "2026-08-01T00:00:00Z")]);
    const now = new Date("2026-09-24T12:00:00Z");
    const pick = await resurfacePassage(db, "u1", { days: 14, now });
    expect(pick?.quote_id).toBe("q1");
    expect(pick?.piece_slug).toBe("a");
    expect(pick).not.toHaveProperty("last_touched");
    expect(pick).not.toHaveProperty("updated_at");
    const sql = calls[0]?.sql ?? "";
    expect(sql).toMatch(/pp\.status = 'done'/);
    expect(sql).toMatch(/publication_status = 'published'/);
    expect(sql).toMatch(/length\(q\.verbatim_text\) >= \?/);
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM readings/);
    // The last LOOK, not the last write — and the write stands in only where
    // no look has been recorded.
    expect(sql).toMatch(/COALESCE\(p\.last_opened_at, p\.updated_at\) AS last_touched/);
    expect(sql).toMatch(/ORDER BY COALESCE\(p\.last_opened_at, p\.updated_at\) ASC/);
    expect(sql).not.toMatch(/ORDER BY p\.updated_at/);
    expect(calls[0]?.params).toEqual(["u1", MIN_RESURFACE_CHARS, "2026-09-10T12:00:00.000Z"]);
    expect(MIN_RESURFACE_CHARS).toBe(160);
  });

  it("prefers the document opened least recently", async () => {
    const { db } = makeDb([
      row("old", "q-old", "2026-07-01T00:00:00Z"),
      row("new", "q-new", "2026-09-01T00:00:00Z"),
    ]);
    const pick = await resurfacePassage(db, "u1", { now: new Date("2026-09-24T12:00:00Z") });
    expect(pick?.piece_id).toBe("old");
  });

  it("is stable within a day and rotates by day among tied documents", async () => {
    const rows = ["a", "b", "c", "d", "e"].map((p) => row(p, `q-${p}`, "2026-07-01T00:00:00Z"));
    const at = (iso: string) => resurfacePassage(makeDb(rows).db, "u1", { now: new Date(iso) });
    const morning = await at("2026-09-24T08:00:00Z");
    const evening = await at("2026-09-24T22:00:00Z");
    expect(morning?.quote_id).toBe(evening?.quote_id);
    // Over a fortnight the rotation lands on more than one document.
    const seen = new Set<string>();
    for (let d = 1; d <= 14; d++) {
      const p = await at(`2026-09-${String(d).padStart(2, "0")}T12:00:00Z`);
      if (p) seen.add(p.piece_id);
    }
    expect(seen.size).toBeGreaterThan(1);
    // The hash itself is deterministic.
    expect(dailyHash("2026-09-24", "a")).toBe(dailyHash("2026-09-24", "a"));
    expect(dailyHash("2026-09-24", "a")).not.toBe(dailyHash("2026-09-25", "a"));
  });
});
