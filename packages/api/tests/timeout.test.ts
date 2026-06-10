import { describe, expect, it } from "vitest";
import { TIMEOUTS, fetchWithTimeout, withTimeout } from "../src/lib/timeout.ts";

describe("withTimeout", () => {
  it("resolves with the inner value when it beats the deadline", async () => {
    const v = await withTimeout(Promise.resolve(42), 100, "ok");
    expect(v).toBe(42);
  });

  it("rejects with a labeled error when the inner promise never resolves", async () => {
    const hang = new Promise<number>(() => {});
    await expect(withTimeout(hang, 25, "hang")).rejects.toThrow(/hang exceeded 25ms/);
  });

  it("propagates inner rejection unchanged when it lands first", async () => {
    await expect(withTimeout(Promise.reject(new Error("real cause")), 50, "x")).rejects.toThrow(
      /real cause/,
    );
  });
});

describe("fetchWithTimeout", () => {
  it("aborts the underlying request when the deadline is exceeded", async () => {
    // Mock global fetch with a never-resolving promise that respects AbortSignal.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    }) as typeof fetch;
    try {
      await expect(fetchWithTimeout("https://example.com", {}, 20, "test")).rejects.toThrow(
        /aborted|exceeded/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("TIMEOUTS", () => {
  it("LLM ceiling is shorter than the Worker waitUntil wall-clock (~30s)", () => {
    expect(TIMEOUTS.LLM_CALL_MS).toBeLessThan(30_000);
  });
});
