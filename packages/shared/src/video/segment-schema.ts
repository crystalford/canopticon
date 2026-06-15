// Segment JSON — the contract between the editorial brain and the
// renderer (handoff doc §7b).
//
// The brain (Phase 1: a Workers AI LLM scoring stories against the
// rubric + casting one into a template + writing the script) emits this
// JSON. The renderer (Phase 0+: the Cloudflare Container running
// Remotion + ffmpeg) consumes it. Both Workers + the Container import
// the zod schema from `@canopticon/shared/video/segment-schema` — the
// schema IS the seam that decouples the two sides.
//
// Phase 0 ships only the renderer side, against a hardcoded Carney
// segment fixture. The schema is fully formed from day one so Phase 1
// has nothing structural to invent.

import { z } from "zod";

/** Four editorial templates. Three from the handoff (Part IV) — each
 *  is a beat skeleton, not a visual style — plus the compilation
 *  format the operator asked for in Phase 1B. */
export const TemplateKindSchema = z.enum([
  "claim_vs_ground", // Claim vs. The Ground — fact-check a statement against the record
  "buried_number", // The Buried Number — one shocking datapoint, scaled
  "reversal", // The Reversal — official story inverted by the receipts
  "daily_brief", // 3-5 stories of the day in one ~75-90s compilation
]);

export const VariantSchema = z.enum([
  "1080x1920", // vertical (TikTok / Reels / Shorts) — Phase 0 default
  "1080x1080", // square (IG feed / LinkedIn)
  "1920x1080", // horizontal (YouTube)
]);

/** Voice provider for the narrator track. Operator decision: MiniMax
 *  Speech 2.8 HD by default (pure Workers AI, consistent with v2.6
 *  Studio Stage B), ElevenLabs opt-in for high-stakes pieces. Phase 0
 *  uses a pre-recorded fixture WAV regardless. */
export const VoiceSchema = z.object({
  provider: z.enum(["minimax", "elevenlabs", "fixture"]),
  /** MiniMax voice id (from the operator's trained clone), or an
   *  ElevenLabs voice id, or a fixture filename for Phase 0. */
  voice_id: z.string(),
});

/** A real broadcast clip plus its in/out trim and which audio track to
 *  surface. `src` is an R2 key the renderer fetches via the bucket
 *  binding. */
export const ClipSchema = z.object({
  src: z.string().min(1),
  in_s: z.number().nonnegative(),
  out_s: z.number().nonnegative(),
  audio: z.enum(["surface", "ducked", "mute"]),
});

/** A piece of on-screen chrome: kinetic caption, broadcaster lower-third,
 *  annotation callout, data freeze-and-annotate, animated chart. Each
 *  variant carries its own props; the renderer dispatches on `kind`. */
export const ChromeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("caption"),
    text: z.string(),
    /** Word-level timings within the beat (Phase 2 will populate from
     *  WhisperX; Phase 0 fills in the segment fixture by hand). */
    words: z
      .array(z.object({ text: z.string(), t_in_ms: z.number(), t_out_ms: z.number() }))
      .optional(),
  }),
  z.object({
    kind: z.literal("lower_third"),
    speaker: z.string(),
    role: z.string().optional(),
    network: z.string().optional(),
    timestamp_label: z.string().optional(),
  }),
  z.object({
    kind: z.literal("callout"),
    text: z.string(),
    emphasis: z.enum(["normal", "strong", "warning"]).default("normal"),
  }),
  z.object({
    kind: z.literal("data_callout"),
    label: z.string(),
    value: z.string(),
    units: z.string().optional(),
    annotation: z.string().optional(),
  }),
  z.object({
    kind: z.literal("animated_chart"),
    /** A tiny chart spec — handful of (label, value) points to
     *  interpolate frame-by-frame. The renderer picks the chart type
     *  (line / bar) from `chart_type`. */
    title: z.string(),
    chart_type: z.enum(["line", "bar"]).default("line"),
    points: z.array(z.object({ label: z.string(), value: z.number() })).min(2),
  }),
  z.object({
    kind: z.literal("side_by_side"),
    left_label: z.string(),
    right_label: z.string(),
    /** R2 keys for the two assets. Either can be a still or a clip. */
    left_src: z.string(),
    right_src: z.string(),
  }),
  z.object({
    kind: z.literal("freeze_annotate"),
    /** Which clip to freeze (matches Beat.clip if multiple). */
    clip_src: z.string(),
    freeze_at_s: z.number().nonnegative(),
    hold_ms: z.number().int().positive(),
    annotation: z.string(),
  }),
]);

/** Music bed + drop sync point. The renderer ducks under VO and surface
 *  audio per the beat's `audio` choice. */
export const MusicSchema = z.object({
  bed: z.string(), // e.g. "forensic_low" — names an MP3 in the renderer's static assets
  drop_at_s: z.number().nonnegative().optional(),
});

/** One beat = one structural unit of the segment. The template (Claim
 *  vs. Ground / Buried Number / Reversal) shapes the SEQUENCE of beat
 *  types; the renderer dispatches per-beat on its content. */
export const BeatSchema = z.object({
  t_in_s: z.number().nonnegative(),
  t_out_s: z.number().positive(),
  /** Editorial role of this beat in the chosen template. Drives the
   *  emphasis defaults (cold_open → strong, turn → pattern interrupt,
   *  steelman → muted). */
  type: z.enum([
    "cold_open",
    "thesis",
    "evidence",
    "forensic_turn",
    "steelman",
    "implication",
    "tag",
  ]),
  /** Narration line. Null when this beat carries no VO (held silence,
   *  pattern interrupt). */
  vo: z.string().nullable(),
  clip: ClipSchema.nullable(),
  chrome: z.array(ChromeSchema).default([]),
  source: z.string().nullable(),
});

/** The whole segment — the §7b contract in full. */
export const SegmentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  template: TemplateKindSchema,
  /** Total run-time. Capped at 75s per the handoff (35–75s working
   *  band; the system can extend to 2–3 min in rare cases). */
  length_s: z.number().int().min(15).max(180),
  /** The one line the operator approves. The brain emits this with
   *  `needs_human: true`; the Phase 1 review surface flips it to
   *  `needs_human: false` after the operator edits/approves; only then
   *  does the render fire. */
  forensic_turn: z.object({
    text: z.string(),
    needs_human: z.boolean(),
    approved_by: z.string().optional(),
    approved_at: z.string().optional(),
  }),
  beats: z.array(BeatSchema).min(3),
  music: MusicSchema,
  voice: VoiceSchema,
  /** Provenance — every source cited in the segment, end-card. */
  sources: z.array(z.string()).default([]),
  /** Output variants to render. The renderer fans them out from a
   *  single source-of-truth composition. */
  variants: z.array(VariantSchema).min(1).default(["1080x1920"]),
});

export type TemplateKind = z.infer<typeof TemplateKindSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Voice = z.infer<typeof VoiceSchema>;
export type Clip = z.infer<typeof ClipSchema>;
export type Chrome = z.infer<typeof ChromeSchema>;
export type Music = z.infer<typeof MusicSchema>;
export type Beat = z.infer<typeof BeatSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
