import { describe, expect, it, vi } from "vitest";
import { emitEvent } from "../src/orchestrator/events.ts";

interface CapturedInsert {
  table: string;
  row: Record<string, unknown>;
}

function stubService(captured: CapturedInsert[], simulateError?: string) {
  function from(table: string) {
    return {
      insert: (row: Record<string, unknown>) => {
        captured.push({ table, row });
        return Promise.resolve(
          simulateError ? { error: { message: simulateError } } : { error: null },
        );
      },
    };
  }
  return { from } as unknown as Parameters<typeof emitEvent>[0];
}

describe("emitEvent", () => {
  it("inserts an orchestrator_events row with the supplied fields", async () => {
    const captured: CapturedInsert[] = [];
    const service = stubService(captured);

    await emitEvent(service, {
      user_id: "alice",
      event_type: "research.started",
      entity_id: "run-1",
      entity_type: "research_run",
      payload: { topic: "test", budget_cents: 500 },
    });

    expect(captured).toHaveLength(1);
    const insert = captured[0];
    if (!insert) throw new Error("expected one insert");
    expect(insert.table).toBe("orchestrator_events");
    expect(insert.row).toMatchObject({
      user_id: "alice",
      event_type: "research.started",
      entity_id: "run-1",
      entity_type_str: "research_run",
      payload: { topic: "test", budget_cents: 500 },
    });
  });

  it("defaults entity fields to null and payload to empty object", async () => {
    const captured: CapturedInsert[] = [];
    const service = stubService(captured);
    await emitEvent(service, {
      user_id: "alice",
      event_type: "cascade.started",
    });
    const row = captured[0]?.row;
    expect(row?.entity_id).toBeNull();
    expect(row?.entity_type_str).toBeNull();
    expect(row?.payload).toEqual({});
  });

  it("swallows DB errors and warns instead of throwing", async () => {
    const captured: CapturedInsert[] = [];
    const service = stubService(captured, "RLS policy violation");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      emitEvent(service, { user_id: "alice", event_type: "research.failed" }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      "emitEvent failed",
      expect.objectContaining({
        event_type: "research.failed",
        message: "RLS policy violation",
      }),
    );

    warnSpy.mockRestore();
  });
});
