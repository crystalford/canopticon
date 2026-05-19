// Embeddings: Workers AI bge-large-en-v1.5 (1024-dim, cosine) -> Vectorize.

import type { Env } from "../../env";

const EMBED_MODEL = "@cf/baai/bge-large-en-v1.5";

interface BgeResponse {
  shape?: number[];
  data: number[][];
}

export async function embedText(env: Env, text: string): Promise<number[]> {
  const trimmed = text.slice(0, 4000); // model context limit is ~512 tokens
  const res = (await env.AI.run(
    EMBED_MODEL as never,
    { text: [trimmed] } as never,
  )) as unknown as BgeResponse;
  const vec = res.data?.[0];
  if (!vec || vec.length === 0) throw new Error("Embedding model returned empty vector");
  return vec;
}

export interface VectorMeta {
  user_id: string;
  kind: "entity" | "claim" | "article" | "thesis" | "source";
  id: string;
  title?: string;
}

export async function upsertVector(
  env: Env,
  args: { id: string; values: number[]; metadata: VectorMeta },
): Promise<void> {
  await env.EMBEDDINGS.upsert([
    {
      id: args.id,
      values: args.values,
      metadata: args.metadata as unknown as Record<string, VectorizeVectorMetadataValue>,
    },
  ]);
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
