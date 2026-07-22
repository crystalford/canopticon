// Editorial brain — turns a promoted candidate into a §7b segment.
//
// One LLM call. The writer model gets the candidate (headline +
// excerpt + entities + source URL + cast template) + the §7b schema
// + the handoff's worked Carney example as a few-shot reference, and
// must emit a complete Segment JSON. The forensic_turn field is
// always flagged needs_human: true — the operator approves it
// before the renderer fires.
//
// Workers AI model: `@cf/openai/gpt-oss-120b` with reasoning_effort
// medium (the same pick the canopticon-api router uses for "hard
// extraction" — reasoning is what the forensic turn needs).
//
// Falls back to a deterministic template when the AI binding is
// absent or the call fails, so the pipeline runs end-to-end during
// the Phase 1 wiring window.

import type { Segment } from "@canopticon/shared/video/segment-schema";
import { SegmentSchema } from "@canopticon/shared/video/segment-schema";
import type { CandidateRow } from "../sourcing/candidates";

interface Env {
  AI: Ai;
}

export interface DraftResult {
  ok: boolean;
  segment?: Segment;
  used_llm: boolean;
  error?: string;
}

export async function draftSegment(env: Env, candidate: CandidateRow): Promise<DraftResult> {
  const template = candidate.cast_template;
  if (!template) {
    return { ok: false, used_llm: false, error: "candidate has no cast_template" };
  }

  // Try the LLM first; fall through to the deterministic skeleton
  // when the binding is missing, the call errors, or the response
  // doesn't validate against the §7b schema.
  if (env.AI) {
    const llm = await draftViaLLM(env, candidate, template).catch(() => null);
    if (llm) return { ok: true, segment: llm, used_llm: true };
  }
  const stub = buildSkeletonSegment(candidate, template);
  return { ok: true, segment: stub, used_llm: false };
}

async function draftViaLLM(
  env: Env,
  candidate: CandidateRow,
  template: string,
): Promise<Segment | null> {
  const system = `You are CANOPTICON's forensic segment writer. Convert a candidate news clip into a vertical short-form video segment.

OUTPUT JSON only — the §7b Segment schema. NO commentary, NO markdown.

HARD RULES:
- length_s between 45 and 75
- beats[] must include: one "cold_open", one "thesis", at least one "evidence", one "forensic_turn", optional "steelman", one "implication", one "tag"
- forensic_turn at ~60% of length_s
- needs_human: true on the forensic_turn (the operator approves it before render)
- voice.provider = "minimax", voice.voice_id = "operator-clone"
- variants = ["1080x1920"]
- music.bed = "forensic_low", drop_at_s ≈ forensic_turn t_in_s
- Every beat with a factual claim must cite its source string
- Open on the subject's own words when possible
- Apply the "but/therefore" test — no two beats joined by "and then"

TEMPLATE: ${template}

CONTRACT: emit a JSON object matching:
{
  "id": "<derive from candidate id>",
  "title": "<short, evocative>",
  "template": "${template}",
  "length_s": <int 45-75>,
  "forensic_turn": { "text": "<the line that reveals the gap>", "needs_human": true },
  "beats": [ { "t_in_s": int, "t_out_s": int, "type": "...", "vo": "...|null", "clip": null, "chrome": [], "source": "..." }, ... ],
  "music": { "bed": "forensic_low", "drop_at_s": int },
  "voice": { "provider": "minimax", "voice_id": "operator-clone" },
  "sources": [ "..." ],
  "variants": ["1080x1920"]
}`;

  const user = `CANDIDATE:
id: ${candidate.id}
network: ${candidate.network}
captured: ${candidate.captured_at}
headline: ${candidate.headline}
excerpt: ${candidate.excerpt}
entities: ${candidate.entities.join(", ")}
source_url: ${candidate.clip_url}

Write the segment JSON.`;

  try {
    const out = (await env.AI.run(
      "@cf/openai/gpt-oss-120b" as never,
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        reasoning_effort: "medium",
        max_tokens: 2000,
      } as never,
    )) as { response?: string };
    const text = out.response ?? "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < 0) return null;
    const raw = JSON.parse(text.slice(start, end + 1)) as unknown;
    const parsed = SegmentSchema.safeParse(raw);
    if (!parsed.success) return null;
    // Force needs_human regardless of what the LLM emitted — the
    // review gate is mandatory.
    return { ...parsed.data, forensic_turn: { ...parsed.data.forensic_turn, needs_human: true } };
  } catch {
    return null;
  }
}

