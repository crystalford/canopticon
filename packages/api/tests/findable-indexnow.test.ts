// lib/indexnow.ts — one POST per publish. Nothing here touches the network:
// the fetch is a stub, and the inert path is the one that matters most,
// because an unconfigured deploy must send nothing and say why.

import { describe, expect, it, vi } from "vitest";
import { INDEXNOW_ENDPOINT, indexNowBody, indexNowKey, pingIndexNow } from "../src/lib/indexnow";

describe("indexnow", () => {
  it("builds the protocol body with absolute urls and the key location", () => {
    const body = indexNowBody("abcdef1234567890", [
      "/p/rent-report-2026",
      "https://canopticon.com/research",
      "/p/rent-report-2026",
      "https://elsewhere.example/x",
    ]);
    expect(body).toEqual({
      host: "canopticon.com",
      key: "abcdef1234567890",
      keyLocation: "https://canopticon.com/abcdef1234567890.txt",
      urlList: ["https://canopticon.com/p/rent-report-2026", "https://canopticon.com/research"],
    });
  });

  it("is inert without a key: nothing sent, reason stated", async () => {
    const fetchImpl = vi.fn();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await pingIndexNow({}, ["/p/x"], fetchImpl as unknown as typeof fetch);
    expect(res).toEqual({ sent: false, reason: "INDEXNOW_KEY not set" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("INDEXNOW_KEY not set"));
    log.mockRestore();
    expect(indexNowKey({ INDEXNOW_KEY: "short" })).toBeNull();
    expect(indexNowKey(undefined)).toBeNull();
  });

  it("POSTs JSON to the IndexNow endpoint when configured, and never throws", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 202 }));
    const res = await pingIndexNow(
      { INDEXNOW_KEY: "abcdef1234567890" },
      ["/p/x"],
      fetchImpl as unknown as typeof fetch,
    );
    expect(res).toEqual({ sent: true, status: 202, urls: ["https://canopticon.com/p/x"] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).urlList).toEqual(["https://canopticon.com/p/x"]);

    const failing = vi.fn(async () => {
      throw new Error("network down");
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const bad = await pingIndexNow(
      { INDEXNOW_KEY: "abcdef1234567890" },
      ["/p/x"],
      failing as unknown as typeof fetch,
    );
    log.mockRestore();
    expect(bad).toEqual({ sent: false, reason: "network down" });
  });
});
