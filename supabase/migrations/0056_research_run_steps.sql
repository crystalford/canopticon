-- Research runs: one model-heavy step per execution.
--
-- WHAT WENT WRONG, OBSERVED LIVE
--
--   ✓ Search the web
--   ✓ Fetch and bank sources — 5 banked, fetching 6
--   ✓ Extract verbatim facts — 273 facts
--   ! Write a synthesis — execution stalled — try again
--
-- deep-research.ts's own header says two passes exist because "chaining
-- search -> synthesize -> search-again -> synthesize-again into ONE execution
-- silently exceeds Cloudflare's execution ceiling", confirmed live across four
-- modules. The principle was right and the split was in the wrong place: pass
-- 1 still ran expandRecord (six page fetches and 273 extracted facts) AND a
-- synthesis over up to twelve sources in a single execution, and pass 2 ran
-- two more expands plus another synthesis in one more. Both were over the
-- ceiling; only the join between them was not.
--
-- So the states below break every model-heavy step onto its own execution:
--
--   pass1_pending        expand is in flight (the only genuinely running state)
--   synth_pending        sources banked; the first synthesis is due
--   pass2_pending        follow-up searches queued; ONE runs per advance
--   pass2_synth_pending  follow-up sources banked; the final synthesis is due
--   done / failed        terminal
--
-- followup_queries becomes the REMAINING queries: each advance pops one, so
-- the count visibly counts down and no execution ever runs two expands.
--
-- SQLite cannot alter a CHECK constraint, so this is the standard rebuild —
-- the same shape migration 0030 used for nodes.

CREATE TABLE research_runs_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  angle TEXT,
  status TEXT NOT NULL DEFAULT 'pass1_pending'
    CHECK (status IN (
      'pass1_pending',
      'synth_pending',
      'pass2_pending',
      'pass2_synth_pending',
      'done',
      'failed'
    )),
  pass1_piece_ids TEXT,   -- JSON array, set once the first expand banks sources
  followup_queries TEXT,  -- JSON array, the writer's proposed searches STILL TO RUN
  pass2_piece_ids TEXT,   -- JSON array, appended to as each follow-up banks
  final_piece_id TEXT,    -- set once the final synthesis lands (working-material)
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Existing rows carry over unchanged. Every old status is still legal, so
-- nothing needs remapping: a historical pass2_pending row means exactly what
-- it did before (follow-ups queued), and the drain now takes them one at a
-- time instead of all at once.
INSERT INTO research_runs_new
  (id, user_id, label, angle, status, pass1_piece_ids, followup_queries,
   pass2_piece_ids, final_piece_id, error, created_at, updated_at)
SELECT
   id, user_id, label, angle, status, pass1_piece_ids, followup_queries,
   pass2_piece_ids, final_piece_id, error, created_at, updated_at
  FROM research_runs;

DROP TABLE research_runs;
ALTER TABLE research_runs_new RENAME TO research_runs;

CREATE INDEX research_runs_status_idx ON research_runs (status, created_at);
CREATE INDEX research_runs_user_idx ON research_runs (user_id, created_at DESC);
