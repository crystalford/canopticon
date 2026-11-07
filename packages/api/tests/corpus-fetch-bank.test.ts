// A fetched page is a SOURCE, never a piece.
//
// expandRecord used to write every fetched third-party page to both `sources`
// and `pieces` and enqueue a digest job for it — which is how brainly.com
// answers and Cloudflare bot-challenge pages reached /library and the graph.
// This drives the real expandRecord against a fake D1 that records every
// INSERT and asserts, table by table, what a bank touches.

import { describe, expect, it } from "vitest";
import { expandRecord } from "../src/graph/lib/record-builder";

interface Insert {
  table: string;
  binds: unknown[];
}

function makeDb(): {
  db: D1Database;
  inserts: Insert[];
  events: Array<{ event_type: string; payload: Record<string, unknown> }>;
} {
  const inserts: Insert[] = [];
  const events: Array<{ event_type: string; payload: Record<string, unknown> }> = [];
  const stmt = (sql: string, binds: unknown[] = []) => ({
    bind(...vs: unknown[]) {
      return stmt(sql, vs);
    },
    async first() {
      return null; // no dedup hit, no cost whitelist
    },
    async all() {
      return { results: [] };
    },
    async run() {
      const m = /^INSERT INTO (\w+)/i.exec(sql.trim());
      if (m) {
        inserts.push({ table: m[1] as string, binds });
        if (m[1] === "orchestrator_events") {
          const eventType = binds.find(
            (v) => typeof v === "string" && v.startsWith("record."),
          ) as string;
          const raw = binds.find((v) => typeof v === "string" && v.startsWith("{")) as string;
          events.push({ event_type: eventType, payload: JSON.parse(raw ?? "{}") });
        }
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
    inserts,
    events,
  };
}

const html = (title: string, body: string) =>
  new Response(`<html><head><title>${title}</title></head><body><p>${body}</p></body></html>`, {
    status: 200,
    headers: { "content-type": "text/html" },
  });

/** The addresses Cloudflare's Web Search answers with: the stubbed pages. */
let searched: string[] = [];

/** A per-URL page table; anything else (the fallback chain: r.jina.ai,
 *  archive.org) gets a 500 so it yields nothing. */
function stubFetch(pages: Record<string, Response>) {
  const original = globalThis.fetch;
  searched = Object.keys(pages);
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    const page = pages[url];
    return page ? page.clone() : new Response("nope", { status: 500 });
  }) as unknown as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const env = (db: D1Database) =>
  ({
    DB: db,
    SEARCH_GATEWAY_ID: "canopticon-search",
    AI: {
      websearch: async () => ({
        items: searched.map((url) => ({ title: `Result ${url}`, url, snippet: "" })),
      }),
    },
  }) as unknown as Parameters<typeof expandRecord>[0];

describe("expandRecord banks sources only", () => {
  it("writes one sources row, no pieces row and no digest job for a real article", async () => {
    const { db, inserts, events } = makeDb();
    const restore = stubFetch({
      "https://a.example/article": html(
        "Housing starts fell in Q2",
        "Real article text with substance. ".repeat(20),
      ),
    });
    try {
      const report = await expandRecord(env(db), "u1", "housing starts");
      expect(report.sources_banked).toBe(1);
      expect(report.banked_source_ids).toHaveLength(1);
      expect(report.rejected).toEqual([]);

      const tables = inserts.map((i) => i.table);
      expect(tables.filter((t) => t === "sources")).toHaveLength(1);
      expect(tables).not.toContain("pieces");
      expect(tables).not.toContain("digest_jobs");

      // The source row is marked as the crawler's, so it can be told apart
      // from an upload's source row without a pieces row to carry the tag.
      const source = inserts.find((i) => i.table === "sources") as Insert;
      expect(source.binds).toContain("record-expand");
      expect(source.binds).toContain("https://a.example/article");

      const banked = events.find((e) => e.event_type === "record.expand.source_banked");
      expect(banked?.payload.title).toBe("Housing starts fell in Q2");
      const completed = events.find((e) => e.event_type === "record.expand.completed");
      expect(completed?.payload.banked_source_ids).toEqual(report.banked_source_ids);
      expect(completed?.payload).not.toHaveProperty("banked_piece_ids");
    } finally {
      restore();
    }
  });

  it("rejects a bot-challenge page before any write, and records why", async () => {
    const { db, inserts, events } = makeDb();
    const restore = stubFetch({
      "https://blocked.example/x": html(
        "Just a moment...",
        `Enable JavaScript and cookies to continue ${"x ".repeat(300)}`,
      ),
    });
    try {
      const report = await expandRecord(env(db), "u1", "blocked subject");
      expect(report.sources_banked).toBe(0);
      expect(report.sources_rejected).toBe(1);
      expect(report.rejected).toEqual([
        { url: "https://blocked.example/x", reason: "bot challenge" },
      ]);
      // A rejection is not a fetch error: nothing went wrong, the page was junk.
      expect(report.errors).toEqual([]);

      const tables = inserts.map((i) => i.table);
      expect(tables).not.toContain("sources");
      expect(tables).not.toContain("pieces");

      const rejected = events.find((e) => e.event_type === "record.expand.source_rejected");
      expect(rejected?.payload).toMatchObject({
        url: "https://blocked.example/x",
        reason: "bot challenge",
      });
      expect(events.map((e) => e.event_type)).not.toContain("record.expand.source_banked");
    } finally {
      restore();
    }
  });

  it("rejects a thin page with the character count", async () => {
    const { db, inserts, events } = makeDb();
    const restore = stubFetch({
      "https://thin.example/stub": html("A stub", "Too little here."),
    });
    try {
      const report = await expandRecord(env(db), "u1", "thin subject");
      expect(report.sources_rejected).toBe(1);
      expect(report.rejected[0]?.reason).toMatch(/^too short \(\d+ chars\)$/);
      expect(inserts.map((i) => i.table)).not.toContain("sources");
      const rejected = events.find((e) => e.event_type === "record.expand.source_rejected");
      expect(rejected?.payload.reason).toMatch(/^too short/);
    } finally {
      restore();
    }
  });
});
