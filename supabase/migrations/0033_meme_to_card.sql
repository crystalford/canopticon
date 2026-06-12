-- 0033_meme_to_card.sql — rename the "meme" face to "card" (spec v2.6).
--
-- Why: socially, "meme" reads as image; in code "meme face" was the styled
-- text-card template. The mismatch was tripping people. v2.6 renames the
-- face to "card" — descriptive, no image-vs-text ambiguity. The
-- production step (Cloudflare Browser Rendering → PNG) is what turns the
-- card into a shareable image asset; that lives in Studio (Part 27).
--
-- SQLite can't alter a column-level CHECK in place, so this migration
-- rebuilds page_faces with the new constraint and re-maps existing rows.

PRAGMA foreign_keys = OFF;

CREATE TABLE page_faces_new (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- v2.6 face kinds:
  --   thread  — thesis + the four most cutting facts, one per post
  --   script  — locked reasoning skeleton for a 3–4 minute video
  --   card    — one shareable image: thesis on top, the most damning
  --             fact below, receipt URL in the corner (was "meme")
  --   chapter — the reading's structure expanded for long-form treatment
  kind TEXT NOT NULL CHECK (kind IN ('thread', 'script', 'card', 'chapter')),
  body_md TEXT,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'rendering', 'ready', 'failed')),
  generate_model TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO page_faces_new (
  id, page_id, user_id, kind, body_md, body_html,
  status, generate_model, error, created_at, updated_at
)
SELECT
  id, page_id, user_id,
  CASE WHEN kind = 'meme' THEN 'card' ELSE kind END,
  body_md, body_html,
  status, generate_model, error, created_at, updated_at
FROM page_faces;

DROP TABLE page_faces;
ALTER TABLE page_faces_new RENAME TO page_faces;

CREATE UNIQUE INDEX page_faces_page_kind_idx ON page_faces (page_id, kind);
CREATE INDEX page_faces_status_idx ON page_faces (user_id, status, updated_at DESC);

PRAGMA foreign_keys = ON;
