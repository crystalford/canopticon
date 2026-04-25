#!/usr/bin/env bash
# RLS test matrix runner.
# See canopticon-schema-v1.0.md §21 for the matrix specification.
#
# Usage:
#   ./runner.sh                                           # against local Supabase (port 54322)
#   PGURI=<conn-string> ./runner.sh                       # against any Postgres
#   PGURI=... LOCAL_VALIDATION=1 ./runner.sh              # also seed the auth stub + grants
#
# Exits non-zero on any matrix failure.

set -euo pipefail

PGURI="${PGURI:-postgresql://postgres:postgres@localhost:54322/postgres}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PSQL=(psql -v ON_ERROR_STOP=1 -X -q "$PGURI")

echo "RLS matrix → $PGURI"

# In Supabase environments (local stack via `supabase start` or hosted), the
# auth schema, auth.uid(), authenticated/anon roles, and public-schema grants
# already exist. For raw-Postgres validation, set LOCAL_VALIDATION=1 to seed
# the same prerequisites this runner expects.
if [[ "${LOCAL_VALIDATION:-0}" == "1" ]]; then
  echo "LOCAL_VALIDATION=1 → seeding auth stub + grants"
  "${PSQL[@]}" <<'SQL'
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  instance_id UUID,
  aud TEXT, role TEXT, email TEXT, encrypted_password TEXT,
  raw_app_meta_data JSONB, raw_user_meta_data JSONB,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  email_confirmed_at TIMESTAMPTZ,
  confirmation_token TEXT, recovery_token TEXT,
  email_change_token_new TEXT, email_change TEXT
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid;
$$ LANGUAGE sql STABLE;
DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $do$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
SQL
fi

# Helpers + fixtures (run as the postgres role; bypasses RLS).
"${PSQL[@]}" -c "CREATE SCHEMA IF NOT EXISTS test_helpers;"
"${PSQL[@]}" -f "$HERE/_helpers.sql"
"${PSQL[@]}" -f "$HERE/fixtures.sql"

# Each matrix file BEGIN/ROLLBACKs around its assertions and prints `<name>: OK`.
for matrix_file in alice_owner.sql bob_isolation.sql anon_public_read.sql anon_no_write.sql; do
  "${PSQL[@]}" -f "$HERE/$matrix_file"
done

# Cleanup the fixture rows so this script can be re-run without state leak.
"${PSQL[@]}" <<'SQL'
DELETE FROM public.users WHERE id IN (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);
DELETE FROM auth.users WHERE id IN (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);
SQL

echo
echo "RLS matrix: ALL GREEN"
