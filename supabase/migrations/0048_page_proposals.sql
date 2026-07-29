-- 0048_page_proposals.sql — the Proposal layer (fabric redesign Phase 7,
-- see /root/.claude/plans/humming-questing-backus.md).
--
-- Facts (neutral substrate) -> Signed Analysis (interpretive, is/was/means)
-- -> Proposal (prescriptive, should/ought to). A Proposal is a separate
-- signed artifact, not a reading's thesis restated — distinguished from
-- Analysis by grammatical mood, not topic or novelty: does the core claim
-- describe reality or prescribe action.
--
-- New tables, not a new nodes.kind (a Proposal is a page-level artifact
-- with prose + lifecycle + signature, not a graph primitive other nodes
-- need to link to) and not a column on `pages` (pages has a hard
-- one-per-subject UNIQUE(subject_node_id) — a subject can plausibly
-- warrant several independent proposals over time, the opposite
-- cardinality need). Mirrors page_profiles/page_profile_claims'
-- established shape (0041_page_profiles.sql).
CREATE TABLE page_proposals (
  id TEXT PRIMARY KEY,
  subject_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  thesis TEXT,              -- the prescriptive "should" statement
  body_md TEXT,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'none'
    CHECK (status IN ('none','draft','signed','published')),
  signed_by TEXT,
  signed_at TEXT,
  confidence TEXT CHECK (confidence IN ('low','moderate','high') OR confidence IS NULL),
  generate_model TEXT,
  judge_model TEXT,
  claims_verified INTEGER NOT NULL DEFAULT 0,
  claims_killed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX page_proposals_user_slug_idx ON page_proposals (user_id, slug);
CREATE INDEX page_proposals_subject_idx ON page_proposals (subject_node_id, status, updated_at DESC);
-- deliberately NO unique index on subject_node_id — many proposals per subject allowed

-- The claims a proposal rests on — mirrors page_claims/page_profile_claims,
-- but a Proposal claim can cite EITHER a verbatim quote directly OR a claim
-- already verified on the subject's Signed Analysis (source_page_claim_id),
-- since a Proposal is explicitly built to argue FROM an existing Analysis
-- when one exists, not to re-derive everything from raw quotes.
CREATE TABLE page_proposal_claims (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES page_proposals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  quote_id TEXT REFERENCES quotes(id) ON DELETE CASCADE,
  source_page_claim_id TEXT REFERENCES page_claims(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'fact' CHECK (kind IN ('fact','assertion')),
  asserted_by TEXT,
  judge_pass INTEGER NOT NULL DEFAULT 0,
  judge_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (quote_id IS NOT NULL OR source_page_claim_id IS NOT NULL)
);
CREATE INDEX page_proposal_claims_proposal_idx ON page_proposal_claims (proposal_id, sort_order);
