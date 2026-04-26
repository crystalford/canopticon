// runNoveltySurfacer — fire the Novelty Surfacer over a thesis's claim
// graph and persist candidate findings as draft `findings` rows.
//
// Used by:
//   - POST /v1/theses/:id/surface-findings  (manual fire from /studio/[id])
//   - POST /v1/findings/surface             (alternate entry point)
//
// Output (skills-v1.0 §novelty): up to 5 candidate findings tagged with
// novelty_grade, confidence, supporting_claim_indices. Each candidate
// becomes a `findings` row with status='draft'; supporting claims are
// linked through finding_supporting_claims with linchpin flags
// preserved.
//
// Findings carry the highest editorial bar in the system. The operator
// confirms them via PATCH (status='confirmed') before they can be
// flipped public.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnthropicClient } from "../lib/anthropic.ts";
import type { CostGateDecision } from "./cost_gate.ts";
import { invokeRole } from "./role_runner.ts";

export interface RunNoveltySurfacerInput {
  user_id: string;
  triggered_by: string;
  thesis_id: string;
  proposal_id?: string;
}

type PatternType =
  | "recurring_actor"
  | "transaction_chain"
  | "mechanism_overlap"
  | "structural_homology"
  | "negative_space"
  | "conflict_of_interest"
  | "temporal_correlation"
  | "jurisdictional_arbitrage"
  | "other";

interface CandidateFinding {
  title: string;
  narrative: string;
  novelty_grade: "incremental" | "notable" | "breakthrough";
  pattern_type: PatternType;
  confidence: number;
  supporting_claim_indices: number[];
  linchpin_claim_indices: number[];
}

export interface NoveltySurfacerReport {
  candidates: CandidateFinding[];
  summary: string;
  findings_written: number;
}

export type RunNoveltySurfacerResult =
  | { status: "completed"; role_invocation_id: string; report: NoveltySurfacerReport }
  | { status: "denied"; decision: Extract<CostGateDecision, { approved: false }> }
  | { status: "skipped"; reason: string };

export interface NoveltySurfacerContext {
  service: SupabaseClient;
  anthropic: AnthropicClient;
}

interface IndexedClaim {
  index: number;
  id: string;
  layer: string;
  grade: string;
  claim_text: string;
  data: string;
}

