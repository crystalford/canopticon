-- CMS foundation: posts is the central operator-facing publication object.
-- Drafted in chat, published to /p/<slug>, optionally fed into the graph
-- compartment for extraction. CMS works standalone (GRAPH_ENABLED=false).

CREATE TABLE posts (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  body_md         TEXT NOT NULL,
  body_html       TEXT,
  post_type       TEXT NOT NULL DEFAULT 'article'
                    CHECK (post_type IN ('article','thesis','note')),
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','withdrawn')),
  byline          TEXT NOT NULL DEFAULT '',
  tags            TEXT NOT NULL DEFAULT '[]',
  cited_claim_ids TEXT NOT NULL DEFAULT '[]',
  is_forensic     INTEGER NOT NULL DEFAULT 0,
  visibility      TEXT NOT NULL DEFAULT 'public',
  contributed_by  TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at    TEXT,
  UNIQUE (user_id, slug)
);
CREATE INDEX idx_posts_user_status ON posts (user_id, status, published_at DESC);
CREATE INDEX idx_posts_type ON posts (post_type, published_at DESC);

CREATE TABLE post_versions (
  id              TEXT PRIMARY KEY,
  post_id         TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  body_md         TEXT NOT NULL,
  change_summary  TEXT,
  saved_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (post_id, version)
);
CREATE INDEX idx_post_versions_post ON post_versions (post_id, version DESC);

CREATE TABLE corrections (
  id              TEXT PRIMARY KEY,
  post_id         TEXT REFERENCES posts(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  before_text     TEXT,
  after_text      TEXT,
  issued_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_corrections_post ON corrections (post_id, issued_at DESC);
