-- digest_jobs — durable queue for document ingest.
--
-- Each uploaded document gets one row. The upload handler enqueues it and
-- kicks off processing in waitUntil for instant start; the every-minute cron
-- drains anything still queued or stalled, so a single Worker timeout can
-- never leave a doc permanently stuck.
--
-- Lifecycle: queued -> running -> (completed | failed)
--   * queued     — created by upload; not yet started
--   * running    — claimed by an executor; heartbeat_at updated as it works
--   * completed  — digest() finished; claims_count holds the total
--   * failed     — attempts maxed out (or non-retriable error)
--
-- Stalled detection: status='running' with heartbeat_at older than ~2 min
-- means the waitUntil run was killed; the cron picks it back up and bumps
-- attempts. runDigestJob() is idempotent — it clears any prior claims for the
-- piece before re-persisting so retries never double-insert.

CREATE TABLE IF NOT EXISTS digest_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  piece_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','failed')),
  step TEXT NOT NULL DEFAULT 'queued',
  claims_count INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  heartbeat_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS digest_jobs_user_status_idx
  ON digest_jobs (user_id, status, created_at);
CREATE INDEX IF NOT EXISTS digest_jobs_piece_idx
  ON digest_jobs (piece_id);
