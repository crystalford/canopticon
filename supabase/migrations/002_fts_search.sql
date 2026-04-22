-- Migration 002: Full-text search on claims and entities
-- Replaces the pgvector/OpenAI approach with Postgres native FTS
-- Uses tsvector with GIN indexes and trigger-maintained columns

-- Claims FTS
ALTER TABLE claims ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION claims_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector = to_tsvector('english', coalesce(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claims_search_trigger
  BEFORE INSERT OR UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION claims_search_update();

-- Backfill existing rows
UPDATE claims SET search_vector = to_tsvector('english', coalesce(content, ''));

CREATE INDEX IF NOT EXISTS claims_search_idx ON claims USING GIN(search_vector);

-- Entities FTS (name + description)
ALTER TABLE entities ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION entities_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector = to_tsvector('english',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.subtype, '') || ' ' ||
    coalesce(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entities_search_trigger
  BEFORE INSERT OR UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION entities_search_update();

UPDATE entities SET search_vector = to_tsvector('english',
  coalesce(name, '') || ' ' || coalesce(subtype, '') || ' ' || coalesce(description, '')
);

CREATE INDEX IF NOT EXISTS entities_search_idx ON entities USING GIN(search_vector);

-- Claims FTS search function
-- Uses websearch_to_tsquery so natural input ("mark carney funding") works without & syntax
CREATE OR REPLACE FUNCTION search_claims_fts(
  query_text text,
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
  rank real
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.content, c.confidence, c.resonance, c.status,
    c.entity_ids, c.created_at,
    ts_rank(c.search_vector, websearch_to_tsquery('english', query_text)) AS rank
  FROM claims c
  WHERE c.search_vector @@ websearch_to_tsquery('english', query_text)
    AND (filter_entity_id IS NULL OR c.entity_ids @> ARRAY[filter_entity_id])
    AND (filter_status IS NULL OR c.status = filter_status)
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- Entities FTS search function
CREATE OR REPLACE FUNCTION search_entities_fts(
  query_text text,
  match_count int DEFAULT 20,
  filter_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  entity_id text,
  name text,
  type text,
  subtype text,
  description text,
  confidence_score float,
  resonance_score float,
  status text,
  rank real
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id, e.entity_id, e.name, e.type, e.subtype, e.description,
    e.confidence_score, e.resonance_score, e.status,
    ts_rank(e.search_vector, websearch_to_tsquery('english', query_text)) AS rank
  FROM entities e
  WHERE e.search_vector @@ websearch_to_tsquery('english', query_text)
    AND (filter_type IS NULL OR e.type = filter_type)
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;
