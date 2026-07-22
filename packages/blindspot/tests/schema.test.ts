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

describe("shell — design tokens + trust strip + brand", () => {
  it("embeds the publication's design tokens", async () => {
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/"), env);
    const html = await res.text();
    expect(html).toContain("--paper:");
    expect(html).toContain("#ecebe9");
    expect(html).toContain("--ink:");
    expect(html).toContain("--accent:");
    expect(html).toContain("#3a63a0");
  });

  it("loads the publication's type stack from Google Fonts", async () => {
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/"), env);
    const html = await res.text();
    expect(html).toContain("Geist");
    expect(html).toContain("Newsreader");
    expect(html).toContain("Geist+Mono");
  });

  it("shows the brand wordmark and the trust strip on every page", async () => {
    for (const path of ["/", "/method", "/sources", "/where"]) {
      const res = await app.fetch(new Request(`https://blindspot.canopticon.test${path}`), env);
      const html = await res.text();
      expect(html, `${path} should show the brand`).toContain("the blind spot");
      expect(html, `${path} should show the trust strip`).toContain("bs-trust");
      expect(html, `${path} should show the trust strip text`).toContain(
        "publicly released government statistics",
      );
    }
  });

  it("nav highlights the active page", async () => {
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/method"), env);
    const html = await res.text();
    expect(html).toMatch(/<a class="active" href="\/method">/);
  });

  it("anonymous viewers do NOT see the operator strip markup", async () => {
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/"), env);
    const html = await res.text();
    // The CSS rules for .bs-op-strip always ship (tokens + classes ship
    // together); only the markup is gated.
    expect(html).not.toContain('class="bs-op-strip"');
    expect(html).not.toContain("push-button mode · cron disabled");
    expect(html).not.toContain("⟳ Refresh sources");
  });

  it("links to the publication's Instruments index in the footer", async () => {
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/"), env);
    const html = await res.text();
    expect(html).toContain("canopticon.com/instruments");
  });
});

describe("the landing composes the four movements", () => {
  it("renders all four movement sections even with an empty database", async () => {
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/"), env);
    const html = await res.text();
    expect(html).toContain("The Spread");
    expect(html).toContain("The Invisibility Index");
    expect(html).toContain("The Behavior Strip");
    expect(html).toContain("Where do you stand?");
  });

  it("degrades each movement to a 'no data yet' slot with an empty DB", async () => {
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/"), env);
    const html = await res.text();
    expect(html).toContain("No data yet");
  });
});

describe("method paper", () => {
  it("renders the numbered sections with a sticky TOC", async () => {
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/method"), env);
    const html = await res.text();
    expect(html).toContain("The Proposition");
    expect(html).toContain("The Invisibility Index");
    expect(html).toContain("The Recovery Ratio");
    // Sticky TOC + deep-link anchors.
    expect(html).toContain("bs-method-toc");
    expect(html).toContain('id="proposition"');
    expect(html).toContain('href="#index"');
  });

  it("shows the honesty boxes (the firewall made legible)", async () => {
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/method"), env);
    const html = await res.text();
    expect(html).toContain("bs-honesty");
    expect(html).toContain("CANOPTICON construction");
    expect(html).toContain("scope mismatch");
  });

  it("interpolates the stated channel shares so prose can't drift from params", async () => {
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/method"), env);
    const html = await res.text();
    // unrealizedShare 0.55 → "55%"
    expect(html).toContain("55%");
  });
});

describe("sources catalog", () => {
  it("lists the official series with deep-link anchors", async () => {
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/sources"), env);
    const html = await res.text();
    expect(html).toContain("Survey of Financial Security");
    expect(html).toContain("Parliamentary Budget Officer");
    expect(html).toContain('id="sfs"');
    expect(html).toContain('id="pbo-hnw"');
  });

  it("separates official series from academic grounding", async () => {
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/sources"), env);
    const html = await res.text();
    expect(html).toContain("official series");
    expect(html).toContain("academic grounding");
  });
});
