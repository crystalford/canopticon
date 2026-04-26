// runAssumptionAuditor — fire the Assumption Auditor role over the linchpin
// assumptions of a thesis (or all of them if no thesis is given).
//
// Used by:
//   - POST /v1/assumptions/:id/audit                (single-assumption check)
//   - POST /v1/assumptions/audit-thesis/:thesis_id  (sweep one thesis)
//   - cascade step E (auto-fire across theses with stale linchpins)
//
// Output (skills-v1.0 §12): one audit row per assumption with status,
// rationale, optional consequence_if_failed, and is_linchpin override.
// Persists by mutating assumptions.status / is_linchpin / last_audited_at
// / consequence_if_failed / last_audit_role_invocation_id.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnthropicClient } from "../lib/anthropic.ts";
import type { CostGateDecision } from "./cost_gate.ts";
import { invokeRole } from "./role_runner.ts";

export interface RunAssumptionAuditorInput {
  user_id: string;
  triggered_by: string;
  thesis_id: string;
  assumption_ids?: string[];
  proposal_id?: string;
}

interface AuditEntry {
  assumption_id: string;
  status: "holding" | "shaken" | "broken" | "retired";
  is_linchpin: boolean | null;
  rationale: string;
  consequence_if_failed: string | null;
}

export interface AssumptionAuditorReport {
  audits: AuditEntry[];
  summary: string;
}

export type RunAssumptionAuditorResult =
  | {
      status: "completed";
      role_invocation_id: string;
      report: AssumptionAuditorReport;
      assumptions_updated: number;
    }
  | {
      status: "denied";
      decision: Extract<CostGateDecision, { approved: false }>;
    }
  | {
      status: "skipped";
      reason: string;
    };

export interface AssumptionAuditorContext {
  service: SupabaseClient;
  anthropic: AnthropicClient;
}

interface AssumptionRow {
  id: string;
  text: string;
  status: string;
  is_linchpin: boolean;
  consequence_if_failed: string | null;
  last_audited_at: string | null;
  created_at: string;
}

export async function runAssumptionAuditor(
  ctx: AssumptionAuditorContext,
  input: RunAssumptionAuditorInput,
): Promise<RunAssumptionAuditorResult> {
  await ctx.service
    .from("role_definitions")
    .update({ is_active: true })
    .eq("user_id", input.user_id)
    .eq("name", "assumption_auditor");

  const thesis = await fetchThesis(ctx.service, input.user_id, input.thesis_id);
  if (!thesis) return { status: "skipped", reason: "thesis not found" };

  const assumptions = await fetchAssumptions(
    ctx.service,
    input.user_id,
    input.thesis_id,
    input.assumption_ids,
  );
  if (assumptions.length === 0) {
    return { status: "skipped", reason: "no assumptions to audit" };
  }

  const [recent_claims, resolved_predictions] = await Promise.all([
    fetchRecentClaims(ctx.service, input.thesis_id),
    fetchResolvedPredictions(ctx.service, input.user_id, input.thesis_id),
  ]);

  const inv = await invokeRole(
    { service: ctx.service, anthropic: ctx.anthropic },
    {
      user_id: input.user_id,
      role_name: "assumption_auditor",
      triggered_by: input.triggered_by,
      ...(input.proposal_id ? { proposal_id: input.proposal_id } : {}),
      snapshot: {
        thesis: {
          id: thesis.id,
          title: thesis.title,
          bluf: thesis.bluf ?? "",
        },
        assumptions: renderAssumptions(assumptions),
        recent_claims: renderClaims(recent_claims),
        resolved_predictions: renderResolved(resolved_predictions),
      },
      estimate: {
        input_tokens: 1500 + assumptions.length * 250 + recent_claims.length * 100,
        output_tokens: 1200,
      },
      approval_context: {
        thesis_id: input.thesis_id,
        thesis_title: thesis.title,
        assumption_count: assumptions.length,
        step: "assumption_auditor",
      },
    },
  );

  if (inv.status === "denied") {
    return { status: "denied", decision: inv.decision };
  }

  const structured = (inv.output.structured ?? {}) as Partial<{
    audits: Array<Partial<AuditEntry>>;
    summary: string;
  }>;
  const audits: AuditEntry[] = (structured.audits ?? [])
    .filter((a) => typeof a.assumption_id === "string" && typeof a.status === "string")
    .map((a) => ({
      assumption_id: a.assumption_id as string,
      status: (a.status as AuditEntry["status"]) ?? "holding",
      is_linchpin: typeof a.is_linchpin === "boolean" ? a.is_linchpin : null,
      rationale: a.rationale ?? "",
      consequence_if_failed: a.consequence_if_failed ?? null,
    }));

  const validIds = new Set(assumptions.map((a) => a.id));
  let updated = 0;
  const auditedAt = new Date().toISOString();
  for (const audit of audits) {
    if (!validIds.has(audit.assumption_id)) continue;
    const patch: Record<string, unknown> = {
      status: audit.status,
      last_audited_at: auditedAt,
      last_audit_role_invocation_id: inv.role_invocation_id,
    };
    if (audit.is_linchpin !== null) patch.is_linchpin = audit.is_linchpin;
    if (audit.consequence_if_failed) patch.consequence_if_failed = audit.consequence_if_failed;

    const { error } = await ctx.service
      .from("assumptions")
      .update(patch)
      .eq("id", audit.assumption_id)
      .eq("user_id", input.user_id);
    if (!error) updated++;
  }

  return {
    status: "completed",
    role_invocation_id: inv.role_invocation_id,
    report: { audits, summary: structured.summary ?? "" },
    assumptions_updated: updated,
  };
}

