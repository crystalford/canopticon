import { SegmentSchema } from "@canopticon/shared/video/segment-schema";
import { describe, expect, it } from "vitest";

// The "It Looks Like Teslas" worked example from the handoff §7,
// shaped into the v2.6 segment-JSON contract. This is the literal
// fixture seeded into D1 by 0002_phase0_spike_seed.sql and rendered by
// the Phase 0 ForensicSegment.tsx comp.
const carneySegment = {
  id: "phase0-carney-it-looks-like-teslas",
  title: "It Looks Like Teslas",
  template: "claim_vs_ground",
  length_s: 70,
  forensic_turn: {
    text: "Same government. Same weeks. One side says relax — probably Teslas. The other puts the surveillance risk in writing.",
    needs_human: false,
    approved_by: "phase0-fixture",
    approved_at: "2026-06-15T00:00:00Z",
  },
  beats: [
    {
      t_in_s: 0,
      t_out_s: 4,
      type: "cold_open",
      vo: null,
      clip: { src: "fixtures/carney-clip.mp4", in_s: 412, out_s: 416, audio: "surface" },
      chrome: [
        { kind: "lower_third", speaker: "Mark Carney", network: "CBC", timestamp_label: "June 1" },
      ],
      source: "CBC, Jun 1 2026",
    },
    {
      t_in_s: 4,
      t_out_s: 9,
      type: "thesis",
      vo: "The data doesn't say that. And his own government said something it would rather you didn't connect to it.",
      clip: null,
      chrome: [{ kind: "caption", text: "The data doesn't say that." }],
      source: null,
    },
    {
      t_in_s: 9,
      t_out_s: 22,
      type: "evidence",
      vo: "In May, 2,910 Chinese-built EVs landed in Canada — the first month of imports.",
      clip: null,
      chrome: [
        { kind: "data_callout", label: "FIRST MONTH", value: "2,910", units: "EVs · MAY 2026" },
        { kind: "callout", text: "models not identified", emphasis: "strong" },
      ],
      source: "Global Affairs Canada via CBC, Jun 1 2026",
    },
  ],
  music: { bed: "forensic_low", drop_at_s: 32 },
  voice: { provider: "fixture", voice_id: "fixtures/narrator.wav" },
  sources: ["CBC", "Global Affairs Canada", "Canadian Press"],
  variants: ["1080x1920"],
};

describe("SegmentSchema — the §7b contract", () => {
  it("accepts the Carney 'It Looks Like Teslas' fixture", () => {
    const result = SegmentSchema.safeParse(carneySegment);
    if (!result.success) {
      throw new Error(`schema rejected fixture: ${JSON.stringify(result.error.format(), null, 2)}`);
    }
    expect(result.data.id).toBe("phase0-carney-it-looks-like-teslas");
    expect(result.data.template).toBe("claim_vs_ground");
    expect(result.data.beats.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects a segment without a forensic_turn", () => {
    const bad = { ...carneySegment, forensic_turn: undefined };
    expect(SegmentSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown template kind", () => {
    const bad = { ...carneySegment, template: "explanatory_montage" };
    expect(SegmentSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a segment with fewer than 3 beats", () => {
    const bad = { ...carneySegment, beats: carneySegment.beats.slice(0, 2) };
    expect(SegmentSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts length_s within the raised 1200s (20 min) ceiling — the reading-sourced long-form path", () => {
    const ok = { ...carneySegment, length_s: 600 };
    expect(SegmentSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects length_s above the 1200s ceiling", () => {
    const bad = { ...carneySegment, length_s: 1201 };
    expect(SegmentSchema.safeParse(bad).success).toBe(false);
  });

  it("requires every voice provider to be one of the three locked options", () => {
    const ok = ["minimax", "elevenlabs", "fixture"];
    for (const provider of ok) {
      const candidate = { ...carneySegment, voice: { provider, voice_id: "x" } };
      expect(SegmentSchema.safeParse(candidate).success).toBe(true);
    }
    const bad = { ...carneySegment, voice: { provider: "openai", voice_id: "x" } };
    expect(SegmentSchema.safeParse(bad).success).toBe(false);
  });
});
