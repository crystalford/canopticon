-- Test helpers shared across the RLS matrix files.
-- The schema must exist before _helpers.sql is loaded (the runner creates it).
--
-- Pattern used by every matrix file:
--
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims',
--          '{"sub":"<uuid>","role":"authenticated"}', true);
--   SELECT test_helpers.assert_count('SELECT 1 FROM ...', N, 'description');
--   ROLLBACK;
--
-- The functions are SECURITY INVOKER so the dynamic SQL runs in the caller's
-- role context, with RLS applied. authenticated and anon need USAGE on this
-- schema and EXECUTE on the helpers — granted at the bottom of this file.

-- assert_count — fail if a SELECT count differs from expected.
CREATE OR REPLACE FUNCTION test_helpers.assert_count(
  query TEXT,
  expected_count INTEGER,
  description TEXT
)
RETURNS VOID AS $$
DECLARE
  actual INTEGER;
BEGIN
  EXECUTE 'SELECT COUNT(*)::int FROM (' || query || ') AS q' INTO actual;
  IF actual <> expected_count THEN
    RAISE EXCEPTION 'RLS-MATRIX FAILED: % — expected % rows, got %',
      description, expected_count, actual;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- assert_write_denied — fail unless a write either errors or affects zero rows.
CREATE OR REPLACE FUNCTION test_helpers.assert_write_denied(
  stmt TEXT,
  description TEXT
)
RETURNS VOID AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    IF rows_affected > 0 THEN
      RAISE EXCEPTION 'RLS-MATRIX FAILED: % — expected denial, got % rows affected',
        description, rows_affected;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      -- Expected: RLS rejected the write.
      NULL;
  END;
END;
$$ LANGUAGE plpgsql;

GRANT USAGE ON SCHEMA test_helpers TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA test_helpers TO authenticated, anon;
