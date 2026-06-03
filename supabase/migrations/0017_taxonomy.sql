-- Taxonomy — topics, collections, chains.
-- The five-pillar nav from PROBE spec §5.0:
--   Topics · Investigations · The Record · Patterns · Library
-- Topics are subject pillars; collections are curated reading paths
-- within topics; chains are multi-pass research sequences (e.g. the
-- polling Pass 2–7 series).
--
-- The anti-orphan invariant from spec §5.7: every published piece must
-- map to ≥1 topic. Enforced at insert time in the chat tools and at
-- render time by the public site.

CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  overview_md TEXT NOT NULL DEFAULT '',
  overview_html TEXT,
  signed_by TEXT,
  signed_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX topics_user_slug_idx ON topics (user_id, slug);

CREATE TABLE topic_pieces (
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  piece_id TEXT NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (topic_id, piece_id)
);
CREATE INDEX topic_pieces_piece_idx ON topic_pieces (piece_id);

CREATE TABLE topic_entities (
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (topic_id, entity_id)
);
CREATE INDEX topic_entities_entity_idx ON topic_entities (entity_id);

-- Collections — curated reading paths inside topics. A collection
-- bundles 3–7 pieces with a short editorial blurb. They surface as a
-- "Reading path" module on the topic page, not as a top-level nav
-- destination (per spec §5.4: collapse the old separate Collections
-- nav into Topics).
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT REFERENCES topics(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  blurb_md TEXT NOT NULL DEFAULT '',
  signed_by TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX collections_user_slug_idx ON collections (user_id, slug);
CREATE INDEX collections_topic_idx
  ON collections (topic_id) WHERE topic_id IS NOT NULL;

CREATE TABLE collection_pieces (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  piece_id TEXT NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  PRIMARY KEY (collection_id, piece_id)
);

-- Chains — multi-pass research sequences on the same subject.
-- Per spec §2.6: passes default to working-material (no public page);
-- one canonical synthesis is the public face. Chain identity collapses
-- a 7-pass research into one investigation for counting purposes.
CREATE TABLE chains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  subject TEXT,
  started_at TEXT,
  canonical_piece_id TEXT REFERENCES pieces(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX chains_user_slug_idx ON chains (user_id, slug);

CREATE TABLE chain_passes (
  chain_id TEXT NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
  piece_id TEXT NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pass_number INTEGER NOT NULL,
  relation_kind TEXT NOT NULL DEFAULT 'extends'
    CHECK (relation_kind IN ('supersedes','extends','part_of_chain')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (chain_id, piece_id),
  UNIQUE (chain_id, pass_number)
);
CREATE INDEX chain_passes_piece_idx ON chain_passes (piece_id);
