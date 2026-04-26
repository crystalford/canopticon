-- 0012_adversarial.sql
-- Adversarial outputs: Red Team objections, Premortem reports, Gap Surfacer reports.
-- These gate publication via the publish-prep workflow.

create table red_team_objections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  thesis_id uuid not null references theses(id) on delete cascade,
  vantage text not null,                     -- 'historian_50yr', 'contrarian_economist', 'opposing_tradition', 'foreign_observer', 'base_rate_skeptic', 'methodological_skeptic'
  objection_text text not null,
  severity text not null,                    -- 'minor', 'moderate', 'severe', 'fatal'
  proposed_response text,
  resolved boolean not null default false,
  resolved_via_steelman_id uuid,             -- references steelman record if any (TBD table)
  role_invocation_id uuid,
  raw_output jsonb,
  created_at timestamptz not null default now()
);

create index red_team_objections_thesis_idx on red_team_objections (thesis_id, severity, created_at desc);

create table premortem_reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  thesis_id uuid not null references theses(id) on delete cascade,
  failure_mode_summary text not null,
  falsifying_observation text not null,      -- required; gates publication
  is_falsifiable boolean not null default true,
  fatal boolean not null default false,
  role_invocation_id uuid,
  raw_output jsonb,
  created_at timestamptz not null default now()
);

create index premortem_reports_thesis_idx on premortem_reports (thesis_id, created_at desc);

create table gap_surfacer_reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  thesis_id uuid not null references theses(id) on delete cascade,
  stage_gaps jsonb not null default '{}'::jsonb,   -- 7-stage sweep results
  structural_holes jsonb not null default '[]'::jsonb,
  summary text,
  role_invocation_id uuid,
  raw_output jsonb,
  created_at timestamptz not null default now()
);

create index gap_surfacer_reports_thesis_idx on gap_surfacer_reports (thesis_id, created_at desc);
