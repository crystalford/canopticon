# Database Schema Fix

It seems your `signals` table is missing the `hash` column, which is crashing the features.

Please run this SQL in your Supabase Dashboard > SQL Editor:

```sql
-- 1. Add the missing hash column
ALTER TABLE signals ADD COLUMN IF NOT EXISTS hash text;

-- 2. Add a unique index for performance and data integrity
CREATE UNIQUE INDEX IF NOT EXISTS idx_signals_hash ON signals(hash);

-- 3. (Optional) If you get errors about "entities" or "topics" missing
ALTER TABLE signals ADD COLUMN IF NOT EXISTS entities text[];
ALTER TABLE signals ADD COLUMN IF NOT EXISTS topics text[];
```

After running this, try "Force Ingest" again to populate the hashes, then "Approve" will work.
