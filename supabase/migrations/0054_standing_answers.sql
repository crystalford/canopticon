-- 0054_standing_answers.sql — a question page says something, or it is a list.
--
-- Questions shipped in 0050 as a merge point: several documents' verified
-- quotes gathered under one question. That is the right spine, but a page
-- carrying only stacked quotes is a well-organised quote list, and a quote
-- list is not worth a URL. Scaled-content enforcement lands on a whole domain
-- rather than a page, so thin pages are not a local cost.
--
-- So a published question now carries a STANDING ANSWER: two or three
-- sentences stating what the corpus establishes, drafted from the verified
-- evidence and nothing else, and approved by a person before the page exists.
-- Frozen into this column rather than generated at render (standing rule 5:
-- AI output is an input artifact, never a function).
ALTER TABLE aeo_questions ADD COLUMN standing_answer TEXT;
ALTER TABLE aeo_questions ADD COLUMN answer_approved_at TEXT;

-- Where the corpus's own sources disagree.
--
-- Kept as a flag rather than a status value on purpose. It is orthogonal to
-- publication — a question is published or not, and separately its sources
-- agree or not — and SQLite cannot widen 0050's status CHECK without
-- rebuilding the table, which is not a risk worth taking for a display state.
--
-- This is also the page nothing else can publish: two claims that contradict
-- each other, both quoted verbatim, both with live receipts, and no pretence
-- that the disagreement is settled. It is what a verification-first record is
-- actually for.
ALTER TABLE aeo_questions ADD COLUMN contested INTEGER NOT NULL DEFAULT 0;
