#!/usr/bin/env node
// scripts/sync-skills.ts
//
// Reads packages/shared/skills/<name>/SKILL.md (and schema.json if present)
// and updates the corresponding role_definitions rows in Supabase.
//
// SKILL.md format: YAML frontmatter + markdown body. Frontmatter must include
//   name: ingestion_critic    # snake_case role_name enum value
//   model: claude-opus-4-7
//   features:
//     citations_api: false
//     structured_output: true
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm sync-skills
//
// Optional: DRY_RUN=1, ROLE=<snake_case_name>

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { parse as parseYaml } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = resolve(here, "../packages/shared/skills");

interface SkillFrontmatter {
  name: string;
  model: string;
  features: {
    citations_api: boolean;
    structured_output: boolean;
  };
}

interface LoadedSkill {
  name: string;
  prompt: string;
  hash: string;
  frontmatter: SkillFrontmatter;
}

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`error: ${name} is required`);
    process.exit(2);
  }
  return value;
}

async function loadSkill(path: string): Promise<LoadedSkill> {
  const raw = await readFile(path, "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${path}: missing frontmatter`);
  const fm = parseYaml(match[1] as string) as SkillFrontmatter;
  const prompt = (match[2] as string).trim();
  const hash = createHash("sha256").update(raw).digest("hex");
  return { name: fm.name, prompt, hash, frontmatter: fm };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const dryRun = process.env.DRY_RUN === "1";
  const filterRole = process.env.ROLE ?? null;
  const url = readEnv("SUPABASE_URL");
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (dryRun) console.log("DRY_RUN=1 — no writes will be performed");

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
    if (filterRole && skill.name !== filterRole) {
      skipped++;
      continue;
    }

    const schemaPath = resolve(SKILLS_DIR, dir, "schema.json");
    let schemaJson: unknown = null;
    if (await exists(schemaPath)) {
      try {
        schemaJson = JSON.parse(await readFile(schemaPath, "utf8"));
      } catch (err) {
        console.error(`! ${dir}/schema.json failed to parse: ${(err as Error).message}`);
        process.exit(1);
      }
    }

    const update = {
      prompt_template: skill.prompt,
      model: skill.frontmatter.model,
      features: skill.frontmatter.features,
      schema_json: schemaJson,
      skill_md_hash: skill.hash,
    };

    if (dryRun) {
      console.log(`would update role_definitions WHERE name = ${skill.name}`);
      console.log(`  hash:   ${skill.hash.slice(0, 16)}…`);
      console.log(`  model:  ${update.model}`);
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
