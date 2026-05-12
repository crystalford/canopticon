// First-sign-in seeding for the single operator.
//
// D1 has no auth.users trigger. The Worker calls this from
// requireAuth() when it sees a request for an email that doesn't yet
// have a users row.

import { insertOne, nowIso, one, run } from "./d1.ts";

// Per-role default tier — free-first Workers AI for every role. The
// operator can flip a role to Anthropic from the System screen if the
// global Anthropic toggle is on AND allow_anthropic_override=1 below.
//
// Models:
//   - llama-4-scout: long-context writer; multimodal for PDF intake
//   - llama-3.3-70b: reliable tool/decision calls
//   - qwq-32b:      reasoning chains (red team, calibration, etc.)
const ROLE_DEFAULTS: Array<{ name: string; model: string; allow_anthropic_override: number }> = [
  // Writing / multimodal extraction
  {
    name: "ingestion_critic",
    model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    allow_anthropic_override: 0,
  },
  {
    name: "claim_extraction",
    model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    allow_anthropic_override: 0,
  },
  {
    name: "argument_mapper",
    model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    allow_anthropic_override: 0,
  },
  {
    name: "tier_projector",
    model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    allow_anthropic_override: 1,
  },
  {
    name: "solution_inventory_builder",
    model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    allow_anthropic_override: 0,
  },
  {
    name: "interrogator",
    model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    allow_anthropic_override: 0,
  },
  {
    name: "gap_surfacer",
    model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    allow_anthropic_override: 0,
  },
  {
    name: "genealogy_tracer",
    model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    allow_anthropic_override: 1,
  },
  // Deterministic decisions
  {
    name: "entity_resolver",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    allow_anthropic_override: 0,
  },
  {
    name: "claim_deduplicator",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    allow_anthropic_override: 0,
  },
  {
    name: "indicator_validator",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    allow_anthropic_override: 0,
  },
  // Reasoning
  { name: "novelty_surfacer", model: "@cf/qwen/qwq-32b", allow_anthropic_override: 0 },
  { name: "red_team", model: "@cf/qwen/qwq-32b", allow_anthropic_override: 0 },
  { name: "steelman", model: "@cf/qwen/qwq-32b", allow_anthropic_override: 0 },
  { name: "premortem", model: "@cf/qwen/qwq-32b", allow_anthropic_override: 0 },
  { name: "assumption_auditor", model: "@cf/qwen/qwq-32b", allow_anthropic_override: 0 },
  { name: "verifier", model: "@cf/qwen/qwq-32b", allow_anthropic_override: 1 },
  { name: "calibration", model: "@cf/qwen/qwq-32b", allow_anthropic_override: 0 },
];

// Workers AI is free — auto-approve every workers_ai.* operation. The
// per_op cap is symbolic ($0). Anthropic overrides keep tight caps in
// case the operator flips a role to Claude.
const DEFAULT_WHITELISTS: Array<{
  operation_type: string;
  enabled: boolean;
  per_op_max_cents: number | null;
  daily_max_cents: number | null;
  monthly_max_cents: number | null;
  notes: string;
}> = [
  // Workers AI buckets — all free, auto-approved.
  {
    operation_type: "workers_ai.chat",
    enabled: true,
    per_op_max_cents: 0,
    daily_max_cents: null,
    monthly_max_cents: null,
    notes: "free chat",
  },
  {
    operation_type: "workers_ai.embed",
    enabled: true,
    per_op_max_cents: 0,
    daily_max_cents: null,
    monthly_max_cents: null,
    notes: "free embeddings",
  },
  {
    operation_type: "workers_ai.extract.pdf",
    enabled: true,
    per_op_max_cents: 0,
    daily_max_cents: null,
    monthly_max_cents: null,
    notes: "free PDF extraction",
  },
  {
    operation_type: "workers_ai.extract.image",
    enabled: true,
    per_op_max_cents: 0,
    daily_max_cents: null,
    monthly_max_cents: null,
    notes: "free image OCR",
  },
  // Anthropic overrides — tight caps; only used when operator opts a role into Claude.
  {
    operation_type: "anthropic.role.tier_projector",
    enabled: true,
    per_op_max_cents: 25,
    daily_max_cents: 300,
    monthly_max_cents: 4000,
    notes: "opt-in Claude for briefs",
  },
  {
    operation_type: "anthropic.role.genealogy_tracer",
    enabled: true,
    per_op_max_cents: 30,
    daily_max_cents: 200,
    monthly_max_cents: 2000,
    notes: "opt-in Claude for genealogy essays",
  },
  {
    operation_type: "anthropic.role.verifier",
    enabled: true,
    per_op_max_cents: 15,
    daily_max_cents: 150,
    monthly_max_cents: 1500,
    notes: "opt-in Claude for citations",
  },
];

/** Ensure a users row exists for the given email, plus 18 role_definitions
 *  and the default cost-whitelist rules. Idempotent. */
export async function seedOperator(db: D1Database, email: string): Promise<string> {
  const existing = await one<{ id: string }>(db, "SELECT id FROM users WHERE email = ?", [email]);
  if (existing) return existing.id;

  const userId = await insertOne(db, "users", { email });

  for (const role of ROLE_DEFAULTS) {
    await insertOne(db, "role_definitions", {
      user_id: userId,
      name: role.name,
      provider: "workers_ai",
      model: role.model,
      allow_anthropic_override: role.allow_anthropic_override,
      prompt_template: `<see packages/shared/skills/${role.name.replace(/_/g, "-")}/SKILL.md — run pnpm sync-skills>`,
    });
  }

  for (const w of DEFAULT_WHITELISTS) {
    await insertOne(db, "cost_whitelists", { user_id: userId, ...w });
  }

  await run(db, "INSERT OR IGNORE INTO user_ai_prefs (user_id) VALUES (?)", [userId]);

  return userId;
}

/** Look up the operator's user_id by email, seeding if absent. */
export async function getOrSeedOperator(db: D1Database, email: string): Promise<string> {
  const existing = await one<{ id: string }>(db, "SELECT id FROM users WHERE email = ?", [email]);
  if (existing) return existing.id;
  return seedOperator(db, email);
}

/** Lightweight no-op so trees that referenced now() keep typechecking. */
export const _seedNow = nowIso;
