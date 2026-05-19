import { describe, expect, it } from "vitest";
import { dedupeToolUses, toolUseHash } from "../src/llm/workers_ai.ts";

describe("toolUseHash", () => {
  it("hashes name + input deterministically", () => {
    const a = toolUseHash("draft_post", { title: "X", body_md: "y" });
    const b = toolUseHash("draft_post", { title: "X", body_md: "y" });
    expect(a).toBe(b);
  });

  it("is order-independent on keys", () => {
    const a = toolUseHash("draft_post", { title: "X", body_md: "y" });
    const b = toolUseHash("draft_post", { body_md: "y", title: "X" });
    expect(a).toBe(b);
  });

  it("differs when inputs differ", () => {
    const a = toolUseHash("draft_post", { title: "X" });
    const b = toolUseHash("draft_post", { title: "Y" });
    expect(a).not.toBe(b);
  });

  it("differs when names differ", () => {
    const a = toolUseHash("draft_post", { x: 1 });
    const b = toolUseHash("update_post", { x: 1 });
    expect(a).not.toBe(b);
  });

  it("handles nested objects deterministically", () => {
    const a = toolUseHash("t", { meta: { a: 1, b: 2 } });
    const b = toolUseHash("t", { meta: { b: 2, a: 1 } });
    expect(a).toBe(b);
  });
});

describe("dedupeToolUses", () => {
  it("returns an empty array unchanged", () => {
    expect(dedupeToolUses([])).toEqual([]);
  });

  it("keeps a single non-duplicate", () => {
    const calls = [{ id: "1", name: "draft_post", input: { title: "X" } }];
    expect(dedupeToolUses(calls)).toHaveLength(1);
  });

  it("folds identical-input duplicates to one (the screenshot case)", () => {
    const calls = [
      { id: "1", name: "draft_post", input: { title: "X", body_md: "y" } },
      { id: "2", name: "draft_post", input: { title: "X", body_md: "y" } },
      { id: "3", name: "draft_post", input: { title: "X", body_md: "y" } },
      { id: "4", name: "draft_post", input: { title: "X", body_md: "y" } },
      { id: "5", name: "draft_post", input: { title: "X", body_md: "y" } },
      { id: "6", name: "draft_post", input: { title: "X", body_md: "y" } },
      { id: "7", name: "draft_post", input: { title: "X", body_md: "y" } },
    ];
    const out = dedupeToolUses(calls);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("1");
  });

  it("keeps calls with the same name but different input", () => {
    const calls = [
      { id: "1", name: "draft_post", input: { title: "X" } },
      { id: "2", name: "draft_post", input: { title: "Y" } },
    ];
    expect(dedupeToolUses(calls)).toHaveLength(2);
  });

  it("keeps calls with different names even if input matches", () => {
    const calls = [
      { id: "1", name: "draft_post", input: { title: "X" } },
      { id: "2", name: "update_post", input: { title: "X" } },
    ];
    expect(dedupeToolUses(calls)).toHaveLength(2);
  });

  it("preserves the first occurrence's id", () => {
    const calls = [
      { id: "first", name: "t", input: { k: 1 } },
      { id: "second", name: "t", input: { k: 1 } },
    ];
    expect(dedupeToolUses(calls)[0]?.id).toBe("first");
  });

  it("ignores key order in the input", () => {
    const calls = [
      { id: "1", name: "t", input: { a: 1, b: 2 } },
      { id: "2", name: "t", input: { b: 2, a: 1 } },
    ];
    expect(dedupeToolUses(calls)).toHaveLength(1);
  });
});
