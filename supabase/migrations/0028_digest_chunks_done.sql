-- 0028_digest_chunks_done.sql — resumable per-chunk extraction.
--
-- Typed extraction of a real document generates thousands of output tokens,
-- which can exceed a single Worker invocation's time budget. Processing the
-- whole document in one runDigestJob call meant: if the Worker was killed (or
-- a chunk hit the model timeout) partway, the job restarted from scratch and
-- re-did the purge — never making forward progress on a slow document.
--
-- chunks_done lets runDigestJob checkpoint after each chunk and resume at the
-- next one on the following tick. The purge runs only on chunk 0; embed +
-- chain-detection run only after the last chunk. A document now finishes over
-- as many cron ticks as it needs, with no lost work.
--
-- chunk_count is stored for display (Library shows "chunk 2 of 4").

ALTER TABLE digest_jobs ADD COLUMN chunks_done INTEGER NOT NULL DEFAULT 0;
ALTER TABLE digest_jobs ADD COLUMN chunk_count INTEGER NOT NULL DEFAULT 0;
