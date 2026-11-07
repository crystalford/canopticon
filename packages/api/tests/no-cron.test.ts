// Rule 4: nothing runs unattended. A deployed schedule survived its
// commented-out config, so the handler refuses unless switched on.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import worker from "../src/index";

describe("the scheduled handler", () => {
  it("does nothing unless CRON_ENABLED is 1", async () => {
    const touched: string[] = [];
    const env = new Proxy(
      {},
      {
        get: (_t, key) => {
          if (key === "CRON_ENABLED") return undefined;
          touched.push(String(key));
          return undefined;
        },
      },
    );
    const waits: unknown[] = [];
    await worker.scheduled(
      { cron: "*/2 * * * *", scheduledTime: Date.now(), noRetry() {} } as never,
      env as never,
      { waitUntil: (p: unknown) => waits.push(p), passThroughOnException() {} } as never,
    );
    expect(touched).toEqual([]);
    expect(waits).toEqual([]);
  });

  it("is removed from the deployed Worker by an explicit empty list", () => {
    const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
    expect(toml).toMatch(/^\[triggers\]\ncrons = \[\]$/m);
  });
});