/** Deterministic skeleton — used when the LLM call fails. Produces a
 *  valid §7b Segment scaffolded from the candidate's headline + excerpt,
 *  with TODO markers in the VO lines so the operator sees clearly that
 *  the brain didn't run.
 *
 *  Critical Phase 1B detail: the cold_open beat carries the candidate's
 *  clip_url. The renderer's orchestrator (Container) sees the https://
 *  src and fetches it via yt-dlp before bundling Remotion — so the
 *  render runs against today's actual broadcast footage, not a fixture. */
function buildSkeletonSegment(candidate: CandidateRow, template: string): Segment {
  const title = candidate.headline.slice(0, 80);
  const tag = candidate.entities[0] ?? "the principal";

  // 75s default — the upper end of the handoff's 35-75s working band.
  // Each beat gets real room: 6s cold-open, 9s thesis, 22s evidence,
  // 16s forensic_turn (the line that does the work, so the most room),
  // 18s implication, 4s tag. Story-specific renders can ask the LLM
  // to compress to 45-60s when the content is thin; the skeleton
  // errs on the side of breathing room.
  return {
    id: `seg-${candidate.id}`,
    title,
    template: template as Segment["template"],
    length_s: 75,
    forensic_turn: {
      text: "[OPERATOR: write the line that reveals the gap]",
      needs_human: true,
    },
    beats: [
      {
        t_in_s: 0,
        t_out_s: 6,
        type: "cold_open",
        vo: null,
        // The candidate's broadcast URL — yt-dlp downloads in the
        // Container. in_s/out_s = 0/6 means "first 6 seconds of the
        // clip"; the operator can refine these in a Phase 2 trim UI.
        clip: { src: candidate.clip_url, in_s: 0, out_s: 6, audio: "surface" },
        chrome: [{ kind: "lower_third", speaker: tag.slice(0, 60), network: candidate.network }],
        source: candidate.network,
      },
      {
        t_in_s: 6,
        t_out_s: 15,
        type: "thesis",
        vo: `[OPERATOR: thesis line opening the gap on "${candidate.headline.slice(0, 80)}"]`,
        clip: null,
        chrome: [],
        source: null,
      },
      {
        t_in_s: 15,
        t_out_s: 37,
        type: "evidence",
        vo: candidate.excerpt.slice(0, 350),
        clip: null,
        chrome: [{ kind: "callout", text: tag.slice(0, 60), emphasis: "strong" }],
        source: candidate.clip_url,
      },
      {
        t_in_s: 37,
        t_out_s: 53,
        type: "forensic_turn",
        vo: "[OPERATOR: edit the forensic_turn line, then approve]",
        clip: null,
        chrome: [],
        source: candidate.clip_url,
      },
      {
        t_in_s: 53,
        t_out_s: 71,
        type: "implication",
        vo: "[OPERATOR: implication — why it matters in one line]",
        clip: null,
        chrome: [],
        source: null,
      },
      {
        t_in_s: 71,
        t_out_s: 75,
        type: "tag",
        vo: null,
        clip: null,
        chrome: [{ kind: "caption", text: `canopticon · ${candidate.network}` }],
        source: null,
      },
    ],
    music: { bed: "forensic_low", drop_at_s: 37 },
    voice: { provider: "minimax", voice_id: "operator-clone" },
    sources: [candidate.network, candidate.clip_url],
    variants: ["1080x1920"],
  };
}
