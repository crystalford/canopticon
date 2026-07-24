import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The two-pass research pipeline (graph/lib/deep-research.ts) exists
// specifically to avoid a bug this codebase already hit multiple times:
// chaining search -> synthesize -> search-again -> synthesize-again into
// ONE execution silently exceeds Cloudflare's execution ceiling (real work
// that never gets a chance to finish — confirmed live across
// entity-resolution.ts, surfacing.ts, draft-reading.ts, and this file's
// own original single-pass version). These are SHAPE tests, not full
// functional runs — mirrors draft-reading-judge.test.ts's own reasoning:
// running the real pipeline needs live LLM calls, D1 state across four
// tables, and a Brave Search response. What actually matters — and what
// silently regresses if someone "simplifies" this later — is that pass 1
// and pass 2 stay two separate executions, dispatched from two separate
// triggers, never chained.

describe("deep-research.ts — two-pass pipeline shape", () => {
  const src = readFileSync("./src/graph/lib/deep-research.ts", "utf-8");

  it("researchOnDemand does not call advanceResearchRun (pass 1 never chains into pass 2)", () => {
    const fn = src
      .split("export async function researchOnDemand")[1]
      ?.split("export interface AdvanceRunReport")[0];
    expect(fn).toBeDefined();
    expect(fn).not.toContain("advanceResearchRun(");
  });

  it("researchOnDemand persists a piece immediately only when there are no follow-up queries", () => {
    const fn = src
      .split("export async function researchOnDemand")[1]
      ?.split("export interface AdvanceRunReport")[0] as string;
    // The immediate-persist branch is gated on followups.length === 0.
    expect(fn).toContain("followups.length === 0");
    // The deferred branch sets pass2_pending and returns without a
    // second persistBrief call in that branch.
    const deferredRegion = fn.split('status: "pass2_pending"')[1] ?? "";
    expect(deferredRegion.split("return {")[0]).not.toContain("persistBrief(");
  });

  it("advanceResearchRun dedupes pass1+pass2 source ids before the final synthesis", () => {
    const fn = src.split("export async function advanceResearchRun")[1] as string;
    expect(fn).toBeDefined();
    expect(fn).toMatch(/new Set\(\[\.\.\.pass1Ids,\s*\.\.\.pass2Ids\]\)/);
  });

  it("advanceResearchRun runs follow-up searches concurrently, not sequentially", () => {
    const fn = src.split("export async function advanceResearchRun")[1] as string;
    expect(fn).toMatch(/Promise\.all\(queries\.map/);
  });

  it("getResearchStatus reads research_runs directly (authoritative state, not just event inference)", () => {
    const fn = src.split("export async function getResearchStatus")[1] as string;
    expect(fn).toContain("FROM research_runs");
  });

  it("the dormant beat path (coverage_beats) uses a plain UPDATE, not updateById", () => {
    // coverage_beats has no updated_at column (migration 0036/0038);
    // updateById() unconditionally sets one and would throw against this
    // table. Regression guard for exactly that mistake.
    const region = src.split("export async function synthesizeDueBeatReport")[1] as string;
    expect(region).not.toMatch(/updateById\(env\.DB,\s*"coverage_beats"/);
    expect(region).toContain("UPDATE coverage_beats SET last_synthesized_at");
  });

  it("research_runs writes use updateById (has updated_at, migration 0042)", () => {
    expect(src).toMatch(/updateById\(env\.DB,\s*"research_runs"/);
  });

  it("synthesizeBrief caps the source pool fed to any one synthesis call", () => {
    expect(src).toContain("MAX_TOTAL_SOURCES_FOR_SYNTHESIS");
    expect(src).toContain("pieceIds.slice(0, MAX_TOTAL_SOURCES_FOR_SYNTHESIS)");
  });

  it("routes the writer call through callResearchWriter, not a hardcoded role", () => {
    expect(src).toContain("callResearchWriter(env");
    expect(src).not.toContain('callRole(env, "writer"');
  });
});

describe("llm/router.ts — Claude toggle for the research writer", () => {
  const src = readFileSync("./src/llm/router.ts", "utf-8");

  it("callResearchWriter only routes to Anthropic when BOTH the toggle and the key are present", () => {
    const fn = src.split("export async function callResearchWriter")[1] as string;
    expect(fn).toBeDefined();
    expect(fn).toMatch(/RESEARCH_LLM_PROVIDER === "anthropic" && env\.ANTHROPIC_API_KEY/);
  });

  it("falls back to the free research_writer role otherwise", () => {
    const fn = src.split("export async function callResearchWriter")[1] as string;
    expect(fn).toContain('callRole(env, "research_writer", args)');
  });

  it("the Anthropic path uses its own operation_type, distinct from the free role's", () => {
    expect(src).toContain('operation_type: "anthropic.research_writer"');
    expect(src).toContain('operation_type: "workers_ai.research_writer"');
  });
});
