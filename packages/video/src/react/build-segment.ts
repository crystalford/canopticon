// Builds a §7b Segment from an approved, fully-recorded react_project's
// points — alternating source-clip beat / reaction beat per point, hard
// cuts (no chrome), each clip playing its own embedded audio. Reuses the
// existing render pipeline as-is: video-renderer/render/orchestrator.ts's
// resolveRemoteClipsAndAlign already fetches+trims any https:// clip.src
// via yt-dlp+ffmpeg at render time (both the original source_url and the
// operator's own recorded reaction clips, served back over plain HTTPS
// by routes/react.ts's GET /clip/:key proxy) — no separate pre-cut step
// needed, and the source video is only downloaded once (fetchAndTrimClip
// caches the full download by URL hash, then trims per beat).
//
// vo stays null on every beat — voice.provider/voice_id are structurally
// required by the schema but mixSegmentAudio only ever calls MiniMax for
// beats with non-null vo, so they're never invoked. music.bed points at
// a name no bundled bed file matches, so mixSegmentAudio's bedExists
// check quietly skips the music layer — this template is nothing but the
// two clips' own audio, hard-cut together, matching a standard
// reaction-video edit.

import type { Beat, Segment } from "@canopticon/shared/video/segment-schema";
import type { ReactPointRow, ReactProjectRow } from "./db";

// beats.min(3) in the shared schema; 2 points -> 4 beats is the smallest
// stitchable reaction video.
const MIN_STITCHABLE_POINTS = 2;

export interface BuildSegmentResult {
  segment: Segment | null;
  error: string | null;
}

/** One point -> its source_clip + reaction beat pair, positioned starting
 *  at `tStart` on whatever timeline it's placed into. Shared by the full
 *  stitch (every approved point, back to back) and the single-point
 *  social-clip export (Phase 8). */
function pointBeats(
  project: ReactProjectRow,
  point: ReactPointRow,
  videoBase: string,
  tStart: number,
): { beats: Beat[]; tEnd: number } {
  let t = tStart;
  const beats: Beat[] = [];

  const srcDur = Math.max(0.1, point.end_s - point.start_s);
  beats.push({
    t_in_s: t,
    t_out_s: t + srcDur,
    type: "source_clip",
    vo: null,
    clip: { src: project.source_url, in_s: point.start_s, out_s: point.end_s, audio: "surface" },
    chrome: [],
    source: project.source_url,
  });
  t += srcDur;

  const reactDur = Math.max(0.1, (point.reaction_duration_ms as number) / 1000);
  beats.push({
    t_in_s: t,
    t_out_s: t + reactDur,
    type: "reaction",
    vo: null,
    clip: {
      src: `${videoBase}/react/clip/${encodeURIComponent(point.reaction_r2_key as string)}`,
      in_s: 0,
      out_s: reactDur,
      audio: "surface",
    },
    chrome: [],
    source: null,
  });
  t += reactDur;

  return { beats, tEnd: t };
}

export function buildReactSegment(
  project: ReactProjectRow,
  points: ReactPointRow[],
  videoBase: string,
): BuildSegmentResult {
  const approved = points
    .filter((p) => p.status === "approved")
    .sort((a, b) => a.sort_order - b.sort_order);

  if (approved.length < MIN_STITCHABLE_POINTS) {
    return {
      segment: null,
      error: `need at least ${MIN_STITCHABLE_POINTS} approved points to stitch (have ${approved.length})`,
    };
  }
  const unrecorded = approved.filter((p) => !p.reaction_r2_key || !p.reaction_duration_ms);
  if (unrecorded.length > 0) {
    return {
      segment: null,
      error: `${unrecorded.length} approved point(s) still need a recorded reaction`,
    };
  }

  const beats: Beat[] = [];
  let t = 0;
  for (const p of approved) {
    const pair = pointBeats(project, p, videoBase, t);
    beats.push(...pair.beats);
    t = pair.tEnd;
  }

  const segment: Segment = {
    id: `react-${project.id}`,
    title: project.title,
    template: "reaction",
    length_s: Math.min(1200, Math.max(15, Math.round(t))),
    // No forensic_turn concept for this template — every point was
    // already individually approved on the review page. Structurally
    // required by the schema, so a harmless satisfied placeholder.
    forensic_turn: { text: project.title, needs_human: false },
    beats,
    music: { bed: "none" }, // no bundled bed named "none" -> mixSegmentAudio skips music
    voice: { provider: "fixture", voice_id: "unused-reaction-video" },
    sources: [project.source_url],
    variants: ["1080x1920"],
  };
  return { segment, error: null };
}

/** A single point's source-clip + reaction pair as its own standalone
 *  short — Phase 8's per-point social clip export. beats.min(3) in the
 *  shared schema means a bare pair (2 beats) doesn't validate; a
 *  trivial "tag" end-card (no clip, just a caption) is the exact same
 *  workaround editorial/brain.ts and compilation.ts already use to close
 *  out their own segments, reused here rather than inventing a new one. */
export function buildSinglePointSegment(
  project: ReactProjectRow,
  point: ReactPointRow,
  videoBase: string,
): BuildSegmentResult {
  if (point.status !== "approved") {
    return { segment: null, error: "point must be approved before exporting" };
  }
  if (!point.reaction_r2_key || !point.reaction_duration_ms) {
    return { segment: null, error: "point has no recorded reaction yet" };
  }

  const { beats, tEnd } = pointBeats(project, point, videoBase, 0);
  beats.push({
    t_in_s: tEnd,
    t_out_s: tEnd + 2,
    type: "tag",
    vo: null,
    clip: null,
    chrome: [{ kind: "caption", text: "canopticon" }],
    source: null,
  });

  const segment: Segment = {
    id: `react-export-${point.id}`,
    title: point.summary,
    template: "reaction",
    length_s: Math.min(1200, Math.max(15, Math.round(tEnd + 2))),
    forensic_turn: { text: point.summary, needs_human: false },
    beats,
    music: { bed: "none" },
    voice: { provider: "fixture", voice_id: "unused-reaction-video" },
    sources: [project.source_url],
    variants: ["1080x1920"],
  };
  return { segment, error: null };
}
