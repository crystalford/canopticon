-- 0038_beat_research.sql — tracks what a beat's last expand banked, and
-- whether it's been synthesized into a research report yet (graph/lib/
-- deep-research.ts). Free-ish deep research: reuses the existing
-- expandRecord (Brave Search + fetch, already proven) to bank raw
-- sources, then a separate bounded step writes ONE synthesized report
-- from them via Workers AI — no new vendor, no new cron trigger.
ALTER TABLE coverage_beats ADD COLUMN last_banked_piece_ids TEXT;
ALTER TABLE coverage_beats ADD COLUMN last_synthesized_at TEXT;
