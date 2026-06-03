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

describe("operator console — Phase 3", () => {
  it("console screen renders the operator shell (dark mode)", async () => {
    const res = await app.fetch(new Request("http://test/op"), env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<html[^>]*data-mode="operator"/);
    expect(html).toContain("operator console");
    expect(html).toContain("Console");
    // noindex so the operator surface never gets crawled.
    expect(html).toContain('name="robots" content="noindex"');
  });

  it("chat screen renders history container + composer + client script", async () => {
    const res = await app.fetch(new Request("http://test/op/chat"), env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="chat-scroll"');
    expect(html).toContain('id="chat-form"');
    expect(html).toContain('id="chat-input"');
    expect(html).toContain('src="/op/chat.js"');
    expect(html).toContain('id="chat-bootstrap"');
  });

  it("chat.js serves vanilla JS with the SSE consumer", async () => {
    const res = await app.fetch(new Request("http://test/op/chat.js"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
    const js = await res.text();
    expect(js).toContain("message_delta");
    expect(js).toContain("tool_call");
    expect(js).toContain("getReader");
  });

  it("each operator screen renders the op shell", async () => {
    for (const path of [
      "/op/workbench",
      "/op/build",
      "/op/editorial",
      "/op/leads",
      "/op/patterns",
      "/op/publish",
      "/op/studio",
    ]) {
      const res = await app.fetch(new Request(`http://test${path}`), env);
      expect(res.status, `path ${path}`).toBe(200);
      const html = await res.text();
      expect(html).toMatch(/<html[^>]*data-mode="operator"/);
    }
  });

  it("ingest screen renders the drop-files form", async () => {
    const res = await app.fetch(new Request("http://test/op/ingest"), env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<html[^>]*data-mode="operator"/);
    expect(html).toContain("Drop a document");
    expect(html).toContain("/op/ingest/upload");
  });
});
