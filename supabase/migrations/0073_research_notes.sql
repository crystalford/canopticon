-- THE RESEARCH NOTES BANK.
--
-- While researching, the model notes each passage it will use: the page's
-- address, the exact words (checked word for word against the kept page when
-- the note is made), the claim they support and the report section they are
-- for. The report is written section by section from these notes, and its
-- Sources list is built from them, so a source's number is assigned in code
-- and stays the same everywhere it is cited. Notes are sources' words, never
-- published by themselves.
CREATE TABLE IF NOT EXISTS research_notes (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  n INTEGER NOT NULL,
  url TEXT NOT NULL,
  quote TEXT NOT NULL,
  claim TEXT NOT NULL,
  section INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS research_notes_draft ON research_notes (draft_id, n);
