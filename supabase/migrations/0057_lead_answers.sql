-- Answers to leads: one narrow question, answered small enough to check.
--
-- WHY THIS IS NOT ANOTHER research_runs ROW
--
-- "Dig here" fired the full deep-research pipeline at a question one sentence
-- wide: a broad web search, twelve sources read to twelve percent each, and a
-- three-thousand-word brief. For "this $1.2B figure has no source named
-- anywhere in the corpus — who reported it?" that is the wrong instrument, and
-- the output is something the operator has to TRUST rather than check.
--
-- The operator's own words on why the built-in research goes unused: "I do not
-- trust the results built in our own system." A brief is untrustable by
-- construction — it is too long to verify and every sentence is the model's.
-- A lead answer is the opposite bet: two or three sentences, every supporting
-- quote located verbatim in a stored document by locateVerbatim, and anything
-- that fails that check thrown away and counted. You do not have to trust it,
-- because you can read the whole thing and follow every quote in half a minute.
--
-- A CONTRADICTION NEEDS NO SEARCH
--
-- The sharpest lead kind — two documents that disagree — is answerable from
-- material already held, in full, with no web fetch and no third-party page
-- banked. That matters for provenance: nothing enters the corpus to answer it,
-- so there is no new population to guard (see CLAUDE.md on record-expand).
--
-- LEADS ARE COMPUTED, NOT STORED, so an answer cannot carry a foreign key to
-- one. lead_key is sha-256 of kind + seed: stable while the lead is the same
-- lead, and naturally gone when the underlying contradiction is resolved.

CREATE TABLE lead_answers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- sha256(kind || '\n' || seed). Leads are derived from queries over the
  -- graph and have no id of their own.
  lead_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  seed TEXT NOT NULL,
  angle TEXT,
  -- The document the lead came out of, for rendering it back in place.
  piece_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'answered', 'nothing_found', 'failed')),
  -- Two or three sentences. Deliberately not a document.
  answer_md TEXT,
  -- JSON array of {text, piece_id, slug, title, quote_id}. Every entry has
  -- already passed locateVerbatim against the stored source; a proposed quote
  -- that did not is never written here.
  quotes TEXT,
  -- How many the model proposed that failed the verbatim check. Shown, not
  -- hidden: a high count is the operator's signal that the answer is shaky.
  discarded INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One answer per lead: a second dig replaces the first rather than stacking.
CREATE UNIQUE INDEX lead_answers_key_idx ON lead_answers (user_id, lead_key);
CREATE INDEX lead_answers_piece_idx ON lead_answers (user_id, piece_id);
