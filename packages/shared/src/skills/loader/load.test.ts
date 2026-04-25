import { describe, expect, it } from "vitest";
import { SkillLoadError, parseSkillSource } from "./load.ts";

const validSkill = `---
name: ingestion_critic
version: "1.0"
model: claude-opus-4-7
features:
  citations_api: false
  structured_output: true
  cross_model: false
---
You are the Ingestion Critic.
`;

describe("parseSkillSource", () => {
  it("parses a well-formed SKILL.md", () => {
    const skill = parseSkillSource(validSkill);
    expect(skill.name).toBe("ingestion_critic");
    expect(skill.frontmatter.model).toBe("claude-opus-4-7");
    expect(skill.frontmatter.features.structured_output).toBe(true);
    expect(skill.prompt).toBe("You are the Ingestion Critic.");
    expect(skill.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a stable hash across calls", () => {
    const a = parseSkillSource(validSkill);
    const b = parseSkillSource(validSkill);
    expect(a.hash).toBe(b.hash);
  });

  it("rejects a document with no frontmatter", () => {
    expect(() => parseSkillSource("just prose")).toThrow(SkillLoadError);
  });

  it("rejects a document with an unclosed frontmatter block", () => {
    const bad = "---\nname: ingestion_critic\nbody without close";
    expect(() => parseSkillSource(bad)).toThrow(SkillLoadError);
  });

  it("rejects an unknown role name", () => {
    const bad = validSkill.replace("ingestion_critic", "not-a-role");
    expect(() => parseSkillSource(bad)).toThrow(SkillLoadError);
  });

  it("rejects missing `model`", () => {
    const bad = validSkill.replace("model: claude-opus-4-7\n", "");
    expect(() => parseSkillSource(bad)).toThrow(SkillLoadError);
  });
});
