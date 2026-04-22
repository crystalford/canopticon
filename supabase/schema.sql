-- CANOPTICON v2 — Supabase Schema
-- Run this in the Supabase SQL editor

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- Enums
create type entity_type as enum (
  'person', 'organization', 'corporation', 'government_body',
  'political_party', 'media_outlet', 'policy', 'event', 'place', 'concept'
);
create type claim_status as enum ('unverified', 'verified', 'disputed', 'retracted');
create type intake_status as enum ('pending', 'processing', 'done', 'rejected');
create type hypothesis_status as enum ('open', 'confirmed', 'refuted');
create type contradiction_severity as enum ('low', 'medium', 'high', 'critical');
create type content_status as enum ('draft', 'published');
create type session_status as enum ('active', 'archived');
create type user_tier as enum ('admin', 'supporter', 'public');
create type message_role as enum ('user', 'assistant');

-- Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tier user_tier not null default 'public',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tags
create table tags (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slug text not null unique,
  color text not null default '#8b949e',
  created_at timestamptz not null default now()
);

-- Entities
create table entities (
  id uuid primary key default uuid_generate_v4(),
  entity_id text not null unique, -- shared namespace with Neo4j
  name text not null,
  type entity_type not null,
  subtype text,
  description text,
  confidence_score numeric(3,2) not null default 0.5 check (confidence_score >= 0 and confidence_score <= 1),
  resonance_score numeric(3,2) not null default 0.0 check (resonance_score >= 0 and resonance_score <= 1),
  status text not null default 'active',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Entity Tags (junction)
create table entity_tags (
  entity_id uuid not null references entities(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (entity_id, tag_id)
);

-- Relationships
create table relationships (
  id uuid primary key default uuid_generate_v4(),
  from_entity_id uuid not null references entities(id) on delete cascade,
  to_entity_id uuid not null references entities(id) on delete cascade,
  relationship_type text not null,
  confidence numeric(3,2) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  evidence_ids uuid[] not null default '{}',
  start_date date,
  end_date date,
  is_current boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Sources
create table sources (
  id uuid primary key default uuid_generate_v4(),
  url text not null,
  title text,
  author text,
  published_at timestamptz,
  reliability_tier char(1) not null default 'C' check (reliability_tier in ('A','B','C','D','E','F')),
  content_hash text,
  scraped_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Claims
create table claims (
  id uuid primary key default uuid_generate_v4(),
  content text not null,
  claim_type text not null default 'assertion',
  confidence numeric(3,2) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  resonance numeric(3,2) not null default 0.0 check (resonance >= 0 and resonance <= 1),
  embedding vector(1536),
  source_ids uuid[] not null default '{}',
  entity_ids uuid[] not null default '{}',
  status claim_status not null default 'unverified',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Evidence
create table evidence (
  id uuid primary key default uuid_generate_v4(),
  claim_id uuid not null references claims(id) on delete cascade,
  source_id uuid not null references sources(id) on delete cascade,
  excerpt text,
  relevance_score numeric(3,2) not null default 0.5 check (relevance_score >= 0 and relevance_score <= 1),
  added_at timestamptz not null default now()
);

-- Knowledge Gaps
create table knowledge_gaps (
  id uuid primary key default uuid_generate_v4(),
  gap_type text not null,
  description text not null,
  entity_ids uuid[] not null default '{}',
  urgency_score numeric(3,2) not null default 0.1 check (urgency_score >= 0 and urgency_score <= 1),
  created_at timestamptz not null default now(),
  last_escalated_at timestamptz,
  resolved_at timestamptz,
  is_resolved boolean not null default false
);

-- Hypotheses
create table hypotheses (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text not null,
  confidence numeric(3,2) not null default 0.3 check (confidence >= 0 and confidence <= 1),
  supporting_claim_ids uuid[] not null default '{}',
  contradicting_claim_ids uuid[] not null default '{}',
  status hypothesis_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Convergence Events
create table convergence_events (
  id uuid primary key default uuid_generate_v4(),
  claim_ids uuid[] not null default '{}',
  source_ids uuid[] not null default '{}',
  detected_at timestamptz not null default now(),
  significance_score numeric(3,2) not null default 0.5 check (significance_score >= 0 and significance_score <= 1),
  reviewed boolean not null default false,
  notes text
);

-- Contradictions
create table contradictions (
  id uuid primary key default uuid_generate_v4(),
  claim_a_id uuid not null references claims(id) on delete cascade,
  claim_b_id uuid not null references claims(id) on delete cascade,
  severity contradiction_severity not null default 'medium',
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_notes text
);

-- Conspiracy Flags
create table conspiracy_flags (
  id uuid primary key default uuid_generate_v4(),
  claim_id uuid not null references claims(id) on delete cascade,
  indicators jsonb not null default '{}',
  score numeric(3,2) not null default 0.0 check (score >= 0 and score <= 1),
  flagged_at timestamptz not null default now(),
  reviewed boolean not null default false
);

-- Articles
create table articles (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  slug text not null unique,
  content text not null default '',
  summary text,
  entity_ids uuid[] not null default '{}',
  status content_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Vlogs
create table vlogs (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  script text,
  youtube_url text,
  status content_status not null default 'draft',
  entity_ids uuid[] not null default '{}',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Video Clips
create table video_clips (
  id uuid primary key default uuid_generate_v4(),
  vlog_id uuid not null references vlogs(id) on delete cascade,
  start_seconds integer not null default 0,
  end_seconds integer not null,
  clip_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- System Prompts
create table system_prompts (
  key text primary key,
  content text not null,
  updated_at timestamptz not null default now()
);

-- Agents
create table agents (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  type text not null,
  model_id text not null,
  system_prompt_key text references system_prompts(key) on delete set null,
  is_active boolean not null default true,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Intake Queue
create table intake_queue (
  id uuid primary key default uuid_generate_v4(),
  raw_content text not null,
  source_url text,
  submitted_by uuid references auth.users(id) on delete set null,
  status intake_status not null default 'pending',
  processed_at timestamptz,
  extracted_entities jsonb,
  extracted_claims jsonb,
  created_at timestamptz not null default now()
);

-- Sessions (AI intelligence sessions)
create table sessions (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  entity_ids uuid[] not null default '{}',
  status session_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Session Messages
create table session_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  role message_role not null,
  content text not null,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

-- API Keys
create table api_keys (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  key_hash text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  is_active boolean not null default true
);

-- Audit Log
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index entities_type_idx on entities(type);
create index entities_entity_id_idx on entities(entity_id);
create index claims_status_idx on claims(status);
create index claims_embedding_idx on claims using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index knowledge_gaps_resolved_idx on knowledge_gaps(is_resolved);
create index knowledge_gaps_urgency_idx on knowledge_gaps(urgency_score desc);
create index intake_queue_status_idx on intake_queue(status);
create index audit_log_actor_idx on audit_log(actor_id);
create index audit_log_table_idx on audit_log(table_name);

-- RLS: Enable on all tables
alter table profiles enable row level security;
alter table entities enable row level security;
alter table entity_tags enable row level security;
alter table tags enable row level security;
alter table relationships enable row level security;
alter table sources enable row level security;
alter table claims enable row level security;
alter table evidence enable row level security;
alter table knowledge_gaps enable row level security;
alter table hypotheses enable row level security;
alter table convergence_events enable row level security;
alter table contradictions enable row level security;
alter table conspiracy_flags enable row level security;
alter table articles enable row level security;
alter table vlogs enable row level security;
alter table video_clips enable row level security;
alter table system_prompts enable row level security;
alter table agents enable row level security;
alter table intake_queue enable row level security;
alter table sessions enable row level security;
alter table session_messages enable row level security;
alter table api_keys enable row level security;
alter table audit_log enable row level security;

-- Helper: check if current user is admin
create or replace function is_admin()
returns boolean
language sql security definer
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and tier = 'admin'
  );
$$;

-- Helper: check if current user is supporter or admin
create or replace function is_supporter()
returns boolean
language sql security definer
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and tier in ('admin', 'supporter')
  );
$$;

-- RLS Policies: profiles
create policy "Users can read own profile" on profiles for select using (id = auth.uid());
create policy "Admins can read all profiles" on profiles for select using (is_admin());
create policy "Users can update own profile" on profiles for update using (id = auth.uid());

-- RLS Policies: entities (public read published, supporter+ read all, admin write)
create policy "Public can read entities" on entities for select using (status = 'active');
create policy "Admin can insert entities" on entities for insert with check (is_admin());
create policy "Admin can update entities" on entities for update using (is_admin());
create policy "Admin can delete entities" on entities for delete using (is_admin());

-- RLS Policies: tags (public read, admin write)
create policy "Anyone can read tags" on tags for select using (true);
create policy "Admin can manage tags" on tags for all using (is_admin());

-- RLS Policies: entity_tags
create policy "Anyone can read entity_tags" on entity_tags for select using (true);
create policy "Admin can manage entity_tags" on entity_tags for all using (is_admin());

-- RLS Policies: relationships
create policy "Supporters can read relationships" on relationships for select using (is_supporter());
create policy "Admin can manage relationships" on relationships for all using (is_admin());

-- RLS Policies: sources
create policy "Supporters can read sources" on sources for select using (is_supporter());
create policy "Admin can manage sources" on sources for all using (is_admin());

-- RLS Policies: claims
create policy "Supporters can read claims" on claims for select using (is_supporter());
create policy "Admin can manage claims" on claims for all using (is_admin());

-- RLS Policies: evidence
create policy "Supporters can read evidence" on evidence for select using (is_supporter());
create policy "Admin can manage evidence" on evidence for all using (is_admin());

-- RLS Policies: knowledge_gaps
create policy "Supporters can read gaps" on knowledge_gaps for select using (is_supporter());
create policy "Admin can manage gaps" on knowledge_gaps for all using (is_admin());

-- RLS Policies: hypotheses
create policy "Supporters can read hypotheses" on hypotheses for select using (is_supporter());
create policy "Admin can manage hypotheses" on hypotheses for all using (is_admin());

-- RLS Policies: convergence_events
create policy "Admin can manage convergences" on convergence_events for all using (is_admin());

-- RLS Policies: contradictions
create policy "Admin can manage contradictions" on contradictions for all using (is_admin());

-- RLS Policies: conspiracy_flags
create policy "Admin can manage conspiracy flags" on conspiracy_flags for all using (is_admin());

-- RLS Policies: articles (public read published)
create policy "Public can read published articles" on articles for select using (status = 'published');
create policy "Supporters can read all articles" on articles for select using (is_supporter());
create policy "Admin can manage articles" on articles for all using (is_admin());

-- RLS Policies: vlogs
create policy "Public can read published vlogs" on vlogs for select using (status = 'published');
create policy "Admin can manage vlogs" on vlogs for all using (is_admin());

-- RLS Policies: video_clips
create policy "Admin can manage video clips" on video_clips for all using (is_admin());

-- RLS Policies: system_prompts
create policy "Admin can manage system prompts" on system_prompts for all using (is_admin());

-- RLS Policies: agents
create policy "Supporters can read agents" on agents for select using (is_supporter());
create policy "Admin can manage agents" on agents for all using (is_admin());

-- RLS Policies: intake_queue
create policy "Supporters can submit intake" on intake_queue for insert with check (is_supporter());
create policy "Admin can manage intake" on intake_queue for all using (is_admin());

-- RLS Policies: sessions
create policy "Admin can manage sessions" on sessions for all using (is_admin());

-- RLS Policies: session_messages
create policy "Admin can manage session messages" on session_messages for all using (is_admin());

-- RLS Policies: api_keys
create policy "Admin can manage api keys" on api_keys for all using (is_admin());

-- RLS Policies: audit_log
create policy "Admin can read audit log" on audit_log for select using (is_admin());

-- Auto-update updated_at trigger
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger entities_updated_at before update on entities for each row execute function update_updated_at();
create trigger claims_updated_at before update on claims for each row execute function update_updated_at();
create trigger hypotheses_updated_at before update on hypotheses for each row execute function update_updated_at();
create trigger articles_updated_at before update on articles for each row execute function update_updated_at();
create trigger vlogs_updated_at before update on vlogs for each row execute function update_updated_at();
create trigger sessions_updated_at before update on sessions for each row execute function update_updated_at();
create trigger agents_updated_at before update on agents for each row execute function update_updated_at();
create trigger profiles_updated_at before update on profiles for each row execute function update_updated_at();

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, tier, display_name)
  values (new.id, 'public', new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Seed: System Prompts
insert into system_prompts (key, content, updated_at) values
('intelligence_agent', 'You are CANOPTICON, a Canadian political intelligence analyst. Your role is to map how power operates in Canada by analyzing entities, relationships, and claims with rigorous epistemic standards. Always distinguish between Confidence (quality of evidence) and Resonance (how widely a belief is held). Apply NATO Admiralty source reliability ratings (A-F). Use Sherman Kent probability language. Screen structural claims for conspiracy pathology indicators: unfalsifiability, omnipotence attribution, self-sealing logic, anomaly hunting, persecution narrative, and pattern overreach. Report what the evidence supports, not what would be most dramatic.', now()),
('intake_classifier', 'You are an intake classifier for CANOPTICON. Given raw content, extract: (1) entities mentioned with their types, (2) claims made with confidence assessments, (3) source reliability tier (A-F), (4) relationships implied between entities. Output structured JSON only. Be conservative — mark uncertain extractions as low confidence.', now()),
('gap_escalator', 'You are the gap escalator for CANOPTICON. Review open knowledge gaps and assess which deserve increased urgency based on: time elapsed without resolution, importance to active hypotheses, and new evidence that makes the gap more significant. Output updated urgency scores and escalation rationale.', now()),
('health_narrator', 'You are the health narrator for CANOPTICON. Summarize the current state of the knowledge graph: entity counts by type, claim verification rates, open hypotheses, unresolved contradictions, and critical knowledge gaps. Identify the most significant recent developments and flag areas needing attention.', now());

-- Seed: Agents
insert into agents (name, slug, type, model_id, system_prompt_key, is_active, config) values
('Intelligence Agent', 'intelligence-agent', 'intelligence', 'claude-sonnet-4-6', 'intelligence_agent', true, '{"max_tokens": 8192, "temperature": 0.3}'),
('Intake Classifier', 'intake-classifier', 'classifier', 'claude-haiku-4-5-20251001', 'intake_classifier', true, '{"max_tokens": 2048, "temperature": 0.1}'),
('Gap Escalator', 'gap-escalator', 'cron', 'claude-haiku-4-5-20251001', 'gap_escalator', true, '{"max_tokens": 2048, "temperature": 0.2}'),
('Health Narrator', 'health-narrator', 'cron', 'claude-haiku-4-5-20251001', 'health_narrator', true, '{"max_tokens": 1024, "temperature": 0.2}');
