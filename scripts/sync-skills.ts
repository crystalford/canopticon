#!/usr/bin/env node
// scripts/sync-skills.ts
//
// Reads packages/shared/skills/<name>/SKILL.md (and schema.json if present)
// and updates the corresponding role_definitions rows in Supabase.
//
// Sprint 1 single-tenant assumption: one user has customized prompts (none
// of them, since customization isn't a thing yet). The script blanket-
// updates ALL role_definitions rows for each role across all users.
// When per-user customization arrives, this script grows a "skip if
// skill_md_hash differs from previous canonical" check.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm sync-skills
//
// Required env:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// Optional:
//   DRY_RUN=1   — print what would change, don't write
//   ROLE=name   — sync just one role (snake_case name)

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadSkill } from "../packages/shared/src/skills/loader/load.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = resolve(here, "../packages/shared/skills");

interface CliOptions {
  dryRun: boolean;
  filterRole: string | null;
}

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`error: ${name} is required`);
    process.exit(2);
  }
  return value;
}

function parseOptions(): CliOptions {
  return {
    dryRun: process.env.DRY_RUN === "1",
    filterRole: process.env.ROLE ?? null,
  };
}

async function main() {
  const opts = parseOptions();
  const url = readEnv("SUPABASE_URL");
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (opts.dryRun) console.log("DRY_RUN=1 — no writes will be performed");

  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  let synced = 0;
  let skipped = 0;
  for (const dir of dirs) {
    const skillPath = resolve(SKILLS_DIR, dir, "SKILL.md");
    if (!(await exists(skillPath))) {
      console.warn(`! ${dir}/ has no SKILL.md, skipping`);
      skipped++;
      continue;
    }
    const skill = await loadSkill(skillPath);
    if (opts.filterRole && skill.name !== opts.filterRole) {
      skipped++;
      continue;
    }

    const schemaPath = resolve(SKILLS_DIR, dir, "schema.json");
    let outputSchema: unknown = null;
    if (await exists(schemaPath)) {
      try {
        outputSchema = JSON.parse(await readFile(schemaPath, "utf8"));
      } catch (err) {
        console.error(`! ${dir}/schema.json failed to parse: ${(err as Error).message}`);
        process.exit(1);
      }
    }

    const update = {
      prompt_template: skill.prompt,
      default_model: skill.frontmatter.model,
      uses_citations_api: skill.frontmatter.features.citations_api,
      uses_structured_output: skill.frontmatter.features.structured_output,
      output_schema: outputSchema,
      skill_md_hash: skill.hash,
    };

    if (opts.dryRun) {
      console.log(`would update role_definitions WHERE name = ${skill.name}`);
      console.log(`  hash:   ${skill.hash.slice(0, 16)}…`);
      console.log(`  model:  ${update.default_model}`);
      console.log(`  prompt: ${skill.prompt.length} chars`);
      synced++;
      continue;
    }

    const { error, count } = await client
      .from("role_definitions")
      .update(update, { count: "exact" })
      .eq("name", skill.name);
    if (error) {
      console.error(`! failed to sync ${skill.name}: ${error.message}`);
      process.exit(1);
    }
    console.log(`✓ ${skill.name} → ${count ?? 0} row(s) updated, hash ${skill.hash.slice(0, 8)}`);
    synced++;
  }

  console.log(`\n${synced} synced, ${skipped} skipped`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
