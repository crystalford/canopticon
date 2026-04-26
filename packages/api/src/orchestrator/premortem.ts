// runPremortem — fire the Premortem role against a *proposed* prediction
// before it lands in the ledger.
//
// Used by:
//   - POST /v1/predictions  (the route runs Premortem first, then writes
//     the prediction with premortem_role_invocation_id linked).
//
// Output (skills-v1.0 §6, schema in packages/shared/skills/premortem/
// schema.json): failure_modes[], calibration_note, recommended_probability,
// summary. Linchpin failure-mode assumptions get persisted directly to
// the assumptions ledger so the operator can see them next to the
// thesis.
//
// Activation: the publication-gate + this orchestrator both flip
// role_definitions.is_active=TRUE on first use. We don't gate predictions
// on whether the role has been activated elsewhere — declaring a
// prediction without the operator first publishing the thesis is fine.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnthropicClient } from "../lib/anthropic.ts";
import type { CostGateDecision } from "./cost_gate.ts";
import { invokeRole } from "./role_runner.ts";

export interface RunPremortemInput {
  user_id: string;
  triggered_by: string;
  thesis_id: string | null;
  prediction: {
    text: string;
    probability: number;
    ipcc_qualifier: string | null;
    resolution_criteria: string;
    resolution_horizon_at: string | null;
    domain: string | null;
  };
  /** Optional: caller-supplied proposal_id to consume an approved cost gate. */
  proposal_id?: string;
}

export interface PremortemReport {
  failure_modes: Array<{
    narrative: string;
    category: string | null;
    conditional_probability: number;
    linchpin_assumption: string | null;
    consequence_if_failed: string | null;
  }>;
  calibration_note: "too_high" | "about_right" | "too_low" | "malformed";
  recommended_probability: number | null;
  summary: string;
}

export type RunPremortemResult =
  | {
      status: "completed";
      role_invocation_id: string;
      report: PremortemReport;
      assumptions_written: number;
    }
  | {
      status: "denied";
      decision: Extract<CostGateDecision, { approved: false }>;
    };

export interface PremortemContext {
  service: SupabaseClient;
  anthropic: AnthropicClient;
}

interface ThesisSnapshot {
  id: string;
  title: string;
  bluf: string | null;
}

interface ClaimSnapshot {
  layer: string;
  grade: string;
  claim_text: string;
}

interface PriorPredictionSnapshot {
  text: string;
  probability: number;
  status: string;
  resolved_at: string | null;
  brier_contribution: number | null;
}

