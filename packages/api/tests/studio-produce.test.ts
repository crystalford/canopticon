import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AuthContext } from "../src/auth/middleware.ts";
import studioRoutes, { renderStudioShell } from "../src/public/studio/routes.ts";
import {
  renderLongFormMarkdown,
  renderNewsletterHtml,
  renderNewsletterPlainText,
  wrapCarouselSlideForProduce,
  wrapFaceForProduce,
} from "../src/public/studio/produce.ts";
import { renderHtmlToPng } from "../src/public/studio/render-png.ts";

// Tiny D1 stub that returns the configured page row from any
// `SELECT ... FROM pages WHERE slug = ?` or `WHERE id = ?` lookup. Every
// other query no-ops so the face renderers' page_claims SELECTs don't
// throw.
function makeDb(pageRow: Record<string, unknown> | null) {
  const stmt = (sql: string, binds: unknown[] = []) => ({
    bind(...vs: unknown[]) {
      return stmt(sql, vs);
    },
    async first() {
      if (/FROM pages WHERE/i.test(sql)) return pageRow;
      return null;
    },
    async all() {
      return { results: [] };
    },
    async run() {
      return { results: [], meta: { changes: 0 } };
    },
  });
  return {
    prepare(sql: string) {
      return stmt(sql) as unknown as D1PreparedStatement;
    },
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

const PAGE = {
  id: "p1",
  slug: "carney",
  thesis: "the framework moves",
  body_md: "Across four institutions, the same architecture recurs.",
  body_html: "<p>Across four institutions, the same architecture recurs.</p>",
  signed_by: "the operator",
  signed_at: "2026-06-12T10:00:00Z",
  signed_status: "published",
};

describe("wrapFaceForProduce", () => {
  it("wraps face HTML in a self-contained doc with face-vars CSS", () => {
    const doc = wrapFaceForProduce(`<div class="card-face">hello</div>`);
    expect(doc).toContain("<!doctype html>");
    expect(doc).toContain("--paper:");
    expect(doc).toContain(`<div class="card-face">hello</div>`);
    expect(doc).not.toContain("<nav"); // no site chrome
    expect(doc).not.toContain("trust-strip"); // no public-page chrome
  });
});

describe("renderHtmlToPng — Browser Rendering not configured", () => {
  it("returns unconfigured:true with a clear error message", async () => {
    const result = await renderHtmlToPng({}, "<html></html>", { width: 1200, height: 630 });
    expect(result.ok).toBe(false);
    expect(result.unconfigured).toBe(true);
    expect(result.error).toMatch(/CLOUDFLARE_ACCOUNT_ID/);
    expect(result.error).toMatch(/CLOUDFLARE_API_TOKEN/);
  });
});

describe("renderStudioShell — operator preview page", () => {
  it("includes a Download PNG button per platform target (card → X + IG)", () => {
    const html = renderStudioShell({
      page: PAGE as never,
      faceKind: "card",
      facePreviewHtml: '<div class="card-face">preview</div>',
    });
    expect(html).toContain("Produce — Card");
    expect(html).toContain("X (1200×630)");
    expect(html).toContain("Instagram (1080×1080)");
    expect(html).toContain(`action="/studio/${PAGE.id}/card/produce"`);
    expect(html).toContain('<div class="card-face">preview</div>');
    expect(html).toContain(`href="/s/${PAGE.slug}?mode=signed"`);
  });

  it("includes a single X post target for thread", () => {
    const html = renderStudioShell({
      page: PAGE as never,
      faceKind: "thread",
      facePreviewHtml: '<div class="thread-face">preview</div>',
    });
    expect(html).toContain("Produce — Thread");
    expect(html).toContain("X post (1200×675)");
    expect(html).not.toContain("Instagram"); // card-only target
  });

  it("surfaces the err message when redirected back from a failed produce", () => {
    const html = renderStudioShell({
      page: PAGE as never,
      faceKind: "card",
      facePreviewHtml: "",
      message: "browser-rendering-not-configured",
    });
    expect(html).toContain("browser-rendering-not-configured");
  });
});

describe("GET /studio/:slug/:kind — operator gating", () => {
  // Wrap the studio sub-app in a parent app that simulates the
  // attachAuthState middleware (so the test controls is_operator).
  function mount(isOperator: boolean) {
    const app = new Hono<AuthContext>();
    app.use("*", async (c, next) => {
      c.set("is_operator", isOperator);
      c.set("operator_id", isOperator ? "op-1" : null);
      await next();
    });
    app.route("/studio", studioRoutes);
    return app;
  }

  it("redirects anonymous viewers to /", async () => {
    const app = mount(false);
    const env = { DB: makeDb(PAGE) } as unknown as Parameters<typeof studioRoutes.fetch>[1];
    const res = await app.fetch(new Request("http://x/studio/carney/card"), env);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });

  it("renders the preview page for the operator", async () => {
    const app = mount(true);
    const env = { DB: makeDb(PAGE) } as unknown as Parameters<typeof studioRoutes.fetch>[1];
    const res = await app.fetch(new Request("http://x/studio/carney/card"), env);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Produce — Card");
    expect(body).toContain("Download PNG — X (1200×630)");
  });

  it("404s on an unsupported face kind", async () => {
    const app = mount(true);
    const env = { DB: makeDb(PAGE) } as unknown as Parameters<typeof studioRoutes.fetch>[1];
    const res = await app.fetch(new Request("http://x/studio/carney/chapter"), env);
    expect(res.status).toBe(404);
  });
});

describe("POST /studio/:pageId/:kind/produce — Browser Rendering stub", () => {
  function mount(isOperator: boolean) {
    const app = new Hono<AuthContext>();
    app.use("*", async (c, next) => {
      c.set("is_operator", isOperator);
      c.set("operator_id", isOperator ? "op-1" : null);
      await next();
    });
    app.route("/studio", studioRoutes);
    return app;
  }

  it("redirects back to the preview page with err=browser-rendering-not-configured when Browser Rendering env is unset", async () => {
    const app = mount(true);
    // No CLOUDFLARE_ACCOUNT_ID, no CLOUDFLARE_API_TOKEN → unconfigured.
    const env = { DB: makeDb(PAGE) } as unknown as Parameters<typeof studioRoutes.fetch>[1];
    const form = new FormData();
    form.set("target", "x");
    const res = await app.fetch(
      new Request("http://x/studio/p1/card/produce", { method: "POST", body: form }),
      env,
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/studio/carney/card");
    expect(loc).toContain("err=browser-rendering-not-configured");
  });

  it("rejects anonymous POSTs with a redirect home", async () => {
    const app = mount(false);
    const env = { DB: makeDb(PAGE) } as unknown as Parameters<typeof studioRoutes.fetch>[1];
    const form = new FormData();
    form.set("target", "x");
    const res = await app.fetch(
      new Request("http://x/studio/p1/card/produce", { method: "POST", body: form }),
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });
});

describe("renderStudioShell — carousel / newsletter / long-form", () => {
  it("renders six download buttons for the carousel kind (one per slide)", () => {
    // Build a fake preview with the right number of slide divs so the
    // button-count heuristic finds them.
    const slides = Array.from({ length: 6 }, () => `<div class="carousel-slide"></div>`).join("");
    const html = renderStudioShell({
      page: PAGE as never,
      faceKind: "carousel",
      facePreviewHtml: `<div class="carousel-face"><div class="carousel-deck">${slides}</div></div>`,
    });
    expect(html).toContain("Produce — Carousel");
    expect(html).toContain("Slide 1 PNG");
    expect(html).toContain("Slide 6 PNG");
    expect(html).not.toContain("Slide 7 PNG");
  });

  it("renders HTML + plain-text download buttons for newsletter", () => {
    const html = renderStudioShell({
      page: PAGE as never,
      faceKind: "newsletter",
      facePreviewHtml: "<div>preview</div>",
    });
    expect(html).toContain("Produce — Newsletter");
    expect(html).toContain("Download email HTML");
    expect(html).toContain("Download plain text");
  });

  it("renders a Markdown download button for long-form", () => {
    const html = renderStudioShell({
      page: PAGE as never,
      faceKind: "long-form",
      facePreviewHtml: "<pre>md preview</pre>",
    });
    expect(html).toContain("Produce — Long-form");
    expect(html).toContain("Download Markdown");
  });
});

describe("Newsletter rendering — email-safe HTML + plain text", () => {
  const args = {
    slug: "carney",
    thesis: "the framework moves",
    bodyMd: "Across four institutions, the same architecture recurs.",
    bodyHtml: "<p>Across four institutions, the same architecture recurs.</p>",
    signedBy: "Christopher Telford",
    signedAt: "2026-06-12T10:00:00Z",
  };

  it("produces email-safe HTML with inline styles only (no <style> in head)", () => {
    const html = renderNewsletterHtml(args);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('style="margin:0;padding:0;');
    expect(html).toContain("the framework moves");
    expect(html).toContain("Across four institutions");
    expect(html).toContain("Christopher Telford");
    expect(html).toContain("canopticon.com/s/carney");
    // No external CSS — should be entirely self-contained.
    expect(html).not.toContain('<link rel="stylesheet"');
  });

  it("produces plain text with thesis, body, signature, and link", () => {
    const text = renderNewsletterPlainText(args);
    expect(text).toContain("CANOPTICON · 2026-06-12");
    expect(text).toContain("the framework moves");
    expect(text).toContain("Across four institutions");
    expect(text).toContain("— Christopher Telford");
    expect(text).toContain("https://canopticon.com/s/carney");
  });
});

describe("Long-form Markdown export", () => {
  it("produces a markdown doc with YAML front-matter + body", () => {
    const md = renderLongFormMarkdown({
      slug: "carney",
      thesis: "the framework moves",
      bodyMd: "Across four institutions, the same architecture recurs.",
      signedBy: "Christopher Telford",
      signedAt: "2026-06-12T10:00:00Z",
      chapterMd: null,
    });
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toContain('title: "the framework moves"');
    expect(md).toContain("slug: carney");
    expect(md).toContain("signed_by: Christopher Telford");
    expect(md).toContain("Across four institutions");
  });

  it("appends the chapter outline when available", () => {
    const md = renderLongFormMarkdown({
      slug: "carney",
      thesis: "the framework moves",
      bodyMd: "Body paragraph.",
      signedBy: null,
      signedAt: null,
      chapterMd: "**1. Section** — bullet\n**2. Section** — bullet",
    });
    expect(md).toContain("## Chapter outline");
    expect(md).toContain("**1. Section**");
  });
});

describe("Carousel wrap", () => {
  it("paints a 1080×1350 fixed-size stage for the screenshot", () => {
    const doc = wrapCarouselSlideForProduce(`<div class="carousel-slide">slide</div>`);
    expect(doc).toContain("<!doctype html>");
    expect(doc).toContain("1080px");
    expect(doc).toContain("1350px");
    expect(doc).toContain(`<div class="carousel-slide">slide</div>`);
  });
});

describe("Newsletter and long-form produce — download responses", () => {
  function mount(isOperator: boolean) {
    const app = new Hono<AuthContext>();
    app.use("*", async (c, next) => {
      c.set("is_operator", isOperator);
      c.set("operator_id", isOperator ? "op-1" : null);
      await next();
    });
    app.route("/studio", studioRoutes);
    return app;
  }

  it("newsletter html download returns text/html with attachment disposition", async () => {
    const app = mount(true);
    const env = { DB: makeDb(PAGE) } as unknown as Parameters<typeof studioRoutes.fetch>[1];
    const form = new FormData();
    form.set("target", "html");
    const res = await app.fetch(
      new Request("http://x/studio/p1/newsletter/produce", { method: "POST", body: form }),
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("content-disposition") ?? "").toContain(`filename="${PAGE.slug}-newsletter.html"`);
  });

  it("newsletter text download returns text/plain", async () => {
    const app = mount(true);
    const env = { DB: makeDb(PAGE) } as unknown as Parameters<typeof studioRoutes.fetch>[1];
    const form = new FormData();
    form.set("target", "text");
    const res = await app.fetch(
      new Request("http://x/studio/p1/newsletter/produce", { method: "POST", body: form }),
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  it("long-form download returns text/markdown", async () => {
    const app = mount(true);
    const env = { DB: makeDb(PAGE) } as unknown as Parameters<typeof studioRoutes.fetch>[1];
    const form = new FormData();
    form.set("target", "md");
    const res = await app.fetch(
      new Request("http://x/studio/p1/long-form/produce", { method: "POST", body: form }),
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
  });
});

describe("Studio index — GET /studio/:slug", () => {
  function mount() {
    const app = new Hono<AuthContext>();
    app.use("*", async (c, next) => {
      c.set("is_operator", true);
      c.set("operator_id", "op-1");
      await next();
    });
    app.route("/studio", studioRoutes);
    return app;
  }

  it("lists every Stage A format as a card link", async () => {
    const app = mount();
    const env = { DB: makeDb(PAGE) } as unknown as Parameters<typeof studioRoutes.fetch>[1];
    const res = await app.fetch(new Request("http://x/studio/carney"), env);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Studio — Produce");
    expect(body).toContain("Card →");
    expect(body).toContain("Thread →");
    expect(body).toContain("Carousel →");
    expect(body).toContain("Newsletter →");
    expect(body).toContain("Long-form →");
  });
});
