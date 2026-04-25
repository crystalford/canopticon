# CANOPTICON Postgres Schema v1.0

**Database:** Postgres 15+ via Supabase
**Multi-tenant model:** Row-Level Security (RLS) on every table, with `user_id` UUID column scoping access to the authenticated user.
**Graph patterns:** Adjacency lists in standard relational tables. No Neo4j.
**Versioning strategy:** Claims, theses, and articles use append-only version tables. Substrate writes are immutable; updates are new rows that supersede old ones.
**Naming:** snake_case tables and columns. Singular table names where conceptually distinct (e.g., `claim_graph`), plural where row-oriented (`sources`, `entities`, `claims`).
**Comments:** Every table and non-obvious column has a Postgres `COMMENT ON` for self-documentation.

This schema covers the full v1.5.1 substrate. It is the contract Claude Code builds against. Subsequent migrations follow Supabase migration conventions.

---

## 0. PRINCIPLES

**Append-only where it matters.** Claims, theses, articles, predictions, and contradictions never get updated in place. Each change creates a new version row. The current version is determined by `is_current = true`. This means every state is reconstructable, every diff is computable, and the public site's version-history surface is queryable rather than reconstructed.

**Provenance is mandatory.** Every claim points to at least one source. Every registry entry points to the role invocation that produced it. The audit trail is structural, not optional.

**Tenant isolation by RLS.** Postgres Row-Level Security is the enforcement mechanism. Every query is automatically scoped to the authenticated user via `auth.uid()`. The application code does not (and should not) filter by user_id manually.

**No nullable foreign keys for substrate.** A claim without a source is not a claim. A registry entry without a role invocation is not a registry entry. Foreign keys to substrate are NOT NULL.

