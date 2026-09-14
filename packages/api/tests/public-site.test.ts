import { describe, expect, it } from "vitest";
import app from "../src/index.ts";

// Minimal D1 stub: every SELECT returns empty results, so the public
// surfaces exercise their real render paths against an empty corpus
// (the Phase 2 "renders gracefully empty before seed" requirement).
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
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test",
  ANTHROPIC_API_KEY: "test",
  OPENPARLIAMENT_USER_AGENT: "test",
  LOG_LEVEL: "info",
  DB: makeEmptyDb(),
};

describe("public site — Phase 1 skeleton", () => {
  it("home page renders complete HTML with the design system link", async () => {
    const res = await app.fetch(new Request("http://test/"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toMatch(/<!doctype html>/i);
    expect(html).toMatch(/<title>CANOPTICON[^<]*<\/title>/);
    expect(html).toContain("canopticon");
    expect(html).toContain("Canopticon keeps files on the stories we're told.");
    expect(html).toMatch(/\/styles\.css\?v=/);
    // The design build's data-mode toggle is on the root <html>
    expect(html).toMatch(/<html[^>]*data-mode="public"/);
  });

  it("each primary destination renders real surfaces without JS", async () => {
    // The three doors are Essays, Research and About. /topics and
    // /investigations still resolve — they are unlinked, not removed — so they
    // are checked here too, to keep old inbound links from rotting silently.
    for (const path of ["/essays", "/research", "/topics", "/investigations"]) {
      const res = await app.fetch(new Request(`http://test${path}`), env);
      expect(res.status, `path ${path}`).toBe(200);
      const html = await res.text();
      // The Record shell renders server-side (wordmark + nav).
      expect(html, `path ${path} shell`).toContain('class="wordmark"');
      expect(html, `path ${path} nav`).toContain(">Essays<");
      expect(html, `path ${path} nav`).toContain(">Research<");
      // Empty corpus → graceful empty state, not a crash.
      expect(html, `path ${path} empty state`).toMatch(/No .* yet|is empty|No published/i);
      // Confirms no client-side rendering needed — content sits in HTML.
      expect(html).not.toContain("__NEXT_DATA__");
    }
  });

  it("a missing detail slug returns the styled 404", async () => {
    for (const path of [
      "/topics/does-not-exist",
      "/investigations/does-not-exist",
      "/record/does-not-exist",
    ]) {
      const res = await app.fetch(new Request(`http://test${path}`), env);
      expect(res.status, `path ${path}`).toBe(404);
      const html = await res.text();
      expect(html).toContain("We don't have a page here.");
    }
  });

  it("styles.css serves the design system with immutable caching", async () => {
    const res = await app.fetch(new Request("http://test/styles.css"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/css/);
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(res.headers.get("x-styles-hash")).toBeTruthy();
    const css = await res.text();
    // Sanity: spot-check the design system tokens are present.
    expect(css).toContain("--pub-paper");
    expect(css).toContain("--op-paper");
    expect(css.length).toBeGreaterThan(60_000);
  });

  it("unknown public path returns the styled 404 in HTML", async () => {
    const res = await app.fetch(new Request("http://test/nope-not-real"), env);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain("Not found");
    expect(html).toContain("/nope-not-real");
  });

  it("unknown /v1 path returns JSON, not HTML", async () => {
    const res = await app.fetch(new Request("http://test/v1/does-not-exist"), env);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe("not_found");
  });
});
