-- ONE PIPELINE, ONE STATUS PER DOCUMENT.
--
-- Processing a document used to be five separate passes with five separate
-- triggers: text extract (automatic), typed-graph digestion (automatic for
-- two chunks, then re-queued for a cron that is switched off), findings and
-- questions (a per-document button), the lead passage (a button, then a
-- second Approve button), and the section (a bulk button). On the live site
-- almost nothing was fully processed, and the page — whose whole point is the
-- receipts, the findings, the passage and the links — rendered without them.
--
-- This table is the state machine that replaces all of that
-- (docs/the-record.md §4). One row per document. One step per request at
-- POST /op/process/advance; the library page presses it while it is open.
-- The browser is the scheduler — attended by construction, nothing when idle
-- (standing rule 4). Nothing here schedules anything.
--
-- `step` is where the document is:  title → digest → findings → passage →
-- section → done. `status` is whether that step is waiting, running, finished
-- or failed. A failed row keeps its step so Retry resumes there, not from the
-- start. `chunks_done` / `chunk_count` are digestion's checkpoint.
--
-- digest_jobs is left in place and unread by the operator surface; legacy
-- tables are never dropped (CLAUDE.md).
CREATE TABLE IF NOT EXISTS piece_processing (
  piece_id     TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued',   -- queued | running | done | failed
  step         TEXT NOT NULL DEFAULT 'title',    -- title | digest | findings | passage | section | done
  chunks_done  INTEGER NOT NULL DEFAULT 0,
  chunk_count  INTEGER NOT NULL DEFAULT 0,
  error        TEXT,
  model        TEXT,                              -- what read the document, as named by the router
  attempts     INTEGER NOT NULL DEFAULT 0,
  heartbeat_at TEXT,
  started_at   TEXT,
  finished_at  TEXT,
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS piece_processing_user_status_idx
  ON piece_processing (user_id, status, updated_at);

-- A title the pipeline replaced. `original_title` (0055) keeps what the
-- document arrived with; this says the machine, not a person, chose the
-- current one, so the row can offer a one-click revert. title_approved_at
-- stays NULL for these: a person has not chosen.
ALTER TABLE pieces ADD COLUMN title_auto_at TEXT;
