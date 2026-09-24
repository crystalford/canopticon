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
    expect(html).toContain("research documents kept whole");
    expect(html).toMatch(/\/styles\.css\?v=/);
    // The design build's data-mode toggle is on the root <html>
    expect(html).toMatch(/<html[^>]*data-mode="public"/);
    // Site-level identity, so every page's publisher resolves to one
    // organisation rather than a fresh one per URL.
    expect(html).toContain('"@id":"https://canopticon.com/#org"');
    expect(html).toContain('"@type":"WebSite"');
    expect(html).toContain('<link rel="canonical" href="https://canopticon.com/" />');
  });

  it("each primary destination renders real surfaces without JS", async () => {
    // The three doors are Essays, Research and About. /topics and
    // /investigations used to be in this list; both redirect to /research
    // now (docs/the-record.md §9) and are asserted as redirects below.
    for (const path of ["/essays", "/research"]) {
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
    for (const path of ["/p/does-not-exist", "/library/does-not-exist", "/q/does-not-exist"]) {
      const res = await app.fetch(new Request(`http://test${path}`), env);
      expect(res.status, `path ${path}`).toBe(404);
      const html = await res.text();
      expect(html).toContain("We don't have a page here.");
    }
  });

  it("retired rooms redirect, never render", async () => {
    // Every graph-era URL shape lands on a live surface. Subject-shaped URLs
    // go to search for the subject, so a citation already in the world still
    // answers for something.
    const expected: Record<string, string> = {
      "/topics": "/research",
      "/investigations/some-doc": "/p/some-doc",
      "/briefs/some-doc": "/p/some-doc",
      "/activity": "/",
      "/instruments": "/",
      "/studio/anything/here": "/",
      "/bulk-expand": "/library",
      "/s/mark-carney": "/search?q=mark%20carney",
      "/record/mark-carney": "/search?q=mark%20carney",
      "/t/mark-carney": "/search?q=mark%20carney",
      "/ct/mark-carney": "/search?q=mark%20carney",
      "/topics/housing": "/search?q=housing",
    };
    for (const [from, to] of Object.entries(expected)) {
      const res = await app.fetch(new Request(`http://test${from}`), env);
      expect(res.status, `status for ${from}`).toBe(301);
      expect(res.headers.get("location"), `target for ${from}`).toBe(to);
    }
  });

  it("styles.css serves the design system with immutable caching", async () => {
    const res = await app.fetch(new Request("http://test/styles.css"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/css/);
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(res.headers.get("x-styles-hash")).toBeTruthy();
    const css = await res.text();
    // Sanity: spot-check the design system tokens are present. (--pub-* used
    // to be checked here; that warm-paper set was deleted — it had zero
    // references anywhere and only looked live.)
    expect(css).toContain("--op-paper");
    expect(css).toContain("--accent");
    // One accent, and it is red. The five per-zone hues are gone.
    expect(css).toContain("#e0433c");
    expect(css).not.toContain("--z-investigations");
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

// A sweep on 2026-09-23 found these still resolving as full pages, none
// linked from anywhere, each describing a part of the product that no longer
// exists — and /how-it-works rendering six stat tiles that read "undefined".
// A reachable page that describes the wrong product is worse than no page.
describe("retired rooms redirect to the surface that does their job", () => {
  for (const [from, to] of Object.entries({
    "/how-it-works": "/method",
    "/investigations": "/research",
    "/patterns": "/research",
    "/watchlist": "/library",
    "/videos": "/",
  })) {
    it(`${from} → ${to}`, async () => {
      const res = await app.fetch(new Request(`http://test${from}`), env);
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(to);
    });
  }

  it("the design prototype is no longer a live route", async () => {
    // It was a labelled mock with fake data at /op/design. A prototype that
    // is reachable is a page, and it was the only page in an amber palette.
    const res = await app.fetch(new Request("http://test/op/design"), env);
    expect(res.status).not.toBe(200);
  });

  it("/method no longer describes signed analyses, lenses or a second judge", async () => {
    const res = await app.fetch(new Request("http://test/method"), env);
    const html = await res.text();
    for (const stale of [
      "One file, two views",
      "The lenses",
      "signed analysis",
      "second, independent judge",
    ]) {
      expect(html, stale).not.toContain(stale);
    }
    // And it does describe what is there.
    expect(html).toContain("Verified quotes");
    expect(html).toContain("Findings");
  });
});
