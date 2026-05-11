-- 0005_articles_productions.sql
-- Articles, books, productions, beats, scripts, publishes, perf.

CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_type TEXT NOT NULL CHECK (article_type IN ('intelligence_thesis','policy_brief','argument_map','solution_inventory','root_cause_analysis','prediction_log','book_chapter','investigation_note','frame_genealogy')),
  title TEXT NOT NULL,
  subtitle TEXT,
  current_version_id TEXT,
  author TEXT,
  byline_date TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  public_slug TEXT UNIQUE,
  published_at TEXT,
  thesis_id TEXT REFERENCES theses(id) ON DELETE SET NULL,
  argument_map_id TEXT REFERENCES argument_maps(id) ON DELETE SET NULL,
  solution_inventory_id TEXT REFERENCES solution_inventories(id) ON DELETE SET NULL,
  frame_genealogy_id TEXT REFERENCES frame_genealogies(id) ON DELETE SET NULL,
  five_whys_chain_id TEXT REFERENCES five_whys_chains(id) ON DELETE SET NULL,
  production_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX articles_user_idx ON articles (user_id, created_at DESC);
CREATE INDEX articles_type_idx ON articles (article_type);
CREATE INDEX articles_public_idx ON articles (user_id, is_public, published_at DESC) WHERE is_public = 1;

CREATE TABLE article_versions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  body_md TEXT NOT NULL,
  word_count INTEGER,
  reading_time_minutes INTEGER,
  change_summary TEXT,
  created_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (article_id, version_number)
);
CREATE INDEX article_versions_article_idx ON article_versions (article_id, version_number DESC);

CREATE TABLE article_claims (
  article_version_id TEXT NOT NULL REFERENCES article_versions(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  citation_locator TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (article_version_id, claim_id)
);
CREATE INDEX article_claims_claim_idx ON article_claims (claim_id);

CREATE TABLE article_corrections (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_text TEXT,
  corrected_text TEXT NOT NULL,
  reason TEXT NOT NULL,
  affects_claim_id TEXT REFERENCES claims(id) ON DELETE SET NULL,
  is_public INTEGER NOT NULL DEFAULT 1,
  corrected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX article_corrections_article_idx ON article_corrections (article_id, corrected_at DESC);

CREATE TABLE books (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  authors TEXT NOT NULL DEFAULT '[]',
  publisher TEXT,
  published_year INTEGER,
  isbn TEXT,
  ingest_mode TEXT NOT NULL DEFAULT 'surface' CHECK (ingest_mode IN ('surface','substrate','influence')),
  reading_progress REAL NOT NULL DEFAULT 0 CHECK (reading_progress BETWEEN 0 AND 1),
  notes TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX books_user_idx ON books (user_id, created_at DESC);

CREATE TABLE book_chapters (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  prior_chapter_summary TEXT,
  notes TEXT,
  linked_article_ids TEXT NOT NULL DEFAULT '[]',
  linked_thesis_ids TEXT NOT NULL DEFAULT '[]',
  extracted_claim_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (book_id, chapter_number)
);
CREATE INDEX book_chapters_book_idx ON book_chapters (book_id, chapter_number);

-- Productions.
CREATE TABLE productions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  state TEXT NOT NULL DEFAULT 'ready' CHECK (state IN ('ready','recording','producing','publish','perf','archive')),
  thesis_id TEXT REFERENCES theses(id) ON DELETE SET NULL,
  article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
  estimated_runtime_seconds INTEGER,
  estimated_word_count INTEGER,
  pipeline_stage TEXT NOT NULL DEFAULT 'script',
  pipeline_progress REAL NOT NULL DEFAULT 0,
  rendered_video_uri TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX productions_user_state_idx ON productions (user_id, state, created_at DESC);

CREATE TABLE scripts (
  id TEXT PRIMARY KEY,
  production_id TEXT NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  full_text TEXT NOT NULL,
  beat_count INTEGER NOT NULL DEFAULT 0,
  generated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (production_id, version_number)
);

CREATE TABLE beats (
  id TEXT PRIMARY KEY,
  script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  beat_number INTEGER NOT NULL,
  cue_label TEXT,
  beat_text TEXT NOT NULL,
  estimated_seconds INTEGER,
  word_count INTEGER,
  citation_count INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','good','skipped','rerecord')),
  recording_uri TEXT,
  recorded_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (script_id, beat_number)
);
CREATE INDEX beats_script_idx ON beats (script_id, beat_number);

CREATE TABLE production_publishes (
  id TEXT PRIMARY KEY,
  production_id TEXT NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  scheduled_at TEXT,
  published_at TEXT,
  external_url TEXT,
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','published','failed','cancelled')),
  error_message TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX production_publishes_production_idx ON production_publishes (production_id);

CREATE TABLE production_perf (
  id TEXT PRIMARY KEY,
  publish_id TEXT NOT NULL REFERENCES production_publishes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  observed_at TEXT NOT NULL,
  impressions INTEGER,
  views INTEGER,
  saves INTEGER,
  shares INTEGER,
  comments INTEGER,
  subscriber_gain INTEGER,
  performance_tier TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX production_perf_publish_idx ON production_perf (publish_id, observed_at DESC);
