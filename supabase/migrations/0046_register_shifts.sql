-- 0046_register_shifts.sql — memetic content #5 + #6: a register-shift
-- translator (bureaucratese/formal quote -> plain language, same claim,
-- same citation) and a one-line hook (a signed reading's thesis
-- compressed into one punchy sentence), sharing one table and one
-- writer+judge pipeline (graph/lib/register-shift.ts) since a hook is
-- just the translator run in "compress a thesis" mode instead of
-- "plain-language a quote" mode.
--
-- Same trust discipline as self_contradictions: the rewrite never
-- introduces a new claim, an independent judge pass confirms meaning is
-- preserved before a rewrite is ever surfaced, and judge_pass=0 rows are
-- kept (not deleted) so a rejected source isn't re-evaluated every tick.

CREATE TABLE register_shifts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('assertion', 'thesis')),
  source_node_id TEXT NOT NULL,
  subject_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  plain_text TEXT NOT NULL,
  quote_id TEXT,
  piece_title TEXT,
  judge_pass INTEGER NOT NULL DEFAULT 0 CHECK (judge_pass IN (0, 1)),
  judge_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX register_shifts_source_idx
  ON register_shifts (source_node_id, source_kind);
CREATE INDEX register_shifts_subject_idx
  ON register_shifts (subject_node_id, source_kind, judge_pass);
CREATE INDEX register_shifts_user_idx
  ON register_shifts (user_id, source_kind, judge_pass, created_at DESC);
