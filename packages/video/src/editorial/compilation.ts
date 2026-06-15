// Compilation segment — the "daily brief" format the operator asked
// for: 3-5 of the day's top-scoring candidates stitched into one
// ~110-180s vertical short.
//
// Per-story is 35s — long enough that each story gets a real cold-open
// clip, a full thesis VO, a forensic_turn line with room to land, and
// a transition bumper. Tighter than that and the compilation reads as
// a teaser, not a brief. The schema's 180s ceiling still applies; five
// 35s stories + intro + outro lands at 185s if uncapped — buildDailyBrief
// caps at 5 stories AND honours the 180s ceiling, so the actual maximum
// length is 174s with a 4s intro and 4s outro × 5 stories of 33s each
// when capped. For typical 3-story briefs the math is comfortable.
//
// Structure:
//   [0–6s]      intro card — date, topic count
//   [6–41s]     story 1 (35s)
//   [41–76s]    story 2 (35s)
//   [76–111s]   story 3 (35s)
//   ...
//   [N–N+6s]    outro card — canopticon mark + source list
//
// Each story's forensic_turn is a single line — the operator reviews
// all 3-5 turns + the umbrella line on the brief review page.

import type { Beat, Segment } from "@canopticon/shared/video/segment-schema";
import type { CandidateRow } from "../sourcing/candidates";

const INTRO_S = 6;
const STORY_S = 35;
const OUTRO_S = 6;
// Schema caps length_s at 180. With INTRO_S=6 + OUTRO_S=6 = 12, that
// leaves 168s for stories. 168 / STORY_S = 4.8 → 4 full 35s stories,
// or 5 stories at the slightly compressed COMPRESSED_STORY_S below.
const MAX_STORIES = 5;
const COMPRESSED_STORY_S = 33; // 5 × 33 + 12 = 177s ≤ 180

/** Build a daily_brief segment from the top N candidates. Each story
 *  contributes one cold_open clip + one thesis VO + one forensic_turn
 *  + one micro-tag (4 beats × N stories). Per-story length 35s default,
 *  compressed to 33s when 5 stories are present to stay inside the
 *  180s schema ceiling. */
export function buildDailyBrief(
  candidates: CandidateRow[],
  args: { date: string } = { date: new Date().toISOString().slice(0, 10) },
): Segment {
  const usable = candidates.filter((c) => c.cast_template != null).slice(0, MAX_STORIES);
  if (usable.length < 2) {
    throw new Error("daily_brief needs at least 2 cast candidates");
  }
  const storyS = usable.length >= 5 ? COMPRESSED_STORY_S : STORY_S;
  const length_s = INTRO_S + storyS * usable.length + OUTRO_S;
  const beats: Beat[] = [];
  const sources = new Set<string>();

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

  // Per-story block: storyS seconds, four beats with the proportions
  // tuned so the forensic_turn gets the most room (it's the line that
  // does the work).
  const COLD_S = Math.round(storyS * 0.17); // ~6s of 35
  const THESIS_S = Math.round(storyS * 0.34); // ~12s of 35
  const TURN_S = Math.round(storyS * 0.4); // ~14s of 35
  // micro_tag = storyS - (cold + thesis + turn)
  usable.forEach((c, i) => {
    const block_t0 = INTRO_S + storyS * i;
    const tag = c.entities[0] ?? "the principal";
    sources.add(c.network);
    sources.add(c.clip_url);

    // ~6s cold-open clip — yt-dlp fetches in the Container.
    beats.push({
      t_in_s: block_t0,
      t_out_s: block_t0 + COLD_S,
      type: "cold_open",
      vo: null,
      clip: { src: c.clip_url, in_s: 0, out_s: COLD_S, audio: "surface" },
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

    // ~12s thesis VO — narrator reads enough context for the story
    // to make sense to a viewer who hasn't been following it.
    beats.push({
      t_in_s: block_t0 + COLD_S,
      t_out_s: block_t0 + COLD_S + THESIS_S,
      type: "thesis",
      vo: c.excerpt.slice(0, 320),
      clip: null,
      chrome: [{ kind: "caption", text: c.headline.slice(0, 90) }],
      source: null,
    });

    // ~14s forensic_turn — the line the operator edits per story.
    // Most room of any beat: this is where the gap gets revealed and
    // landed, with a beat of silence after the damning fact.
    beats.push({
      t_in_s: block_t0 + COLD_S + THESIS_S,
      t_out_s: block_t0 + COLD_S + THESIS_S + TURN_S,
      type: "forensic_turn",
      vo: `[OPERATOR ${i + 1}: edit the forensic_turn for "${c.headline.slice(0, 60)}"]`,
      clip: null,
      chrome: [],
      source: c.clip_url,
    });

    // Remaining seconds → micro-tag + transition bumper to the next
    // story (or the outro for the last one).
    beats.push({
      t_in_s: block_t0 + COLD_S + THESIS_S + TURN_S,
      t_out_s: block_t0 + storyS,
      type: "tag",
      vo: null,
      clip: null,
      chrome: [
        {
          kind: "callout",
          text: i < usable.length - 1 ? `→ story ${i + 2}` : "→ outro",
          emphasis: "normal",
        },
      ],
      source: null,
    });
  });

  // Outro card — canopticon mark, sources roll-up.
  beats.push({
    t_in_s: INTRO_S + storyS * usable.length,
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
      // tying the day together. Burned into the outro card and read by
      // the narrator under the closing bumper if non-empty.
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
