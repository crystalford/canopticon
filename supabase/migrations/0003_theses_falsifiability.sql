-- 0003_theses_falsifiability.sql
-- Theses, assumptions, indicators, predictions, contradictions.

CREATE TABLE theses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  seed_summary TEXT,
  cynefin_domain TEXT CHECK (cynefin_domain IN ('simple','complicated','complex','chaotic') OR cynefin_domain IS NULL),
  current_version_id TEXT,
  coined_phrase TEXT,
  coined_phrase_definition TEXT,
  ipcc_likelihood TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  public_slug TEXT UNIQUE,
  published_at TEXT,
  primary_operator TEXT,
  falsifying_observation TEXT,
  is_falsifiable INTEGER NOT NULL DEFAULT 0,
  public_graph_artifact_uri TEXT,
  teachable_diagram_uri TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX theses_user_idx ON theses (user_id, created_at DESC);
CREATE INDEX theses_public_idx ON theses (user_id, is_public, published_at DESC) WHERE is_public = 1;

CREATE TABLE thesis_versions (
  id TEXT PRIMARY KEY,
  thesis_id TEXT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  tier_bluf TEXT NOT NULL,
  tier_80 TEXT NOT NULL,
  tier_800 TEXT NOT NULL,
  tier_full TEXT,
  ipcc_likelihood TEXT,
  grade_weighted_ratio REAL,
  change_summary TEXT,
  created_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (thesis_id, version_number)
);
CREATE INDEX thesis_versions_thesis_idx ON thesis_versions (thesis_id, version_number DESC);

CREATE TABLE thesis_claims (
  thesis_version_id TEXT NOT NULL REFERENCES thesis_versions(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_linchpin INTEGER NOT NULL DEFAULT 0,
  weight REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (thesis_version_id, claim_id)
);
CREATE INDEX thesis_claims_claim_idx ON thesis_claims (claim_id);

CREATE TABLE thesis_watch_sets (
  id TEXT PRIMARY KEY,
  thesis_id TEXT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
  excluded INTEGER NOT NULL DEFAULT 0,
  pinned_by_operator INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX thesis_watch_sets_thesis_idx ON thesis_watch_sets (thesis_id);

CREATE TABLE thesis_concept_spine (
  id TEXT PRIMARY KEY,
  thesis_id TEXT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX thesis_concept_spine_thesis_idx ON thesis_concept_spine (thesis_id);

CREATE TABLE thesis_inbox (
  id TEXT PRIMARY KEY,
  thesis_id TEXT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  routing_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','integrated','rejected','deferred')),
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (thesis_id, claim_id)
);
CREATE INDEX thesis_inbox_thesis_status_idx ON thesis_inbox (thesis_id, status, created_at);

CREATE TABLE coined_phrase_first_uses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phrase TEXT NOT NULL,
  thesis_id TEXT REFERENCES theses(id) ON DELETE SET NULL,
  external_first_use TEXT,
  external_first_use_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, phrase)
);

-- Falsifiability infrastructure.
CREATE TABLE assumptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thesis_id TEXT REFERENCES theses(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  is_linchpin INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'holding' CHECK (status IN ('holding','weakening','broken','confirmed')),
  audited_at TEXT,
  audit_notes TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX assumptions_thesis_idx ON assumptions (thesis_id) WHERE thesis_id IS NOT NULL;

CREATE TABLE assumption_supporting_claims (
  assumption_id TEXT NOT NULL REFERENCES assumptions(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (assumption_id, claim_id)
);

CREATE TABLE indicators (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thesis_id TEXT REFERENCES theses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  expected_direction TEXT,
  threshold_value REAL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','rejected','retired')),
  validated_by_validator INTEGER NOT NULL DEFAULT 0,
  validation_notes TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX indicators_thesis_idx ON indicators (thesis_id) WHERE thesis_id IS NOT NULL;

CREATE TABLE indicator_observations (
  id TEXT PRIMARY KEY,
  indicator_id TEXT NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value REAL NOT NULL,
  observed_at TEXT NOT NULL,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX indicator_observations_indicator_idx ON indicator_observations (indicator_id, observed_at DESC);

CREATE TABLE predictions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thesis_id TEXT REFERENCES theses(id) ON DELETE CASCADE,
  claim_id TEXT REFERENCES claims(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  confidence_pct INTEGER NOT NULL CHECK (confidence_pct BETWEEN 0 AND 100),
  ipcc_likelihood TEXT,
  resolution_criterion TEXT NOT NULL,
  resolution_horizon TEXT NOT NULL,
  domain TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved_correct','resolved_incorrect','resolved_ambiguous','retired')),
  resolved_at TEXT,
  resolved_outcome TEXT,
  brier_contribution REAL,
  is_public INTEGER NOT NULL DEFAULT 0,
  public_slug TEXT UNIQUE,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX predictions_user_status_idx ON predictions (user_id, status, created_at DESC);
CREATE INDEX predictions_horizon_idx ON predictions (resolution_horizon) WHERE status = 'active';
CREATE INDEX predictions_public_idx ON predictions (user_id, is_public, created_at DESC) WHERE is_public = 1;

CREATE TABLE contradictions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_a_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  claim_b_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  detected_by TEXT NOT NULL,
  posture TEXT NOT NULL DEFAULT 'open' CHECK (posture IN ('open','resolved_a','resolved_b','machloket','retired')),
  resolution_reasoning TEXT,
  affected_thesis_ids TEXT NOT NULL DEFAULT '[]',
  is_public INTEGER NOT NULL DEFAULT 0,
  public_slug TEXT UNIQUE,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (claim_a_id <> claim_b_id)
);
CREATE INDEX contradictions_user_posture_idx ON contradictions (user_id, posture, created_at DESC);
CREATE INDEX contradictions_public_idx ON contradictions (user_id, is_public) WHERE is_public = 1;
