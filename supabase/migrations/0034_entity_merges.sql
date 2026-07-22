-- 0034_entity_merges.sql — audit trail for automatic entity-alias merges.
--
-- Extraction pulls entity names verbatim from text, so a document that
-- writes "the Parliamentary Budget Officer" once and "the PBO" everywhere
-- after creates TWO separate entity nodes for the same real-world thing.
-- Each fragment individually accumulates too few quotes to ever cross the
-- draft-reading MIN_QUOTES bar, and both get autoseeded their own thin
-- public page — the exact "bare acronym stub" problem the operator found
-- live on the homepage.
--
-- entity-resolution.ts merges HIGH-CONFIDENCE cases only (acronym-to-full-
-- name, unambiguous — see that file's own comment for exactly what
-- qualifies) and records what it did here. The alias node itself is
-- deleted once every foreign-key reference to it (edges, quotes,
-- assertions, node_props, its own page row) has been redirected onto the
-- canonical node, so this table is the only surviving record of the merge
-- — kept so a wrong merge is at least visible and traceable, not silent.
CREATE TABLE entity_merges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  canonical_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  canonical_label TEXT NOT NULL,
  alias_label TEXT NOT NULL,
  method TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX entity_merges_user_idx ON entity_merges (user_id, created_at DESC);
CREATE INDEX entity_merges_canonical_idx ON entity_merges (canonical_node_id);
