import { describe, expect, it } from "vitest";
import { type ReadingInput, draftSegmentFromReading } from "../src/editorial/reading-brain.ts";

const CARNEY_READING: ReadingInput = {
  subjectSlug: "mark-carney",
  subjectLabel: "Mark Carney",
  thesis: "Carney's early cabinet choices reveal continuity, not the reset he campaigned on.",
  facts: [
    {
      text: "Carney served as Governor of the Bank of England",
      quote: "Governor from 2013 to 2020",
      source: "research-brief",
    },
    {
      text: "Carney named Anita Anand as foreign minister",
      quote: "Anand assumes the foreign affairs portfolio",
      source: "research-brief",
    },
    { text: "Carney served as Governor of the Bank of Canada", quote: null, source: "wikipedia" },
  ],
};

describe("draftSegmentFromReading — reading-sourced editorial brain", () => {
  it("rejects a reading with no established facts", async () => {
    const r = await draftSegmentFromReading({} as never, { ...CARNEY_READING, facts: [] }, "short");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("no established facts");
  });

  it("falls back to the deterministic skeleton when AI binding is absent — short form", async () => {
    const r = await draftSegmentFromReading({} as never, CARNEY_READING, "short");
    expect(r.ok).toBe(true);
    expect(r.used_llm).toBe(false);
    expect(r.segment?.id).toMatch(/^seg-reading-mark-carney-short-/);
    expect(r.segment?.variants).toEqual(["1080x1920"]);
    expect(r.segment?.forensic_turn.needs_human).toBe(true);
    expect(r.segment?.forensic_turn.text).toContain("[OPERATOR:");
    // Every beat's clip must be null — no broadcast footage for a
    // reading-sourced essay, only narration + chrome.
    expect(r.segment?.beats.every((b) => b.clip === null)).toBe(true);
    expect(r.segment?.length_s).toBeLessThanOrEqual(75);
  });

  it("falls back to the deterministic skeleton — long form covers every supplied fact", async () => {
    const r = await draftSegmentFromReading({} as never, CARNEY_READING, "long");
    expect(r.ok).toBe(true);
    expect(r.segment?.id).toMatch(/^seg-reading-mark-carney-long-/);
    expect(r.segment?.variants).toEqual(["1920x1080"]);
    const evidenceBeats = r.segment?.beats.filter((b) => b.type === "evidence") ?? [];
    expect(evidenceBeats.length).toBe(CARNEY_READING.facts.length);
  });

  it("uses the LLM when the AI binding returns valid JSON, and forces the reading- id + needs_human regardless", async () => {
    const r = await draftSegmentFromReading(
      {
        AI: {
          async run() {
            return {
              response: JSON.stringify({
                id: "whatever-the-model-felt-like",
                title: "LLM Drafted Essay",
                template: "claim_vs_ground",
                length_s: 60,
                forensic_turn: { text: "The LLM's turn.", needs_human: false },
                beats: [
                  {
                    t_in_s: 0,
                    t_out_s: 4,
                    type: "cold_open",
                    vo: null,
                    clip: null,
                    chrome: [],
                    source: null,
                  },
                  {
                    t_in_s: 4,
                    t_out_s: 20,
                    type: "thesis",
                    vo: "Thesis.",
                    clip: null,
                    chrome: [],
                    source: null,
                  },
                  {
                    t_in_s: 20,
                    t_out_s: 60,
                    type: "tag",
                    vo: null,
                    clip: null,
                    chrome: [],
                    source: null,
                  },
                ],
                music: { bed: "forensic_low", drop_at_s: 30 },
                voice: { provider: "minimax", voice_id: "operator-clone" },
                sources: ["research-brief"],
                variants: ["1080x1920"],
              }),
            };
          },
        } as never,
      } as never,
      CARNEY_READING,
      "short",
    );
    expect(r.ok).toBe(true);
    expect(r.used_llm).toBe(true);
    expect(r.segment?.title).toBe("LLM Drafted Essay");
    // The id must be forced to the deterministic "reading-" pattern —
    // never trust the LLM's freely-chosen id, since queue.ts's
    // synthetic-candidate routing depends on this prefix.
    expect(r.segment?.id).toMatch(/^seg-reading-mark-carney-short-/);
    expect(r.segment?.forensic_turn.needs_human).toBe(true);
  });

  it("falls back to the skeleton when the LLM returns malformed JSON", async () => {
    const r = await draftSegmentFromReading(
      {
        AI: {
          async run() {
            return { response: "not json at all" };
          },
        } as never,
      } as never,
      CARNEY_READING,
      "short",
    );
    expect(r.ok).toBe(true);
    expect(r.used_llm).toBe(false);
    expect(r.segment?.forensic_turn.text).toContain("[OPERATOR:");
  });
});
