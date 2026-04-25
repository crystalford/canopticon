import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type RoleName, SPRINT_1_ROLE_NAMES } from "../../constants/enums.ts";
import { loadSkill } from "./load.ts";

const here = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(here, "../../../skills");

const dirNameFor: Record<RoleName, string> = {
  ingestion_critic: "ingestion-critic",
  verifier: "verifier",
  interrogator: "interrogator",
  red_team: "red-team",
  steelman: "steelman",
  premortem: "premortem",
  gap_surfacer: "gap-surfacer",
  calibration: "calibration",
  tier_projector: "tier-projector",
  assumption_auditor: "assumption-auditor",
  indicator_validator: "indicator-validator",
  claim_extraction: "claim-extraction",
};

describe("Sprint 1 SKILL.md files", () => {
  for (const role of SPRINT_1_ROLE_NAMES) {
    it(`loads ${role}/SKILL.md cleanly`, async () => {
      const path = resolve(skillsRoot, dirNameFor[role], "SKILL.md");
      const skill = await loadSkill(path);
      expect(skill.name).toBe(role);
      expect(skill.frontmatter.model).toBe("claude-opus-4-7");
      expect(skill.frontmatter.features.structured_output).toBe(true);
      expect(skill.prompt.length).toBeGreaterThan(200);
      expect(skill.hash).toMatch(/^[0-9a-f]{64}$/);
    });
  }
});
