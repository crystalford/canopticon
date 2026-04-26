-- 0007_falsifiability.sql
-- Falsifiability infrastructure: assumptions, indicators, predictions, contradictions.
-- This is the substrate of the calibration discipline.

-- Propositions a thesis depends on. Linchpin assumptions, if broken,
-- collapse the thesis.
create table assumptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  thesis_id uuid references theses(id) on delete cascade,
  statement text not null,
  is_linchpin boolean not null default false,
  status assumption_status not null default 'holding',
  audited_at timestamptz,
  audit_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assumptions_thesis_idx on assumptions (thesis_id) where thesis_id is not null;
create index assumptions_status_idx on assumptions (user_id, status);
create index assumptions_linchpin_idx on assumptions (thesis_id) where is_linchpin;

create table assumption_supporting_claims (
  assumption_id uuid not null references assumptions(id) on delete cascade,
  claim_id uuid not null references claims(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  weight numeric(4,3) not null default 0.5,
  created_at timestamptz not null default now(),
  primary key (assumption_id, claim_id)
);

-- Measurable metrics whose future values confirm/disconfirm thesis claims.
create table indicators (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  thesis_id uuid references theses(id) on delete cascade,
  name text not null,
  description text,
  unit text,
  expected_direction text,                   -- 'increasing', 'decreasing', 'stable', 'crossing_threshold'
  threshold_value numeric,
  status indicator_status not null default 'active',
  validated_by_validator boolean not null default false,
  validation_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index indicators_thesis_idx on indicators (thesis_id) where thesis_id is not null;
create index indicators_status_idx on indicators (user_id, status);

create table indicator_observations (
  id uuid primary key default uuid_generate_v4(),
  indicator_id uuid not null references indicators(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  value numeric not null,
  observed_at timestamptz not null,
  source_id uuid references sources(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index indicator_observations_indicator_idx on indicator_observations (indicator_id, observed_at desc);

-- Explicit probabilistic forecasts. Required at minimum 3 per published thesis
-- (undismissability gate).
create table predictions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  thesis_id uuid references theses(id) on delete cascade,
  claim_id uuid references claims(id) on delete cascade,
  statement text not null,
  confidence_pct integer not null check (confidence_pct between 0 and 100),
  ipcc_likelihood ipcc_likelihood,
  resolution_criterion text not null,
  resolution_horizon date not null,
  domain text,                               -- 'monetary', 'regulatory', 'corporate', 'electoral'
  status prediction_status not null default 'active',
  resolved_at timestamptz,
  resolved_outcome text,
  brier_contribution numeric(6,4),
  is_public boolean not null default false,
  public_slug text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index predictions_user_status_idx on predictions (user_id, status, created_at desc);
create index predictions_thesis_idx on predictions (thesis_id) where thesis_id is not null;
create index predictions_horizon_idx on predictions (resolution_horizon) where status = 'active';
create index predictions_public_idx on predictions (user_id, is_public, created_at desc) where is_public;

-- Pairs of claims that cannot both be true. Posture preserved (machloket
-- is a legitimate state — contradictions are not auto-resolved).
create table contradictions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  claim_a_id uuid not null references claims(id) on delete cascade,
  claim_b_id uuid not null references claims(id) on delete cascade,
  detected_by text not null,                 -- 'verifier', 'operator', 'cascade'
  posture contradiction_posture not null default 'open',
  resolution_reasoning text,
  affected_thesis_ids uuid[] not null default array[]::uuid[],
  is_public boolean not null default false,
  public_slug text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (claim_a_id <> claim_b_id)
);

create index contradictions_user_posture_idx on contradictions (user_id, posture, created_at desc);
create index contradictions_claim_a_idx on contradictions (claim_a_id);
create index contradictions_claim_b_idx on contradictions (claim_b_id);
create index contradictions_public_idx on contradictions (user_id, is_public) where is_public;
