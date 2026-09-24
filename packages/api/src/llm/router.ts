// Model router — per canonical-spec v2.4 Part 16.
//
// One inference abstraction. The router names PIPELINE STAGES (roles); the
// table below maps each role to a concrete model + parameters, so a stage can
// be re-pointed without touching its call sites, the surfacing engine can
// reuse the extraction backbone with a different reasoning_effort dial, and
// the judge can be pinned to a different family than every generator.
//
// ORDER OF PREFERENCE (docs/the-record.md §3), resolved by preferredProvider():
//   1. Claude through the Worker's AI binding + AI Gateway Unified Billing
//      (provider "claude_gateway", model CLAUDE_MODEL) — when AI_GATEWAY_ID
//      is set. Every role that is a judgement takes it: bulk_extraction,
//      hard_extraction, writer, research_writer, judge, surfacing_ambitious,
//      large_context. Billed to Cloudflare credits; no Anthropic key.
//   2. Otherwise the Workers AI model in ROUTES below, free. Nothing
//      silently downgrades: modelInUse() is what the library header shows.
//   The per-run writer toggle (resolveWriter) keeps its own third rung: a run
//   that asks for "anthropic" gets the gateway if configured, else the direct
//   ANTHROPIC_API_KEY if present, else fails loudly.
//
// Workers AI catalog — what the table pins and why (measured, kept short):
//   - @cf/meta/llama-3.3-70b-instruct-fp8-fast was sunset 2026-05-30; retired.
//   - @cf/google/gemma-4-26b-a4b-it: JSON mode, but a reasoning model — at
//     EXTRACTION_MAX_TOKENS (4000) it measured 22-23s on a ~3000-char chunk,
//     a hair under the 25s LLM_CALL_MS ceiling (a hard Worker wall-clock
//     constraint), and production showed nearly every real chunk exceeding
//     it (`extractTypedChunk.bulk[N] exceeded 25000ms`), zeroing extraction
//     yield across 50 documents. Replaced by Scout for bulk 2026-07-22.
//   - @cf/meta/llama-4-scout-17b-16e-instruct: 6.2s on the identical prompt
//     and budget, non-reasoning, clean JSON. Bulk extraction + writer.
//   - @cf/openai/gpt-oss-120b: 120B MoE / 12B active, reasoning_effort dial.
//     Hard extraction, surfacing, research writer. As research writer
//     (2026-07-24, same brief prompt, max_tokens=4000): 14.1s, 5 correctly
//     cross-cutting themes, 61.6 neurons.
//   - @cf/nvidia/nemotron-3-120b-a12b: 256k context, the large-context
//     fallback. As research writer: 23.3s — 1.7s from the ceiling on a SMALL
//     2-source prompt; a 12-source prompt would plausibly exceed it. Not
//     used for writing.
//   - @cf/qwen/qwq-32b: judge — a different family than every generator.
//   - Ruled out for the research writer, 2026-07-24: deepseek-r1-distill-
//     qwen-32b (22.4s, organised by source not theme, ~6x the cost),
//     glm-4.7-flash (21.0s, 3 themes, corrupted "REDD+" to "Redwood+"),
//     kimi-k2.7-code (10.8s and theme-organised, but ~4.5x the cost and one
//     garbled character mid-sentence in a single sample — promising, retest
//     before ever switching). llama-4-maverick is not on this account.
//   - Also in the catalog but a different lever: bge-m3 / qwen3-embedding /
//     bge-reranker-base (search quality), whisper-large-v3-turbo (video).
//
// Every provider path goes through callLLM's cost ledger. The direct
// Anthropic key needs a cost_whitelists row per operation_type
// (lib/seed.ts DEFAULT_WHITELISTS); Workers AI and the gateway write $0-gated
// rows that still record the model that ran.

import { DEFAULT_CLAUDE_MODEL, type Env } from "../env";
import { callLLM } from "./index";
import type { LlmCallInput, LlmCallOutput, LlmProvider } from "./types";

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
  provider: LlmProvider;
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
 *  surface what they actually ran. Pass `env` to get the model callRole will
 *  ACTUALLY use — Claude when the gateway is configured; without it this is
 *  the static Workers AI table, which is only the truth when it is not. */
export function modelForRole(role: Role, env?: GatewayEnv): RoleConfig {
  const base = ROUTES[role];
  if (!env) return base;
  const pref = preferredProvider(env, role);
  if (pref.provider === base.provider && pref.model === base.model) return base;
  const { reasoning_effort: _dial, ...rest } = base;
  // The reasoning_effort dial is a Workers AI parameter; it does not travel.
  return { ...rest, provider: pref.provider, model: pref.model };
}

