import { describe, expect, it } from "vitest";
import { castTemplate, scoreCandidate } from "../src/editorial/rubric.ts";
import type { Candidate } from "../src/sourcing/gdelt.ts";

// Build a fresh-ish stub candidate. AI binding omitted → falls through
// to the deterministic heuristic scorer.
function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "cand-test",
    network: "CBC",
    clip_url: "https://example.com/clip",
    captured_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    headline: "Carney says auto deal looks like Teslas",
    excerpt:
      "Prime Minister Mark Carney said most of the vehicles arriving will look like Teslas, even as the data declined to confirm brand identification.",
    entities: ["Mark Carney", "Tesla", "Canada"],
    source: "stub",
    ...overrides,
  };
}

describe("scoreCandidate — heuristic fallback when AI binding is absent", () => {
  it("scores all six axes between 0 and 5", async () => {
    const r = await scoreCandidate({} as never, makeCandidate());
    for (const v of Object.values(r.scores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it("favours recency — a fresh candidate scores higher than an old one", async () => {
    const fresh = await scoreCandidate({} as never, makeCandidate());
    const stale = await scoreCandidate(
      {} as never,
      makeCandidate({ captured_at: new Date(Date.now() - 96 * 3600_000).toISOString() }),
    );
    expect(fresh.scores.recency).toBeGreaterThan(stale.scores.recency);
  });

  it("detects a claim_vs_evidence gap from hedging language", async () => {
    const r = await scoreCandidate({} as never, makeCandidate());
    expect(r.gap_kind).toBe("claim_vs_evidence");
  });

  it("detects a buried_number gap from numeric headlines", async () => {
    const r = await scoreCandidate(
      {} as never,
      makeCandidate({
        headline: "Budget update reveals 47 billion deficit",
        excerpt: "The fiscal projection now shows 47 billion in shortfall.",
      }),
    );
    expect(r.gap_kind).toBe("buried_number");
  });

  it("rejects a candidate whose forensic_potential scores 0", async () => {
    // Empty excerpt → no hedges → forensic_potential = 1, not 0.
    // To force 0, override visual_evidence indirectly via source: "gdelt"
    // doesn't help. The heuristic always gives ≥1 to forensic_potential,
    // so this test verifies the gate works WHEN it would trigger.
    const r = await scoreCandidate({} as never, makeCandidate());
    // Manually inject 0 to test the gate (the heuristic won't produce
    // it, but the finalise() function must catch it if it ever does).
    const forced = await scoreCandidate(
      {
        AI: {
          async run() {
            return {
              response: JSON.stringify({
                forensic_potential: 0,
                visual_evidence: 5,
                recency: 5,
                canadian_lane: 5,
                counter_voice: 5,
                legibility: 5,
                gap_kind: "claim_vs_evidence",
              }),
            };
          },
        } as never,
      } as never,
      makeCandidate(),
    );
    expect(forced.rejected_reason).toBe("no forensic gap");
    expect(r.rejected_reason).toBeNull();
  });
});

describe("castTemplate — gap kind → §7b template name", () => {
  it("maps claim_vs_evidence → claim_vs_ground", () => {
    expect(castTemplate("claim_vs_evidence")).toBe("claim_vs_ground");
  });
  it("maps buried_number → buried_number", () => {
    expect(castTemplate("buried_number")).toBe("buried_number");
  });
  it("maps reversal → reversal", () => {
    expect(castTemplate("reversal")).toBe("reversal");
  });
  it("returns null for an unmappable gap", () => {
    expect(castTemplate(null)).toBeNull();
  });
});
