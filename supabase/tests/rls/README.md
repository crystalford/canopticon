# RLS test matrix

Implements `canopticon-schema-v1.0.md` §21 — the deny-by-default proof matrix
for Sprint 1 tables. Three principals (alice, bob, anon) exercise every
public.* table with explicit ✓/✗ outcomes.

## Layout

```
fixtures.sql          # creates alice, bob, and seed rows owned by alice
alice_owner.sql       # alice can read/write her own rows
alice_cross.sql       # alice cannot reach into other users' rows
bob_isolation.sql     # bob sees nothing of alice's; bob can write his own
anon_public_read.sql  # anon reads only is_public rows and pub_*_cache
anon_no_write.sql     # anon writes are uniformly denied
runner.sh             # invokes psql -v ON_ERROR_STOP=1 against test DB
```

## Running locally

```bash
supabase db reset                  # apply all migrations to a fresh DB
./supabase/tests/rls/runner.sh     # exits non-zero on any matrix failure
```

## CI gate

Required for:
- Any PR that touches `migrations/0010_rls_policies.sql` or earlier table-creating migrations.
- The `api.canopticon.com` deploy pipeline as a smoke test before flipping DNS.

Files land as the corresponding tables come online (currently pending
migrations 0003–0009 plus 0010 RLS policies).
