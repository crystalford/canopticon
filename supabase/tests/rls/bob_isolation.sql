-- bob_isolation — bob cannot see any of alice's private substrate.
-- bob should see exactly: his own (empty) data, alice's public thesis, the
-- 12 role_definitions seeded for him.

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);

-- Cross-user reads must return zero rows.
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.sources WHERE user_id = ''11111111-1111-1111-1111-111111111111''',
  0, 'bob cannot SELECT alice''s sources'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.ingestion_critic_reports
     WHERE user_id = ''11111111-1111-1111-1111-111111111111''',
  0, 'bob cannot SELECT alice''s critic reports'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.entities WHERE user_id = ''11111111-1111-1111-1111-111111111111''',
  0, 'bob cannot SELECT alice''s entities'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.claims WHERE user_id = ''11111111-1111-1111-1111-111111111111''',
  0, 'bob cannot SELECT alice''s claims'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.claim_versions
     WHERE user_id = ''11111111-1111-1111-1111-111111111111''',
  0, 'bob cannot SELECT alice''s claim_versions'
);

-- Public thesis: bob CAN see alice's is_public=TRUE thesis.
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.theses
     WHERE id = ''aaaa6666-0000-0000-0000-000000000002''',
  1, 'bob CAN SELECT alice''s public thesis (theses_public_read policy)'
);

-- Private thesis: bob cannot.
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.theses
     WHERE id = ''aaaa6666-0000-0000-0000-000000000001''',
  0, 'bob cannot SELECT alice''s private thesis'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.questions WHERE user_id = ''11111111-1111-1111-1111-111111111111''',
  0, 'bob cannot SELECT alice''s questions'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.cost_ledger WHERE user_id = ''11111111-1111-1111-1111-111111111111''',
  0, 'bob cannot SELECT alice''s cost_ledger rows'
);

-- bob can read role_definitions globally (his own and alice's).
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.role_definitions',
  24, 'bob can SELECT all role_definitions across users (12 alice + 12 bob)'
);

-- bob writing into alice's user_id must be denied (WITH CHECK).
SELECT test_helpers.assert_write_denied(
  'INSERT INTO public.sources (user_id, source_type, title, admiralty_grade, ingestion_mode)
   VALUES (''11111111-1111-1111-1111-111111111111'', ''hansard'', ''Bob impostor'', ''A'', ''operator'')',
  'bob cannot INSERT a source spoofing alice''s user_id'
);

-- bob CAN INSERT into his own user_id.
INSERT INTO public.sources (user_id, source_type, title, admiralty_grade, ingestion_mode)
VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  'hansard', 'Bob source', 'B', 'operator'
);

ROLLBACK;

\echo 'bob_isolation: OK'
