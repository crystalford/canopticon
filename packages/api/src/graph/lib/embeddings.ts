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
// admin/runtime.ts's /reembed-pieces for the one-time backfill this
// requires for the "piece" kind (the confirmed-live, most-searched one;
// entity/claim/thesis/source kinds weren't re-embedded in this pass —
// their write paths need a closer look before touching them).

import type { Env } from "../../env";
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
