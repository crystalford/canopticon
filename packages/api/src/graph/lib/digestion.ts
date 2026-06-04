// Feed digestion pipeline — the auto-ingest engine.
//
// Per the operator-claude-code-handoff: "Upload is authorization; the
// system does the work; the operator oversees rather than manages." Each
// uploaded piece runs through five steps automatically — no confirmation
// gates. Claims land at draft confidence; promotion to citable is governed
// by the weighting model (P2), not by bulk publish.
//
// Steps:
//   1. extract_text         — done by extract.ts before this runs; the
//                              body_md is passed in. Logged for completeness.
//   2. recognize_entities   — runRole(entity_resolver) on the body. The role
//                              returns proposed entity slugs/labels; we record
//                              the output for later resolution in P2.
//   3. extract_claims       — runRole(claim_extraction) populating
//                              asserted_in_piece_id (the new model from
//                              migration 0016). evidenced_by_source_ids stays
//                              empty — the spec invariant: never an internal
//                              piece id. Confidence defaults to draft.
//   4. embed                — embedText(body) + upsertVector with kind="piece".
//   5. detect_chains        — searchVectors near-duplicate band. Per spec §6.5:
//                              >0.95 duplicate, 0.80–0.95 new pass of chain,
//                              0.65–0.80 related. New pass assigns chain_id;
//                              the operator sees it surface in Synthesis (P2).
//
// Every step writes an orchestrator_events row so the Feed activity log
// (read-only surface) has a single source of truth. Failures emit
// feed.<step>.failed and the pipeline returns; the dropzone shows a
// conflict flag (P1 ships the event; P2 wires the flag to Synthesis).

import type { Env } from "../../env";
import { insertOne, one, run } from "../../lib/d1";
import { embedText, searchVectors, upsertVector, vectorId } from "./embeddings";
import { runRole } from "./role-runner";

export interface DigestArgs {
  userId: string;
  pieceId: string;
  pieceSlug: string;
  title: string;
  body_md: string;
  /** Optional source row id (when extract.ts created one). Used so the
   *  existing role pipeline can hook to either piece_id or source_id. */
  sourceId?: string | undefined;
}

export interface DigestResult {
  steps_completed: string[];
  failed_step?: string;
  failed_reason?: string;
  entities_proposed?: number;
  claims_drafted?: number;
  chain_id?: string;
  chain_action?: "extends" | "new" | "duplicate" | "related" | null;
}

const STEP_ORDER = [
  "extract_text",
  "recognize_entities",
  "extract_claims",
  "embed",
  "detect_chains",
] as const;

