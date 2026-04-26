-- 0008_intellectual_output.sql
-- The structural-analysis substrate: Five Whys, solution inventories,
-- argument maps, frame genealogies. These are first-class outputs, not
-- adornments; the publish-prep root-striking gate reads from five_whys_chains.

-- Five Whys protocol: forces a thesis to drill from proximate cause
-- (Why #1) to root design choice (Why #5). Publication blocked until
-- reached_root = true on intelligence_thesis articles.
create table five_whys_chains (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  thesis_id uuid references theses(id) on delete cascade,
  question text not null,                    -- the surface problem being decomposed
  reached_root boolean not null default false,
  override_reason text,                      -- if operator publishes without root
  override_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index five_whys_chains_thesis_idx on five_whys_chains (thesis_id) where thesis_id is not null;
create index five_whys_chains_user_idx on five_whys_chains (user_id, created_at desc);

create table five_whys_levels (
  id uuid primary key default uuid_generate_v4(),
  chain_id uuid not null references five_whys_chains(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  level five_whys_level not null,
  question text not null,
  answer text not null,
  intervention_tier intervention_tier,
  supporting_claim_ids uuid[] not null default array[]::uuid[],
  created_at timestamptz not null default now(),
  unique (chain_id, level)
);

create index five_whys_levels_chain_idx on five_whys_levels (chain_id);

-- Comparative policy-intervention maps across jurisdictions.
create table solution_inventories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  thesis_id uuid references theses(id) on delete cascade,
  topic text not null,
  symptom_description text,
  is_public boolean not null default false,
  public_slug text unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index solution_inventories_thesis_idx on solution_inventories (thesis_id) where thesis_id is not null;
create index solution_inventories_public_slug_idx on solution_inventories (public_slug) where public_slug is not null;

create table solution_entries (
  id uuid primary key default uuid_generate_v4(),
  inventory_id uuid not null references solution_inventories(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  jurisdiction text not null,
  proposed_mechanism text not null,
  intervention_tier intervention_tier,
  conditions_required text,
  observed_results text,
  why_worked text,
  why_failed text,
  exportability text,                        -- assessment of whether transferable
  source_ids uuid[] not null default array[]::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index solution_entries_inventory_idx on solution_entries (inventory_id);

-- Six-layer argument tree (surface / evidence / dependencies / empirical
-- disputes / values disputes / meta-frame).
create table argument_maps (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  thesis_id uuid references theses(id) on delete cascade,
  contested_question text not null,
  is_public boolean not null default false,
  public_slug text unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index argument_maps_thesis_idx on argument_maps (thesis_id) where thesis_id is not null;
create index argument_maps_public_slug_idx on argument_maps (public_slug) where public_slug is not null;

create table argument_layers (
  id uuid primary key default uuid_generate_v4(),
  map_id uuid not null references argument_maps(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  layer_number integer not null check (layer_number between 1 and 6),
  layer_label text not null,                 -- 'surface', 'evidence', 'dependencies', 'empirical_disputes', 'values_disputes', 'meta_frame'
  parent_layer_id uuid references argument_layers(id) on delete cascade,
  position_text text not null,
  intervention_tier intervention_tier,
  supporting_claim_ids uuid[] not null default array[]::uuid[],
  created_at timestamptz not null default now()
);

create index argument_layers_map_idx on argument_layers (map_id, layer_number);
create index argument_layers_parent_idx on argument_layers (parent_layer_id) where parent_layer_id is not null;

-- Frame propagation tracking: first appearance, introducers, amplifiers,
-- funders, material interest players.
create table frame_genealogies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  thesis_id uuid references theses(id) on delete cascade,
  frame_phrase text not null,
  frame_definition text,
  is_public boolean not null default false,
  public_slug text unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index frame_genealogies_thesis_idx on frame_genealogies (thesis_id) where thesis_id is not null;
create index frame_genealogies_public_slug_idx on frame_genealogies (public_slug) where public_slug is not null;

create table frame_propagation_events (
  id uuid primary key default uuid_generate_v4(),
  genealogy_id uuid not null references frame_genealogies(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  event_role text not null,                  -- 'first_appearance', 'introducer', 'amplifier', 'funder', 'material_interest'
  entity_id uuid references entities(id) on delete set null,
  source_id uuid references sources(id) on delete set null,
  occurred_at date,
  notes text,
  created_at timestamptz not null default now()
);

create index frame_propagation_events_genealogy_idx on frame_propagation_events (genealogy_id, occurred_at);
