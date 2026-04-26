// runCascade — walk the substrate forward through the analytical roles.
//
// Three steps, each a state-machine transition:
//
//   A. pending_critic sources → Ingestion Critic → critic_completed.
//      Writes ingestion_critic_reports row.
//
//   B. approved sources without extracted claims → claim_extraction →
//      writes claims / claim_versions / claim_sources / entity_mentions.
//      Operator promotes a critic_completed source to "approved" via the
//      /sources/:id/approve route — that's the gate between the Critic
//      and claim_extraction.
//
//   C. claims with verification_status='unverified' → Verifier →
//      updates claims.verification_status. Uses the Citations API to
//      ground each claim against the source body.
//
// Interrogator (step D) lands here when theses exist.
//
// Runs inline in the Worker. When a cascade gets long enough to bump up
// against the Worker CPU budget, it moves to a Durable Object — same
// orchestrator code, different host.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnthropicClient } from "../lib/anthropic.ts";
import { runAssumptionAuditor } from "./assumption_auditor.ts";
import { runEntityResolver } from "./entity_resolver.ts";
import { runGapSurfacer } from "./gap_surfacer.ts";
import { runInterrogator } from "./interrogator.ts";
import { type InvokeRoleContext, invokeRole } from "./role_runner.ts";

export interface CascadeRunInput {
  user_id: string;
  triggered_by: "cron" | "operator_manual";
  /** Optional: cap how many sources this cascade processes per step. */
  limit?: number;
}

export interface CascadeRunResult {
  cascade_run_id: string;
  status: "completed" | "failed" | "partial";
  sources_considered: number;
  critic_reports_written: number;
  claims_extracted: number;
  claims_verified: number;
  questions_generated: number;
  assumptions_audited: number;
  gaps_surfaced: number;
  entities_resolved: number;
  cost_cents: number;
  errors: Array<{ ref: string; step: string; message: string }>;
}

export interface CascadeContext extends InvokeRoleContext {
  service: SupabaseClient;
  anthropic: AnthropicClient;
}

const DEFAULT_LIMIT = 25;

export async function runCascade(
  ctx: CascadeContext,
  input: CascadeRunInput,
): Promise<CascadeRunResult> {
  const startedAt = new Date();
  const cascadeRunId = await openCascadeRun(ctx.service, {
    user_id: input.user_id,
    triggered_by: input.triggered_by,
    started_at: startedAt,
  });

  const limit = input.limit ?? DEFAULT_LIMIT;

  const result: CascadeRunResult = {
    cascade_run_id: cascadeRunId,
    status: "completed",
    sources_considered: 0,
    critic_reports_written: 0,
    claims_extracted: 0,
    claims_verified: 0,
    questions_generated: 0,
    assumptions_audited: 0,
    gaps_surfaced: 0,
    entities_resolved: 0,
    cost_cents: 0,
    errors: [],
  };

  try {
    await stepCritic(ctx, input, cascadeRunId, limit, result);
    await stepClaimExtraction(ctx, input, cascadeRunId, limit, result);
    await stepEntityResolution(ctx, input, result);
    await stepVerifier(ctx, input, cascadeRunId, limit, result);
    await stepInterrogator(ctx, input, cascadeRunId, result);
    await stepGapSurfacer(ctx, input, cascadeRunId, result);
    await stepAssumptionAudit(ctx, input, cascadeRunId, result);

    if (result.errors.length > 0) {
      const anyProgress =
        result.critic_reports_written > 0 ||
        result.claims_extracted > 0 ||
        result.claims_verified > 0 ||
        result.questions_generated > 0 ||
        result.assumptions_audited > 0 ||
        result.gaps_surfaced > 0 ||
        result.entities_resolved > 0;
      result.status = anyProgress ? "partial" : "failed";
    }
  } catch (err) {
    result.status = "failed";
    result.errors.push({
      ref: "(cascade-level)",
      step: "outer",
      message: (err as Error).message,
    });
  }

  await closeCascadeRun(ctx.service, cascadeRunId, result);

  return result;
}

// --- Step A: Ingestion Critic ---------------------------------------------

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

async function stepCritic(
  ctx: CascadeContext,
  input: CascadeRunInput,
  cascadeRunId: string,
  limit: number,
  result: CascadeRunResult,
): Promise<void> {
  const pending = await fetchPendingSources(ctx.service, input.user_id, limit);
  result.sources_considered += pending.length;

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
        approval_context: { source_id: source.id, source_title: source.title, step: "critic" },
      });

      if (inv.status === "denied") {
        result.errors.push({
          ref: source.id,
          step: "critic",
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
        ref: source.id,
        step: "critic",
        message: (err as Error).message,
      });
    }
  }
}

