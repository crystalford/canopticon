-- THE WORKSPACE: DRAFTS AND THEIR CONVERSATIONS.
--
-- /admin/write is a chat with Claude beside the page it is writing. A draft
-- is the article as it stands (its front matter as JSON in `meta`, its body
-- as Markdown with <q> quotations) plus the conversation that made it.
--
-- The conversation is stored one message per row, exactly as it was sent to
-- the model, and only ever appended to: a later request must resend history
-- unchanged (the model's thinking is bound to it), and a row per message
-- keeps a long research read under D1's per-row size limit.
--
-- `usage` is a JSON tally of tokens and estimated cost, shown on the page.
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'article',
  meta TEXT NOT NULL DEFAULT '{}',
  body_md TEXT NOT NULL DEFAULT '',
  usage TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS drafts_user_updated ON drafts (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS draft_messages (
  draft_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (draft_id, seq)
);
