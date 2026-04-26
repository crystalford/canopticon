-- 0006_theses.sql
-- Theses: integrated analytical positions with Cynefin domain, watch-set,
-- coined phrase, and tiered output (BLUF / 80 / 800 / Full).

create table theses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  seed_summary text,
  cynefin_domain cynefin_domain,
  current_version_id uuid,                   -- FK added after thesis_versions exists

  -- Coined-phrase requirement (undismissability gate).
  coined_phrase text,
  coined_phrase_definition text,

  -- IPCC qualifier on the integrated thesis.
  ipcc_likelihood ipcc_likelihood,

  -- Publication state.
  is_public boolean not null default false,
  public_slug text unique,
  published_at timestamptz,
  primary_operator text,                     -- named accountability

  -- Falsifiability discipline.
  falsifying_observation text,
  is_falsifiable boolean not null default false,

  -- Public graph artifact (undismissability gate).
  public_graph_artifact_uri text,
  teachable_diagram_uri text,

  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index theses_user_idx on theses (user_id, created_at desc);
create index theses_public_slug_idx on theses (public_slug) where public_slug is not null;
create index theses_public_idx on theses (user_id, is_public, published_at desc) where is_public;

-- Append-only versions with tiered outputs.
create table thesis_versions (
  id uuid primary key default uuid_generate_v4(),
  thesis_id uuid not null references theses(id) on delete cascade,
  version_number integer not null,

  tier_bluf text not null,                   -- one-line summary
  tier_80 text not null,                     -- 80 words
  tier_800 text not null,                    -- 800 words
  tier_full text,                            -- full essay (incl. methodology appendix)

  ipcc_likelihood ipcc_likelihood,
  grade_weighted_ratio numeric(5,4),

  change_summary text,
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  unique (thesis_id, version_number)
);

create index thesis_versions_thesis_idx on thesis_versions (thesis_id, version_number desc);

alter table theses
  add constraint theses_current_version_fk foreign key (current_version_id)
  references thesis_versions(id) on delete set null;

-- Which claims are integrated into which thesis versions.
create table thesis_claims (
  thesis_version_id uuid not null references thesis_versions(id) on delete cascade,
  claim_id uuid not null references claims(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  is_linchpin boolean not null default false,
  weight numeric(4,3) not null default 0.5,
  created_at timestamptz not null default now(),
  primary key (thesis_version_id, claim_id)
);

create index thesis_claims_claim_idx on thesis_claims (claim_id);
create index thesis_claims_linchpin_idx on thesis_claims (thesis_version_id) where is_linchpin;

-- Entity and exclusion lists that route incoming claims to thesis inboxes.
create table thesis_watch_sets (
  id uuid primary key default uuid_generate_v4(),
  thesis_id uuid not null references theses(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  entity_id uuid references entities(id) on delete cascade,
  excluded boolean not null default false,
  pinned_by_operator boolean not null default true,
  created_at timestamptz not null default now()
);

create index thesis_watch_sets_thesis_idx on thesis_watch_sets (thesis_id);
create index thesis_watch_sets_entity_idx on thesis_watch_sets (entity_id);

-- Core concepts that give a thesis its shape (used for relevance routing).
create table thesis_concept_spine (
  id uuid primary key default uuid_generate_v4(),
  thesis_id uuid not null references theses(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  concept text not null,
  weight numeric(4,3) not null default 0.5,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index thesis_concept_spine_thesis_idx on thesis_concept_spine (thesis_id);

-- Incoming claims waiting for operator review against a thesis.
create table thesis_inbox (
  id uuid primary key default uuid_generate_v4(),
  thesis_id uuid not null references theses(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  claim_id uuid not null references claims(id) on delete cascade,
  routing_reason text,                       -- 'watch_set_match', 'concept_spine_match'
  status text not null default 'pending',    -- 'pending', 'integrated', 'rejected', 'deferred'
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (thesis_id, claim_id)
);

create index thesis_inbox_thesis_status_idx on thesis_inbox (thesis_id, status, created_at);

-- Coined-phrase originality check: track first uses across the substrate.
create table coined_phrase_first_uses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  phrase text not null,
  thesis_id uuid references theses(id) on delete set null,
  external_first_use text,                   -- URL or citation if phrase pre-exists
  external_first_use_date date,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, phrase)
);
