-- RLS test fixtures.
-- Run as the postgres superuser before any matrix file. Idempotent.
--
-- Creates two test users (alice, bob) in auth.users + public.users with
-- stable UUIDs, then seeds alice's substrate so the matrix files can
-- assert what bob and anon should and should not see.

CREATE SCHEMA IF NOT EXISTS test_helpers;

-- Stable UUIDs for the principals. Hard-coded so the matrix assertions can
-- reference them without lookups.
--   alice  = 11111111-1111-1111-1111-111111111111
--   bob    = 22222222-2222-2222-2222-222222222222

-- Cleanup any prior run (idempotent).
DELETE FROM public.users WHERE id IN (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);
DELETE FROM auth.users WHERE id IN (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);

-- Seed auth.users. Most fields take Supabase's column defaults; we only
-- supply what's structurally required.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  email_confirmed_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'alice@test.local', '',
   '{}'::jsonb, '{}'::jsonb, NOW(), NOW(),
   NOW(), '', '', '', ''),
  ('22222222-2222-2222-2222-222222222222'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'bob@test.local', '',
   '{}'::jsonb, '{}'::jsonb, NOW(), NOW(),
   NOW(), '', '', '', '');

-- Seed public.users. The trg_users_seed_roles trigger from 0012 will
-- automatically populate role_definitions for both users.
INSERT INTO public.users (id, email, display_name, monthly_ceiling_cents)
VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 'alice@test.local', 'Alice', 5000),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'bob@test.local',   'Bob',   5000);

-- Seed alice's substrate.
-- We use stable UUIDs for the seeded rows so matrix assertions can target them.

-- Source: alice owns this. Used as the primary_source_id for the seed claim.
INSERT INTO public.sources (
  id, user_id, source_type, title, publication, admiralty_grade,
  ingestion_mode, ingestion_state, raw_text, slug
) VALUES (
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'hansard', 'Test Hansard fragment', 'openparliament.ca', 'A',
  'automatic', 'approved',
  'The Member for Test stated that the policy was implemented in 2014.',
  'test-hansard-fragment'
);

-- Critic report on alice's source.
INSERT INTO public.ingestion_critic_reports (
  id, user_id, source_id, proposed_grade, bias_assessment,
  compatibility_check, reasoning
) VALUES (
  'aaaa2222-0000-0000-0000-000000000001'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'A', 'Hansard primary; not applicable.', 'high',
  'Verbatim parliamentary record. Grade A.'
);

-- Entity owned by alice.
INSERT INTO public.entities (
  id, user_id, entity_type, canonical_name, display_name, slug
) VALUES (
  'aaaa3333-0000-0000-0000-000000000001'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'person', 'Test Member', 'Test Member', 'test-member'
);

-- Claim owned by alice (no current_version_id yet — set after version insert).
INSERT INTO public.claims (
  id, user_id, layer, admiralty_grade, slug
) VALUES (
  'aaaa4444-0000-0000-0000-000000000001'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'factual', 'A', 'policy-implemented-2014'
);

-- Claim version (becomes current).
INSERT INTO public.claim_versions (
  id, claim_id, user_id, version_number, is_current,
  data, claim_text, primary_source_id
) VALUES (
  'aaaa5555-0000-0000-0000-000000000001'::uuid,
  'aaaa4444-0000-0000-0000-000000000001'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  1, TRUE,
  'Hansard quote: policy was implemented in 2014.',
  'The policy was implemented in 2014.',
  'aaaa1111-0000-0000-0000-000000000001'::uuid
);

UPDATE public.claims
SET current_version_id = 'aaaa5555-0000-0000-0000-000000000001'::uuid
WHERE id = 'aaaa4444-0000-0000-0000-000000000001'::uuid;

-- Two theses: one private, one public. Bob and anon should see only the public one.
INSERT INTO public.theses (id, user_id, status, title, slug, is_public)
VALUES
  ('aaaa6666-0000-0000-0000-000000000001'::uuid,
   '11111111-1111-1111-1111-111111111111'::uuid,
   'active', 'Alice private thesis', 'alice-private', FALSE),
  ('aaaa6666-0000-0000-0000-000000000002'::uuid,
   '11111111-1111-1111-1111-111111111111'::uuid,
   'active', 'Alice public thesis',  'alice-public',  TRUE);

-- A question against alice's public thesis.
INSERT INTO public.questions (
  id, user_id, thesis_id, text, rationale, evidence_targets,
  expected_information_gain, generated_by
) VALUES (
  'aaaa7777-0000-0000-0000-000000000001'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'aaaa6666-0000-0000-0000-000000000002'::uuid,
  'When was the policy first proposed?',
  'Predates the implementation date by an unknown interval.',
  '["Hansard 2013-2014", "OIC records"]'::jsonb,
  0.6, 'interrogator'
);

-- Cost ledger entry for alice.
INSERT INTO public.cost_ledger (
  id, user_id, operation_type, provider, model_or_sku, cost_cents,
  approved_by_operator
) VALUES (
  'aaaa8888-0000-0000-0000-000000000001'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'anthropic_call', 'anthropic', 'claude-opus-4-7', 30, TRUE
);
