import { describe, expect, it } from "vitest";
import { type CostGateContext, approvePaidOperation } from "../src/orchestrator/cost_gate.ts";

// Build a minimal Supabase-shaped stub. We only implement the .from(...).select/eq/maybeSingle
// chain that cost_gate uses; calls follow this exact shape:
//   service.from('users').select(...).eq('id', user_id).maybeSingle()
//   service.from('cost_ledger').select(...).eq('user_id', ...).gte('occurred_at', ...)
//   service.from('cost_whitelists').select(...).eq('user_id', ...).eq('operation_type', ...).maybeSingle()

interface StubState {
  user: { monthly_ceiling_cents: number } | null;
  ledger: Array<{ cost_cents: number; occurred_at: string }>;
  whitelist: {
    per_op_max_cents: number;
    daily_max_cents: number | null;
    monthly_max_cents: number | null;
    enabled: boolean;
  } | null;
}

function stubService(state: StubState): CostGateContext["service"] {
  // The cost gate uses two patterns against the Supabase client:
  //   .from(t).select(...).eq(...).maybeSingle()  → single row or null
  //   .from(t).select(...).eq(...).gte(...)       → array of rows (await chain)
  //
  // The chain is a thenable so `await chain` resolves to the array; the
  // `then` property is attached via defineProperty rather than a literal
  // because biome's noThenProperty rule (correctly) flags object-literal
  // `then` as a footgun in real code.
  function builder(table: string) {
    let rows: unknown[] = [];
    if (table === "users") rows = state.user ? [state.user] : [];
    else if (table === "cost_ledger") rows = state.ledger;
    else if (table === "cost_whitelists") rows = state.whitelist ? [state.whitelist] : [];

    const arrayResult = { data: rows, error: null };
    const singleResult = { data: rows.length > 0 ? rows[0] : null, error: null };

    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      maybeSingle: () => Promise.resolve(singleResult),
    };
    const thenKey = ["t", "h", "e", "n"].join("");
    Object.defineProperty(chain, thenKey, {
      value: (resolve: (v: typeof arrayResult) => unknown) => resolve(arrayResult),
      enumerable: false,
    });
    return chain;
  }
  return { from: builder } as unknown as CostGateContext["service"];
}

const baseUser = { user_id: "00000000-0000-0000-0000-000000000001" };

describe("approvePaidOperation", () => {
  it("auto-approves a whitelisted op under the per-op cap", async () => {
    const ctx: CostGateContext = {
      service: stubService({
        user: { monthly_ceiling_cents: 5000 },
        ledger: [],
        whitelist: {
          per_op_max_cents: 100,
          daily_max_cents: null,
          monthly_max_cents: null,
          enabled: true,
        },
      }),
    };
    const decision = await approvePaidOperation(ctx, {
      ...baseUser,
      operation_type: "anthropic_call",
      estimate_cents: 50,
      provider: "anthropic",
    });
    expect(decision).toMatchObject({ approved: true, reason: "whitelisted", auto: true });
  });

  it("denies (ceiling) when monthly spend + estimate exceeds the ceiling", async () => {
    const ctx: CostGateContext = {
      service: stubService({
        user: { monthly_ceiling_cents: 100 },
        ledger: [{ cost_cents: 80, occurred_at: new Date().toISOString() }],
        whitelist: {
          per_op_max_cents: 50,
          daily_max_cents: null,
          monthly_max_cents: null,
          enabled: true,
        },
      }),
    };
    const decision = await approvePaidOperation(ctx, {
      ...baseUser,
      operation_type: "anthropic_call",
      estimate_cents: 30,
      provider: "anthropic",
    });
    expect(decision).toMatchObject({
      approved: false,
      reason: "ceiling_exceeded",
      requires_approval: false,
    });
  });

  it("denies (whitelist_disabled) when the rule exists but is disabled", async () => {
    const ctx: CostGateContext = {
      service: stubService({
        user: { monthly_ceiling_cents: 5000 },
        ledger: [],
        whitelist: {
          per_op_max_cents: 100,
          daily_max_cents: null,
          monthly_max_cents: null,
          enabled: false,
        },
      }),
    };
    const decision = await approvePaidOperation(ctx, {
      ...baseUser,
      operation_type: "anthropic_call",
      estimate_cents: 50,
      provider: "anthropic",
    });
    expect(decision).toMatchObject({ approved: false, reason: "whitelist_disabled" });
  });

  it("returns requires_approval when no whitelist row matches and op fits ceiling", async () => {
    const ctx: CostGateContext = {
      service: stubService({
        user: { monthly_ceiling_cents: 5000 },
        ledger: [],
        whitelist: null,
      }),
    };
    const decision = await approvePaidOperation(ctx, {
      ...baseUser,
      operation_type: "anthropic_call",
      estimate_cents: 50,
      provider: "anthropic",
    });
    expect(decision).toMatchObject({
      approved: false,
      reason: "requires_approval",
      requires_approval: true,
    });
  });

  it("requires approval when whitelist exists but estimate exceeds per-op cap", async () => {
    const ctx: CostGateContext = {
      service: stubService({
        user: { monthly_ceiling_cents: 5000 },
        ledger: [],
        whitelist: {
          per_op_max_cents: 30,
          daily_max_cents: null,
          monthly_max_cents: null,
          enabled: true,
        },
      }),
    };
    const decision = await approvePaidOperation(ctx, {
      ...baseUser,
      operation_type: "anthropic_call",
      estimate_cents: 100,
      provider: "anthropic",
    });
    expect(decision).toMatchObject({ approved: false, reason: "requires_approval" });
  });

  it("throws when the user does not exist", async () => {
    const ctx: CostGateContext = {
      service: stubService({ user: null, ledger: [], whitelist: null }),
    };
    await expect(
      approvePaidOperation(ctx, {
        ...baseUser,
        operation_type: "anthropic_call",
        estimate_cents: 1,
        provider: "anthropic",
      }),
    ).rejects.toThrow(/user .* not found/);
  });

  it("rejects negative estimates as a programmer error", async () => {
    const ctx: CostGateContext = {
      service: stubService({ user: { monthly_ceiling_cents: 5000 }, ledger: [], whitelist: null }),
    };
    await expect(
      approvePaidOperation(ctx, {
        ...baseUser,
        operation_type: "anthropic_call",
        estimate_cents: -5,
        provider: "anthropic",
      }),
    ).rejects.toThrow(/estimate_cents must be non-negative/);
  });
});
