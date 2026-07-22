import { describe, expect, it } from "vitest";
import { putSnapshot, sha256Hex, snapshotKey } from "../src/data/snapshots.ts";

// A minimal in-memory env: change_detection state + a record of R2 puts.
function mockEnv() {
  const sigs = new Map<string, string>();
  const puts: string[] = [];
  const env = {
    ASSETS: {
      put: async (key: string) => {
        puts.push(key);
      },
    },
    DB: {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            return {
              first: async () => {
                if (sql.includes("SELECT last_signature")) {
                  const sig = sigs.get(args[0] as string);
                  return sig ? { last_signature: sig } : null;
                }
                return null;
              },
              run: async () => {
                if (sql.includes("INSERT INTO change_detection")) {
                  sigs.set(args[0] as string, args[1] as string);
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
  return { env, puts };
}

describe("snapshots — content-hash provenance", () => {
  it("hashes deterministically; different bytes → different hash", async () => {
    const a = await sha256Hex("hello");
    const b = await sha256Hex("hello");
    const c = await sha256Hex("world");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("keys a snapshot under snapshots/<source>/<sha16>.json", async () => {
    const sha = await sha256Hex("x");
    expect(snapshotKey("sfs", sha)).toBe(`snapshots/sfs/${sha.slice(0, 16)}.json`);
  });

  it("stores new content and dedups an unchanged pull", async () => {
    const { env, puts } = mockEnv();
    // biome-ignore lint/suspicious/noExplicitAny: minimal test double
    const e = env as any;

    const first = await putSnapshot(e, "sfs", "payload-v1", "application/json");
    expect(first.isNew).toBe(true);
    expect(puts).toHaveLength(1);

    const same = await putSnapshot(e, "sfs", "payload-v1", "application/json");
    expect(same.isNew).toBe(false);
    expect(same.key).toBe(first.key);
    expect(puts).toHaveLength(1); // no second write

    const changed = await putSnapshot(e, "sfs", "payload-v2", "application/json");
    expect(changed.isNew).toBe(true);
    expect(puts).toHaveLength(2);
  });
});
