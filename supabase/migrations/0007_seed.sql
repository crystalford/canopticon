-- 0007_seed.sql
-- Seed the single operator and their 18 role_definitions + default cost
-- whitelists. D1 doesn't have an auth.users trigger like Supabase does;
-- the Worker calls `seedOperator()` on first sign-in to populate this.
--
-- This migration is empty by design — it documents that seeding happens
-- programmatically in the Worker (see packages/api/src/lib/seed.ts).
--
-- Wrangler requires at least one statement, so:
SELECT 1;
