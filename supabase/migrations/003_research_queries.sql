CREATE TABLE research_queries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_text text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  -- category values: daily_sweep | entity_monitor | deep_dive | relationship_probe
  entity_id uuid REFERENCES entities(id) ON DELETE SET NULL,
  -- if set, this query monitors a specific entity
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_result_summary text,
  run_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE research_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to research_queries"
  ON research_queries FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Seed: starter queries for Canadian political intelligence
INSERT INTO research_queries (query_text, category) VALUES
  ('What are the most significant Canadian political power moves or policy decisions this week?', 'daily_sweep'),
  ('What corporations or lobbying groups have been most active in influencing the Canadian federal government recently?', 'daily_sweep'),
  ('What are the key funding relationships and financial connections between Canadian political parties and private interests?', 'deep_dive'),
  ('Who are the key figures shaping Canadian economic policy and what are their institutional connections?', 'deep_dive');
