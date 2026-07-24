-- 0042_research_runs.sql — state for the two-pass on-demand research
-- pipeline (graph/lib/deep-research.ts's researchOnDemand +
-- advanceResearchRun). Pass 1 (operator click, same request) searches,
-- banks sources, and writes a synthesis that ALSO proposes follow-up
-- search queries for what it couldn't cover. Pass 2 (picked up by the
-- existing every-2-minute cron drain, one run per tick — same pattern
-- settle-pipeline.ts uses to avoid chaining multi-round LLM work into
-- one execution, which has broken this app's execution ceiling before)
-- runs those follow-ups and re-synthesizes over the combined source set
-- into the final draft.
CREATE TABLE research_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  angle TEXT,
  status TEXT NOT NULL DEFAULT 'pass1_pending'
    CHECK (status IN ('pass1_pending', 'pass2_pending', 'done', 'failed')),
  pass1_piece_ids TEXT,   -- JSON array, set once pass 1 banks sources
  followup_queries TEXT,  -- JSON array, the writer's own proposed gap-fill searches
  pass2_piece_ids TEXT,   -- JSON array, set once pass 2 banks sources
  final_piece_id TEXT,    -- set once the final synthesis lands (working-material)
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX research_runs_status_idx ON research_runs (status, created_at);
CREATE INDEX research_runs_user_idx ON research_runs (user_id, created_at DESC);
