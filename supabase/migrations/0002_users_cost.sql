-- 0002_users_cost.sql
-- Operator account, cost discipline, and approval lifecycle.
-- Cost gate is the single chokepoint for every paid operation in the system.

-- Operator (one row per account).
create table users (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique not null,        -- supabase auth.users.id
  email text unique not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Cost discipline.
  monthly_ceiling_cents integer not null default 5000,
  daily_warn_cents integer not null default 200,

  -- Cascade orchestration.
  cascade_cron_expr text,
  ingestion_apis_enabled boolean not null default false,

  -- Editorial identity (per undismissability gate "named_operator").
  named_operator text,
  operator_credentials text,

  preferences jsonb not null default '{}'::jsonb
);

create index users_auth_user_id_idx on users (auth_user_id);

-- Every paid API call lands here. No silent charges.
create table cost_ledger (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  operation_type text not null,              -- 'anthropic_role', 'transcription_assemblyai', etc.
  provider text not null,                    -- 'anthropic', 'assemblyai', 'cloudflare_r2'
  model text,
  cost_cents numeric(10,4) not null,
  whitelisted boolean not null default false,
  approval_id uuid,                          -- references cost_approvals when applicable
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index cost_ledger_user_created_idx on cost_ledger (user_id, created_at desc);
create index cost_ledger_operation_idx on cost_ledger (operation_type);
create unique index cost_ledger_idem_idx on cost_ledger (user_id, idempotency_key)
  where idempotency_key is not null;

-- Per-operation rules that allow auto-approval up to caps.
create table cost_whitelists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  operation_type text not null,
  enabled boolean not null default true,
  per_op_max_cents numeric(10,4),
  daily_max_cents numeric(10,4),
  monthly_max_cents numeric(10,4),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, operation_type)
);

-- Operator approval prompts queued by approvePaidOperation().
create table cost_approvals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  operation_type text not null,
  provider text not null,
  model text,
  estimated_cost_cents numeric(10,4) not null,
  reason text,
  context jsonb not null default '{}'::jsonb,
  status cost_approval_status not null default 'pending',
  decided_at timestamptz,
  decision_notes text,
  whitelist_after_approve boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index cost_approvals_user_status_idx on cost_approvals (user_id, status, created_at desc);
