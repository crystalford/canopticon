-- Migration 0007 — Claims, versions, claim_entities, claim_sources
-- See canopticon-schema-v1.0.md §6.1–§6.4.
--
-- claim_relations and entity_relations (schema-v1.0 §6.5, §6.6) are deferred
-- to Sprint 2. The claim graph in Sprint 1 is shape "claim ↔ entities ↔
-- sources"; cross-claim edges land when the Red Team and Steelman roles come
-- online.

CREATE TABLE public.claims (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_version_id    UUID,
  layer                 claim_layer NOT NULL DEFAULT 'factual',
  admiralty_grade       admiralty_grade NOT NULL,
  verification_status   verification_status NOT NULL DEFAULT 'unverified',
  ipcc_qualifier        ipcc_likelihood,
  is_linchpin           BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived           BOOLEAN NOT NULL DEFAULT FALSE,
  slug                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_claims_user_layer
  ON public.claims (user_id, layer);
CREATE INDEX idx_claims_user_grade
  ON public.claims (user_id, admiralty_grade);
CREATE INDEX idx_claims_user_status
  ON public.claims (user_id, verification_status);
CREATE INDEX idx_claims_linchpin
  ON public.claims (user_id) WHERE is_linchpin = TRUE;

COMMENT ON TABLE public.claims IS
  'First-class claims. Each row is a claim identity; content lives in claim_versions. Current state is denormalized here for fast queries.';

CREATE TABLE public.claim_versions (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id                        UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  user_id                         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version_number                  INTEGER NOT NULL CHECK (version_number > 0),
  is_current                      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Toulmin structure (schema-v1.0 §6.2; methodology-canon top-12 #2)
  data                            TEXT NOT NULL,
  claim_text                      TEXT NOT NULL,
  warrant                         TEXT,
  backing                         TEXT,
  qualifier                       TEXT,
  rebuttal                        TEXT,
  -- Provenance
  primary_source_id               UUID NOT NULL REFERENCES public.sources(id),
  written_by_role                 role_name,
  written_by_role_invocation_id   UUID,
  change_summary                  TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (claim_id, version_number)
);

CREATE INDEX idx_claim_versions_current
  ON public.claim_versions (claim_id) WHERE is_current = TRUE;
CREATE INDEX idx_claim_versions_user
  ON public.claim_versions (user_id, created_at DESC);

ALTER TABLE public.claims
  ADD CONSTRAINT fk_claims_current_version
  FOREIGN KEY (current_version_id) REFERENCES public.claim_versions(id);

COMMENT ON TABLE public.claim_versions IS
  'Append-only history of every claim. is_current=TRUE marks the active version (enforced by trigger in 0011).';

CREATE TABLE public.claim_entities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claim_id        UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  entity_id       UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  role_in_claim   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (claim_id, entity_id, role_in_claim)
);

CREATE INDEX idx_claim_entities_entity
  ON public.claim_entities (entity_id);
CREATE INDEX idx_claim_entities_claim
  ON public.claim_entities (claim_id);

COMMENT ON TABLE public.claim_entities IS
  'Claim-to-entity associations. Used to compute entity pages and watch-set matches.';

CREATE TABLE public.claim_sources (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claim_id            UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  source_id           UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  supports            BOOLEAN NOT NULL,
  excerpt             TEXT,
  excerpt_position    JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (claim_id, source_id, supports)
);

CREATE INDEX idx_claim_sources_claim
  ON public.claim_sources (claim_id);
CREATE INDEX idx_claim_sources_source
  ON public.claim_sources (source_id);

COMMENT ON TABLE public.claim_sources IS
  'Supporting and contradicting sources per claim. supports=FALSE rows feed the Contradiction Registry (Sprint 2+).';
