-- 0003_sources.sql
-- Sources: every ingested document/URL/transcript that feeds the substrate.
-- Critic reports gate registry entry; ingestion_actions audits operator decisions.

create table sources (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  source_type source_type not null,
  ingestion_state ingestion_state not null default 'pending_critic',

  -- Identification.
  title text not null,
  url text,
  external_id text,                          -- e.g. SEDAR+ filing #, OIC #
  authors text[],
  published_at timestamptz,

  -- Body / transcript / metadata blob.
  content_text text,
  content_uri text,                          -- R2 key for binary blobs
  metadata jsonb not null default '{}'::jsonb,

  -- Grading (set after Ingestion Critic; can be operator-edited on approval).
  admiralty_grade admiralty_grade,
  bias_profile text,

  -- Lifecycle.
  ingested_via text,                         -- 'webhook:youtube', 'cron:hansard', 'operator_upload'
  ingested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by_user_id uuid references users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sources_user_state_idx on sources (user_id, ingestion_state, created_at desc);
create index sources_url_idx on sources (url);
create index sources_external_idx on sources (source_type, external_id) where external_id is not null;
create index sources_grade_idx on sources (admiralty_grade) where admiralty_grade is not null;

-- AI assessment of each source written by the Ingestion Critic role.
-- One report per source.
create table ingestion_critic_reports (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid unique not null references sources(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role_invocation_id uuid,                   -- backfilled after role_invocations created in 0013

  proposed_grade admiralty_grade not null,
  bias_profile text,
  watch_set_matches text[] not null default array[]::text[],
  contradiction_flags text[] not null default array[]::text[],
  paid_op_required boolean not null default false,
  paid_op_estimate_cents numeric(10,4),
  reasoning text not null,
  raw_output jsonb,
  created_at timestamptz not null default now()
);

create index ingestion_critic_reports_user_idx on ingestion_critic_reports (user_id, created_at desc);

-- Audit log of operator decisions on sources.
create table ingestion_actions (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid not null references sources(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  action text not null,                      -- 'approve', 'defer', 'reject', 'edit_grade'
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ingestion_actions_source_idx on ingestion_actions (source_id, created_at desc);
