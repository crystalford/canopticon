// runCascade — walk pending sources through the analytical roles.
//
// Right now: pending source → Ingestion Critic → write report, advance the
// source to critic_completed.
//
// Next layers (incremental, not "phased"):
//   - claim_extraction emits structured claim candidates; orchestrator
//     writes claim/claim_versions/claim_entities/claim_sources rows.
//   - Verifier grounds each claim via the Citations API.
//   - Interrogator generates verification questions for any active thesis
//     touched by the new claims.
//
// Runs inline in the Worker for short cascades. When a cascade gets long
// enough to bump up against the Worker CPU budget, it moves to a Durable
// Object — same code, different host.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnthropicClient } from "../lib/anthropic.ts";
import { type InvokeRoleContext, invokeRole } from "./role_runner.ts";

export interface CascadeRunInput {
  user_id: string;
  triggered_by: "cron" | "operator_manual";
  /** Optional: limit how many pending sources to process this run. */
  limit?: number;
}

export interface CascadeRunResult {
  cascade_run_id: string;
  status: "completed" | "failed" | "partial";
  sources_considered: number;
  critic_reports_written: number;
  cost_cents: number;
  errors: Array<{ source_id: string; message: string }>;
}

export interface CascadeContext extends InvokeRoleContext {
  /** Plain SupabaseClient — same as ctx.service. Surfaced separately so
      tests can swap it without touching the role-runner ctx. */
  service: SupabaseClient;
  anthropic: AnthropicClient;
}

export async function runCascade(
  ctx: CascadeContext,
  input: CascadeRunInput,
): Promise<CascadeRunResult> {
  // Open a cascade_runs row up front so the operator can see the cascade
  // started even if it later fails.
  const startedAt = new Date();
  const cascadeRunId = await openCascadeRun(ctx.service, {
    user_id: input.user_id,
    triggered_by: input.triggered_by,
    started_at: startedAt,
  });

  const result: CascadeRunResult = {
    cascade_run_id: cascadeRunId,
    status: "completed",
    sources_considered: 0,
    critic_reports_written: 0,
    cost_cents: 0,
    errors: [],
  };

  try {
    const pending = await fetchPendingSources(ctx.service, input.user_id, input.limit ?? 25);
    result.sources_considered = pending.length;

    for (const source of pending) {
      try {
        const inv = await invokeRole(ctx, {
          user_id: input.user_id,
          role_name: "ingestion_critic",
          triggered_by: `cascade:${cascadeRunId}`,
          related_source_id: source.id,
          snapshot: {
            source: {
              source_type: source.source_type,
              title: source.title,
              publication: source.publication,
              author: source.author,
              published_at: source.published_at,
              ingestion_mode: source.ingestion_mode,
              raw_text: source.raw_text ?? "",
            },
            existing_book_graph_context: "",
            adjacent_claims: "",
          },
          estimate: estimateForCritic(source.raw_text ?? ""),
        });

        if (inv.status === "denied") {
          result.errors.push({
            source_id: source.id,
            message: `cost gate denied: ${inv.decision.message}`,
          });
          continue;
        }

        await writeCriticReport(ctx.service, {
          user_id: input.user_id,
          source_id: source.id,
          role_invocation_id: inv.role_invocation_id,
          structured: inv.output.structured,
        });

        await ctx.service
          .from("sources")
          .update({ ingestion_state: "critic_completed" })
          .eq("id", source.id);

        result.critic_reports_written++;
        result.cost_cents += await readInvocationCost(ctx.service, inv.cost_ledger_id);
      } catch (err) {
        result.errors.push({
          source_id: source.id,
          message: (err as Error).message,
        });
      }
    }

    if (result.errors.length > 0) {
      result.status = result.critic_reports_written > 0 ? "partial" : "failed";
    }
  } catch (err) {
    result.status = "failed";
    result.errors.push({ source_id: "(cascade-level)", message: (err as Error).message });
  }

  await ctx.service
    .from("cascade_runs")
    .update({
      ended_at: new Date().toISOString(),
      status: result.status,
      sources_ingested: result.sources_considered,
      claims_written: 0, // claim_extraction lands here when wired.
      questions_generated: 0, // Interrogator lands here when wired.
      contradictions_detected: 0,
      total_cost_cents: result.cost_cents,
      error_summary: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
    })
    .eq("id", cascadeRunId);

  return result;
}

interface PendingSourceRow {
  id: string;
  source_type: string;
  title: string;
  publication: string | null;
  author: string | null;
  published_at: string | null;
  ingestion_mode: string;
  raw_text: string | null;
}

async function fetchPendingSources(
  client: SupabaseClient,
  user_id: string,
  limit: number,
): Promise<PendingSourceRow[]> {
  const { data, error } = await client
    .from("sources")
    .select("id, source_type, title, publication, author, published_at, ingestion_mode, raw_text")
    .eq("user_id", user_id)
    .eq("ingestion_state", "pending_critic")
    .order("retrieved_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`cascade: failed to list pending sources: ${error.message}`);
  return (data ?? []) as PendingSourceRow[];
}

async function openCascadeRun(
  client: SupabaseClient,
  input: { user_id: string; triggered_by: string; started_at: Date },
): Promise<string> {
  const { data, error } = await client
    .from("cascade_runs")
    .insert({
      user_id: input.user_id,
      triggered_by: input.triggered_by,
      started_at: input.started_at.toISOString(),
      status: "running",
    })
    .select("id")
    .single();
  if (error) throw new Error(`cascade: failed to open cascade_run: ${error.message}`);
  return data.id as string;
}

interface CriticReportFields {
  user_id: string;
  source_id: string;
  role_invocation_id: string;
  structured: unknown;
}

async function writeCriticReport(
  client: SupabaseClient,
  fields: CriticReportFields,
): Promise<void> {
  const report = (fields.structured ?? {}) as Record<string, unknown>;
  const proposed_grade = (report.admiralty_grade as string) ?? "B";
  const bias = report.bias_profile as { spectrum?: string; framing_notes?: string } | undefined;
  const bias_assessment = bias ? `${bias.spectrum ?? "n/a"} — ${bias.framing_notes ?? ""}` : "n/a";
  const compatibility_check = (report.recommendation as string) ?? "approve";
  const reasoning =
    (report.recommendation_reasoning as string) ?? (report.grade_reasoning as string) ?? "";
  const contradiction_flags = (report.contradiction_flags as unknown[]) ?? [];

  const { error } = await client.from("ingestion_critic_reports").insert({
    user_id: fields.user_id,
    source_id: fields.source_id,
    role_invocation_id: fields.role_invocation_id,
    proposed_grade,
    bias_assessment,
    compatibility_check,
    contradiction_flags,
    watch_set_matches: [],
    paid_op_required: false,
    reasoning,
  });
  if (error) throw new Error(`cascade: failed to write critic report: ${error.message}`);
}

async function readInvocationCost(client: SupabaseClient, cost_ledger_id: string): Promise<number> {
  const { data, error } = await client
    .from("cost_ledger")
    .select("cost_cents")
    .eq("id", cost_ledger_id)
    .maybeSingle();
  if (error || !data) return 0;
  return (data.cost_cents as number) ?? 0;
}

function estimateForCritic(raw_text: string): { input_tokens: number; output_tokens: number } {
  // Rough: ~4 chars per token. The Critic's prompt template is ~1.5k chars
  // (~400 tokens) plus the source body. Output is bounded by the schema —
  // typically ~400 tokens of structured JSON.
  const sourceTokens = Math.ceil(raw_text.length / 4);
  return {
    input_tokens: 400 + sourceTokens,
    output_tokens: 600,
  };
}
