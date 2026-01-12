# Supabase Database Setup for Phase 9 (The Cortex)

To enable Long-Term Memory (Vector Search), you must run the following SQL commands in your Supabase Project Dashboard > SQL Editor.

## 1. Enable Vector Extension and Create Tables

```sql
-- Enable pgvector extension
create extension if not exists vector;

-- Create the memory_vectors table
-- NOTE: We assume 'signals.id' is a BIGINT or UUID. Check your 'signals' table schema.
-- If 'signals.id' is UUID (default), use 'uuid'. If it's int8, use 'bigint'.
-- Below assumes UUID.
create table if not exists memory_vectors (
  id uuid primary key default gen_random_uuid(),
  content text,
  metadata jsonb,
  embedding vector(768), -- Dimensions for text-embedding-004
  signal_id uuid references signals(id) on delete set null, 
  created_at timestamptz default now()
);

-- Create HNSW Index for fast similarity search
create index on memory_vectors using hnsw (embedding vector_cosine_ops);
```

## 2. Create the Similarity Search Function (RPC)

We need a Remote Procedure Call (RPC) to perform the similarity search from our code.

```sql
create or replace function match_memories (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    memory_vectors.id,
    memory_vectors.content,
    memory_vectors.metadata,
    1 - (memory_vectors.embedding <=> query_embedding) as similarity
  from memory_vectors
  where 1 - (memory_vectors.embedding <=> query_embedding) > match_threshold
  order by memory_vectors.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

## 3. Verify

After running this, the "Memorize in Cortex" feature in `analyzeSignalAction` will work.
