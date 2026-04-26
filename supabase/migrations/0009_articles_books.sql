-- 0009_articles_books.sql
-- Articles (the published-content surface) and books (long-form references
-- with three ingest modes: surface / substrate / influence).

create table articles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  article_type article_type not null,
  title text not null,
  subtitle text,
  current_version_id uuid,                   -- FK added after article_versions exists

  -- Authorship (named operator declaration is mandatory before publish).
  author text,
  byline_date date,

  -- Publication state.
  is_public boolean not null default false,
  public_slug text unique,
  published_at timestamptz,

  -- Cross-links to other substrate.
  thesis_id uuid references theses(id) on delete set null,
  argument_map_id uuid references argument_maps(id) on delete set null,
  solution_inventory_id uuid references solution_inventories(id) on delete set null,
  frame_genealogy_id uuid references frame_genealogies(id) on delete set null,
  five_whys_chain_id uuid references five_whys_chains(id) on delete set null,

  -- Production link (for video/audio/thread accompaniment).
  production_id uuid,                        -- FK added in 0010

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index articles_user_idx on articles (user_id, created_at desc);
create index articles_type_idx on articles (article_type);
create index articles_public_slug_idx on articles (public_slug) where public_slug is not null;
create index articles_public_idx on articles (user_id, is_public, published_at desc) where is_public;

create table article_versions (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid not null references articles(id) on delete cascade,
  version_number integer not null,
  body_md text not null,
  word_count integer,
  reading_time_minutes integer,
  change_summary text,
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  unique (article_id, version_number)
);

create index article_versions_article_idx on article_versions (article_id, version_number desc);

alter table articles
  add constraint articles_current_version_fk foreign key (current_version_id)
  references article_versions(id) on delete set null;

create table article_claims (
  article_version_id uuid not null references article_versions(id) on delete cascade,
  claim_id uuid not null references claims(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  citation_locator text,
  created_at timestamptz not null default now(),
  primary key (article_version_id, claim_id)
);

create index article_claims_claim_idx on article_claims (claim_id);

create table article_corrections (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid not null references articles(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  original_text text,
  corrected_text text not null,
  reason text not null,
  affects_claim_id uuid references claims(id) on delete set null,
  is_public boolean not null default true,   -- corrections default to public per discipline
  corrected_at timestamptz not null default now()
);

create index article_corrections_article_idx on article_corrections (article_id, corrected_at desc);
create index article_corrections_public_idx on article_corrections (user_id, is_public, corrected_at desc) where is_public;

-- Books: three ingest modes determine how deeply the substrate references them.
create table books (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  authors text[] not null default array[]::text[],
  publisher text,
  published_year integer,
  isbn text,
  ingest_mode book_ingest_mode not null default 'surface',
  reading_progress numeric(4,3) not null default 0 check (reading_progress between 0 and 1),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index books_user_idx on books (user_id, created_at desc);

create table book_chapters (
  id uuid primary key default uuid_generate_v4(),
  book_id uuid not null references books(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  chapter_number integer not null,
  title text not null,
  prior_chapter_summary text,
  notes text,
  linked_article_ids uuid[] not null default array[]::uuid[],
  linked_thesis_ids uuid[] not null default array[]::uuid[],
  extracted_claim_ids uuid[] not null default array[]::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, chapter_number)
);

create index book_chapters_book_idx on book_chapters (book_id, chapter_number);
