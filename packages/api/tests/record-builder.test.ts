import { describe, expect, it } from "vitest";
import { expandRecord } from "../src/graph/lib/record-builder.ts";

// DB stub that captures every orchestrator_events insert so we can assert the
// progress narration is correct (started → search_done → source_seen ×N →
// completed, or started → skipped when the key is missing).
function makeDb(opts: { browserRenderingWhitelisted?: boolean } = {}): {
  db: D1Database;
  events: Array<{ event_type: string; payload: string }>;
} {
  const events: Array<{ event_type: string; payload: string }> = [];
  const stmt = (sql: string, binds: unknown[] = []) => ({
    bind(...vs: unknown[]) {
      return stmt(sql, vs);
    },
    async first() {
      // approvePaidOperation's whitelist lookup (cost/approve.ts) — the
      // browser-rendering fallback needs this to say "approved" for tests
      // that exercise it; every other first() stays a plain miss.
      if (opts.browserRenderingWhitelisted && /FROM cost_whitelists/i.test(sql)) {
        return { enabled: 1, per_op_max_cents: 1, daily_max_cents: 50, monthly_max_cents: 300 };
      }
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

/** Cloudflare's Web Search, answering with these addresses (Brave is gone). */
const cfSearch = (urls: string[] | Error) => ({
  SEARCH_GATEWAY_ID: "canopticon-search",
  AI: {
    websearch: async () => {
      if (urls instanceof Error) throw urls;
      return { items: urls.map((url) => ({ title: "Result", url, snippet: "" })) };
    },
  },
});

describe("expandRecord — without the search gateway", () => {
  it("emits started + skipped events; reports configured=false", async () => {
    const { db, events } = makeDb();
    const env = { DB: db } as unknown as Parameters<typeof expandRecord>[0];
    const report = await expandRecord(env, "u1", "Mark Carney");
    expect(report.configured).toBe(false);
    expect(report.sources_found).toBe(0);
    const types = events.map((e) => e.event_type);
    expect(types).toContain("record.expand.started");
    expect(types).toContain("record.expand.skipped");
    expect(types).not.toContain("record.expand.completed");
  });
});

describe("expandRecord — with Cloudflare's Web Search", () => {
  it("searches, emits source_fetching per result, fails fetch on each (no per-URL stub)", async () => {
    const { db, events } = makeDb();
    // Cloudflare's search returns 3 results; the per-source
    // fetches afterward fail (no body) so the loop emits source_failed and
    // moves on. We assert the EVENT TYPES match the v2.6 record-builder
    // pipeline shape, not that any source got banked (that needs an HTML
    // stub the test doesn't currently provide).
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      // Per-source fetches: simulate a 500 so the source loop catches and
      // emits source_failed.
      return new Response("nope", { status: 500 });
    }) as unknown as typeof fetch;
    try {
      const env = {
        DB: db,
        ...cfSearch(["https://a.example", "https://b.example", "https://c.example"]),
      } as unknown as Parameters<typeof expandRecord>[0];
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
      const env = { DB: db, ...cfSearch(new Error("Invalid gateway")) } as unknown as Parameters<
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

describe("expandRecord — Browser Rendering fetch-fallback", () => {
  it("banks a source via the fallback when the plain fetch 403s and the cost gate approves", async () => {
    const { db, events } = makeDb({ browserRenderingWhitelisted: true });
    const article = `<html><head><title>WEF Article</title></head><body><p>${"Rendered content only a headless browser could fetch. ".repeat(20)}</p></body></html>`;
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      if (url.includes("browser-rendering")) {
        return new Response(JSON.stringify({ success: true, result: article }), { status: 200 });
      }
      // Plain fetch of the WEF page — bot-blocked.
      return new Response("forbidden", { status: 403 });
    }) as unknown as typeof fetch;
    try {
      const env = {
        DB: db,
        ...cfSearch(["https://weforum.org/x"]),
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_API_TOKEN: "token",
      } as unknown as Parameters<typeof expandRecord>[0];
      const report = await expandRecord(env, "u1", "World Economic Forum");
      expect(report.sources_banked).toBe(1);
      expect(report.errors).toEqual([]);
      const types = events.map((e) => e.event_type);
      expect(types).toContain("record.expand.source_banked");
      expect(types).not.toContain("record.expand.source_failed");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("falls through to the original failure when the cost gate is not whitelisted", async () => {
    const { db, events } = makeDb({ browserRenderingWhitelisted: false });
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response("forbidden", { status: 403 });
    }) as unknown as typeof fetch;
    try {
      const env = {
        DB: db,
        ...cfSearch(["https://weforum.org/x"]),
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_API_TOKEN: "token",
      } as unknown as Parameters<typeof expandRecord>[0];
      const report = await expandRecord(env, "u1", "World Economic Forum");
      expect(report.sources_banked).toBe(0);
      const types = events.map((e) => e.event_type);
      expect(types).toContain("record.expand.source_failed");
    } finally {
      globalThis.fetch = original;
    }
  });
});
