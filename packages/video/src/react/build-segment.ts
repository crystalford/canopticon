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
    const srcDur = Math.max(0.1, p.end_s - p.start_s);
    beats.push({
      t_in_s: t,
      t_out_s: t + srcDur,
      type: "source_clip",
      vo: null,
      clip: { src: project.source_url, in_s: p.start_s, out_s: p.end_s, audio: "surface" },
      chrome: [],
      source: project.source_url,
    });
    t += srcDur;

    const reactDur = Math.max(0.1, (p.reaction_duration_ms as number) / 1000);
    beats.push({
      t_in_s: t,
      t_out_s: t + reactDur,
      type: "reaction",
      vo: null,
      clip: {
        src: `${videoBase}/react/clip/${encodeURIComponent(p.reaction_r2_key as string)}`,
        in_s: 0,
        out_s: reactDur,
        audio: "surface",
      },
      chrome: [],
      source: null,
    });
    t += reactDur;
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
