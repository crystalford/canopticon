-- alice_owner — alice can read and write her own substrate.
-- Run after fixtures.sql + _helpers.sql have loaded.

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.users WHERE id = ''11111111-1111-1111-1111-111111111111''',
  1, 'alice can SELECT her own users row'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.sources WHERE id = ''aaaa1111-0000-0000-0000-000000000001''',
  1, 'alice can SELECT her own source'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.ingestion_critic_reports
     WHERE source_id = ''aaaa1111-0000-0000-0000-000000000001''',
  1, 'alice can SELECT critic report on her source'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.entities WHERE id = ''aaaa3333-0000-0000-0000-000000000001''',
  1, 'alice can SELECT her entity'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.claims WHERE id = ''aaaa4444-0000-0000-0000-000000000001''',
  1, 'alice can SELECT her claim'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.claim_versions
     WHERE claim_id = ''aaaa4444-0000-0000-0000-000000000001''',
  1, 'alice can SELECT her claim_versions'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.theses WHERE user_id = ''11111111-1111-1111-1111-111111111111''',
  2, 'alice sees both her theses (private + public)'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.questions
     WHERE id = ''aaaa7777-0000-0000-0000-000000000001''',
  1, 'alice can SELECT her question'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.cost_ledger
     WHERE id = ''aaaa8888-0000-0000-0000-000000000001''',
  1, 'alice can SELECT her cost_ledger row'
);

-- alice can SELECT all role_definitions (global-read for authenticated users).
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.role_definitions
     WHERE user_id = ''11111111-1111-1111-1111-111111111111''',
  12, 'alice has all 12 seeded role_definitions (auto-trigger from 0012)'
);

-- alice can INSERT into her own tables.
INSERT INTO public.entities (
  user_id, entity_type, canonical_name, display_name, slug
) VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'organization', 'Alice Test Org', 'Alice Test Org', 'alice-test-org-' || gen_random_uuid()
);

ROLLBACK;

\echo 'alice_owner: OK'
