import { describe, expect, it } from "vitest";
import app from "../src/index.ts";

const env = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test",
  ANTHROPIC_API_KEY: "test",
  OPENPARLIAMENT_USER_AGENT: "test",
  LOG_LEVEL: "info",
};

describe("GET /health", () => {
  it("returns ok:true", async () => {
    const res = await app.fetch(new Request("http://test/health"), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("error envelope", () => {
  it("returns 404 with the standard envelope for unknown routes", async () => {
    const res = await app.fetch(new Request("http://test/does-not-exist"), env);
    expect(res.status).toBe(404);
  });
});
