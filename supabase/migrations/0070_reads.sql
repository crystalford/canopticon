-- READ IT: ONE WHOLE READ OF ONE DOCUMENT, AND WHAT IT FOUND.
--
-- docs/read-it.md. The author presses Read it; Claude reads the document
-- once, whole, and lays out what is in it as cards — key figures, findings
-- with their role, questions answered and raised, the document's thesis,
-- predictions, caveats, coined names, open problems, possible articles. The
-- document's own structure (Key Findings, Caveats, Sources, question
-- headings) is taken first, with no model (origin 'shape').
--
-- `reads` is the receipt: what was read of what is held, how many proposed
-- passages were found word for word and how many were dropped (always
-- shown), what it cost. `derivations` is one row per card; every one rests on
-- a span of the document's own text, located in code. Nothing here is public
-- until the author keeps cards and presses "Show on the page" (reads.shown_at).
-- `read_ignores` holds what was dismissed: it never comes back on a re-read.
CREATE TABLE IF NOT EXISTS reads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  draft_id TEXT,
  status TEXT NOT NULL DEFAULT 'reading',
  model TEXT,
  chars_held INTEGER NOT NULL DEFAULT 0,
  chars_read INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  dropped INTEGER NOT NULL DEFAULT 0,
  cents REAL NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  shown_at TEXT
);
CREATE INDEX IF NOT EXISTS reads_doc ON reads (user_id, doc_id, started_at DESC);

CREATE TABLE IF NOT EXISTS derivations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  read_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'read',
  role TEXT,
  span TEXT NOT NULL,
  section TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'proposed',
  tool_use_id TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS derivations_read ON derivations (read_id, created_at);
CREATE INDEX IF NOT EXISTS derivations_doc ON derivations (user_id, doc_id, status);

CREATE TABLE IF NOT EXISTS read_ignores (
  user_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, doc_id, kind, key)
);
