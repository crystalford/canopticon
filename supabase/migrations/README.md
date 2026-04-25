# Supabase migrations

Migration order from `canopticon-schema-v1.0.md` §18. The numbers are sticky;
once a migration is applied to production it must not be edited or
renumbered. Add follow-up migrations instead.

| File | What it creates |
|---|---|
| `0001_extensions.sql` | uuid-ossp, pgcrypto, pg_trgm, btree_gin, vector |
| `0002_enums.sql` | Sprint 1 enums (mirrors `packages/shared/src/constants/enums.ts`) |
| `0003_users.sql` | `public.users` (mirrors `auth.users`) |
| `0004_cost_ledger.sql` | `cost_ledger`, `cost_whitelists` |
| `0005_sources.sql` | `sources`, `ingestion_critic_reports`, `ingestion_actions` |
| `0006_entities.sql` | `entities`, `entity_mentions` |
| `0007_claims.sql` | `claims`, `claim_versions`, `claim_entities`, `claim_sources` |
| `0008_theses.sql` | `theses`, `thesis_versions`, `thesis_claims`, `thesis_watch_sets`, `thesis_concept_spine`, `thesis_inbox` |
| `0009_role_runtime.sql` | `role_definitions`, `role_invocations`, `orchestrator_events`, `cascade_runs` |
| `0010_rls_policies.sql` | RLS enabled + per-table policies for the tables above |
| `0011_triggers.sql` | `set_updated_at`, `enforce_single_current_*_version`, `emit_orchestrator_event` |
| `0012_seed_role_definitions.sql` | `seed_role_definitions_for_user()` + auto-trigger on `public.users` insert |
| `0013_workflow_runs.sql` | `workflow_runs` (+ RLS) |
| `0014_questions.sql` | `questions` (+ RLS, triggers) |
| `0015_research_runs.sql` | `research_runs` (AI research missions; + RLS, triggers) |

After each migration adds public.* tables, the RLS test matrix in
`canopticon-schema-v1.0.md` §21 must be extended in the same PR. CI will
fail if a public table is missing from the matrix.
