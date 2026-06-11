import { describe, expect, it } from "vitest";
import { expandRecord } from "../src/graph/lib/record-builder.ts";

// DB stub that captures every orchestrator_events insert so we can assert the
// progress narration is correct (started → search_done → source_seen ×N →
// completed, or started → skipped when the key is missing).
function makeDb(): { db: D1Database; events: Array<{ event_type: string; payload: string }> } {
  const events: Array<{ event_type: string; payload: string }> = [];
  const stmt = (sql: string, binds: unknown[] = []) => ({
    bind(...vs: unknown[]) {
      return stmt(sql, vs);
    },
    async first() {
      return null;
    },
    async all() {
      return { results: [] };
    },
    async run() {
      if (/INSERT INTO orchestrator_events/i.test(sql)) {
        // binds order matches the insertOne shape: id, ...columns. The event
        // type is at index that corresponds to "event_type" column; insertOne
        // serialises in insertion order. Captured here loosely by scanning.
        const bindArr = binds as unknown[];
        const eventType = bindArr.find(
          (v) =>
            typeof v === "string" &&
            (v.startsWith("record.") ||
              v.startsWith("feed.") ||
              v.startsWith("build.") ||
              v.startsWith("readings.")),
        ) as string | undefined;
        const payload = bindArr.find((v) => typeof v === "string" && v.startsWith("{")) as
          | string
          | undefined;
        if (eventType) events.push({ event_type: eventType, payload: payload ?? "" });
      }
      return { results: [], meta: { changes: 1 } };
    },
  });
  return {
    db: {
      prepare(sql: string) {
        return stmt(sql) as unknown as D1PreparedStatement;
      },
      dump: async () => new ArrayBuffer(0),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
    } as unknown as D1Database,
    events,
  };
}

describe("expandRecord — without BRAVE_SEARCH_API_KEY", () => {
  it("emits started + skipped events; reports configured=false", async () => {
    const { db, events } = makeDb();
    const env = { DB: db, BRAVE_SEARCH_API_KEY: undefined } as unknown as Parameters<
      typeof expandRecord
    >[0];
    const report = await expandRecord(env, "u1", "Mark Carney");
    expect(report.configured).toBe(false);
    expect(report.sources_found).toBe(0);
    const types = events.map((e) => e.event_type);
    expect(types).toContain("record.expand.started");
    expect(types).toContain("record.expand.skipped");
    expect(types).not.toContain("record.expand.completed");
  });
});

describe("expandRecord — with BRAVE_SEARCH_API_KEY", () => {
  it("hits the Brave Search endpoint and emits source_seen per result", async () => {
    const { db, events } = makeDb();
    // Stub global fetch to return 3 fake Brave results.
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          web: {
            results: [
              { title: "A", url: "https://a.example", description: "" },
              { title: "B", url: "https://b.example", description: "" },
              { title: "C", url: "https://c.example", description: "" },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;
    try {
      const env = { DB: db, BRAVE_SEARCH_API_KEY: "fake-key" } as unknown as Parameters<
        typeof expandRecord
      >[0];
      const report = await expandRecord(env, "u1", "Mark Carney");
      expect(report.configured).toBe(true);
      expect(report.sources_found).toBe(3);
      const types = events.map((e) => e.event_type);
      expect(types).toContain("record.expand.started");
      expect(types).toContain("record.expand.search_done");
      expect(types.filter((t) => t === "record.expand.source_seen").length).toBe(3);
      expect(types).toContain("record.expand.completed");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("emits a failed event when the search request errors", async () => {
    const { db, events } = makeDb();
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("nope", { status: 500 })) as unknown as typeof fetch;
    try {
      const env = { DB: db, BRAVE_SEARCH_API_KEY: "fake-key" } as unknown as Parameters<
        typeof expandRecord
      >[0];
      const report = await expandRecord(env, "u1", "Mark Carney");
      expect(report.errors.length).toBe(1);
      const types = events.map((e) => e.event_type);
      expect(types).toContain("record.expand.failed");
      expect(types).not.toContain("record.expand.completed");
    } finally {
      globalThis.fetch = original;
    }
  });
});
