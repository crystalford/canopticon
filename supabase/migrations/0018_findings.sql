-- Migration 0018 — Findings substrate + novelty_surfacer role.
--
-- A finding is a structural claim about novelty: "this combination of
-- claims, when read together, surfaces something the public record has
-- not previously named." Findings sit between claims (single facts) and
-- theses (full Toulmin arguments). They are the credibility-bearing
-- output of the substrate — the "this is genuinely new" call.
--
-- novelty_grade taxonomy:
--   incremental  — refines an established frame; useful but not
--                   surprising to a domain expert.
--   notable      — names a structural pattern the operator believes
--                   is underreported but not previously hidden.
--   breakthrough — the substrate reveals something the public record
--                   has not previously named. Highest bar; requires
--                   linchpin claims and operator confirmation.
--
-- Findings are owner-only by default; flipping is_public=TRUE exposes
-- them on the public site under /p/findings (added in this migration's
-- public-read policy).

-- novelty_surfacer enters the role_name enum.
ALTER TYPE role_name ADD VALUE IF NOT EXISTS 'novelty_surfacer';

CREATE TYPE novelty_grade AS ENUM ('incremental', 'notable', 'breakthrough');
CREATE TYPE finding_status AS ENUM ('draft', 'confirmed', 'public', 'retracted');
CREATE TYPE pattern_type AS ENUM (
  'recurring_actor',
  'transaction_chain',
  'mechanism_overlap',
  'structural_homology',
  'negative_space',
  'conflict_of_interest',
  'temporal_correlation',
  'jurisdictional_arbitrage',
  'other'
);

CREATE TABLE public.findings (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id                       UUID REFERENCES public.theses(id) ON DELETE SET NULL,
  title                           TEXT NOT NULL,
  slug                            TEXT NOT NULL,
  narrative                       TEXT NOT NULL,
  novelty_grade                   novelty_grade NOT NULL DEFAULT 'incremental',
  pattern_type                    pattern_type NOT NULL DEFAULT 'other',
  confidence                      NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  status                          finding_status NOT NULL DEFAULT 'draft',
  is_public                       BOOLEAN NOT NULL DEFAULT FALSE,
  surfaced_by                     TEXT NOT NULL DEFAULT 'operator',
  surfaced_by_role_invocation_id  UUID,
  confirmed_at                    TIMESTAMPTZ,
  published_at                    TIMESTAMPTZ,
  retracted_at                    TIMESTAMPTZ,
  retraction_note                 TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_findings_user_status ON public.findings (user_id, status, created_at DESC);
CREATE INDEX idx_findings_thesis ON public.findings (thesis_id) WHERE thesis_id IS NOT NULL;
CREATE INDEX idx_findings_public ON public.findings (user_id) WHERE is_public = TRUE;
CREATE INDEX idx_findings_grade ON public.findings (user_id, novelty_grade);
CREATE INDEX idx_findings_pattern ON public.findings (user_id, pattern_type);

ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY findings_owner_all ON public.findings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY findings_public_read ON public.findings
  FOR SELECT USING (is_public = TRUE AND status IN ('public', 'retracted'));

CREATE TRIGGER trg_findings_updated_at
  BEFORE UPDATE ON public.findings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 18.2 finding_supporting_claims ------------------------------------------

CREATE TABLE public.finding_supporting_claims (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  finding_id      UUID NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
  claim_id        UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  is_linchpin     BOOLEAN NOT NULL DEFAULT FALSE,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (finding_id, claim_id)
);

CREATE INDEX idx_finding_supporting_finding ON public.finding_supporting_claims (finding_id);
CREATE INDEX idx_finding_supporting_claim ON public.finding_supporting_claims (claim_id);

ALTER TABLE public.finding_supporting_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY finding_supporting_owner_all ON public.finding_supporting_claims
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 18.3 seed novelty_surfacer role for existing users ---------------------

INSERT INTO public.role_definitions
  (user_id, name, prompt_template, default_model,
   uses_citations_api, uses_structured_output, output_schema, is_active, notes)
SELECT
  u.id,
  'novelty_surfacer'::role_name,
  '<see packages/shared/skills/novelty-surfacer/SKILL.md>',
  'claude-opus-4-7',
  FALSE, TRUE, NULL, FALSE,
  'Surfaces breakthrough/novelty findings from a thesis''s claim graph.'
FROM public.users u
ON CONFLICT (user_id, name) DO NOTHING;

-- 18.4 update seed function so new users get the role ---------------------

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
     'Sprint 1 active. Citations-API grounding only.'),
    (target_user_id, 'interrogator',
     '<see packages/shared/skills/interrogator/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, TRUE,
     'Sprint 1 active. Generates 3-7 verification questions per cascade.'),
    (target_user_id, 'red_team',
     '<see packages/shared/skills/red-team/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Activates on first publication-gate.'),
    (target_user_id, 'steelman',
     '<see packages/shared/skills/steelman/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Activates on first publication-gate.'),
    (target_user_id, 'premortem',
     '<see packages/shared/skills/premortem/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Activates on first prediction declaration.'),
    (target_user_id, 'gap_surfacer',
     '<see packages/shared/skills/gap-surfacer/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Seven-stage sweep for missing entities/relations/evidence.'),
    (target_user_id, 'calibration',
     '<see packages/shared/skills/calibration/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Brier-tracked calibration narratives. Activates on first resolved prediction.'),
    (target_user_id, 'tier_projector',
     '<see packages/shared/skills/tier-projector/SKILL.md>',
     'claude-opus-4-7', FALSE, FALSE, NULL, FALSE,
     'Activates when first thesis is set is_public=TRUE.'),
    (target_user_id, 'assumption_auditor',
     '<see packages/shared/skills/assumption-auditor/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Activates on first assumption-audit invocation.'),
    (target_user_id, 'indicator_validator',
     '<see packages/shared/skills/indicator-validator/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Activates on first indicator declaration.'),
    (target_user_id, 'novelty_surfacer',
     '<see packages/shared/skills/novelty-surfacer/SKILL.md>',
     'claude-opus-4-7', FALSE, TRUE, NULL, FALSE,
     'Surfaces breakthrough findings from a thesis''s claim graph.')
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
