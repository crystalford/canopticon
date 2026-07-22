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
// is thousands of output tokens and blows the per-call model timeout. 3000
// chars per chunk keeps each extraction call comfortably inside the 25s
// ceiling even when Workers AI is under burst load. With dual-resolution
// chunking (spec v2.5 Part 22, deferred), the bulk pass will shrink further
// to ~512 tokens; the hard pass widens to ~1500. For this PR both passes
// share this chunk size.
const CHUNK_CHARS = 3000;
// Per-doc cap. With smaller chunks more chunks per document — bumped from 16
// to 32 so the legacy corpus's longer reports (~67KB) finish in one pass
// instead of being truncated.
const MAX_CHUNKS = 32;
const DEFAULT_SOFT_BUDGET_MS = 20_000;
// Within-document parallelism: how many chunks extract concurrently. The cron
// drain already runs multiple DOCUMENTS in parallel (waitUntil per job); this
// adds parallelism WITHIN a doc so a 16-chunk document doesn't process 16
// chunks serially when most of the per-chunk time is waiting on the model.
// Capped low so the burst doesn't overwhelm Workers AI when several documents
// are draining at once. Spec v2.5 Part 22 calls for a full Queues + Async
// Batch architecture; that's the next PR. This is the contained first step.
const CHUNK_CONCURRENCY = 4;

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
  // Process chunks in WAVES of CHUNK_CONCURRENCY. Each wave runs in parallel;
  // the soft budget is checked between waves so a long-running wave can't be
  // pre-empted (Workers AI calls aren't cancellable) but a slow document
  // never holds the whole job past the wall-clock budget. Persist still
  // happens per chunk (independent D1 batches) — only the LLM calls overlap.
  let i = startChunk;
  for (; i < chunks.length; i += CHUNK_CONCURRENCY) {
    const waveStart = i;
    const waveEnd = Math.min(i + CHUNK_CONCURRENCY, chunks.length);
    const waveIndices = Array.from({ length: waveEnd - waveStart }, (_, k) => waveStart + k);

    const waveResults = await Promise.all(
      waveIndices.map(async (idx) => {
        try {
          const extraction = await extractTypedChunk(
            env,
            args.userId,
            args.pieceId,
            idx,
            chunks[idx] ?? "",
          );
          const isEmpty =
            extraction.entities.length === 0 &&
            extraction.events.length === 0 &&
            extraction.neutral_facts.length === 0 &&
            extraction.assertions.length === 0;
          if (isEmpty) {
            return { idx, ok: true, empty: true } as const;
          }
          const stats = await persistTypedExtraction(
            env,
            {
              userId: args.userId,
              pieceId: args.pieceId,
              chunkText: chunks[idx] ?? "",
              sourceNodeId,
            },
            extraction,
          );
          return { idx, ok: true, empty: false, stats } as const;
        } catch (err) {
          return { idx, ok: false, error: (err as Error).message ?? "unknown" } as const;
        }
      }),
    );

    // Accumulate per-chunk results AFTER the wave settles. Sequential within
    // the accumulator so totals are deterministic.
    for (const r of waveResults) {
      if (r.ok) {
        chunksOk++;
        if (r.empty) {
          await emit(env, args, "extract_claims", "started", {
            diag: "empty_extraction",
            chunk_index: r.idx,
          }).catch(() => {});
        } else {
          totals.nodes += r.stats.nodes;
          totals.edges += r.stats.edges;
          totals.quotes += r.stats.quotes;
          totals.assertions += r.stats.assertions;
          totals.threads += r.stats.threads;
          totals.killed_quotes += r.stats.killed_quotes;
        }
      } else {
        try {
          await emit(env, args, "extract_claims", "started", {
            diag: "chunk_threw",
            chunk_index: r.idx,
            error: r.error,
          });
        } catch {
          // never let logging fail the wave
        }
      }
    }

    // Checkpoint once per wave. The whole wave is complete on disk by here.
    if (opts.onProgress) {
      const nodeCount = await countPieceNodes(env, args.userId, args.pieceId);
      await opts.onProgress(waveEnd, chunks.length, nodeCount);
    }

    // Soft budget: if more chunks remain and we're out of time, pause and let
    // the caller re-queue. The next tick resumes at waveEnd.
    if (waveEnd < chunks.length && Date.now() - t0 > softBudget) {
      result.nodes_created = totals.nodes;
      result.more_chunks = true;
      result.chunks_done = waveEnd;
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
  // Hollow-run guard: a run that produced node LABELS but no edges, no
  // quotes, AND no assertions is structurally useless — every subject
  // page renders empty against it. Mark it failed (deterministic, won't
  // retry uselessly) so the doc shows as needing re-extract instead of
  // pretending to be done.
  //
  // v2.6 loosens this guard. Previously it fired on (edges=0 AND
  // quotes=0), which killed docs whose pass 2 (relational LLM) timed out
  // but whose pass 1 (factual + attributed-assertions) succeeded. Those
  // docs DO have information — attributed claims fed by the firewall as
  // assertions, even without supporting quotes. Now the guard fires only
  // when pass 1 produced nothing of substance either.
  if (
    startChunk === 0 &&
    totals.nodes > 0 &&
    totals.edges === 0 &&
    totals.quotes === 0 &&
    totals.assertions === 0 &&
    chunks.length > 0
  ) {
    result.failed_step = "extract_claims";
    result.failed_reason = "hollow extraction: nodes without edges, quotes, or assertions";
    await emit(env, args, "extract_claims", "failed", {
      error: result.failed_reason,
      nodes: totals.nodes,
    });
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
