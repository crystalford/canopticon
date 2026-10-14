-- ARTICLES PUBLISHED FROM THE WORKSPACE, ONE ROW PER VERSION.
--
-- Publish in /admin/write copies the draft — front matter and body, exactly
-- as checked — into a new version here; the site shows the latest version of
-- each article whose draft is published. Nothing is overwritten
-- (ESSAY-CONTRACT §6e): an update is a new row, and every earlier version
-- stays. Taking an article down sets its draft back to 'draft'; the versions
-- and the address (drafts.slug) are kept.
CREATE TABLE IF NOT EXISTS article_versions (
  slug TEXT NOT NULL,
  version INTEGER NOT NULL,
  draft_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  meta TEXT NOT NULL,
  body_md TEXT NOT NULL,
  published_at TEXT NOT NULL,
  PRIMARY KEY (slug, version)
);
CREATE INDEX IF NOT EXISTS article_versions_draft ON article_versions (draft_id, version DESC);

ALTER TABLE drafts ADD COLUMN slug TEXT;
