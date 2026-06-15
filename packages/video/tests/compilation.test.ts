import { SegmentSchema } from "@canopticon/shared/video/segment-schema";
import { describe, expect, it } from "vitest";
import { buildDailyBrief } from "../src/editorial/compilation.ts";
import type { CandidateRow } from "../src/sourcing/candidates.ts";

function cand(idSuffix: string, headline: string, network: string): CandidateRow {
  return {
    id: `cand-${idSuffix}`,
    network,
    clip_url: `https://example.com/${idSuffix}`,
    captured_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    headline,
    excerpt: `Excerpt for ${headline}.`,
    entities: [headline.split(" ")[0] ?? "X"],
    source: "gdelt",
    rubric_score: 24,
    rubric_json: null,
    cast_template: "claim_vs_ground",
    status: "cast",
    created_at: new Date().toISOString(),
  };
}

describe("buildDailyBrief — compilation segment", () => {
  it("rejects when fewer than 2 cast candidates are supplied", () => {
    expect(() => buildDailyBrief([cand("a", "Story A", "CBC")])).toThrow(/at least 2/);
  });

  it("emits a valid §7b segment from 3 candidates", () => {
    const seg = buildDailyBrief(
      [
        cand("a", "Carney auto strategy hedge", "CBC"),
        cand("b", "Poilievre housing motion", "CTV"),
        cand("c", "Freeland budget defence", "GLOBAL"),
      ],
      { date: "2026-06-15" },
    );
    const parsed = SegmentSchema.safeParse(seg);
    expect(parsed.success).toBe(true);
    expect(seg.template).toBe("daily_brief");
    expect(seg.id).toBe("seg-brief-2026-06-15");
    // Intro + 4 beats per story + outro = 4*3 + 2 = 14 beats
    expect(seg.beats.length).toBe(14);
    expect(seg.forensic_turn.needs_human).toBe(true);
  });

  it("scales length with story count: 4 + 18*N + 4", () => {
    const three = buildDailyBrief(
      [
        cand("a", "Story A first", "CBC"),
        cand("b", "Story B middle", "CTV"),
        cand("c", "Story C third", "GLOBAL"),
      ],
      { date: "2026-06-15" },
    );
    expect(three.length_s).toBe(4 + 18 * 3 + 4); // 62
    const five = buildDailyBrief(
      [
        cand("a", "A", "CBC"),
        cand("b", "B", "CTV"),
        cand("c", "C", "GLOBAL"),
        cand("d", "D", "BLOOMBERG"),
        cand("e", "E", "BNN"),
      ],
      { date: "2026-06-15" },
    );
    expect(five.length_s).toBe(4 + 18 * 5 + 4); // 98
  });

  it("caps at 5 stories even if more are supplied", () => {
    const seven = Array.from({ length: 7 }, (_, i) =>
      cand(`x${i}`, `Story ${i} something happening`, "CBC"),
    );
    const seg = buildDailyBrief(seven, { date: "2026-06-15" });
    // 4 beats per story × 5 stories = 20; + intro + outro = 22
    expect(seg.beats.length).toBe(22);
  });

  it("threads candidate clip_url into each story's cold_open clip.src so yt-dlp can fetch", () => {
    const seg = buildDailyBrief([cand("a", "Story A", "CBC"), cand("b", "Story B", "CTV")], {
      date: "2026-06-15",
    });
    const coldOpens = seg.beats.filter((b) => b.type === "cold_open" && b.clip != null);
    // intro is also a cold_open with clip=null; the 2 stories have clips
    expect(coldOpens.length).toBe(2);
    expect(coldOpens[0]?.clip?.src).toBe("https://example.com/a");
    expect(coldOpens[1]?.clip?.src).toBe("https://example.com/b");
  });
});
