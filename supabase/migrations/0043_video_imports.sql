-- 0043_video_imports.sql — video-as-source-material ingestion (Phase 1
-- of the video-commentary intake idea). Tracks a transcription request
-- from submission through the video Worker's async job to the piece it
-- becomes here, once transcribed. Separate from the video Worker's own
-- transcribe_jobs table (migrations-video/0007) — that one is the video
-- Worker's private job-queue bookkeeping for the fetch+transcribe work;
-- this one is the publication's own record of "I asked for this video,
-- here's what became of it," and is what the operator-facing status
-- screen polls.

CREATE TABLE video_imports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  video_job_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed')),
  piece_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX video_imports_user_idx ON video_imports (user_id, created_at DESC);
