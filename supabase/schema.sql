-- Create the signals table
create table if not exists signals (
  id uuid default gen_random_uuid() primary key,
  hash text unique not null, -- Unique identifier to prevent duplicates (hash of url/source)
  headline text not null,
  summary text,
  url text,
  source text not null,
  published_at timestamptz not null default now(),
  priority text default 'normal', -- 'high', 'normal', 'low'
  status text default 'pending', -- 'pending', 'processed', 'archived'
  entities text[], -- Array of strings
  topics text[], -- Array of strings
  raw_content jsonb, -- Store full raw data just in case
  
  -- AI Analysis Columns
  ai_summary text,
  ai_script text,
  ai_tags text[],
  
  created_at timestamptz default now()
);

-- Create intake_logs table
create table if not exists intake_logs (
  id uuid default gen_random_uuid() primary key,
  source text not null,
  status text not null, -- 'success', 'error'
  items_count integer default 0,
  details text,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table signals enable row level security;
alter table intake_logs enable row level security;

-- Create policies (Allow read/write for now since we are in easy mode)
create policy "Public Access" on signals for all using (true) with check (true);
create policy "Public Access Logs" on intake_logs for all using (true) with check (true);
