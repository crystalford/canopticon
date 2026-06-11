-- 0031_page_faces.sql — faces of a signed reading (spec v2.5 Part 24).
--
-- The premise: a signed reading IS the thread, IS the script, IS the meme.
-- They aren't products manufactured FROM it; they're faces of one object.
-- The moment the operator clicks Sign & Publish, the system queues all face
-- renders as background jobs. By the time the operator wants to share
-- something, it's already rendered.
--
-- There are NO generate buttons. There is NO Studio destination. Studio as a
-- nav item dies with this migration: faces appear as tabs on the signed
-- reading view itself.

CREATE TABLE page_faces (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The four faces (spec Part 24):
  --   thread  — thesis + the four most cutting facts, one per post
  --   script  — locked reasoning skeleton (BEAT 1 / BEAT 2 / …) for a video
  --   meme    — thesis over the single most damning fact, receipt in corner
  --   chapter — the reading's structure expanded for long-form treatment
  kind TEXT NOT NULL CHECK (kind IN ('thread', 'script', 'meme', 'chapter')),
  -- Generated content as markdown. body_html is optional pre-rendered HTML.
  body_md TEXT,
  body_html TEXT,
  -- Lifecycle. queued → rendering → ready, or failed.
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'rendering', 'ready', 'failed')),
  generate_model TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One row per (page, kind) — re-renders overwrite the same row.
CREATE UNIQUE INDEX page_faces_page_kind_idx ON page_faces (page_id, kind);
-- For the operator's queue view: which faces are still queued/rendering.
CREATE INDEX page_faces_status_idx ON page_faces (user_id, status, updated_at DESC);
