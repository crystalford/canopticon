-- 0036_beats.sql — standing coverage areas (newsroom phase 3).
--
-- A beat is an operator-declared subject worth watching on an ongoing
-- basis, independent of whether it already has a page or is currently
-- "thin" by the autonomous sweep's own detection (graph/lib/autonomous-
-- expand.ts). Beats compete for the SAME sweep slot the thin-subject
-- sniper logic already uses — this adds no new cron trigger and no extra
-- Brave Search spend, it only changes what the existing slot picks.
CREATE TABLE beats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_swept_at TEXT
);
CREATE UNIQUE INDEX beats_user_label_idx ON beats (user_id, label);
