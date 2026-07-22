-- 0001_video_core.sql — daily forensic video engine core schema.
--
-- Separate D1 (canopticon-video) from the publication. Numbering
-- restarts at 0001 because this migration tree is independent.
--
-- Four tables cover the Phase 0 → Phase 3 lifecycle:
--   segments         — the daily story-of-the-day + its full §7b JSON
--   clips            — broadcast clips cached in R2, with transcripts
--   editorial_takes  — rubric scores + LLM-generated script drafts
--   render_jobs      — Container render lifecycle + metrics

CREATE TABLE segments (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  status TEXT NOT NULL
    CHECK (status IN ('drafted', 'awaiting_approval', 'approved', 'rendered', 'published', 'killed')),
  source_rubric_score REAL,
  template TEXT NOT NULL,
  forensic_turn TEXT,
  needs_human INTEGER NOT NULL DEFAULT 1,
  -- The full §7b JSON contract. Renderer reads this; editorial brain
  -- (Phase 1) writes it.
  payload_json TEXT NOT NULL
);
CREATE INDEX segments_created_idx ON segments (created_at DESC);
CREATE INDEX segments_status_idx ON segments (status, created_at DESC);

CREATE TABLE clips (
  id TEXT PRIMARY KEY,
  segment_id TEXT REFERENCES segments(id) ON DELETE CASCADE,
  source TEXT NOT NULL,         -- gdelt | ia | official | fixture
  external_url TEXT NOT NULL,
  r2_key TEXT,                  -- cached MP4 in ASSETS bucket
  duration_ms INTEGER,
  transcript_json TEXT,         -- Whisper output (Phase 1)
  fetched_at TEXT
);
CREATE INDEX clips_segment_idx ON clips (segment_id);

CREATE TABLE editorial_takes (
  id TEXT PRIMARY KEY,
  segment_id TEXT REFERENCES segments(id) ON DELETE CASCADE,
  rubric_json TEXT NOT NULL,    -- per-criterion scores from the rubric
  script_json TEXT NOT NULL,    -- the LLM-emitted §7b draft
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX editorial_takes_segment_idx ON editorial_takes (segment_id, created_at DESC);

CREATE TABLE render_jobs (
  id TEXT PRIMARY KEY,
  segment_id TEXT REFERENCES segments(id),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  started_at TEXT,
  finished_at TEXT,
  r2_key TEXT,
  walltime_ms INTEGER,
  est_cost_cents REAL,
  error TEXT,
  -- Exact JSON the renderer ran. Useful for reproducing failures.
  payload_json TEXT NOT NULL
);
CREATE INDEX render_jobs_status_idx ON render_jobs (status, started_at DESC);
CREATE INDEX render_jobs_segment_idx ON render_jobs (segment_id, started_at DESC);
