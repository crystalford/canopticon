import { describe, expect, it } from "vitest";
import { SSE_HEADERS, formatSseComment, formatSseEvent } from "../src/lib/sse.ts";

describe("formatSseEvent", () => {
  it("includes id, event, and data lines in SSE wire format", () => {
    const out = formatSseEvent({
      id: "00000000-0000-0000-0000-000000000001",
      event: "research.started",
      data: { topic: "test" },
    });
    expect(out).toContain("id: 00000000-0000-0000-0000-000000000001\n");
    expect(out).toContain("event: research.started\n");
    expect(out).toContain('data: {"topic":"test"}\n');
    expect(out.endsWith("\n\n")).toBe(true);
  });

  it("JSON-encodes complex payloads", () => {
    const out = formatSseEvent({
      id: "x",
      event: "research.iteration_completed",
      data: {
        iteration: 3,
        tool_count: 2,
        nested: { a: [1, 2, 3] },
      },
    });
    expect(out).toContain('data: {"iteration":3,"tool_count":2,"nested":{"a":[1,2,3]}}\n');
  });

  it("handles empty data", () => {
    const out = formatSseEvent({ id: "x", event: "ping", data: {} });
    expect(out).toContain("data: {}\n");
  });
});

describe("formatSseComment", () => {
  it("starts with ': ' and ends with double newline", () => {
    const out = formatSseComment("keepalive");
    expect(out).toBe(": keepalive\n\n");
  });
});

describe("SSE_HEADERS", () => {
  it("specifies text/event-stream content type", () => {
    expect(SSE_HEADERS).toMatchObject({
      "content-type": expect.stringContaining("text/event-stream"),
      "cache-control": expect.stringContaining("no-cache"),
    });
  });

  it("disables proxy buffering with x-accel-buffering: no", () => {
    expect(SSE_HEADERS).toMatchObject({ "x-accel-buffering": "no" });
  });
});
