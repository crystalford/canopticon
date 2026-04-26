import { describe, expect, it } from "vitest";
import { renderTemplate } from "../src/orchestrator/template.ts";

describe("renderTemplate", () => {
  it("substitutes top-level placeholders", () => {
    const out = renderTemplate("Hello {{name}}!", { name: "Alice" });
    expect(out).toBe("Hello Alice!");
  });

  it("supports dotted paths", () => {
    const out = renderTemplate("source: {{source.title}}", {
      source: { title: "Hansard fragment" },
    });
    expect(out).toBe("source: Hansard fragment");
  });

  it("renders missing keys as empty strings (not 'undefined')", () => {
    const out = renderTemplate("warrant: {{claim.warrant}}", { claim: {} });
    expect(out).toBe("warrant: ");
  });

  it("stringifies numbers and booleans", () => {
    const out = renderTemplate("eig={{q.eig}} pinned={{q.pinned}}", {
      q: { eig: 0.7, pinned: true },
    });
    expect(out).toBe("eig=0.7 pinned=true");
  });

  it("JSON-stringifies arrays and objects", () => {
    const out = renderTemplate("targets: {{targets}}", {
      targets: ["SEDAR+", "Hansard"],
    });
    expect(out).toContain('"SEDAR+"');
    expect(out).toContain('"Hansard"');
  });

  it("handles whitespace inside placeholder braces", () => {
    const out = renderTemplate("{{  name  }}", { name: "ok" });
    expect(out).toBe("ok");
  });

  it("does not substitute placeholders with disallowed characters", () => {
    const out = renderTemplate("{{a-b}} stays literal", { "a-b": "x" });
    expect(out).toBe("{{a-b}} stays literal");
  });
});
