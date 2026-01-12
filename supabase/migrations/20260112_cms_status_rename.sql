-- CMS Reorganization: Status Rename Migration
-- Changes: approved → draft, archived → deleted

-- Update existing records
UPDATE signals SET status = 'draft' WHERE status = 'approved';
UPDATE signals SET status = 'deleted' WHERE status = 'archived';

-- Note: We keep the column as TEXT type for flexibility
-- Valid statuses after this migration:
-- - 'pending' (in Review queue)
-- - 'draft' (being worked on)
-- - 'published' (live on site)
-- - 'deleted' (soft deleted)
-- - 'flagged' (for video production)
-- - 'processing' (during analysis)
