// The Worker used to reflect any Origin with credentials on every route and
// accepted operator POSTs from anywhere. Pinned: only our origins get CORS
// headers, and a cross-site POST to /op/* is refused before any handler.
import { describe, expect, it } from "vitest";
import app from "../src/index";

const env = { DB: {} as D1Database } as never;

describe("CORS allow-list", () => {
  it("does not reflect a foreign origin", async () => {
    const res = await app.fetch(
      new Request("http://test/robots.txt", { headers: { origin: "https://evil.example" } }),
      env,
    );
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
  it("allows the site's own origin", async () => {
    const res = await app.fetch(
      new Request("http://test/robots.txt", { headers: { origin: "https://canopticon.com" } }),
      env,
    );
    expect(res.headers.get("access-control-allow-origin")).toBe("https://canopticon.com");
  });
});

describe("CSRF guard on /op POST", () => {
  it("refuses a POST whose Origin is another site", async () => {
    const res = await app.fetch(
      new Request("http://test/op/process/advance", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
      env,
    );
    expect(res.status).toBe(403);
  });
  it("refuses a POST whose Referer is another site when Origin is absent", async () => {
    const res = await app.fetch(
      new Request("http://test/op/process/advance", {
        method: "POST",
        headers: { referer: "https://evil.example/page" },
      }),
      env,
    );
    expect(res.status).toBe(403);
  });
  it("lets a same-origin POST through to the handler", async () => {
    const res = await app.fetch(
      new Request("http://test/op/process/advance", {
        method: "POST",
        headers: { origin: "http://test" },
      }),
      env,
    );
    expect(res.status).not.toBe(403);
  });
});
