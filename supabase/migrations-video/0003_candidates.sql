-- 0003_candidates.sql — Phase 1's daily story radar.
--
-- The cron handler (packages/video/src/index.ts scheduled()) writes
-- one row per clip GDELT surfaces. The rubric scorer fills in the
-- score columns. The /queue operator page reads from here.

CREATE TABLE candidates (
  id TEXT PRIMARY KEY,
  network TEXT NOT NULL,
  clip_url TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  headline TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  entities_json TEXT,
  -- "gdelt" when the live API surfaced it; "stub" when the API was
  -- unreachable and we fell back to a small fixture list.
  source TEXT NOT NULL CHECK (source IN ('gdelt', 'stub')),
  -- Rubric outcomes (NULL until scored).
  rubric_score REAL,
  rubric_json TEXT,
  cast_template TEXT,
  -- Lifecycle: discovered → scored → cast → promoted | rejected
  status TEXT NOT NULL
    CHECK (status IN ('discovered', 'scored', 'cast', 'promoted', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX candidates_captured_idx ON candidates (captured_at DESC);
CREATE INDEX candidates_status_idx ON candidates (status, captured_at DESC);
CREATE INDEX candidates_score_idx ON candidates (rubric_score DESC);
