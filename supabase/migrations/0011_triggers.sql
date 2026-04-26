-- Migration 0011 — Triggers
-- See canopticon-schema-v1.0.md §17.
--
-- Three trigger families:
--   1. set_updated_at — bumps updated_at on every UPDATE
--   2. enforce_single_current_*_version — ensures at most one version is_current per parent
--   3. emit_orchestrator_event — fires noun.verb_past_tense events on substrate writes

-- 17.1 — Update timestamps -----------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_cost_whitelists_updated_at
  BEFORE UPDATE ON public.cost_whitelists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_sources_updated_at
  BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_entities_updated_at
  BEFORE UPDATE ON public.entities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_claims_updated_at
  BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_theses_updated_at
  BEFORE UPDATE ON public.theses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_role_definitions_updated_at
  BEFORE UPDATE ON public.role_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 17.2 — Single is_current per parent ------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_single_current_claim_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = TRUE THEN
    UPDATE public.claim_versions
    SET is_current = FALSE
    WHERE claim_id = NEW.claim_id
      AND id != NEW.id
      AND is_current = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_claim_versions_single_current
  AFTER INSERT OR UPDATE OF is_current ON public.claim_versions
  FOR EACH ROW WHEN (NEW.is_current = TRUE)
  EXECUTE FUNCTION public.enforce_single_current_claim_version();

CREATE OR REPLACE FUNCTION public.enforce_single_current_thesis_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = TRUE THEN
    UPDATE public.thesis_versions
    SET is_current = FALSE
    WHERE thesis_id = NEW.thesis_id
      AND id != NEW.id
      AND is_current = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_thesis_versions_single_current
  AFTER INSERT OR UPDATE OF is_current ON public.thesis_versions
  FOR EACH ROW WHEN (NEW.is_current = TRUE)
  EXECUTE FUNCTION public.enforce_single_current_thesis_version();

-- 17.3 — Auto-emit orchestrator events on substrate writes ---------------
--
-- Event type uses noun.verb_past_tense (matches packages/shared/src/types/events.ts).
-- We map TG_TABLE_NAME to a stable noun slug, then concatenate '.created' or
-- '.updated' based on TG_OP. For now we only emit on tables the orchestrator
-- subscribes to in Sprint 1 (sources, claims, theses); other tables can opt
-- in later.

CREATE OR REPLACE FUNCTION public.emit_orchestrator_event()
RETURNS TRIGGER AS $$
DECLARE
  noun TEXT;
  verb TEXT;
BEGIN
  noun := CASE TG_TABLE_NAME
    WHEN 'sources' THEN 'source'
    WHEN 'claims' THEN 'claim'
    WHEN 'theses' THEN 'thesis'
    WHEN 'questions' THEN 'question'
    ELSE TG_TABLE_NAME
  END;
  verb := CASE TG_OP
    WHEN 'INSERT' THEN 'created'
    WHEN 'UPDATE' THEN 'updated'
    ELSE LOWER(TG_OP)
  END;

  INSERT INTO public.orchestrator_events
    (user_id, event_type, entity_id, entity_type_str, payload)
  VALUES (
    NEW.user_id,
    noun || '.' || verb,
    NEW.id,
    noun,
    jsonb_build_object('op', TG_OP)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sources_event
  AFTER INSERT OR UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.emit_orchestrator_event();

CREATE TRIGGER trg_claims_event
  AFTER INSERT OR UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.emit_orchestrator_event();

CREATE TRIGGER trg_theses_event
  AFTER INSERT OR UPDATE ON public.theses
  FOR EACH ROW EXECUTE FUNCTION public.emit_orchestrator_event();

-- questions table gets its event trigger inside 0014 (table created there).
