-- 0004_intellectual_output.sql
-- Five-whys chains, solution inventories, argument maps, frame genealogies.

CREATE TABLE five_whys_chains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thesis_id TEXT REFERENCES theses(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  reached_root INTEGER NOT NULL DEFAULT 0,
  override_reason TEXT,
  override_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX five_whys_chains_thesis_idx ON five_whys_chains (thesis_id) WHERE thesis_id IS NOT NULL;
CREATE INDEX five_whys_chains_user_idx ON five_whys_chains (user_id, created_at DESC);

CREATE TABLE five_whys_levels (
  id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL REFERENCES five_whys_chains(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('why_1_proximate','why_2_immediate_mechanism','why_3_systemic_pattern','why_4_structural_condition','why_5_root_design_choice')),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  intervention_tier TEXT CHECK (intervention_tier IN ('symptom','mechanism','structural') OR intervention_tier IS NULL),
  supporting_claim_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (chain_id, level)
);
CREATE INDEX five_whys_levels_chain_idx ON five_whys_levels (chain_id);

CREATE TABLE solution_inventories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thesis_id TEXT REFERENCES theses(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  symptom_description TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  public_slug TEXT UNIQUE,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE solution_entries (
  id TEXT PRIMARY KEY,
  inventory_id TEXT NOT NULL REFERENCES solution_inventories(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jurisdiction TEXT NOT NULL,
  proposed_mechanism TEXT NOT NULL,
  intervention_tier TEXT CHECK (intervention_tier IN ('symptom','mechanism','structural') OR intervention_tier IS NULL),
  conditions_required TEXT,
  observed_results TEXT,
  why_worked TEXT,
  why_failed TEXT,
  exportability TEXT,
  source_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX solution_entries_inventory_idx ON solution_entries (inventory_id);

CREATE TABLE argument_maps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thesis_id TEXT REFERENCES theses(id) ON DELETE CASCADE,
  contested_question TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 0,
  public_slug TEXT UNIQUE,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE argument_layers (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL REFERENCES argument_maps(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  layer_number INTEGER NOT NULL CHECK (layer_number BETWEEN 1 AND 6),
  layer_label TEXT NOT NULL,
  parent_layer_id TEXT REFERENCES argument_layers(id) ON DELETE CASCADE,
  position_text TEXT NOT NULL,
  intervention_tier TEXT CHECK (intervention_tier IN ('symptom','mechanism','structural') OR intervention_tier IS NULL),
  supporting_claim_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX argument_layers_map_idx ON argument_layers (map_id, layer_number);

CREATE TABLE frame_genealogies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thesis_id TEXT REFERENCES theses(id) ON DELETE CASCADE,
  frame_phrase TEXT NOT NULL,
  frame_definition TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  public_slug TEXT UNIQUE,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE frame_propagation_events (
  id TEXT PRIMARY KEY,
  genealogy_id TEXT NOT NULL REFERENCES frame_genealogies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_role TEXT NOT NULL CHECK (event_role IN ('first_appearance','introducer','amplifier','funder','material_interest')),
  entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  occurred_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX frame_propagation_events_genealogy_idx ON frame_propagation_events (genealogy_id, occurred_at);
