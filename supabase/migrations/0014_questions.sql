-- Migration 0014 — Questions
-- See canopticon-schema-v1.0.md §12.1 and skills-v1.0.md §3 (Interrogator).
--
-- Sprint 1 round-trip contract: the Interrogator's structured output produces
-- text, expected_information_gain, rationale, evidence_targets[]. All four
-- round-trip into this table without loss. Question→claim and
-- question→question edges (schema-v1.0 §12.2, §12.3) are deferred to v1.1.

CREATE TABLE public.questions (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id                       UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  text                            TEXT NOT NULL,
  rationale                       TEXT,
  evidence_targets                JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_information_gain       NUMERIC(3,2)
                                  CHECK (expected_information_gain IS NULL OR
                                         (expected_information_gain >= 0 AND
                                          expected_information_gain <= 1)),
  status                          question_status NOT NULL DEFAULT 'open',
  generated_by                    TEXT NOT NULL,
  generated_by_role_invocation_id UUID,
  parent_question_id              UUID REFERENCES public.questions(id),
  answer_claim_id                 UUID REFERENCES public.claims(id),
  answered_at                     TIMESTAMPTZ,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_user_status
  ON public.questions (user_id, status);
CREATE INDEX idx_questions_thesis
  ON public.questions (thesis_id) WHERE thesis_id IS NOT NULL;
CREATE INDEX idx_questions_eig
  ON public.questions (user_id, expected_information_gain DESC) WHERE status = 'open';

COMMENT ON TABLE public.questions IS
  'Question Graph. Sprint 1 stores questions as a tree (parent_question_id); v1.1 promotes to a many-to-many graph via question_claims and question_dependencies edge tables.';
COMMENT ON COLUMN public.questions.evidence_targets IS
  'Array of strings: where to look for an answer (e.g., "SEDAR+ filings 2017-2019"). Stringly-typed in v1.0; v1.1 promotes to first-class question_claims edges.';

-- updated_at trigger
CREATE TRIGGER trg_questions_updated_at
  BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Event-emit trigger (questions noun is registered in 0011's event function)
CREATE TRIGGER trg_questions_event
  AFTER INSERT OR UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.emit_orchestrator_event();

-- RLS
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY questions_owner_all ON public.questions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
