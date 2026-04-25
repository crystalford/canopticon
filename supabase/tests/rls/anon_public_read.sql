-- anon_public_read — the anon (unauthenticated) role reads only public rows.
-- Public-readable in Sprint 1: theses where is_public=TRUE.
-- Everything else returns zero rows under anon.

BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

-- The single public thesis is visible.
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.theses WHERE is_public = TRUE',
  1, 'anon can SELECT public theses'
);

SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.theses
     WHERE id = ''aaaa6666-0000-0000-0000-000000000002''',
  1, 'anon CAN SELECT alice''s public thesis by id'
);

-- The private thesis is invisible.
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.theses
     WHERE id = ''aaaa6666-0000-0000-0000-000000000001''',
  0, 'anon cannot SELECT alice''s private thesis'
);

-- Owner-scoped tables: zero rows under anon.
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.users', 0, 'anon cannot SELECT public.users'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.sources', 0, 'anon cannot SELECT sources'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.ingestion_critic_reports', 0,
  'anon cannot SELECT ingestion_critic_reports'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.entities', 0, 'anon cannot SELECT entities'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.entity_mentions', 0, 'anon cannot SELECT entity_mentions'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.claims', 0, 'anon cannot SELECT claims'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.claim_versions', 0, 'anon cannot SELECT claim_versions'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.thesis_versions', 0, 'anon cannot SELECT thesis_versions'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.questions', 0, 'anon cannot SELECT questions'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.cost_ledger', 0, 'anon cannot SELECT cost_ledger'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.cost_whitelists', 0, 'anon cannot SELECT cost_whitelists'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.role_invocations', 0, 'anon cannot SELECT role_invocations'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.orchestrator_events', 0, 'anon cannot SELECT orchestrator_events'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.cascade_runs', 0, 'anon cannot SELECT cascade_runs'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.workflow_runs', 0, 'anon cannot SELECT workflow_runs'
);
SELECT test_helpers.assert_count(
  'SELECT 1 FROM public.role_definitions', 0,
  'anon cannot SELECT role_definitions (authenticated-only read)'
);

ROLLBACK;

\echo 'anon_public_read: OK'