**JSON for unstructured payloads, columns for queryable fields.** If the application needs to filter or sort on a field, it gets a column. If a field is structured but not queried (e.g., a verifier's full reasoning trace), it goes in a `jsonb` payload.

---

## 1. EXTENSIONS

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- fuzzy text matching for entity resolution
CREATE EXTENSION IF NOT EXISTS "vector";         -- pgvector for semantic similarity (Phase 2)
CREATE EXTENSION IF NOT EXISTS "btree_gin";      -- composite indexes including jsonb
```

---

## 2. ENUMS

```sql
CREATE TYPE admiralty_grade AS ENUM ('A', 'B', 'C', 'D', 'E', 'F');

CREATE TYPE verification_status AS ENUM (
  'unverified',
  'grounded',
  'partial',
  'unsupported',
  'contested'
);

CREATE TYPE ipcc_likelihood AS ENUM (
  'virtually_certain',  -- 99-100%
  'very_likely',         -- 90-100%
  'likely',              -- 66-100%
  'about_as_likely_as_not', -- 33-66%
  'unlikely',            -- 0-33%
  'very_unlikely',       -- 0-10%
  'exceptionally_unlikely' -- 0-1%
);

CREATE TYPE entity_type AS ENUM (
  'person',
  'organization',
  'institution',
  'corporation',
  'department',
  'office',
  'university',
  'cluster',
  'legislation',
  'event',
  'concept',
  'document',
  'location'
);

CREATE TYPE claim_layer AS ENUM (
  'factual',
  'framing',
  'architectural',
  'distributive'
);

CREATE TYPE thesis_status AS ENUM (
  'declared',
  'in_progress',
  'mature',
  'archived',
  'retracted'
);

CREATE TYPE article_status AS ENUM (
  'draft',
  'review',
  'published',
  'corrected',
  'retracted'
);

CREATE TYPE prediction_status AS ENUM (
  'active',
  'resolved_correct',
  'resolved_incorrect',
  'resolved_ambiguous',
  'expired_unresolved',
  'retracted'
);

CREATE TYPE contradiction_posture AS ENUM (
  'open',
  'resolved_a',
  'resolved_b',
  'machloket',
  'retired'
);

CREATE TYPE assumption_status AS ENUM (
  'holding',
  'weakening',
  'failed',
  'strengthened'
);

CREATE TYPE source_type AS ENUM (
  'document',
  'video',
  'audio',
  'transcript',
  'webpage',
  'social_post',
  'filing',
  'gazette',
  'press_release',
  'book',
  'academic_paper',
  'research_brief'
);

CREATE TYPE ingestion_mode AS ENUM (
  'operator_upload',
  'webhook_push',
  'cron_pull',
  'research_brief',
  'derived'
);

CREATE TYPE ingestion_state AS ENUM (
  'pending_critic',
  'pending_approval',
  'approved',
  'deferred',
  'rejected',
  'auto_approved'
);

CREATE TYPE role_name AS ENUM (
  'interrogator',
  'red_team',
  'steelman',
  'premortem',
  'verifier',
  'gap_surfacer',
  'calibration',
  'tier_projector',
  'assumption_auditor',
  'ingestion_critic',
  'indicator_validator'
);

CREATE TYPE cost_operation_type AS ENUM (
  'claude_completion',
  'gpt5_verification',
  'gemini_verification',
  'transcription_assemblyai',
  'transcription_openai',
  'apify_scrape',
  'flux_generation',
  'replicate_generation',
  'kling_video',
  'runway_video',
  'veo_video',
  'sedar_fetch',
  'other_paid'
);
```

---

## 3. CORE: USERS, AUTH, COST

### 3.1 `users`

Supabase manages `auth.users`; we shadow the relevant fields in `public.users` for foreign-key referencing and add CANOPTICON-specific fields.

```sql
CREATE TABLE public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  publication_handle TEXT UNIQUE,        -- public-facing handle, e.g., "telford"
  monthly_ceiling_cents INTEGER NOT NULL DEFAULT 5000,  -- $50.00 default
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS 'CANOPTICON users. One row per authenticated operator. Mirrors auth.users with platform-specific fields.';
COMMENT ON COLUMN public.users.monthly_ceiling_cents IS 'Hard ceiling on paid operations per month. Operations auto-block at this value. Default $50.';
```

### 3.2 `cost_ledger`

Append-only log of every paid operation. Critical for the no-silent-spending discipline.

```sql
CREATE TABLE public.cost_ledger (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  operation_type  cost_operation_type NOT NULL,
  provider        TEXT NOT NULL,           -- 'anthropic', 'openai', 'assemblyai', etc.
  model_or_sku    TEXT,                    -- 'claude-opus-4-7', 'gpt-5', 'whisper-large', etc.
  cost_cents      INTEGER NOT NULL,        -- positive integer, in cents
  related_role_invocation_id UUID,         -- if produced by a role; nullable for direct operator ops
  related_source_id UUID,                  -- if related to a specific source
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by_operator BOOLEAN NOT NULL,   -- false means whitelisted-auto
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_ledger_user_month ON public.cost_ledger (user_id, occurred_at DESC);
CREATE INDEX idx_cost_ledger_operation_type ON public.cost_ledger (user_id, operation_type, occurred_at DESC);

COMMENT ON TABLE public.cost_ledger IS 'Append-only log of every paid operation. Sums per user per month determine ceiling enforcement.';
COMMENT ON COLUMN public.cost_ledger.approved_by_operator IS 'Was the operation approved via the cost-approval modal? False means it ran on a pre-approved whitelist.';
```

### 3.3 `cost_whitelists`

Operations the operator has pre-approved up to a per-operation cap. Listed in System screen.

```sql
CREATE TABLE public.cost_whitelists (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  operation_type  cost_operation_type NOT NULL,
  per_op_max_cents INTEGER NOT NULL,
  daily_max_cents  INTEGER,
  monthly_max_cents INTEGER,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, operation_type)
);

COMMENT ON TABLE public.cost_whitelists IS 'Per-operation pre-approval rules. If an operation matches a whitelist row and is under the cap, it runs without prompting.';
```

---

## 4. SOURCES & INGESTION

### 4.1 `sources`

Every source CANOPTICON has ingested. The Source Registry.

```sql
CREATE TABLE public.sources (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_type     source_type NOT NULL,
  title           TEXT NOT NULL,
  url             TEXT,
  publication     TEXT,                    -- 'Globe and Mail', 'openparliament.ca', 'Moose on the Loose'
  author          TEXT,
  published_at    TIMESTAMPTZ,
  retrieved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admiralty_grade admiralty_grade NOT NULL,
  bias_profile    JSONB,                   -- structured bias notes if known
  ingestion_mode  ingestion_mode NOT NULL,
  ingestion_state ingestion_state NOT NULL DEFAULT 'pending_critic',
  storage_uri     TEXT,                    -- R2 path if we stored the body
  raw_text        TEXT,                    -- full text if reasonable to inline (< 1MB)
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  slug            TEXT,                    -- for public source page URL
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_sources_user_state ON public.sources (user_id, ingestion_state, retrieved_at DESC);
CREATE INDEX idx_sources_user_grade ON public.sources (user_id, admiralty_grade);
CREATE INDEX idx_sources_url ON public.sources (user_id, url) WHERE url IS NOT NULL;
CREATE INDEX idx_sources_title_trgm ON public.sources USING gin (title gin_trgm_ops);

COMMENT ON TABLE public.sources IS 'Source Registry. Every source ever ingested with provenance and grading.';
COMMENT ON COLUMN public.sources.bias_profile IS 'Structured bias notes (lean, ownership, prior known errors). JSON shape: { lean: string, ownership: string, notes: string[] }';
```

### 4.2 `ingestion_critic_reports`

The Critic's assessment of every source before registry writes. Operator approval references this.

```sql
CREATE TABLE public.ingestion_critic_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_id       UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  role_invocation_id UUID,                 -- the run that produced this report
  proposed_grade  admiralty_grade NOT NULL,
  bias_assessment TEXT NOT NULL,
  compatibility_check TEXT NOT NULL,        -- 'high', 'medium', 'low' + commentary
  contradiction_flags JSONB NOT NULL DEFAULT '[]'::jsonb,  -- claim_id refs that conflict
  watch_set_matches JSONB NOT NULL DEFAULT '[]'::jsonb,    -- thesis_id refs whose watch-sets matched
  paid_op_required BOOLEAN NOT NULL DEFAULT FALSE,
  paid_op_estimate_cents INTEGER,
  reasoning       TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_critic_reports_source ON public.ingestion_critic_reports (source_id);

COMMENT ON TABLE public.ingestion_critic_reports IS 'Ingestion Critic role outputs. Every source has at least one report before approval.';
```

### 4.3 `ingestion_actions`

Operator decisions on pending sources. Append-only.

```sql
CREATE TABLE public.ingestion_actions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_id       UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  action          ingestion_state NOT NULL CHECK (action IN ('approved', 'deferred', 'rejected', 'auto_approved')),
  notes           TEXT,
  acted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingestion_actions_source ON public.ingestion_actions (source_id, acted_at DESC);

COMMENT ON TABLE public.ingestion_actions IS 'Operator decisions on pending ingestions. Append-only.';
```

---

## 5. ENTITIES (the graph nodes)

### 5.1 `entities`

```sql
CREATE TABLE public.entities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entity_type     entity_type NOT NULL,
  canonical_name  TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  aliases         TEXT[] NOT NULL DEFAULT '{}',
  description     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  slug            TEXT,                    -- public URL slug
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_excluded     BOOLEAN NOT NULL DEFAULT FALSE,  -- explicit operator exclusion
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_entities_user_type ON public.entities (user_id, entity_type);
CREATE INDEX idx_entities_canonical_trgm ON public.entities USING gin (canonical_name gin_trgm_ops);
CREATE INDEX idx_entities_aliases ON public.entities USING gin (aliases);

COMMENT ON TABLE public.entities IS 'Graph nodes. People, organizations, events, legislation, concepts.';
COMMENT ON COLUMN public.entities.aliases IS 'Alternative names and references. Used by entity resolution to merge mentions.';
```

### 5.2 `entity_mentions`

Every time an entity is mentioned in a source. Pre-resolution layer; multiple mentions may point to one entity.

```sql
CREATE TABLE public.entity_mentions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_id       UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  entity_id       UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  mention_text    TEXT NOT NULL,
  context_excerpt TEXT,
  position_start  INTEGER,                 -- character offset in source (when applicable)
  position_end    INTEGER,
  resolution_confidence NUMERIC(3,2),      -- 0.00 to 1.00
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entity_mentions_source ON public.entity_mentions (source_id);
CREATE INDEX idx_entity_mentions_entity ON public.entity_mentions (entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_entity_mentions_unresolved ON public.entity_mentions (user_id, source_id) WHERE entity_id IS NULL;

COMMENT ON TABLE public.entity_mentions IS 'Raw mentions of entities in sources, before resolution to canonical entity. Mentions with NULL entity_id are unresolved.';
```

---

## 6. CLAIMS (the graph edges + first-class records)

### 6.1 `claims`

The current state of every claim. Versioned via `claim_versions`.

```sql
CREATE TABLE public.claims (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_version_id    UUID,              -- FK set after first version inserted
  layer                 claim_layer NOT NULL DEFAULT 'factual',
  admiralty_grade       admiralty_grade NOT NULL,
  verification_status   verification_status NOT NULL DEFAULT 'unverified',
  ipcc_qualifier        ipcc_likelihood,   -- when claim is probabilistic
  is_linchpin           BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived           BOOLEAN NOT NULL DEFAULT FALSE,
  slug                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_claims_user_layer ON public.claims (user_id, layer);
CREATE INDEX idx_claims_user_grade ON public.claims (user_id, admiralty_grade);
CREATE INDEX idx_claims_user_status ON public.claims (user_id, verification_status);
CREATE INDEX idx_claims_linchpin ON public.claims (user_id) WHERE is_linchpin = TRUE;

COMMENT ON TABLE public.claims IS 'First-class claims. Each row is a claim identity; content lives in claim_versions. Current state is denormalized here for fast queries.';
```

### 6.2 `claim_versions`

Append-only. Each row is one version of a claim's content.

```sql
CREATE TABLE public.claim_versions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id              UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version_number        INTEGER NOT NULL,
  is_current            BOOLEAN NOT NULL DEFAULT FALSE,
  -- Toulmin structure
  data                  TEXT NOT NULL,             -- the observable fact
  claim_text            TEXT NOT NULL,             -- the assertion
  warrant               TEXT,                      -- inference rule from data to claim
  backing               TEXT,                      -- support for the warrant
  qualifier             TEXT,                      -- IPCC qualifier text or other
  rebuttal              TEXT,                      -- known counterarguments
  -- Provenance
  primary_source_id     UUID NOT NULL REFERENCES public.sources(id),
  written_by_role       role_name,
  written_by_role_invocation_id UUID,
  change_summary        TEXT,                      -- "added new source", "rebuttal updated", etc.
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (claim_id, version_number)
);

CREATE INDEX idx_claim_versions_current ON public.claim_versions (claim_id) WHERE is_current = TRUE;
CREATE INDEX idx_claim_versions_user ON public.claim_versions (user_id, created_at DESC);

ALTER TABLE public.claims
  ADD CONSTRAINT fk_claims_current_version
  FOREIGN KEY (current_version_id) REFERENCES public.claim_versions(id);

COMMENT ON TABLE public.claim_versions IS 'Append-only history of every claim. is_current=TRUE marks the active version.';
```

### 6.3 `claim_entities`

Many-to-many between claims and entities. A claim "Carney chaired Brookfield" involves Carney and Brookfield.

```sql
CREATE TABLE public.claim_entities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claim_id        UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  entity_id       UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  role_in_claim   TEXT,                    -- 'subject', 'object', 'context'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (claim_id, entity_id, role_in_claim)
);

CREATE INDEX idx_claim_entities_entity ON public.claim_entities (entity_id);
CREATE INDEX idx_claim_entities_claim ON public.claim_entities (claim_id);

COMMENT ON TABLE public.claim_entities IS 'Claim-to-entity associations. Used to compute entity pages and watch-set matches.';
```

### 6.4 `claim_sources`

Many-to-many. A claim can have multiple supporting sources beyond its primary.

```sql
CREATE TABLE public.claim_sources (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claim_id        UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  source_id       UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  supports        BOOLEAN NOT NULL,         -- true = supports, false = contradicts
  excerpt         TEXT,                     -- specific passage from source
  excerpt_position JSONB,                   -- {start: int, end: int} or page number
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (claim_id, source_id, supports)
);

CREATE INDEX idx_claim_sources_claim ON public.claim_sources (claim_id);
CREATE INDEX idx_claim_sources_source ON public.claim_sources (source_id);

COMMENT ON TABLE public.claim_sources IS 'Supporting and contradicting sources per claim. supports=FALSE rows feed the Contradiction Registry.';
```

### 6.5 `claim_relations`

Edges between claims. Used for argument structure: claim A supports claim B; claim X contradicts claim Y.

```sql
CREATE TYPE claim_relation_type AS ENUM (
  'supports',
  'contradicts',
  'refines',
  'depends_on',
  'derives_from',
  'rebuts'
);

CREATE TABLE public.claim_relations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_claim_id   UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  to_claim_id     UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  relation_type   claim_relation_type NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_claim_id, to_claim_id, relation_type)
);

