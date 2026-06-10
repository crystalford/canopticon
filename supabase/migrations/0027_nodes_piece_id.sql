-- 0027_nodes_piece_id.sql — index the piece→nodes lookup.
--
-- The typed-graph extractor (migration 0026 + digestion-typed.ts) needs two
-- piece-scoped operations on every run:
--   1. ensureSourceNode  — find the Source node for a piece.
--   2. purgeTypedGraphForPiece — delete a piece's prior typed graph before
--      re-extracting (idempotency, spec Part 19).
--
-- Both were filtering on json_extract(metadata, '$.piece_id'), an unindexed
-- full-table scan of `nodes`. Combined with one-INSERT-at-a-time persistence,
-- that contributed to D1 storage-operation timeouts on real documents.
--
-- This migration promotes piece_id to a real, indexed column. The extractor
-- now sets it on insert and filters on it (index hit). metadata.piece_id is
-- kept in parallel for back-compat; this column is the query path.
--
-- Additive + backfilled: existing typed-graph rows (if any) get piece_id
-- copied out of their metadata JSON so the new lookups find them too.

ALTER TABLE nodes ADD COLUMN piece_id TEXT;

CREATE INDEX nodes_user_piece_idx ON nodes (user_id, piece_id);

-- Backfill any rows written before this column existed.
UPDATE nodes
   SET piece_id = json_extract(metadata, '$.piece_id')
 WHERE piece_id IS NULL
   AND json_extract(metadata, '$.piece_id') IS NOT NULL;
