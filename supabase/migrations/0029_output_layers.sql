-- 0029_output_layers.sql — two output layers + firewall columns + citations.
--
-- Canonical-spec v2.4 Part 5: outputs span a FACTUAL layer (Arrangements:
-- definition, timeline, entity-profile, claim-table, ...) and an INTERPRETIVE
-- layer (Intents: investigation, argument, assessment, ...). The old briefs
-- table CHECK-constrained content_type to five factual types; SQLite can't
-- alter a CHECK, so the table is rebuilt without it, gaining:
--   layer       'factual' | 'interpretive'  (interpretive pieces are SIGNED)
--   confidence  ODNI-style band for interpretive outputs (NULL for factual)
--
-- brief_claims gains the FIREWALL columns (spec Part 5 + Part 10 #5):
--   kind         'fact' | 'assertion' — which side of the firewall the claim
--                came from
--   asserted_by  the actor, REQUIRED for kind='assertion'; the renderer shows
--                assertion-backed claims attributed, never as neutral fact
--
-- citation_hits: minimal citation tracker (spec Part 14 #10) — AI-crawler
-- fetches of public pages, logged by path + bot.

PRAGMA defer_foreign_keys = on;

CREATE TABLE briefs_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL,
  layer TEXT NOT NULL DEFAULT 'factual' CHECK (layer IN ('factual', 'interpretive')),
  confidence TEXT CHECK (confidence IN ('low', 'moderate', 'high') OR confidence IS NULL),
  status TEXT NOT NULL DEFAULT 'proposal'
    CHECK (status IN ('proposal', 'building', 'draft', 'published', 'discarded')),
  why_proposed_md TEXT NOT NULL DEFAULT '',
  body_md TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  schema_jsonld TEXT NOT NULL DEFAULT '{}',
  signed_by TEXT,
  signed_at TEXT,
  published_at TEXT,
  build_started_at TEXT,
  build_completed_at TEXT,
  claims_verified INTEGER NOT NULL DEFAULT 0,
  claims_killed INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  generate_model TEXT,
  judge_model TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO briefs_new (
  id, user_id, slug, title, content_type, status, why_proposed_md, body_md,
  body_html, schema_jsonld, signed_by, signed_at, published_at,
  build_started_at, build_completed_at, claims_verified, claims_killed,
  cost_cents, generate_model, judge_model, created_at, updated_at
)
SELECT
  id, user_id, slug, title, content_type, status, why_proposed_md, body_md,
  body_html, schema_jsonld, signed_by, signed_at, published_at,
  build_started_at, build_completed_at, claims_verified, claims_killed,
  cost_cents, generate_model, judge_model, created_at, updated_at
FROM briefs;

DROP TABLE briefs;
ALTER TABLE briefs_new RENAME TO briefs;

CREATE UNIQUE INDEX briefs_user_slug_idx ON briefs (user_id, slug);
CREATE INDEX briefs_user_status_idx ON briefs (user_id, status, updated_at DESC);
CREATE INDEX briefs_layer_idx ON briefs (user_id, layer, status);

-- Firewall columns on the claims.
ALTER TABLE brief_claims ADD COLUMN kind TEXT NOT NULL DEFAULT 'fact';
ALTER TABLE brief_claims ADD COLUMN asserted_by TEXT;

-- Citation tracker — AI crawler hits on public pages.
CREATE TABLE citation_hits (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  bot TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX citation_hits_path_idx ON citation_hits (path, created_at DESC);
CREATE INDEX citation_hits_bot_idx ON citation_hits (bot, created_at DESC);
