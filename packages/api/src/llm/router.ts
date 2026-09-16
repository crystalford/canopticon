// Model router — per canonical-spec v2.4 Part 16.
//
// One inference abstraction. The router names PIPELINE STAGES (roles); the
// table below maps each role to a concrete Workers AI model + parameters.
// Any single stage can be re-pointed at a frontier API by editing the table —
// no rearchitecting (spec Part 16 rule #2).
//
// Why we don't just hardcode the model at each call site:
//   - extraction quality vs cost tradeoffs change as the catalog churns;
//   - the spec wants us to verify the live catalog before pinning IDs;
//   - the surfacing engine needs the SAME backbone with a DIFFERENT
//     reasoning_effort dial (Part 16 rule #1), which a router can express
//     once and reuse;
//   - judge MUST be a different model than the generator (Part 8 +
//     spec hard constraint Part 10 #4); the router enforces this by
//     pinning judge to a different family than every generation role.
//
// Live-catalog verification — 2026-06-10 (research result from PR B kickoff):
//   - @cf/meta/llama-3.3-70b-instruct-fp8-fast was SUNSET 2026-05-30
//     (planned-deprecations announcement 2026-05-08). Legacy default —
//     RETIRED here.
//   - @cf/google/gemma-4-26b-a4b-it (live since 2026-04-04). JSON mode.
//     The cheap-strong baseline for bulk extraction.
//   - @cf/openai/gpt-oss-120b (live since Aug 2025). 120B MoE / 12B active.
//     Supports reasoning_effort via Responses API. The reasoning model.
//   - @cf/qwen/qwq-32b (live, not deprecated). Older but still works as a
//     judge model that's a different family than every generator role.
//   - @cf/nvidia/nemotron-3-120b-a12b (live since 2026-03-11). 256k context
//     in + out. The large-context fallback for whole-corpus reasoning.
//
// research_writer candidate comparison — 2026-07-24 (live /debug-model
// probes, same research-brief prompt, max_tokens=4000, real account):
//   - @cf/openai/gpt-oss-120b: 14.1s, 5 correctly cross-cutting themes,
//     4 follow-up questions, 61.6 neurons. Picked.
//   - @cf/nvidia/nemotron-3-120b-a12b: 23.3s — 1.7s from the 25s LLM_CALL_MS
//     ceiling on a SMALL 2-source test prompt; the real prompt (up to 12
//     sources) would very plausibly exceed it. Comparable quality, not
//     worth the risk.
//   - @cf/deepseek-ai/deepseek-r1-distill-qwen-32b: newly appeared in the
//     catalog since the 2026-06-10 survey above (wasn't live then). 22.4s
//     (also near the ceiling), only 2 themes and organized BY SOURCE, not
//     by theme — ignored that instruction outright — and 382.7 neurons,
//     ~6x gpt-oss-120b's cost for a comparable-length answer. Worse on
//     every axis.
//   - @cf/meta/llama-4-maverick-17b-128e-instruct-fp8: not on this
//     account ("No such model ... or task").
//
// Full-catalog sweep — 2026-07-24 (81 models live; checked for anything new
// since the 2026-06-10 survey that could beat gpt-oss-120b on this role):
//   - @cf/moonshotai/kimi-k2.7-code (Cloudflare-Pinned, 1T params, 262k
//     context, agentic-focused): 10.8s — notably faster than gpt-oss-120b's
//     14.1s — and correctly theme-organized. But 280.2 neurons vs
//     gpt-oss-120b's 61.6 (~4.5x costlier), and the one test run produced a
//     stray garbled character mid-sentence ("...incident rates阳区..."). One
//     sample isn't enough to convict it, but it's also not enough to trust
//     for unattended published output — genuinely promising, worth a larger
//     multi-run test before ever switching, not switched now.
//   - @cf/zai-org/glm-4.7-flash (also Cloudflare-Pinned): worse on every
//     axis tested — 21.0s (uncomfortably close to the 25s ceiling on this
//     SMALL 2-source prompt; a real 12-source prompt would likely exceed
//     it), only 3 themes vs gpt-oss-120b's 5, and it corrupted "REDD+" into
//     "Redwood+" and repeated the invented term three times. Ruled out.
//   - No other net-new text-generation model in the catalog (glm-5.2,
//     qwen3-30b-a3b-fp8, gpt-oss-20b, granite-4.0-h-micro,
//     mistral-small-3.1-24b-instruct, kimi-k2.6) beat gpt-oss-120b's
//     already-tested profile clearly enough to justify a live test; noted
//     for a future pass if gpt-oss-120b's live output quality regresses.
//   - Separately: bge-m3 / qwen3-embedding-0.6b / embeddinggemma-300m /
//     bge-reranker-base are new embedding/reranking models relevant to
//     Vectorize search quality (a different lever than research_writer,
//     not evaluated here) and whisper-large-v3-turbo is relevant to the
//     video engine's transcription needs — both flagged, neither pursued
//     as part of this sweep.
//   - llama-3.3-70b-instruct-fp8-fast still appears live (not deprecated)
//     in this scrape despite the 2026-06-10 note above claiming it was
//     sunset 2026-05-30 — Cloudflare's own catalog is the discrepancy here,
//     not this router; harmless since nothing routes to it anymore.
//
// To swap any stage to Claude near launch: change `provider` to "anthropic"
// and `model` to the Claude ID. The cost_whitelists table needs a matching
// operation_type entry; see packages/api/src/lib/seed.ts DEFAULT_WHITELISTS.

