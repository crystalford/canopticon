// invokeRole — the single entry point for running a Claude Skill against a
// substrate snapshot.
//
// Responsibilities:
//   1. Look up the role_definitions row (carries the prompt_template,
//      model, feature flags, and JSON schema).
//   2. Render the prompt by substituting snapshot values into the template.
//   3. Estimate cost; pass through the cost gate.
//   4. If approved, call Anthropic with the right feature combination.
//   5. Persist a role_invocations row capturing inputs and outputs.
//   6. Charge cost_ledger from the actual reported usage.
//   7. Return the structured / text result for the caller to apply
//      substrate writes inside its own transaction.
//
// The role runner does NOT write to substrate beyond role_invocations and
// cost_ledger. That separation keeps the runner stateless wrt the domain
// substrate — the calling workflow owns how outputs become claims,
// questions, etc.

import type { CostOperationType, RoleName } from "@canopticon/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AnthropicCallOutput,
  type AnthropicClient,
  type AnthropicMessage,
  actualCostCents,
  estimateCostCents,
} from "../lib/anthropic.ts";
import {
  type CostGateContext,
  type CostGateDecision,
  approvePaidOperation,
  chargeLedger,
} from "./cost_gate.ts";
import { renderTemplate } from "./template.ts";

export interface InvokeRoleInput {
  user_id: string;
  role_name: RoleName;
  /** Where this invocation was triggered from. Free-form string for the audit log. */
  triggered_by: string;
  /** Snapshot of substrate slice the role reads. Persisted on role_invocations.input_substrate. */
  snapshot: Record<string, unknown>;
  /** Optional: estimated input/output tokens for the cost gate. Defaults are conservative. */
  estimate?: { input_tokens: number; output_tokens: number };
  /** Optional: source ID this invocation pertains to (for cost_ledger.related_source_id). */
  related_source_id?: string;
  /** Optional: documents to pass to the Citations API. Only valid when the role uses citations. */
  documents?: Array<{ title: string; text: string }>;
  /** Optional: max_tokens override. Defaults to 4096. */
  max_tokens?: number;
  /** Optional: a previously-issued cost_approvals.proposal_id to consume.
      Pass this on retry after the operator approves a paused operation. */
  proposal_id?: string;
  /** Optional: free-form context written to cost_approvals.context when the
      gate creates a pending approval. Surfaced to the operator in the modal. */
  approval_context?: Record<string, unknown>;
}

export type InvokeRoleResult =
  | {
      status: "completed";
      role_invocation_id: string;
      cost_ledger_id: string;
      output: AnthropicCallOutput;
    }
  | {
      status: "denied";
      decision: Extract<CostGateDecision, { approved: false }>;
    };

export interface InvokeRoleContext extends CostGateContext {
  anthropic: AnthropicClient;
}

interface RoleDefinitionRow {
  id: string;
  name: RoleName;
  prompt_template: string;
  default_model: string;
  uses_citations_api: boolean;
  uses_structured_output: boolean;
  output_schema: Record<string, unknown> | null;
  is_active: boolean;
}

const DEFAULT_ESTIMATE = { input_tokens: 4000, output_tokens: 1500 };

