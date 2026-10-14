-- THE WORKSPACE: ONE TURN AT A TIME, AND MESSAGES OF ANY SIZE.
--
-- `drafts.turn_started_at` is a lock: a turn claims it with a conditional
-- UPDATE and clears it when it ends, so two tabs (or a reload mid-turn)
-- cannot interleave their messages and break the conversation's tool-call
-- pairing for good. A claim older than twenty minutes is treated as stale.
--
-- `draft_messages.part` lets one message span several rows: a turn that reads
-- several long documents at once can exceed D1's per-row size limit. Rows
-- with part > 0 continue the row before them.
ALTER TABLE drafts ADD COLUMN turn_started_at TEXT;
ALTER TABLE draft_messages ADD COLUMN part INTEGER NOT NULL DEFAULT 0;
