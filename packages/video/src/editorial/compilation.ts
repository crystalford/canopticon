// Compilation segment — the "daily brief" format the operator asked
// for: 3-5 of the day's top-scoring candidates stitched into one
// ~75-90s vertical short.
//
// Structure: each mini-segment is a 15-18s self-contained beat-block
// (cold_open clip → one-line VO thesis → callout → bumper). The full
// composition runs:
//   [0–4s]     intro card — date, topic count
//   [4–22s]    story 1
//   [22–40s]   story 2
//   [40–58s]   story 3
//   ...
//   [N–N+4s]   outro card — canopticon mark + source list
//
// Each story's forensic_turn is a single line — the operator reviews
// all 3-5 turns at once on the daily-brief review page (Phase 1C, not
// implemented in this commit). For now the brain produces a skeleton
// the operator can promote, then approve one turn at a time.

import type { Beat, Segment } from "@canopticon/shared/video/segment-schema";
import type { CandidateRow } from "../sourcing/candidates";

const INTRO_S = 4;
const STORY_S = 18;
const OUTRO_S = 4;

/** Build a daily_brief segment from the top N candidates. Each story
 *  contributes one cold_open + one thesis + one evidence + one
 *  forensic_turn beat (4 beats × N stories). Total length scales with
 *  the candidate count: 4 + 18*N + 4 seconds. */
export function buildDailyBrief(
  candidates: CandidateRow[],
  args: { date: string } = { date: new Date().toISOString().slice(0, 10) },
): Segment {
  const usable = candidates.filter((c) => c.cast_template != null).slice(0, 5);
  if (usable.length < 2) {
    throw new Error("daily_brief needs at least 2 cast candidates");
  }
  const length_s = INTRO_S + STORY_S * usable.length + OUTRO_S;
  const beats: Beat[] = [];
  const sources = new Set<string>();
  const cards: string[] = [];

  // Intro card — date + topic count.
  beats.push({
    t_in_s: 0,
    t_out_s: INTRO_S,
    type: "cold_open",
    vo: null,
    clip: null,
    chrome: [
      { kind: "caption", text: `Canopticon · ${args.date}` },
      {
        kind: "callout",
        text: `${usable.length} stories the radar surfaced`,
        emphasis: "strong",
      },
    ],
    source: null,
  });

  // Per-story block: 18s, four beats (cold-open clip / thesis VO /
  // forensic_turn / micro-tag). The forensic_turn is the only line
  // the operator edits.
  usable.forEach((c, i) => {
    const block_t0 = INTRO_S + STORY_S * i;
    const tag = c.entities[0] ?? "the principal";
    sources.add(c.network);
    sources.add(c.clip_url);
    cards.push(`${i + 1}. ${c.headline.slice(0, 80)} — ${c.network}`);

    // 4s cold-open clip — yt-dlp fetches in the Container.
    beats.push({
      t_in_s: block_t0,
      t_out_s: block_t0 + 4,
      type: "cold_open",
      vo: null,
      clip: { src: c.clip_url, in_s: 0, out_s: 4, audio: "surface" },
      chrome: [
        {
          kind: "lower_third",
          speaker: tag.slice(0, 60),
          network: c.network,
          ...(c.captured_at ? { timestamp_label: c.captured_at.slice(0, 10) } : {}),
        },
      ],
      source: c.network,
    });

    // 6s thesis VO — narrator reads the story-of-the-day.
    beats.push({
      t_in_s: block_t0 + 4,
      t_out_s: block_t0 + 10,
      type: "thesis",
      vo: c.excerpt.slice(0, 180),
      clip: null,
      chrome: [{ kind: "caption", text: c.headline.slice(0, 90) }],
      source: null,
    });

    // 6s forensic_turn — the line the operator edits per story.
    beats.push({
      t_in_s: block_t0 + 10,
      t_out_s: block_t0 + 16,
      type: "forensic_turn",
      vo: `[OPERATOR ${i + 1}: edit the forensic_turn for "${c.headline.slice(0, 60)}"]`,
      clip: null,
      chrome: [],
      source: c.clip_url,
    });

    // 2s micro-tag — story number + bumper.
    beats.push({
      t_in_s: block_t0 + 16,
      t_out_s: block_t0 + 18,
      type: "tag",
      vo: null,
      clip: null,
      chrome: [{ kind: "callout", text: `→ story ${i + 2}`, emphasis: "normal" }],
      source: null,
    });
  });

  // Outro card — canopticon mark, sources roll-up.
  beats.push({
    t_in_s: INTRO_S + STORY_S * usable.length,
    t_out_s: length_s,
    type: "tag",
    vo: null,
    clip: null,
    chrome: [
      {
        kind: "caption",
        text: `canopticon · sources: ${[...sources].slice(0, 6).join(" · ")}`,
      },
    ],
    source: null,
  });

  return {
    id: `seg-brief-${args.date}`,
    title: `Daily brief — ${args.date}`,
    template: "daily_brief",
    length_s,
    forensic_turn: {
      // The compilation's umbrella forensic_turn — usually a one-liner
      // tying the day together. The operator can leave it blank by
      // approving with no edit, in which case the outro carries the
      // weight alone.
      text: `[OPERATOR: write the one-line frame for ${args.date} — what ties these ${usable.length} stories together?]`,
      needs_human: true,
    },
    beats,
    music: { bed: "forensic_low", drop_at_s: INTRO_S },
    voice: { provider: "minimax", voice_id: "operator-clone" },
    sources: [...sources],
    variants: ["1080x1920"],
  };
}
