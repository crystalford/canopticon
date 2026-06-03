-- Claim provenance — separate "where it's asserted" (internal piece)
-- from "what evidences it" (external sources).
--
-- The hard invariant from PROBE spec §2.5: evidenced_by may only point
-- to external Source Records. An internal CANOPTICON piece may never
-- be evidence for a claim. The CMS/chat tools enforce this at the
-- executor layer too (defence in depth); the column-level guarantee
-- is that this list is structurally separate from the asserted_in
-- pointer.
--
-- Two new columns on the existing claims table:
--   - asserted_in_piece_id: internal Piece that states/organizes the
--     claim. Attribution ("argued in this piece").
--   - evidenced_by_source_ids: JSON array of external source ids that
--     ground the fact. Storage as JSON keeps the relationship list-
--     shaped without needing a join table (and we already use JSON
--     arrays elsewhere — entities.aliases, posts.tags).

ALTER TABLE claims ADD COLUMN asserted_in_piece_id TEXT
  REFERENCES pieces(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN evidenced_by_source_ids TEXT NOT NULL DEFAULT '[]';

CREATE INDEX claims_asserted_in_idx
  ON claims (asserted_in_piece_id) WHERE asserted_in_piece_id IS NOT NULL;

-- claim_sources (the legacy join table) stays in place during
-- transition. New code writes evidenced_by_source_ids instead. The
-- legacy table is dropped in a later migration once nothing reads it.
