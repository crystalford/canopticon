-- Migration 004: Vlog processing pipeline
-- Adds transcript storage, processing status, and R2 asset tracking to vlogs

ALTER TABLE vlogs
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'none',
  -- none | transcribing | extracting | done | error
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS r2_key text,
  -- R2 object key for the uploaded video file
  ADD COLUMN IF NOT EXISTS duration_seconds int,
  ADD COLUMN IF NOT EXISTS intake_ids uuid[] NOT NULL DEFAULT '{}';
  -- intake queue items created from this vlog
