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
    // Llama 3.3 70B — Cloudflare's own JSON-mode-supported model (and what
    // backs Browser Rendering's /json endpoint). Scout was silently dropping
    // response_format because it's not on the json-mode list (per
    // cloudflare-docs#27786). 70B was previously suspected of hanging the
    // Worker, but that was before MAX_CHUNKS=3 + the cron drain landed —
    // a slow call now fails its chunk and is retried idempotently.
    name: "claim_extraction",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    allow_anthropic_override: 1,
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
  // Canonical-spec v2.4 Part 16 router roles. All Workers AI = free.
  {
    operation_type: "workers_ai.extract.bulk",
    enabled: true,
    per_op_max_cents: 0,
    daily_max_cents: null,
    monthly_max_cents: null,
    notes: "router role: bulk extraction (Gemma 4 26B A4B)",
  },
  {
    operation_type: "workers_ai.extract.hard",
    enabled: true,
    per_op_max_cents: 0,
    daily_max_cents: null,
    monthly_max_cents: null,
    notes: "router role: hard extraction (gpt-oss-120b medium effort)",
  },
  {
    operation_type: "workers_ai.surfacing.ambitious",
    enabled: true,
    per_op_max_cents: 0,
    daily_max_cents: null,
    monthly_max_cents: null,
    notes: "router role: Surfacing Engine Level 2 (gpt-oss-120b high effort)",
  },
  {
    operation_type: "workers_ai.judge",
    enabled: true,
    per_op_max_cents: 0,
    daily_max_cents: null,
    monthly_max_cents: null,
    notes: "router role: independent judge (qwq-32b)",
  },
  {
    operation_type: "workers_ai.large_context",
    enabled: true,
    per_op_max_cents: 0,
    daily_max_cents: null,
    monthly_max_cents: null,
    notes: "router role: large-context fallback (Nemotron 3 Super 120B, 256k window)",
  },
  {
    operation_type: "workers_ai.extract.image",
    enabled: true,
    per_op_max_cents: 0,
    daily_max_cents: null,
    monthly_max_cents: null,
    notes: "free image OCR",
  },
  // Studio Stage B/C model whitelist (v2.6 Part 27). Disabled by default
  // until the production pipelines land; the cost ledger row is here so
  // when Stage B / Stage C ship there's a known operation_type to bill
  // against.
  {
    operation_type: "workers_ai.studio.voice_clone",
    enabled: false,
    per_op_max_cents: 5,
    daily_max_cents: 100,
    monthly_max_cents: 1000,
    notes: "Studio Stage B: MiniMax Speech 2.8 HD voice cloning + narration",
  },
  {
    operation_type: "workers_ai.studio.voice_turbo",
    enabled: false,
    per_op_max_cents: 2,
    daily_max_cents: 50,
    monthly_max_cents: 500,
    notes: "Studio Stage B: MiniMax Speech 2.8 Turbo for fast iteration drafts",
  },
  {
    operation_type: "workers_ai.studio.image_still",
    enabled: false,
    per_op_max_cents: 1,
    daily_max_cents: 50,
    monthly_max_cents: 500,
    notes: "Studio Stage C: Flux 1 Schnell — per-beat still images for video pipeline",
  },
  {
    operation_type: "workers_ai.studio.video_animate",
    enabled: false,
    per_op_max_cents: 25,
    daily_max_cents: 500,
    monthly_max_cents: 4000,
    notes: "Studio Stage C: Alibaba Wan 2.7 — per-beat still → 5–10s clip animation",
  },
  // Anthropic overrides — tight caps; only used when operator opts a role into Claude.
  {
    operation_type: "anthropic.role.claim_extraction",
    enabled: true,
    per_op_max_cents: 20,
    daily_max_cents: 300,
    monthly_max_cents: 4000,
    notes: "opt-in Claude for claim extraction (per-chunk; mind the daily cap on big PDFs)",
  },
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

  for (const m of DEFAULT_MONITORS) {
    await insertOne(db, "monitors", { user_id: userId, ...m });
  }

  return userId;
}

// Initial monitor cluster — the apex of the pyramid. Both run weekly
// (Mondays 12:00 UTC) and use the same agent loop; only their source URL
// and scout prompt differ. Add more here as the cluster expands.
const DEFAULT_MONITORS: Array<{
  name: string;
  tier: number;
  source_url: string;
  cadence_cron: string;
  scout_prompt: string;
}> = [
  {
    name: "BIS Global Economy Meeting",
    tier: 1,
    source_url: "https://www.bis.org/press/index.htm",
    cadence_cron: "0 12 * * 1",
    scout_prompt: `Look for the most recent BIS Global Economy Meeting readout — the bimonthly meeting of ~60 central bank governors in Basel. The title will contain "Governors" or "central banks meet" and the readout is short (2-3 paragraphs). The meeting happens approximately every two months (Jan/Mar/May/Jul/Sep/Nov), so most weeks there will be nothing new.

If you find a new readout:
1. Fetch its full text.
2. Compare its language to the prior readout from the same series (search_substrate for "BIS Governors" sorted by date).
3. In your note_finding summary, call out: which topics they say they discussed; which specific phrases are new vs the prior readout; which prior phrases dropped; whether they highlight any specific concern ("sovereign debt markets", "operational framework", "macroprudential tools", "non-bank financial intermediation", "transition finance", etc.). The vocabulary itself is the signal.

Set source_type="report" on create_source. Set authors=["Bank for International Settlements"].`,
  },
  {
    name: "FSB Chair correspondence",
    tier: 1,
    source_url: "https://www.fsb.org/correspondence",
    cadence_cron: "0 12 * * 1",
    scout_prompt: `Look for the most recent letter from the FSB Chair to G20 Finance Ministers. These appear ~4 times a year around G20 Finance Ministers meetings. The author currently is Andrew Bailey.

If you find a new letter:
1. Fetch its full text.
2. Compare to the prior letter in this series (search_substrate for "FSB Chair letter G20" sorted by date).
3. In your note_finding summary, call out: which workstreams the Chair highlights; new workstream names (e.g. "transition finance", "climate-related financial risks", "crypto-asset markets", "non-bank financial intermediation"); any mention of "defence finance" or "security and resilience" (significant — would be a new direction); changes in framing or priority order vs the prior letter.

Set source_type="filing" on create_source. Set authors=["Financial Stability Board"].`,
  },
];

/** Look up the operator's user_id by email, seeding if absent. */
export async function getOrSeedOperator(db: D1Database, email: string): Promise<string> {
  const existing = await one<{ id: string }>(db, "SELECT id FROM users WHERE email = ?", [email]);
  if (existing) return existing.id;
  return seedOperator(db, email);
}

/** Lightweight no-op so trees that referenced now() keep typechecking. */
export const _seedNow = nowIso;
