-- 0008_react_projects.sql — the reaction-video production tool.
--
-- A third, parallel content pipeline alongside the GDELT-clip and
-- reading-sourced ones already feeding `segments` — but deliberately
-- its OWN table family, not another `source_kind` on `segments`. The
-- shape is fundamentally different: no AI voiceover, no forensic_turn,
-- driven entirely by the operator's own on-camera reaction to a source
-- video they picked, recorded through their own camera and mic.
--
-- react_projects: one uploaded/pasted source video -> its timestamped
-- transcript -> a pipeline status walking through scripting, recording,
-- stitching, and (eventually) publishing.
--
-- react_points: the point-by-point breakdown of that transcript. Each
-- point is a candidate moment to react to — a timestamp range, the
-- verbatim transcript snippet for that range (the "quote" this point is
-- anchored to), a suggested angle (fact-check or fallacy-check, judge-
-- checked for coherence — NOT the same rigor as Canopticon's citable-
-- fact firewall; there's no external source to verify real-world
-- accuracy against here, this is a suggestion the operator can accept,
-- edit, or replace with their own take, never something auto-published).
-- cue_mode is switchable per point: 'verbatim' (read a full script) or
-- 'bullets' (terse cue phrases to riff on) — both explicitly requested,
-- not a global setting. Once recorded, reaction_r2_key/duration_ms hold
-- the operator's own camera+mic take for that point.

CREATE TABLE react_projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'transcribing'
    CHECK (status IN (
      'transcribing', 'ready_for_scripting', 'scripting',
      'ready_to_record', 'recording', 'stitching', 'rendered', 'published', 'failed'
    )),
  -- Timestamped WhisperX segment output (see graph/lib transcription
  -- variant, Phase 2) — {segments: [{text, start_s, end_s}, ...]}.
  -- NULL until transcription succeeds.
  transcript_json TEXT,
  source_r2_key TEXT,       -- the fetched source video, cached in R2
  source_duration_s REAL,
  stitched_r2_key TEXT,     -- final rendered reaction video, once stitched
  approved_at TEXT,         -- operator approved the stitched render
  published_at TEXT,        -- SEPARATE gate — rendering succeeding is not
                             -- the same as approved for publication (same
                             -- rule as segments.published_at, migration
                             -- 0006_reading_sourced.sql)
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX react_projects_status_idx ON react_projects (status, created_at DESC);
CREATE INDEX react_projects_published_idx ON react_projects (published_at DESC);

CREATE TABLE react_points (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES react_projects(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  start_s REAL NOT NULL,
  end_s REAL NOT NULL,
  transcript_text TEXT NOT NULL,   -- verbatim snippet this point is anchored to
  summary TEXT NOT NULL,           -- one-line, LLM-suggested
  -- Suggestion only — never auto-published, never treated as a verified
  -- fact. The operator accepts, edits, or replaces it with their own take.
  suggested_angle_kind TEXT
    CHECK (suggested_angle_kind IN ('fact_check', 'fallacy_check', 'none') OR suggested_angle_kind IS NULL),
  suggested_angle_text TEXT,
  angle_judge_pass INTEGER CHECK (angle_judge_pass IN (0, 1) OR angle_judge_pass IS NULL),
  angle_judge_notes TEXT,
  -- The operator's own final script for this point — either the accepted
  -- suggestion, an edited version of it, or something they wrote fresh.
  cue_mode TEXT NOT NULL DEFAULT 'bullets' CHECK (cue_mode IN ('verbatim', 'bullets')),
  cue_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'skipped')),
  -- Cut from the source video once approved (Phase 5).
  clip_r2_key TEXT,
  -- The operator's own camera+mic recording for this point (Phase 6).
  reaction_r2_key TEXT,
  reaction_duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX react_points_project_idx ON react_points (project_id, sort_order);
CREATE INDEX react_points_status_idx ON react_points (project_id, status);
