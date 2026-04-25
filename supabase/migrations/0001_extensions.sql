-- Migration 0001 — Extensions
-- See canopticon-schema-v1.0.md §1.
--
-- pgvector is created here for forward compatibility but no embedding
-- columns are populated until Sprint 3 (entity resolution stage 3).
-- pg_trgm and btree_gin power Sprint 1's search and blocking heuristics.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "vector";
