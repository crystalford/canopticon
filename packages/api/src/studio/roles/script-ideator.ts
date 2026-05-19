// Script Ideator — turns a post (or a cluster of claims) into a beat
// sequence ready for recording. Llama 3.3 70B by default; Anthropic
// available via opt-in (use_anthropic=true on the production row).

import type { Env } from "../../env";
import { callLLM } from "../../llm/index";
import type { RawBeat } from "../lib/beat-splitter";

const PROMPT_FROM_POST = `You are the Script Ideator. You turn a written post into a spoken-word audio script — a sequence of beats the operator will record one by one.

ABSOLUTE RULES:
- Total runtime target: 5-8 minutes (≈ 750-1200 words).
- 6-14 beats. Each beat is one breath unit: open, build, turn, evidence, reflect, close.
- Beats are SPOKEN, not WRITTEN. Short sentences. Plain words. No bracketed citations.
- If the source post has [claim:ID] markers, the corresponding beat MAY include cited_claim_id (just the id, no marker in the text).
- Role tags MUST appear in order: 'open' first, 'close' last. 'turn' marks the structural pivot (about 1/3 in). Use 'transition' for short interstitials between sections. Mostly 'context' and 'evidence' otherwise. 'reflect' rare, before the close.
- cue: 3-5 word ALL CAPS slug summarizing the beat. The operator reads it in the recording overlay before they start the take.
- next_preview: short paraphrase of the NEXT beat. Helps the operator find rhythm. Last beat omits it.
- target_seconds: 12-60 per beat. Sum should land in the 5-8 minute window.

OUTPUT: JSON matching the schema. No prose.

POST TITLE: {TITLE}
POST BODY:
{BODY}`;

const PROMPT_FROM_CLAIMS = `You are the Script Ideator. You turn a cluster of supplied claims into a spoken-word audio script — a sequence of beats the operator will record one by one.

ABSOLUTE RULES:
- Build the script AROUND the supplied claims. Every factual moment must trace back to one of them.
- Total runtime target: 5-8 minutes (≈ 750-1200 words). 6-14 beats.
- Role tags MUST appear in order: 'open' first, 'close' last.
- Set cited_claim_id on every beat that references one of the supplied claims (use the claim id verbatim).
- cue: 3-5 word ALL CAPS slug. next_preview: short paraphrase of the next beat (last beat omits it).
- target_seconds: 12-60 per beat. Sum lands 5-8 minutes.

OUTPUT: JSON matching the schema. No prose.

TOPIC: {TOPIC}
CLAIMS:
{CLAIMS}`;

const SCHEMA = {
  type: "object",
  required: ["beats"],
  properties: {
    title: { type: "string" },
    beats: {
      type: "array",
      items: {
        type: "object",
        required: ["beat_index", "role", "cue", "beat_text", "target_seconds"],
        properties: {
          beat_index: { type: "integer", minimum: 0 },
          role: {
            enum: ["open", "context", "turn", "evidence", "reflect", "close", "transition"],
          },
          cue: { type: "string" },
          beat_text: { type: "string" },
          next_preview: { type: "string" },
          target_seconds: { type: "integer", minimum: 5, maximum: 90 },
          cited_claim_id: { type: "string" },
        },
      },
    },
  },
} as const;

interface IdeatorOutput {
  title?: string;
  beats: Array<RawBeat & { cited_claim_id?: string }>;
}

export interface IdeateFromPostArgs {
  userId: string;
  postTitle: string;
  postBody: string;
  useAnthropic?: boolean;
}

export interface IdeateFromClaimsArgs {
  userId: string;
  topic: string;
  claims: Array<{ id: string; text: string; evidence_text: string }>;
  useAnthropic?: boolean;
}

export async function ideateFromPost(env: Env, args: IdeateFromPostArgs): Promise<IdeatorOutput> {
  const filled = PROMPT_FROM_POST.replace("{TITLE}", args.postTitle).replace(
    "{BODY}",
    args.postBody.slice(0, 16000),
  );
  return runIdeator(env, args.userId, filled, args.useAnthropic ?? false);
}

export async function ideateFromClaims(
  env: Env,
  args: IdeateFromClaimsArgs,
): Promise<IdeatorOutput> {
  const filled = PROMPT_FROM_CLAIMS.replace("{TOPIC}", args.topic).replace(
    "{CLAIMS}",
    args.claims.map((c) => `- [id=${c.id}] ${c.text}\n  evidence: ${c.evidence_text}`).join("\n"),
  );
  return runIdeator(env, args.userId, filled, args.useAnthropic ?? false);
}

async function runIdeator(
  env: Env,
  userId: string,
  prompt: string,
  useAnthropic: boolean,
): Promise<IdeatorOutput> {
  const out = await callLLM(env, {
    provider: useAnthropic ? "anthropic" : "workers_ai",
    model: useAnthropic ? "claude-sonnet-4-6" : "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    max_tokens: 4000,
    temperature: 0.6,
    response_schema: SCHEMA as unknown as Record<string, unknown>,
    ledger: {
      user_id: userId,
      operation_type: useAnthropic
        ? "anthropic.role.script_ideator"
        : "workers_ai.role.script_ideator",
    },
  });
  const parsed = (out.structured ?? { beats: [] }) as IdeatorOutput;
  parsed.beats = (parsed.beats ?? []).map((b, i) => ({
    ...b,
    beat_index: i,
    next_preview: b.next_preview ?? "",
  }));
  return parsed;
}