CREATE INDEX idx_claim_relations_from ON public.claim_relations (from_claim_id);
CREATE INDEX idx_claim_relations_to ON public.claim_relations (to_claim_id);

COMMENT ON TABLE public.claim_relations IS 'Argument structure. Adjacency-list graph between claims.';
```

### 6.6 `entity_relations`

Edges between entities. "Carney chaired Brookfield" creates a `chaired` relation node-to-node.

```sql
CREATE TABLE public.entity_relations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_entity_id  UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  to_entity_id    UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  relation_type   TEXT NOT NULL,            -- 'chaired', 'employed_by', 'attended', 'amended', etc.
  derived_from_claim_id UUID REFERENCES public.claims(id),
  start_date      DATE,
  end_date        DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entity_relations_from ON public.entity_relations (from_entity_id);
CREATE INDEX idx_entity_relations_to ON public.entity_relations (to_entity_id);
CREATE INDEX idx_entity_relations_type ON public.entity_relations (user_id, relation_type);

COMMENT ON TABLE public.entity_relations IS 'Adjacency-list graph between entities, derived from claims. Carries time bounds for relations like board memberships.';
```

---

## 7. THESES

### 7.1 `theses`

Living documents.

```sql
CREATE TABLE public.theses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_version_id UUID,
  status          thesis_status NOT NULL DEFAULT 'declared',
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL,
  declared_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cynefin_domain  TEXT,                    -- 'clear', 'complicated', 'complex', 'chaotic'
  is_public       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_theses_user_status ON public.theses (user_id, status);
CREATE INDEX idx_theses_public ON public.theses (user_id, is_public) WHERE is_public = TRUE;

COMMENT ON TABLE public.theses IS 'Top-level investigations. Living documents that evolve over months.';
```

### 7.2 `thesis_versions`

```sql
CREATE TABLE public.thesis_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thesis_id       UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  is_current      BOOLEAN NOT NULL DEFAULT FALSE,
  seed_paragraph  TEXT NOT NULL,
  bluf            TEXT,
  tier_80         TEXT,
  tier_800        TEXT,
  tier_full       TEXT,
  ipcc_likelihood ipcc_likelihood,
  written_by_role role_name,
  written_by_role_invocation_id UUID,
  change_summary  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (thesis_id, version_number)
);

CREATE INDEX idx_thesis_versions_current ON public.thesis_versions (thesis_id) WHERE is_current = TRUE;

ALTER TABLE public.theses
  ADD CONSTRAINT fk_theses_current_version
  FOREIGN KEY (current_version_id) REFERENCES public.thesis_versions(id);

COMMENT ON TABLE public.thesis_versions IS 'Append-only history of thesis content. Tier projections regenerate on each version.';
```

### 7.3 `thesis_claims`

Many-to-many between theses and claims.

```sql
CREATE TABLE public.thesis_claims (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id       UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  claim_id        UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  layer           claim_layer NOT NULL,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at      TIMESTAMPTZ,
  UNIQUE (thesis_id, claim_id, layer)
);

