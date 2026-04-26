-- Migration 0010 — Row-Level Security policies
-- See canopticon-schema-v1.0.md §15 and §21 (RLS test matrix).
--
-- DENY-BY-DEFAULT IS THE INVARIANT. Every public.* table has RLS enabled,
-- and every policy explicitly scopes to the owning user_id. The matrix at
-- supabase/tests/rls/ proves alice/bob/anon isolation in CI before any
-- public deploy can ship.
--
-- The pattern:
--   - `<table>_owner_all`   FOR ALL USING/WITH CHECK (user_id = auth.uid())
--   - `<table>_public_read` FOR SELECT USING (is_public = TRUE)
--                                                          [where applicable]
-- The anon key (Supabase's PostgREST anon role) sees ONLY rows where a
-- public policy is satisfied. Authenticated users see only their own rows
-- plus public rows.

-- Owner-table policies (no public-read variant):

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self_read ON public.users
  FOR SELECT USING (id = auth.uid());
CREATE POLICY users_self_update ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
-- INSERT into public.users is performed by the signup hook with the
-- service-role key; no policy needed for the anon path.

ALTER TABLE public.cost_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY cost_ledger_owner_all ON public.cost_ledger
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.cost_whitelists ENABLE ROW LEVEL SECURITY;
CREATE POLICY cost_whitelists_owner_all ON public.cost_whitelists
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY sources_owner_all ON public.sources
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.ingestion_critic_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY ingestion_critic_reports_owner_all ON public.ingestion_critic_reports
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.ingestion_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ingestion_actions_owner_all ON public.ingestion_actions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY entities_owner_all ON public.entities
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.entity_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY entity_mentions_owner_all ON public.entity_mentions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY claims_owner_all ON public.claims
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.claim_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY claim_versions_owner_all ON public.claim_versions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.claim_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY claim_entities_owner_all ON public.claim_entities
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.claim_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY claim_sources_owner_all ON public.claim_sources
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Theses get a public-read variant for is_public=TRUE.
ALTER TABLE public.theses ENABLE ROW LEVEL SECURITY;
CREATE POLICY theses_owner_all ON public.theses
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY theses_public_read ON public.theses
  FOR SELECT USING (is_public = TRUE);

ALTER TABLE public.thesis_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY thesis_versions_owner_all ON public.thesis_versions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- thesis_versions is exposed publicly only via the pub_*_cache materializations,
-- not directly. No public_read policy here.

ALTER TABLE public.thesis_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY thesis_claims_owner_all ON public.thesis_claims
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.thesis_watch_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY thesis_watch_sets_owner_all ON public.thesis_watch_sets
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.thesis_concept_spine ENABLE ROW LEVEL SECURITY;
CREATE POLICY thesis_concept_spine_owner_all ON public.thesis_concept_spine
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.thesis_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY thesis_inbox_owner_all ON public.thesis_inbox
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- role_definitions: every authenticated user can SELECT (so the orchestrator
-- can fetch role prompts), but writes are owner-scoped (ops customize their
-- own prompts).
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_definitions_authenticated_read ON public.role_definitions
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY role_definitions_owner_write ON public.role_definitions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY role_definitions_owner_update ON public.role_definitions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY role_definitions_owner_delete ON public.role_definitions
  FOR DELETE USING (user_id = auth.uid());

ALTER TABLE public.role_invocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_invocations_owner_all ON public.role_invocations
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.orchestrator_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY orchestrator_events_owner_all ON public.orchestrator_events
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.cascade_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY cascade_runs_owner_all ON public.cascade_runs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- workflow_runs and questions are created in 0013 and 0014 respectively.
-- Their RLS policies ship with their own migrations so the table-and-policy
-- pair is atomic in the migration history.
