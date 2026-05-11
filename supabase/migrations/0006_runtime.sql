-- 0006_runtime.sql
-- Questions, adversarial outputs, role infrastructure, public cache.

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thesis_id TEXT REFERENCES theses(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  eig_score REAL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','answered','retired','deferred')),
  answered_by_claim_ids TEXT NOT NULL DEFAULT '[]',
  related_entity_ids TEXT NOT NULL DEFAULT '[]',
  retired_reason TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX questions_user_state_idx ON questions (user_id, state, created_at DESC);
CREATE INDEX questions_eig_idx ON questions (user_id, eig_score DESC) WHERE state = 'open';

CREATE TABLE question_dependencies (
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  depends_on_question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (question_id, depends_on_question_id),
  CHECK (question_id <> depends_on_question_id)
);

-- Adversarial outputs.
CREATE TABLE red_team_objections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thesis_id TEXT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  vantage TEXT NOT NULL,
  objection_text TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('minor','moderate','severe','fatal')),
  proposed_response TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_via_steelman_id TEXT,
  role_invocation_id TEXT,
  raw_output TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX red_team_objections_thesis_idx ON red_team_objections (thesis_id, severity, created_at DESC);

CREATE TABLE premortem_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thesis_id TEXT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  failure_mode_summary TEXT NOT NULL,
  falsifying_observation TEXT NOT NULL,
  is_falsifiable INTEGER NOT NULL DEFAULT 1,
  fatal INTEGER NOT NULL DEFAULT 0,
  role_invocation_id TEXT,
  raw_output TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE gap_surfacer_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thesis_id TEXT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  stage_gaps TEXT NOT NULL DEFAULT '{}',
  structural_holes TEXT NOT NULL DEFAULT '[]',
  summary TEXT,
  role_invocation_id TEXT,
  raw_output TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Role registry and invocation log.
CREATE TABLE role_definitions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  model TEXT NOT NULL DEFAULT 'claude-opus-4-7',
  features TEXT NOT NULL DEFAULT '{}',
  prompt_template TEXT NOT NULL,
  schema_json TEXT,
  skill_md_hash TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, name)
);
CREATE INDEX role_definitions_user_idx ON role_definitions (user_id);

CREATE TABLE role_invocations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  role_definition_id TEXT REFERENCES role_definitions(id) ON DELETE SET NULL,
  cascade_run_id TEXT,
  workflow_run_id TEXT,
  input_snapshot TEXT,
  output_payload TEXT,
  cost_cents REAL,
  cost_ledger_id TEXT REFERENCES cost_ledger(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  error_message TEXT,
  duration_ms INTEGER,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT
);
CREATE INDEX role_invocations_user_role_idx ON role_invocations (user_id, role_name, created_at DESC);
CREATE UNIQUE INDEX role_invocations_idem_idx ON role_invocations (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE cascade_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled')),
  steps_completed TEXT NOT NULL DEFAULT '[]',
  current_step TEXT,
  trigger_source TEXT NOT NULL,
  budget_cents REAL NOT NULL DEFAULT 0,
  spent_cents REAL NOT NULL DEFAULT 0,
  stats TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX cascade_runs_user_idx ON cascade_runs (user_id, created_at DESC);

CREATE TABLE workflow_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workflow_name TEXT NOT NULL,
  target_kind TEXT,
  target_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled','awaiting_operator')),
  steps_completed TEXT NOT NULL DEFAULT '[]',
  current_step TEXT,
  context TEXT NOT NULL DEFAULT '{}',
  result TEXT,
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX workflow_runs_user_workflow_idx ON workflow_runs (user_id, workflow_name, created_at DESC);

CREATE TABLE orchestrator_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  trace_id TEXT,
  cascade_run_id TEXT REFERENCES cascade_runs(id) ON DELETE SET NULL,
  workflow_run_id TEXT REFERENCES workflow_runs(id) ON DELETE SET NULL,
  subject_kind TEXT,
  subject_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX orchestrator_events_user_created_idx ON orchestrator_events (user_id, created_at DESC);

-- Public-cache tables. Operator-refreshed, served by /v1/public/*.
-- In D1 there's no PostgREST anon read — all reads go through the Worker
-- which uses the service binding regardless.
CREATE TABLE pub_articles_cache (
  article_id TEXT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  article_type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  author TEXT,
  byline_date TEXT,
  body_md TEXT NOT NULL,
  word_count INTEGER,
  reading_time_minutes INTEGER,
  published_at TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  refreshed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX pub_articles_cache_published_idx ON pub_articles_cache (published_at DESC);

CREATE TABLE pub_theses_cache (
  thesis_id TEXT PRIMARY KEY REFERENCES theses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  seed_summary TEXT,
  coined_phrase TEXT,
  ipcc_likelihood TEXT,
  tier_bluf TEXT NOT NULL,
  tier_80 TEXT NOT NULL,
  tier_800 TEXT NOT NULL,
  tier_full TEXT,
  version_number INTEGER NOT NULL,
  primary_operator TEXT,
  published_at TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  refreshed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE pub_predictions_cache (
  prediction_id TEXT PRIMARY KEY REFERENCES predictions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  statement TEXT NOT NULL,
  confidence_pct INTEGER NOT NULL,
  ipcc_likelihood TEXT,
  resolution_criterion TEXT NOT NULL,
  resolution_horizon TEXT NOT NULL,
  domain TEXT,
  status TEXT NOT NULL,
  resolved_at TEXT,
  resolved_outcome TEXT,
  brier_contribution REAL,
  payload TEXT NOT NULL DEFAULT '{}',
  refreshed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE pub_contradictions_cache (
  contradiction_id TEXT PRIMARY KEY REFERENCES contradictions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  posture TEXT NOT NULL,
  resolution_reasoning TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  refreshed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE pub_entities_cache (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  canonical_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  summary TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  refreshed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE pub_sources_cache (
  source_id TEXT PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  admiralty_grade TEXT,
  bias_profile TEXT,
  published_at TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  refreshed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE pub_claims_cache (
  claim_id TEXT PRIMARY KEY REFERENCES claims(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  claim_text TEXT NOT NULL,
  layer TEXT NOT NULL,
  admiralty_grade TEXT,
  verification_status TEXT NOT NULL,
  ipcc_likelihood TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  refreshed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE pub_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  channels TEXT NOT NULL DEFAULT '["articles"]',
  thesis_id TEXT REFERENCES theses(id) ON DELETE CASCADE,
  confirmed INTEGER NOT NULL DEFAULT 0,
  confirmation_token TEXT,
  unsubscribe_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unsubscribed_at TEXT,
  UNIQUE (email, thesis_id)
);
CREATE INDEX pub_subscriptions_user_idx ON pub_subscriptions (user_id);
