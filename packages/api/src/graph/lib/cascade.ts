// Auto-cascade: runs the analytical pipeline against a newly ingested
// source. Designed to be fired in the background via
// c.executionCtx.waitUntil so the originating request can return quickly.
//
// Minimal v1 sequence: ingestion_critic → claim_extraction. The other
// 16 forensic roles stay operator-triggered for now; they're analytical
// passes (red_team, premortem, calibration, etc.) that don't need to
// auto-fire on every source.

import type { Env } from "../../env";
import { insertOne, one, run } from "../../lib/d1";
import { runRole } from "./role-runner";

export interface RunCascadeArgs {
  userId: string;
  sourceId: string;
  trigger?: string;
}

const SEQUENCE = ["ingestion_critic", "claim_extraction"] as const;

export async function runCascade(env: Env, args: RunCascadeArgs): Promise<void> {
  const cascadeRunId = await insertOne(env.DB, "cascade_runs", {
    user_id: args.userId,
    status: "running",
    trigger_source: args.trigger ?? "auto_on_ingest",
    started_at: new Date().toISOString(),
    stats: { source_id: args.sourceId },
  });
  await insertOne(env.DB, "orchestrator_events", {
    user_id: args.userId,
    event_type: "cascade.started",
    cascade_run_id: cascadeRunId,
    subject_kind: "source",
    subject_id: args.sourceId,
    payload: { sequence: SEQUENCE, trigger: args.trigger ?? "auto_on_ingest" },
  });

  const source = await one<{ content_text: string | null; title: string }>(
    env.DB,
    "SELECT content_text, title FROM sources WHERE id = ? AND user_id = ?",
    [args.sourceId, args.userId],
  );
  if (!source) {
    await markFailed(env, cascadeRunId, "source_not_found");
    return;
  }

  const completed: string[] = [];
  for (const roleName of SEQUENCE) {
    await run(env.DB, "UPDATE cascade_runs SET current_step = ? WHERE id = ?", [
      roleName,
      cascadeRunId,
    ]);
    const result = await runRole(env, {
      userId: args.userId,
      roleName,
      payload: {
        source_id: args.sourceId,
        title: source.title,
        content_text: source.content_text ?? "",
      },
      cascadeRunId,
    });
    if (result.status === "failed") {
      await markFailed(env, cascadeRunId, `${roleName}: ${result.error ?? "failed"}`, completed);
      return;
    }
    completed.push(roleName);

    if (roleName === "ingestion_critic") {
      await run(env.DB, "UPDATE sources SET ingestion_state = 'critic_completed' WHERE id = ?", [
        args.sourceId,
      ]);
    }
  }

  await run(
    env.DB,
    `UPDATE cascade_runs SET status = 'completed', current_step = NULL,
       steps_completed = ?, completed_at = ? WHERE id = ?`,
    [JSON.stringify(completed), new Date().toISOString(), cascadeRunId],
  );
  await insertOne(env.DB, "orchestrator_events", {
    user_id: args.userId,
    event_type: "cascade.completed",
    cascade_run_id: cascadeRunId,
    subject_kind: "source",
    subject_id: args.sourceId,
    payload: { steps_completed: completed },
  });
}

async function markFailed(
  env: Env,
  cascadeRunId: string,
  reason: string,
  completed: string[] = [],
): Promise<void> {
  await run(
    env.DB,
    `UPDATE cascade_runs SET status = 'failed', error_message = ?,
       steps_completed = ?, completed_at = ? WHERE id = ?`,
    [reason, JSON.stringify(completed), new Date().toISOString(), cascadeRunId],
  );
}
