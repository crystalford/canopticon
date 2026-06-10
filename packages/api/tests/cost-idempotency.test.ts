import { describe, expect, it } from "vitest";
import { approvePaidOperation } from "../src/cost/approve.ts";

// Capturing D1 stub for the cost-ledger idempotency path. The bug this guards
// against: approvePaidOperation used to skip the idempotency_key check on the
// Workers-AI free fast-path, so retries with the same key crashed on the
// UNIQUE(user_id, idempotency_key) constraint. That surfaced as
// "typed extraction failed on every chunk" on every cron retry of an
// extraction whose first attempt hung.
function makeCostDb(): {
  db: D1Database;
  ledger: Array<{ id: string; user_id: string; idempotency_key: string | null }>;
  selects: number;
  inserts: number;
} {
  const ledger: Array<{ id: string; user_id: string; idempotency_key: string | null }> = [];
  let selects = 0;
  let inserts = 0;
  const exec = (sql: string, params: unknown[]) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (s.startsWith("SELECT id FROM cost_ledger WHERE user_id = ? AND idempotency_key = ?")) {
      selects++;
      const [user_id, key] = params;
      const hit = ledger.find((r) => r.user_id === user_id && r.idempotency_key === key);
      return { results: hit ? [{ id: hit.id }] : [] };
    }
    if (s.startsWith("INSERT INTO cost_ledger")) {
      inserts++;
      const m = s.match(/INSERT INTO cost_ledger \(([^)]+)\)/);
      const cols = (m?.[1] ?? "").split(",").map((c) => c.trim());
      const row: Record<string, unknown> = {};
      cols.forEach((c, i) => {
        row[c] = params[i];
      });
      // Simulate the UNIQUE constraint — this is the real bug we're guarding.
      const existing = ledger.find(
        (r) => r.user_id === row.user_id && r.idempotency_key === row.idempotency_key,
      );
      if (existing && row.idempotency_key) {
        throw new Error(
          "D1_ERROR: UNIQUE constraint failed: cost_ledger.user_id, cost_ledger.idempotency_key",
        );
      }
      ledger.push({
        id: String(row.id),
        user_id: String(row.user_id),
        idempotency_key: row.idempotency_key == null ? null : String(row.idempotency_key),
      });
      return { results: [] };
    }
    // Unhandled SQL — let cost_whitelists / cost_approvals fall through cleanly.
    return { results: [] };
  };
  const db = {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          bound = a;
          return stmt;
        },
        async first<T>() {
          return (exec(sql, bound).results[0] as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: exec(sql, bound).results as T[] };
        },
        async run() {
          return { ...exec(sql, bound), meta: { changes: 1 } };
        },
      };
      return stmt as unknown as D1PreparedStatement;
    },
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
  return {
    db,
    ledger,
    get selects() {
      return selects;
    },
    get inserts() {
      return inserts;
    },
  };
}

describe("approvePaidOperation — idempotency on Workers AI free path", () => {
  it("first call with idempotency_key writes a ledger row", async () => {
    const cap = makeCostDb();
    const out = await approvePaidOperation(cap.db, {
      user_id: "u1",
      operation_type: "workers_ai.extract.bulk",
      provider: "workers_ai",
      estimated_cost_cents: 0,
      idempotency_key: "piece-x:typed:0",
    });
    expect(out.decision).toBe("approved");
    expect(cap.inserts).toBe(1);
    expect(cap.ledger).toHaveLength(1);
  });

  it("retry with same idempotency_key REUSES the prior ledger row (no UNIQUE crash)", async () => {
    const cap = makeCostDb();
    const key = "piece-x:typed:0";

    const first = await approvePaidOperation(cap.db, {
      user_id: "u1",
      operation_type: "workers_ai.extract.bulk",
      provider: "workers_ai",
      estimated_cost_cents: 0,
      idempotency_key: key,
    });
    expect(first.decision).toBe("approved");

    const retry = await approvePaidOperation(cap.db, {
      user_id: "u1",
      operation_type: "workers_ai.extract.bulk",
      provider: "workers_ai",
      estimated_cost_cents: 0,
      idempotency_key: key,
    });
    expect(retry.decision).toBe("approved");
    expect(retry.cost_ledger_id).toBe(first.cost_ledger_id);
    // The idempotency check must hit BEFORE the insert path. One insert total.
    expect(cap.inserts).toBe(1);
    expect(cap.ledger).toHaveLength(1);
  });

  it("different idempotency_keys still produce distinct ledger rows", async () => {
    const cap = makeCostDb();
    await approvePaidOperation(cap.db, {
      user_id: "u1",
      operation_type: "workers_ai.extract.bulk",
      provider: "workers_ai",
      estimated_cost_cents: 0,
      idempotency_key: "piece-x:typed:0",
    });
    await approvePaidOperation(cap.db, {
      user_id: "u1",
      operation_type: "workers_ai.extract.bulk",
      provider: "workers_ai",
      estimated_cost_cents: 0,
      idempotency_key: "piece-x:typed:1",
    });
    expect(cap.inserts).toBe(2);
    expect(cap.ledger).toHaveLength(2);
  });

  it("calls without idempotency_key still write (no UNIQUE constraint to satisfy)", async () => {
    const cap = makeCostDb();
    await approvePaidOperation(cap.db, {
      user_id: "u1",
      operation_type: "workers_ai.extract.bulk",
      provider: "workers_ai",
      estimated_cost_cents: 0,
    });
    await approvePaidOperation(cap.db, {
      user_id: "u1",
      operation_type: "workers_ai.extract.bulk",
      provider: "workers_ai",
      estimated_cost_cents: 0,
    });
    expect(cap.inserts).toBe(2);
  });
});
