// Signing in, and why it was impossible.
//
// Minting an operator session requires Cloudflare Access to verify the visitor
// and inject their email. Access is scoped to a PATH, and this site's
// application covers /op/* and the admin API — it cannot cover /*, because the
// publication is meant to be publicly readable.
//
// So /auth/login sat outside the gate it depends on. No header ever arrived,
// every attempt returned a bare unstyled 401, and the operator reported being
// unable to reach the upload form FOUR SEPARATE TIMES.
//
// The fix is a second mount inside /op/. These tests pin both halves: that it
// is reachable from the protected prefix, and that it still refuses everyone
// who has not been identified.

import { describe, expect, it } from "vitest";
import app from "../src/index.ts";

const env = {
  ANTHROPIC_API_KEY: "test",
  LOG_LEVEL: "error",
  SESSION_SECRET: "test-secret",
  OPERATOR_EMAIL: "operator@example.com",
  DB: {
    prepare: () => {
      const s: Record<string, unknown> = {
        bind: () => s,
        first: async () => ({ id: "op1" }),
        all: async () => ({ results: [] }),
        run: async () => ({ results: [], meta: { changes: 0 } }),
      };
      return s;
    },
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  },
};

const get = (path: string, headers: Record<string, string> = {}) =>
  app.fetch(new Request(`http://test${path}`, { headers }), env);

describe("it fails closed, from either mount", () => {
  // The security property. A second mount must add a route that WORKS, never
  // a way in — so with no Access identity, neither path may mint anything.
  it.each(["/auth/login", "/op/login"])("refuses %s when Access sent no email", async (p) => {
    const res = await get(p);
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("refuses an email that is not the operator", async () => {
    const res = await get("/op/login", {
      "cf-access-authenticated-user-email": "someone-else@example.com",
    });
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("it succeeds from the prefix Access actually protects", () => {
  it("mints a session at /op/login when Access identifies the operator", async () => {
    const res = await get("/op/login", {
      "cf-access-authenticated-user-email": "operator@example.com",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("set-cookie") ?? "").toContain("canopticon_op=");
  });

  it("still works at /auth/login for anyone whose Access does cover it", async () => {
    const res = await get("/auth/login", {
      "cf-access-authenticated-user-email": "operator@example.com",
    });
    expect(res.status).toBe(302);
  });
});

describe("a failure explains itself", () => {
  // Every failure used to be one line of unstyled plain text with nothing to
  // click — indistinguishable from the site being broken, which is exactly how
  // this stayed invisible.
  it("returns a real page naming the cause and the fix", async () => {
    const res = await get("/op/login");
    const html = await res.text();
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Cloudflare Access");
    // It must name the concrete remedy, not just the symptom.
    expect(html).toContain("/op/login");
    expect(html).toContain("Access → Applications");
    // And a way back, so it is never a dead end.
    expect(html).toContain('href="/"');
  });

  it("reports which identity headers arrived, so the gap is visible", async () => {
    const html = await (await get("/op/login")).text();
    expect(html).toMatch(/none of the Access identity headers/);
  });

  it("says so plainly when SESSION_SECRET is missing", async () => {
    const res = await app.fetch(new Request("http://test/op/login"), {
      ...env,
      SESSION_SECRET: undefined,
    });
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("SESSION_SECRET");
  });
});