export async function digest(env: Env, args: DigestArgs): Promise<DigestResult> {
  const result: DigestResult = { steps_completed: [], chain_action: null };

  // Step 1: extract_text — already done before this lib is called.
  // Log the event so the activity log shows the full 5-step trail.
  await emit(env, args, "extract_text", "completed", {
    chars: args.body_md.length,
    title: args.title,
  });
  result.steps_completed.push("extract_text");

  // Step 2: recognize_entities
  await emit(env, args, "recognize_entities", "started", {});
  try {
    const roleResult = await runRole(env, {
      userId: args.userId,
      roleName: "entity_resolver",
      payload: {
        title: args.title,
        content_text: args.body_md.slice(0, 30000),
        source_id: args.sourceId,
        piece_id: args.pieceId,
      },
    });
    if (roleResult.status === "failed") {
      result.failed_step = "recognize_entities";
      result.failed_reason = roleResult.error ?? "entity_resolver failed";
      await emit(env, args, "recognize_entities", "failed", { error: result.failed_reason });
      return result;
    }
    const proposed = countEntitiesFromOutput(roleResult.output);
    result.entities_proposed = proposed;
    await emit(env, args, "recognize_entities", "completed", {
      invocation_id: roleResult.invocation_id,
      entities_proposed: proposed,
    });
    result.steps_completed.push("recognize_entities");
  } catch (err) {
    result.failed_step = "recognize_entities";
    result.failed_reason = (err as Error).message;
    await emit(env, args, "recognize_entities", "failed", { error: result.failed_reason });
    return result;
  }

  // Step 3: extract_claims
  await emit(env, args, "extract_claims", "started", {});
  try {
    const roleResult = await runRole(env, {
      userId: args.userId,
      roleName: "claim_extraction",
      payload: {
        title: args.title,
        content_text: args.body_md.slice(0, 30000),
        source_id: args.sourceId,
        piece_id: args.pieceId,
      },
    });
    if (roleResult.status === "failed") {
      result.failed_step = "extract_claims";
      result.failed_reason = roleResult.error ?? "claim_extraction failed";
      await emit(env, args, "extract_claims", "failed", { error: result.failed_reason });
      return result;
    }
    const drafted = countClaimsFromOutput(roleResult.output);
    result.claims_drafted = drafted;
    await emit(env, args, "extract_claims", "completed", {
      invocation_id: roleResult.invocation_id,
      claims_drafted: drafted,
    });
    result.steps_completed.push("extract_claims");
  } catch (err) {
    result.failed_step = "extract_claims";
    result.failed_reason = (err as Error).message;
    await emit(env, args, "extract_claims", "failed", { error: result.failed_reason });
    return result;
  }

  // Step 4: embed
  await emit(env, args, "embed", "started", {});
  let pieceVector: number[];
  try {
    pieceVector = await embedText(env, `${args.title}\n${args.body_md.slice(0, 4000)}`);
    await upsertVector(env, {
      id: vectorId("piece", args.pieceId),
      values: pieceVector,
      metadata: {
        user_id: args.userId,
        kind: "piece",
        id: args.pieceId,
        title: args.title,
      },
    });
    await emit(env, args, "embed", "completed", { dims: pieceVector.length });
    result.steps_completed.push("embed");
  } catch (err) {
    result.failed_step = "embed";
    result.failed_reason = (err as Error).message;
    await emit(env, args, "embed", "failed", { error: result.failed_reason });
    return result;
  }

  // Step 5: detect_chains — spec §6.5 bands.
  //   >0.95 duplicate · 0.80–0.95 new pass of existing chain · 0.65–0.80 related
  await emit(env, args, "detect_chains", "started", {});
  try {
    const hits = await searchVectors(env, {
      query: `${args.title}\n${args.body_md.slice(0, 4000)}`,
      userId: args.userId,
      topK: 5,
      kinds: ["piece"],
    });
    // Filter out self-match.
    const self = vectorId("piece", args.pieceId);
    const neighbours = hits.filter((h) => h.id !== self);
    const best = neighbours[0];
    if (best && best.score > 0.95) {
      result.chain_action = "duplicate";
      await emit(env, args, "detect_chains", "completed", {
        action: "duplicate",
        against: best.metadata.id,
        score: best.score,
      });
    } else if (best && best.score >= 0.8) {
      // "New pass of an existing chain" — link to the neighbour's chain_id
      // (or create a fresh chain anchored on the neighbour) and assign it.
      const neighbourRow = await one<{ chain_id: string | null; id: string }>(
        env.DB,
        "SELECT id, chain_id FROM pieces WHERE id = ? AND user_id = ?",
        [best.metadata.id, args.userId],
      );
      const chainId = neighbourRow?.chain_id ?? `chain-${best.metadata.id.slice(0, 8)}`;
      // Link the neighbour itself into the chain if it wasn't already.
      if (neighbourRow && neighbourRow.chain_id == null) {
        await run(env.DB, "UPDATE pieces SET chain_id = ? WHERE id = ? AND user_id = ?", [
          chainId,
          neighbourRow.id,
          args.userId,
        ]);
      }
      // Assign chain to the new piece.
      await run(env.DB, "UPDATE pieces SET chain_id = ? WHERE id = ? AND user_id = ?", [
        chainId,
        args.pieceId,
        args.userId,
      ]);
      result.chain_id = chainId;
      result.chain_action = "extends";
      await emit(env, args, "detect_chains", "completed", {
        action: "extends",
        chain_id: chainId,
        against: best.metadata.id,
        score: best.score,
      });
    } else if (best && best.score >= 0.65) {
      result.chain_action = "related";
      await emit(env, args, "detect_chains", "completed", {
        action: "related",
        against: best.metadata.id,
        score: best.score,
      });
    } else {
      result.chain_action = "new";
      await emit(env, args, "detect_chains", "completed", {
        action: "new",
        best_score: best?.score ?? null,
      });
    }
    result.steps_completed.push("detect_chains");
  } catch (err) {
    result.failed_step = "detect_chains";
    result.failed_reason = (err as Error).message;
    await emit(env, args, "detect_chains", "failed", { error: result.failed_reason });
    return result;
  }

  return result;
}

// Step constraint — TypeScript guards against typos in event_type names.
type Step = (typeof STEP_ORDER)[number];

async function emit(
  env: Env,
  args: DigestArgs,
  step: Step,
  state: "started" | "completed" | "failed",
  payload: Record<string, unknown>,
): Promise<void> {
  await insertOne(env.DB, "orchestrator_events", {
    user_id: args.userId,
    event_type: `feed.${step}.${state}`,
    subject_kind: "piece",
    subject_id: args.pieceId,
    payload: {
      piece_slug: args.pieceSlug,
      ...payload,
    },
  });
}

// Best-effort count of entities from the role's structured output. Roles
// return varying shapes; we look for the common ones.
function countEntitiesFromOutput(output: unknown): number {
  if (!output) return 0;
  if (Array.isArray(output)) return output.length;
  if (typeof output === "object" && output !== null) {
    const obj = output as Record<string, unknown>;
    for (const key of ["entities", "proposed_entities", "extracted_entities", "items"]) {
      const v = obj[key];
      if (Array.isArray(v)) return v.length;
    }
  }
  return 0;
}

function countClaimsFromOutput(output: unknown): number {
  if (!output) return 0;
  if (Array.isArray(output)) return output.length;
  if (typeof output === "object" && output !== null) {
    const obj = output as Record<string, unknown>;
    for (const key of ["claims", "drafted_claims", "extracted_claims", "items"]) {
      const v = obj[key];
      if (Array.isArray(v)) return v.length;
    }
  }
  return 0;
}
