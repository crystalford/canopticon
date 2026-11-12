// The operator surface answers on canopticon.com only: Cloudflare Access is
// bound to that hostname, and /op and /v1/admin have no authentication of
// their own (access check, 2026-11-12: www answered a stranger).
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import app from "../src/index";

const env = { LOG_LEVEL: "error" } as unknown as Env;

describe("one front door", () => {
  it("sends every www request to the apex, method kept", async () => {
    const r = await app.fetch(
      new Request("https://www.canopticon.com/op/export?part=2", { method: "POST" }),
      env,
    );
    expect(r.status).toBe(308);
    expect(r.headers.get("location")).toBe("https://canopticon.com/op/export?part=2");
    const page = await app.fetch(new Request("https://www.canopticon.com/library"), env);
    expect(page.headers.get("location")).toBe("https://canopticon.com/library");
  });
  it("refuses the operator surface on any other real hostname", async () => {
    for (const path of ["/op/export", "/v1/admin/runtime", "/admin", "/auth/login"]) {
      const r = await app.fetch(
        new Request(`https://canopticon-api.someone.workers.dev${path}`, {
          headers: { "x-canopticon-email": "someone@example.com" },
        }),
        env,
      );
      expect(r.status, path).toBe(403);
    }
  });
});
