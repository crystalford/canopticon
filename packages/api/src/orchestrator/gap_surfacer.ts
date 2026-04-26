// runGapSurfacer — fire the Gap Surfacer over a thesis's substrate slice.
//
// Used by:
//   - POST /v1/theses/:id/surface-gaps   (manual fire from /studio/[id])
//   - cascade step F                      (auto-fire across active theses
//                                           on each cascade run, with a
//                                           coarse "has new claims since
//                                           last surface" gate)
//
// Output (skills-v1.0 §8): a list of gaps tagged by stage with target
// questions, plus a summary. We persist gaps with suggested_role =
// 'interrogator' as `questions` rows tagged generated_by='gap_surfacer';
// other gaps stay on the role_invocations.output_structured payload and
// are surfaced through the /studio/[id]/gaps panel.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnthropicClient } from "../lib/anthropic.ts";
import type { CostGateDecision } from "./cost_gate.ts";
import { invokeRole } from "./role_runner.ts";

export interface RunGapSurfacerInput {
  user_id: string;
  triggered_by: string;
  thesis_id: string;
  proposal_id?: string;
}

export interface GapSurfacerReport {
  gaps: Array<{
    stage: "entities" | "time" | "geography" | "evidence" | "source" | "counter_cases" | "lineage";
    description: string;
    target_question: string;
    severity: "minor" | "notable" | "blocking";
    suggested_role: "interrogator" | "verifier" | "operator_research" | null;
  }>;
  summary: string;
  top_priorities: string[];
}

export type RunGapSurfacerResult =
  | {
      status: "completed";
      role_invocation_id: string;
      report: GapSurfacerReport;
      questions_written: number;
    }
  | { status: "denied"; decision: Extract<CostGateDecision, { approved: false }> }
  | { status: "skipped"; reason: string };

export interface GapSurfacerContext {
  service: SupabaseClient;
  anthropic: AnthropicClient;
}

export async function runGapSurfacer(
  ctx: GapSurfacerContext,
  input: RunGapSurfacerInput,
): Promise<RunGapSurfacerResult> {
  await ctx.service
    .from("role_definitions")
    .update({ is_active: true })
    .eq("user_id", input.user_id)
    .eq("name", "gap_surfacer");

  const thesis = await fetchThesis(ctx.service, input.user_id, input.thesis_id);
  if (!thesis) return { status: "skipped", reason: "thesis not found" };

  const [claims, entities, sourceCounts] = await Promise.all([
    fetchIntegratedClaims(ctx.service, input.thesis_id),
    fetchKnownEntities(ctx.service, input.user_id),
    fetchSourceDistribution(ctx.service, input.thesis_id),
  ]);

  if (claims.length === 0) {
    return { status: "skipped", reason: "no integrated claims to sweep" };
  }

  const inv = await invokeRole(
    { service: ctx.service, anthropic: ctx.anthropic },
    {
      user_id: input.user_id,
      role_name: "gap_surfacer",
      triggered_by: input.triggered_by,
      ...(input.proposal_id ? { proposal_id: input.proposal_id } : {}),
      snapshot: {
        thesis: {
          id: thesis.id,
          title: thesis.title,
          bluf: thesis.bluf ?? "",
          concept_spine: thesis.concept_spine,
        },
        integrated_claims: renderClaims(claims),
        known_entities: renderEntities(entities),
        source_distribution: renderSourceDistribution(sourceCounts),
      },
      estimate: { input_tokens: 2000 + claims.length * 250, output_tokens: 1800 },
      approval_context: {
        thesis_id: input.thesis_id,
        thesis_title: thesis.title,
        step: "gap_surfacer",
      },
    },
  );

  if (inv.status === "denied") return { status: "denied", decision: inv.decision };

  const structured = (inv.output.structured ?? {}) as Partial<{
    gaps: Array<Partial<GapSurfacerReport["gaps"][number]>>;
    summary: string;
    top_priorities: string[];
  }>;

  const gaps = (structured.gaps ?? [])
    .filter(
      (g): g is GapSurfacerReport["gaps"][number] =>
        typeof g.stage === "string" &&
        typeof g.description === "string" &&
        typeof g.target_question === "string" &&
        typeof g.severity === "string",
    )
    .map((g) => ({
      stage: g.stage,
      description: g.description,
      target_question: g.target_question,
      severity: g.severity,
      suggested_role: g.suggested_role ?? null,
    }));

  const report: GapSurfacerReport = {
    gaps,
    summary: structured.summary ?? "",
    top_priorities: Array.isArray(structured.top_priorities) ? structured.top_priorities : [],
  };

  // Persist gaps tagged for the Interrogator as `questions` rows so the
  // operator sees them in the questions panel alongside auto-generated
  // ones. EIG defaults to 0.5 — Gap Surfacer doesn't compute it; the
  // operator can tune.
  let questions_written = 0;
  for (const gap of report.gaps) {
    if (gap.suggested_role !== "interrogator") continue;
    const eig = gap.severity === "blocking" ? 0.85 : gap.severity === "notable" ? 0.6 : 0.4;
    const { error } = await ctx.service.from("questions").insert({
      user_id: input.user_id,
      thesis_id: input.thesis_id,
      text: gap.target_question,
      rationale: `gap (${gap.stage}): ${gap.description}`,
      evidence_targets: [],
      expected_information_gain: eig,
      status: "open",
      generated_by: "gap_surfacer",
      generated_by_role_invocation_id: inv.role_invocation_id,
    });
    if (!error) questions_written++;
  }

  return {
    status: "completed",
    role_invocation_id: inv.role_invocation_id,
    report,
    questions_written,
  };
}

