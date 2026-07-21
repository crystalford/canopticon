import { buildSessionCookie, signSession } from "@canopticon/shared/auth";
import { describe, expect, it } from "vitest";
import app from "../src/index.ts";

const SECRET = "test-secret-blindspot";

function makeEnv() {
  return {
    SESSION_SECRET: SECRET,
    LOG_LEVEL: "info",
    OPERATOR_EMAIL: "op@test",
    PUBLIC_BASE: "https://canopticon.test",
    BLINDSPOT_BASE: "https://blindspot.canopticon.test",
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ results: [], meta: { changes: 0 } }),
        }),
      }),
    },
    ASSETS: { get: async () => null, head: async () => null },
    AI: {},
  };
}

async function loggedInCookie(): Promise<string> {
  const cookie = await signSession(
    { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
    SECRET,
  );
  return buildSessionCookie(cookie).split(";")[0] as string;
}

describe("blindspot Worker auth", () => {
  it("GET / renders anonymously (no login wall)", async () => {
    const env = makeEnv();
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/"), env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("The Blind Spot");
  });

  it("GET /health is public JSON", async () => {
    const env = makeEnv();
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/health"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; worker: string };
    expect(body.ok).toBe(true);
    expect(body.worker).toBe("canopticon-blindspot");
  });

  it("GET /method, /sources, /where are all public", async () => {
    const env = makeEnv();
    for (const path of ["/method", "/sources", "/where"]) {
      const res = await app.fetch(new Request(`https://blindspot.canopticon.test${path}`), env);
      expect(res.status, `${path} should be 200`).toBe(200);
    }
  });

  it("anonymous POST /refresh redirects to the publication login with next", async () => {
    const env = makeEnv();
    const res = await app.fetch(
      new Request("https://blindspot.canopticon.test/refresh", { method: "POST" }),
      env,
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("canopticon.test/auth/login");
    expect(decodeURIComponent(loc)).toContain("https://blindspot.canopticon.test/refresh");
  });

  it("logged-in POST /refresh redirects back to /", async () => {
    const env = makeEnv();
    const cookie = await loggedInCookie();
    const res = await app.fetch(
      new Request("https://blindspot.canopticon.test/refresh", {
        method: "POST",
        headers: { cookie },
      }),
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location") ?? "").toContain("/?refreshed=");
  });

  it("GET /auth/login 302s to the publication", async () => {
    const env = makeEnv();
    const res = await app.fetch(new Request("https://blindspot.canopticon.test/auth/login"), env);
    expect(res.status).toBe(302);
    expect(res.headers.get("location") ?? "").toContain("canopticon.test/auth/login");
  });

  it("a forged cookie (wrong secret) is treated as anonymous on /refresh", async () => {
    const env = makeEnv();
    const forged = await signSession(
      { uid: "evil", exp: Math.floor(Date.now() / 1000) + 3600 },
      "WRONG-SECRET",
    );
    const cookie = buildSessionCookie(forged).split(";")[0] as string;
    const res = await app.fetch(
      new Request("https://blindspot.canopticon.test/refresh", {
        method: "POST",
        headers: { cookie },
      }),
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location") ?? "").toContain("/auth/login");
  });
});
