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
  it("hits Brave Search, emits source_fetching per result, fails fetch on each (no per-URL stub)", async () => {
    const { db, events } = makeDb();
    // Stub global fetch: Brave Search returns 3 results; the per-source
    // fetches afterward fail (no body) so the loop emits source_failed and
    // moves on. We assert the EVENT TYPES match the v2.6 record-builder
    // pipeline shape, not that any source got banked (that needs an HTML
    // stub the test doesn't currently provide).
    let calls = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      calls++;
      if (calls === 1) {
        return new Response(
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
        );
      }
      // Per-source fetches: simulate a 500 so the source loop catches and
      // emits source_failed.
      return new Response("nope", { status: 500 });
    }) as unknown as typeof fetch;
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
      // One source_fetching per result, then a source_failed because the
      // per-URL fetch returned 500. The full success path (source_banked +
      // source_extracted) requires an HTML stub which the test doesn't
      // currently provide.
      expect(types.filter((t) => t === "record.expand.source_fetching").length).toBe(3);
      expect(types.filter((t) => t === "record.expand.source_failed").length).toBe(3);
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
