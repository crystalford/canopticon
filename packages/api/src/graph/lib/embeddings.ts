// Embeddings: Workers AI bge-large-en-v1.5 (1024-dim, cosine) -> Vectorize.

import type { Env } from "../../env";

const EMBED_MODEL = "@cf/baai/bge-large-en-v1.5";

// Hard ceiling on the Workers AI / Vectorize round-trips. Without this, a slow
// or unresponsive model endpoint (the catalog churns; bindings stall) leaves
// the await hanging until the Worker blows its wall-clock budget — which
// surfaces as "D1 DB storage operation exceeded timeout which caused object to
// be reset" and rolls back the request's in-flight writes. A bounded call
// fails fast instead; every caller already treats embedding as best-effort.
const EMBED_TIMEOUT_MS = 10_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms),
    ),
  ]);
}

interface BgeResponse {
  shape?: number[];
  data: number[][];
}

export async function embedText(env: Env, text: string): Promise<number[]> {
  const trimmed = text.slice(0, 4000); // model context limit is ~512 tokens
  const res = (await withTimeout(
    env.AI.run(EMBED_MODEL as never, { text: [trimmed] } as never) as Promise<unknown>,
    EMBED_TIMEOUT_MS,
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
    EMBED_TIMEOUT_MS,
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
  const res = await env.EMBEDDINGS.query(values, {
    topK: args.topK ?? 12,
    returnMetadata: true,
    filter: filter as VectorizeVectorMetadataFilter,
  });
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