CREATE INDEX idx_thesis_claims_thesis ON public.thesis_claims (thesis_id, layer);
CREATE INDEX idx_thesis_claims_claim ON public.thesis_claims (claim_id);

COMMENT ON TABLE public.thesis_claims IS 'Claims integrated into a thesis at a specific layer. removed_at allows soft-removal.';
```

### 7.4 `thesis_watch_sets`

Entities a thesis is actively tracking. Drives auto-routing of new claims.

```sql
CREATE TYPE watch_pin_type AS ENUM ('pinned', 'tracked', 'derived', 'excluded');

CREATE TABLE public.thesis_watch_sets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id       UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  entity_id       UUID REFERENCES public.entities(id) ON DELETE CASCADE,
  exclusion_term  TEXT,                    -- for excluded patterns without an entity row
  pin_type        watch_pin_type NOT NULL,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (entity_id IS NOT NULL OR exclusion_term IS NOT NULL)
);

CREATE INDEX idx_watch_sets_thesis ON public.thesis_watch_sets (thesis_id);
CREATE INDEX idx_watch_sets_entity ON public.thesis_watch_sets (entity_id) WHERE entity_id IS NOT NULL;

COMMENT ON TABLE public.thesis_watch_sets IS 'Entities a thesis is tracking. New claims mentioning watch-set entities get routed to the thesis inbox.';
```

### 7.5 `thesis_concept_spine`

```sql
CREATE TABLE public.thesis_concept_spine (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id       UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  concept_text    TEXT NOT NULL,
  ordering        INTEGER NOT NULL DEFAULT 0,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (thesis_id, concept_text)
);

COMMENT ON TABLE public.thesis_concept_spine IS 'Core concepts that give a thesis its shape. Used for routing new claims.';
```

### 7.6 `thesis_inbox`

Claims awaiting integration into a specific thesis.

```sql
CREATE TABLE public.thesis_inbox (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id       UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  claim_id        UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  routed_by       TEXT NOT NULL,           -- 'watch_set_match', 'concept_match', 'operator_manual'
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acted_at        TIMESTAMPTZ,
  action          TEXT,                    -- 'integrated', 'rejected', 'deferred'
  UNIQUE (thesis_id, claim_id)
);

CREATE INDEX idx_thesis_inbox_pending ON public.thesis_inbox (thesis_id) WHERE acted_at IS NULL;

COMMENT ON TABLE public.thesis_inbox IS 'Per-thesis queue of claims proposed for integration.';
```

---

## 8. ASSUMPTIONS, LINCHPINS, INDICATORS, CONTRADICTIONS

### 8.1 `assumptions`

```sql
CREATE TABLE public.assumptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id       UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  status          assumption_status NOT NULL DEFAULT 'holding',
  is_linchpin     BOOLEAN NOT NULL DEFAULT FALSE,
  consequence_if_failed TEXT,
  last_audited_at TIMESTAMPTZ,
  last_audit_role_invocation_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assumptions_thesis ON public.assumptions (thesis_id) WHERE thesis_id IS NOT NULL;
CREATE INDEX idx_assumptions_linchpin ON public.assumptions (user_id) WHERE is_linchpin = TRUE;
CREATE INDEX idx_assumptions_status ON public.assumptions (user_id, status);

COMMENT ON TABLE public.assumptions IS 'Assumption Registry. Linchpins are the subset whose failure collapses a thesis.';
```

### 8.2 `assumption_supporting_claims`

```sql
CREATE TABLE public.assumption_supporting_claims (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assumption_id   UUID NOT NULL REFERENCES public.assumptions(id) ON DELETE CASCADE,
  claim_id        UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assumption_id, claim_id)
);
```

### 8.3 `indicators`

Measurable values whose future state will confirm or disconfirm theses.

```sql
CREATE TABLE public.indicators (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id       UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  definition      TEXT NOT NULL,
  source_uri      TEXT,                    -- where to fetch updates
  cadence         TEXT,                    -- '1h', '6h', 'daily', 'weekly', 'event-driven'
  current_value   JSONB,
  current_value_observed_at TIMESTAMPTZ,
  threshold_for_confirm JSONB,
  threshold_for_disconfirm JSONB,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_indicators_active ON public.indicators (user_id) WHERE is_active = TRUE;
CREATE INDEX idx_indicators_thesis ON public.indicators (thesis_id) WHERE thesis_id IS NOT NULL;

COMMENT ON TABLE public.indicators IS 'Indicator Registry. Measurable values whose change updates linked theses.';
```

### 8.4 `indicator_observations`

Append-only log of every observed indicator value.

```sql
CREATE TABLE public.indicator_observations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  indicator_id    UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  observed_value  JSONB NOT NULL,
  observed_at     TIMESTAMPTZ NOT NULL,
  source_id       UUID REFERENCES public.sources(id),
  resolved_predictions UUID[] DEFAULT '{}',  -- refs to predictions this resolved
  written_by_role_invocation_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_indicator_observations_indicator ON public.indicator_observations (indicator_id, observed_at DESC);
```

### 8.5 `contradictions`

```sql
CREATE TABLE public.contradictions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claim_a_id      UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  claim_b_id      UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  posture         contradiction_posture NOT NULL DEFAULT 'open',
  description     TEXT NOT NULL,
  resolution_notes TEXT,                   -- reasoning if resolved or held machloket
  resolved_at     TIMESTAMPTZ,
  detected_by_role role_name,
  detected_by_role_invocation_id UUID,
  is_public       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (claim_a_id != claim_b_id)
);

CREATE INDEX idx_contradictions_posture ON public.contradictions (user_id, posture);
CREATE INDEX idx_contradictions_claim_a ON public.contradictions (claim_a_id);
CREATE INDEX idx_contradictions_claim_b ON public.contradictions (claim_b_id);
CREATE INDEX idx_contradictions_public ON public.contradictions (user_id, is_public) WHERE is_public = TRUE;

COMMENT ON TABLE public.contradictions IS 'Contradiction Registry. Postures: open, resolved_a, resolved_b, machloket, retired.';
```

---

## 9. PREDICTIONS, BRIER

### 9.1 `predictions`

```sql
CREATE TABLE public.predictions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id       UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  claim_text      TEXT NOT NULL,
  confidence      NUMERIC(5,4) NOT NULL CHECK (confidence > 0 AND confidence < 1),
  ipcc_qualifier  ipcc_likelihood,
  resolution_criterion TEXT NOT NULL,
  banked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolves_by     TIMESTAMPTZ,
  status          prediction_status NOT NULL DEFAULT 'active',
  resolved_at     TIMESTAMPTZ,
  resolved_outcome TEXT,                   -- 'correct', 'incorrect', 'ambiguous'
  resolution_evidence_source_id UUID REFERENCES public.sources(id),
  resolution_indicator_id UUID REFERENCES public.indicators(id),
  brier_contribution NUMERIC(7,6),         -- (predicted - outcome)^2
  domain          TEXT,                    -- 'monetary_policy', 'electoral', 'corporate', etc.
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_predictions_status ON public.predictions (user_id, status);
CREATE INDEX idx_predictions_resolves_by ON public.predictions (user_id, resolves_by) WHERE status = 'active';
CREATE INDEX idx_predictions_thesis ON public.predictions (thesis_id) WHERE thesis_id IS NOT NULL;
CREATE INDEX idx_predictions_public ON public.predictions (user_id, is_public, status);

