-- 0004_entities.sql
-- Entity graph: people, organizations, institutions, events, concepts.
-- pgvector embeddings power semantic blocking in entity resolution and dedup.

create table entities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  entity_type entity_type not null,
  canonical_name text not null,
  aliases text[] not null default array[]::text[],
  description text,

  -- Public-facing slug for /entities/{slug}.
  public_slug text unique,

  -- For people: primary occupation/role; for orgs: jurisdiction; etc.
  primary_attribute text,

  -- Lifecycle dates (entities may sunset, e.g. dissolved orgs).
  active_from date,
  active_to date,

  -- Heat from grade-weighted mention count; refreshed by cascade.
  heat_score numeric(10,4) not null default 0,

  -- Concept-spine pinning (entities pinned by operator to a thesis spine
  -- get cream-ring rendering on the Graph screen).
  pinned_thesis_ids uuid[] not null default array[]::uuid[],

  -- Semantic blocking embedding for ER. Generated on insert/update by app.
  embedding vector(1536),

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entities_user_type_idx on entities (user_id, entity_type);
create index entities_canonical_trgm_idx on entities using gin (canonical_name gin_trgm_ops);
create index entities_public_slug_idx on entities (public_slug) where public_slug is not null;
create index entities_heat_idx on entities (user_id, heat_score desc);

-- Raw entity references captured during claim extraction, before resolution.
create table entity_mentions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  source_id uuid references sources(id) on delete cascade,
  claim_id uuid,                             -- backfilled after claims created in 0005
  surface_text text not null,                -- the literal mention as it appears
  context_snippet text,
  entity_id uuid references entities(id) on delete set null,
  resolution_confidence numeric(4,3),        -- 0.000 to 1.000
  resolved boolean not null default false,
  resolved_at timestamptz,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index entity_mentions_user_resolved_idx on entity_mentions (user_id, resolved, created_at desc);
create index entity_mentions_entity_idx on entity_mentions (entity_id) where entity_id is not null;
create index entity_mentions_source_idx on entity_mentions (source_id);

-- Directed edges between entities.
create table entity_relations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  from_entity_id uuid not null references entities(id) on delete cascade,
  to_entity_id uuid not null references entities(id) on delete cascade,
  relation_type entity_relation_type not null,
  strength numeric(4,3) not null default 0.5,
  active_from date,
  active_to date,
  evidence_source_ids uuid[] not null default array[]::uuid[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_entity_id <> to_entity_id)
);

create index entity_relations_from_idx on entity_relations (from_entity_id);
create index entity_relations_to_idx on entity_relations (to_entity_id);
create index entity_relations_type_idx on entity_relations (relation_type);

-- Stage-by-stage matching decisions during entity resolution.
create table entity_resolution_log (
  id uuid primary key default uuid_generate_v4(),
  mention_id uuid not null references entity_mentions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  stage text not null,                       -- 'blocking', 'rule_match', 'llm_match'
  candidates jsonb not null default '[]'::jsonb,
  decision text,                             -- 'matched', 'no_match', 'uncertain'
  matched_entity_id uuid references entities(id) on delete set null,
  reasoning text,
  created_at timestamptz not null default now()
);

create index entity_resolution_log_mention_idx on entity_resolution_log (mention_id, created_at);

-- Reversible merge audit trail.
create table entity_merge_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  surviving_entity_id uuid not null references entities(id) on delete cascade,
  merged_entity_id uuid not null,            -- not FK; merged row may be deleted
  merged_canonical_name text not null,
  merged_aliases text[] not null default array[]::text[],
  reason text,
  performed_by_user_id uuid references users(id),
  created_at timestamptz not null default now()
);

create index entity_merge_history_surviving_idx on entity_merge_history (surviving_entity_id);

-- Operator queue for ambiguous entity matches.
create table entity_resolution_queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  mention_id uuid not null references entity_mentions(id) on delete cascade,
  candidate_entity_ids uuid[] not null default array[]::uuid[],
  candidate_scores numeric[] not null default array[]::numeric[],
  source_id uuid references sources(id),
  status text not null default 'pending',    -- 'pending', 'confirmed', 'created', 'deferred'
  decided_at timestamptz,
  decision_notes text,
  created_at timestamptz not null default now()
);

create index entity_resolution_queue_user_status_idx on entity_resolution_queue (user_id, status, created_at);
