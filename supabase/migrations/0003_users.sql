-- Migration 0003 — Users
-- See canopticon-schema-v1.0.md §3.1.
--
-- Supabase manages auth.users; we shadow the relevant fields in public.users
-- for FK referencing and add CANOPTICON-specific fields (publication handle,
-- monthly cost ceiling).

CREATE TABLE public.users (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT UNIQUE NOT NULL,
  display_name          TEXT,
  publication_handle    TEXT UNIQUE,
  monthly_ceiling_cents INTEGER NOT NULL DEFAULT 5000,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS
  'CANOPTICON users. One row per authenticated operator. Mirrors auth.users with platform-specific fields.';
COMMENT ON COLUMN public.users.monthly_ceiling_cents IS
  'Hard ceiling on paid operations per month. Operations auto-block at this value. Default $50.';
