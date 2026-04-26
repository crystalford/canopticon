import { describe, expect, it } from "vitest";
import { type CostGateContext, approvePaidOperation } from "../src/orchestrator/cost_gate.ts";

// Build a minimal Supabase-shaped stub. We only implement the .from(...).select/eq/maybeSingle
// chain that cost_gate uses; calls follow this exact shape:
//   service.from('users').select(...).eq('id', user_id).maybeSingle()
//   service.from('cost_ledger').select(...).eq('user_id', ...).gte('occurred_at', ...)
//   service.from('cost_whitelists').select(...).eq('user_id', ...).eq('operation_type', ...).maybeSingle()

interface ApprovalRow {
  id: string;
  proposal_id: string;
  status: "pending" | "approved" | "denied" | "expired";
  estimate_cents: number;
  consumed_at: string | null;
  expires_at: string;
  decision_note: string | null;
}

interface StubState {
  user: { monthly_ceiling_cents: number } | null;
  ledger: Array<{ cost_cents: number; occurred_at: string }>;
  whitelist: {
    per_op_max_cents: number;
    daily_max_cents: number | null;
    monthly_max_cents: number | null;
    enabled: boolean;
  } | null;
  /** Captured cost_approvals.insert payloads — read by tests to assert the
      gate created a pending approval with the right shape. */
  approvalInserts: Array<Record<string, unknown>>;
  /** Captured orchestrator_events.insert payloads — events emitted by the
      gate when it creates an approval. */
  eventInserts: Array<Record<string, unknown>>;
  /** Pre-seeded approval rows the consumeApproval path can find. */
  approvals: ApprovalRow[];
  /** Captured cost_approvals.update payloads (consumed_at marker). */
  approvalUpdates: Array<{ id: string; patch: Record<string, unknown> }>;
}

/** Symbol attached to the stub service so tests that need to assert on
    captured inserts can grab the underlying state. Most tests don't need it. */
const STUB_STATE = Symbol("STUB_STATE");

function stubService(
  partial: Partial<Omit<StubState, "approvalInserts" | "eventInserts" | "approvalUpdates">>,
): CostGateContext["service"] & { [STUB_STATE]: StubState } {
  const state: StubState = {
    user: null,
    ledger: [],
    whitelist: null,
    approvals: [],
    ...partial,
    approvalInserts: [],
    eventInserts: [],
    approvalUpdates: [],
  };
  const service = makeService(state) as CostGateContext["service"] & {
    [STUB_STATE]: StubState;
  };
  service[STUB_STATE] = state;
  return service;
}

