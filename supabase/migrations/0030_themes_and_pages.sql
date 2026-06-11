-- 0030_themes_and_pages.sql — the fabric primitives.
--
-- Phase 1 adds the two missing pieces that turn lists of facts into
-- something that can carry actual writing:
--
--   1. THEME nodes (a 7th node-kind) — "received accounts the corpus is
--      engaging with." Surfaced when 3+ facts from different documents
--      converge on contradicting the same external assumption. Without
--      this, the system has facts but no orientation; nothing to argue
--      with.
--
--   2. SUBJECT PAGES (`pages` table) — one page per subject (entity, event,
--      or theme), with two viewable modes: NEUTRAL (wiki) and SIGNED
--      (investigation, when the operator has signed a reading). Same data,
--      different rendering. Replaces the bifurcated briefs/factual vs.
--      interpretive split.
--
-- nodes.kind already CHECKs against a 6-value list. SQLite can't ALTER a
-- CHECK; the constraint is dropped here (kind validation now lives in the
-- typed-graph TS layer + a soft CHECK that allows 'theme').

PRAGMA defer_foreign_keys = on;

-- ---------------------------------------------------------------------------
-- 1) Widen nodes.kind to allow 'theme'. Rebuild because CHECK can't be ALTERed.
-- ---------------------------------------------------------------------------
CREATE TABLE nodes_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (
    kind IN ('entity', 'attribute', 'event', 'neutral_fact', 'assertion', 'source', 'theme')
  ),
  label TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  piece_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO nodes_new (id, user_id, kind, label, metadata, piece_id, created_at, updated_at)
SELECT id, user_id, kind, label, metadata, piece_id, created_at, updated_at FROM nodes;
DROP TABLE nodes;
ALTER TABLE nodes_new RENAME TO nodes;
CREATE INDEX nodes_user_kind_idx ON nodes (user_id, kind);
CREATE INDEX nodes_label_idx ON nodes (label);
CREATE INDEX nodes_user_piece_idx ON nodes (user_id, piece_id);

-- ---------------------------------------------------------------------------
-- 2) pages — one row per subject (entity / event / theme). Holds the
--    operator's signed reading when one exists, plus voice/style metadata.
--    The NEUTRAL view is computed on read from the graph; the SIGNED view
--    is body_md + claim_ids.
--
--    subject_node_id points at the underlying node (entity, event, theme).
--    The page lives or dies with its subject.
-- ---------------------------------------------------------------------------
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  -- The signed reading: a thesis sentence + a prose body + the claim ids
  -- that anchor it. NULL means "page exists only in neutral mode."
  thesis TEXT,
  body_md TEXT,
  body_html TEXT,
  -- Lifecycle for the signed reading
  signed_status TEXT NOT NULL DEFAULT 'none'
    CHECK (signed_status IN ('none', 'draft', 'signed', 'published')),
  signed_by TEXT,
  signed_at TEXT,
  confidence TEXT CHECK (confidence IN ('low', 'moderate', 'high') OR confidence IS NULL),
  -- Generation provenance
  generate_model TEXT,
  judge_model TEXT,
  claims_verified INTEGER NOT NULL DEFAULT 0,
  claims_killed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX pages_user_slug_idx ON pages (user_id, slug);
CREATE UNIQUE INDEX pages_subject_idx ON pages (subject_node_id);
CREATE INDEX pages_signed_idx ON pages (user_id, signed_status, updated_at DESC);

-- ---------------------------------------------------------------------------
-- 3) page_claims — the verified facts a signed page rests on. Mirrors
--    brief_claims but keyed by page_id + cites quote_ids from the typed
--    graph directly (no external URLs — sources are stored documents).
-- ---------------------------------------------------------------------------
CREATE TABLE page_claims (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  -- 'fact' or 'assertion' — the firewall distinction
  kind TEXT NOT NULL DEFAULT 'fact' CHECK (kind IN ('fact', 'assertion')),
  -- Required when kind='assertion'; the actor making the claim
  asserted_by TEXT,
  -- Independent-judge gate
  judge_pass INTEGER NOT NULL DEFAULT 0,
  judge_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX page_claims_page_idx ON page_claims (page_id, sort_order);

-- ---------------------------------------------------------------------------
-- 4) themes — additional metadata for kind='theme' nodes that doesn't
--    fit cleanly in node.metadata JSON. The "received account" string is
--    the thing the corpus is pushing against; convergence_count is how many
--    independent documents contributed contradicting evidence.
-- ---------------------------------------------------------------------------
CREATE TABLE themes (
  node_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
  received_account TEXT NOT NULL,
  convergence_count INTEGER NOT NULL DEFAULT 0,
  -- The contradicting / complicating quote ids (JSON array), assembled
  -- deterministically when the theme was surfaced.
  evidence_quote_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- 5) operator_voice — three to four sentences the operator writes once
--    describing how they sound. Drafts use it as register. There's only
--    ever one row per operator.
-- ---------------------------------------------------------------------------
CREATE TABLE operator_voice (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  voice_md TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
