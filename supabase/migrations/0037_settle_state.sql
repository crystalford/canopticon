-- 0037_settle_state.sql — makes the corpus-settle pipeline resumable.
--
-- entity_resolution -> surfacing_l1 -> theme_surfacer -> autoseed_pages ->
-- propose_briefs -> draft_readings used to run as one chained sequence per
-- trigger. Confirmed live (twice) that chaining real LLM-calling steps in
-- one execution context reliably exceeds Cloudflare's aggregate wall-clock
-- budget with no catchable error. settle_state tracks which step runs
-- next so each trigger advances exactly one step (graph/lib/settle-
-- pipeline.ts), and draft_readings — last in the cycle, the one that
-- actually produces signed readings — gets its own turn instead of dying
-- behind five other steps every time.
CREATE TABLE settle_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  next_step TEXT NOT NULL DEFAULT 'entity_resolution',
  last_advanced_at TEXT
);
