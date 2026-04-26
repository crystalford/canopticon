-- 0010_productions.sql
-- Production engine: scripts, beats (recording units), publishes, perf metrics.
-- The Studio screen is built around the productions state machine.

create table productions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,

  -- What's being produced.
  format text not null,                      -- 'short', 'long_form', 'thread', 'newsletter', 'article'
  title text not null,
  description text,
  state production_state not null default 'ready',

  -- Source material.
  thesis_id uuid references theses(id) on delete set null,
  article_id uuid references articles(id) on delete set null,

  -- Estimated runtime / word count.
  estimated_runtime_seconds integer,
  estimated_word_count integer,

  -- Pipeline progress (5 stages: script, coherence, record, edit, publish).
  pipeline_stage text not null default 'script',
  pipeline_progress numeric(4,3) not null default 0,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index productions_user_state_idx on productions (user_id, state, created_at desc);
create index productions_thesis_idx on productions (thesis_id) where thesis_id is not null;

-- Backfill the FK on articles.production_id now that productions exists.
alter table articles
  add constraint articles_production_fk foreign key (production_id)
  references productions(id) on delete set null;

create table scripts (
  id uuid primary key default uuid_generate_v4(),
  production_id uuid not null references productions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  version_number integer not null default 1,
  full_text text not null,
  beat_count integer not null default 0,
  generated_by text,                         -- 'operator', 'tier_projector', 'argument_mapper'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_id, version_number)
);

create index scripts_production_idx on scripts (production_id, version_number desc);

-- Atomic recording units (10–30 sec each). MediaRecorder uploads to R2;
-- recording_uri is the R2 key.
create table beats (
  id uuid primary key default uuid_generate_v4(),
  script_id uuid not null references scripts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  beat_number integer not null,
  cue_label text,
  beat_text text not null,
  estimated_seconds integer,
  word_count integer,
  citation_count integer not null default 0,
  state text not null default 'pending',     -- 'pending', 'good', 'skipped', 'rerecord'
  recording_uri text,                        -- R2 key
  recorded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (script_id, beat_number)
);

create index beats_script_idx on beats (script_id, beat_number);

-- Scheduled / completed publishes per platform.
create table production_publishes (
  id uuid primary key default uuid_generate_v4(),
  production_id uuid not null references productions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  platform text not null,                    -- 'x', 'mastodon', 'bluesky', 'youtube', 'substack', 'tiktok', 'instagram', 'rss', 'email'
  scheduled_at timestamptz,
  published_at timestamptz,
  external_url text,
  external_id text,
  status text not null default 'scheduled',  -- 'scheduled', 'published', 'failed', 'cancelled'
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index production_publishes_production_idx on production_publishes (production_id);
create index production_publishes_user_status_idx on production_publishes (user_id, status, scheduled_at);

-- Performance metrics (views, impressions, saves, etc.).
create table production_perf (
  id uuid primary key default uuid_generate_v4(),
  publish_id uuid not null references production_publishes(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  observed_at timestamptz not null,
  impressions integer,
  views integer,
  saves integer,
  shares integer,
  comments integer,
  subscriber_gain integer,
  performance_tier text,                     -- 'A', 'B', 'C', 'D'
  notes text,
  created_at timestamptz not null default now()
);

create index production_perf_publish_idx on production_perf (publish_id, observed_at desc);
