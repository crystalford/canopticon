-- LINEAGE AND READINGS — the record as a tree, and the operator's half of
-- verification (docs/the-record.md §5, §5c).
--
-- A document knows what it grew from: the document whose lead, question,
-- bridge or reading started the research that produced it, and the question
-- itself, verbatim. A research brief published from a run is a child of the
-- document the run was started from. A root upload has neither.
ALTER TABLE pieces ADD COLUMN parent_piece_id TEXT;   -- pieces.id, no FK (0027 precedent)
ALTER TABLE pieces ADD COLUMN origin TEXT;            -- the question/lead that started it
ALTER TABLE research_runs ADD COLUMN parent_piece_id TEXT;
ALTER TABLE research_runs ADD COLUMN origin_kind TEXT; -- contradiction | unsourced-figure | question | bridge | reading | free

-- A READING is a short note the operator writes on a passage. The passage is
-- a quotes row like any receipt (located verbatim by locateVerbatim), so
-- /q/<id> works for it; the note is the operator's own words; nothing here
-- involves a model. A document with at least one reading is "read by the
-- operator" — the one trust signal the machine cannot supply.
CREATE TABLE IF NOT EXISTS readings (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  piece_id   TEXT NOT NULL,
  quote_id   TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  note_md    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS readings_piece_idx ON readings (user_id, piece_id, created_at);
