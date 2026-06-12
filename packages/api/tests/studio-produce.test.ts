import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AuthContext } from "../src/auth/middleware.ts";
import studioRoutes, { renderStudioShell } from "../src/public/studio/routes.ts";
import { wrapFaceForProduce } from "../src/public/studio/produce.ts";
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
  signed_by: "the operator",
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
