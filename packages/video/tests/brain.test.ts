import { describe, expect, it } from "vitest";
import { draftSegment } from "../src/editorial/brain.ts";
import type { CandidateRow } from "../src/sourcing/candidates.ts";

const CARNEY: CandidateRow = {
  id: "cand-test-carney",
  network: "CBC",
  clip_url: "https://example.com/cbc/carney",
  captured_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
  headline: "Carney says auto deal looks like Teslas",
  excerpt:
    "Prime Minister Mark Carney said most of the vehicles arriving will look like Teslas, even as the data declined to confirm brand identification.",
  entities: ["Mark Carney", "Tesla", "Canada"],
  source: "gdelt",
  rubric_score: 24,
  rubric_json: JSON.stringify({
    forensic_potential: 4,
    visual_evidence: 4,
    recency: 5,
    canadian_lane: 4,
    counter_voice: 4,
    legibility: 3,
  }),
  cast_template: "claim_vs_ground",
  status: "cast",
  created_at: new Date().toISOString(),
};

describe("draftSegment — editorial brain", () => {
  it("rejects a candidate without a cast_template", async () => {
    const noCast: CandidateRow = { ...CARNEY, cast_template: null };
    const r = await draftSegment({} as never, noCast);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("cast_template");
  });

  it("falls back to the deterministic skeleton when AI binding is absent", async () => {
    const r = await draftSegment({} as never, CARNEY);
    expect(r.ok).toBe(true);
    expect(r.used_llm).toBe(false);
    expect(r.segment?.template).toBe("claim_vs_ground");
    expect(r.segment?.forensic_turn.needs_human).toBe(true);
    // The skeleton always includes the OPERATOR marker in the forensic_turn
    // so the review surface knows the LLM didn't run.
    expect(r.segment?.forensic_turn.text).toContain("[OPERATOR:");
    expect(r.segment?.beats.length).toBeGreaterThanOrEqual(3);
  });

  it("uses the LLM when the AI binding returns valid JSON", async () => {
    const r = await draftSegment(
      {
        AI: {
          async run() {
            return {
              response: JSON.stringify({
                id: "seg-llm-test",
                title: "LLM Drafted",
                template: "claim_vs_ground",
                length_s: 60,
                forensic_turn: {
                  text: "The LLM wrote this turn.",
                  needs_human: false, // The brain should force this back to true.
                },
                beats: [
                  {
                    t_in_s: 0,
                    t_out_s: 4,
                    type: "cold_open",
                    vo: null,
                    clip: null,
                    chrome: [],
                    source: "CBC",
                  },
                  {
                    t_in_s: 4,
                    t_out_s: 9,
                    type: "thesis",
                    vo: "The thesis.",
                    clip: null,
                    chrome: [],
                    source: null,
                  },
                  {
                    t_in_s: 9,
                    t_out_s: 60,
                    type: "tag",
                    vo: null,
                    clip: null,
                    chrome: [],
                    source: null,
                  },
                ],
                music: { bed: "forensic_low", drop_at_s: 32 },
                voice: { provider: "minimax", voice_id: "operator-clone" },
                sources: ["CBC"],
                variants: ["1080x1920"],
              }),
            };
          },
        } as never,
      } as never,
      CARNEY,
    );
    expect(r.ok).toBe(true);
    expect(r.used_llm).toBe(true);
    expect(r.segment?.title).toBe("LLM Drafted");
    expect(r.segment?.forensic_turn.text).toBe("The LLM wrote this turn.");
    // The brain MUST force needs_human back to true — the review gate
    // is mandatory regardless of what the LLM emitted.
    expect(r.segment?.forensic_turn.needs_human).toBe(true);
  });

  it("falls back to the skeleton when the LLM returns malformed JSON", async () => {
    const r = await draftSegment(
      {
        AI: {
          async run() {
            return { response: "not json at all" };
          },
        } as never,
      } as never,
      CARNEY,
    );
    expect(r.ok).toBe(true);
    expect(r.used_llm).toBe(false);
    expect(r.segment?.forensic_turn.text).toContain("[OPERATOR:");
  });
});
