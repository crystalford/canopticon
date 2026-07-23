-- home.ts's "sources" subquery (and any other lower(label) lookup) compares
-- lower(label) = lower(n.label) for case-insensitive matching. nodes_label_idx
-- (0026) only covers the raw `label` column, so that comparison can't use it
-- and falls back to a full table scan per correlated call — measured live as
-- the dominant cost in a homepage query that runs it once per subject row.
CREATE INDEX IF NOT EXISTS nodes_label_lower_idx ON nodes (lower(label));
