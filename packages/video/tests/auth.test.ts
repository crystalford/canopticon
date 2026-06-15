import { buildSessionCookie, signSession } from "@canopticon/shared/auth";
import { describe, expect, it } from "vitest";
import app from "../src/index.ts";

const SECRET = "test-secret-video-worker";

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    SESSION_SECRET: SECRET,
    LOG_LEVEL: "info",
    OPERATOR_EMAIL: "op@test",
    PUBLIC_BASE: "https://canopticon.test",
    VIDEO_BASE: "https://video.canopticon.test",
    // Tiny stubs so /assets and / don't blow up on missing bindings.
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ results: [], meta: { changes: 0 } }),
        }),
      }),
    },
    ASSETS: {
      get: async () => null,
      head: async () => null,
    },
    AI: {},
    RENDER_CONTAINER: {},
    ...overrides,
  };
}

async function loggedInCookie(): Promise<string> {
  const cookie = await signSession(
    { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
    SECRET,
  );
  return buildSessionCookie(cookie).split(";")[0] as string;
}

describe("video Worker auth", () => {
  it("anonymous GET / redirects to canopticon.com/auth/login with next", async () => {
    const env = makeEnv();
    const res = await app.fetch(new Request("https://video.canopticon.test/"), env);
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("canopticon.test/auth/login");
    expect(loc).toContain("next=");
    expect(decodeURIComponent(loc)).toContain("https://video.canopticon.test/");
  });

  it("logged-in GET / renders the status page", async () => {
    const env = makeEnv();
    const cookie = await loggedInCookie();
    const res = await app.fetch(
      new Request("https://video.canopticon.test/", { headers: { cookie } }),
      env,
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Daily forensic video — status");
    expect(html).toContain("Run Phase 0 spike");
  });

  it("GET /health is public", async () => {
    const env = makeEnv();
    const res = await app.fetch(new Request("https://video.canopticon.test/health"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; worker: string };
    expect(body.ok).toBe(true);
    expect(body.worker).toBe("canopticon-video");
  });

  it("GET /auth/login 302s to the publication's login", async () => {
    const env = makeEnv();
    const res = await app.fetch(new Request("https://video.canopticon.test/auth/login"), env);
    expect(res.status).toBe(302);
    expect(res.headers.get("location") ?? "").toContain("canopticon.test/auth/login");
  });

  it("a forged cookie (wrong secret) is treated as anonymous", async () => {
    const env = makeEnv();
    const forged = await signSession(
      { uid: "evil", exp: Math.floor(Date.now() / 1000) + 3600 },
      "WRONG-SECRET",
    );
    const cookie = buildSessionCookie(forged).split(";")[0] as string;
    const res = await app.fetch(
      new Request("https://video.canopticon.test/", { headers: { cookie } }),
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location") ?? "").toContain("/auth/login");
  });

  it("anonymous POST /spike redirects to login", async () => {
    const env = makeEnv();
    const res = await app.fetch(
      new Request("https://video.canopticon.test/spike", { method: "POST" }),
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location") ?? "").toContain("/auth/login");
  });
});
