-- Phase 1 Migration: Core MVP Schema
-- Created: 2025-01-12

-- 1. SOURCES TABLE (Enhanced or Created)
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  created_at timestamptz default now()
);

-- Add new columns to sources (idempotent)
alter table sources add column if not exists source_type text default 'rss';
alter table sources add column if not exists category text default 'news';
alter table sources add column if not exists priority integer default 5;
alter table sources add column if not exists reliability_score float default 0.5;
alter table sources add column if not exists active boolean default true;
alter table sources add column if not exists last_ingested_at timestamptz;
alter table sources add column if not exists last_successful_ingest timestamptz;
alter table sources add column if not exists consecutive_failures integer default 0;
alter table sources add column if not exists error_count integer default 0;
alter table sources add column if not exists auto_disabled boolean default false;
alter table sources add column if not exists ingestion_frequency_minutes integer default 15;
alter table sources add column if not exists auto_flag_keywords text[];
alter table sources add column if not exists updated_at timestamptz default now();

-- Seed Default Sources (if they don't exist)
insert into sources (name, url, category, source_type, reliability_score, priority) values 
('CBC Politics', 'https://www.cbc.ca/cmlink/rss-politics', 'news', 'rss', 0.85, 8),
('Global News Politics', 'https://globalnews.ca/politics/feed/', 'news', 'rss', 0.8, 7),
('CTV News Politics', 'https://www.ctvnews.ca/rss/ctvnews-ca-politics-public-xml-1.822302', 'news', 'rss', 0.8, 7),
('Parliament Hansard', 'https://www.ourcommons.ca/en/parliamentary-business/2025/1/12/hansard/rss', 'government', 'government', 1.0, 10),
('Prime Minister Office', 'https://pm.gc.ca/en/news/rss', 'government', 'government', 0.9, 9)
on conflict (url) do update set 
  reliability_score = excluded.reliability_score,
  priority = excluded.priority,
  source_type = excluded.source_type;

-- 2. SIGNALS TABLE (Updates)
-- Add new columns
alter table signals add column if not exists source_id uuid references sources(id);
alter table signals add column if not exists cluster_id uuid;
alter table signals add column if not exists signal_type text; -- 'breaking', 'repetition', etc.
alter table signals add column if not exists confidence_score float;
alter table signals add column if not exists metadata jsonb;
alter table signals add column if not exists updated_at timestamptz default now();

-- Create Indexes for Signals
create index if not exists idx_signals_status on signals(status);
create index if not exists idx_signals_cluster on signals(cluster_id);
create index if not exists idx_signals_published_at on signals(published_at DESC);

-- Backfill source_id for existing signals (Best effort matching)
update signals s
set source_id = src.id
from sources src
where s.source = src.name
and s.source_id is null;

-- 3. ARTICLES TABLE (Published Content)
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  signal_id bigint references signals(id),
  cluster_id uuid, -- if merged
  
  -- Content
  slug text unique not null,
  headline text not null,
  summary text not null,
  generated_content jsonb, -- x_thread, youtube_script etc
  sources jsonb, -- array of source URLs
  
  -- Publishing
  tier text not null, -- 'curated' | 'archive'
  published_at timestamptz default now(),
  
  -- Video Status
  video_status text default 'none', -- 'none' | 'script_ready' | 'in_progress' | 'published'
  video_url text,
  
  -- Analytics
  view_count integer default 0,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_articles_tier on articles(tier);
create index if not exists idx_articles_video_status on articles(video_status);
create index if not exists idx_articles_published_at on articles(published_at DESC);

-- 4. VIDEO MATERIALS TABLE (For content creation)
create table if not exists video_materials (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references articles(id),
  
  -- Generated content
  script text,
  quotes jsonb, -- [{text, attribution, timestamp}]
  contradictions jsonb,
  angles jsonb, -- [string]
  
  -- Export
  generated_at timestamptz default now(),
  exported boolean default false,
  export_format text
);

-- 5. EDITORIAL ACTIONS (Audit Log)
create table if not exists editorial_actions (
  id uuid primary key default gen_random_uuid(),
  signal_id bigint references signals(id),
  article_id uuid references articles(id),
  
  action_type text not null, -- 'manual_approve', 'manual_flag'
  from_state text,
  to_state text,
  reason text,
  admin_user text,
  
  created_at timestamptz default now()
);

-- 6. CONTENT LIFECYCLE
create table if not exists content_lifecycle (
  id uuid primary key default gen_random_uuid(),
  signal_id bigint references signals(id),
  article_id uuid references articles(id),
  lifecycle_event text not null,
  occurred_at timestamptz default now()
);

-- Enable RLS (Row Level Security) - default to permissive for MVP admin usage
alter table sources enable row level security;
alter table articles enable row level security;
alter table video_materials enable row level security;

create policy "Public Read Articles" on articles for select using (true);
create policy "Admin All Sources" on sources for all using (true) with check (true);
create policy "Admin All Articles" on articles for all using (true) with check (true);
create policy "Admin All Video Materials" on video_materials for all using (true) with check (true);
