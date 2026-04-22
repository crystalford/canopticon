-- Semantic similarity search over claims using pgvector
-- Requires: extension vector already installed (done in schema.sql)

CREATE OR REPLACE FUNCTION search_claims_semantic(
  query_embedding vector(1536),
  match_count int DEFAULT 20,
  filter_entity_id uuid DEFAULT NULL,
  filter_status text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  confidence float,
  resonance float,
  status text,
  entity_ids uuid[],
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.confidence,
    c.resonance,
    c.status,
    c.entity_ids,
    c.created_at,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM claims c
  WHERE c.embedding IS NOT NULL
    AND (filter_entity_id IS NULL OR c.entity_ids @> ARRAY[filter_entity_id])
    AND (filter_status IS NULL OR c.status = filter_status)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- IVFFlat index for fast approximate nearest-neighbor search
-- Create after initial data load for best performance
-- CREATE INDEX CONCURRENTLY ON claims USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
