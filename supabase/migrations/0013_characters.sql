-- Character profiles — first-class dossiers for the public figures the
-- operator tracks. Auto-promoted from entities when heat_score crosses
-- a threshold; manually promoted otherwise. Bio + timeline + proposals
-- table for the auto-update review queue.

ALTER TABLE entities ADD COLUMN is_character INTEGER NOT NULL DEFAULT 0;
ALTER TABLE entities ADD COLUMN auto_promoted_at TEXT;
CREATE INDEX entities_character_idx ON entities (is_character) WHERE is_character = 1;

CREATE TABLE character_profiles (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL UNIQUE REFERENCES entities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  canonical_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  current_role TEXT,
  bio_md TEXT NOT NULL DEFAULT '',
  bio_html TEXT,
  wikipedia_url TEXT,
  portrait_url TEXT,
  last_synced_at TEXT,
  version_count INTEGER NOT NULL DEFAULT 1,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX character_profiles_user_idx ON character_profiles (user_id, updated_at DESC);

CREATE TABLE character_timeline_events (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  event_date TEXT NOT NULL,
  event_title TEXT NOT NULL,
  event_body TEXT,
  source_claim_ids TEXT NOT NULL DEFAULT '[]',
  significance TEXT NOT NULL DEFAULT 'context'
    CHECK (significance IN ('major','context')),
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','confirmed','rejected')),
  proposed_by TEXT NOT NULL DEFAULT 'agent'
    CHECK (proposed_by IN ('agent','operator','wikipedia_seed')),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX character_timeline_entity_idx
  ON character_timeline_events (entity_id, event_date DESC);
CREATE INDEX character_timeline_pending_idx
  ON character_timeline_events (entity_id, status) WHERE status = 'proposed';

CREATE TABLE character_profile_versions (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  bio_md TEXT NOT NULL,
  change_summary TEXT,
  saved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (entity_id, version_number)
);

CREATE TABLE character_update_proposals (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN ('timeline_event','bio_revision','role_change')),
  proposed_payload TEXT NOT NULL,
  rationale TEXT,
  source_claim_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  reviewed_at TEXT
);
CREATE INDEX character_proposals_pending_idx
  ON character_update_proposals (entity_id, status) WHERE status = 'pending';
