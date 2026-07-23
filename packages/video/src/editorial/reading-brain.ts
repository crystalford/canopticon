// Reading-sourced editorial brain — turns a Canopticon signed reading
// into a §7b Segment, alongside the existing GDELT-clip brain.ts.
//
// Same trust posture as the rest of the render pipeline: the writer
// only ever sees facts + quotes the publication's own firewall has
// already verified (a signed reading is operator-approved before it
// ever reaches here) — it is NOT discovering or fact-checking anything
// new, only re-sequencing what's already established into a script.
// forensic_turn stays needs_human: true regardless of what the LLM
// emits; the mandatory review gate applies here exactly as it does to
// GDELT-sourced segments.
//
// Two formats, one schema (segment-schema.ts already supports both —
// length_s up to 1200, variants include 1920x1080 landscape):
//   short — 45-75s, vertical, one evidence beat, the existing shape.
//   long  — 300-900s (5-15 min), landscape, one evidence beat PER fact
//           supplied, still building to a single forensic_turn line.
// Unlike GDELT segments, there is no broadcast clip to cut to — every
// beat's clip is null; the visual layer is chrome (captions, callouts,
// data_callouts) over the narration, not real footage.

import type { Segment } from "@canopticon/shared/video/segment-schema";
import { SegmentSchema } from "@canopticon/shared/video/segment-schema";

export type EssayFormat = "short" | "long";

export interface ReadingFact {
  text: string;
  quote: string | null;
  source: string | null;
}

export interface ReadingInput {
  subjectSlug: string;
  subjectLabel: string;
  thesis: string;
  facts: ReadingFact[];
}

interface Env {
  AI: Ai;
}

export interface DraftResult {
  ok: boolean;
  segment?: Segment;
  used_llm: boolean;
  error?: string;
}

const FORMAT_SPEC: Record<EssayFormat, { lengthRange: [number, number]; variant: string }> = {
  short: { lengthRange: [45, 75], variant: "1080x1920" },
  long: { lengthRange: [300, 900], variant: "1920x1080" },
};

export async function draftSegmentFromReading(
  env: Env,
  input: ReadingInput,
  format: EssayFormat,
): Promise<DraftResult> {
  if (input.facts.length === 0) {
    return { ok: false, used_llm: false, error: "reading has no established facts to draw on" };
  }

  if (env.AI) {
    const llm = await draftViaLLM(env, input, format).catch(() => null);
    if (llm) return { ok: true, segment: llm, used_llm: true };
  }
  return { ok: true, segment: buildSkeletonSegment(input, format), used_llm: false };
}

async function draftViaLLM(
  env: Env,
  input: ReadingInput,
  format: EssayFormat,
): Promise<Segment | null> {
  const spec = FORMAT_SPEC[format];
  const factLines = input.facts
    .slice(0, format === "long" ? 40 : 8)
    .map(
      (f, i) =>
        `[f${i + 1}] "${f.text}"${f.quote ? ` — quote: "${f.quote.slice(0, 200)}"` : ""}${f.source ? ` (source: ${f.source})` : ""}`,
    )
    .join("\n");

  const system = `You are CANOPTICON's forensic segment writer, working from ALREADY-VERIFIED facts (a signed reading, not a news clip). Convert them into a ${format === "long" ? "landscape, longer-form" : "vertical, short-form"} video segment.

OUTPUT JSON only — the §7b Segment schema. NO commentary, NO markdown.

HARD RULES:
- length_s between ${spec.lengthRange[0]} and ${spec.lengthRange[1]}
- variants = ["${spec.variant}"]
- beats[] must include: one "cold_open", one "thesis", ${format === "long" ? 'one "evidence" beat PER fact supplied below (do not skip any), at least one "steelman",' : 'at least one "evidence",'} one "forensic_turn", one "implication", one "tag"
- forensic_turn at roughly the point where the piece pivots from laying out facts to stating what they add up to
- needs_human: true on the forensic_turn (the operator approves it before render)
- voice.provider = "minimax", voice.voice_id = "operator-clone"
- music.bed = "forensic_low", drop_at_s ≈ the forensic_turn beat's t_in_s
- Every beat with a factual claim must cite its source string (use the fact's [fN] label or source field)
- clip is ALWAYS null — there is no broadcast footage, only narration + on-screen chrome (caption/callout/data_callout). Use chrome to carry visual weight.
- Apply the "but/therefore" test — no two beats joined by "and then"
- Never state a contested claim as settled fact — these facts are already firewall-verified as established, so this shouldn't arise, but stay faithful to what's actually supplied

CONTRACT: emit a JSON object matching:
{
  "id": "<derive from subject slug>",
  "title": "<short, evocative>",
  "template": "claim_vs_ground",
  "length_s": <int ${spec.lengthRange[0]}-${spec.lengthRange[1]}>,
  "forensic_turn": { "text": "<the line that reveals what the facts add up to>", "needs_human": true },
  "beats": [ { "t_in_s": int, "t_out_s": int, "type": "...", "vo": "...|null", "clip": null, "chrome": [...], "source": "..." }, ... ],
  "music": { "bed": "forensic_low", "drop_at_s": int },
  "voice": { "provider": "minimax", "voice_id": "operator-clone" },
  "sources": [ "..." ],
  "variants": ["${spec.variant}"]
}`;

  const user = `SUBJECT: ${input.subjectLabel}
THESIS: ${input.thesis}

ESTABLISHED FACTS:
${factLines}

Write the ${format}-form segment.`;

  const out = (await env.AI.run(
    "@cf/openai/gpt-oss-120b" as never,
    {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      reasoning_effort: "medium",
      max_tokens: format === "long" ? 6000 : 2000,
    } as never,
  )) as { response?: string };
  const text = out.response ?? "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  const raw = JSON.parse(text.slice(start, end + 1)) as unknown;
  const parsed = SegmentSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    // Force a deterministic id regardless of what the LLM emitted —
    // queue.ts's synthetic-candidate branch (mirroring the existing
    // "brief-" pattern) depends on the "reading-" prefix to recognize
    // and display this segment; the LLM's freely-chosen id can't be
    // trusted to include it reliably. Same discipline as forcing
    // needs_human below regardless of what the model claims.
    id: `seg-reading-${input.subjectSlug}-${format}-${Date.now()}`,
    forensic_turn: { ...parsed.data.forensic_turn, needs_human: true },
  };
}

