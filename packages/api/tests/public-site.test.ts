import { describe, expect, it } from "vitest";
import app from "../src/index.ts";

const env = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test",
  ANTHROPIC_API_KEY: "test",
  OPENPARLIAMENT_USER_AGENT: "test",
  LOG_LEVEL: "info",
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
    expect(html).toContain("The standing record beneath the headlines.");
    expect(html).toMatch(/\/styles\.css\?v=/);
    // The design build's data-mode toggle is on the root <html>
    expect(html).toMatch(/<html[^>]*data-mode="public"/);
  });

  it("each primary destination renders without JS", async () => {
    for (const path of ["/topics", "/investigations", "/record", "/patterns", "/library"]) {
      const res = await app.fetch(new Request(`http://test${path}`), env);
      expect(res.status, `path ${path}`).toBe(200);
      const html = await res.text();
      // The active nav entry must appear in the rendered markup.
      expect(html, `path ${path} body`).toContain("Phase 1 skeleton");
      // Confirms no client-side rendering needed — content sits in HTML.
      expect(html).not.toContain("__NEXT_DATA__");
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