// --- Step B: claim_extraction --------------------------------------------

interface ApprovedSourceRow {
  id: string;
  source_type: string;
  title: string;
  publication: string | null;
  author: string | null;
  published_at: string | null;
  admiralty_grade: string;
  raw_text: string | null;
}

interface ExtractedClaim {
  data: string;
  claim_text: string;
  warrant: string | null;
  qualifier: string | null;
  rebuttal: string | null;
  layer: "factual" | "framing" | "architectural" | "distributive";
  admiralty_grade: "A" | "B" | "C" | "D" | "E" | "F";
  source_passage: string;
  entities: Array<{
    surface_text: string;
    entity_type_hint: string;
    context_excerpt?: string;
  }>;
}

async function stepClaimExtraction(
  ctx: CascadeContext,
  input: CascadeRunInput,
  cascadeRunId: string,
  limit: number,
  result: CascadeRunResult,
): Promise<void> {
  const approved = await fetchApprovedSourcesNeedingExtraction(ctx.service, input.user_id, limit);

  for (const source of approved) {
    try {
      const inv = await invokeRole(ctx, {
        user_id: input.user_id,
        role_name: "claim_extraction",
        triggered_by: `cascade:${cascadeRunId}`,
        related_source_id: source.id,
        snapshot: {
          source: {
            source_type: source.source_type,
            title: source.title,
            publication: source.publication,
            author: source.author,
            published_at: source.published_at,
            admiralty_grade: source.admiralty_grade,
            raw_text: source.raw_text ?? "",
          },
          active_thesis_concepts: "",
        },
        estimate: estimateForExtraction(source.raw_text ?? ""),
        approval_context: {
          source_id: source.id,
          source_title: source.title,
          step: "claim_extraction",
        },
      });

      if (inv.status === "denied") {
        result.errors.push({
          ref: source.id,
          step: "claim_extraction",
          message: `cost gate denied: ${inv.decision.message}`,
        });
        continue;
      }

      const extracted = (inv.output.structured ?? {}) as { claims?: ExtractedClaim[] };
      const claims = extracted.claims ?? [];

      for (const claim of claims) {
        await writeExtractedClaim(ctx.service, {
          user_id: input.user_id,
          source_id: source.id,
          source_grade: source.admiralty_grade,
          role_invocation_id: inv.role_invocation_id,
          claim,
        });
        result.claims_extracted++;
      }

      result.cost_cents += await readInvocationCost(ctx.service, inv.cost_ledger_id);
    } catch (err) {
      result.errors.push({
        ref: source.id,
        step: "claim_extraction",
        message: (err as Error).message,
      });
    }
  }
}

interface WriteClaimInput {
  user_id: string;
  source_id: string;
  source_grade: string;
  role_invocation_id: string;
  claim: ExtractedClaim;
}

async function writeExtractedClaim(client: SupabaseClient, input: WriteClaimInput): Promise<void> {
  // Inherit the source's grade unless the extractor specifically suggested
  // a different one. The Critic has already vetted the source; the claim
  // grade can deviate (e.g., a quoted A-grade primary inside a B-grade
  // secondary), so we trust the extractor's per-claim grade.
  const grade = input.claim.admiralty_grade ?? input.source_grade ?? "B";

  // 1. claims row.
  const { data: claimRow, error: claimErr } = await client
    .from("claims")
    .insert({
      user_id: input.user_id,
      layer: input.claim.layer,
      admiralty_grade: grade,
      verification_status: "unverified",
    })
    .select("id")
    .single();
  if (claimErr) throw new Error(`claim_extraction: write claim failed: ${claimErr.message}`);

  const claimId = claimRow.id as string;

  // 2. claim_versions row (current).
  const { data: versionRow, error: versionErr } = await client
    .from("claim_versions")
    .insert({
      claim_id: claimId,
      user_id: input.user_id,
      version_number: 1,
      is_current: true,
      data: input.claim.data,
      claim_text: input.claim.claim_text,
      warrant: input.claim.warrant,
      qualifier: input.claim.qualifier,
      rebuttal: input.claim.rebuttal,
      primary_source_id: input.source_id,
      written_by_role: "claim_extraction",
      written_by_role_invocation_id: input.role_invocation_id,
      change_summary: "extracted by claim_extraction",
    })
    .select("id")
    .single();
  if (versionErr) {
    throw new Error(`claim_extraction: write version failed: ${versionErr.message}`);
  }

  // 3. Patch claims.current_version_id.
  await client
    .from("claims")
    .update({ current_version_id: versionRow.id as string })
    .eq("id", claimId);

  // 4. claim_sources row linking the claim to its primary source as supports.
  await client.from("claim_sources").insert({
    user_id: input.user_id,
    claim_id: claimId,
    source_id: input.source_id,
    supports: true,
    excerpt: input.claim.source_passage.slice(0, 2000),
  });

  // 5. entity_mentions per entity surface text. entity_id stays NULL until
  // the entity-resolution pipeline runs. claim_entities is NOT written here
  // — that table requires a non-null entity_id and lives downstream of
  // resolution (see canopticon-entity-resolution-v1.0.md).
  for (const entity of input.claim.entities) {
    await client.from("entity_mentions").insert({
      user_id: input.user_id,
      source_id: input.source_id,
      entity_id: null,
      mention_text: entity.surface_text,
      context_excerpt: entity.context_excerpt ?? input.claim.source_passage.slice(0, 500),
    });
  }
}

