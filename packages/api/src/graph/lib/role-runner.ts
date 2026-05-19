// Role runner — the executor that turns a role_definitions row + payload
// into an LLM call, writes a role_invocations row, and emits an
// orchestrator_events row so the Live screen sees it.

import type { Env } from "../../env";
import { insertOne, one, parseJson, run } from "../../lib/d1";
import { callLLM } from "../../llm/index";
import type { LlmMessage } from "../../llm/types";

export interface RunRoleArgs {
  userId: string;
  roleName: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  cascadeRunId?: string;
}

export interface RunRoleResult {
  invocation_id: string;
  status: "completed" | "failed";
  output: unknown | null;
  cost_cents: number;
  duration_ms: number;
  error?: string;
}

interface RoleDefRow {
  id: string;
  provider: string;
  model: string;
  features: string;
  prompt_template: string;
  schema_json: string | null;
  allow_anthropic_override: number;
}

export async function runRole(env: Env, args: RunRoleArgs): Promise<RunRoleResult> {
  const def = await one<RoleDefRow>(
    env.DB,
    `SELECT id, provider, model, features, prompt_template, schema_json, allow_anthropic_override
     FROM role_definitions WHERE user_id = ? AND name = ? AND enabled = 1`,
    [args.userId, args.roleName],
  );
  if (!def) throw new Error(`Role not found or disabled: ${args.roleName}`);

  const features = parseJson<{ structured_output?: boolean }>(def.features, {});
  const schema = def.schema_json ? parseJson<Record<string, unknown>>(def.schema_json, {}) : null;
  const startedAt = Date.now();

  const invocation_id = await insertOne(env.DB, "role_invocations", {
    user_id: args.userId,
    role_name: args.roleName,
    role_definition_id: def.id,
    cascade_run_id: args.cascadeRunId ?? null,
    input_snapshot: JSON.stringify(args.payload),
    status: "pending",
    idempotency_key: args.idempotencyKey ?? null,
  });

  const messages: LlmMessage[] = [
    { role: "user", content: [{ type: "text", text: JSON.stringify(args.payload) }] },
  ];

  try {
    const out = await callLLM(env, {
      provider: def.provider as "workers_ai" | "anthropic",
      model: def.model,
      system: def.prompt_template,
      messages,
      max_tokens: 4000,
      response_schema: features.structured_output && schema ? schema : undefined,
      ledger: {
        user_id: args.userId,
        operation_type: `${def.provider}.role.${args.roleName}`,
        idempotency_key: args.idempotencyKey,
      },
    });
    const output = out.structured ?? out.text;
    const duration_ms = Date.now() - startedAt;

    await run(
      env.DB,
      `UPDATE role_invocations
         SET output_payload = ?, cost_cents = ?, cost_ledger_id = ?,
             status = 'completed', duration_ms = ?, completed_at = ?
       WHERE id = ?`,
      [
        JSON.stringify(output ?? null),
        out.cost_cents,
        out.cost_ledger_id,
        duration_ms,
        new Date().toISOString(),
        invocation_id,
      ],
    );

    await insertOne(env.DB, "orchestrator_events", {
      user_id: args.userId,
      event_type: "role.completed",
      cascade_run_id: args.cascadeRunId ?? null,
      payload: {
        role_name: args.roleName,
        invocation_id,
        cost_cents: out.cost_cents,
        provider: def.provider,
        model: def.model,
      },
    });

    return {
      invocation_id,
      status: "completed",
      output,
      cost_cents: out.cost_cents,
      duration_ms,
    };
  } catch (err) {
    const duration_ms = Date.now() - startedAt;
    const message = (err as Error).message ?? "unknown error";
    await run(
      env.DB,
      `UPDATE role_invocations
         SET status = 'failed', error_message = ?, duration_ms = ?, completed_at = ?
       WHERE id = ?`,
      [message, duration_ms, new Date().toISOString(), invocation_id],
    );
    await insertOne(env.DB, "orchestrator_events", {
      user_id: args.userId,
      event_type: "role.failed",
      cascade_run_id: args.cascadeRunId ?? null,
      payload: { role_name: args.roleName, invocation_id, error: message },
    });
    return {
      invocation_id,
      status: "failed",
      output: null,
      cost_cents: 0,
      duration_ms,
      error: message,
    };
  }
}
