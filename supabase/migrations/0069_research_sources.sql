-- THE WORKSPACE'S RESEARCH: EVERY PAGE CLAUDE READ, KEPT.
--
-- A research draft (drafts.kind = 'research') searches the web and reads
-- pages with Anthropic's web tools. Each page it reads is kept here as text
-- (a PDF converted by Cloudflare's document converter), so every quotation in
-- the report can be checked word for word against what was actually read, and
-- the report's provenance outlives the conversation. These are sources to
-- quote from, never content: nothing here is published (see CLAUDE.md on the
-- record-expand purge).
CREATE TABLE IF NOT EXISTS research_sources (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  retrieved_at TEXT,
  kind TEXT NOT NULL DEFAULT 'text',
  text TEXT NOT NULL,
  chars INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS research_sources_draft ON research_sources (draft_id, created_at);
