-- 0041_page_profiles.sql — comprehensive narrative profiles.
--
-- A profile is NOT the signed reading (pages.thesis/body_md — one
-- argumentative thesis, requires operator sign-off) and NOT the Profile
-- Arrangement's old infobox-only rendering (structured attributes,
-- template+query, no LLM). It's the missing middle: a comprehensive,
-- low-advocacy narrative synthesis of ALL established facts for a
-- subject — closer to what a Wikipedia article's body actually is.
-- Decoupled into its own table (not another column on `pages`) because
-- `pages` has a hard one-reading-per-subject constraint
-- (pages_subject_idx, unique on subject_node_id) that's specific to the
-- argumentative reading's lifecycle — a profile needs to exist and
-- regenerate independently of whether a signed reading exists at all.
--
-- Same trust discipline as pages.body_md: citations go through
-- applyCitationMarkers (draft-reading.ts), claims go through the same
-- independent-judge gate as everything else. claims_verified/killed
-- mirror pages' columns for the same reason: detecting "has the fact
-- base grown enough since the last generation to be worth redoing."
CREATE TABLE page_profiles (
  id TEXT PRIMARY KEY,
  subject_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body_md TEXT,
  body_html TEXT,
  claims_verified INTEGER NOT NULL DEFAULT 0,
  claims_killed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'none'
    CHECK (status IN ('none', 'generating', 'ready', 'failed')),
  generate_model TEXT,
  judge_model TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX page_profiles_subject_idx ON page_profiles (subject_node_id);
CREATE INDEX page_profiles_status_idx ON page_profiles (user_id, status, updated_at DESC);

-- The claims a profile actually rests on — mirrors page_claims exactly
-- (same shape, same purpose: the receipt trail), keyed by profile_id
-- instead of page_id since a profile can exist without a signed page.
CREATE TABLE page_profile_claims (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES page_profiles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'fact' CHECK (kind IN ('fact', 'assertion')),
  asserted_by TEXT,
  judge_pass INTEGER NOT NULL DEFAULT 0,
  judge_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX page_profile_claims_profile_idx ON page_profile_claims (profile_id, sort_order);
