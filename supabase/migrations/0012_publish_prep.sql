-- Forensic publish-prep support.
--
-- Adds a JSON metadata column to `posts` to hold forensic-mode fields
-- (coined_phrase, teachable_diagram_url, methodology_appendix,
-- intervention_level). Adds post_id to `predictions` so banked
-- predictions can be linked to the post that's about to publish.

ALTER TABLE posts ADD COLUMN forensic_metadata TEXT NOT NULL DEFAULT '{}';
ALTER TABLE predictions ADD COLUMN post_id TEXT REFERENCES posts(id) ON DELETE SET NULL;
CREATE INDEX idx_predictions_post ON predictions(post_id);
