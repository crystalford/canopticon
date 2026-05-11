// First-sign-in seeding for the single operator.
//
// D1 has no auth.users trigger. The Worker calls this from
// requireAuth() when it sees a request for an email that doesn't yet
// have a users row.

import { insertOne, nowIso, one } from "./d1.ts";

const REQUIRED_ROLE_NAMES = [
  "ingestion_critic",
  "verifier",
  "interrogator",
  "red_team",
  "steelman",
  "premortem",
  "gap_surfacer",
  "calibration",
  "tier_projector",
  "assumption_auditor",
  "indicator_validator",
  "novelty_surfacer",
  "claim_extraction",
  "entity_resolver",
  "claim_deduplicator",
  "solution_inventory_builder",
  "argument_mapper",
  "genealogy_tracer",
];

const DEFAULT_WHITELISTS: Array<{
  operation_type: string;
  enabled: boolean;
  per_op_max_cents: number | null;
  daily_max_cents: number | null;
  monthly_max_cents: number | null;
  notes: string;
}> = [
  {
    operation_type: "anthropic_role.ingestion_critic",
    enabled: true,
    per_op_max_cents: 5,
    daily_max_cents: 100,
    monthly_max_cents: 2000,
    notes: "auto-approve grading",
  },
  {
    operation_type: "anthropic_role.claim_extraction",
    enabled: true,
    per_op_max_cents: 10,
    daily_max_cents: 200,
    monthly_max_cents: 3000,
    notes: "auto-approve claim extraction",
  },
  {
    operation_type: "anthropic_role.entity_resolver",
    enabled: true,
    per_op_max_cents: 5,
    daily_max_cents: 100,
    monthly_max_cents: 1500,
    notes: "auto-approve ER",
  },
  {
    operation_type: "anthropic_role.claim_deduplicator",
    enabled: true,
    per_op_max_cents: 5,
    daily_max_cents: 100,
    monthly_max_cents: 1500,
    notes: "auto-approve dedup",
  },
  {
    operation_type: "anthropic_role.tier_projector",
    enabled: true,
    per_op_max_cents: 25,
    daily_max_cents: 300,
    monthly_max_cents: 4000,
    notes: "tier regen each cascade",
  },
  {
    operation_type: "anthropic_role.indicator_validator",
    enabled: true,
    per_op_max_cents: 5,
    daily_max_cents: 50,
    monthly_max_cents: 500,
    notes: "cheap validation",
  },
  {
    operation_type: "anthropic_role.calibration",
    enabled: true,
    per_op_max_cents: 10,
    daily_max_cents: 100,
    monthly_max_cents: 1000,
    notes: "nightly Brier sweep",
  },
  {
    operation_type: "transcription_assemblyai",
    enabled: false,
    per_op_max_cents: null,
    daily_max_cents: null,
    monthly_max_cents: null,
    notes: "operator approval required",
  },
  {
    operation_type: "anthropic_role.solution_inventory_builder",
    enabled: false,
    per_op_max_cents: null,
    daily_max_cents: null,
    monthly_max_cents: null,
    notes: "operator-invoked",
  },
  {
    operation_type: "anthropic_role.argument_mapper",
    enabled: false,
    per_op_max_cents: null,
    daily_max_cents: null,
    monthly_max_cents: null,
    notes: "operator-invoked",
  },
  {
    operation_type: "anthropic_role.genealogy_tracer",
    enabled: false,
    per_op_max_cents: null,
    daily_max_cents: null,
    monthly_max_cents: null,
    notes: "operator-invoked",
  },
];

/** Ensure a users row exists for the given email, plus 18 role_definitions
 *  and the default cost-whitelist rules. Idempotent. */
export async function seedOperator(db: D1Database, email: string): Promise<string> {
  const existing = await one<{ id: string }>(db, "SELECT id FROM users WHERE email = ?", [email]);
  if (existing) return existing.id;

  const userId = await insertOne(db, "users", { email });

  for (const name of REQUIRED_ROLE_NAMES) {
    await insertOne(db, "role_definitions", {
      user_id: userId,
      name,
      prompt_template: `<see packages/shared/skills/${name.replace(/_/g, "-")}/SKILL.md — run pnpm sync-skills>`,
    });
  }

  for (const w of DEFAULT_WHITELISTS) {
    await insertOne(db, "cost_whitelists", { user_id: userId, ...w });
  }

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