async function fetchThesis(
  client: SupabaseClient,
  user_id: string,
  thesis_id: string,
): Promise<{ id: string; title: string; bluf: string | null } | null> {
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
  return { id: thesis.id, title: thesis.title, bluf };
}

async function fetchAssumptions(
  client: SupabaseClient,
  user_id: string,
  thesis_id: string,
  assumption_ids?: string[],
): Promise<AssumptionRow[]> {
  let q = client
    .from("assumptions")
    .select("id, text, status, is_linchpin, consequence_if_failed, last_audited_at, created_at")
    .eq("user_id", user_id)
    .eq("thesis_id", thesis_id)
    .neq("status", "retired");
  if (assumption_ids && assumption_ids.length > 0) {
    q = q.in("id", assumption_ids);
  }
  const { data } = await q;
  return (data ?? []) as AssumptionRow[];
}

async function fetchRecentClaims(
  client: SupabaseClient,
  thesis_id: string,
): Promise<Array<{ layer: string; grade: string; claim_text: string; created_at: string }>> {
  const { data: tcs } = await client
    .from("thesis_claims")
    .select("claim_id, layer, added_at")
    .eq("thesis_id", thesis_id)
    .is("removed_at", null)
    .order("added_at", { ascending: false })
    .limit(30);
  const ids = (tcs ?? []).map((row) => (row as { claim_id: string }).claim_id);
  if (ids.length === 0) return [];

  const { data: claims } = await client
    .from("claims")
    .select("id, admiralty_grade, current_version_id, created_at")
    .in("id", ids);
  const versionIds = (claims ?? [])
    .map((row) => (row as { current_version_id: string | null }).current_version_id)
    .filter((v): v is string => Boolean(v));
  const textByClaim: Record<string, string> = {};
  if (versionIds.length > 0) {
    const { data: versions } = await client
      .from("claim_versions")
      .select("claim_id, claim_text")
      .in("id", versionIds);
    for (const v of versions ?? []) {
      const row = v as { claim_id: string; claim_text: string };
      textByClaim[row.claim_id] = row.claim_text;
    }
  }
  const tcLayer: Record<string, string> = {};
  for (const tc of tcs ?? []) {
    const row = tc as { claim_id: string; layer: string };
    tcLayer[row.claim_id] = row.layer;
  }
  const out: Array<{ layer: string; grade: string; claim_text: string; created_at: string }> = [];
  for (const c of claims ?? []) {
    const row = c as { id: string; admiralty_grade: string; created_at: string };
    const text = textByClaim[row.id];
    if (!text) continue;
    out.push({
      layer: tcLayer[row.id] ?? "factual",
      grade: row.admiralty_grade,
      claim_text: text,
      created_at: row.created_at,
    });
  }
  return out;
}

async function fetchResolvedPredictions(
  client: SupabaseClient,
  user_id: string,
  thesis_id: string,
): Promise<
  Array<{
    text: string;
    probability: number;
    status: string;
    resolved_at: string | null;
    brier_contribution: number | null;
  }>
> {
  const { data } = await client
    .from("predictions")
    .select("text, probability, status, resolved_at, brier_contribution")
    .eq("user_id", user_id)
    .eq("thesis_id", thesis_id)
    .neq("status", "active")
    .order("resolved_at", { ascending: false })
    .limit(20);
  return (data ?? []) as Array<{
    text: string;
    probability: number;
    status: string;
    resolved_at: string | null;
    brier_contribution: number | null;
  }>;
}

function renderAssumptions(rows: AssumptionRow[]): string {
  return rows
    .map((a) => {
      const audited = a.last_audited_at
        ? `last audited ${a.last_audited_at.slice(0, 10)}`
        : "never audited";
      const linchpin = a.is_linchpin ? "linchpin" : "non-linchpin";
      const cif = a.consequence_if_failed
        ? `\n  consequence_if_failed: ${a.consequence_if_failed}`
        : "";
      return `id: ${a.id}\nstatus: ${a.status} (${linchpin}, ${audited})\ntext: ${a.text}${cif}`;
    })
    .join("\n\n");
}

function renderClaims(
  claims: Array<{ layer: string; grade: string; claim_text: string; created_at: string }>,
): string {
  if (claims.length === 0) return "(no recent claims)";
  return claims
    .map(
      (c, i) =>
        `[${i + 1}] (${c.layer}, grade ${c.grade}, added ${c.created_at.slice(0, 10)}) ${c.claim_text}`,
    )
    .join("\n");
}

function renderResolved(
  rows: Array<{
    text: string;
    probability: number;
    status: string;
    resolved_at: string | null;
    brier_contribution: number | null;
  }>,
): string {
  if (rows.length === 0) return "(no resolved predictions)";
  return rows
    .map((p) => {
      const brier =
        p.brier_contribution !== null ? `, brier=${p.brier_contribution.toFixed(3)}` : "";
      const at = p.resolved_at ? ` at ${p.resolved_at.slice(0, 10)}` : "";
      return `- p=${p.probability.toFixed(2)} [${p.status}${brier}${at}] ${p.text}`;
    })
    .join("\n");
}
