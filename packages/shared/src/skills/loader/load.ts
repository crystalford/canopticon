import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { ROLE_NAMES, type RoleName } from "../../constants/enums.ts";
import type { PreparedSkill, SkillFrontmatter } from "./types.ts";

const FRONTMATTER_DELIMITER = "---";

export class SkillLoadError extends Error {
  constructor(
    message: string,
    public readonly path: string,
  ) {
    super(`${message} (${path})`);
    this.name = "SkillLoadError";
  }
}

export async function loadSkill(path: string): Promise<PreparedSkill> {
  const raw = await readFile(path, "utf8");
  return parseSkillSource(raw, path);
}

export function parseSkillSource(raw: string, path = "<inline>"): PreparedSkill {
  const { frontmatter, body } = splitFrontmatter(raw, path);
  const parsed = parseFrontmatter(frontmatter, path);
  const prompt = body.trimEnd();
  const hash = createHash("sha256").update(prompt, "utf8").digest("hex");

  return {
    name: parsed.name,
    frontmatter: parsed,
    prompt,
    hash,
  };
}

function splitFrontmatter(raw: string, path: string): { frontmatter: string; body: string } {
  const normalized = raw.replace(/^﻿/, "");
  if (
    !normalized.startsWith(`${FRONTMATTER_DELIMITER}\n`) &&
    !normalized.startsWith(`${FRONTMATTER_DELIMITER}\r\n`)
  ) {
    throw new SkillLoadError("SKILL.md must begin with a YAML frontmatter block", path);
  }

  const afterOpen = normalized.slice(FRONTMATTER_DELIMITER.length).replace(/^\r?\n/, "");
  const closeIndex = afterOpen.search(/\r?\n---\r?\n/);
  if (closeIndex === -1) {
    throw new SkillLoadError("SKILL.md frontmatter block is not closed with `---`", path);
  }

  const frontmatter = afterOpen.slice(0, closeIndex);
  const bodyStart = afterOpen.slice(closeIndex).replace(/^\r?\n---\r?\n/, "");
  return { frontmatter, body: bodyStart };
}

function parseFrontmatter(yamlSource: string, path: string): SkillFrontmatter {
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlSource);
  } catch (cause) {
    throw new SkillLoadError(
      `Failed to parse SKILL.md frontmatter as YAML: ${(cause as Error).message}`,
      path,
    );
  }

  if (!isRecord(parsed)) {
    throw new SkillLoadError("SKILL.md frontmatter must be a YAML mapping", path);
  }

  const name = parsed.name;
  if (typeof name !== "string" || !isRoleName(name)) {
    throw new SkillLoadError(
      `SKILL.md frontmatter \`name\` must be one of: ${ROLE_NAMES.join(", ")}`,
      path,
    );
  }

  const version = parsed.version;
  if (typeof version !== "string" && typeof version !== "number") {
    throw new SkillLoadError("SKILL.md frontmatter `version` must be a string or number", path);
  }

  const model = parsed.model;
  if (typeof model !== "string" || model.length === 0) {
    throw new SkillLoadError("SKILL.md frontmatter `model` must be a non-empty string", path);
  }

  const features = parsed.features;
  if (!isRecord(features)) {
    throw new SkillLoadError("SKILL.md frontmatter `features` must be a mapping", path);
  }

  return {
    name,
    version: String(version),
    model,
    features: {
      citations_api: features.citations_api === true,
      structured_output: features.structured_output === true,
      cross_model: features.cross_model === true,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRoleName(value: string): value is RoleName {
  return (ROLE_NAMES as readonly string[]).includes(value);
}
