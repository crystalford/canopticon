-- THE WORKSPACE, PART 3: FROZEN INSTRUCTIONS, AND WHAT CLAUDE PROPOSES.
--
-- `drafts.frame` holds the system prompt and tool list a draft's conversation
-- started with, as JSON, and every later turn sends exactly that. The model's
-- reasoning is bound to the conversation it was produced in: a system prompt
-- or tool list that changes mid-conversation (a new topic, a new tool after a
-- deploy) would otherwise invalidate it.
--
-- `record_entries` holds what Claude proposes for the record from the
-- workspace — a concept, an open problem, a key figure — each grounded in a
-- passage checked word for word. Nothing is public until the author adds it
-- (status 'added'), approving or rewriting Claude's paragraph
-- (ESSAY-CONTRACT §1b–1c: a person writes the paragraph). Dismissed entries
-- stay, marked.
ALTER TABLE drafts ADD COLUMN frame TEXT;

CREATE TABLE IF NOT EXISTS record_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  draft_id TEXT,
  tool_use_id TEXT,
  kind TEXT NOT NULL,
  slug TEXT,
  data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS record_entries_user_status ON record_entries (user_id, status);
CREATE INDEX IF NOT EXISTS record_entries_draft ON record_entries (draft_id);
