-- A brief written in sections, one section per press.
--
-- The final synthesis was one writer call: 5,000 chars per source, twelve
-- sources, 4,000 output tokens. "Deeper than that means more calls, not a
-- bigger one" (CLAUDE.md, Research on demand). With Claude through the
-- gateway there is room to read every source whole, so the run now has a
-- second way to finish, decided per run and stored in `mode`:
--
--   single     — the existing one-call synthesis, unchanged (Workers AI's
--                25s window cannot write a thousand-word section reliably)
--   sectioned  — outline_pending → section_pending ×N → assemble_pending:
--                one model call per press, one section per call, every quote
--                located verbatim in its source or killed and counted
--
-- `outline` is the plan the writer proposed and, like followup_queries, is
-- never rewritten once written; `sections_done` is what has landed so far,
-- in order, each with its kept and killed quote counts. The sum of the killed
-- counts goes into the finished piece's metadata as `quotes_killed` so the
-- review page can show it in red.
ALTER TABLE research_runs ADD COLUMN outline TEXT;        -- JSON [{heading, brief_of_section, source_ids[]}]
ALTER TABLE research_runs ADD COLUMN sections_done TEXT;  -- JSON [{heading, body_md, quotes_ok, quotes_killed}]
ALTER TABLE research_runs ADD COLUMN mode TEXT;           -- 'single' | 'sectioned'
