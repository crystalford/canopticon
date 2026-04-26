#!/usr/bin/env node
// scripts/smoke.ts
//
// Verifies a fresh Supabase deployment has the substrate the new build expects.
// No Anthropic spend; only runs SELECT/HEAD queries via service role.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm smoke

import { createClient } from "@supabase/supabase-js";

interface Check {
  name: string;
  run: () => Promise<string | null>;
}

const REQUIRED_TABLES = [
  // 0002 users + cost
  "users",
  "cost_ledger",
  "cost_whitelists",
  "cost_approvals",
  // 0003 sources
  "sources",
  "ingestion_critic_reports",
  "ingestion_actions",
  // 0004 entities
  "entities",
  "entity_mentions",
  "entity_relations",
  "entity_resolution_log",
  "entity_merge_history",
  "entity_resolution_queue",
  // 0005 claims
  "claims",
  "claim_versions",
  "claim_entities",
  "claim_sources",
  "claim_relations",
  "claim_deduplication_queue",
  // 0006 theses
  "theses",
  "thesis_versions",
  "thesis_claims",
  "thesis_watch_sets",
  "thesis_concept_spine",
  "thesis_inbox",
  "coined_phrase_first_uses",
  // 0007 falsifiability
  "assumptions",
  "assumption_supporting_claims",
  "indicators",
  "indicator_observations",
  "predictions",
  "contradictions",
  // 0008 intellectual output
  "five_whys_chains",
  "five_whys_levels",
  "solution_inventories",
  "solution_entries",
  "argument_maps",
  "argument_layers",
  "frame_genealogies",
  "frame_propagation_events",
  // 0009 articles + books
  "articles",
  "article_versions",
  "article_claims",
  "article_corrections",
  "books",
  "book_chapters",
  // 0010 productions
  "productions",
  "scripts",
  "beats",
  "production_publishes",
  "production_perf",
  // 0011 questions
  "questions",
  "question_dependencies",
  // 0012 adversarial
  "red_team_objections",
  "premortem_reports",
  "gap_surfacer_reports",
  // 0013 role runtime
  "role_definitions",
  "role_invocations",
  "cascade_runs",
  "workflow_runs",
  "orchestrator_events",
  // 0014 public cache
  "pub_articles_cache",
  "pub_theses_cache",
  "pub_predictions_cache",
  "pub_contradictions_cache",
  "pub_entities_cache",
  "pub_sources_cache",
  "pub_claims_cache",
  "pub_subscriptions",
];

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
        return error ? `failed to query users: ${error.message}` : null;
      },
    },
    {
      name: `All ${REQUIRED_TABLES.length} expected tables exist`,
      run: async () => {
        const missing: string[] = [];
        for (const t of REQUIRED_TABLES) {
          const { error } = await client.from(t).select("*", { head: true, count: "exact" });
          if (
            error &&
            (error.message.includes("does not exist") ||
              error.message.includes("Could not find the table") ||
              error.code === "42P01")
          ) {
            missing.push(t);
          }
        }
        if (missing.length > 0) {
          return `${missing.length} tables missing: ${missing.join(", ")} — did you run \`supabase db push\`?`;
        }
        return null;
      },
    },
    {
      name: "All 18 role_definitions seeded for at least one user",
      run: async () => {
        const { data: users } = await client.from("users").select("id").limit(1);
        if (!users || users.length === 0) {
          return "no users yet — sign in once before running smoke against role_definitions";
        }
        const userId = (users[0] as { id: string }).id;
        const { data, error } = await client
          .from("role_definitions")
          .select("name")
          .eq("user_id", userId);
        if (error) return `query failed: ${error.message}`;
        const present = new Set((data ?? []).map((r) => (r as { name: string }).name));
        const missing = REQUIRED_ROLE_NAMES.filter((n) => !present.has(n));
        if (missing.length > 0) {
          return `${missing.length} role_definitions missing: ${missing.join(", ")}`;
        }
        return null;
      },
    },
    {
      name: "Skill prompts have been synced (no placeholders)",
      run: async () => {
        const { data, error } = await client
          .from("role_definitions")
          .select("name")
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
      name: "Cost gate ready (whitelists seeded, ledger queryable)",
      run: async () => {
        const { error: lErr } = await client
          .from("cost_ledger")
          .select("id", { head: true, count: "exact" });
        if (lErr) return `cost_ledger query failed: ${lErr.message}`;
        const { error: wErr } = await client
          .from("cost_whitelists")
          .select("id", { head: true, count: "exact" });
        if (wErr) return `cost_whitelists query failed: ${wErr.message}`;
        return null;
      },
    },
    {
      name: "Public cache tables present",
      run: async () => {
        const tables = [
          "pub_articles_cache",
          "pub_theses_cache",
          "pub_predictions_cache",
          "pub_contradictions_cache",
        ];
        for (const t of tables) {
          const { error } = await client.from(t).select("*", { head: true, count: "exact" });
          if (error) return `${t} not queryable: ${error.message}`;
        }
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
