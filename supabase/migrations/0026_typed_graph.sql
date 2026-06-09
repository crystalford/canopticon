-- 0026_typed_graph.sql — Typed data model per canonical spec v2.4 Part 4.
--
-- This migration is ADDITIVE. It creates empty tables that no code populates
-- yet. The extraction rewrite (next PR) is what wires runDigestJob to emit
-- the typed graph into these tables, and what supersedes the old flat
-- claims/claim_versions rows. Per spec Part 19: nothing auto-deletes; old
-- data is superseded, not migrated; re-extraction from R2 is the migration
-- path.
--
-- Schema rationale: the graph is properly TYPED. Facts have KINDS; links have
-- TYPES; contested assertions are stored DISTINCTLY from neutral facts (the
-- fact/interpretation firewall, spec Part 5 + Part 10 #5). Solo-dev D1
-- implementation per spec Part 4 last subsection.

-- ---------------------------------------------------------------------------
-- nodes — the 6 kinds (Entity/Actor, Attribute, Event, NeutralFact,
-- Assertion, Source/Document). `kind` is the discriminator (single-table
-- inheritance). `label` is the canonical display name; `metadata` is JSON
-- for kind-specific data the EAV node_props doesn't cover cleanly.
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (
    kind IN ('entity', 'attribute', 'event', 'neutral_fact', 'assertion', 'source')
  ),
  label TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX nodes_user_kind_idx ON nodes (user_id, kind);
CREATE INDEX nodes_label_idx ON nodes (label);

-- ---------------------------------------------------------------------------
-- node_props — EAV for attributes/qualifiers/time-bounded properties. Per
-- spec: `Attribute` nodes carry stable properties; this table is the
-- generalized property store for any node-kind. `valid_from`/`valid_to`
-- bound a property in time (for time-varying ownership, roles, etc.).
CREATE TABLE node_props (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  valid_from TEXT,
  valid_to TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX node_props_node_idx ON node_props (node_id);
CREATE INDEX node_props_node_key_idx ON node_props (node_id, key);

-- ---------------------------------------------------------------------------
-- edges — the 6 edge-families (Aboutness, Relationship, Temporal, Causal,
-- Evidential, Attribution) per spec Part 4. `family` is the constraint;
-- `edge_type` is the specific type within a family (e.g. family='relationship'
-- with edge_type='owns'). `valid_from`/`valid_to` bound a relationship in
-- time. `weight` is the deterministic evidence-balance contribution (used by
-- the surfacing engine Level 1, spec Part 17).
CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  src_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  dst_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL,
  family TEXT NOT NULL CHECK (
    family IN ('aboutness', 'relationship', 'temporal', 'causal', 'evidential', 'attribution')
  ),
  valid_from TEXT,
  valid_to TEXT,
  weight REAL NOT NULL DEFAULT 1.0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX edges_user_family_idx ON edges (user_id, family);
CREATE INDEX edges_src_idx ON edges (src_node_id);
CREATE INDEX edges_dst_idx ON edges (dst_node_id);
CREATE INDEX edges_family_type_idx ON edges (family, edge_type);

-- ---------------------------------------------------------------------------
-- quotes — verbatim quote tied to a Source node + the node it supports.
-- Provenance is unbroken end to end (spec hard constraint Part 10 #4 +
-- Part 10 #6). The byte-offset/length pin the quote to the original document
-- bytes in R2; the verbatim-substring check (spec Part 8) re-validates this
-- on every Output publish.
CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  verbatim_text TEXT NOT NULL,
  byte_offset INTEGER,
  byte_length INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX quotes_source_idx ON quotes (source_id);
CREATE INDEX quotes_node_idx ON quotes (node_id);

-- ---------------------------------------------------------------------------
-- assertions — the central fix per spec Part 4: contested/attributed
-- assertions stored DISTINCTLY from neutral facts. `node_id` references the
-- assertion-kind node; `asserted_by_node_id` is the actor (Entity-kind node)
-- making the assertion. `stance` and `rank` are spec-Part-4 vocabulary
-- (Wikidata-rank-inspired). `evidence_balance` is the computed score from
-- supporting vs. contradicting evidential edges; both-sides-nontrivial
-- renders the assertion as gray (contested, never silently a fact —
-- spec firewall Part 5 + Part 10 #5).
CREATE TABLE assertions (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  asserted_by_node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
  stance TEXT NOT NULL DEFAULT 'neutral' CHECK (stance IN ('pro', 'critical', 'neutral')),
  rank TEXT NOT NULL DEFAULT 'normal'
    CHECK (rank IN ('preferred', 'normal', 'deprecated', 'contested')),
  evidence_balance REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX assertions_node_idx ON assertions (node_id);
CREATE INDEX assertions_actor_idx ON assertions (asserted_by_node_id);

-- ---------------------------------------------------------------------------
-- inquiry_threads — open questions / unfinished directions per spec Part 6.
-- First-class objects so the inquiry resumes across sessions instead of
-- restarting. `related_node_ids` is a JSON array of node ids the thread is
-- attached to (entities, assertions). Fed as an INPUT to the proposer
-- (spec Part 7) and resurfaced in Synthesis / Chat (spec Part 9).
CREATE TABLE inquiry_threads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'being_pursued', 'resolved', 'dropped')),
  related_node_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_resurfaced_at TEXT
);
CREATE INDEX inquiry_threads_user_status_idx ON inquiry_threads (user_id, status);
