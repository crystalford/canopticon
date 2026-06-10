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
  | "large_context"; // graph reasoning over very wide context (fallback)

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
    why: "Fast non-reasoning extractor that returns clean parsed-JSON in `response`. Replaced gemma-4-26b-a4b, a REASONING model that burned the token budget on chain-of-thought and TRUNCATED the JSON answer (verified 2026-06-10 via /v1/admin/debug-model: gemma finish_reason='length' with cut-off content at ~4s; scout returned a complete parsed object in 754ms).",
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
}

/** Call an LLM by spec-defined ROLE. The router fills in provider, model,
 *  reasoning_effort, and the cost-ledger operation_type. */
export async function callRole(env: Env, role: Role, args: CallRoleArgs): Promise<LlmCallOutput> {
  const cfg = ROUTES[role];
  const input: LlmCallInput = {
    provider: cfg.provider,
    model: cfg.model,
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
