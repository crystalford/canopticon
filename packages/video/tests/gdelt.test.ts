import { afterEach, describe, expect, it } from "vitest";
import { fetchCandidates } from "../src/sourcing/gdelt.ts";

const originalFetch = globalThis.fetch;

describe("fetchCandidates — GDELT TV client", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the stubbed list when the API is unreachable", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network");
    }) as never;
    const got = await fetchCandidates();
    expect(got.length).toBeGreaterThan(0);
    for (const c of got) {
      expect(c.source).toBe("stub");
      expect(c.id).toMatch(/^cand-stub-/);
    }
  });

  it("returns the stub when the API returns non-200", async () => {
    globalThis.fetch = (async () => new Response("error", { status: 500 })) as never;
    const got = await fetchCandidates();
    expect(got[0]?.source).toBe("stub");
  });

  it("parses live GDELT JSON into candidates when the API returns 200", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          status: "ok",
          clips: [
            {
              date: "20260615120000",
              network: "CBC",
              show: "The National",
              url: "https://archive.org/details/CBCNT_20260615",
              snippet: "Prime Minister Mark Carney spoke today about the trade deal.",
            },
            {
              date: "20260615140000",
              network: "CTV",
              show: "CTV News",
              url: "https://archive.org/details/CTVN_20260615",
              snippet: "Pierre Poilievre tabled a motion in the House.",
            },
          ],
        }),
        { status: 200 },
      )) as never;
    const got = await fetchCandidates();
    expect(got.length).toBe(2);
    expect(got[0]?.source).toBe("gdelt");
    expect(got[0]?.network).toBe("CBC");
    expect(got[0]?.captured_at).toMatch(/^2026-06-15T12:00:00Z$/);
    expect(got[1]?.entities.length).toBeGreaterThan(0);
  });

  it("falls back to the stub when the API returns an empty clip list", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: "ok", clips: [] }), { status: 200 })) as never;
    const got = await fetchCandidates();
    expect(got[0]?.source).toBe("stub");
  });
});
