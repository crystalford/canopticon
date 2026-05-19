-- Monitor cluster: curated, scheduled "watchers" that fire an agent loop
-- against a high-signal source (BIS press, FSB correspondence, etc.) and
-- ingest only what's genuinely new+significant.

CREATE TABLE monitors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  source_url TEXT NOT NULL,
  cadence_cron TEXT NOT NULL,
  scout_prompt TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  last_status TEXT,
  last_finding TEXT,
  last_source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX monitors_user_idx ON monitors (user_id, enabled);
