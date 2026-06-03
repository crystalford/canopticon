import { describe, expect, it } from "vitest";
import {
  collapseByChain,
  dateRangeLabel,
  distinctivenessBlurb,
  filterEvidenceBearing,
  recurringActorLabel,
} from "../src/graph/lib/lighthouse.ts";

describe("lighthouse — chain-collapse counting", () => {
  it("counts standalone pieces as one each", () => {
    const r = collapseByChain([
      { id: "a", chain_id: null },
      { id: "b", chain_id: null },
      { id: "c" },
    ]);
    expect(r.investigations).toBe(3);
    expect(r.documents).toBe(3);
    expect(r.chains).toBe(0);
  });

  it("collapses a multi-pass chain to one investigation", () => {
    const r = collapseByChain([
      { id: "a", chain_id: "polling-industry" },
      { id: "b", chain_id: "polling-industry" },
      { id: "c", chain_id: "polling-industry" },
      { id: "d", chain_id: "polling-industry" },
      { id: "e", chain_id: "polling-industry" },
    ]);
    expect(r.investigations).toBe(1);
    expect(r.documents).toBe(5);
    expect(r.chains).toBe(1);
  });

  it("mixes standalone + chained correctly", () => {
    const r = collapseByChain([
      { id: "a", chain_id: "polling-industry" },
      { id: "b", chain_id: "polling-industry" },
      { id: "c", chain_id: "financial-network" },
      { id: "d", chain_id: "financial-network" },
      { id: "e", chain_id: "financial-network" },
      { id: "f" },
      { id: "g", chain_id: null },
    ]);
    expect(r.investigations).toBe(4); // 2 chains + 2 standalone
    expect(r.documents).toBe(7);
    expect(r.chains).toBe(2);
  });
});

describe("lighthouse — evidence-bearing filter", () => {
  it("keeps research-reports, documented-records, syntheses", () => {
    const out = filterEvidenceBearing([
      { kind: "research-report" },
      { kind: "essay" },
      { kind: "documented-record" },
      { kind: "thesis" },
      { kind: "synthesis" },
      { kind: "brief" },
    ]);
    expect(out.map((p) => p.kind)).toEqual(["research-report", "documented-record", "synthesis"]);
  });
});

describe("lighthouse — honest label", () => {
  it("leads with investigation count, demotes documents", () => {
    const label = recurringActorLabel({
      investigations: 9,
      documents: 34,
      chains: 2,
    });
    expect(label).toMatch(/^appears in 9 investigations/);
    expect(label).toContain("34 documents");
    expect(label).toContain("2 chains");
  });

  it("omits document parenthetical when count matches", () => {
    const label = recurringActorLabel({
      investigations: 4,
      documents: 4,
      chains: 0,
    });
    expect(label).toBe("appears in 4 investigations");
  });

  it("adds date range when present", () => {
    const label = recurringActorLabel(
      { investigations: 2, documents: 2, chains: 0 },
      { from: "2025-01-01", to: "2026-04-12" },
    );
    expect(label).toContain("2025-01 to 2026-04");
  });
});

describe("lighthouse — distinctiveness", () => {
  it("flags heavy clustering", () => {
    expect(distinctivenessBlurb(40, 65)).toMatch(/heavily clustered/i);
  });
  it("flags notable presence", () => {
    expect(distinctivenessBlurb(20, 65)).toMatch(/notably/i);
  });
  it("stays quiet when rare", () => {
    expect(distinctivenessBlurb(2, 65)).toBe("");
  });
});

describe("lighthouse — date range label", () => {
  it("collapses same-month ranges to one", () => {
    expect(dateRangeLabel("2026-04-01", "2026-04-30")).toBe("2026-04");
  });
  it("formats spans", () => {
    expect(dateRangeLabel("2025-09-22", "2026-04-12")).toBe("2025-09 to 2026-04");
  });
  it("returns empty when both null", () => {
    expect(dateRangeLabel(null, null)).toBe("");
  });
});
