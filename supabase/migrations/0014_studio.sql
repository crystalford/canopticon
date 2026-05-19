-- Studio compartment — audio production. Additive: lives alongside the
-- existing video-era `productions` table from 0005, prefixed `studio_`
-- to avoid collision. CMS/Graph tables are NOT modified.
--
-- One-directional refs: studio rows may reference posts(id) and
-- theses(id) for provenance; CMS/Graph never FKs into studio.

CREATE TABLE studio_productions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  source_thesis_id TEXT REFERENCES theses(id) ON DELETE SET NULL,
  source_kind TEXT NOT NULL DEFAULT 'post'
    CHECK (source_kind IN ('post','thesis','claims','blank')),
  state TEXT NOT NULL DEFAULT 'script_proposed'
    CHECK (state IN ('script_proposed','script_approved','recording','paused','stitching','rendered','archived')),
  script_md TEXT,
  script_total_seconds INTEGER,
  coherence_notes TEXT,
  use_anthropic INTEGER NOT NULL DEFAULT 0,
  rendered_audio_uri TEXT,
  rendered_at TEXT,
  paused_at TEXT,
  archived_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX studio_productions_user_state_idx
  ON studio_productions (user_id, state, updated_at DESC);

CREATE TABLE studio_beats (
  id TEXT PRIMARY KEY,
  production_id TEXT NOT NULL REFERENCES studio_productions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  beat_index INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'context'
    CHECK (role IN ('open','context','turn','evidence','reflect','close','transition')),
  cue TEXT,
  beat_text TEXT NOT NULL,
  next_preview TEXT,
  target_seconds INTEGER,
  cited_claim_id TEXT REFERENCES claims(id) ON DELETE SET NULL,
  recorded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (production_id, beat_index)
);
CREATE INDEX studio_beats_production_idx ON studio_beats (production_id, beat_index);

CREATE TABLE studio_recordings (
  id TEXT PRIMARY KEY,
  beat_id TEXT NOT NULL REFERENCES studio_beats(id) ON DELETE CASCADE,
  production_id TEXT NOT NULL REFERENCES studio_productions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  take_number INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'audio/webm',
  duration_ms INTEGER,
  byte_size INTEGER,
  superseded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (beat_id, take_number)
);
CREATE INDEX studio_recordings_beat_active_idx
  ON studio_recordings (beat_id) WHERE superseded = 0;

CREATE TABLE studio_jobs (
  id TEXT PRIMARY KEY,
  production_id TEXT NOT NULL REFERENCES studio_productions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('script_ideator','script_coherence','stitch')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','failed')),
  workflow_id TEXT,
  input TEXT,
  output TEXT,
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX studio_jobs_production_idx ON studio_jobs (production_id, created_at DESC);
