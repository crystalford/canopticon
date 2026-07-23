-- 0006_reading_sourced.sql — reading-sourced video essays + public
-- visibility, alongside the existing GDELT-clip pipeline.
--
-- source_kind distinguishes the two content pipelines that now feed the
-- same segments table: 'gdelt' (the existing daily-radar news-clip
-- pipeline, unchanged) and 'reading' (new — drafted from a Canopticon
-- signed reading's verified facts, see editorial/reading-brain.ts).
-- subject_slug links a reading-sourced segment back to the File it came
-- from; NULL for gdelt-sourced segments, which have no such subject.
--
-- published_at is deliberately separate from the existing 'rendered'
-- status. Rendering succeeding is not the same as the operator having
-- watched the finished MP4 and decided it's fit to show publicly — the
-- operator-approves-never-authors rule applies to the finished video,
-- not just the drafted script. A segment only appears on the public
-- /videos section once published_at is set.

ALTER TABLE segments ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'gdelt'
  CHECK (source_kind IN ('gdelt', 'reading'));
ALTER TABLE segments ADD COLUMN subject_slug TEXT;
ALTER TABLE segments ADD COLUMN published_at TEXT;

CREATE INDEX segments_published_idx ON segments (published_at DESC);
CREATE INDEX segments_source_kind_idx ON segments (source_kind, created_at DESC);
