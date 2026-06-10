// Feed digestion pipeline — the auto-ingest engine.
//
// Per canonical spec v2.4 Part 2 + Part 4 + Part 16:
//   - Storage / Extraction / Outputs are decoupled (Part 2 medallion).
//   - Extraction emits the TYPED graph (Part 4): nodes + edges + quotes +
//     assertions + open threads — not flat atomic claims.
//   - Model strategy uses the per-role router (Part 16) — bulk extraction
//     runs on the cheap-strong baseline (Gemma 4 26B A4B); hard extraction
//     dials up to gpt-oss-120b medium effort (follow-up).
//
// Steps emitted as orchestrator_events (the activity log):
//   1. extract_text         — body_md was extracted before this lib runs.
//   2. recognize_entities   — typed extraction produces entity nodes (plus
//                              event/neutral_fact/assertion); reported as a
//                              single step for the existing activity log.
//   3. extract_claims       — event name kept for surfaces that already read
//                              orchestrator_events; the diag payload names
//                              typed-graph counts (nodes/edges/quotes/...).
//   4. embed                — piece-level vector for chain detection.
//   5. detect_chains        — spec §6.5 near-duplicate bands. Flat-vector
//                              based; the typed graph augments this in
//                              the Surfacing Engine PRs, it doesn't replace it.
//
// Idempotency — spec Part 19: re-runs supersede prior typed-graph rows for
// the same piece. purgeTypedGraphForPiece() before the chunk loop guarantees
// this. The raw bytes in R2 + the pieces row stay; the typed projection is
// regenerated. The legacy `claims` table is no longer written here; existing
// flat rows stay read-only until a later cleanup PR retires them.

import type { Env } from "../../env";
import { insertOne, one, run } from "../../lib/d1";
import {
  ensureSourceNode,
  extractTypedChunk,
  persistTypedExtraction,
  purgeTypedGraphForPiece,
} from "./digestion-typed";
import { embedText, searchVectors, upsertVector, vectorId } from "./embeddings";

export interface DigestArgs {
  userId: string;
  pieceId: string;
  pieceSlug: string;
  title: string;
  body_md: string;
  /** Optional source row id (when extract.ts created one). */
  sourceId?: string | undefined;
}

export interface DigestResult {
  steps_completed: string[];
  failed_step?: string;
  failed_reason?: string;
  /** Number of typed-graph nodes created across all chunks. Persisted into
   *  digest_jobs.claims_count (legacy column name) as the headline count. */
  nodes_created?: number;
  edges_created?: number;
  quotes_created?: number;
  assertions_created?: number;
  threads_created?: number;
  killed_quotes?: number;
  chain_id?: string;
  chain_action?: "extends" | "new" | "duplicate" | "related" | null;
  /** Resumable-extraction progress. `more_chunks` true means the run paused
   *  with chunks remaining and should be resumed at `chunks_done`. */
  chunks_done?: number;
  chunk_count?: number;
  more_chunks?: boolean;
}

export interface DigestOptions {
  /** Resume extraction from this chunk index (0 = fresh run). */
  startChunk?: number;
  /** Soft wall-clock budget for this invocation. After finishing a chunk, if
   *  elapsed exceeds this AND chunks remain, the run pauses and returns
   *  more_chunks=true so the caller can re-queue. Kept under the Worker
   *  wall-clock so we always checkpoint before being killed. */
  softBudgetMs?: number;
  /** Called after each chunk persists, with the cumulative node count for the
   *  piece. Lets the job runner checkpoint chunks_done + claims_count. */
  onProgress?: (chunksDone: number, chunkCount: number, nodeCount: number) => Promise<void>;
}

const STEP_ORDER = [
  "extract_text",
  "recognize_entities",
  "extract_claims",
  "embed",
  "detect_chains",
] as const;