// --- Step C: Verifier -----------------------------------------------------

interface UnverifiedClaimRow {
  id: string;
  current_version_id: string | null;
  admiralty_grade: string;
}

interface ClaimVersionForVerifyRow {
  id: string;
  data: string;
  claim_text: string;
  warrant: string | null;
  qualifier: string | null;
  primary_source_id: string;
}

interface SourceForVerifyRow {
  id: string;
  title: string;
  source_type: string;
  raw_text: string | null;
}

async function stepVerifier(
  ctx: CascadeContext,
  input: CascadeRunInput,
  cascadeRunId: string,
  limit: number,
  result: CascadeRunResult,
): Promise<void> {
  const unverified = await fetchUnverifiedClaims(ctx.service, input.user_id, limit);

  for (const claim of unverified) {
    if (!claim.current_version_id) continue;
    try {
      const { data: version, error: vErr } = await ctx.service
        .from("claim_versions")
        .select("id, data, claim_text, warrant, qualifier, primary_source_id")
        .eq("id", claim.current_version_id)
        .maybeSingle<ClaimVersionForVerifyRow>();
      if (vErr || !version) continue;

      const { data: source, error: sErr } = await ctx.service
        .from("sources")
        .select("id, title, source_type, raw_text")
        .eq("id", version.primary_source_id)
        .maybeSingle<SourceForVerifyRow>();
      if (sErr || !source) continue;

      const inv = await invokeRole(ctx, {
        user_id: input.user_id,
        role_name: "verifier",
        triggered_by: `cascade:${cascadeRunId}`,
        related_source_id: source.id,
        snapshot: {
          claim: {
            id: claim.id,
            data: version.data,
            claim_text: version.claim_text,
            warrant: version.warrant,
            qualifier: version.qualifier,
            admiralty_grade: claim.admiralty_grade,
          },
          source: {
            id: source.id,
            source_type: source.source_type,
            title: source.title,
            raw_text: source.raw_text ?? "",
          },
        },
        documents: source.raw_text ? [{ title: source.title, text: source.raw_text }] : [],
        estimate: estimateForVerifier(source.raw_text ?? "", version.claim_text),
        approval_context: {
          claim_id: claim.id,
          claim_text: version.claim_text.slice(0, 200),
          source_title: source.title,
          step: "verifier",
        },
      });

      if (inv.status === "denied") {
        result.errors.push({
          ref: claim.id,
          step: "verifier",
          message: `cost gate denied: ${inv.decision.message}`,
        });
        continue;
      }

      const structured = (inv.output.structured ?? {}) as {
        verification_status?: "grounded" | "partial" | "unsupported" | "contradicted";
      };
      const newStatus = structured.verification_status ?? "partial";

      await ctx.service
        .from("claims")
        .update({ verification_status: newStatus })
        .eq("id", claim.id);

      result.claims_verified++;
      result.cost_cents += await readInvocationCost(ctx.service, inv.cost_ledger_id);
    } catch (err) {
      result.errors.push({
        ref: claim.id,
        step: "verifier",
        message: (err as Error).message,
      });
    }
  }
}

// --- Step D: Interrogator --------------------------------------------------

