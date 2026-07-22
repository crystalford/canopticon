-- 0039_patterns_primary_node.sql — lets a "worth your eye" finding link
-- back to a real subject page (or trigger real research if none exists
-- yet) instead of being inert text on the homepage.
ALTER TABLE patterns ADD COLUMN primary_node_id TEXT;
