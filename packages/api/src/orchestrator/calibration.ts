// runCalibration — fire the Calibration role over the operator's
// resolved-prediction history and write a narrative reflection.
//
// Used by:
//   - POST /v1/predictions/:id/resolve  (auto-fire after each resolution)
//   - POST /v1/calibration/run          (manual fire from /predictions)
//
// Output (skills-v1.0 §10): narrative, trend, per-band bins, optional
// per-domain breakdown, adjustment_advice. We persist the full report
// on role_invocations.output_structured; the most-recent report is
// surfaced through /v1/calibration/latest. The role activates lazily.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnthropicClient } from "../lib/anthropic.ts";
import type { CostGateDecision } from "./cost_gate.ts";
import { invokeRole } from "./role_runner.ts";

export interface RunCalibrationInput {
  user_id: string;
  triggered_by: string;
  /** Optional: id of the prediction whose resolution triggered this run. */
  triggered_by_prediction_id?: string;
  proposal_id?: string;
}

export interface CalibrationReport {
  narrative: string;
  trend: "improving" | "stable" | "degrading" | "insufficient_data";
  bins: Array<{ band: string; n: number; empirical_rate: number; note?: string }>;
  domain_breakdown: Array<{ domain: string; n: number; brier: number; note?: string }>;
  adjustment_advice: string[];
}

export type RunCalibrationResult =
  | { status: "completed"; role_invocation_id: string; report: CalibrationReport }
  | { status: "denied"; decision: Extract<CostGateDecision, { approved: false }> }
  | { status: "skipped"; reason: string };

export interface CalibrationContext {
  service: SupabaseClient;
  anthropic: AnthropicClient;
}

interface ResolvedPredictionRow {
  id: string;
  text: string;
  probability: number;
  status: string;
  resolved_at: string | null;
  brier_contribution: number | null;
  domain: string | null;
  thesis_id: string | null;
}

const MIN_RESOLVED_TO_RUN = 1;

export async function runCalibration(
  ctx: CalibrationContext,
  input: RunCalibrationInput,
): Promise<RunCalibrationResult> {
  await ctx.service
    .from("role_definitions")
    .update({ is_active: true })
    .eq("user_id", input.user_id)
    .eq("name", "calibration");

  const resolved = await fetchResolvedPredictions(ctx.service, input.user_id);
  if (resolved.length < MIN_RESOLVED_TO_RUN) {
    return { status: "skipped", reason: "no resolved predictions yet" };
  }

  const summary = computeSummary(resolved);
  const justResolvedId = input.triggered_by_prediction_id;
  const justResolved = justResolvedId
    ? (resolved.find((r) => r.id === justResolvedId) ?? null)
    : null;

  const inv = await invokeRole(
    { service: ctx.service, anthropic: ctx.anthropic },
    {
      user_id: input.user_id,
      role_name: "calibration",
      triggered_by: input.triggered_by,
      ...(input.proposal_id ? { proposal_id: input.proposal_id } : {}),
      snapshot: {
        summary: {
          resolved_count: summary.resolved_count.toString(),
          active_count: summary.active_count.toString(),
          rolling_brier: summary.rolling_brier !== null ? summary.rolling_brier.toFixed(3) : "n/a",
        },
        resolved_predictions: renderResolved(resolved),
        just_resolved: justResolved
          ? `${justResolved.status} · p=${justResolved.probability.toFixed(2)} · brier=${justResolved.brier_contribution?.toFixed(3) ?? "?"} · ${justResolved.text}`
          : "(none)",
      },
      estimate: {
        input_tokens: 1500 + resolved.length * 100,
        output_tokens: 1200,
      },
      approval_context: {
        resolved_count: summary.resolved_count,
        rolling_brier: summary.rolling_brier,
        step: "calibration",
      },
    },
  );

  if (inv.status === "denied") return { status: "denied", decision: inv.decision };

  const structured = (inv.output.structured ?? {}) as Partial<CalibrationReport>;
  const report: CalibrationReport = {
    narrative: structured.narrative ?? "",
    trend: structured.trend ?? "insufficient_data",
    bins: Array.isArray(structured.bins) ? structured.bins : [],
    domain_breakdown: Array.isArray(structured.domain_breakdown) ? structured.domain_breakdown : [],
    adjustment_advice: Array.isArray(structured.adjustment_advice)
      ? structured.adjustment_advice
      : [],
  };

  return { status: "completed", role_invocation_id: inv.role_invocation_id, report };
}

async function fetchResolvedPredictions(
  client: SupabaseClient,
  user_id: string,
): Promise<ResolvedPredictionRow[]> {
  const { data } = await client
    .from("predictions")
    .select("id, text, probability, status, resolved_at, brier_contribution, domain, thesis_id")
    .eq("user_id", user_id)
    .neq("status", "active")
    .neq("status", "retired")
    .order("resolved_at", { ascending: false })
    .limit(200);
  return (data ?? []) as ResolvedPredictionRow[];
}

interface Summary {
  resolved_count: number;
  active_count: number;
  rolling_brier: number | null;
}

function computeSummary(rows: ResolvedPredictionRow[]): Summary {
  let resolved = 0;
  let total = 0;
  for (const r of rows) {
    if (r.brier_contribution !== null && r.brier_contribution !== undefined) {
      resolved++;
      total += Number(r.brier_contribution);
    }
  }
  return {
    resolved_count: resolved,
    active_count: 0,
    rolling_brier: resolved > 0 ? Math.round((total / resolved) * 10000) / 10000 : null,
  };
}

function renderResolved(rows: ResolvedPredictionRow[]): string {
  if (rows.length === 0) return "(none)";
  return rows
    .map((p) => {
      const brier =
        p.brier_contribution !== null ? `, brier=${Number(p.brier_contribution).toFixed(3)}` : "";
      const domain = p.domain ? `, domain=${p.domain}` : "";
      const at = p.resolved_at ? `, at ${p.resolved_at.slice(0, 10)}` : "";
      return `- p=${Number(p.probability).toFixed(2)} [${p.status}${brier}${domain}${at}] ${p.text}`;
    })
    .join("\n");
}
