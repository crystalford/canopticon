-- Widen patterns.kind to include 'connection' and 'gap'.
--
-- The synthesis surfacer (graph/lib/synthesis-surfacer.ts) writes four
-- kinds of finding cards:
--   - recurring-actor   (already allowed)
--   - contradiction     (already allowed)
--   - connection        (new — entity pairs sharing investigations)
--   - gap               (new — entities with investigations but weak claims)
--
-- SQLite doesn't allow ALTER TABLE to modify a CHECK constraint, so we
-- use the standard table-swap pattern: create a new patterns table with
-- the widened check, copy rows, drop the old one, rename. Indexes get
-- recreated; foreign keys that reference patterns(id) (pattern_pieces,
-- pattern_entities, pattern_topics) survive because we keep the same
-- primary key values.

PRAGMA foreign_keys = OFF;

CREATE TABLE patterns_v2 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL
    CHECK (kind IN (
      'recurring-actor','frame','contradiction','rules-for-thee',
      'measurement','net-zero','connection','gap','other'
    )),
  title TEXT NOT NULL,
  statement_md TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium'
    CHECK (confidence IN ('low','medium','high')),
  signed_by TEXT,
  signed_at TEXT,
  disconfirming_md TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate','signed','dismissed')),
  dismissal_reason TEXT,
  notes_md TEXT,
  date_range_from TEXT,
  date_range_to TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO patterns_v2 SELECT * FROM patterns;
DROP TABLE patterns;
ALTER TABLE patterns_v2 RENAME TO patterns;

CREATE UNIQUE INDEX patterns_user_slug_idx ON patterns (user_id, slug);
CREATE INDEX patterns_user_status_idx ON patterns (user_id, status, updated_at DESC);

PRAGMA foreign_keys = ON;
