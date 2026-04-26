-- Migration 0012 — Seed role_definitions for new users
-- See canopticon-schema-v1.0.md §11.1 and skills-v1.0.md §16.
--
-- Each new public.users row gets a starter set of role_definitions. The
-- prompt_template column holds the literal string '<see SKILL.md>' as a
-- placeholder; the orchestrator reads the actual prompt from the SKILL.md
-- file at runtime and updates skill_md_hash. This way prompt iteration
-- doesn't require a database migration.
--
-- We seed all twelve skills (eleven analytical roles + claim_extraction
-- utility) so they exist when their cascade step fires. Sprint 1 only
-- exercises four (ingestion_critic, claim_extraction, verifier,
-- interrogator); the others sit inert until their workflows come online.

CREATE OR REPLACE FUNCTION public.seed_role_definitions_for_user(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.role_definitions
    (user_id, name, prompt_template, default_model,
     uses_citations_api, uses_structured_output, output_schema, is_active, notes)
  VALUES
    (target_user_id, 'ingestion_critic',
     '<see packages/shared/skills/ingestion-critic/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, TRUE,
     'Sprint 1 active. Gates incoming sources before substrate writes.'),
    (target_user_id, 'claim_extraction',
     '<see packages/shared/skills/claim-extraction/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, TRUE,
     'Sprint 1 active (utility skill). Cascade STEP 5.'),
    (target_user_id, 'verifier',
     '<see packages/shared/skills/verifier/SKILL.md>',
     'claude-opus-4-7', TRUE, TRUE, NULL, TRUE,
     'Sprint 1 active. Citations-API grounding only; cross-model deferred until first public thesis.'),
    (target_user_id, 'interrogator',
     '<see packages/shared/skills/interrogator/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, TRUE,
     'Sprint 1 active. Generates 3-7 verification questions per cascade.'),
    (target_user_id, 'red_team',
     '<see packages/shared/skills/red-team/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Sprint 2+. Adversarial review of publication-bound claims.'),
    (target_user_id, 'steelman',
     '<see packages/shared/skills/steelman/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Sprint 2+. Strongest case for the opposing position.'),
    (target_user_id, 'premortem',
     '<see packages/shared/skills/premortem/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Sprint 2+. Imagined-failure analysis for predictions.'),
    (target_user_id, 'gap_surfacer',
     '<see packages/shared/skills/gap-surfacer/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Sprint 2+. Seven-stage sweep for missing entities/relations/evidence.'),
    (target_user_id, 'calibration',
     '<see packages/shared/skills/calibration/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Sprint 3+. Brier-tracked calibration narratives. Activates after first resolved prediction.'),
    (target_user_id, 'tier_projector',
     '<see packages/shared/skills/tier-projector/SKILL.md>',
     'claude-opus-4-7', FALSE, FALSE, NULL, FALSE,
     'Activates when first thesis is set is_public=TRUE.'),
    (target_user_id, 'assumption_auditor',
     '<see packages/shared/skills/assumption-auditor/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Sprint 2+. Linchpin assumption review.'),
    (target_user_id, 'indicator_validator',
     '<see packages/shared/skills/indicator-validator/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Sprint 2+. Indicator declaration and observation validation.')
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.seed_role_definitions_for_user(UUID) IS
  'Seeds the twelve role_definitions rows for a user. Idempotent. Called by the auth signup hook after creating a public.users row.';

-- Trigger: when a public.users row is inserted (via the signup hook in the
-- API), seed their role_definitions automatically.

CREATE OR REPLACE FUNCTION public.seed_roles_on_user_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.seed_role_definitions_for_user(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_seed_roles
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.seed_roles_on_user_insert();