export async function invokeRole(
  ctx: InvokeRoleContext,
  input: InvokeRoleInput,
): Promise<InvokeRoleResult> {
  const role = await fetchRole(ctx.service, input.user_id, input.role_name);
  if (!role) {
    throw new Error(`role_runner: role '${input.role_name}' not found for user ${input.user_id}`);
  }
  if (!role.is_active) {
    throw new Error(
      `role_runner: role '${input.role_name}' is not active for user ${input.user_id}`,
    );
  }

  // 2. Render the prompt.
  const prompt = renderTemplate(role.prompt_template, input.snapshot);

  // 3. Estimate cost; pass through the gate.
  const estimate = input.estimate ?? DEFAULT_ESTIMATE;
  const operation_type: CostOperationType = "anthropic_call";
  const estimated = estimateCostCents(
    role.default_model,
    estimate.input_tokens,
    estimate.output_tokens,
  );

  const decision = await approvePaidOperation(ctx, {
    user_id: input.user_id,
    operation_type,
    estimate_cents: estimated.cents,
    provider: "anthropic",
    model_or_sku: role.default_model,
    related_source_id: input.related_source_id,
    proposal_id: input.proposal_id,
    metadata: {
      role_name: input.role_name,
      triggered_by: input.triggered_by,
    },
    approval_context: {
      role_name: input.role_name,
      triggered_by: input.triggered_by,
      ...(input.approval_context ?? {}),
    },
  });

  if (!decision.approved) {
    return { status: "denied", decision };
  }

  // 4. Compose messages and invoke Anthropic.
  const messages: AnthropicMessage[] = buildMessages(prompt, input.documents ?? [], role);
  const startedAt = new Date();

  let output: AnthropicCallOutput;
  let errorDetail: string | null = null;
  try {
    output = await ctx.anthropic.call({
      model: role.default_model,
      system: undefined,
      messages,
      max_tokens: input.max_tokens ?? 4096,
      response_schema:
        role.uses_structured_output && role.output_schema ? role.output_schema : undefined,
      citations: role.uses_citations_api ? true : undefined,
    });
  } catch (err) {
    errorDetail = (err as Error).message;
    output = emptyOutput(role.default_model);
  }

  const endedAt = new Date();
  const status = errorDetail ? "error" : "success";

  // 5. Persist role_invocations.
  const role_invocation_id = await persistInvocation(ctx.service, {
    user_id: input.user_id,
    role_name: input.role_name,
    triggered_by: input.triggered_by,
    input_substrate: input.snapshot,
    prompt_used: prompt,
    model: role.default_model,
    output,
    status,
    error_detail: errorDetail,
    started_at: startedAt,
    ended_at: endedAt,
  });

  // 6. Charge cost_ledger from the actual usage (or estimate if the call failed).
  const cost_cents =
    output.usage.input_tokens > 0
      ? actualCostCents(role.default_model, output.usage.input_tokens, output.usage.output_tokens)
      : estimated.cents;

  const ledger = await chargeLedger(ctx, {
    user_id: input.user_id,
    operation_type,
    provider: "anthropic",
    model_or_sku: role.default_model,
    cost_cents,
    related_role_invocation_id: role_invocation_id,
    related_source_id: input.related_source_id,
    metadata: {
      role_name: input.role_name,
      triggered_by: input.triggered_by,
      tokens_input: output.usage.input_tokens,
      tokens_output: output.usage.output_tokens,
      status,
    },
    approved_by_operator: decision.reason !== "whitelisted",
  });

  // Patch role_invocations with the cost_ledger_id link.
  await ctx.service
    .from("role_invocations")
    .update({ cost_ledger_id: ledger.id, cost_cents })
    .eq("id", role_invocation_id);

  if (errorDetail) {
    throw new Error(`role_runner: Anthropic call failed: ${errorDetail}`);
  }

  return {
    status: "completed",
    role_invocation_id,
    cost_ledger_id: ledger.id,
    output,
  };
}

function buildMessages(
  prompt: string,
  documents: Array<{ title: string; text: string }>,
  role: RoleDefinitionRow,
): AnthropicMessage[] {
  if (documents.length === 0 || !role.uses_citations_api) {
    return [{ role: "user", content: prompt }];
  }

  // Citations API: pass documents as content blocks alongside the prompt.
  const blocks: Exclude<AnthropicMessage["content"], string> = documents.map((doc) => ({
    type: "document" as const,
    source: { type: "text" as const, media_type: "text/plain" as const, data: doc.text },
    citations: { enabled: true },
  }));
  blocks.push({ type: "text" as const, text: prompt });
  return [{ role: "user", content: blocks }];
}

async function fetchRole(
  client: SupabaseClient,
  user_id: string,
  role_name: RoleName,
): Promise<RoleDefinitionRow | null> {
  const { data, error } = await client
    .from("role_definitions")
    .select(
      "id, name, prompt_template, default_model, uses_citations_api, uses_structured_output, output_schema, is_active",
    )
    .eq("user_id", user_id)
    .eq("name", role_name)
    .maybeSingle();
  if (error) throw new Error(`role_runner: failed to load role: ${error.message}`);
  return (data ?? null) as RoleDefinitionRow | null;
}

interface PersistInvocationInput {
  user_id: string;
  role_name: RoleName;
  triggered_by: string;
  input_substrate: Record<string, unknown>;
  prompt_used: string;
  model: string;
  output: AnthropicCallOutput;
  status: "success" | "error" | "partial";
  error_detail: string | null;
  started_at: Date;
  ended_at: Date;
}

async function persistInvocation(
  client: SupabaseClient,
  input: PersistInvocationInput,
): Promise<string> {
  const { data, error } = await client
    .from("role_invocations")
    .insert({
      user_id: input.user_id,
      role_name: input.role_name,
      triggered_by: input.triggered_by,
      input_substrate: input.input_substrate,
      prompt_used: input.prompt_used,
      model: input.model,
      tokens_input: input.output.usage.input_tokens,
      tokens_output: input.output.usage.output_tokens,
      output_text: input.output.text,
      output_structured: input.output.structured ?? null,
      citations_returned: input.output.citations.length > 0 ? input.output.citations : null,
      status: input.status,
      error_detail: input.error_detail,
      started_at: input.started_at.toISOString(),
      ended_at: input.ended_at.toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`role_runner: failed to persist role_invocation: ${error.message}`);
  return data.id as string;
}

function emptyOutput(model: string): AnthropicCallOutput {
  return {
    text: "",
    structured: null,
    citations: [],
    content: [],
    tool_uses: [],
    stop_reason: "end_turn",
    usage: { input_tokens: 0, output_tokens: 0 },
    model,
    raw: {},
  };
}
