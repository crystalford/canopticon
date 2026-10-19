-- READ A LONG CONVERSATION IN BATCHES, NOT IN ONE QUERY.
--
-- A research conversation stores every page Claude read twice: inside the
-- conversation (draft_messages) and as a kept source (research_sources), up
-- to 600,000 characters a page. Reading either whole in one query made a
-- long research draft exceed D1's per-query CPU limit ("D1 DB exceeded its
-- CPU time limit and was reset"). Each row's size is now recorded, and a
-- covering index lets the size list be read without touching the text, so
-- the text is fetched a few megabytes at a time.
--
-- No backfill: counting the old rows would itself be the heavy query. A row
-- written before this has chars NULL and is treated as its largest possible
-- size (one part, 500,000 characters).
ALTER TABLE draft_messages ADD COLUMN chars INTEGER;
CREATE INDEX IF NOT EXISTS draft_messages_size ON draft_messages (draft_id, seq, chars);
CREATE INDEX IF NOT EXISTS research_sources_size ON research_sources (draft_id, created_at, id, chars);
