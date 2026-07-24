-- 0007_transcribe_jobs.sql — video-as-source-material ingestion.
--
-- A new, separate job type from render_jobs: this Worker's existing
-- job/status pattern (queue -> running -> succeeded/failed), reused for
-- the OPPOSITE direction of work — pulling a transcript OUT of a video
-- URL instead of rendering an MP4. The publication's api Worker polls
-- this via a shared-token-authenticated GET, then owns turning a
-- succeeded transcript into a `piece` in its own fact graph — this
-- Worker's job is only "fetch + transcribe", not "extract facts".
--
-- published_at is the VIDEO's own publish date (from yt-dlp's metadata),
-- not this row's created_at — the whole point is treating an imported
-- video as a dated, attributed production, not an undated blob of text.

CREATE TABLE transcribe_jobs (
  id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  title TEXT,
  channel TEXT,
  published_at TEXT,
  duration_s INTEGER,
  transcript TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  started_at TEXT,
  finished_at TEXT
);

CREATE INDEX transcribe_jobs_status_idx ON transcribe_jobs (status, created_at DESC);
