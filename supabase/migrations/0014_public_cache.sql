-- 0014_public_cache.sql
-- Public-facing materialization tables. Operator refreshes; PostgREST
-- serves to anonymous readers via SELECT-only RLS. Decouples the public
-- read path from the operator write path.

create table pub_articles_cache (
  article_id uuid primary key references articles(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  slug text unique not null,
  article_type article_type not null,
  title text not null,
  subtitle text,
  author text,
  byline_date date,
  body_md text not null,
  word_count integer,
  reading_time_minutes integer,
  published_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  refreshed_at timestamptz not null default now()
);

create index pub_articles_cache_published_idx on pub_articles_cache (published_at desc);
create index pub_articles_cache_type_idx on pub_articles_cache (article_type);

create table pub_theses_cache (
  thesis_id uuid primary key references theses(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  slug text unique not null,
  title text not null,
  seed_summary text,
  coined_phrase text,
  ipcc_likelihood ipcc_likelihood,
  tier_bluf text not null,
  tier_80 text not null,
  tier_800 text not null,
  tier_full text,
  version_number integer not null,
  primary_operator text,
  published_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  refreshed_at timestamptz not null default now()
);

create index pub_theses_cache_published_idx on pub_theses_cache (published_at desc);

create table pub_predictions_cache (
  prediction_id uuid primary key references predictions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  slug text unique not null,
  statement text not null,
  confidence_pct integer not null,
  ipcc_likelihood ipcc_likelihood,
  resolution_criterion text not null,
  resolution_horizon date not null,
  domain text,
  status prediction_status not null,
  resolved_at timestamptz,
  resolved_outcome text,
  brier_contribution numeric(6,4),
  payload jsonb not null default '{}'::jsonb,
  refreshed_at timestamptz not null default now()
);

create index pub_predictions_cache_status_idx on pub_predictions_cache (status, resolution_horizon);
create index pub_predictions_cache_domain_idx on pub_predictions_cache (domain) where domain is not null;

create table pub_contradictions_cache (
  contradiction_id uuid primary key references contradictions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  slug text unique not null,
  posture contradiction_posture not null,
  resolution_reasoning text,
  payload jsonb not null default '{}'::jsonb,                -- both claims, sources, detection details
  refreshed_at timestamptz not null default now()
);

create index pub_contradictions_cache_posture_idx on pub_contradictions_cache (posture);

create table pub_entities_cache (
  entity_id uuid primary key references entities(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  slug text unique not null,
  canonical_name text not null,
  entity_type entity_type not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,                -- timeline, relations, theses, claims
  refreshed_at timestamptz not null default now()
);

create index pub_entities_cache_type_idx on pub_entities_cache (entity_type);

create table pub_sources_cache (
  source_id uuid primary key references sources(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  slug text unique not null,
  title text not null,
  source_type source_type not null,
  admiralty_grade admiralty_grade,
  bias_profile text,
  published_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  refreshed_at timestamptz not null default now()
);

create index pub_sources_cache_grade_idx on pub_sources_cache (admiralty_grade);

create table pub_claims_cache (
  claim_id uuid primary key references claims(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  slug text unique not null,
  claim_text text not null,
  layer claim_layer not null,
  admiralty_grade admiralty_grade,
  verification_status verification_status not null,
  ipcc_likelihood ipcc_likelihood,
  payload jsonb not null default '{}'::jsonb,                -- Toulmin, sources, related claims
  refreshed_at timestamptz not null default now()
);

create index pub_claims_cache_layer_idx on pub_claims_cache (layer);
create index pub_claims_cache_verification_idx on pub_claims_cache (verification_status);

-- Subscribers per surface and per thesis. Email + RSS opt-in.
create table pub_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  email text not null,
  channels text[] not null default array['articles']::text[],
  thesis_id uuid references theses(id) on delete cascade,
  confirmed boolean not null default false,
  confirmation_token text,
  unsubscribe_token text not null,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create unique index pub_subscriptions_email_thesis_idx
  on pub_subscriptions (email, coalesce(thesis_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index pub_subscriptions_user_idx on pub_subscriptions (user_id);
