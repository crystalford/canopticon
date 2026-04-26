-- Migration 0008 — Theses + versions + claims + watch_sets + concept_spine + inbox
-- See canopticon-schema-v1.0.md §7.

CREATE TABLE public.theses (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_version_id  UUID,
  status              thesis_status NOT NULL DEFAULT 'declared',
  title               TEXT NOT NULL,
  slug                TEXT NOT NULL,
  declared_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cynefin_domain      TEXT
                      CHECK (cynefin_domain IS NULL OR cynefin_domain IN
                             ('clear', 'complicated', 'complex', 'chaotic', 'disorder')),
  is_public           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_theses_user_status
  ON public.theses (user_id, status);
CREATE INDEX idx_theses_public
  ON public.theses (user_id, is_public) WHERE is_public = TRUE;

COMMENT ON TABLE public.theses IS
  'Top-level investigations. Living documents that evolve over months.';
COMMENT ON COLUMN public.theses.cynefin_domain IS
  'Discretionary integration of Cynefin (methodology-canon top-12 #6). Drives role-prompt branching when set; null leaves the cascade defaults.';

CREATE TABLE public.thesis_versions (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thesis_id                       UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  user_id                         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version_number                  INTEGER NOT NULL CHECK (version_number > 0),
  is_current                      BOOLEAN NOT NULL DEFAULT FALSE,
  seed_paragraph                  TEXT NOT NULL,
  bluf                            TEXT,
  tier_80                         TEXT,
  tier_800                        TEXT,
  tier_full                       TEXT,
  ipcc_likelihood                 ipcc_likelihood,
  written_by_role                 role_name,
  written_by_role_invocation_id   UUID,
  change_summary                  TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (thesis_id, version_number)
);

CREATE INDEX idx_thesis_versions_current
  ON public.thesis_versions (thesis_id) WHERE is_current = TRUE;

ALTER TABLE public.theses
  ADD CONSTRAINT fk_theses_current_version
  FOREIGN KEY (current_version_id) REFERENCES public.thesis_versions(id);

COMMENT ON TABLE public.thesis_versions IS
  'Append-only history of thesis content. Tier projections regenerate on each version.';

CREATE TABLE public.thesis_claims (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id   UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  claim_id    UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  layer       claim_layer NOT NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at  TIMESTAMPTZ,
  UNIQUE (thesis_id, claim_id, layer)
);

CREATE INDEX idx_thesis_claims_thesis
  ON public.thesis_claims (thesis_id, layer);
CREATE INDEX idx_thesis_claims_claim
  ON public.thesis_claims (claim_id);

COMMENT ON TABLE public.thesis_claims IS
  'Claims integrated into a thesis at a specific layer. removed_at allows soft-removal.';

CREATE TYPE watch_pin_type AS ENUM ('pinned', 'tracked', 'derived', 'excluded');

CREATE TABLE public.thesis_watch_sets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id       UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  entity_id       UUID REFERENCES public.entities(id) ON DELETE CASCADE,
  exclusion_term  TEXT,
  pin_type        watch_pin_type NOT NULL,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (entity_id IS NOT NULL OR exclusion_term IS NOT NULL)
);

CREATE INDEX idx_watch_sets_thesis
  ON public.thesis_watch_sets (thesis_id);
CREATE INDEX idx_watch_sets_entity
  ON public.thesis_watch_sets (entity_id) WHERE entity_id IS NOT NULL;

COMMENT ON TABLE public.thesis_watch_sets IS
  'Entities a thesis is tracking. New claims mentioning watch-set entities get routed to the thesis inbox.';

CREATE TABLE public.thesis_concept_spine (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id       UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  concept_text    TEXT NOT NULL,
  ordering        INTEGER NOT NULL DEFAULT 0,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (thesis_id, concept_text)
);

COMMENT ON TABLE public.thesis_concept_spine IS
  'Core concepts that give a thesis its shape. Used for routing new claims.';

CREATE TABLE public.thesis_inbox (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id   UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  claim_id    UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  routed_by   TEXT NOT NULL
              CHECK (routed_by IN ('watch_set_match', 'concept_match', 'operator_manual')),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acted_at    TIMESTAMPTZ,
  action      TEXT
              CHECK (action IS NULL OR action IN ('integrated', 'rejected', 'deferred')),
  UNIQUE (thesis_id, claim_id)
);

CREATE INDEX idx_thesis_inbox_pending
  ON public.thesis_inbox (thesis_id) WHERE acted_at IS NULL;

COMMENT ON TABLE public.thesis_inbox IS
  'Per-thesis queue of claims proposed for integration.';