COMMENT ON TABLE public.predictions IS 'Brier Registry. Public-grade prediction ledger with confidence, horizon, and resolution.';
```

---

## 10. ARTICLES (published outputs)

### 10.1 `articles`

```sql
CREATE TABLE public.articles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_version_id UUID,
  thesis_id       UUID REFERENCES public.theses(id),
  status          article_status NOT NULL DEFAULT 'draft',
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL,
  published_at    TIMESTAMPTZ,
  is_public       BOOLEAN NOT NULL DEFAULT FALSE,
  read_time_minutes INTEGER,
  word_count      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_articles_status ON public.articles (user_id, status);
CREATE INDEX idx_articles_published ON public.articles (user_id, is_public, published_at DESC) WHERE is_public = TRUE;
```

### 10.2 `article_versions`

```sql
CREATE TABLE public.article_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id      UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  is_current      BOOLEAN NOT NULL DEFAULT FALSE,
  body_markdown   TEXT NOT NULL,
  body_html       TEXT,
  excerpt         TEXT,
  written_by_role_invocation_id UUID,
  change_summary  TEXT,
  is_correction   BOOLEAN NOT NULL DEFAULT FALSE,
  correction_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, version_number)
);

CREATE INDEX idx_article_versions_current ON public.article_versions (article_id) WHERE is_current = TRUE;

ALTER TABLE public.articles
  ADD CONSTRAINT fk_articles_current_version
  FOREIGN KEY (current_version_id) REFERENCES public.article_versions(id);
```

### 10.3 `article_claims`

Many-to-many. Used for inline citations.

```sql
CREATE TABLE public.article_claims (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  article_id      UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  claim_id        UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  position_in_body INTEGER,                -- character offset in body_markdown
  citation_label  TEXT,                    -- e.g., "[SEDAR+ 2021-04-08]"
  UNIQUE (article_id, claim_id, position_in_body)
);
```

### 10.4 `article_corrections`

Append-only.

```sql
CREATE TABLE public.article_corrections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  article_id      UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  what_changed    TEXT NOT NULL,
  why             TEXT NOT NULL,
  prior_version_id UUID NOT NULL REFERENCES public.article_versions(id),
  new_version_id  UUID NOT NULL REFERENCES public.article_versions(id),
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,
  corrected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_article_corrections_article ON public.article_corrections (article_id, corrected_at DESC);
```

---

## 11. ROLES, INVOCATIONS, EVENTS

### 11.1 `role_definitions`

The eleven roles, their packaging, their current SKILL.md hash for cache-busting.

```sql
CREATE TABLE public.role_definitions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name            role_name NOT NULL,
  prompt_template TEXT NOT NULL,
  default_model   TEXT NOT NULL,           -- 'claude-opus-4-7', etc.
  uses_citations_api BOOLEAN NOT NULL DEFAULT FALSE,
  uses_structured_output BOOLEAN NOT NULL DEFAULT FALSE,
  output_schema   JSONB,                   -- JSON schema if structured
  skill_md_hash   TEXT,                    -- hash of the SKILL.md packaging
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

COMMENT ON TABLE public.role_definitions IS 'Role configurations. Per-user so operators can tune their own prompt templates.';
```

### 11.2 `role_invocations`

Append-only audit log of every role invocation.

```sql
CREATE TABLE public.role_invocations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_name       role_name NOT NULL,
  triggered_by    TEXT NOT NULL,           -- 'morning_cascade', 'on_ingestion', 'on_demand', 'event_<name>'
  input_substrate JSONB NOT NULL,          -- snapshot of substrate slice the role read
  prompt_used     TEXT NOT NULL,
  model           TEXT NOT NULL,
  tokens_input    INTEGER,
  tokens_output   INTEGER,
  cost_cents      INTEGER,
  cost_ledger_id  UUID REFERENCES public.cost_ledger(id),
  output_text     TEXT,
  output_structured JSONB,                 -- for structured-output roles
  citations_returned JSONB,                -- for Citations API roles
  status          TEXT NOT NULL,           -- 'success', 'error', 'partial'
  error_detail    TEXT,
  cross_model_verification_id UUID,        -- if this was verified by another model
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_role_invocations_user_role ON public.role_invocations (user_id, role_name, created_at DESC);
CREATE INDEX idx_role_invocations_triggered ON public.role_invocations (user_id, triggered_by, created_at DESC);

