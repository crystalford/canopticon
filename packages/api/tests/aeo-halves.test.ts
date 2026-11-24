// The findings step reads a document in chunks; a chunk whose model call
// runs past the ceiling is read again as two halves, and a half that still
// times out is skipped and counted rather than failing the document.

import { describe, expect, it } from "vitest";
import { readInHalves } from "../src/graph/lib/aeo-extract";

const para = (n: number) =>
  Array.from({ length: n }, (_, i) => `Paragraph ${i} ${"x".repeat(900)}`).join("\n\n");
const timeout = new Error("workers_ai.run[m] exceeded 25000ms");

describe("readInHalves", () => {
  it("reads a fast chunk whole", async () => {
    const r = await readInHalves(["short text"], async (t) => t.length);
    expect(r).toEqual({ units: [{ chunk: "short text", parsed: 10 }], skipped: 0 });
  });

  it("reads a slow chunk as two halves", async () => {
    const big = para(20);
    const keys: string[] = [];
    const r = await readInHalves([big], async (t, k) => {
      keys.push(k);
      if (t === big) throw timeout;
      return t.length;
    });
    expect(keys[0]).toBe("0");
    expect(keys.slice(1, 3)).toEqual(["0.0", "0.1"]);
    // Split at paragraph boundaries with a short overlap: two parts, at most three.
    expect(r.units.length).toBeGreaterThanOrEqual(2);
    expect(r.units.length).toBeLessThanOrEqual(3);
    for (const u of r.units) expect(u.chunk.length).toBeLessThan(big.length);
    expect(r.skipped).toBe(0);
  });

  it("skips a half that is still too slow, and keeps the rest", async () => {
    const big = para(20);
    const r = await readInHalves([big, "fine"], async (t, k) => {
      if (t === big || k === "0.1") throw timeout;
      return k;
    });
    const read = r.units.map((u) => u.parsed);
    expect(read).toContain("0.0");
    expect(read).toContain("1");
    expect(read).not.toContain("0.1");
    expect(r.skipped).toBe(1);
  });

  it("fails only when nothing could be read, and never hides other errors", async () => {
    await expect(readInHalves([para(20)], async () => Promise.reject(timeout))).rejects.toThrow(
      "exceeded 25000ms",
    );
    await expect(
      readInHalves(["a"], async () => Promise.reject(new Error("bad JSON"))),
    ).rejects.toThrow("bad JSON");
  });
});
