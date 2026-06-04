import { describe, expect, it } from "vitest";
import app from "../src/index.ts";

// Empty-D1 stub: every query returns nothing, so the operator screens
// exercise their real render paths against an empty console.
function makeEmptyDb(): D1Database {
  const stmt = {
    bind() {
      return stmt;
    },
    async first() {
      return null;
    },
    async all() {
      return { results: [] };
    },
    async run() {
      return { results: [], meta: { changes: 0 } };
    },
  };
  return {
    prepare() {
      return stmt as unknown as D1PreparedStatement;
    },
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

const env = {
  ANTHROPIC_API_KEY: "test",
  LOG_LEVEL: "info",
  DB: makeEmptyDb(),
};

describe("operator console — six-surface IA (P0)", () => {
  it("/op renders the Feed surface with the dark-amber shell", async () => {
    const res = await app.fetch(new Request("http://test/op"), env);
    expect(res.status).toBe(200);
    const html = await res.text();
    // New shell: data-mode="operator", no longer "Console" as the home.
    expect(html).toMatch(/<html[^>]*data-mode="operator"/);
    expect(html).toContain("Feed");
    expect(html).toContain("Drop research reports here");
    // The six-surface rail.
    expect(html).toContain('class="rail"');
    for (const lbl of ["Feed", "Chat", "Synthesis", "Library", "Briefs", "Studio"]) {
      expect(html).toContain(lbl);
    }
    // noindex so the operator surface never gets crawled.
    expect(html).toContain('name="robots" content="noindex"');
    // Design tokens loaded.
    expect(html).toContain("--amber:");
  });

  for (const [path, expected] of Object.entries({
    "/op/chat": "Chat",
    "/op/synthesis": "Synthesis",
    "/op/library": "Library",
    "/op/briefs": "Briefs",
    "/op/studio": "Studio",
  })) {
    it(`${path} renders the ${expected} surface`, async () => {
      const res = await app.fetch(new Request(`http://test${path}`), env);
      expect(res.status, `path ${path}`).toBe(200);
      const html = await res.text();
      expect(html).toMatch(/<html[^>]*data-mode="operator"/);
      expect(html).toContain("<h1>");
      expect(html).toContain(expected);
    });
  }

  it("chat.js still serves the vanilla SSE consumer (reused in P3)", async () => {
    const res = await app.fetch(new Request("http://test/op/chat.js"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
    const js = await res.text();
    expect(js).toContain("message_delta");
    expect(js).toContain("tool_call");
    expect(js).toContain("getReader");
  });

  it("old screen paths 301-redirect to their new surface", async () => {
    const expected: Record<string, string> = {
      "/op/console": "/op",
      "/op/ingest": "/op",
      "/op/workbench": "/op/synthesis",
      "/op/leads": "/op/synthesis",
      "/op/patterns": "/op/synthesis",
      "/op/editorial": "/op/studio",
      "/op/build": "/op/briefs",
      "/op/publish": "/op/briefs",
    };
    for (const [from, to] of Object.entries(expected)) {
      const res = await app.fetch(new Request(`http://test${from}`), env);
      expect(res.status, `redirect from ${from}`).toBe(301);
      expect(res.headers.get("location"), `redirect target for ${from}`).toBe(to);
    }
  });

  it("old screen sub-paths also redirect", async () => {
    const res = await app.fetch(new Request("http://test/op/editorial/some-slug"), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/op/studio");
  });
});