export async function runPremortem(
  ctx: PremortemContext,
  input: RunPremortemInput,
): Promise<RunPremortemResult> {
  // Activate the role on first use. Idempotent.
  await ctx.service
    .from("role_definitions")
    .update({ is_active: true })
    .eq("user_id", input.user_id)
    .eq("name", "premortem");

  const [thesis, related_claims, prior_predictions] = await Promise.all([
    input.thesis_id
      ? fetchThesis(ctx.service, input.user_id, input.thesis_id)
      : Promise.resolve(null),
    input.thesis_id ? fetchRelatedClaims(ctx.service, input.thesis_id) : Promise.resolve([]),
    fetchPriorPredictions(ctx.service, input.user_id, input.thesis_id),
  ]);

  const inv = await invokeRole(
    { service: ctx.service, anthropic: ctx.anthropic },
    {
      user_id: input.user_id,
      role_name: "premortem",
      triggered_by: input.triggered_by,
      ...(input.proposal_id ? { proposal_id: input.proposal_id } : {}),
      snapshot: {
        thesis: {
          id: thesis?.id ?? "",
          title: thesis?.title ?? "(untethered prediction)",
          bluf: thesis?.bluf ?? "",
        },
        prediction: {
          text: input.prediction.text,
          probability: input.prediction.probability.toFixed(3),
          ipcc_qualifier: input.prediction.ipcc_qualifier ?? "",
          resolution_criteria: input.prediction.resolution_criteria,
          resolution_horizon: input.prediction.resolution_horizon_at ?? "(open-ended)",
          domain: input.prediction.domain ?? "",
        },
        related_claims: renderClaims(related_claims),
        prior_predictions: renderPriorPredictions(prior_predictions),
      },
      estimate: { input_tokens: 1500 + related_claims.length * 200, output_tokens: 1800 },
      approval_context: {
        thesis_id: input.thesis_id,
        prediction_text: input.prediction.text.slice(0, 200),
        step: "premortem",
      },
    },
  );

  if (inv.status === "denied") {
    return { status: "denied", decision: inv.decision };
  }

  const structured = (inv.output.structured ?? {}) as Partial<{
    failure_modes: Array<{
      narrative?: string;
      category?: string;
      conditional_probability?: number;
      linchpin_assumption?: string;
      consequence_if_failed?: string;
    }>;
    calibration_note: PremortemReport["calibration_note"];
    recommended_probability: number;
    summary: string;
  }>;

  const failure_modes = (structured.failure_modes ?? [])
    .filter(
      (
        fm,
      ): fm is {
        narrative: string;
        category?: string;
        conditional_probability: number;
        linchpin_assumption?: string;
        consequence_if_failed?: string;
      } =>
        typeof fm.narrative === "string" &&
        fm.narrative.length > 0 &&
        typeof fm.conditional_probability === "number",
    )
    .map((fm) => ({
      narrative: fm.narrative,
      category: fm.category ?? null,
      conditional_probability: fm.conditional_probability,
      linchpin_assumption: fm.linchpin_assumption ?? null,
      consequence_if_failed: fm.consequence_if_failed ?? null,
    }));

  const report: PremortemReport = {
    failure_modes,
    calibration_note: structured.calibration_note ?? "about_right",
    recommended_probability:
      typeof structured.recommended_probability === "number"
        ? structured.recommended_probability
        : null,
    summary: structured.summary ?? "",
  };

  // Persist any linchpin assumptions the Premortem flagged so they show
  // up in the assumptions ledger next to the thesis.
  let assumptions_written = 0;
  if (input.thesis_id) {
    for (const fm of failure_modes) {
      if (!fm.linchpin_assumption) continue;
      const { error } = await ctx.service.from("assumptions").insert({
        user_id: input.user_id,
        thesis_id: input.thesis_id,
        text: fm.linchpin_assumption,
        status: "holding",
        is_linchpin: true,
        consequence_if_failed: fm.consequence_if_failed,
        last_audit_role_invocation_id: inv.role_invocation_id,
      });
      if (!error) assumptions_written++;
    }
  }

  return {
    status: "completed",
    role_invocation_id: inv.role_invocation_id,
    report,
    assumptions_written,
  };
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

  return { id: thesis.id, title: thesis.title, bluf };
}

async function fetchRelatedClaims(
  client: SupabaseClient,
  thesis_id: string,
): Promise<ClaimSnapshot[]> {
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

  const out: ClaimSnapshot[] = [];
  for (const c of claims ?? []) {
    const row = c as { id: string; admiralty_grade: string };
    const text = textByClaim[row.id];
    if (!text) continue;
    out.push({
      layer: tcLayer[row.id] ?? "factual",
      grade: row.admiralty_grade,
      claim_text: text,
    });
  }
  return out;
}

async function fetchPriorPredictions(
  client: SupabaseClient,
  user_id: string,
  thesis_id: string | null,
): Promise<PriorPredictionSnapshot[]> {
  let q = client
    .from("predictions")
    .select("text, probability, status, resolved_at, brier_contribution")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (thesis_id) q = q.eq("thesis_id", thesis_id);
  const { data } = await q;
  return (data ?? []) as PriorPredictionSnapshot[];
}

function renderClaims(claims: ClaimSnapshot[]): string {
  if (claims.length === 0) return "(no integrated claims)";
  return claims
    .map((c, i) => `[${i + 1}] (${c.layer}, grade ${c.grade}) ${c.claim_text}`)
    .join("\n");
}

function renderPriorPredictions(rows: PriorPredictionSnapshot[]): string {
  if (rows.length === 0) return "(no prior predictions)";
  return rows
    .map((p) => {
      const brier =
        p.brier_contribution !== null ? `, brier=${p.brier_contribution.toFixed(3)}` : "";
      return `- p=${p.probability.toFixed(2)} [${p.status}${brier}] ${p.text}`;
    })
    .join("\n");
}