/** Which model the Claude gateway runs. CLAUDE_MODEL is the exact name the
 *  gateway lists; the default is one constant in env.ts. */
/** The two settings that decide the transport. Renderers hold a PublicEnv,
 *  not the full Env, so anything that only names the model takes this. */
export type GatewayEnv = Pick<Env, "AI_GATEWAY_ID" | "CLAUDE_MODEL">;

export function claudeGatewayModel(env: GatewayEnv): string {
  const m = env.CLAUDE_MODEL?.trim();
  return m ? m : DEFAULT_CLAUDE_MODEL;
}

export function gatewayConfigured(env: GatewayEnv): boolean {
  return Boolean(env.AI_GATEWAY_ID?.trim());
}

/**
 * The transport a role runs on, for THIS deployment.
 *
 * Every role in ROUTES is a judgement (docs/the-record.md §3: "the bulk IS
 * the judgement"), so all of them take Claude when the gateway is
 * configured; there is no cheap tier kept back for volume. Without a
 * gateway the role's Workers AI entry runs, and `reason` says so in words
 * the library header can print.
 */
export function preferredProvider(
  env: GatewayEnv,
  role: Role = "writer",
): { provider: LlmProvider; model: string; reason: string } {
  if (gatewayConfigured(env)) {
    return {
      provider: "claude_gateway",
      model: claudeGatewayModel(env),
      reason: `AI_GATEWAY_ID is set — Claude (${claudeGatewayModel(env)}) via Cloudflare AI Gateway`,
    };
  }
  const cfg = ROUTES[role];
  return {
    provider: cfg.provider,
    model: cfg.model,
    reason: `AI_GATEWAY_ID is not set — Workers AI ${cfg.model} for ${role}`,
  };
}

