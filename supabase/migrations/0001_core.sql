-- 0001_core.sql
-- Operator account, cost discipline, sources, ingestion critic.
-- SQLite dialect for Cloudflare D1.
--
-- Conventions:
--  - ids are TEXT (UUID strings generated in app code with crypto.randomUUID())
--  - enum-like fields use TEXT with CHECK constraints
--  - array/jsonb fields use TEXT containing JSON
--  - timestamps are TEXT in ISO-8601 (created_at default = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
--  - boolean fields are INTEGER (0/1)

-- Operator (single row; multi-tenant deferred).
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  monthly_ceiling_cents INTEGER NOT NULL DEFAULT 5000,
  daily_warn_cents INTEGER NOT NULL DEFAULT 200,
  cascade_cron_expr TEXT,
  ingestion_apis_enabled INTEGER NOT NULL DEFAULT 0,
  named_operator TEXT,
  operator_credentials TEXT,
  preferences TEXT NOT NULL DEFAULT '{}'
);

-- Every paid API call lands here.
CREATE TABLE cost_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  cost_cents REAL NOT NULL,
  whitelisted INTEGER NOT NULL DEFAULT 0,
  approval_id TEXT,
  idempotency_key TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX cost_ledger_user_created_idx ON cost_ledger (user_id, created_at DESC);
CREATE UNIQUE INDEX cost_ledger_idem_idx ON cost_ledger (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Per-operation whitelist rules.
CREATE TABLE cost_whitelists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  per_op_max_cents REAL,
  daily_max_cents REAL,
  monthly_max_cents REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, operation_type)
);

-- Operator approval prompts.
CREATE TABLE cost_approvals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  estimated_cost_cents REAL NOT NULL,
  reason TEXT,
  context TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  decided_at TEXT,
  decision_notes TEXT,
  whitelist_after_approve INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX cost_approvals_user_status_idx ON cost_approvals (user_id, status, created_at DESC);

-- Sources.
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('hansard','news','social','video','book','filing','report','operator_note','other')),
  ingestion_state TEXT NOT NULL DEFAULT 'pending_critic' CHECK (ingestion_state IN ('pending_critic','critic_completed','approved','deferred','rejected')),
  title TEXT NOT NULL,
  url TEXT,
  external_id TEXT,
  authors TEXT NOT NULL DEFAULT '[]',
  published_at TEXT,
  content_text TEXT,
  content_uri TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  admiralty_grade TEXT CHECK (admiralty_grade IN ('A','B','C','D','E','F')),
  bias_profile TEXT,
  ingested_via TEXT,
  ingested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  approved_at TEXT,
  approved_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX sources_user_state_idx ON sources (user_id, ingestion_state, created_at DESC);
CREATE INDEX sources_url_idx ON sources (url);

CREATE TABLE ingestion_critic_reports (
  id TEXT PRIMARY KEY,
  source_id TEXT UNIQUE NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_invocation_id TEXT,
  proposed_grade TEXT NOT NULL CHECK (proposed_grade IN ('A','B','C','D','E','F')),
  bias_profile TEXT,
  watch_set_matches TEXT NOT NULL DEFAULT '[]',
  contradiction_flags TEXT NOT NULL DEFAULT '[]',
  paid_op_required INTEGER NOT NULL DEFAULT 0,
  paid_op_estimate_cents REAL,
  reasoning TEXT NOT NULL,
  raw_output TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE ingestion_actions (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approve','defer','reject','edit_grade')),
  notes TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ingestion_actions_source_idx ON ingestion_actions (source_id, created_at DESC);
