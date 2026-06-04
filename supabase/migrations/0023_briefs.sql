-- Briefs — the third projection of the graph.
--
-- Per the operator-claude-code-handoff and canopticon-briefs-spec:
-- citable answer-objects with a mechanical verification pipeline as the
-- trust boundary. Sectioned off (own table, own surface) so it doesn't
-- touch the ingest model. Proposal-only — nothing auto-publishes.
--
-- A Brief is a complete authoritative page answering one question
-- ("What is Brookfield?", "Timeline of Canadian carbon pricing"). The
-- spec mandates kind ∈ {definition, comparison, timeline, faq, stat-roundup}
-- for v1 — graph-derived, low-hallucination types. Calculators deferred.

CREATE TABLE briefs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('definition','comparison','timeline','faq','stat-roundup')),
  status TEXT NOT NULL DEFAULT 'proposal'
    CHECK (status IN ('proposal','building','draft','published','discarded')),
  why_proposed_md TEXT NOT NULL DEFAULT '',
  body_md TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  schema_jsonld TEXT NOT NULL DEFAULT '{}',
  signed_by TEXT,
  signed_at TEXT,
  published_at TEXT,
  build_started_at TEXT,
  build_completed_at TEXT,
  -- Build stats — counters from the pipeline run, surfaced in the UI.
  claims_verified INTEGER NOT NULL DEFAULT 0,
  claims_killed INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  -- Audit: the operator can see what model judged each claim.
  generate_model TEXT,
  judge_model TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX briefs_user_slug_idx ON briefs (user_id, slug);
CREATE INDEX briefs_user_status_idx ON briefs (user_id, status, updated_at DESC);

-- Each factual claim in the Brief is stored individually so the
-- verbatim-substring + independent-judge results are auditable.
-- The spec mandates: if source_quote is not a verbatim substring of
-- the fetched source, killed=1 and the claim is dropped from publish.
CREATE TABLE brief_claims (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_quote TEXT NOT NULL,
  source_hash TEXT, -- sha256 of the fetched source text (audit trail)
  source_offset INTEGER, -- byte offset where source_quote starts in the source
  verified INTEGER NOT NULL DEFAULT 0,
  killed INTEGER NOT NULL DEFAULT 0,
  kill_reason TEXT,
  judge_pass INTEGER NOT NULL DEFAULT 0, -- 1 if independent-judge approved
  judge_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX brief_claims_brief_idx ON brief_claims (brief_id, sort_order);

-- Cache of fetched sources keyed by hash. R2 stores the actual bytes
-- (we record the R2 key here for the audit replay). Same source can
-- be referenced by multiple briefs/claims; one fetch, many uses.
CREATE TABLE brief_sources (
  hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  byte_length INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX brief_sources_user_idx ON brief_sources (user_id, fetched_at DESC);
