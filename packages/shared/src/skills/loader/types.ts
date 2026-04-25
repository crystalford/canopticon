import type { RoleName } from "../../constants/enums.ts";

export interface SkillFrontmatter {
  name: RoleName;
  version: string;
  model: string;
  features: {
    citations_api: boolean;
    structured_output: boolean;
    cross_model: boolean;
  };
}

export interface PreparedSkill {
  /** Role/skill identifier — matches `role_definitions.name` in Postgres. */
  name: RoleName;
  /** Frontmatter as parsed from the SKILL.md document. */
  frontmatter: SkillFrontmatter;
  /** Prompt body (everything after the closing `---` of the frontmatter block). */
  prompt: string;
  /** SHA-256 of the prompt body, lowercase hex. Stored in `role_definitions.skill_md_hash`. */
  hash: string;
}
