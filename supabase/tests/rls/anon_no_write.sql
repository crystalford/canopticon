-- anon_no_write — anon writes are denied on every public.* table.
-- This is the deny-by-default proof. A failure here means the public API
-- can be made to write into private substrate, which is a leak.

BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

SELECT test_helpers.assert_write_denied(
  'INSERT INTO public.users (id, email)
   VALUES (gen_random_uuid(), ''anon-impostor@test.local'')',
  'anon cannot INSERT into public.users'
);

SELECT test_helpers.assert_write_denied(
  'INSERT INTO public.sources (user_id, source_type, title, admiralty_grade, ingestion_mode)
   VALUES (''11111111-1111-1111-1111-111111111111'', ''hansard'', ''anon impostor'', ''A'', ''operator'')',
  'anon cannot INSERT into public.sources'
);

SELECT test_helpers.assert_write_denied(
  'INSERT INTO public.entities (user_id, entity_type, canonical_name, display_name)
   VALUES (''11111111-1111-1111-1111-111111111111'', ''person'', ''Anon Entity'', ''Anon Entity'')',
  'anon cannot INSERT into public.entities'
);

SELECT test_helpers.assert_write_denied(
  'INSERT INTO public.claims (user_id, layer, admiralty_grade)
   VALUES (''11111111-1111-1111-1111-111111111111'', ''factual'', ''A'')',
  'anon cannot INSERT into public.claims'
);

SELECT test_helpers.assert_write_denied(
  'INSERT INTO public.theses (user_id, title, slug)
   VALUES (''11111111-1111-1111-1111-111111111111'', ''anon impostor'', ''anon-impostor-' || extract(epoch from now())::text || ''')',
  'anon cannot INSERT into public.theses'
);

SELECT test_helpers.assert_write_denied(
  'INSERT INTO public.questions (user_id, text, generated_by)
   VALUES (''11111111-1111-1111-1111-111111111111'', ''anon question'', ''operator'')',
  'anon cannot INSERT into public.questions'
);

SELECT test_helpers.assert_write_denied(
  'INSERT INTO public.cost_ledger (user_id, operation_type, provider, cost_cents, approved_by_operator)
   VALUES (''11111111-1111-1111-1111-111111111111'', ''anthropic_call'', ''anthropic'', 1, FALSE)',
  'anon cannot INSERT into public.cost_ledger'
);

-- UPDATE: anon cannot flip alice's private thesis to public.
SELECT test_helpers.assert_write_denied(
  'UPDATE public.theses SET is_public = TRUE
   WHERE id = ''aaaa6666-0000-0000-0000-000000000001''',
  'anon cannot UPDATE alice''s private thesis to is_public=TRUE'
);

-- DELETE: anon cannot delete the public thesis either (read-only).
SELECT test_helpers.assert_write_denied(
  'DELETE FROM public.theses WHERE id = ''aaaa6666-0000-0000-0000-000000000002''',
  'anon cannot DELETE alice''s public thesis'
);

ROLLBACK;

\echo 'anon_no_write: OK'
