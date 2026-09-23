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

  it("researchOnDemand banks sources and STOPS — it does not also synthesize", () => {
    // This assertion used to check which branch persisted a piece, because
    // pass 1 both expanded and synthesized. That pairing is what failed live:
    //
    //     ✓ Extract verbatim facts — 273 facts
    //     ! Write a synthesis — execution stalled — try again
    //
    // expandRecord had just fetched six pages and extracted 273 facts; a
    // synthesis over up to twelve sources on top of that is past Cloudflare's
    // ceiling. Pass 1 now ends at synth_pending and writing is its own step.
    const fn = src
      .split("export async function researchOnDemand")[1]
      ?.split("export interface AdvanceRunReport")[0] as string;
    expect(fn).toBeDefined();
    expect(fn).toContain('status: "synth_pending"');
    expect(fn).not.toContain("synthesizeBrief(");
    expect(fn).not.toContain("persistBrief(");
  });

  it("advanceResearchRun dedupes pass1+pass2 source ids before the final synthesis", () => {
    const fn = src.split("export async function advanceResearchRun")[1] as string;
    expect(fn).toBeDefined();
    expect(fn).toMatch(/new Set\(\[\.\.\.pass1Ids,\s*\.\.\.pass2Ids\]\)/);
  });

  it("advanceResearchRun runs ONE follow-up search per call, never all of them", () => {
    // The exact inversion of what this test used to require. It asserted
    // Promise.all(queries.map(...)) — every queued search at once, and then a
    // synthesis, in one execution. Concurrency was the point and the ceiling
    // was the cost: that is the same failure pass 1 had, with more fetches in
    // it. followup_queries now holds what is STILL TO RUN and each call pops
    // one, so no execution ever carries two expands.
    const fn = src.split("export async function advanceResearchRun")[1] as string;
    expect(fn).not.toMatch(/Promise\.all\(queries\.map/);
    // The property, not the syntax: exactly one expandRecord call in the
    // follow-up branch, and it is handed a single query rather than a list.
    const branch = fn
      .split('if (runRow.status === "pass2_pending")')[1]
      ?.split("// ---- step")[0] as string;
    expect(branch.match(/expandRecord\(/g) ?? []).toHaveLength(1);
    expect(branch).toMatch(/expandRecord\(env, userId, next\)/);
  });

  it("never runs two model-heavy steps in one execution", () => {
    // The property the whole state machine exists for, checked structurally:
    // no branch may both expand and synthesize. Each status is one step.
    const fn = src.split("export async function advanceResearchRun")[1] as string;
    const branch = fn.split('if (runRow.status === "pass2_pending")')[1]?.split("// ---- step")[0];
    expect(branch).toContain("expandRecord");
    expect(branch).not.toContain("synthesizeBrief(");
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
    // Multi-line call now that it carries a per-run writer as its own argument.
    expect(src).toMatch(/callResearchWriter\(\s*env/);
    expect(src).not.toContain('callRole(env, "writer"');
  });
});

describe("llm/router.ts — Claude toggle for the research writer", () => {
  const src = readFileSync("./src/llm/router.ts", "utf-8");

  it("the deployment default only routes to Anthropic when BOTH the toggle and the key are present", () => {
    // The decision moved out of callResearchWriter into resolveWriter so a run
    // can override it; the deployment-default branch keeps the same shape.
    const fn = src.split("export function resolveWriter")[1] as string;
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

// Step five is where the operator's run stopped: "it got to step like five and
// it didn't work". It had not failed — pass 2 is dispatched by
// advanceResearchRun, whose only live caller is a button, and the cron that
// used to drive it is off by design (standing rule 4). So the run was waiting
// for a press, and the banner was telling it was digging.
describe("a run waiting on a press says so, and carries the press", () => {
  const src = readFileSync("./src/graph/lib/deep-research.ts", "utf-8");
  const statusFn = () => src.split("export async function getResearchStatus")[1] as string;
  const branch = (status: string) => {
    const after = statusFn().split(`if (runRow.status === "${status}")`)[1] as string;
    expect(after, `no status branch for ${status}`).toBeDefined();
    return after.split("if (runRow.status ===")[0] as string;
  };

  // Every state that cannot move without a person, and what each must say.
  const WAITING = ["synth_pending", "pass2_pending", "pass2_synth_pending"];

  it.each(WAITING)("%s does not report itself as still running", (status) => {
    // terminal:false made the banner poll every 1.5s forever against a state
    // that cannot change without a person. The pulsing dot was the bug.
    expect(branch(status)).toContain("terminal: true");
    expect(branch(status)).not.toContain("terminal: false");
  });

  it.each(WAITING)("%s is not an error either", (status) => {
    expect(branch(status)).toContain("warn: false");
  });

  it.each(WAITING)("%s carries the press that moves it", (status) => {
    expect(branch(status)).toContain("action: advance(");
  });

  it("marks a queued step pending, never active", () => {
    // Rule 6: nothing is running. "active" was the lie that made a waiting
    // run indistinguishable from a hung one.
    for (const status of WAITING) {
      const stepPush = branch(status).split("return {")[0] as string;
      expect(stepPush).toContain('state: "pending"');
      expect(stepPush).not.toContain('state: "active"');
    }
  });

  it("the press is a POST to the advance route, and comes back to this screen", () => {
    const helper = statusFn().split("const advance =")[1]?.split("};")[0] as string;
    expect(helper).toContain("postTo:");
    expect(helper).toContain("/op/research/advance");
    expect(helper).toContain("returnTo:");
  });

  it("a stalled run is only ever reaped from the one in-flight state", () => {
    // pass2_pending was in this list, so a healthy run WAITING FOR A PRESS got
    // marked "execution stalled" ten minutes after it was queued — long enough
    // to go and get a coffee. Only pass1_pending has an execution in flight.
    const fn = src.split("export async function reapStaleResearchRuns")[1] as string;
    // The SQL only — the comment above it names pass2_pending precisely
    // because that is the state that must NOT be reaped, and an assertion
    // that reads comments would punish explaining the bug.
    const sql = fn.split("UPDATE research_runs")[1]?.split("`")[0] as string;
    expect(sql).toContain("status = 'pass1_pending'");
    expect(sql).not.toContain("pass2_pending");
  });

  it("offers the press as a POST, never a link", () => {
    // advanceResearchRun spends model calls and writes rows. A GET that a
    // crawler or a prefetch could follow would run research by accident.
    const banner = readFileSync("./src/public/render/status-banner.ts", "utf-8");
    const block = banner.split("if (s.action")[1]?.split("if (s.reviewUrl)")[0] as string;
    expect(block).toContain('form.method = "POST"');
    expect(block).not.toMatch(/createElement\("a"\)/);
  });
});