COMMENT ON TABLE public.role_invocations IS 'Audit log of every role run. Required for the role-log surface in operator UI and for cost reconciliation.';
```

### 11.3 `orchestrator_events`

The event bus. Workflows are state-machine transitions on substrate; this table logs them.

```sql
CREATE TABLE public.orchestrator_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,           -- 'source.ingested', 'claim.written', 'thesis.updated', 'prediction.resolved', etc.
  entity_id       UUID,                    -- subject of the event (claim_id, source_id, thesis_id, ...)
  entity_type_str TEXT,                    -- 'claim', 'source', etc.
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_role_invocations UUID[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orch_events_user_type ON public.orchestrator_events (user_id, event_type, created_at DESC);
CREATE INDEX idx_orch_events_entity ON public.orchestrator_events (entity_id, created_at DESC);

COMMENT ON TABLE public.orchestrator_events IS 'Event bus. Event types follow noun.verb naming. Subscribers determine which events trigger which roles.';
```

### 11.4 `cascade_runs`

Records of morning-cascade executions.

```sql
CREATE TABLE public.cascade_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  triggered_by    TEXT NOT NULL,           -- 'cron', 'operator_manual'
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'running',  -- 'running', 'completed', 'failed', 'partial'
  sources_ingested INTEGER NOT NULL DEFAULT 0,
  claims_written  INTEGER NOT NULL DEFAULT 0,
  questions_generated INTEGER NOT NULL DEFAULT 0,
  contradictions_detected INTEGER NOT NULL DEFAULT 0,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  role_invocation_ids UUID[] DEFAULT '{}',
  error_summary   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cascade_runs_user ON public.cascade_runs (user_id, started_at DESC);

COMMENT ON TABLE public.cascade_runs IS 'Per-execution log of morning cascade. Surfaced on Live screen as last-run stats.';
```

---

## 12. QUESTIONS (Question Graph)

### 12.1 `questions`

Generated by the Interrogator role and declared by the operator. The Interrogator's structured output (skills-v1.0 §3) produces `text`, `expected_information_gain`, `rationale`, and `evidence_targets[]` per question; all four must round-trip into this table. The `parent_question_id` field models follow-up chains (a tree); cross-cutting question→claim discrimination relations live in the edge tables below (12.2, 12.3) and are v1.1 deferrals.

```sql
CREATE TYPE question_status AS ENUM ('open', 'answered', 'deferred', 'retired');

CREATE TABLE public.questions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id       UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  rationale       TEXT,                    -- Interrogator's "why this question matters"
  evidence_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
                                           -- array of strings: where to look for an answer
                                           -- (e.g., "SEDAR+ filings 2017-2019")
  expected_information_gain NUMERIC(3,2),  -- 0.00 to 1.00
  status          question_status NOT NULL DEFAULT 'open',
  generated_by    TEXT NOT NULL,           -- 'interrogator', 'operator', 'red_team', 'gap_surfacer'
  generated_by_role_invocation_id UUID,
  parent_question_id UUID REFERENCES public.questions(id),
  answer_claim_id UUID REFERENCES public.claims(id),  -- when answered
  answered_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_user_status ON public.questions (user_id, status);
CREATE INDEX idx_questions_thesis ON public.questions (thesis_id) WHERE thesis_id IS NOT NULL;
CREATE INDEX idx_questions_eig ON public.questions (user_id, expected_information_gain DESC) WHERE status = 'open';
```

### 12.2 `question_claims` (v1.1 — deferred)

A question may discriminate between two competing claims, target a single claim's warrant, or test a claim's evidence base. This is a many-to-many relation that the single-FK `parent_question_id` cannot model. Sprint 1 records discrimination targets only as freeform strings inside `questions.evidence_targets`; v1.1 promotes them to first-class edges.

```sql
-- v1.1 — DO NOT CREATE IN SPRINT 1
CREATE TYPE question_claim_relation AS ENUM (
  'discriminates',   -- answer would distinguish this claim from a competitor
  'tests_warrant',   -- answer would back or undermine the claim's warrant
  'tests_evidence',  -- answer would strengthen or weaken the claim's evidence
  'follows_up'       -- answer would extend the claim into new territory
);

CREATE TABLE public.question_claims (
  question_id     UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  claim_id        UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  relation        question_claim_relation NOT NULL,
  rationale       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (question_id, claim_id, relation)
);
```

### 12.3 `question_dependencies` (v1.1 — deferred)

Some questions presuppose answers to other questions ("if Q1 resolves to X, then Q2 becomes relevant"). The single-parent `parent_question_id` cannot model the case where a question depends on multiple priors. v1.1 promotes question dependencies to a many-to-many edge table.

```sql
-- v1.1 — DO NOT CREATE IN SPRINT 1
CREATE TABLE public.question_dependencies (
  question_id     UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  depends_on_question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  rationale       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (question_id, depends_on_question_id),
  CHECK (question_id <> depends_on_question_id)
);
```

### 12.4 Sprint 1 round-trip contract

The Interrogator output schema in skills-v1.0 §3 is constrained for Sprint 1 to fields that the `questions` table can store losslessly:

| Interrogator output field | `questions` column | Notes |
|---|---|---|
| `text` | `text` | direct |
| `expected_information_gain` | `expected_information_gain` | direct |
| `rationale` | `rationale` | direct (added to the schema in this revision) |
| `evidence_targets[]` | `evidence_targets` (JSONB array) | direct (added in this revision) |

The Interrogator does **not** emit `discriminates_between_claim_ids`, `tests_warrant_of_claim_id`, or dependency links in v1.0. Those output fields are added to the Interrogator schema in v1.1 alongside the `question_claims` and `question_dependencies` edge tables. Until then, Sprint 1's "Question Graph" is a tree (via `parent_question_id`) with stringly-typed evidence hints, not a true graph. This is an explicit, scoped deferral — not a gap.

---

## 13. BOOKS

The Book Graph. Books ingest via three modes.

```sql
CREATE TYPE book_ingest_mode AS ENUM ('surface', 'substrate', 'influence');

CREATE TABLE public.books (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  author          TEXT,
  isbn            TEXT,
  publication_year INTEGER,
  publisher       TEXT,
  ingest_mode     book_ingest_mode NOT NULL,
  source_id       UUID REFERENCES public.sources(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_books_user ON public.books (user_id);
```

---

## 14. PUBLICATION (public-site materializations)

These tables are read-mostly, written by background jobs that materialize public-facing views from substrate. The public site reads from these for performance. The operator app writes to substrate; jobs propagate to publication tables.

### 14.1 `pub_articles_cache`

```sql
CREATE TABLE public.pub_articles_cache (
  article_id      UUID PRIMARY KEY REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  slug            TEXT NOT NULL,
  rendered_html   TEXT NOT NULL,
  schema_org_json JSONB NOT NULL,
  open_graph_json JSONB NOT NULL,
  rendered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Other publication caches follow the same pattern: `pub_theses_cache`, `pub_entities_cache`, `pub_sources_cache`, `pub_claims_cache`, `pub_predictions_cache`, `pub_contradictions_cache`. Specs omitted for brevity but follow identical structure (PK = source row id, fields for rendered_html, schema_org_json, open_graph_json, rendered_at).

### 14.2 `pub_subscriptions`

Email list.

```sql
CREATE TABLE public.pub_subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  channels        TEXT[] NOT NULL DEFAULT '{}',  -- 'articles', 'theses', 'predictions', 'contradictions', 'digest'
  thesis_filters  UUID[] DEFAULT '{}',           -- per-thesis subscriptions
  confirmed       BOOLEAN NOT NULL DEFAULT FALSE,
  confirm_token   TEXT,
  unsubscribe_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  subscribed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  UNIQUE (user_id, email)
);
```

---

## 15. ROW-LEVEL SECURITY

Every table above gets RLS enabled with the standard pattern.

```sql
-- Example for sources; identical pattern for every other table
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY sources_owner_all ON public.sources
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Public read access for is_public rows** (theses, articles, predictions, contradictions, glossary):

```sql
-- Example for articles
CREATE POLICY articles_public_read ON public.articles
  FOR SELECT
  USING (is_public = TRUE);
```

The `pub_*_cache` tables are readable without auth at all (these are what the public site reads):

```sql
ALTER TABLE public.pub_articles_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_articles_cache_public ON public.pub_articles_cache
  FOR SELECT
  USING (TRUE);
```

---

## 16. MATERIALIZED VIEWS

Two materialized views for performance-critical queries.

### 16.1 `mv_brier_rolling`

Rolling Brier score per user.

```sql
CREATE MATERIALIZED VIEW public.mv_brier_rolling AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE status IN ('resolved_correct', 'resolved_incorrect', 'resolved_ambiguous')) AS resolved_count,
  AVG(brier_contribution) FILTER (WHERE brier_contribution IS NOT NULL) AS rolling_brier,
  COUNT(*) FILTER (WHERE status = 'active') AS active_count,
  domain
FROM public.predictions
GROUP BY user_id, domain;

CREATE UNIQUE INDEX ON public.mv_brier_rolling (user_id, domain);
```

Refresh on prediction resolution.

### 16.2 `mv_entity_centrality`

Pre-computed entity centrality scores for graph layout.

```sql
CREATE MATERIALIZED VIEW public.mv_entity_centrality AS
SELECT
  e.id AS entity_id,
  e.user_id,
  e.canonical_name,
  e.entity_type,
  COUNT(DISTINCT er.id) AS relation_count,
  COUNT(DISTINCT ce.claim_id) AS claim_count,
  MAX(c.last_seen_at_via_claims) AS last_active_at
FROM public.entities e
LEFT JOIN public.entity_relations er ON (er.from_entity_id = e.id OR er.to_entity_id = e.id)
LEFT JOIN public.claim_entities ce ON ce.entity_id = e.id
LEFT JOIN LATERAL (
  SELECT MAX(cl.updated_at) AS last_seen_at_via_claims
  FROM public.claims cl
  JOIN public.claim_entities ce2 ON ce2.claim_id = cl.id
  WHERE ce2.entity_id = e.id
) c ON TRUE
GROUP BY e.id, e.user_id, e.canonical_name, e.entity_type;

CREATE UNIQUE INDEX ON public.mv_entity_centrality (entity_id);
```

Refresh nightly.

---

## 17. TRIGGERS

### 17.1 Update timestamps

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to every table with an updated_at column
CREATE TRIGGER trg_sources_updated_at BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- Repeat for: claims, claim_versions ... (all tables with updated_at)
```

### 17.2 Enforce `is_current` exclusivity for versioned tables

```sql
CREATE OR REPLACE FUNCTION public.enforce_single_current_claim_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = TRUE THEN
    UPDATE public.claim_versions
    SET is_current = FALSE
    WHERE claim_id = NEW.claim_id AND id != NEW.id AND is_current = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_claim_versions_single_current
  AFTER INSERT OR UPDATE OF is_current ON public.claim_versions
  FOR EACH ROW WHEN (NEW.is_current = TRUE)
  EXECUTE FUNCTION public.enforce_single_current_claim_version();
```

Same trigger pattern repeated for `thesis_versions`, `article_versions`.

### 17.3 Auto-emit orchestrator event on substrate writes

A trigger on each substrate table emits a row in `orchestrator_events` so the orchestrator can subscribe.

```sql
CREATE OR REPLACE FUNCTION public.emit_orchestrator_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.orchestrator_events (user_id, event_type, entity_id, entity_type_str, payload)
  VALUES (
    NEW.user_id,
    TG_TABLE_NAME || CASE TG_OP WHEN 'INSERT' THEN '.created' WHEN 'UPDATE' THEN '.updated' END,
    NEW.id,
    TG_TABLE_NAME,
    jsonb_build_object('op', TG_OP)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_claims_event AFTER INSERT OR UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.emit_orchestrator_event();
-- Repeat for: sources, theses, predictions, contradictions, etc.
```

---

## 18. MIGRATION ORDER

Migrations run in this order on a fresh database:

1. Extensions (Section 1)
2. Enums (Section 2)
3. `users`, `cost_ledger`, `cost_whitelists` (Section 3)
4. `sources`, `ingestion_critic_reports`, `ingestion_actions` (Section 4)
5. `entities`, `entity_mentions` (Section 5)
6. `claims`, `claim_versions`, `claim_entities`, `claim_sources`, `claim_relations`, `entity_relations` (Section 6)
7. `theses`, `thesis_versions`, `thesis_claims`, `thesis_watch_sets`, `thesis_concept_spine`, `thesis_inbox` (Section 7)
8. `assumptions`, `assumption_supporting_claims`, `indicators`, `indicator_observations`, `contradictions` (Section 8)
9. `predictions` (Section 9)
10. `articles`, `article_versions`, `article_claims`, `article_corrections` (Section 10)
11. `role_definitions`, `role_invocations`, `orchestrator_events`, `cascade_runs` (Section 11)
12. `questions` (Section 12)
13. `books` (Section 13)
14. Publication caches (Section 14)
15. RLS policies (Section 15) — all tables
16. Materialized views (Section 16)
17. Triggers (Section 17)

---

## 19. SEED DATA

Sprint 1 seed for the user's default role definitions, default cost whitelists (none initially — every paid op prompts), and default thesis tier templates.

```sql
INSERT INTO public.role_definitions (user_id, name, prompt_template, default_model, uses_citations_api, uses_structured_output, output_schema)
VALUES
  (auth.uid(), 'ingestion_critic', '<see SKILL.md>', 'claude-opus-4-7', FALSE, TRUE, '<critic schema>'),
  (auth.uid(), 'verifier', '<see SKILL.md>', 'claude-opus-4-7', TRUE, FALSE, NULL),
  (auth.uid(), 'interrogator', '<see SKILL.md>', 'claude-opus-4-7', FALSE, TRUE, '<question schema>'),
  -- ... and so on for the remaining 8 roles
;
```

Full seed values are in the skills package (next document).

---

## 20. NOTES AND DEFERRALS

**Deferred to v1.1 of schema:**

- `pgvector` semantic similarity columns on entities and claims for fuzzy entity resolution. The extension is created in Section 1 but no embedding columns are populated in v1.0. Add when entity resolution work begins.
- Full-text search columns (`tsvector`) on articles, theses, claims. Add when public-site search graduates from Pagefind.
- Per-thesis `versions_diff` materialized view for the public-site version-history surface. Add when thesis pages go public.
- Audit table for substrate deletes (currently we cascade-delete; for some users we may want soft-delete with audit). Add if compliance ever requires it.

**Sprint 1 minimum tables (smallest set that lets the workflow work end-to-end):**

`users`, `cost_ledger`, `sources`, `ingestion_critic_reports`, `ingestion_actions`, `entities`, `entity_mentions`, `claims`, `claim_versions`, `claim_entities`, `claim_sources`, `theses`, `thesis_versions`, `thesis_claims`, `role_definitions`, `role_invocations`, `orchestrator_events`, `cascade_runs`.

Articles, predictions, contradictions, assumptions, indicators, books — added in Sprints 2 and beyond.

Publication caches — added when the public site begins rendering.

---

## 21. RLS TEST MATRIX

Every Sprint 1 table ships with Row-Level Security enabled and per-table policies (see §15). RLS is not "verify it works" infrastructure — it is **deny-by-default proof** infrastructure. A misconfigured policy on a forensic intelligence platform leaks private theses, in-progress investigations, and entity mentions whose existence is itself sensitive. The cost of a leak is career-ending; the cost of a thorough test matrix is a few hundred lines of SQL.

This section specifies the test matrix that must be in CI green before any deploy that touches RLS policies. The matrix runs as part of the schema migration test suite and additionally as a public-deploy gate (Phase 7 acceptance).

### 21.1 Test principals

The matrix uses three principals:

- **`alice`** — authenticated user, owner of test fixture rows
- **`bob`** — authenticated user, owner of *no* fixture rows; used to prove cross-user isolation
- **`anon`** — unauthenticated request using Supabase's anon key; used to prove public-read scope

For each Sprint 1 table, the matrix specifies what each principal **must** see, what each principal **must not** see, and what each principal **must** be able to write. A test is a single SQL assertion executed under the principal's JWT (or no JWT for `anon`).

### 21.2 Per-table matrix (Sprint 1 tables)

Notation: ✓ = must succeed, ✗ = must fail (RLS denies the row), N/A = not applicable to this table.

| Table | Operation | alice (owner) | alice (other-user row) | bob | anon |
|---|---|---|---|---|---|
| `users` | SELECT own row | ✓ | N/A | ✗ | ✗ |
| `users` | UPDATE own row | ✓ | N/A | ✗ | ✗ |
| `users` | SELECT alice's row as bob | N/A | N/A | ✗ | ✗ |
| `cost_ledger` | SELECT own | ✓ | ✗ | ✗ | ✗ |
| `cost_ledger` | INSERT own | ✓ | N/A | N/A | ✗ |
| `cost_whitelists` | SELECT own | ✓ | ✗ | ✗ | ✗ |
| `cost_whitelists` | UPDATE own | ✓ | ✗ | ✗ | ✗ |
| `sources` | SELECT own | ✓ | ✗ | ✗ | ✗ |
| `sources` | INSERT own | ✓ | N/A | N/A | ✗ |
| `sources` | UPDATE own | ✓ | ✗ | ✗ | ✗ |
| `ingestion_critic_reports` | SELECT for own source | ✓ | ✗ | ✗ | ✗ |
| `ingestion_actions` | SELECT for own source | ✓ | ✗ | ✗ | ✗ |
| `entities` | SELECT own | ✓ | ✗ | ✗ | ✗ |
| `entity_mentions` | SELECT for own source | ✓ | ✗ | ✗ | ✗ |
| `claims` | SELECT own | ✓ | ✗ | ✗ | ✗ |
| `claim_versions` | SELECT for own claim | ✓ | ✗ | ✗ | ✗ |
| `claim_entities` | SELECT for own claim | ✓ | ✗ | ✗ | ✗ |
| `claim_sources` | SELECT for own claim | ✓ | ✗ | ✗ | ✗ |
| `theses` | SELECT own (any) | ✓ | ✗ | ✗ | ✗ |
| `theses` | SELECT `is_public = TRUE` | ✓ | ✓ | ✓ | ✓ |
| `theses` | SELECT `is_public = FALSE` other-user | N/A | ✗ | ✗ | ✗ |
| `theses` | UPDATE own | ✓ | ✗ | ✗ | ✗ |
| `thesis_versions` | SELECT for own thesis | ✓ | ✗ | ✗ | ✗ |
| `thesis_claims` | SELECT for own thesis | ✓ | ✗ | ✗ | ✗ |
| `thesis_watch_sets` | SELECT for own thesis | ✓ | ✗ | ✗ | ✗ |
| `thesis_concept_spine` | SELECT for own thesis | ✓ | ✗ | ✗ | ✗ |
| `thesis_inbox` | SELECT for own thesis | ✓ | ✗ | ✗ | ✗ |
| `questions` | SELECT for own thesis | ✓ | ✗ | ✗ | ✗ |
| `role_definitions` | SELECT (global) | ✓ | N/A | ✓ | ✗ |
| `role_invocations` | SELECT own | ✓ | ✗ | ✗ | ✗ |
| `orchestrator_events` | SELECT own | ✓ | ✗ | ✗ | ✗ |
| `cascade_runs` | SELECT own | ✓ | ✗ | ✗ | ✗ |
| `workflow_runs` | SELECT own | ✓ | ✗ | ✗ | ✗ |

**Critical invariants encoded above:**

1. **No cross-user reads on private substrate.** bob attempting any SELECT against alice's private rows must return zero rows (not error — RLS denies silently by filtering).
2. **`anon` reads only public.** The anon key may read `theses` where `is_public = TRUE` and the `pub_*_cache` tables. Every other anon SELECT must return zero rows.
3. **`anon` cannot write anything.** Every anon INSERT/UPDATE/DELETE on every table fails the `WITH CHECK` clause.
4. **`role_definitions` is the one global-read table.** All authenticated users can read role prompts (so the orchestrator can serve the same Skill to any user); no one writes via API (seeded by migration only).

### 21.3 Implementation

The matrix lives at `supabase/tests/rls/`:

```
supabase/tests/rls/
├── fixtures.sql          # creates alice, bob, and seed rows owned by alice
├── alice_owner.sql       # 30+ assertions: alice can read/write her own rows
├── alice_cross.sql       # alice cannot reach into hypothetical other users
├── bob_isolation.sql     # bob sees nothing of alice's; bob can write his own
├── anon_public_read.sql  # anon reads only is_public rows and pub_*_cache
├── anon_no_write.sql     # anon writes are uniformly denied
└── runner.sh             # invokes pgTAP or psql -v ON_ERROR_STOP=1 against test DB
```

Each `.sql` file uses `SET LOCAL ROLE` and `SET LOCAL request.jwt.claim.sub = '<uuid>'` to impersonate a principal, then runs the assertions. Failures abort CI.

### 21.4 CI gate

The RLS test matrix is mandatory green for two pipelines:

1. **Schema migration PRs.** Any PR that touches `supabase/migrations/0010_rls_policies.sql` (or any earlier migration that creates a table) must run the full matrix and pass before merge.
2. **Public-API deploys.** The `api.canopticon.com` deploy pipeline runs the matrix against the production Supabase project as a smoke test before flipping DNS. A failed matrix aborts the deploy and pages the operator.

The gate is non-negotiable. RLS is the *only* thing standing between a Postgres anon-key public API and a leak.

### 21.5 Adding a table to the matrix

When Sprint 2+ adds a table (predictions, contradictions, articles, etc.), the matrix must be extended *in the same PR* that creates the table. A table is not "in the schema" until its row in this matrix is written and green. This is enforced by a CI check that compares `\dt` output against the matrix table list and fails if any public.* table is missing from the matrix.