function makeService(state: StubState): CostGateContext["service"] {
  // The cost gate uses several patterns against the Supabase client:
  //   .from(t).select(...).eq(...).maybeSingle()       → single row or null
  //   .from(t).select(...).eq(...).gte(...)            → array of rows (await chain)
  //   .from('cost_approvals').insert(...).select(...).single()
  //                                                    → newly created approval
  //   .from('orchestrator_events').insert(...)         → fire-and-forget
  function builder(table: string) {
    let rows: unknown[] = [];
    if (table === "users") rows = state.user ? [state.user] : [];
    else if (table === "cost_ledger") rows = state.ledger;
    else if (table === "cost_whitelists") rows = state.whitelist ? [state.whitelist] : [];
    else if (table === "cost_approvals") rows = state.approvals;

    const arrayResult = { data: rows, error: null };

    // cost_approvals lookups filter by proposal_id; track that filter so
    // .maybeSingle() returns the matching row (or null).
    let proposalIdFilter: string | null = null;
    let updatePatch: Record<string, unknown> | null = null;

    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        if (table === "cost_approvals" && col === "proposal_id" && typeof val === "string") {
          proposalIdFilter = val;
        }
        return chain;
      },
      is: () => chain,
      gte: () => chain,
      maybeSingle: () => {
        if (table === "cost_approvals") {
          // Lookup by proposal_id (consumeApproval) or after update().
          if (proposalIdFilter) {
            const found = state.approvals.find((a) => a.proposal_id === proposalIdFilter) ?? null;
            return Promise.resolve({ data: found, error: null });
          }
          if (updatePatch) {
            // Conditional UPDATE ... RETURNING. Apply the patch to the
            // first eligible row and return it.
            const target = state.approvals.find((a) => a.consumed_at === null);
            if (target) {
              Object.assign(target, updatePatch);
              state.approvalUpdates.push({ id: target.id, patch: updatePatch });
              return Promise.resolve({ data: { id: target.id }, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          }
        }
        return Promise.resolve({
          data: rows.length > 0 ? rows[0] : null,
          error: null,
        });
      },
      insert: (row: Record<string, unknown>) => {
        if (table === "cost_approvals") {
          state.approvalInserts.push(row);
          const fakeProposalId = `prop-${state.approvalInserts.length}`;
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { proposal_id: fakeProposalId }, error: null }),
            }),
          };
        }
        if (table === "orchestrator_events") {
          state.eventInserts.push(row);
          return Promise.resolve({ error: null });
        }
        return Promise.resolve({ error: null });
      },
      update: (patch: Record<string, unknown>) => {
        if (table === "cost_approvals") updatePatch = patch;
        return chain;
      },
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

  it("creates a pending approval when no whitelist row matches and op fits ceiling", async () => {
    const service = stubService({
      user: { monthly_ceiling_cents: 5000 },
      ledger: [],
      whitelist: null,
    });
    const ctx: CostGateContext = { service };
    const decision = await approvePaidOperation(ctx, {
      ...baseUser,
      operation_type: "anthropic_call",
      estimate_cents: 50,
      provider: "anthropic",
      approval_context: { research_run_id: "run-1" },
    });
    expect(decision).toMatchObject({
      approved: false,
      reason: "requires_approval",
      requires_approval: true,
    });
    if (!decision.approved) {
      expect(decision.proposal_id).toMatch(/^prop-/);
    }
    const state = service[STUB_STATE];
    // Inserted a cost_approvals row + emitted cost.operation_proposed.
    expect(state.approvalInserts).toHaveLength(1);
    expect(state.approvalInserts[0]).toMatchObject({
      user_id: baseUser.user_id,
      operation_type: "anthropic_call",
      estimate_cents: 50,
      provider: "anthropic",
    });
    expect(state.eventInserts).toHaveLength(1);
    expect(state.eventInserts[0]).toMatchObject({
      event_type: "cost.operation_proposed",
      entity_type_str: "cost_approval",
    });
  });

  it("requires approval when whitelist exists but estimate exceeds per-op cap", async () => {
    const service = stubService({
      user: { monthly_ceiling_cents: 5000 },
      ledger: [],
      whitelist: {
        per_op_max_cents: 30,
        daily_max_cents: null,
        monthly_max_cents: null,
        enabled: true,
      },
    });
    const ctx: CostGateContext = { service };
    const decision = await approvePaidOperation(ctx, {
      ...baseUser,
      operation_type: "anthropic_call",
      estimate_cents: 100,
      provider: "anthropic",
    });
    expect(decision).toMatchObject({ approved: false, reason: "requires_approval" });
    expect(service[STUB_STATE].approvalInserts).toHaveLength(1);
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

  // --- Consume-approval path (proposal_id supplied) -----------------------

  function farFuture() {
    return new Date(Date.now() + 60_000).toISOString();
  }

  function farPast() {
    return new Date(Date.now() - 60_000).toISOString();
  }

  it("consumes an approved approval and marks it consumed", async () => {
    const service = stubService({
      approvals: [
        {
          id: "row-1",
          proposal_id: "prop-1",
          status: "approved",
          estimate_cents: 50,
          consumed_at: null,
          expires_at: farFuture(),
          decision_note: null,
        },
      ],
    });
    const decision = await approvePaidOperation(
      { service },
      {
        ...baseUser,
        operation_type: "anthropic_call",
        estimate_cents: 50,
        provider: "anthropic",
        proposal_id: "prop-1",
      },
    );
    expect(decision).toMatchObject({
      approved: true,
      reason: "operator_approved",
      proposal_id: "prop-1",
    });
    expect(service[STUB_STATE].approvalUpdates).toHaveLength(1);
  });

  it("denies when the operator denied the proposal", async () => {
    const service = stubService({
      approvals: [
        {
          id: "row-1",
          proposal_id: "prop-1",
          status: "denied",
          estimate_cents: 50,
          consumed_at: null,
          expires_at: farFuture(),
          decision_note: "too expensive for this run",
        },
      ],
    });
    const decision = await approvePaidOperation(
      { service },
      {
        ...baseUser,
        operation_type: "anthropic_call",
        estimate_cents: 50,
        provider: "anthropic",
        proposal_id: "prop-1",
      },
    );
    expect(decision).toMatchObject({
      approved: false,
      reason: "approval_denied",
    });
  });

  it("returns approval_expired when the approval has expired", async () => {
    const service = stubService({
      approvals: [
        {
          id: "row-1",
          proposal_id: "prop-1",
          status: "pending",
          estimate_cents: 50,
          consumed_at: null,
          expires_at: farPast(),
          decision_note: null,
        },
      ],
    });
    const decision = await approvePaidOperation(
      { service },
      {
        ...baseUser,
        operation_type: "anthropic_call",
        estimate_cents: 50,
        provider: "anthropic",
        proposal_id: "prop-1",
      },
    );
    expect(decision).toMatchObject({
      approved: false,
      reason: "approval_expired",
    });
  });

  it("denies when the proposal_id has no matching approval", async () => {
    const service = stubService({ approvals: [] });
    const decision = await approvePaidOperation(
      { service },
      {
        ...baseUser,
        operation_type: "anthropic_call",
        estimate_cents: 50,
        provider: "anthropic",
        proposal_id: "missing",
      },
    );
    expect(decision).toMatchObject({
      approved: false,
      reason: "approval_denied",
    });
  });

  it("denies when the approval was already consumed", async () => {
    const service = stubService({
      approvals: [
        {
          id: "row-1",
          proposal_id: "prop-1",
          status: "approved",
          estimate_cents: 50,
          consumed_at: new Date().toISOString(),
          expires_at: farFuture(),
          decision_note: null,
        },
      ],
    });
    const decision = await approvePaidOperation(
      { service },
      {
        ...baseUser,
        operation_type: "anthropic_call",
        estimate_cents: 50,
        provider: "anthropic",
        proposal_id: "prop-1",
      },
    );
    expect(decision).toMatchObject({
      approved: false,
      reason: "approval_denied",
    });
  });
});
