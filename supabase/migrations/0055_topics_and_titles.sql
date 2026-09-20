-- Topics, and a way out of working titles.
--
-- Two problems the operator hit on the live corpus, both of which made a real
-- publication read as a pile of scraps.
--
-- 1. TITLES. Documents publish under the title their first heading gives them,
--    which for research written in a working session is the session's own
--    name: "PASS 7-MINI — HARDENING DOSSIER", "Phase 6". Accurate to the
--    process, meaningless to a reader, and it is the H1, the citation line and
--    the <title> tag.
--
--    Upload is authorization (standing rule 2), so nothing here may block a
--    publish. The document goes live under its working title immediately and
--    carries CANDIDATES for a better one; the operator accepts with one click.
--    title_approved_at is what says a human chose — without it, a rename never
--    happens on its own. A title is the most-quoted line a document has.
--
--    original_title keeps the working title forever. It is how the operator
--    finds the document again by the name they knew it by, and it means a
--    rename destroys nothing.
--
-- 2. TOPICS. Fifty documents spanning political research, tech stacks and
--    several other worlds, in one undifferentiated list. That is the single
--    largest topical-authority gap on the site: a corpus with no clusters
--    cannot accumulate authority in any of them.
--
--    ONE topic per document, assigned by a model while it is already reading
--    the document at extraction, and FROZEN HERE. Standing rule 5: a model may
--    write into a row at authoring time; nothing calls a model at render time.
--    topic_model records which one, so a bad pass can be found and redone.
--
--    ⚠ A topic does NOT get a URL by existing. /answers and /numbers were both
--    built as derived index pages and both removed for the same reason — thin
--    pages that compete with the documents they index. Topics are for GROUPING
--    an existing index, and a topic earns a page only when it has enough
--    documents to be worth one.

ALTER TABLE pieces ADD COLUMN topic TEXT;
ALTER TABLE pieces ADD COLUMN topic_model TEXT;

-- No title_candidates column on purpose. Candidates are SELECTED from the
-- document's own text by a pure function, so they are computed for the handful
-- of flagged rows at render and cannot go stale against an edited body. A
-- stored column would also need backfilling across the existing corpus to be
-- worth anything. When a composed candidate exists, it will need a row — not
-- before.
ALTER TABLE pieces ADD COLUMN title_approved_at TEXT;
ALTER TABLE pieces ADD COLUMN original_title TEXT;

-- Grouping the research index reads every published piece's topic at once.
CREATE INDEX IF NOT EXISTS pieces_topic_idx ON pieces (user_id, topic);
