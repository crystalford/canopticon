-- 0013_role_runtime.sql
-- Role registry and invocation log; cascade & workflow orchestration state.

-- Role registry: one row per (user_id, role_name) pair.
-- prompt_template is overwritten by `pnpm sync-skills` from SKILL.md files.
create table role_definitions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  name role_name not null,
  version integer not null default 1,
  model text not null default 'claude-opus-4-7',
  features jsonb not null default '{}'::jsonb,
  prompt_template text not null,
  schema_json jsonb,
  skill_md_hash text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index role_definitions_user_idx on role_definitions (user_id);

-- Every Anthropic call lands here. Forms the audit trail for cost +
-- output reproducibility.
create table role_invocations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  role_name role_name not null,
  role_definition_id uuid references role_definitions(id) on delete set null,
  cascade_run_id uuid,                       -- FK added later in this migration
  workflow_run_id uuid,                      -- FK added later in this migration
  input_snapshot jsonb,
  output_payload jsonb,
  cost_cents numeric(10,4),
  cost_ledger_id uuid references cost_ledger(id) on delete set null,
  status text not null default 'pending',    -- 'pending', 'completed', 'failed'
  error_message text,
  duration_ms integer,
  idempotency_key text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index role_invocations_user_role_idx on role_invocations (user_id, role_name, created_at desc);
create unique index role_invocations_idem_idx on role_invocations (user_id, idempotency_key)
  where idempotency_key is not null;

-- Backfill role_invocation_id FKs on the report tables.
alter table ingestion_critic_reports
  add constraint ingestion_critic_reports_invocation_fk foreign key (role_invocation_id)
  references role_invocations(id) on delete set null;

alter table red_team_objections
  add constraint red_team_objections_invocation_fk foreign key (role_invocation_id)
  references role_invocations(id) on delete set null;

alter table premortem_reports
  add constraint premortem_reports_invocation_fk foreign key (role_invocation_id)
  references role_invocations(id) on delete set null;

alter table gap_surfacer_reports
  add constraint gap_surfacer_reports_invocation_fk foreign key (role_invocation_id)
  references role_invocations(id) on delete set null;

-- Cascade runs (the 16-step orchestrated cascade).
create table cascade_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  status cascade_status not null default 'pending',
  steps_completed text[] not null default array[]::text[],
  current_step text,
  trigger_source text not null,              -- 'cron', 'operator', 'webhook'
  budget_cents numeric(10,4) not null default 0,
  spent_cents numeric(10,4) not null default 0,
  stats jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index cascade_runs_user_idx on cascade_runs (user_id, created_at desc);
create index cascade_runs_status_idx on cascade_runs (status) where status in ('pending','running');

-- Workflow runs (publish-prep, contradiction resolution, prediction
-- resolution, etc.). Idempotent via steps_completed.
create table workflow_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  workflow_name text not null,               -- 'publish_prep', 'contradiction_resolution', etc.
  target_kind text,                          -- 'thesis', 'article', 'contradiction', 'prediction', 'production'
  target_id uuid,
  status workflow_status not null default 'pending',
  steps_completed text[] not null default array[]::text[],
  current_step text,
  context jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workflow_runs_user_workflow_idx on workflow_runs (user_id, workflow_name, created_at desc);
create index workflow_runs_target_idx on workflow_runs (target_kind, target_id) where target_id is not null;

alter table role_invocations
  add constraint role_invocations_cascade_fk foreign key (cascade_run_id)
  references cascade_runs(id) on delete set null;

alter table role_invocations
  add constraint role_invocations_workflow_fk foreign key (workflow_run_id)
  references workflow_runs(id) on delete set null;

-- Persistent event stream. Drives the SSE orchestrator endpoint and
-- realtime UI updates.
create table orchestrator_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null,                  -- 'noun.verb' format: 'cascade.started', 'claim.created'
  trace_id text,
  cascade_run_id uuid references cascade_runs(id) on delete set null,
  workflow_run_id uuid references workflow_runs(id) on delete set null,
  subject_kind text,
  subject_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index orchestrator_events_user_created_idx on orchestrator_events (user_id, created_at desc);
create index orchestrator_events_type_idx on orchestrator_events (event_type, created_at desc);
create index orchestrator_events_trace_idx on orchestrator_events (trace_id) where trace_id is not null;
