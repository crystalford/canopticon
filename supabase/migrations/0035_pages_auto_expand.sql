-- 0035_pages_auto_expand.sql — tracks when a subject was last swept by the
-- autonomous expand cron (graph/lib/autonomous-expand.ts), so the sweep
-- rotates through thin subjects instead of hammering the same one every
-- tick and can respect a cooldown between attempts.
ALTER TABLE pages ADD COLUMN auto_expand_at TEXT;
CREATE INDEX pages_auto_expand_idx ON pages (user_id, auto_expand_at);
