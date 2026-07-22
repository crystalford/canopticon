-- 0005_voice_profile.sql — operator's trained MiniMax voice clone.
--
-- One row per operator (single-operator system, so always one row).
-- minimax_voice_id is what the editorial brain puts in
-- segment.voice.voice_id, and what the Container's narrator.ts passes
-- to the MiniMax Speech 2.8 HD TTS API per voiced beat.

CREATE TABLE voice_profile (
  user_id TEXT PRIMARY KEY,
  minimax_voice_id TEXT,
  -- JSON manifest of the R2 sample keys + total duration.
  samples_json TEXT,
  -- Operator's notes on tone / register / pace. Free-form.
  characterisation TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