export async function runNoveltySurfacer(
  ctx: NoveltySurfacerContext,
  input: RunNoveltySurfacerInput,
): Promise<RunNoveltySurfacerResult> {
  await ctx.service
    .from("role_definitions")
    .update({ is_active: true })
    .eq("user_id", input.user_id)
    .eq("name", "novelty_surfacer");

  const thesis = await fetchThesis(ctx.service, input.user_id, input.thesis_id);
  if (!thesis) return { status: "skipped", reason: "thesis not found" };

  const claims = await fetchIndexedClaims(ctx.service, input.thesis_id);
  if (claims.length < 2) {
    return { status: "skipped", reason: "need at least two integrated claims" };
  }

  const [contradictions, linchpins, existing] = await Promise.all([
    fetchContradictions(ctx.service, input.thesis_id),
    fetchLinchpins(ctx.service, input.thesis_id),
    fetchExistingFindings(ctx.service, input.thesis_id),
  ]);

  const inv = await invokeRole(
    { service: ctx.service, anthropic: ctx.anthropic },
    {
      user_id: input.user_id,
      role_name: "novelty_surfacer",
      triggered_by: input.triggered_by,
      ...(input.proposal_id ? { proposal_id: input.proposal_id } : {}),
      snapshot: {
        thesis: {
          id: thesis.id,
          title: thesis.title,
          bluf: thesis.bluf ?? "",
          concept_spine: thesis.concept_spine,
        },
        integrated_claims: renderIndexedClaims(claims),
        contradictions: renderContradictions(contradictions),
        linchpin_assumptions: renderLinchpins(linchpins),
        existing_findings: renderExistingFindings(existing),
      },
      estimate: { input_tokens: 2500 + claims.length * 350, output_tokens: 2500 },
      approval_context: {
        thesis_id: input.thesis_id,
        thesis_title: thesis.title,
        step: "novelty_surfacer",
      },
    },
  );

  if (inv.status === "denied") return { status: "denied", decision: inv.decision };

  const structured = (inv.output.structured ?? {}) as Partial<{
    candidates: Array<Partial<CandidateFinding>>;
    summary: string;
  }>;

  const candidates: CandidateFinding[] = (structured.candidates ?? [])
    .filter(
      (c): c is CandidateFinding =>
        typeof c.title === "string" &&
        typeof c.narrative === "string" &&
        typeof c.novelty_grade === "string" &&
        typeof c.confidence === "number" &&
        Array.isArray(c.supporting_claim_indices),
    )
    .map((c) => ({
      title: c.title,
      narrative: c.narrative,
      novelty_grade: c.novelty_grade,
      pattern_type: (c.pattern_type ?? "other") as PatternType,
      confidence: c.confidence,
      supporting_claim_indices: c.supporting_claim_indices,
      linchpin_claim_indices: Array.isArray(c.linchpin_claim_indices)
        ? c.linchpin_claim_indices
        : [],
    }));

  const indexedById: Record<number, IndexedClaim> = {};
  for (const c of claims) indexedById[c.index] = c;

  let written = 0;
  for (const candidate of candidates) {
    const slug = generateSlug(candidate.title);
    const { data: row, error } = await ctx.service
      .from("findings")
      .insert({
        user_id: input.user_id,
        thesis_id: input.thesis_id,
        title: candidate.title.slice(0, 500),
        slug: `${slug}-${Date.now().toString(36)}`,
        narrative: candidate.narrative,
        novelty_grade: candidate.novelty_grade,
        pattern_type: candidate.pattern_type,
        confidence: clampConfidence(candidate.confidence),
        status: "draft",
        is_public: false,
        surfaced_by: "novelty_surfacer",
        surfaced_by_role_invocation_id: inv.role_invocation_id,
      })
      .select("id")
      .single();
    if (error) continue;
    written++;

    const findingId = row.id as string;
    const linchpinSet = new Set(candidate.linchpin_claim_indices);
    const supportingIds = new Set<string>();
    for (const idx of candidate.supporting_claim_indices) {
      const claim = indexedById[idx];
      if (!claim || supportingIds.has(claim.id)) continue;
      supportingIds.add(claim.id);
      await ctx.service.from("finding_supporting_claims").insert({
        user_id: input.user_id,
        finding_id: findingId,
        claim_id: claim.id,
        is_linchpin: linchpinSet.has(idx),
      });
    }
  }

  return {
    status: "completed",
    role_invocation_id: inv.role_invocation_id,
    report: {
      candidates,
      summary: structured.summary ?? "",
      findings_written: written,
    },
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

async function fetchIndexedClaims(
  client: SupabaseClient,
  thesis_id: string,
): Promise<IndexedClaim[]> {
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
  const versionByClaim: Record<string, { claim_text: string; data: string }> = {};
  if (versionIds.length > 0) {
    const { data: versions } = await client
      .from("claim_versions")
      .select("claim_id, claim_text, data")
      .in("id", versionIds);
    for (const v of versions ?? []) {
      const row = v as { claim_id: string; claim_text: string; data: string };
      versionByClaim[row.claim_id] = { claim_text: row.claim_text, data: row.data };
    }
  }
  const tcLayer: Record<string, string> = {};
  for (const tc of tcs ?? []) {
    const row = tc as { claim_id: string; layer: string };
    tcLayer[row.claim_id] = row.layer;
  }

  const out: IndexedClaim[] = [];
  let i = 1;
  for (const c of claims ?? []) {
    const row = c as { id: string; admiralty_grade: string };
    const v = versionByClaim[row.id];
    if (!v) continue;
    out.push({
      index: i,
      id: row.id,
      layer: tcLayer[row.id] ?? "factual",
      grade: row.admiralty_grade,
      claim_text: v.claim_text,
      data: v.data,
    });
    i++;
  }
  return out;
}

async function fetchContradictions(
  client: SupabaseClient,
  thesis_id: string,
): Promise<Array<{ severity: string; objection_text: string }>> {
  const { data } = await client
    .from("contradictions")
    .select("severity, objection_text")
    .eq("thesis_id", thesis_id)
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as Array<{ severity: string; objection_text: string }>;
}

async function fetchLinchpins(
  client: SupabaseClient,
  thesis_id: string,
): Promise<Array<{ status: string; text: string }>> {
  const { data } = await client
    .from("assumptions")
    .select("status, text")
    .eq("thesis_id", thesis_id)
    .eq("is_linchpin", true)
    .neq("status", "retired")
    .limit(20);
  return (data ?? []) as Array<{ status: string; text: string }>;
}

async function fetchExistingFindings(
  client: SupabaseClient,
  thesis_id: string,
): Promise<Array<{ title: string; novelty_grade: string; status: string }>> {
  const { data } = await client
    .from("findings")
    .select("title, novelty_grade, status")
    .eq("thesis_id", thesis_id)
    .neq("status", "retracted")
    .limit(20);
  return (data ?? []) as Array<{ title: string; novelty_grade: string; status: string }>;
}

function renderIndexedClaims(claims: IndexedClaim[]): string {
  return claims
    .map((c) => `[${c.index}] (${c.layer}, grade ${c.grade}) ${c.claim_text}\n  data: ${c.data}`)
    .join("\n\n");
}

function renderContradictions(rows: Array<{ severity: string; objection_text: string }>): string {
  if (rows.length === 0) return "(no open contradictions)";
  return rows.map((r) => `- [${r.severity}] ${r.objection_text}`).join("\n");
}

function renderLinchpins(rows: Array<{ status: string; text: string }>): string {
  if (rows.length === 0) return "(no linchpin assumptions)";
  return rows.map((r) => `- [${r.status}] ${r.text}`).join("\n");
}

function renderExistingFindings(
  rows: Array<{ title: string; novelty_grade: string; status: string }>,
): string {
  if (rows.length === 0) return "(none)";
  return rows.map((r) => `- [${r.novelty_grade}, ${r.status}] ${r.title}`).join("\n");
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function clampConfidence(c: number): number {
  if (Number.isNaN(c)) return 0.5;
  return Math.max(0, Math.min(1, Math.round(c * 100) / 100));
}
