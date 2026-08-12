-- 0001_core.sql — CANOPTICON STUDIO, Phase 0 storage.
-- Master Spec Part 7.1. Separate database from the Record (canopticon-api);
-- separate migration numbering so the two never collide.
--
-- The IR is stored as an immutable JSON blob per version. Versions are
-- append-only and parented, so reverting is a pointer move rather than a
-- destructive write — and because render artifacts are content-addressed
-- by node hash, reverting is free: the old hashes are still in the cache.

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  current_ir_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE ir_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  ir_json TEXT NOT NULL,
  -- Plain-language note on what changed, shown in the version list.
  change_summary TEXT,
  parent_version INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX ir_versions_project_version_idx ON ir_versions (project_id, version);
CREATE INDEX ir_versions_project_idx ON ir_versions (project_id, version DESC);

-- Frozen AI output + operator uploads. Every asset carries its provenance
-- so the Compile view can state exactly what generated it and from what
-- source text — the reason AI output can be trusted as an INPUT is that
-- it is pinned, hashed, and never silently regenerated.
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('audio','alignment','image','data')),
  r2_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX assets_project_idx ON assets (project_id, kind, created_at DESC);
CREATE INDEX assets_sha_idx ON assets (sha256);

-- Timestamped review notes left in the Preview view.
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id TEXT NOT NULL,
  timestamp_ms INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'note' CHECK (severity IN ('note','issue','blocker')),
  resolved INTEGER NOT NULL DEFAULT 0 CHECK (resolved IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX notes_project_scene_idx ON notes (project_id, scene_id, resolved);

-- Content-addressed render cache, keyed by PER-PRIMITIVE node hash
-- (Atlas Part 7.1 amendment 2 — not per block). A chain whose final
-- color_transform changed reuses the entire upstream particle sim.
-- node_hash is the primary key precisely because it is content-addressed:
-- the same hash from any project version is the same artifact.
CREATE TABLE render_cache (
  node_hash TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  primitive_id TEXT NOT NULL,
  r2_key TEXT,
  determinism TEXT NOT NULL DEFAULT 'L2' CHECK (determinism IN ('L1','L2','L2-GPU')),
  cost_ms_per_frame REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_hit_at TEXT
);
CREATE INDEX render_cache_project_idx ON render_cache (project_id, primitive_id);

-- One row per compile, so the Compile view can show real build history
-- (what recomputed, why, how long, what it cost) rather than a guess.
CREATE TABLE compile_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ir_version INTEGER NOT NULL,
  nodes_total INTEGER NOT NULL DEFAULT 0,
  nodes_recomputed INTEGER NOT NULL DEFAULT 0,
  scenes_touched INTEGER NOT NULL DEFAULT 0,
  wall_ms INTEGER NOT NULL DEFAULT 0,
  tts_calls INTEGER NOT NULL DEFAULT 0,
  report_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX compile_runs_project_idx ON compile_runs (project_id, created_at DESC);
