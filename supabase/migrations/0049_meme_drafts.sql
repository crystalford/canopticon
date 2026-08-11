-- 0049_meme_drafts.sql — juxtaposition meme prototype (2026-08-11).
--
-- Not a new fact-finding capability — self_contradictions.ts already finds
-- and independently verifies contradiction pairs. This is a rendering
-- experiment on top of already-judge-verified rows: compress a verified
-- pair into the "bare A/B, no connecting clause, matched register" copy
-- format, translate that into a visual prompt, generate one image.
-- Operator-triggered only (admin route), nothing here auto-publishes.

CREATE TABLE meme_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contradiction_id TEXT NOT NULL REFERENCES self_contradictions(id) ON DELETE CASCADE,
  quote_line TEXT NOT NULL,
  attribution TEXT,
  statement_line TEXT NOT NULL,
  copy_model TEXT,
  image_prompt TEXT,
  image_model TEXT,
  image_r2_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX meme_drafts_user_idx ON meme_drafts (user_id, created_at DESC);
CREATE INDEX meme_drafts_contradiction_idx ON meme_drafts (contradiction_id);
