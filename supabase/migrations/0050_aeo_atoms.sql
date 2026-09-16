-- 0050_aeo_atoms.sql — the citable atoms a research document yields.
--
-- The existing typed graph (0026/0027) extracts a knowledge-graph ontology:
-- entities, events, neutral_facts, assertions, and edges between them. That
-- grows a graph. It is not what answer engines cite.
--
-- Commissioned research found the evidence sits elsewhere. GEO (Aggarwal et
-- al., KDD 2024) measured "Statistics Addition", "Cite Sources" and "Quotation
-- Addition" as the top three of nine tactics; retrieval is passage-level
-- rather than page-level; and structured data itself moves nothing (Ahrefs
-- tracked 1,885 pages adding JSON-LD against 4,000 controls and found the
-- effect indistinguishable from noise). So what matters is the SHAPE of what
-- gets published, and these three tables are that shape.
--
-- Every row here points at a `quotes` row, which means every published atom
-- already carries a span machine-verified as a literal substring of the stored
-- source, with its offset. Nothing new needs verifying; the firewall from
-- digestion-typed.ts is reused as-is.
--
-- The existing graph is left completely alone. It still feeds /t/ timelines
-- and /q/ receipts, and 13,075 nodes and 6,137 verified quotes already exist
-- across 50 documents.

-- ---------------------------------------------------------------------------
-- findings — a figure, what it measures, when, and who reported it.
-- The strongest-evidenced primitive, and the one the verification layer was
-- already built for.
CREATE TABLE aeo_findings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  piece_id TEXT NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  -- The verified span this finding rests on. Deleting the quote deletes the
  -- finding: an unsourced figure is exactly what this publication must not
  -- put on a page.
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  figure TEXT NOT NULL,
  measures TEXT NOT NULL,
  period TEXT,
  attributed_to TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX findings_piece_idx ON aeo_findings(user_id, piece_id);

-- ---------------------------------------------------------------------------
-- questions — one row per distinct question, NOT one per document.
--
-- `question_norm` is the merge key: lowercased, punctuation and filler
-- stripped. A second document asking the same thing attaches its evidence to
-- the existing row instead of creating a second page.
--
-- That matters for a specific reason. Google's generative-retrieval patents
-- include domain diversity, meaning a site's own pages compete with each other
-- rather than compounding — so N near-duplicate pages is worse than one page
-- with N sources. Merging is what makes the corpus get stronger as documents
-- are added rather than more diluted.
CREATE TABLE aeo_questions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_norm TEXT NOT NULL,
  slug TEXT NOT NULL,
  -- Nothing publishes itself. 'proposed' has no URL and appears in no
  -- sitemap; the operator promotes it after seeing what came out.
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'published', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX questions_user_norm_idx ON aeo_questions(user_id, question_norm);
CREATE UNIQUE INDEX questions_user_slug_idx ON aeo_questions(user_id, slug);
CREATE INDEX questions_user_status_idx ON aeo_questions(user_id, status);

-- ---------------------------------------------------------------------------
-- question_evidence — the answers, each one a verified span from a document.
-- Several documents can answer the same question; that is the point.
CREATE TABLE aeo_question_evidence (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES aeo_questions(id) ON DELETE CASCADE,
  piece_id TEXT NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX question_evidence_q_idx ON aeo_question_evidence(user_id, question_id);
CREATE INDEX question_evidence_piece_idx ON aeo_question_evidence(user_id, piece_id);
-- One document answers a given question once.
CREATE UNIQUE INDEX question_evidence_unique_idx
  ON aeo_question_evidence(question_id, piece_id, quote_id);
