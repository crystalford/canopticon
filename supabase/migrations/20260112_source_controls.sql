-- Add Source Control Columns
-- Enables per-source limits, priority ordering, and custom frequencies

ALTER TABLE sources
ADD COLUMN IF NOT EXISTS max_articles_per_ingest INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 99,
ADD COLUMN IF NOT EXISTS ingestion_frequency INTERVAL DEFAULT '6 hours';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sources_priority ON sources(priority ASC)
WHERE active = true;

COMMENT ON COLUMN sources.max_articles_per_ingest IS 'Maximum articles to fetch per ingestion (default 10)';
COMMENT ON COLUMN sources.priority IS 'Lower numbers = higher priority (1 = highest)';
COMMENT ON COLUMN sources.ingestion_frequency IS 'How often to poll this source';
