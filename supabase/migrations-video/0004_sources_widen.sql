-- 0004_sources_widen.sql — widen candidates.source CHECK to admit the
-- Brave Search + RSS radars added in Phase 1B.
--
-- SQLite can't alter a CHECK constraint in place, so this rebuilds the
-- table. Existing rows survive (no source values from the new set
-- exist yet; the previous CHECK only had 'gdelt' and 'stub').

PRAGMA foreign_keys = OFF;

CREATE TABLE candidates_new (
  id TEXT PRIMARY KEY,
  network TEXT NOT NULL,
  clip_url TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  headline TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  entities_json TEXT,
  source TEXT NOT NULL CHECK (source IN ('gdelt', 'brave', 'rss', 'stub')),
  rubric_score REAL,
  rubric_json TEXT,
  cast_template TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('discovered', 'scored', 'cast', 'promoted', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO candidates_new SELECT * FROM candidates;
DROP TABLE candidates;
ALTER TABLE candidates_new RENAME TO candidates;

CREATE INDEX candidates_captured_idx ON candidates (captured_at DESC);
CREATE INDEX candidates_status_idx ON candidates (status, captured_at DESC);
CREATE INDEX candidates_score_idx ON candidates (rubric_score DESC);

PRAGMA foreign_keys = ON;