import type { Env } from "../env";
import { callLLM } from "./index";
import type { LlmCallInput, LlmCallOutput } from "./types";

/** Pipeline stages from canonical-spec v2.4 Part 16. */
export type Role =
  | "bulk_extraction" // entities, attributes, events, neutral facts (high volume)
  | "hard_extraction" // assertions, stance, typed relations, evidential links
  | "surfacing_ambitious" // Level 2 surfacing engine (pattern discovery, ACH)
  | "judge" // independent verification — MUST differ from the generator
  | "large_context" // graph reasoning over very wide context (fallback)
  | "writer" // output drafting: proposals, arrangements, intents, scripts
  | "research_writer"; // deep-research.ts's synthesis writer — see callResearchWriter below

interface RoleConfig {
  provider: "workers_ai" | "anthropic";
  model: string;
  /** Workers AI reasoning_effort dial. Only honored by reasoning models
   *  (gpt-oss family). High effort breaks structural fidelity on bulk
   *  extraction — spec Part 16 rule #1: reasoning effort is a dial, not
   *  a default. */
  reasoning_effort?: "low" | "medium" | "high";
  /** Per-stage operation_type for the cost ledger. The cost-whitelists row
   *  with this exact string governs the spend cap. */
  operation_type: string;
  /** Short description (for diagnostics + this router as documentation). */
  why: string;
}

const ROUTES: Record<Role, RoleConfig> = {
  bulk_extraction: {
    provider: "workers_ai",
    model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    operation_type: "workers_ai.extract.bulk",
    why: "Swapped from gemma-4-26b-a4b-it 2026-07-22 after live production data showed the real failure mode: gemma is a reasoning model that spends most of its budget on reasoning_content before the JSON answer. At the real EXTRACTION_MAX_TOKENS (4000), /v1/admin/debug-model measured gemma taking 22-23s on a realistic ~3000-char chunk — a hair under the 25s LLM_CALL_MS ceiling (a hard Cloudflare Worker wall-clock constraint, not tunable) — and production's digest_jobs/orchestrator_events showed nearly every real chunk (with the fuller BULK_EXTRACTION_PROMPT) actually exceeding it (`extractTypedChunk.bulk[N] exceeded 25000ms`), zeroing the corpus's yield to near-zero facts across 50 documents. A second reasoning model (glm-4.7-flash) measured the same way (~22.6s, even more reasoning tokens) — not an improvement. Scout measured 6.2s on the identical prompt at the identical token budget, non-reasoning, clean JSON, and is already production-verified in this router for the `writer` role. NOTE on history: a 2026-06-10 session tried this same swap and reverted it, citing shallower graphs (entities/facts only, no relations/assertions) versus gemma — that comparison was made before this timeout finding; the hard_extraction pass (gpt-oss-120b, separate call, additive + non-fatal) is what supplies relations/assertions on top of whichever model runs bulk, so the relational-depth tradeoff isn't actually gemma-specific. Re-evaluate if scout's shallower single-pass extraction proves to be a real regression once hard_extraction's own yield is measured against fresh data.",
  },
  hard_extraction: {
    provider: "workers_ai",
    model: "@cf/openai/gpt-oss-120b",
    reasoning_effort: "medium",
    operation_type: "workers_ai.extract.hard",
    why: "Reasoning model dialed to medium for stance/relation extraction — where flat extraction breaks.",
  },
  surfacing_ambitious: {
    provider: "workers_ai",
    model: "@cf/openai/gpt-oss-120b",
    reasoning_effort: "high",
    operation_type: "workers_ai.surfacing.ambitious",
    why: "Same backbone as hard extraction with reasoning dialed up; pattern discovery / ACH-style assessment over a VERIFIED subgraph (spec Part 17).",
  },
  judge: {
    provider: "workers_ai",
    model: "@cf/qwen/qwq-32b",
    operation_type: "workers_ai.judge",
    why: "Independent verification — different family than every generator role. Spec hard constraint Part 10 #4.",
  },
  large_context: {
    provider: "workers_ai",
    model: "@cf/nvidia/nemotron-3-120b-a12b",
    operation_type: "workers_ai.large_context",
    why: "256k context window in + out; fallback for whole-corpus reasoning where chunking would lose signal.",
  },
  writer: {
    provider: "workers_ai",
    model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    operation_type: "workers_ai.writer",
    why: "Output drafting (proposals, arrangements, intents, studio scripts). Scout: fast, non-reasoning, returns parsed-JSON objects — production-verified 2026-06-10. Replaces the retired llama-3.3-70b that buildBrief/composeScript were pinned to. Near launch this single line re-points generation at a frontier model (spec Part 14 #9).",
  },
  research_writer: {
    provider: "workers_ai",
    model: "@cf/openai/gpt-oss-120b",
    reasoning_effort: "medium",
    operation_type: "workers_ai.research_writer",
    why: "deep-research.ts's synthesis writer used to reuse the generic `writer` role (Scout) — fast, but picked for cheap structured extraction, not long-form reasoning; live output read shallow and generic. gpt-oss-120b at medium effort is already production-proven at this exact shape (hard_extraction: 4000 max_tokens, same model, same effort, comfortably inside the 25s-per-call ceiling) — same budget used here. Still Workers AI, still free.",
  },
};

