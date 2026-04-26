// runIndicatorValidator — fire the Indicator Validator role on a freshly
// declared indicator (or on operator request).
//
// Used by:
//   - POST /v1/indicators (the route runs this inline; persists the
//     resulting validation into indicators.validation_role_invocation_id
//     and surfaces the report to the studio panel).
//   - POST /v1/indicators/:id/validate (manual re-validation).
//
// Output (skills-v1.0 §11): validation, summary, issues[], suggested
// revisions[]. Activation: this orchestrator flips
// role_definitions.is_active=TRUE on first use. Idempotent.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnthropicClient } from "../lib/anthropic.ts";
import type { CostGateDecision } from "./cost_gate.ts";
import { invokeRole } from "./role_runner.ts";

export interface RunIndicatorValidatorInput {
  user_id: string;
  triggered_by: string;
  indicator_id: string;
  proposal_id?: string;
}

export interface IndicatorValidatorReport {
  validation: "valid" | "needs_revision" | "rejected";
  summary: string;
  issues: Array<{
    category: string;
    detail: string;
    severity: "minor" | "notable" | "blocking" | null;
  }>;
  suggested_revisions: Array<{
    field: string;
    suggested_value: string;
    rationale: string;
  }>;
}

export type RunIndicatorValidatorResult =
  | {
      status: "completed";
      role_invocation_id: string;
      report: IndicatorValidatorReport;
    }
  | {
      status: "denied";
      decision: Extract<CostGateDecision, { approved: false }>;
    }
  | {
      status: "skipped";
      reason: string;
    };

export interface IndicatorValidatorContext {
  service: SupabaseClient;
  anthropic: AnthropicClient;
}

export async function runIndicatorValidator(
  ctx: IndicatorValidatorContext,
  input: RunIndicatorValidatorInput,
): Promise<RunIndicatorValidatorResult> {
  await ctx.service
    .from("role_definitions")
    .update({ is_active: true })
    .eq("user_id", input.user_id)
    .eq("name", "indicator_validator");

  const { data: indicator } = await ctx.service
    .from("indicators")
    .select("id, name, definition, source_uri, cadence, threshold, thesis_id")
    .eq("id", input.indicator_id)
    .eq("user_id", input.user_id)
    .maybeSingle<{
      id: string;
      name: string;
      definition: string;
      source_uri: string | null;
      cadence: string | null;
      threshold: unknown;
      thesis_id: string | null;
    }>();
  if (!indicator) return { status: "skipped", reason: "indicator not found" };

  const thesis = indicator.thesis_id
    ? await fetchThesis(ctx.service, input.user_id, indicator.thesis_id)
    : null;
  const related_claims = indicator.thesis_id
    ? await fetchRelatedClaims(ctx.service, indicator.thesis_id)
    : [];

  const inv = await invokeRole(
    { service: ctx.service, anthropic: ctx.anthropic },
    {
      user_id: input.user_id,
      role_name: "indicator_validator",
      triggered_by: input.triggered_by,
      ...(input.proposal_id ? { proposal_id: input.proposal_id } : {}),
      snapshot: {
        thesis: {
          id: thesis?.id ?? "",
          title: thesis?.title ?? "(untethered indicator)",
          bluf: thesis?.bluf ?? "",
        },
        indicator: {
          name: indicator.name,
          definition: indicator.definition,
          source_uri: indicator.source_uri ?? "(none)",
          cadence: indicator.cadence ?? "(unspecified)",
          threshold:
            indicator.threshold === null
              ? "(unspecified)"
              : JSON.stringify(indicator.threshold, null, 2),
        },
        related_claims: renderClaims(related_claims),
      },
      estimate: { input_tokens: 1500 + related_claims.length * 150, output_tokens: 1200 },
      approval_context: {
        indicator_id: indicator.id,
        indicator_name: indicator.name,
        step: "indicator_validator",
      },
    },
  );

  if (inv.status === "denied") {
    return { status: "denied", decision: inv.decision };
  }

  const structured = (inv.output.structured ?? {}) as Partial<IndicatorValidatorReport>;
  const report: IndicatorValidatorReport = {
    validation: structured.validation ?? "needs_revision",
    summary: structured.summary ?? "",
    issues: (structured.issues ?? []).map((i) => ({
      category: i.category ?? "other",
      detail: i.detail ?? "",
      severity: (i.severity ?? null) as "minor" | "notable" | "blocking" | null,
    })),
    suggested_revisions: (structured.suggested_revisions ?? []).map((s) => ({
      field: s.field ?? "definition",
      suggested_value: s.suggested_value ?? "",
      rationale: s.rationale ?? "",
    })),
  };

  await ctx.service
    .from("indicators")
    .update({ validation_role_invocation_id: inv.role_invocation_id })
    .eq("id", input.indicator_id);

  return { status: "completed", role_invocation_id: inv.role_invocation_id, report };
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

async function fetchRelatedClaims(
  client: SupabaseClient,
  thesis_id: string,
): Promise<Array<{ layer: string; grade: string; claim_text: string }>> {
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
    .select("claim_id, claim_text")
    .in("id", versionIds);
  const textByClaim: Record<string, string> = {};
  for (const v of versions ?? []) {
    const row = v as { claim_id: string; claim_text: string };
    textByClaim[row.claim_id] = row.claim_text;
  }
  const tcLayer: Record<string, string> = {};
  for (const tc of tcs ?? []) {
    const row = tc as { claim_id: string; layer: string };
    tcLayer[row.claim_id] = row.layer;
  }

  const out: Array<{ layer: string; grade: string; claim_text: string }> = [];
  for (const c of claims ?? []) {
    const row = c as { id: string; admiralty_grade: string };
    const text = textByClaim[row.id];
    if (!text) continue;
    out.push({ layer: tcLayer[row.id] ?? "factual", grade: row.admiralty_grade, claim_text: text });
  }
  return out;
}

function renderClaims(claims: Array<{ layer: string; grade: string; claim_text: string }>): string {
  if (claims.length === 0) return "(no integrated claims)";
  return claims
    .map((c, i) => `[${i + 1}] (${c.layer}, grade ${c.grade}) ${c.claim_text}`)
    .join("\n");
}
