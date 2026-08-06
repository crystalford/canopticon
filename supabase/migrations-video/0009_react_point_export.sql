-- 0009_react_point_export.sql — per-point standalone social clip export
-- (Phase 8 of the reaction-video tool). Separate from clip_r2_key
-- (0008's unused pre-cut column) and from react_projects.stitched_r2_key
-- (the full multi-point video) — this is one short clip per point,
-- rendered on demand from that point's own source+reaction beat pair.

ALTER TABLE react_points ADD COLUMN export_r2_key TEXT;
ALTER TABLE react_points ADD COLUMN export_status TEXT
  CHECK (export_status IN ('rendering', 'ready', 'failed') OR export_status IS NULL);
ALTER TABLE react_points ADD COLUMN export_error TEXT;