/** Short Claude name for a label: "anthropic/claude-opus-4.1" → "opus-4.1". */
function shortClaudeName(model: string): string {
  return model.replace(/^anthropic\//, "").replace(/^claude-/, "");
}

/**
 * One line for the library header: what writes, and whether that is the
 * deployment's intent or its fallback. `configured` is false exactly when
 * the header should say the gateway is missing, so nothing downgrades
 * silently.
 *
 *   "Claude (opus-4.1) via Cloudflare AI Gateway"
 *   "Workers AI gpt-oss-120b — gateway not configured"
 */
export function modelInUse(env: GatewayEnv): {
  label: string;
  provider: string;
  configured: boolean;
} {
  if (gatewayConfigured(env)) {
    return {
      label: `Claude (${shortClaudeName(claudeGatewayModel(env))}) via Cloudflare AI Gateway`,
      provider: "claude_gateway",
      configured: true,
    };
  }
  const fallback = ROUTES.research_writer.model.replace(/^@cf\/[^/]+\//, "");
  return {
    label: `Workers AI ${fallback} — gateway not configured`,
    provider: "workers_ai",
    configured: false,
  };
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
  // An explicit `args.model` is a measurement instrument (see CallRoleArgs)
  // and names a Workers AI model, so it pins the Workers AI transport; an
  // `anthropic/…` override runs through the gateway.
  const chosen = args.model
    ? args.model.startsWith("anthropic/")
      ? { provider: "claude_gateway" as const, model: args.model }
      : { provider: "workers_ai" as const, model: args.model }
    : preferredProvider(env, role);
  const input: LlmCallInput = {
    provider: chosen.provider,
    model: chosen.model,
    system: args.system,
    messages: args.messages,
    max_tokens: args.max_tokens,
    response_schema: args.response_schema,
    reasoning_effort: chosen.provider === "workers_ai" ? cfg.reasoning_effort : undefined,
    ledger: {
      user_id: args.userId,
      // The role's heading, under the provider that actually ran: a Claude
      // call must not be filed as workers_ai.* in the ledger.
      operation_type:
        chosen.provider === "claude_gateway"
          ? cfg.operation_type.replace(/^workers_ai\./, "claude_gateway.")
          : cfg.operation_type,
      idempotency_key: args.idempotency_key,
    },
  };
  return callLLM(env, input);
}

// Claude model for the research writer when RESEARCH_LLM_PROVIDER=anthropic.
// Sonnet, not Opus/Haiku — the middle tier: this is long-form synthesis
// work, not a cheap classification call, but not worth Opus pricing for a
// research draft the operator still has to review before it's anything.
// Opus 5, not Sonnet 4.6 — this was pinned to a model a whole generation old,
// so flipping RESEARCH_LLM_PROVIDER would have bought last year's Claude and
// then been judged as "Claude did not help".
//
// Opus rather than Sonnet because of what this call IS: operator-triggered, a
// handful of times a day, one to three calls per run, and the single output
// the operator has said they do not trust. At roughly 15k input and 4k output
// that is a few cents a run. Quality is the entire point of the toggle; the
// cost gate still bounds it, and it is one constant to change.
const RESEARCH_WRITER_ANTHROPIC_MODEL = "claude-opus-5";

/** The run's stored choice is still the word "anthropic" (research_runs.writer
 *  and the /op/research form both say it); which Claude transport that means
 *  is decided here, so the provider resolved can be any of the three. */
export type WriterProvider = LlmProvider;

/** "anthropic" as a run choice means Claude by whichever transport this
 *  deployment has: the gateway first (no key needed), else the direct key,
 *  else nothing — with the reason the caller should print. */
function claudeTransport(
  env: Env,
): { provider: WriterProvider; model: string } | { provider: null; missing: string } {
  if (gatewayConfigured(env)) {
    return { provider: "claude_gateway", model: claudeGatewayModel(env) };
  }
  if (env.ANTHROPIC_API_KEY) {
    return { provider: "anthropic", model: RESEARCH_WRITER_ANTHROPIC_MODEL };
  }
  return {
    provider: null,
    missing: "AI_GATEWAY_ID is not set and ANTHROPIC_API_KEY is not set",
  };
}

/**
 * Which model writes, for THIS run.
 *
 * Three tiers, most specific wins:
 *   1. the run's own choice (`requested`) — the per-run toggle
 *   2. the deployment default (the gateway when configured, else
 *      RESEARCH_LLM_PROVIDER=anthropic with a key)
 *   3. Workers AI, free
 *
 * A run that ASKED for Claude and cannot have it fails loudly here rather
 * than quietly getting the free writer. The operator ticked a box expecting
 * a particular model; silently substituting another is how "Claude did not
 * help" gets concluded from output Claude never wrote.
 */
export function resolveWriter(
  env: Env,
  requested?: string | null,
): {
  provider: WriterProvider;
  model: string;
} {
  if (requested === "anthropic") {
    const claude = claudeTransport(env);
    if (claude.provider === null) {
      throw new Error(
        `Claude was chosen for this run, but ${claude.missing} — nothing was written`,
      );
    }
    return claude;
  }
  if (requested === "workers_ai") {
    return { provider: "workers_ai", model: ROUTES.research_writer.model };
  }
  if (gatewayConfigured(env)) {
    return { provider: "claude_gateway", model: claudeGatewayModel(env) };
  }
  if (env.RESEARCH_LLM_PROVIDER === "anthropic" && env.ANTHROPIC_API_KEY) {
    return { provider: "anthropic", model: RESEARCH_WRITER_ANTHROPIC_MODEL };
  }
  return { provider: "workers_ai", model: ROUTES.research_writer.model };
}

/** deep-research.ts's synthesis writer and answer-lead.ts's settler.
 *  Deliberately NOT just another ROUTES entry: a static table cannot express
 *  "decided per run". The cost gate still applies to the direct-key path — a
 *  chosen-but-unwhitelisted 'anthropic.research_writer' surfaces as callLLM
 *  throwing "Cost gate blocked", never as a silent fallback. */
export async function callResearchWriter(
  env: Env,
  args: CallRoleArgs,
  opts: { writer?: string | null } = {},
): Promise<LlmCallOutput> {
  const chosen = resolveWriter(env, opts.writer);
  if (chosen.provider === "workers_ai") {
    if (!gatewayConfigured(env)) return callRole(env, "research_writer", args);
    // The run chose Workers AI over a configured gateway; callRole would
    // re-run preferredProvider, so pin the free model explicitly.
    return callRole(env, "research_writer", { ...args, model: chosen.model });
  }
  // The direct key is whitelisted under 'anthropic.research_writer'; the
  // gateway writes a $0-gated row under its own heading so the two never
  // share a spend cap or a receipt.
  const ledger: LlmCallInput["ledger"] =
    chosen.provider === "anthropic"
      ? {
          user_id: args.userId,
          operation_type: "anthropic.research_writer",
          idempotency_key: args.idempotency_key,
        }
      : {
          user_id: args.userId,
          operation_type: "claude_gateway.research_writer",
          idempotency_key: args.idempotency_key,
        };
  const input: LlmCallInput = {
    provider: chosen.provider,
    model: chosen.model,
    system: args.system,
    messages: args.messages,
    max_tokens: args.max_tokens,
    response_schema: args.response_schema,
    ledger,
  };
  return callLLM(env, input);
}
