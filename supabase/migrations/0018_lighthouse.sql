-- Lighthouse — patterns, gaps, timeline.
-- The synthesis layer from PROBE spec §6.5. The corpus, worked-with:
-- patterns are signed insights that emerge across documents (no single
-- document contains them); gaps are the operator's open questions
-- about what's missing; the timeline ties the corpus into chronology.
--
-- All three uphold:
--   - operator-signed (no auto-publishing)
--   - constituent documents linked
--   - disconfirming evidence shown alongside
--   - chain-collapsed counting (one chain counts as one investigation,
--     not as N documents) — implemented in graph/lib/lighthouse.ts

CREATE TABLE patterns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL
    CHECK (kind IN ('recurring-actor','frame','contradiction','rules-for-thee','measurement','net-zero','other')),
  title TEXT NOT NULL,
  statement_md TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium'
    CHECK (confidence IN ('low','medium','high')),
  signed_by TEXT,
  signed_at TEXT,
  disconfirming_md TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate','signed','dismissed')),
  dismissal_reason TEXT,
  notes_md TEXT,
  date_range_from TEXT,
  date_range_to TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX patterns_user_slug_idx ON patterns (user_id, slug);
CREATE INDEX patterns_user_status_idx ON patterns (user_id, status, updated_at DESC);

-- The pieces this pattern rests on (the lighthouse beams).
CREATE TABLE pattern_pieces (
  pattern_id TEXT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
  piece_id TEXT NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight REAL NOT NULL DEFAULT 1.0,
  PRIMARY KEY (pattern_id, piece_id)
);
CREATE INDEX pattern_pieces_piece_idx ON pattern_pieces (piece_id);

-- Entities the pattern speaks about. Used for entity-page "Patterns
-- the corpus shows about X" surface (per handoff doc, P4).
CREATE TABLE pattern_entities (
  pattern_id TEXT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (pattern_id, entity_id)
);
CREATE INDEX pattern_entities_entity_idx ON pattern_entities (entity_id);

-- Topics the pattern surfaces in. A pattern can live on a topic page
-- via this join, separately from the topic_pieces join.
CREATE TABLE pattern_topics (
  pattern_id TEXT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (pattern_id, topic_id)
);

-- Gaps — what we have on a subject vs what we lack. Honest negative
-- knowledge. Each gap names a subject (entity or topic), the evidence
-- bands that already exist, what's missing, and the operator's next
-- step. Spec §6.5.
CREATE TABLE gaps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('entity','topic','corpus')),
  subject_id TEXT,
  what_we_have_md TEXT NOT NULL DEFAULT '',
  what_we_lack_md TEXT NOT NULL DEFAULT '',
  suggested_next_step_md TEXT NOT NULL DEFAULT '',
  signed_by TEXT,
  signed_at TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','partially-filled','filled','obsolete')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX gaps_user_slug_idx ON gaps (user_id, slug);
CREATE INDEX gaps_user_status_idx ON gaps (user_id, status);

-- Timeline events — a corpus-spanning chronology. Each event ties to
-- pieces and entities. Spec §6.5 ("the lighthouse light cast across
-- time"). Operator-curated; pieces can also contribute events
-- automatically via the dual-nature pipeline if they have a date.
CREATE TABLE timeline_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_date TEXT NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT,
  related_piece_ids TEXT NOT NULL DEFAULT '[]',
  related_entity_ids TEXT NOT NULL DEFAULT '[]',
  significance TEXT NOT NULL DEFAULT 'context'
    CHECK (significance IN ('major','context')),
  signed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX timeline_events_user_date_idx
  ON timeline_events (user_id, event_date DESC);
