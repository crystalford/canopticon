-- 0008_chat_and_providers.sql
--
-- Adds provider routing to role_definitions, plus the chat + uploads
-- tables that back the new operator-facing Chat / Intake screen.

-- Provider routing on role_definitions.
ALTER TABLE role_definitions ADD COLUMN provider TEXT NOT NULL DEFAULT 'workers_ai'
  CHECK (provider IN ('workers_ai','anthropic'));
ALTER TABLE role_definitions ADD COLUMN allow_anthropic_override INTEGER NOT NULL DEFAULT 0;

-- Chat conversations: one operator, many threads.
CREATE TABLE chat_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  last_message_at TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  total_cost_cents REAL NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX chat_conversations_user_idx
  ON chat_conversations (user_id, archived, last_message_at DESC);

-- Chat messages: user / assistant / tool turns. content_json is an array
-- of LlmContent blocks (text, tool_use, tool_result, image, document).
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('system','user','assistant','tool')),
  content_json TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_cents REAL,
  cost_ledger_id TEXT REFERENCES cost_ledger(id) ON DELETE SET NULL,
  stop_reason TEXT,
  tool_name TEXT,
  tool_use_id TEXT,
  tool_status TEXT CHECK (tool_status IN ('pending','success','error') OR tool_status IS NULL),
  side_effects TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX chat_messages_seq_idx ON chat_messages (conversation_id, seq);
CREATE INDEX chat_messages_user_idx ON chat_messages (user_id, created_at DESC);

-- Uploaded files: R2-backed, optionally linked to a conversation and to
-- a created source row.
CREATE TABLE uploaded_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES chat_conversations(id) ON DELETE SET NULL,
  r2_key TEXT UNIQUE NOT NULL,
  original_filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT,
  classification TEXT CHECK (classification IN ('pdf','image','text','markdown','html','url','other') OR classification IS NULL),
  extraction_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN ('pending','extracting','extracted','failed','skipped')),
  extracted_text TEXT,
  extracted_summary TEXT,
  created_source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX uploaded_files_user_idx ON uploaded_files (user_id, created_at DESC);
CREATE INDEX uploaded_files_conv_idx ON uploaded_files (conversation_id);

-- User-level provider preferences (one row per user).
CREATE TABLE user_ai_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  anthropic_enabled INTEGER NOT NULL DEFAULT 0,
  default_chat_model TEXT NOT NULL DEFAULT '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
