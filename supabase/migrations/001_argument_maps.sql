-- Migration 001: Argument Maps + article_type column on articles

CREATE TABLE argument_maps (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  article_type text NOT NULL DEFAULT 'analysis',
  argument_tree jsonb NOT NULL DEFAULT '{}',
  dominant_frames jsonb NOT NULL DEFAULT '[]',
  solution_inventory jsonb NOT NULL DEFAULT '{}',
  banked_predictions jsonb NOT NULL DEFAULT '[]',
  five_whys jsonb NOT NULL DEFAULT '[]',
  entity_ids uuid[] NOT NULL DEFAULT '{}',
  claim_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE argument_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to argument_maps"
  ON argument_maps FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Supporters can read published argument_maps"
  ON argument_maps FOR SELECT
  USING (status = 'published' AND is_supporter());

CREATE TRIGGER update_argument_maps_updated_at
  BEFORE UPDATE ON argument_maps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_type text NOT NULL DEFAULT 'analysis';
