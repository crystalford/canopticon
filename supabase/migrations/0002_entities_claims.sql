-- 0002_entities_claims.sql
-- Entities (with Vectorize for embeddings) and Toulmin claims.

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person','organization','institution','corporation','department','office','legislation','event','concept','location')),
  canonical_name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  description TEXT,
  public_slug TEXT UNIQUE,
  primary_attribute TEXT,
  active_from TEXT,
  active_to TEXT,
  heat_score REAL NOT NULL DEFAULT 0,
  pinned_thesis_ids TEXT NOT NULL DEFAULT '[]',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX entities_user_type_idx ON entities (user_id, entity_type);
CREATE INDEX entities_canonical_idx ON entities (canonical_name);
CREATE INDEX entities_heat_idx ON entities (user_id, heat_score DESC);

-- Raw entity references captured during claim extraction.
CREATE TABLE entity_mentions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES sources(id) ON DELETE CASCADE,
  claim_id TEXT,
  surface_text TEXT NOT NULL,
  context_snippet TEXT,
  entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  resolution_confidence REAL,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX entity_mentions_user_resolved_idx ON entity_mentions (user_id, resolved, created_at DESC);
CREATE INDEX entity_mentions_entity_idx ON entity_mentions (entity_id) WHERE entity_id IS NOT NULL;

CREATE TABLE entity_relations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  strength REAL NOT NULL DEFAULT 0.5,
  active_from TEXT,
  active_to TEXT,
  evidence_source_ids TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (from_entity_id <> to_entity_id)
);
CREATE INDEX entity_relations_from_idx ON entity_relations (from_entity_id);
CREATE INDEX entity_relations_to_idx ON entity_relations (to_entity_id);

CREATE TABLE entity_resolution_log (
  id TEXT PRIMARY KEY,
  mention_id TEXT NOT NULL REFERENCES entity_mentions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  candidates TEXT NOT NULL DEFAULT '[]',
  decision TEXT,
  matched_entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  reasoning TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE entity_merge_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  surviving_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  merged_entity_id TEXT NOT NULL,
  merged_canonical_name TEXT NOT NULL,
  merged_aliases TEXT NOT NULL DEFAULT '[]',
  reason TEXT,
  performed_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE entity_resolution_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mention_id TEXT NOT NULL REFERENCES entity_mentions(id) ON DELETE CASCADE,
  candidate_entity_ids TEXT NOT NULL DEFAULT '[]',
  candidate_scores TEXT NOT NULL DEFAULT '[]',
  source_id TEXT REFERENCES sources(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','created','deferred')),
  decided_at TEXT,
  decision_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX entity_resolution_queue_user_status_idx ON entity_resolution_queue (user_id, status, created_at);

-- Claims.
CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  layer TEXT NOT NULL CHECK (layer IN ('factual','framing','architectural','distributive')),
  current_version_id TEXT,
  admiralty_grade TEXT CHECK (admiralty_grade IN ('A','B','C','D','E','F')),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','grounded','partial','unsupported','contradicted')),
  ipcc_likelihood TEXT,
  intervention_tier TEXT CHECK (intervention_tier IN ('symptom','mechanism','structural') OR intervention_tier IS NULL),
  public_slug TEXT UNIQUE,
  retired_at TEXT,
  retired_reason TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX claims_user_idx ON claims (user_id, created_at DESC);
CREATE INDEX claims_layer_idx ON claims (layer);
CREATE INDEX claims_grade_idx ON claims (admiralty_grade);
CREATE INDEX claims_verification_idx ON claims (verification_status);

CREATE TABLE claim_versions (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  data TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  warrant TEXT,
  backing TEXT,
  qualifier TEXT,
  rebuttal TEXT,
  change_summary TEXT,
  created_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (claim_id, version_number)
);
CREATE INDEX claim_versions_claim_idx ON claim_versions (claim_id, version_number DESC);

CREATE TABLE claim_entities (
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_in_claim TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (claim_id, entity_id)
);
CREATE INDEX claim_entities_entity_idx ON claim_entities (entity_id);

CREATE TABLE claim_sources (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supports INTEGER NOT NULL DEFAULT 1,
  citation_excerpt TEXT,
  citation_locator TEXT,
  citation_confidence REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (claim_id, source_id, supports)
);
CREATE INDEX claim_sources_claim_idx ON claim_sources (claim_id);

CREATE TABLE claim_relations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  to_claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  strength REAL NOT NULL DEFAULT 0.5,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (from_claim_id <> to_claim_id)
);
CREATE INDEX claim_relations_from_idx ON claim_relations (from_claim_id);

CREATE TABLE claim_deduplication_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  candidate_claim_ids TEXT NOT NULL DEFAULT '[]',
  candidate_scores TEXT NOT NULL DEFAULT '[]',
  proposed_relation TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','deferred')),
  decided_at TEXT,
  decision_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX claim_dedup_queue_user_status_idx ON claim_deduplication_queue (user_id, status, created_at);