interface ThesisSnapshot {
  id: string;
  title: string;
  bluf: string | null;
  concept_spine: string;
}

async function fetchThesis(
  client: SupabaseClient,
  user_id: string,
  thesis_id: string,
): Promise<ThesisSnapshot | null> {
  const { data: thesis } = await client
    .from("theses")
    .select("id, title, current_version_id")
    .eq("id", thesis_id)
    .eq("user_id", user_id)
    .maybeSingle<{ id: string; title: string; current_version_id: string | null }>();
  if (!thesis) return null;

  let bluf: string | null = null;
  if (thesis.current_version_id) {
    const { data: version } = await client
      .from("thesis_versions")
      .select("bluf")
      .eq("id", thesis.current_version_id)
      .maybeSingle<{ bluf: string | null }>();
    bluf = version?.bluf ?? null;
  }

  const { data: spine } = await client
    .from("thesis_concept_spine")
    .select("concept_text")
    .eq("thesis_id", thesis_id)
    .order("ordering", { ascending: true });
  const concept_spine = (spine ?? [])
    .map((s) => (s as { concept_text: string }).concept_text)
    .join(", ");

  return { id: thesis.id, title: thesis.title, bluf, concept_spine };
}

async function fetchIntegratedClaims(
  client: SupabaseClient,
  thesis_id: string,
): Promise<Array<{ layer: string; grade: string; claim_text: string; data: string }>> {
  const { data: tcs } = await client
    .from("thesis_claims")
    .select("claim_id, layer")
    .eq("thesis_id", thesis_id)
    .is("removed_at", null);
  const ids = (tcs ?? []).map((row) => (row as { claim_id: string }).claim_id);
  if (ids.length === 0) return [];

  const { data: claims } = await client
    .from("claims")
    .select("id, admiralty_grade, current_version_id")
    .in("id", ids);
  const versionIds = (claims ?? [])
    .map((row) => (row as { current_version_id: string | null }).current_version_id)
    .filter((v): v is string => Boolean(v));
  if (versionIds.length === 0) return [];

  const { data: versions } = await client
    .from("claim_versions")
    .select("claim_id, claim_text, data")
    .in("id", versionIds);
  const versionByClaim: Record<string, { claim_text: string; data: string }> = {};
  for (const v of versions ?? []) {
    const row = v as { claim_id: string; claim_text: string; data: string };
    versionByClaim[row.claim_id] = { claim_text: row.claim_text, data: row.data };
  }
  const tcLayer: Record<string, string> = {};
  for (const tc of tcs ?? []) {
    const row = tc as { claim_id: string; layer: string };
    tcLayer[row.claim_id] = row.layer;
  }

  const out: Array<{ layer: string; grade: string; claim_text: string; data: string }> = [];
  for (const c of claims ?? []) {
    const row = c as { id: string; admiralty_grade: string };
    const v = versionByClaim[row.id];
    if (!v) continue;
    out.push({
      layer: tcLayer[row.id] ?? "factual",
      grade: row.admiralty_grade,
      claim_text: v.claim_text,
      data: v.data,
    });
  }
  return out;
}

async function fetchKnownEntities(
  client: SupabaseClient,
  user_id: string,
): Promise<Array<{ canonical_name: string; entity_type: string }>> {
  const { data } = await client
    .from("entities")
    .select("canonical_name, entity_type")
    .eq("user_id", user_id)
    .eq("is_excluded", false)
    .order("last_seen_at", { ascending: false })
    .limit(80);
  return (data ?? []) as Array<{ canonical_name: string; entity_type: string }>;
}

async function fetchSourceDistribution(
  client: SupabaseClient,
  thesis_id: string,
): Promise<Record<string, number>> {
  const { data: tcs } = await client
    .from("thesis_claims")
    .select("claim_id")
    .eq("thesis_id", thesis_id)
    .is("removed_at", null);
  const claimIds = (tcs ?? []).map((row) => (row as { claim_id: string }).claim_id);
  if (claimIds.length === 0) return {};

  const { data: cs } = await client
    .from("claim_sources")
    .select("source_id")
    .in("claim_id", claimIds);
  const sourceIds = Array.from(
    new Set((cs ?? []).map((row) => (row as { source_id: string }).source_id)),
  );
  if (sourceIds.length === 0) return {};

  const { data: sources } = await client.from("sources").select("source_type").in("id", sourceIds);
  const dist: Record<string, number> = {};
  for (const s of sources ?? []) {
    const t = (s as { source_type: string }).source_type;
    dist[t] = (dist[t] ?? 0) + 1;
  }
  return dist;
}

function renderClaims(
  claims: Array<{ layer: string; grade: string; claim_text: string; data: string }>,
): string {
  return claims
    .map((c, i) => `[${i + 1}] (${c.layer}, grade ${c.grade}) ${c.claim_text}\n  data: ${c.data}`)
    .join("\n\n");
}

function renderEntities(entities: Array<{ canonical_name: string; entity_type: string }>): string {
  if (entities.length === 0) return "(no entities resolved yet)";
  return entities.map((e) => `- ${e.canonical_name} (${e.entity_type})`).join("\n");
}

function renderSourceDistribution(dist: Record<string, number>): string {
  const entries = Object.entries(dist);
  if (entries.length === 0) return "(no sources cited)";
  return entries.map(([k, v]) => `- ${k}: ${v}`).join("\n");
}
