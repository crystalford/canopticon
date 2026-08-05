import { SegmentSchema } from "@canopticon/shared/video/segment-schema";
import { describe, expect, it } from "vitest";
import { buildReactSegment, buildSinglePointSegment } from "../src/react/build-segment";
import type { ReactPointRow, ReactProjectRow } from "../src/react/db";

const project: ReactProjectRow = {
  id: "proj-1",
  title: "Freeland on the Economist",
  source_url: "https://example.com/interview",
  status: "ready_for_scripting",
  transcript_json: null,
  source_r2_key: null,
  source_duration_s: 300,
  stitched_r2_key: null,
  approved_at: null,
  published_at: null,
  error: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function point(overrides: Partial<ReactPointRow>): ReactPointRow {
  return {
    id: "pt",
    project_id: "proj-1",
    sort_order: 0,
    start_s: 0,
    end_s: 10,
    transcript_text: "some claim",
    summary: "a point",
    suggested_angle_kind: "none",
    suggested_angle_text: null,
    angle_judge_pass: null,
    angle_judge_notes: null,
    cue_mode: "bullets",
    cue_text: "riff on this",
    status: "approved",
    clip_r2_key: null,
    reaction_r2_key: "react-clips/pt-123.webm",
    reaction_duration_ms: 8000,
    export_r2_key: null,
    export_status: null,
    export_error: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildReactSegment", () => {
  it("rejects fewer than 2 approved points", () => {
    const { segment, error } = buildReactSegment(
      project,
      [point({ id: "p1", sort_order: 0 })],
      "https://video.canopticon.com",
    );
    expect(segment).toBeNull();
    expect(error).toMatch(/at least 2/);
  });

  it("rejects an approved point with no recording yet", () => {
    const points = [
      point({ id: "p1", sort_order: 0 }),
      point({ id: "p2", sort_order: 1, reaction_r2_key: null, reaction_duration_ms: null }),
    ];
    const { segment, error } = buildReactSegment(project, points, "https://video.canopticon.com");
    expect(segment).toBeNull();
    expect(error).toMatch(/still need a recorded reaction/);
  });

  it("ignores skipped/pending points and builds alternating source/reaction beats", () => {
    const points = [
      point({ id: "p1", sort_order: 0, start_s: 0, end_s: 10, reaction_duration_ms: 5000 }),
      point({ id: "p2", sort_order: 1, status: "skipped" }),
      point({ id: "p3", sort_order: 2, start_s: 20, end_s: 26, reaction_duration_ms: 4000 }),
    ];
    const { segment, error } = buildReactSegment(project, points, "https://video.canopticon.com");
    expect(error).toBeNull();
    expect(segment).not.toBeNull();
    // Validate against the real §7b contract, not just this function's own shape.
    expect(() => SegmentSchema.parse(segment)).not.toThrow();

    const beats = segment?.beats ?? [];
    expect(beats).toHaveLength(4);
    expect(beats.map((b) => b.type)).toEqual([
      "source_clip",
      "reaction",
      "source_clip",
      "reaction",
    ]);
    expect(beats[0]?.clip).toEqual({
      src: "https://example.com/interview",
      in_s: 0,
      out_s: 10,
      audio: "surface",
    });
    expect(beats[1]?.clip?.src).toBe(
      `https://video.canopticon.com/react/clip/${encodeURIComponent("react-clips/pt-123.webm")}`,
    );
    expect(beats.every((b) => b.vo === null)).toBe(true);
    // 10s source + 5s reaction + 6s source + 4s reaction = 25s
    expect(segment?.length_s).toBe(25);
  });
});

describe("buildSinglePointSegment", () => {
  it("rejects a point that isn't approved", () => {
    const { segment, error } = buildSinglePointSegment(
      project,
      point({ status: "pending" }),
      "https://video.canopticon.com",
    );
    expect(segment).toBeNull();
    expect(error).toMatch(/must be approved/);
  });

  it("rejects an approved point with no recording", () => {
    const { segment, error } = buildSinglePointSegment(
      project,
      point({ reaction_r2_key: null, reaction_duration_ms: null }),
      "https://video.canopticon.com",
    );
    expect(segment).toBeNull();
    expect(error).toMatch(/no recorded reaction/);
  });

  it("pads a bare source+reaction pair with a tag beat to satisfy beats.min(3)", () => {
    const { segment, error } = buildSinglePointSegment(
      project,
      point({}),
      "https://video.canopticon.com",
    );
    expect(error).toBeNull();
    expect(() => SegmentSchema.parse(segment)).not.toThrow();
    const beats = segment?.beats ?? [];
    expect(beats).toHaveLength(3);
    expect(beats.map((b) => b.type)).toEqual(["source_clip", "reaction", "tag"]);
    expect(beats[2]?.clip).toBeNull();
  });
});
