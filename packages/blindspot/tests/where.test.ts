import { describe, expect, it } from "vitest";
import app from "../src/index.ts";

const env = {
  SESSION_SECRET: "test-secret-blindspot",
  LOG_LEVEL: "info",
  OPERATOR_EMAIL: "op@test",
  PUBLIC_BASE: "https://canopticon.test",
  BLINDSPOT_BASE: "https://blindspot.canopticon.test",
  DB: {
    prepare: () => {
      const stmt: Record<string, unknown> = {
        bind: () => stmt,
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ results: [], meta: { changes: 0 } }),
      };
      return stmt;
    },
  },
  ASSETS: { get: async () => null, head: async () => null },
  AI: {},
};

async function whereHtml(): Promise<string> {
  const res = await app.fetch(new Request("https://blindspot.canopticon.test/where"), env);
  expect(res.status).toBe(200);
  return res.text();
}

describe("/where — the one JS page", () => {
  it("has exactly one inline <script> and no external scripts", async () => {
    const html = await whereHtml();
    const opens = html.match(/<script/g) ?? [];
    expect(opens).toHaveLength(1);
    // No src= on any script tag — the JS is inline only.
    expect(html).not.toMatch(/<script[^>]*\ssrc=/);
  });

  it("states the privacy guarantee", async () => {
    const html = await whereHtml();
    expect(html).toContain("does not leave your browser");
    expect(html).toContain("We record nothing");
  });

  it("ships the calculator input, button, and the axis marker", async () => {
    const html = await whereHtml();
    expect(html).toContain('id="bs-nw-input"');
    expect(html).toContain('id="bs-nw-go"');
    expect(html).toContain('id="bs-marker"');
  });

  it("inlines the placement math (anchors + extrapolation) client-side", async () => {
    const html = await whereHtml();
    expect(html).toContain("ANCHORS");
    expect(html).toContain("thresholdCad");
    // The extrapolation branch past the official edge.
    expect(html).toContain("extrapolation");
  });

  it("makes no network call from the page script", async () => {
    const html = await whereHtml();
    expect(html).not.toContain("fetch(");
    expect(html).not.toContain("XMLHttpRequest");
    expect(html).not.toContain("localStorage");
  });
});