/** Resolve a role to its configured model. Exposed so callers can log /
 *  surface what they actually ran. */
export function modelForRole(role: Role): RoleConfig {
  return ROUTES[role];
}

export interface CallRoleArgs {
  userId: string;
  /** System prompt. */
  system: string;
  /** User messages (single-turn is typical for extraction). */
  messages: LlmCallInput["messages"];
  /** JSON-schema for structured output, or undefined for free-form. */
  response_schema?: Record<string, unknown>;
  /** Output cap. Spec Part 12 reminder: Nemotron is verbose — cap it. */
  max_tokens: number;
  /** Idempotency key for the cost ledger. */
  idempotency_key?: string;
  /**
   * Run this ONE call against a different model than the role names.
   *
   * For comparing models on a real workload without editing the routing
   * table — the AEO pass exposes it as an operator toggle. Everything else
   * about the role still applies, including `operation_type`, so the cost
   * ledger and its whitelist (which key on operation_type, not model) keep
   * working and the spend still lands under the right heading.
   *
   * Not a routing decision. A role's model is the considered choice, made on
   * measurement; this is the instrument you measure WITH. If an override
   * proves better, change the table.
   */
  model?: string;
}

/** Call an LLM by spec-defined ROLE. The router fills in provider, model,
 *  reasoning_effort, and the cost-ledger operation_type. */
export async function callRole(env: Env, role: Role, args: CallRoleArgs): Promise<LlmCallOutput> {
  const cfg = ROUTES[role];
  const input: LlmCallInput = {
    provider: cfg.provider,
    model: args.model ?? cfg.model,
    system: args.system,
    messages: args.messages,
    max_tokens: args.max_tokens,
    response_schema: args.response_schema,
    reasoning_effort: cfg.reasoning_effort,
    ledger: {
      user_id: args.userId,
      operation_type: cfg.operation_type,
      idempotency_key: args.idempotency_key,
    },
  };
  return callLLM(env, input);
}

// Claude model for the research writer when RESEARCH_LLM_PROVIDER=anthropic.
// Sonnet, not Opus/Haiku — the middle tier: this is long-form synthesis
// work, not a cheap classification call, but not worth Opus pricing for a
// research draft the operator still has to review before it's anything.
const RESEARCH_WRITER_ANTHROPIC_MODEL = "claude-sonnet-4-6";

/** deep-research.ts's synthesis writer, toggleable per env — see
 *  env.ts's RESEARCH_LLM_PROVIDER. Deliberately NOT just another ROUTES
 *  entry: a static table can't express "read an env var at call time,"
 *  and every other role has no reason to ever need that. Falls back to
 *  the free `research_writer` role whenever the toggle is off, the
 *  Anthropic key is missing, or (most likely near-term) the cost gate
 *  hasn't been whitelisted for 'anthropic.research_writer' yet — that
 *  last case surfaces as callLLM throwing "Cost gate blocked ... denied
 *  or pending", not a silent fallback, so a flipped-but-unfunded toggle
 *  fails loudly instead of quietly still being free. */
export async function callResearchWriter(env: Env, args: CallRoleArgs): Promise<LlmCallOutput> {
  if (env.RESEARCH_LLM_PROVIDER === "anthropic" && env.ANTHROPIC_API_KEY) {
    const input: LlmCallInput = {
      provider: "anthropic",
      model: RESEARCH_WRITER_ANTHROPIC_MODEL,
      system: args.system,
      messages: args.messages,
      max_tokens: args.max_tokens,
      response_schema: args.response_schema,
      ledger: {
        user_id: args.userId,
        operation_type: "anthropic.research_writer",
        idempotency_key: args.idempotency_key,
      },
    };
    return callLLM(env, input);
  }
  return callRole(env, "research_writer", args);
}
