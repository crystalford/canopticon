// Embedding generation is intentionally disabled.
// The graph is too sparse for semantic search to outperform Postgres FTS.
// When the graph exceeds ~5,000 claims, swap this out for Voyage AI:
//   VOYAGE_API_KEY in env, model: voyage-3-lite ($0.02/M tokens)
//   POST https://api.voyageai.com/v1/embeddings
//   1024-dim output — update schema to vector(1024) at that point.

export async function generateEmbedding(_text: string): Promise<null> {
  return null
}
