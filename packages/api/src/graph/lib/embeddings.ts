// Embeddings: Workers AI bge-m3 (1024-dim, cosine) -> Vectorize.
//
// Swapped from bge-large-en-v1.5 2026-07-24 after a live catalog sweep
// turned up bge-m3 (same BAAI lab, newer, multi-functionality/
// multi-granularity per Cloudflare's own description). Verified via
// /v1/admin/debug-embed before switching: bge-m3 outputs the same 1024
// dims (drop-in, no new Vectorize index needed) and embeds in ~340ms —
// qwen3-embedding-0.6b was also 1024-dim but ~17x slower (5.8s, too slow
// for a call on every search), and embeddinggemma-300m is 768-dim
// (would need a brand new index). Existing vectors were written with the
// old model and are NOT comparable to bge-m3 queries via cosine — see
// advanceReembedBackfill below (cron-driven, index.ts) for the one-time
// backfill this requires for the "piece" kind (the confirmed-live,
// most-searched one; entity/claim/thesis/source kinds weren't re-embedded
// in this pass — their write paths need a closer look before touching
// them). Check progress via GET /v1/admin/reembed-status.

import type { Env } from "../../env";
import { all, insertOne, one } from "../../lib/d1";
import { TIMEOUTS, withTimeout } from "../../lib/timeout";

const EMBED_MODEL = "@cf/baai/bge-m3";

interface BgeResponse {
  shape?: number[];
  data: number[][];
}

export async function embedText(env: Env, text: string): Promise<number[]> {
  const trimmed = text.slice(0, 4000); // model context limit is ~512 tokens
  const res = (await withTimeout(
    env.AI.run(EMBED_MODEL as never, { text: [trimmed] } as never) as Promise<unknown>,
    TIMEOUTS.EMBED_MS,
    "embedText",
  )) as BgeResponse;
  const vec = res.data?.[0];
  if (!vec || vec.length === 0) throw new Error("Embedding model returned empty vector");
  return vec;
}

export interface VectorMeta {
  user_id: string;
  kind: "entity" | "claim" | "article" | "thesis" | "source" | "piece";
  id: string;
  title?: string;
}

export async function upsertVector(
  env: Env,
  args: { id: string; values: number[]; metadata: VectorMeta },
): Promise<void> {
  await withTimeout(
    env.EMBEDDINGS.upsert([
      {
        id: args.id,
        values: args.values,
        metadata: args.metadata as unknown as Record<string, VectorizeVectorMetadataValue>,
      },
    ]),
    TIMEOUTS.VECTORIZE_MS,
    "upsertVector",
  );
}

export interface VectorSearchHit {
  id: string;
  score: number;
  metadata: VectorMeta;
}

export async function searchVectors(
  env: Env,
  args: {
    query: string;
    userId: string;
    topK?: number | undefined;
    kinds?: VectorMeta["kind"][] | undefined;
  },
): Promise<VectorSearchHit[]> {
  const values = await embedText(env, args.query);
  const filter: Record<string, unknown> = { user_id: args.userId };
  if (args.kinds && args.kinds.length > 0) filter.kind = { $in: args.kinds };
  const res = await withTimeout(
    env.EMBEDDINGS.query(values, {
      topK: args.topK ?? 12,
      returnMetadata: true,
      filter: filter as VectorizeVectorMetadataFilter,
    }),
    TIMEOUTS.VECTORIZE_MS,
    "queryVectors",
  );
  return (res.matches ?? []).map((m) => ({
    id: m.id,
    score: m.score,
    metadata: (m.metadata ?? {}) as unknown as VectorMeta,
  }));
}

/** Convenience: build the canonical vector id for a substrate row. */
export function vectorId(kind: VectorMeta["kind"], id: string): string {
  return `${kind}:${id}`;
}

// One-time backfill for the bge-large-en-v1.5 -> bge-m3 swap (see the
// header comment above): existing "piece" vectors are in the old model's
// embedding space and aren't comparable to bge-m3 queries via cosine.
// Batches 5 pieces per call — small enough to comfortably clear both
// Cloudflare's own limits and (when driven manually via the admin probe)
// its curl call's 30s client-side timeout — and tracks progress via an
// orchestrator_events row instead of a request param, so the cron tick in
// index.ts can drive it forward on its own without any caller having to
// remember an offset. Stops emitting once done; a later tick becomes a
// cheap no-op (one COUNT query) rather than re-scanning forever.
const REEMBED_BATCH = 5;

export async function advanceReembedBackfill(env: Env, userId: string): Promise<void> {
  const done = await one<{ id: string }>(
    env.DB,
    "SELECT id FROM orchestrator_events WHERE user_id = ? AND event_type = 'embeddings.reembed_done' LIMIT 1",
    [userId],
  );
  if (done) return;

  const progress = await one<{ payload: string }>(
    env.DB,
    `SELECT payload FROM orchestrator_events
      WHERE user_id = ? AND event_type = 'embeddings.reembed_progress'
      ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  const offset = progress
    ? (JSON.parse(progress.payload) as { next_offset: number }).next_offset
    : 0;

  const total =
    (
      await one<{ n: number }>(env.DB, "SELECT COUNT(*) AS n FROM pieces WHERE user_id = ?", [
        userId,
      ])
    )?.n ?? 0;
  const pieces = await all<{ id: string; title: string; body_md: string }>(
    env.DB,
    "SELECT id, title, body_md FROM pieces WHERE user_id = ? ORDER BY id LIMIT ? OFFSET ?",
    [userId, REEMBED_BATCH, offset],
  );
  if (pieces.length === 0) {
    await insertOne(env.DB, "orchestrator_events", {
      user_id: userId,
      event_type: "embeddings.reembed_done",
      subject_kind: null,
      subject_id: null,
      payload: { total },
    }).catch(() => {});
    return;
  }

  let embedded = 0;
  for (const p of pieces) {
    try {
      const values = await embedText(env, `${p.title}\n${p.body_md.slice(0, 4000)}`);
      await upsertVector(env, {
        id: vectorId("piece", p.id),
        values,
        metadata: { user_id: userId, kind: "piece", id: p.id, title: p.title },
      });
      embedded++;
    } catch {
      // non-fatal — the next tick moves past this offset regardless;
      // a skipped piece just keeps its stale-model vector until the
      // corpus's own re-digestion naturally refreshes it.
    }
  }
  const nextOffset = offset + pieces.length;
  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: "embeddings.reembed_progress",
    subject_kind: null,
    subject_id: null,
    payload: { next_offset: nextOffset, total, embedded_this_batch: embedded },
  }).catch(() => {});
}
