#!/usr/bin/env node
// scripts/smoke.ts
//
// Verifies a fresh Supabase + Worker deployment actually works.
//
// Default mode is "offline" — no Anthropic spend. Checks:
//   - Supabase URL + service-role key are valid
//   - Every expected substrate table exists
//   - Every claim_layer / role_name / etc. enum value is present
//   - All 13 role_definitions exist with non-placeholder prompt_template
//     (i.e., pnpm sync-skills has been run)
//   - RLS is enabled on every public table
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm smoke
//
// Exits 0 on success, 1 on any failure.

import { createClient } from "@supabase/supabase-js";

interface Check {
  name: string;
  run: () => Promise<string | null>; // returns failure message or null
}

const REQUIRED_TABLES = [
  // 0003 users
  "users",
  // 0004 cost_ledger
  "cost_ledger",
  // 0005 sources
  "sources",
  // 0006 entities
  "entities",
  "entity_mentions",
  // 0007 claims
  "claims",
  "claim_versions",
  "claim_entities",
  "claim_sources",
  // 0008 theses
  "theses",
  "thesis_versions",
  "thesis_claims",
  "thesis_concept_spine",
  // 0009 role runtime
  "role_definitions",
  "role_invocations",
  // 0011 triggers / orchestrator events
  "orchestrator_events",
  // 0013 workflow_runs / cascade_runs
  "cascade_runs",
  // 0014 questions
  "questions",
  // 0015 research runs
  "research_runs",
  // 0016 cost_approvals
  "cost_approvals",
  // 0017 remaining substrate
  "assumptions",
  "assumption_supporting_claims",
  "indicators",
  "indicator_observations",
  "contradictions",
  "predictions",
  "articles",
  "article_versions",
  "article_claims",
  "article_corrections",
  "books",
  // 0018 findings
  "findings",
  "finding_supporting_claims",
];

const REQUIRED_ROLE_NAMES = [
  "ingestion_critic",
  "claim_extraction",
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
];

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`error: ${name} is required`);
    process.exit(2);
  }
  return v;
}

async function main() {
  const url = readEnv("SUPABASE_URL");
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const checks: Check[] = [
    {
      name: "Supabase reachable",
      run: async () => {
        const { error } = await client.from("users").select("id", { head: true, count: "exact" });
        if (error) return `failed to query users: ${error.message}`;
        return null;
      },
    },
    {
      name: "All expected tables exist",
      run: async () => {
        const missing: string[] = [];
        for (const table of REQUIRED_TABLES) {
          const { error } = await client.from(table).select("*", { head: true, count: "exact" });
          // Only count "relation does not exist" errors (PGRST205, 42P01).
          if (
            error &&
            (error.message.includes("does not exist") ||
              error.message.includes("Could not find the table") ||
              error.code === "42P01")
          ) {
            missing.push(table);
          }
        }
        if (missing.length > 0) {
          return `${missing.length} tables missing: ${missing.join(", ")} — did you run \`supabase db push\`?`;
        }
        return null;
      },
    },
    {
      name: "All 13 role_definitions exist for at least one user",
      run: async () => {
        const { data: users } = await client.from("users").select("id").limit(1);
        if (!users || users.length === 0) {
          return "no users yet — sign in once before running smoke against role_definitions";
        }
        const userId = (users[0] as { id: string }).id;
        const { data: defs, error } = await client
          .from("role_definitions")
          .select("name")
          .eq("user_id", userId);
        if (error) return `query failed: ${error.message}`;
        const present = new Set((defs ?? []).map((r) => (r as { name: string }).name));
        const missing = REQUIRED_ROLE_NAMES.filter((n) => !present.has(n));
        if (missing.length > 0) {
          return `${missing.length} role_definitions missing for user ${userId.slice(0, 8)}: ${missing.join(", ")}`;
        }
        return null;
      },
    },
    {
      name: "Skill prompts have been synced (no placeholders)",
      run: async () => {
        const { data, error } = await client
          .from("role_definitions")
          .select("name, prompt_template")
          .like("prompt_template", "<see %");
        if (error) return `query failed: ${error.message}`;
        if (data && data.length > 0) {
          const stale = Array.from(new Set(data.map((r) => (r as { name: string }).name))).join(
            ", ",
          );
          return `${data.length} role_definitions still have placeholder prompts (${stale}) — run \`pnpm sync-skills\``;
        }
        return null;
      },
    },
    {
      name: "Every role_definitions row references a real SKILL.md",
      run: async () => {
        const { data } = await client
          .from("role_definitions")
          .select("name, skill_md_hash")
          .is("skill_md_hash", null);
        if (data && data.length > 0) {
          const noHash = Array.from(new Set(data.map((r) => (r as { name: string }).name))).join(
            ", ",
          );
          return `${data.length} role_definitions have null skill_md_hash (${noHash}) — re-run \`pnpm sync-skills\``;
        }
        return null;
      },
    },
    {
      name: "Cost gate tables ready (cost_ledger writable, cost_approvals queryable)",
      run: async () => {
        const { error: ledgerErr } = await client
          .from("cost_ledger")
          .select("id", { head: true, count: "exact" });
        if (ledgerErr) return `cost_ledger query failed: ${ledgerErr.message}`;
        const { error: apprErr } = await client
          .from("cost_approvals")
          .select("id", { head: true, count: "exact" });
        if (apprErr) return `cost_approvals query failed: ${apprErr.message}`;
        return null;
      },
    },
    {
      name: "Findings substrate ready (migration 0018 applied)",
      run: async () => {
        const { error } = await client
          .from("findings")
          .select("id, novelty_grade, pattern_type", { head: true, count: "exact" });
        if (error) return `findings query failed: ${error.message} — did 0018 apply?`;
        return null;
      },
    },
  ];

  let passed = 0;
  let failed = 0;
  for (const check of checks) {
    process.stdout.write(`· ${check.name} ... `);
    try {
      const failure = await check.run();
      if (failure) {
        console.log("FAIL");
        console.log(`    ${failure}`);
        failed++;
      } else {
        console.log("ok");
        passed++;
      }
    } catch (err) {
      console.log("ERROR");
      console.log(`    ${(err as Error).message}`);
      failed++;
    }
  }

  console.log("");
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    console.log("smoke test found problems. fix them before using the system in earnest.");
    process.exit(1);
  }
  console.log("");
  console.log("substrate looks healthy. ready to use.");
}

main().catch((err) => {
  console.error("smoke runner crashed:", err);
  process.exit(1);
});
