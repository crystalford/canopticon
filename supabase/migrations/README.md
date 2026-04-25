# Supabase migrations

Migration order from `canopticon-schema-v1.0.md` §18. The numbers are sticky;
once a migration is applied to production it must not be edited or
renumbered. Add follow-up migrations instead.

| File | Status |
|---|---|
| `0001_extensions.sql` | applied to scaffold |
| `0002_enums.sql` | applied to scaffold |
| `0003_users.sql` | pending |
| `0004_cost_ledger.sql` | pending |
| `0005_sources.sql` | pending |
| `0006_entities.sql` | pending |
| `0007_claims.sql` | pending |
| `0008_theses.sql` | pending |
| `0009_role_runtime.sql` | pending |
| `0010_rls_policies.sql` | pending |
| `0011_triggers.sql` | pending |
| `0012_seed_role_definitions.sql` | pending |
| `0013_workflow_runs.sql` | pending |

After each migration adds public.* tables, the RLS test matrix in
`canopticon-schema-v1.0.md` §21 must be extended in the same PR. CI will
fail if a public table is missing from the matrix.
