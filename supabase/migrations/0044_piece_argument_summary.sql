-- 0044_piece_argument_summary.sql — Phase 2 of video-as-source-material
-- ingestion: a faithful, source-side account of what was argued in one
-- piece, distinct from body_md (the raw transcript, kept full for
-- digestion's extraction pass) and distinct from a signed reading (the
-- OPERATOR's own interpretation). This is mechanical representation, not
-- authorship — "here is what they argued," not "here is my take on it."
--
-- Nullable, populated async (graph/lib/argument-summary.ts, cron-driven)
-- after a video-transcript piece's digestion completes. Scoped to
-- video-transcript pieces for now but not schema-restricted to them —
-- no reason a sufficiently long uploaded document couldn't use the same
-- field later.

ALTER TABLE pieces ADD COLUMN argument_summary_md TEXT;