async function stepInterrogator(
  ctx: CascadeContext,
  input: CascadeRunInput,
  cascadeRunId: string,
  result: CascadeRunResult,
): Promise<void> {
  // For each active thesis, fire the Interrogator if it has integrated
  // claims and either no last interrogation or new claims integrated since
  // the last one. Cheap heuristic: fire once per cascade per thesis. If
  // there are no claims, runInterrogator returns 'skipped' — no cost.
  const { data: theses, error } = await ctx.service
    .from("theses")
    .select("id")
    .eq("user_id", input.user_id)
    .neq("status", "archived");
  if (error) {
    result.errors.push({ ref: "(interrogator)", step: "interrogator", message: error.message });
    return;
  }

  for (const t of theses ?? []) {
    const thesisId = (t as { id: string }).id;
    try {
      const r = await runInterrogator(
        { service: ctx.service, anthropic: ctx.anthropic },
        {
          user_id: input.user_id,
          thesis_id: thesisId,
          triggered_by: `cascade:${cascadeRunId}`,
        },
      );
      if (r.status === "completed") {
        result.questions_generated += r.questions_written;
      } else if (r.status === "denied") {
        result.errors.push({
          ref: thesisId,
          step: "interrogator",
          message: `cost gate denied: ${r.decision.message}`,
        });
      }
      // 'skipped' is silent — most theses won't have claims yet.
    } catch (err) {
      result.errors.push({
        ref: thesisId,
        step: "interrogator",
        message: (err as Error).message,
      });
    }
  }
}

// --- Step F: Gap Surfacer ------------------------------------------------

async function stepGapSurfacer(
  ctx: CascadeContext,
  input: CascadeRunInput,
  cascadeRunId: string,
  result: CascadeRunResult,
): Promise<void> {
  const { data: theses, error } = await ctx.service
    .from("theses")
    .select("id")
    .eq("user_id", input.user_id)
    .neq("status", "archived");
  if (error) {
    result.errors.push({ ref: "(gap_surfacer)", step: "gap_surfacer", message: error.message });
    return;
  }

  for (const t of theses ?? []) {
    const thesisId = (t as { id: string }).id;
    try {
      const r = await runGapSurfacer(
        { service: ctx.service, anthropic: ctx.anthropic },
        {
          user_id: input.user_id,
          thesis_id: thesisId,
          triggered_by: `cascade:${cascadeRunId}`,
        },
      );
      if (r.status === "completed") {
        result.gaps_surfaced += r.report.gaps.length;
        result.questions_generated += r.questions_written;
      } else if (r.status === "denied") {
        result.errors.push({
          ref: thesisId,
          step: "gap_surfacer",
          message: `cost gate denied: ${r.decision.message}`,
        });
      }
    } catch (err) {
      result.errors.push({
        ref: thesisId,
        step: "gap_surfacer",
        message: (err as Error).message,
      });
    }
  }
}

// --- Step G: Entity Resolution -------------------------------------------

async function stepEntityResolution(
  ctx: CascadeContext,
  input: CascadeRunInput,
  result: CascadeRunResult,
): Promise<void> {
  try {
    const r = await runEntityResolver(
      { service: ctx.service },
      { user_id: input.user_id, triggered_by: "cascade" },
    );
    result.entities_resolved += r.mentions_resolved_exact + r.mentions_resolved_high;
  } catch (err) {
    result.errors.push({
      ref: "(entity_resolver)",
      step: "entity_resolver",
      message: (err as Error).message,
    });
  }
}

// --- Step E: Assumption Auditor ------------------------------------------

const STALE_AUDIT_DAYS = 14;

