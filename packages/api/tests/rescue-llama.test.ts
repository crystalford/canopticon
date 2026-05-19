import { describe, expect, it } from "vitest";
import { rescueLlamaToolCall, rescueLlamaToolCalls } from "../src/llm/workers_ai.ts";

describe("rescueLlamaToolCalls", () => {
  it("returns empty for plain prose", () => {
    const r = rescueLlamaToolCalls("hello world, here is a thought.");
    expect(r.calls).toHaveLength(0);
    expect(r.remainder).toBe("hello world, here is a thought.");
  });

  it("parses a single function-shaped JSON tool call", () => {
    const text =
      '{"type":"function","name":"draft_post","parameters":{"title":"X","body_md":"hi"}}';
    const r = rescueLlamaToolCalls(text);
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]).toEqual({
      name: "draft_post",
      input: { title: "X", body_md: "hi" },
    });
    expect(r.remainder).toBe("");
  });

  it("parses a {name, parameters} tool call", () => {
    const text = '{"name":"search_substrate","parameters":{"q":"climate"}}';
    const r = rescueLlamaToolCalls(text);
    expect(r.calls[0]?.name).toBe("search_substrate");
    expect(r.calls[0]?.input).toEqual({ q: "climate" });
  });

  it("pulls both calls from concatenated JSON objects", () => {
    // The actual screenshot case: model emits two function-shape JSON
    // objects back to back with no separator.
    const text =
      '{"type":"function","name":"update_post","parameters":{"post_id":"abc","title":"T"}}' +
      '{"type":"function","name":"draft_post","parameters":{"title":"T2","body_md":"body"}}';
    const r = rescueLlamaToolCalls(text);
    expect(r.calls).toHaveLength(2);
    expect(r.calls[0]?.name).toBe("update_post");
    expect(r.calls[1]?.name).toBe("draft_post");
    expect(r.remainder).toBe("");
  });

  it("handles python_tag format", () => {
    const text = '<|python_tag|>fetch_url.call({"url":"https://x.com"})';
    const r = rescueLlamaToolCalls(text);
    expect(r.calls[0]?.name).toBe("fetch_url");
    expect(r.calls[0]?.input).toEqual({ url: "https://x.com" });
  });

  it("handles <function=...> format", () => {
    const text = '<function=list_drafts>{"limit":10}</function>';
    const r = rescueLlamaToolCalls(text);
    expect(r.calls[0]?.name).toBe("list_drafts");
    expect(r.calls[0]?.input).toEqual({ limit: 10 });
  });

  it("repairs malformed JSON values", () => {
    const text = '{"name":"note_finding","parameters":{"summary":"ok","kind":}}';
    const r = rescueLlamaToolCalls(text);
    expect(r.calls[0]?.name).toBe("note_finding");
  });

  it("leaves non-tool-call JSON alone", () => {
    const text = '{"hello":"world"}';
    const r = rescueLlamaToolCalls(text);
    expect(r.calls).toHaveLength(0);
    expect(r.remainder).toBe(text);
  });

  it("keeps surrounding prose when one tool call is mixed in", () => {
    const text =
      'Alright, let me draft that.\n{"type":"function","name":"draft_post","parameters":{"title":"X","body_md":"y"}}\nDone.';
    const r = rescueLlamaToolCalls(text);
    expect(r.calls).toHaveLength(1);
    expect(r.remainder).toContain("Alright, let me draft that.");
    expect(r.remainder).toContain("Done.");
    expect(r.remainder).not.toContain('"type":"function"');
  });

  it("back-compat rescueLlamaToolCall returns first match", () => {
    const text =
      '{"type":"function","name":"a","parameters":{}}{"type":"function","name":"b","parameters":{}}';
    const r = rescueLlamaToolCall(text);
    expect(r?.name).toBe("a");
  });
});
