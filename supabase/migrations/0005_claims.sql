-- 0005_claims.sql
-- Claims: atomic factual assertions with full Toulmin structure.
-- Versioned (append-only) so the audit trail is preserved across edits.

create table claims (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  layer claim_layer not null,
  current_version_id uuid,                   -- FK added after claim_versions exists
  admiralty_grade admiralty_grade,
  verification_status verification_status not null default 'unverified',
  ipcc_likelihood ipcc_likelihood,
  intervention_tier intervention_tier,

  -- Public-facing slug.
  public_slug text unique,

  -- Lifecycle.
  retired_at timestamptz,
  retired_reason text,

  -- For dedup blocking.
  embedding vector(1536),

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index claims_user_idx on claims (user_id, created_at desc);
create index claims_layer_idx on claims (layer);
create index claims_grade_idx on claims (admiralty_grade);
create index claims_verification_idx on claims (verification_status);
create index claims_public_slug_idx on claims (public_slug) where public_slug is not null;

-- Append-only versions. Toulmin structure lives here; claims row carries
-- only the current pointer + index-fast columns.
create table claim_versions (
  id uuid primary key default uuid_generate_v4(),
  claim_id uuid not null references claims(id) on delete cascade,
  version_number integer not null,

  -- Toulmin.
  data text not null,                        -- the evidence
  claim_text text not null,                  -- the assertion
  warrant text,                              -- the rule connecting data to claim
  backing text,                              -- the support for the warrant
  qualifier text,                            -- the calibrated language
  rebuttal text,                             -- the conditions under which the claim fails

  change_summary text,
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  unique (claim_id, version_number)
);

create index claim_versions_claim_idx on claim_versions (claim_id, version_number desc);

-- Now safe to add the current_version FK on claims.
alter table claims
  add constraint claims_current_version_fk foreign key (current_version_id)
  references claim_versions(id) on delete set null;

-- Many-to-many: which entities are mentioned in which claims.
create table claim_entities (
  claim_id uuid not null references claims(id) on delete cascade,
  entity_id uuid not null references entities(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role_in_claim text,                        -- 'subject', 'object', 'mentioned'
  created_at timestamptz not null default now(),
  primary key (claim_id, entity_id)
);

create index claim_entities_entity_idx on claim_entities (entity_id);

-- Many-to-many: which sources support/contradict which claims.
-- Provenance discipline: every claim must have at least one row here
-- (enforced by trigger in 0017).
create table claim_sources (
  id uuid primary key default uuid_generate_v4(),
  claim_id uuid not null references claims(id) on delete cascade,
  source_id uuid not null references sources(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  supports boolean not null default true,    -- false means the source contradicts
  citation_excerpt text,
  citation_locator text,                     -- page #, timestamp, paragraph
  citation_confidence numeric(4,3),
  created_at timestamptz not null default now(),
  unique (claim_id, source_id, supports)
);

create index claim_sources_claim_idx on claim_sources (claim_id);
create index claim_sources_source_idx on claim_sources (source_id);

-- Directed edges between claims.
create table claim_relations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  from_claim_id uuid not null references claims(id) on delete cascade,
  to_claim_id uuid not null references claims(id) on delete cascade,
  relation_type claim_relation_type not null,
  strength numeric(4,3) not null default 0.5,
  notes text,
  created_at timestamptz not null default now(),
  check (from_claim_id <> to_claim_id)
);

create index claim_relations_from_idx on claim_relations (from_claim_id);
create index claim_relations_to_idx on claim_relations (to_claim_id);

-- Operator queue for newly-extracted claims that might be duplicates,
-- refinements, or contradictions of existing claims.
create table claim_deduplication_queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  new_claim_id uuid not null references claims(id) on delete cascade,
  candidate_claim_ids uuid[] not null default array[]::uuid[],
  candidate_scores numeric[] not null default array[]::numeric[],
  proposed_relation text,                    -- 'duplicate', 'refinement', 'contradiction', 'distinct'
  status text not null default 'pending',    -- 'pending', 'resolved', 'deferred'
  decided_at timestamptz,
  decision_notes text,
  created_at timestamptz not null default now()
);

create index claim_dedup_queue_user_status_idx on claim_deduplication_queue (user_id, status, created_at);

-- Backfill the FK on entity_mentions.claim_id now that claims exists.
alter table entity_mentions
  add constraint entity_mentions_claim_fk foreign key (claim_id)
  references claims(id) on delete set null;