async function stepAssumptionAudit(
  ctx: CascadeContext,
  input: CascadeRunInput,
  cascadeRunId: string,
  result: CascadeRunResult,
): Promise<void> {
  // Sweep theses with linchpin assumptions whose last_audited_at is null
  // or older than STALE_AUDIT_DAYS. Group by thesis_id; one auditor run
  // per thesis processes all stale linchpins for that thesis at once.
  const cutoff = new Date(Date.now() - STALE_AUDIT_DAYS * 86_400_000).toISOString();
  const { data: stale, error } = await ctx.service
    .from("assumptions")
    .select("id, thesis_id, last_audited_at")
    .eq("user_id", input.user_id)
    .eq("is_linchpin", true)
    .neq("status", "retired")
    .or(`last_audited_at.is.null,last_audited_at.lt.${cutoff}`);
  if (error) {
    result.errors.push({
      ref: "(assumption_audit)",
      step: "assumption_auditor",
      message: error.message,
    });
    return;
  }

  const byThesis: Record<string, string[]> = {};
  for (const row of stale ?? []) {
    const r = row as { id: string; thesis_id: string | null };
    if (!r.thesis_id) continue;
    const list = byThesis[r.thesis_id] ?? [];
    list.push(r.id);
    byThesis[r.thesis_id] = list;
  }

  for (const [thesis_id, assumption_ids] of Object.entries(byThesis)) {
    try {
      const r = await runAssumptionAuditor(
        { service: ctx.service, anthropic: ctx.anthropic },
        {
          user_id: input.user_id,
          triggered_by: `cascade:${cascadeRunId}`,
          thesis_id,
          assumption_ids,
        },
      );
      if (r.status === "completed") {
        result.assumptions_audited += r.assumptions_updated;
      } else if (r.status === "denied") {
        result.errors.push({
          ref: thesis_id,
          step: "assumption_auditor",
          message: `cost gate denied: ${r.decision.message}`,
        });
      }
    } catch (err) {
      result.errors.push({
        ref: thesis_id,
        step: "assumption_auditor",
        message: (err as Error).message,
      });
    }
  }
}

// --- queries --------------------------------------------------------------

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

async function fetchApprovedSourcesNeedingExtraction(
  client: SupabaseClient,
  user_id: string,
  limit: number,
): Promise<ApprovedSourceRow[]> {
  // Two-query approach: pull approved sources, then pull the set of
  // primary_source_ids that already have claim_versions, take the
  // difference. Cleaner than a left-join via the JS client and the
  // volumes are small enough that the extra round-trip doesn't matter.
  const { data: approved, error: aErr } = await client
    .from("sources")
    .select("id, source_type, title, publication, author, published_at, admiralty_grade, raw_text")
    .eq("user_id", user_id)
    .eq("ingestion_state", "approved")
    .order("retrieved_at", { ascending: true })
    .limit(limit * 4);
  if (aErr) throw new Error(`cascade: list approved sources failed: ${aErr.message}`);

  const sources = (approved ?? []) as ApprovedSourceRow[];
  if (sources.length === 0) return [];

  const ids = sources.map((s) => s.id);
  const { data: extracted, error: eErr } = await client
    .from("claim_versions")
    .select("primary_source_id")
    .eq("user_id", user_id)
    .in("primary_source_id", ids);
  if (eErr) throw new Error(`cascade: list extracted source ids failed: ${eErr.message}`);

  const alreadyExtracted = new Set(
    (extracted ?? []).map((r) => (r as { primary_source_id: string }).primary_source_id),
  );
  return sources.filter((s) => !alreadyExtracted.has(s.id)).slice(0, limit);
}

async function fetchUnverifiedClaims(
  client: SupabaseClient,
  user_id: string,
  limit: number,
): Promise<UnverifiedClaimRow[]> {
  const { data, error } = await client
    .from("claims")
    .select("id, current_version_id, admiralty_grade")
    .eq("user_id", user_id)
    .eq("verification_status", "unverified")
    .eq("is_archived", false)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`cascade: list unverified claims failed: ${error.message}`);
  return (data ?? []) as UnverifiedClaimRow[];
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

async function closeCascadeRun(
  client: SupabaseClient,
  cascadeRunId: string,
  result: CascadeRunResult,
): Promise<void> {
  await client
    .from("cascade_runs")
    .update({
      ended_at: new Date().toISOString(),
      status: result.status,
      sources_ingested: result.sources_considered,
      claims_written: result.claims_extracted,
      questions_generated: result.questions_generated,
      contradictions_detected: 0, // Red Team lands here on publication-gate.
      total_cost_cents: result.cost_cents,
      error_summary: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
    })
    .eq("id", cascadeRunId);
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
  const sourceTokens = Math.ceil(raw_text.length / 4);
  return { input_tokens: 400 + sourceTokens, output_tokens: 600 };
}

function estimateForExtraction(raw_text: string): { input_tokens: number; output_tokens: number } {
  const sourceTokens = Math.ceil(raw_text.length / 4);
  // Output can be substantial — up to 10 claims with full Toulmin fields.
  return { input_tokens: 500 + sourceTokens, output_tokens: 2500 };
}

function estimateForVerifier(
  raw_text: string,
  claim_text: string,
): { input_tokens: number; output_tokens: number } {
  const sourceTokens = Math.ceil(raw_text.length / 4);
  const claimTokens = Math.ceil(claim_text.length / 4);
  return { input_tokens: 400 + sourceTokens + claimTokens, output_tokens: 800 };
}
