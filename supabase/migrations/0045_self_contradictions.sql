-- 0045_self_contradictions.sql — memetic content #3: a new ANALYSIS
-- capability, not just a new template. Finds pairs of assertions BY THE
-- SAME PERSON, about the same subject, that genuinely contradict each
-- other — not "contested by someone else" (assertions.rank already
-- covers that), but contradicted by their OWN earlier or later record.
--
-- Same trust discipline as everything else that touches judgment calls
-- in this codebase: the two quotes are already verbatim (they're real
-- quotes rows, same as page_claims/page_profile_claims), and the
-- "these genuinely conflict" call gets its own independent judge pass
-- before a pair is ever surfaced — judge_pass=0 rows are kept (not
-- deleted) so a rejected candidate doesn't get re-evaluated every tick.

CREATE TABLE self_contradictions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  person_label TEXT NOT NULL,
  tension_summary TEXT NOT NULL,
  assertion_a_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  quote_a_id TEXT,
  quote_a_text TEXT NOT NULL,
  piece_a_title TEXT,
  assertion_b_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  quote_b_id TEXT,
  quote_b_text TEXT NOT NULL,
  piece_b_title TEXT,
  judge_pass INTEGER NOT NULL DEFAULT 0 CHECK (judge_pass IN (0, 1)),
  judge_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX self_contradictions_person_idx
  ON self_contradictions (person_node_id, judge_pass);
CREATE INDEX self_contradictions_user_idx
  ON self_contradictions (user_id, judge_pass, created_at DESC);
-- Dedup against re-detecting the same pair every tick is handled in
-- application logic (graph/lib/self-contradictions.ts checks both node-id
-- orderings before inserting) rather than a functional unique index, to
-- keep this migration to plain, unexotic SQLite.
CREATE INDEX self_contradictions_assertion_a_idx
  ON self_contradictions (assertion_a_node_id);
CREATE INDEX self_contradictions_assertion_b_idx
  ON self_contradictions (assertion_b_node_id);