/** Deterministic skeleton — used when the LLM call fails or the AI
 *  binding is absent. One evidence beat per fact (short-form caps at
 *  the first few; long-form uses all of them), TODO markers on the
 *  forensic_turn and implication lines so the operator sees clearly
 *  the brain didn't run. */
function buildSkeletonSegment(input: ReadingInput, format: EssayFormat): Segment {
  const spec = FORMAT_SPEC[format];
  const facts = input.facts.slice(0, format === "long" ? 40 : 3);
  const title = input.thesis.slice(0, 80);

  let t = 0;
  const beats: Segment["beats"] = [];

  const push = (
    type: Segment["beats"][number]["type"],
    durationS: number,
    vo: string | null,
    source: string | null,
  ) => {
    beats.push({
      t_in_s: t,
      t_out_s: t + durationS,
      type,
      vo,
      clip: null,
      chrome: vo ? [{ kind: "caption", text: vo.slice(0, 120) }] : [],
      source,
    });
    t += durationS;
  };

  push("cold_open", format === "long" ? 8 : 4, input.subjectLabel, null);
  push("thesis", format === "long" ? 15 : 8, input.thesis.slice(0, 200), null);
  const evidenceDuration =
    format === "long" ? 20 : Math.max(6, Math.floor((spec.lengthRange[1] - 40) / facts.length));
  for (const f of facts) {
    push(
      "evidence",
      evidenceDuration,
      f.text.slice(0, 300),
      f.source ?? f.quote?.slice(0, 80) ?? null,
    );
  }
  if (format === "long") {
    push(
      "steelman",
      20,
      "[OPERATOR: strongest counter-read of the facts above, stated fairly]",
      null,
    );
  }
  push(
    "forensic_turn",
    format === "long" ? 25 : 14,
    "[OPERATOR: write the line that reveals what these facts add up to]",
    null,
  );
  push("implication", format === "long" ? 20 : 12, "[OPERATOR: why it matters]", null);
  push("tag", 4, null, null);
  const tagBeat = beats[beats.length - 1];
  if (tagBeat) {
    tagBeat.chrome = [{ kind: "caption", text: `canopticon · ${input.subjectLabel}` }];
  }

  const forensicBeat = beats.find((b) => b.type === "forensic_turn");

  return {
    id: `seg-reading-${input.subjectSlug}-${format}-${Date.now()}`,
    title,
    template: "claim_vs_ground",
    length_s: t,
    forensic_turn: {
      text: "[OPERATOR: write the line that reveals what these facts add up to]",
      needs_human: true,
    },
    beats,
    music: { bed: "forensic_low", drop_at_s: forensicBeat?.t_in_s ?? Math.floor(t / 2) },
    voice: { provider: "minimax", voice_id: "operator-clone" },
    sources: input.facts.map((f) => f.source).filter((s): s is string => !!s),
    variants: [spec.variant as Segment["variants"][number]],
  };
}
