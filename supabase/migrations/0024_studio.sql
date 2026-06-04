-- Studio Stage 1 — reasoning skeleton + composer + projects.
--
-- The handoff expands Studio from a stub into a full project-based
-- production pipeline (Script → Audio → Video → Export). Stage 1
-- (this migration) covers the reasoning-lock + composer + project
-- persistence. Stages 2–3 (audio, video/export) are deferred per the
-- handoff's explicit recommendation not to block launch on media.

CREATE TABLE studio_skeleton (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The numbered beats of the operator's argument skeleton.
  -- JSON array of { n: number, text: string }.
  beats_json TEXT NOT NULL DEFAULT '[]',
  -- The "Never" list — moves to avoid (e.g. "rely on charts as proof",
  -- "appeal to authority", etc.). JSON array of strings.
  never_json TEXT NOT NULL DEFAULT '[]',
  -- The example pieces the operator dropped to seed the skeleton.
  -- JSON array of { kind, name } pairs (purely informational for the
  -- UI; the operator can clear and reset).
  examples_json TEXT NOT NULL DEFAULT '[]',
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX studio_skeleton_user_idx ON studio_skeleton (user_id);

CREATE TABLE studio_projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skeleton_id TEXT REFERENCES studio_skeleton(id) ON DELETE SET NULL,
  -- The source finding (a patterns row id) the operator used as
  -- generation input. NULL is allowed for hand-written projects.
  source_finding_id TEXT REFERENCES patterns(id) ON DELETE SET NULL,
  -- Project metadata.
  title TEXT NOT NULL,
  medium TEXT NOT NULL
    CHECK (medium IN ('x-thread','tiktok','video-essay','podcast','meme-brief','book-chapter')),
  -- Pipeline stage tracking.
  stage TEXT NOT NULL DEFAULT 'script'
    CHECK (stage IN ('script','audio','video','export','archived')),
  -- The generated beats (JSON array of strings, one per beat).
  beats_json TEXT NOT NULL DEFAULT '[]',
  -- Stage 2 (audio): recordings keyed by beat index. JSON object.
  recordings_json TEXT NOT NULL DEFAULT '{}',
  audio_mode TEXT CHECK (audio_mode IN ('record','ai')),
  -- Stage 3 (video): clip choices + generative flags. JSON objects.
  clips_json TEXT NOT NULL DEFAULT '{}',
  gen_done_json TEXT NOT NULL DEFAULT '{}',
  -- Exported assets (mp3 / mp4). JSON array of {kind, name, duration, ...}.
  assets_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX studio_projects_user_idx ON studio_projects (user_id, updated_at DESC);
CREATE INDEX studio_projects_source_idx ON studio_projects (source_finding_id)
  WHERE source_finding_id IS NOT NULL;
