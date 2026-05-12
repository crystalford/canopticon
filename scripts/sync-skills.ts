#!/usr/bin/env node
// scripts/sync-skills.ts
//
// Reads packages/shared/skills/<name>/SKILL.md (and schema.json) and
// pushes prompts into the D1 role_definitions table via `wrangler d1
// execute`.
//
// Usage:
//   pnpm sync-skills

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = resolve(here, "../packages/shared/skills");
const API_DIR = resolve(here, "../packages/api");

interface SkillFrontmatter {
  name: string;
  model: string;
  features: { citations_api: boolean; structured_output: boolean };
}

interface LoadedSkill {
  name: string;
  prompt: string;
  hash: string;
  frontmatter: SkillFrontmatter;
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

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

async function main() {
  const dryRun = process.env.DRY_RUN === "1";
  const filterRole = process.env.ROLE ?? null;
  const remote = !process.env.LOCAL;

  if (dryRun) console.log("DRY_RUN=1 — no writes");

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
    const schemaJson = (await exists(schemaPath)) ? await readFile(schemaPath, "utf8") : null;
    const featuresJson = JSON.stringify(skill.frontmatter.features);

    // Only sync the prompt + features + schema + hash. The provider/model
    // columns are governed by migrations and operator overrides via the
    // System screen — re-syncing skills must NOT clobber that.
    const sql = `UPDATE role_definitions SET prompt_template = '${sqlEscape(skill.prompt)}', features = '${sqlEscape(featuresJson)}', schema_json = ${schemaJson ? `'${sqlEscape(schemaJson)}'` : "NULL"}, skill_md_hash = '${skill.hash}' WHERE name = '${skill.name}';`;

    if (dryRun) {
      console.log(`would update role_definitions WHERE name = ${skill.name}`);
      console.log(`  hash:   ${skill.hash.slice(0, 16)}…`);
      console.log(`  model:  ${skill.frontmatter.model}`);
      console.log(`  prompt: ${skill.prompt.length} chars`);
      synced++;
      continue;
    }

    const cmd = `pnpm exec wrangler d1 execute canopticon ${remote ? "--remote" : "--local"} --command ${JSON.stringify(sql)}`;
    try {
      execSync(cmd, { cwd: API_DIR, stdio: "inherit" });
      console.log(`✓ ${skill.name} synced (hash ${skill.hash.slice(0, 8)})`);
      synced++;
    } catch (err) {
      console.error(`! failed to sync ${skill.name}: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  console.log(`\n${synced} synced, ${skipped} skipped`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
