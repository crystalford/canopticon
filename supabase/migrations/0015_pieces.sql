-- Pieces — the new shape replacing legacy CMS posts.
-- Per PROBE spec v3.5 §2.5–§2.6: a piece is one identity with three
-- coordinated representations (markdown body, rendered HTML, claims
-- deposited into the substrate). Each piece carries:
--   - kind: the editorial form (essay / research-report / etc.)
--   - publication_status: working-material (no public page) →
--     published → canonical (the one chain face)
--   - chain_id: for multi-pass research; chained passes default to
--     working-material; only the canonical synthesis gets a public URL
--
-- Legacy `posts` table stays in place during transition (no migration
-- of rows). New code writes pieces; old posts will be dropped in a
-- later migration once nothing reads them.

CREATE TABLE pieces (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  kind TEXT NOT NULL
    CHECK (kind IN ('essay','research-report','documented-record','thesis','synthesis','brief','note')),
  subtype TEXT,
  publication_status TEXT NOT NULL DEFAULT 'working-material'
    CHECK (publication_status IN ('working-material','published','canonical')),
  chain_id TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  body_html TEXT,
  byline TEXT,
  signed_by TEXT,
  signed_at TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  metadata TEXT NOT NULL DEFAULT '{}',
  published_at TEXT,
  asserted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX pieces_user_slug_idx ON pieces (user_id, slug);
CREATE INDEX pieces_user_kind_idx ON pieces (user_id, kind);
CREATE INDEX pieces_user_status_idx
  ON pieces (user_id, publication_status, published_at DESC);
CREATE INDEX pieces_chain_idx ON pieces (chain_id) WHERE chain_id IS NOT NULL;

-- Body version history. Mirror post_versions: every body_md edit bumps
-- a new version for audit and restore.
CREATE TABLE piece_versions (
  id TEXT PRIMARY KEY,
  piece_id TEXT NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body_md TEXT NOT NULL,
  change_summary TEXT,
  saved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (piece_id, version)
);
CREATE INDEX piece_versions_piece_idx ON piece_versions (piece_id, version DESC);