// Smaller chunks than the old 24KB: a full typed-graph JSON for 24KB of text
// is thousands of output tokens and blows the per-call model timeout. 6KB
// keeps each extraction call comfortably inside the 25s ceiling. MAX_CHUNKS is
// generous because extraction is now resumable (one or two chunks per tick),
// so a long document finishes over multiple cron ticks instead of truncating.
const CHUNK_CHARS = 6000;
const MAX_CHUNKS = 16;
const DEFAULT_SOFT_BUDGET_MS = 20_000;

/** Count typed-graph nodes for a piece (cumulative across chunks/ticks). */
async function countPieceNodes(env: Env, userId: string, pieceId: string): Promise<number> {
  const row = await one<{ n: number }>(
    env.DB,
    "SELECT COUNT(*) AS n FROM nodes WHERE user_id = ? AND piece_id = ?",
    [userId, pieceId],
  );
  return row?.n ?? 0;
}

export async function digest(
  env: Env,
  args: DigestArgs,
  opts: DigestOptions = {},
): Promise<DigestResult> {
  const result: DigestResult = { steps_completed: [], chain_action: null };
  const startChunk = opts.startChunk ?? 0;
  const softBudget = opts.softBudgetMs ?? DEFAULT_SOFT_BUDGET_MS;
  const t0 = Date.now();

  const chunks = chunkText(args.body_md, { maxChars: CHUNK_CHARS }).slice(0, MAX_CHUNKS);
  result.chunk_count = chunks.length;

  // First tick only: log extract_text, open the step, and purge prior graph.
  if (startChunk === 0) {
    await emit(env, args, "extract_text", "completed", {
      chars: args.body_md.length,
      title: args.title,
      chunks: chunks.length,
    });
    await emit(env, args, "recognize_entities", "started", {});
    await emit(env, args, "extract_claims", "started", {});
    // Idempotency (spec Part 19): purge prior typed-graph rows for this piece
    // BEFORE persisting the first chunk, so re-extracts supersede.
    await purgeTypedGraphForPiece(env, args.userId, args.pieceId);
  }
  result.steps_completed.push("extract_text");

  // Source node — one per piece, reused across chunks/ticks (idempotent).
  const sourceNodeId = await ensureSourceNode(env, args.userId, args.pieceId, args.title);

  const totals = { nodes: 0, edges: 0, quotes: 0, assertions: 0, threads: 0, killed_quotes: 0 };
  let chunksOk = 0;
  let i = startChunk;
  for (; i < chunks.length; i++) {
    try {
      const extraction = await extractTypedChunk(
        env,
        args.userId,
        args.pieceId,
        i,
        chunks[i] ?? "",
      );
      const isEmpty =
        extraction.entities.length === 0 &&
        extraction.events.length === 0 &&
        extraction.neutral_facts.length === 0 &&
        extraction.assertions.length === 0;
      if (!isEmpty) {
        const stats = await persistTypedExtraction(
          env,
          {
            userId: args.userId,
            pieceId: args.pieceId,
            chunkText: chunks[i] ?? "",
            sourceNodeId,
          },
          extraction,
        );
        totals.nodes += stats.nodes;
        totals.edges += stats.edges;
        totals.quotes += stats.quotes;
        totals.assertions += stats.assertions;
        totals.threads += stats.threads;
        totals.killed_quotes += stats.killed_quotes;
      } else {
        await emit(env, args, "extract_claims", "started", {
          diag: "empty_extraction",
          chunk_index: i,
        });
      }
      chunksOk++;
      // Checkpoint after every chunk so a later crash never re-does work.
      if (opts.onProgress) {
        const nodeCount = await countPieceNodes(env, args.userId, args.pieceId);
        await opts.onProgress(i + 1, chunks.length, nodeCount);
      }
    } catch (err) {
      // a bad chunk shouldn't sink the document — but log WHY.
      try {
        await emit(env, args, "extract_claims", "started", {
          diag: "chunk_threw",
          chunk_index: i,
          error: (err as Error).message ?? "unknown",
        });
      } catch {
        // never let logging fail the chunk loop
      }
      // Still advance the checkpoint so a chronically-slow chunk doesn't trap
      // the whole document — we skip it and move on next tick.
      if (opts.onProgress) {
        const nodeCount = await countPieceNodes(env, args.userId, args.pieceId);
        await opts.onProgress(i + 1, chunks.length, nodeCount);
      }
    }

    // Soft budget: if more chunks remain and we're out of time this tick,
    // pause and let the caller re-queue. Work so far is already checkpointed.
    if (i + 1 < chunks.length && Date.now() - t0 > softBudget) {
      result.nodes_created = totals.nodes;
      result.more_chunks = true;
      result.chunks_done = i + 1;
      return result;
    }
  }

  // All chunks processed. If the FIRST tick processed zero chunks successfully
  // and produced nothing, treat it as a genuine extraction failure (keep the
  // "failed on every chunk" phrase the job runner matches on).
  const cumulativeNodes = await countPieceNodes(env, args.userId, args.pieceId);
  if (startChunk === 0 && chunksOk === 0 && cumulativeNodes === 0 && chunks.length > 0) {
    result.failed_step = "extract_claims";
    result.failed_reason = "typed extraction failed on every chunk";
    await emit(env, args, "extract_claims", "failed", { error: result.failed_reason });
    return result;
  }

  result.nodes_created = totals.nodes;
  result.edges_created = totals.edges;
  result.quotes_created = totals.quotes;
  result.assertions_created = totals.assertions;
  result.threads_created = totals.threads;
  result.killed_quotes = totals.killed_quotes;
  result.chunks_done = chunks.length;
  result.more_chunks = false;

  await emit(env, args, "extract_claims", "completed", {
    nodes_this_tick: totals.nodes,
    nodes_total: cumulativeNodes,
    chunks: chunks.length,
  });
  await emit(env, args, "recognize_entities", "completed", {
    nodes: cumulativeNodes,
  });
  result.steps_completed.push("recognize_entities");
  result.steps_completed.push("extract_claims");

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
      const neighbourRow = await one<{ chain_id: string | null; id: string }>(
        env.DB,
        "SELECT id, chain_id FROM pieces WHERE id = ? AND user_id = ?",
        [best.metadata.id, args.userId],
      );
      const chainId = neighbourRow?.chain_id ?? `chain-${best.metadata.id.slice(0, 8)}`;
      if (neighbourRow && neighbourRow.chain_id == null) {
        await run(env.DB, "UPDATE pieces SET chain_id = ? WHERE id = ? AND user_id = ?", [
          chainId,
          neighbourRow.id,
          args.userId,
        ]);
      }
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

// ---------------------------------------------------------------------------
// Chunking — paragraph-greedy windows so long documents aren't truncated.
// Small docs (the common case) return [text] unchanged.
// ---------------------------------------------------------------------------
export function chunkText(
  text: string,
  opts: { maxChars?: number; overlapChars?: number } = {},
): string[] {
  const maxChars = opts.maxChars ?? 24000;
  const overlapChars = opts.overlapChars ?? 800;
  if (text.length <= maxChars) return text.length ? [text] : [];

  const paras = text.split(/\n\n+/);
  const chunks: string[] = [];
  let cur = "";
  const pushCur = () => {
    if (cur.trim()) chunks.push(cur);
    // carry a tail of the previous chunk for continuity
    cur = overlapChars > 0 ? cur.slice(-overlapChars) : "";
  };
  for (const para of paras) {
    if (para.length > maxChars) {
      // hard-slice an oversized paragraph
      if (cur.trim()) pushCur();
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
      cur = "";
      continue;
    }
    if (cur.length + para.length + 2 > maxChars) pushCur();
    cur = cur ? `${cur}\n\n${para}` : para;
  }
  if (cur.trim()) chunks.push(cur);
  return chunks;
}
