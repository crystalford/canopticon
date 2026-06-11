# CANOPTICON — System

This document describes the technical heart of CANOPTICON: the substrate (Postgres schema), the roles (named prompt templates), the workflows (orchestration sequences), the entity resolution and claim deduplication pipelines, the production engine, and the architectural commitments that bind them together. It is the reference for what the system *is*. The companion document `canopticon-interfaces.md` covers how the system is accessed (operator UI, public site, API). The companion `canopticon-thinking.md` covers why the system exists and what disciplines it enforces.

---

## 1. ARCHITECTURAL COMMITMENTS

These are non-negotiable design choices. Implementations follow them; design choices that violate them are wrong.

**Workflow orchestration over autonomous agents.** The orchestrator is plain code — TypeScript on Cloudflare Workers, a state machine, function-call-and-event-bus architecture. There is no agent framework. There is no autonomy loop. Roles are named prompt templates invoked at specific points by orchestrator code reacting to substrate events. Grounding: Cognition June 2025 limits-of-multi-agent essay; Anthropic's multi-agent research (15× token cost); MAST taxonomy (14 named failure modes, 1,600+ traces analyzed).

**Substrate-first, not message-passing.** Roles do not communicate with each other. Roles read from substrate and write to substrate. The substrate is the shared state. Multi-agent systems that pretend to construct shared state from inter-agent messages reliably drift; CANOPTICON sidesteps the problem by making the substrate the canonical source.

**Append-only versioning where it matters.** Claims, theses, articles, predictions, and contradictions never get updated in place. Each change creates a new version row. The current version is determined by `is_current = true`. Every state is reconstructable; every diff is computable; the public site's version-history surface is queryable rather than reconstructed.

**Provenance is mandatory.** Every claim points to at least one source. Every registry entry points to the role invocation that produced it. The audit trail is structural, not optional. A `claims` row without an associated `claim_sources` row is invalid by schema constraint.

**Tenant isolation by RLS.** Postgres Row-Level Security is the enforcement mechanism. Every query is automatically scoped to the authenticated user via `auth.uid()`. The application code does not (and should not) filter by user_id manually. This is enforced at the database, not the application.

**Adjacency-list graphs, not Neo4j.** Entity-to-entity and claim-to-claim relations are stored in standard relational tables (`entity_relations`, `claim_relations`). pg_trgm and pgvector handle similarity. The system's graph queries are sufficiently bounded that adjacency-list patterns are correct; the operational simplicity of one database beats the marginal performance of two.

**Cost discipline at a single chokepoint.** Every paid operation passes through `approvePaidOperation()` before execution. There is no fallback path that silently tries more expensive providers. Workflows do not bypass the gate.

**Ingestion: webhooks, cron, AI queries, operator upload — all converging at the same gate.** The Ingestion Critic is the canonical gate. Sources arriving via any mechanism land with `ingestion_state = 'pending_critic'` and proceed only after the Critic produces a report and the operator approves (or auto-approval rules fire under explicit conditions).

**LLM-as-transcriber explicitly forbidden.** Models hallucinate transcripts from URL metadata. Path A (free YouTube captions via `youtube-transcript-api`) and Path B (paid AssemblyAI / `gpt-4o-mini-transcribe`) are the only paths. There is no Path C.

---

## 2. THE SUBSTRATE

The substrate is a Postgres schema (Postgres 15+ via Supabase). It is the system's memory and its source of truth. Everything else reads from and writes to substrate.

### 2.1 Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- fuzzy text matching
CREATE EXTENSION IF NOT EXISTS "vector";         -- pgvector for semantic similarity
CREATE EXTENSION IF NOT EXISTS "btree_gin";      -- composite indexes including jsonb
```

### 2.2 Enums

```sql
CREATE TYPE admiralty_grade AS ENUM ('A', 'B', 'C', 'D', 'E', 'F');

CREATE TYPE verification_status AS ENUM (
  'unverified', 'grounded', 'partial', 'unsupported', 'contested'
);

CREATE TYPE ipcc_likelihood AS ENUM (
  'virtually_certain', 'very_likely', 'likely',
  'about_as_likely_as_not', 'unlikely', 'very_unlikely',
  'exceptionally_unlikely'
);

CREATE TYPE entity_type AS ENUM (
  'person', 'organization', 'institution', 'corporation',
  'department', 'office', 'university', 'cluster',
  'legislation', 'event', 'concept', 'document', 'location', 'role'
);

CREATE TYPE claim_layer AS ENUM (
  'factual', 'framing', 'architectural', 'distributive'
);

CREATE TYPE thesis_status AS ENUM (
  'declared', 'in_progress', 'mature', 'archived', 'retracted'
);

CREATE TYPE article_status AS ENUM (
  'draft', 'review', 'published', 'corrected', 'retracted'
);

CREATE TYPE prediction_status AS ENUM (
  'active', 'resolved_correct', 'resolved_incorrect',
  'resolved_ambiguous', 'expired_unresolved', 'retracted'
);

CREATE TYPE contradiction_posture AS ENUM (
  'open', 'resolved_a', 'resolved_b', 'machloket', 'retired'
);

CREATE TYPE assumption_status AS ENUM (
  'holding', 'weakening', 'failed', 'strengthened'
);

CREATE TYPE source_type AS ENUM (
  'document', 'video', 'audio', 'transcript', 'webpage',
  'social_post', 'filing', 'gazette', 'press_release',
  'book', 'academic_paper', 'research_brief'
);

CREATE TYPE ingestion_mode AS ENUM (
  'operator_upload', 'webhook_push', 'cron_pull',
  'research_brief', 'derived', 'ai_query'
);

CREATE TYPE ingestion_state AS ENUM (
  'pending_critic', 'pending_approval', 'approved',
  'deferred', 'rejected', 'auto_approved'
);

CREATE TYPE role_name AS ENUM (
  'interrogator', 'red_team', 'steelman', 'premortem',
  'verifier', 'gap_surfacer', 'calibration', 'tier_projector',
  'assumption_auditor', 'ingestion_critic', 'indicator_validator',
  'claim_extraction', 'entity_resolver', 'claim_deduplicator',
  'solution_inventory_builder', 'argument_mapper', 'genealogy_tracer'
);

CREATE TYPE cost_operation_type AS ENUM (
  'claude_completion', 'gpt5_verification', 'gemini_verification',
  'transcription_assemblyai', 'transcription_openai',
  'apify_scrape', 'flux_generation', 'replicate_generation',
  'kling_video', 'runway_video', 'veo_video',
  'sedar_fetch', 'other_paid'
);

CREATE TYPE claim_relation_type AS ENUM (
  'supports', 'contradicts', 'refines', 'depends_on',
  'derives_from', 'rebuts'
);

CREATE TYPE watch_pin_type AS ENUM (
  'pinned', 'tracked', 'derived', 'excluded'
);

CREATE TYPE question_status AS ENUM (
  'open', 'answered', 'deferred', 'retired'
);

CREATE TYPE book_ingest_mode AS ENUM (
  'surface', 'substrate', 'influence'
);

CREATE TYPE production_format AS ENUM (
  'long_video', 'short_video', 'video_essay', 'audio_essay',
  'article', 'thread', 'newsletter', 'documentary'
);

CREATE TYPE article_type AS ENUM (
  'intelligence_thesis',   -- 40-80 pages, IC format, graph-sourced
  'policy_brief',          -- 10-20 pages, structural-level recommendation
  'argument_map',          -- full argument tree for a contested question
  'solution_inventory',    -- comparative analysis of tried interventions
  'root_cause_analysis',   -- Five Whys protocol output
  'prediction_log',        -- running log of banked predictions
  'book_chapter',          -- part of a book-length work
  'investigation_note'     -- shorter, faster, single-claim or single-event
);

CREATE TYPE intervention_level AS ENUM ('symptom', 'mechanism', 'structural');

CREATE TYPE production_state AS ENUM (
  'ready', 'recording', 'producing', 'publish',
  'perf', 'archive', 'discarded'
);

CREATE TYPE beat_status AS ENUM (
  'pending', 'recording', 'recorded', 'rerecord_needed', 'skipped'
);

CREATE TYPE beat_role AS ENUM (
  'open', 'context', 'turn', 'evidence', 'reflect',
  'close', 'transition'
);
```

### 2.3 Users and cost

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  publication_handle TEXT UNIQUE,
  monthly_ceiling_cents INTEGER NOT NULL DEFAULT 5000,
  ingestion_apis_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  cascade_cron_expr TEXT NOT NULL DEFAULT '0 11 * * *',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The `ingestion_apis_enabled` column is the master toggle for all automated external ingestion (webhook intake, cron pulls, AI-driven queries). Default off — operator-driven only. Operator turns it on when comfortable.

```sql
CREATE TABLE public.cost_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  operation_type cost_operation_type NOT NULL,
  provider TEXT NOT NULL,
  model_or_sku TEXT,
  cost_cents INTEGER NOT NULL,
  related_role_invocation_id UUID,
  related_source_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by_operator BOOLEAN NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_ledger_user_month ON public.cost_ledger (user_id, occurred_at DESC);

CREATE TABLE public.cost_whitelists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  operation_type cost_operation_type NOT NULL,
  per_op_max_cents INTEGER NOT NULL,
  daily_max_cents INTEGER,
  monthly_max_cents INTEGER,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, operation_type)
);
```

### 2.4 Sources and ingestion

```sql
CREATE TABLE public.sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_type source_type NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  publication TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admiralty_grade admiralty_grade NOT NULL,
  bias_profile JSONB,
  ingestion_mode ingestion_mode NOT NULL,
  ingestion_state ingestion_state NOT NULL DEFAULT 'pending_critic',
  storage_uri TEXT,
  raw_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_sources_user_state ON public.sources (user_id, ingestion_state, retrieved_at DESC);
CREATE INDEX idx_sources_user_grade ON public.sources (user_id, admiralty_grade);
CREATE INDEX idx_sources_url ON public.sources (user_id, url) WHERE url IS NOT NULL;
CREATE INDEX idx_sources_title_trgm ON public.sources USING gin (title gin_trgm_ops);

CREATE TABLE public.ingestion_critic_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  role_invocation_id UUID,
  proposed_grade admiralty_grade NOT NULL,
  bias_assessment TEXT NOT NULL,
  compatibility_check TEXT NOT NULL,
  contradiction_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  watch_set_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  paid_op_required BOOLEAN NOT NULL DEFAULT FALSE,
  paid_op_estimate_cents INTEGER,
  reasoning TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ingestion_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  action ingestion_state NOT NULL CHECK (action IN ('approved', 'deferred', 'rejected', 'auto_approved')),
  notes TEXT,
  acted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.5 Entities

```sql
CREATE TABLE public.entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entity_type entity_type NOT NULL,
  canonical_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  slug TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_excluded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_entities_user_type ON public.entities (user_id, entity_type);
CREATE INDEX idx_entities_canonical_trgm ON public.entities USING gin (canonical_name gin_trgm_ops);
CREATE INDEX idx_entities_aliases ON public.entities USING gin (aliases);
CREATE INDEX idx_entities_embedding ON public.entities USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE public.entity_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  mention_text TEXT NOT NULL,
  context_excerpt TEXT,
  position_start INTEGER,
  position_end INTEGER,
  resolution_confidence NUMERIC(3,2),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entity_mentions_source ON public.entity_mentions (source_id);
CREATE INDEX idx_entity_mentions_entity ON public.entity_mentions (entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_entity_mentions_unresolved ON public.entity_mentions (user_id, source_id) WHERE entity_id IS NULL;
```

The `entity_mentions.entity_id` is nullable. Mentions accumulate unresolved; the entity resolution pipeline (Section 5) resolves them. The substrate is queryable even with unresolved mentions; entity pages just don't surface them yet.

### 2.6 Claims

```sql
CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_version_id UUID,
  layer claim_layer NOT NULL DEFAULT 'factual',
  admiralty_grade admiralty_grade NOT NULL,
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  ipcc_qualifier ipcc_likelihood,
  is_linchpin BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  embedding vector(1536),
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_claims_user_layer ON public.claims (user_id, layer);
CREATE INDEX idx_claims_user_grade ON public.claims (user_id, admiralty_grade);
CREATE INDEX idx_claims_user_status ON public.claims (user_id, verification_status);
CREATE INDEX idx_claims_linchpin ON public.claims (user_id) WHERE is_linchpin = TRUE;
CREATE INDEX idx_claims_embedding ON public.claims USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE public.claim_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  data TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  warrant TEXT,
  backing TEXT,
  qualifier TEXT,
  rebuttal TEXT,
  primary_source_id UUID NOT NULL REFERENCES public.sources(id),
  written_by_role role_name,
  written_by_role_invocation_id UUID,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (claim_id, version_number)
);

CREATE INDEX idx_claim_versions_current ON public.claim_versions (claim_id) WHERE is_current = TRUE;
CREATE INDEX idx_claim_versions_user ON public.claim_versions (user_id, created_at DESC);

ALTER TABLE public.claims
  ADD CONSTRAINT fk_claims_current_version
  FOREIGN KEY (current_version_id) REFERENCES public.claim_versions(id);

CREATE TABLE public.claim_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  role_in_claim TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (claim_id, entity_id, role_in_claim)
);

CREATE TABLE public.claim_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  supports BOOLEAN NOT NULL,
  excerpt TEXT,
  excerpt_position JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (claim_id, source_id, supports)
);

CREATE TABLE public.claim_relations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  to_claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  relation_type claim_relation_type NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_claim_id, to_claim_id, relation_type)
);

CREATE TABLE public.entity_relations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  to_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  derived_from_claim_id UUID REFERENCES public.claims(id),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.7 Theses

```sql
CREATE TABLE public.theses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_version_id UUID,
  status thesis_status NOT NULL DEFAULT 'declared',
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cynefin_domain TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE TABLE public.thesis_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thesis_id UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  seed_paragraph TEXT NOT NULL,
  bluf TEXT,
  tier_80 TEXT,
  tier_800 TEXT,
  tier_full TEXT,
  ipcc_likelihood ipcc_likelihood,
  written_by_role role_name,
  written_by_role_invocation_id UUID,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (thesis_id, version_number)
);

CREATE TABLE public.thesis_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  layer claim_layer NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  UNIQUE (thesis_id, claim_id, layer)
);

CREATE TABLE public.thesis_watch_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
  exclusion_term TEXT,
  pin_type watch_pin_type NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (entity_id IS NOT NULL OR exclusion_term IS NOT NULL)
);

CREATE TABLE public.thesis_concept_spine (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  concept_text TEXT NOT NULL,
  ordering INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (thesis_id, concept_text)
);

CREATE TABLE public.thesis_inbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  routed_by TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acted_at TIMESTAMPTZ,
  action TEXT,
  UNIQUE (thesis_id, claim_id)
);
```

### 2.8 Assumptions, indicators, contradictions

```sql
CREATE TABLE public.assumptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status assumption_status NOT NULL DEFAULT 'holding',
  is_linchpin BOOLEAN NOT NULL DEFAULT FALSE,
  consequence_if_failed TEXT,
  last_audited_at TIMESTAMPTZ,
  last_audit_role_invocation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.assumption_supporting_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assumption_id UUID NOT NULL REFERENCES public.assumptions(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assumption_id, claim_id)
);

CREATE TABLE public.indicators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  definition TEXT NOT NULL,
  source_uri TEXT,
  cadence TEXT,
  current_value JSONB,
  current_value_observed_at TIMESTAMPTZ,
  threshold_for_confirm JSONB,
  threshold_for_disconfirm JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.indicator_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  observed_value JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  source_id UUID REFERENCES public.sources(id),
  resolved_predictions UUID[] DEFAULT '{}',
  written_by_role_invocation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.contradictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claim_a_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  claim_b_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  posture contradiction_posture NOT NULL DEFAULT 'open',
  description TEXT NOT NULL,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  detected_by_role role_name,
  detected_by_role_invocation_id UUID,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (claim_a_id != claim_b_id)
);
```

### 2.9 Predictions

```sql
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  confidence NUMERIC(5,4) NOT NULL CHECK (confidence > 0 AND confidence < 1),
  ipcc_qualifier ipcc_likelihood,
  resolution_criterion TEXT NOT NULL,
  banked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolves_by TIMESTAMPTZ,
  status prediction_status NOT NULL DEFAULT 'active',
  resolved_at TIMESTAMPTZ,
  resolved_outcome TEXT,
  resolution_evidence_source_id UUID REFERENCES public.sources(id),
  resolution_indicator_id UUID REFERENCES public.indicators(id),
  brier_contribution NUMERIC(7,6),
  domain TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.10 Articles

```sql
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_version_id UUID,
  thesis_id UUID REFERENCES public.theses(id),
  status article_status NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  read_time_minutes INTEGER,
  word_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE TABLE public.article_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  body_markdown TEXT NOT NULL,
  body_html TEXT,
  excerpt TEXT,
  written_by_role_invocation_id UUID,
  change_summary TEXT,
  is_correction BOOLEAN NOT NULL DEFAULT FALSE,
  correction_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, version_number)
);

CREATE TABLE public.article_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  position_in_body INTEGER,
  citation_label TEXT,
  UNIQUE (article_id, claim_id, position_in_body)
);

CREATE TABLE public.article_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  what_changed TEXT NOT NULL,
  why TEXT NOT NULL,
  prior_version_id UUID NOT NULL REFERENCES public.article_versions(id),
  new_version_id UUID NOT NULL REFERENCES public.article_versions(id),
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.11 Productions

The production engine has its own substrate. Productions are first-class objects, parallel to articles but for the video/audio pipeline.

```sql
CREATE TABLE public.productions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_script_id UUID,
  format production_format NOT NULL,
  state production_state NOT NULL DEFAULT 'ready',
  title TEXT NOT NULL,
  description TEXT,
  thesis_id UUID REFERENCES public.theses(id),
  source_cluster_refs UUID[] DEFAULT '{}',
  total_runtime_estimate_seconds INTEGER,
  estimated_production_cost_cents INTEGER,
  actual_production_cost_cents INTEGER,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_productions_user_state ON public.productions (user_id, state, updated_at DESC);

CREATE TABLE public.scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  production_id UUID NOT NULL REFERENCES public.productions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  generated_by_role_invocation_id UUID,
  coherence_check_passed BOOLEAN NOT NULL DEFAULT FALSE,
  coherence_check_notes TEXT,
  total_beat_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (production_id, version_number)
);

ALTER TABLE public.productions
  ADD CONSTRAINT fk_productions_current_script
  FOREIGN KEY (current_script_id) REFERENCES public.scripts(id);

CREATE TABLE public.beats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  ordering INTEGER NOT NULL,
  text TEXT NOT NULL,
  cue TEXT,
  duration_estimate_seconds INTEGER,
  beat_role beat_role NOT NULL,
  recording_status beat_status NOT NULL DEFAULT 'pending',
  recording_uri TEXT,
  recorded_at TIMESTAMPTZ,
  source_refs UUID[] DEFAULT '{}',
  claim_refs UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (script_id, ordering)
);

CREATE INDEX idx_beats_script ON public.beats (script_id, ordering);
CREATE INDEX idx_beats_status ON public.beats (script_id, recording_status);

CREATE TABLE public.production_publishes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  production_id UUID NOT NULL REFERENCES public.productions(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_url TEXT,
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.production_perf (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  production_id UUID NOT NULL REFERENCES public.productions(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  metrics JSONB NOT NULL,
  insight_text TEXT,
  insight_marked_canon BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.12 Roles, invocations, events

```sql
CREATE TABLE public.role_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name role_name NOT NULL,
  prompt_template TEXT NOT NULL,
  default_model TEXT NOT NULL,
  uses_citations_api BOOLEAN NOT NULL DEFAULT FALSE,
  uses_structured_output BOOLEAN NOT NULL DEFAULT FALSE,
  output_schema JSONB,
  skill_md_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE TABLE public.role_invocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_name role_name NOT NULL,
  triggered_by TEXT NOT NULL,
  input_substrate JSONB NOT NULL,
  prompt_used TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_cents INTEGER,
  cost_ledger_id UUID REFERENCES public.cost_ledger(id),
  output_text TEXT,
  output_structured JSONB,
  citations_returned JSONB,
  status TEXT NOT NULL,
  error_detail TEXT,
  cross_model_verification_id UUID,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_role_invocations_user_role ON public.role_invocations (user_id, role_name, created_at DESC);

CREATE TABLE public.orchestrator_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  entity_id UUID,
  entity_type_str TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_role_invocations UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orch_events_user_type ON public.orchestrator_events (user_id, event_type, created_at DESC);

CREATE TABLE public.cascade_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  triggered_by TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  sources_ingested INTEGER NOT NULL DEFAULT 0,
  claims_written INTEGER NOT NULL DEFAULT 0,
  questions_generated INTEGER NOT NULL DEFAULT 0,
  contradictions_detected INTEGER NOT NULL DEFAULT 0,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  role_invocation_ids UUID[] DEFAULT '{}',
  error_summary TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workflow_name TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  steps_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  role_invocation_ids UUID[] DEFAULT '{}',
  error_step TEXT,
  error_detail TEXT,
  output_summary JSONB
);
```

### 2.13 Questions, books

```sql
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  expected_information_gain NUMERIC(3,2),
  status question_status NOT NULL DEFAULT 'open',
  generated_by TEXT NOT NULL,
  generated_by_role_invocation_id UUID,
  parent_question_id UUID REFERENCES public.questions(id),
  answer_claim_id UUID REFERENCES public.claims(id),
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.question_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  to_question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_question_id, to_question_id, dependency_type)
);

CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  publication_year INTEGER,
  publisher TEXT,
  ingest_mode book_ingest_mode NOT NULL,
  source_id UUID REFERENCES public.sources(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.14 Entity resolution support

```sql
CREATE TABLE public.entity_resolution_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mention_id UUID NOT NULL REFERENCES public.entity_mentions(id) ON DELETE CASCADE,
  resolved_to_entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  decision_source TEXT NOT NULL CHECK (decision_source IN ('llm_auto', 'llm_then_operator', 'operator_only', 'rule_based')),
  decision TEXT NOT NULL CHECK (decision IN ('match', 'no_match', 'new_entity', 'split')),
  confidence NUMERIC(3,2),
  candidates_evaluated UUID[] DEFAULT '{}',
  signals JSONB,
  reasoning TEXT,
  role_invocation_id UUID REFERENCES public.role_invocations(id),
  operator_acted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.entity_merge_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('merge', 'split')),
  primary_entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  affected_entity_ids UUID[] NOT NULL,
  affected_mention_ids UUID[] NOT NULL DEFAULT '{}',
  affected_claim_ids UUID[] NOT NULL DEFAULT '{}',
  reasoning TEXT NOT NULL,
  performed_by TEXT NOT NULL CHECK (performed_by IN ('operator', 'automatic_recall')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.entity_resolution_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mention_id UUID NOT NULL REFERENCES public.entity_mentions(id) ON DELETE CASCADE,
  candidate_entity_ids UUID[] NOT NULL,
  llm_decision TEXT,
  llm_confidence NUMERIC(3,2),
  llm_reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'deferred')),
  surfaced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
```

### 2.15 Adversarial role outputs

```sql
CREATE TABLE public.red_team_objections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  role_invocation_id UUID NOT NULL REFERENCES public.role_invocations(id),
  vantage TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  objection_text TEXT NOT NULL,
  severity TEXT NOT NULL,
  what_would_change_my_mind TEXT NOT NULL,
  steelman_response TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.premortem_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  role_invocation_id UUID NOT NULL REFERENCES public.role_invocations(id),
  failure_scenario TEXT NOT NULL,
  failure_modes JSONB NOT NULL,
  early_warning_indicators JSONB NOT NULL,
  falsifying_observation TEXT NOT NULL,
  is_falsifiable BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.gap_surfacer_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  role_invocation_id UUID NOT NULL REFERENCES public.role_invocations(id),
  stage_results JSONB NOT NULL,
  structural_holes JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_gaps_surfaced INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.16 Public site materializations

```sql
CREATE TABLE public.pub_articles_cache (
  article_id UUID PRIMARY KEY REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  slug TEXT NOT NULL,
  rendered_html TEXT NOT NULL,
  schema_org_json JSONB NOT NULL,
  open_graph_json JSONB NOT NULL,
  rendered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`pub_theses_cache`, `pub_entities_cache`, `pub_sources_cache`, `pub_claims_cache`, `pub_predictions_cache`, `pub_contradictions_cache`, `pub_productions_cache` follow the same pattern.

```sql
CREATE TABLE public.pub_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  channels TEXT[] NOT NULL DEFAULT '{}',
  thesis_filters UUID[] DEFAULT '{}',
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  confirm_token TEXT,
  unsubscribe_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  UNIQUE (user_id, email)
);
```

### 2.17 RLS policies

Every table above has Row-Level Security enabled with this base pattern:

```sql
ALTER TABLE public.[table_name] ENABLE ROW LEVEL SECURITY;

CREATE POLICY [table_name]_owner_all ON public.[table_name]
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

Tables that have public-readable rows (theses, articles, predictions, contradictions, productions where is_public=TRUE) add a public-read policy:

```sql
CREATE POLICY [table_name]_public_read ON public.[table_name]
  FOR SELECT
  USING (is_public = TRUE);
```

The `pub_*_cache` tables have anonymous read enabled:

```sql
CREATE POLICY pub_cache_anon_read ON public.pub_articles_cache
  FOR SELECT
  USING (TRUE);
```

A deny-by-default RLS test matrix runs in CI before any deploy: a test suite using the anon key attempts to read every non-public table and fails the build if any read succeeds.

### 2.18 Materialized views

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

CREATE MATERIALIZED VIEW public.mv_entity_centrality AS
SELECT
  e.id AS entity_id,
  e.user_id,
  e.canonical_name,
  e.entity_type,
  COUNT(DISTINCT er.id) AS relation_count,
  COUNT(DISTINCT ce.claim_id) AS claim_count
FROM public.entities e
LEFT JOIN public.entity_relations er ON (er.from_entity_id = e.id OR er.to_entity_id = e.id)
LEFT JOIN public.claim_entities ce ON ce.entity_id = e.id
GROUP BY e.id, e.user_id, e.canonical_name, e.entity_type;

CREATE UNIQUE INDEX ON public.mv_entity_centrality (entity_id);
```

### 2.18.5 Intellectual output framework

The substrate supporting CANOPTICON's published outputs (intelligence theses, policy briefs, argument maps, solution inventories, root cause analyses). The full discipline is specified in the companion document `canopticon-output.md`; this section gives the schema.

```sql
CREATE TABLE public.five_whys_chains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  problem_statement TEXT NOT NULL,
  why_1 TEXT NOT NULL,
  why_2 TEXT NOT NULL,
  why_3 TEXT NOT NULL,
  why_4 TEXT,
  why_5 TEXT,
  reached_root BOOLEAN NOT NULL DEFAULT FALSE,
  supporting_claim_ids UUID[] DEFAULT '{}',
  generated_by_role_invocation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.solution_inventories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  domain TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.solution_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.solution_inventories(id) ON DELETE CASCADE,
  solution_name TEXT NOT NULL,
  intervention_level intervention_level NOT NULL,
  jurisdictions TEXT[] NOT NULL DEFAULT '{}',
  date_range_start DATE,
  date_range_end DATE,
  conditions TEXT NOT NULL,
  results TEXT NOT NULL,
  why_it_worked TEXT,
  why_it_failed TEXT,
  exportability TEXT,
  proponents_claim TEXT,
  critics_claim TEXT,
  real_disagreement TEXT NOT NULL,
  supporting_claim_ids UUID[] DEFAULT '{}',
  supporting_source_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.argument_maps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  domain TEXT NOT NULL,
  argument_tree JSONB NOT NULL,
    -- Six layers: surface, evidence, dependencies, empirical_disputes,
    -- values_disputes, meta. See canopticon-output.md §5.5.
  root_causes TEXT[] NOT NULL DEFAULT '{}',
  symptom_level_interventions TEXT[] DEFAULT '{}',
  mechanism_level_interventions TEXT[] DEFAULT '{}',
  structural_level_interventions TEXT[] DEFAULT '{}',
  related_thesis_ids UUID[] DEFAULT '{}',
  related_solution_inventory_id UUID REFERENCES public.solution_inventories(id),
  related_genealogy_id UUID,
  status TEXT NOT NULL DEFAULT 'in_progress',
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.frame_genealogies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  frame_text TEXT NOT NULL,
  domain TEXT NOT NULL,
  first_appeared DATE,
  first_appearance_source_id UUID REFERENCES public.sources(id),
  introduced_by_entity_ids UUID[] DEFAULT '{}',
  amplified_by_entity_ids UUID[] DEFAULT '{}',
  funder_entity_ids UUID[] DEFAULT '{}',
  funder_material_interest TEXT,
  propagation_timeline JSONB,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.book_chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  ordering INTEGER NOT NULL,
  title TEXT NOT NULL,
  thesis_cluster_refs UUID[] DEFAULT '{}',
  prior_chapter_summary TEXT,
  draft_status TEXT NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (book_id, ordering)
);
```

Additions to existing tables:

```sql
ALTER TABLE public.theses
  ADD COLUMN coined_phrase TEXT,
  ADD COLUMN coined_phrase_definition TEXT,
  ADD COLUMN coined_phrase_first_uses TEXT[] DEFAULT '{}',
  ADD COLUMN diagram_uri TEXT,
  ADD COLUMN intervention_level intervention_level;

ALTER TABLE public.articles
  ADD COLUMN article_type article_type NOT NULL DEFAULT 'investigation_note',
  ADD COLUMN intervention_level intervention_level;
```

The publish-prep workflow enforces undismissability checks against these columns. A thesis cannot reach `is_public = TRUE` without a coined phrase, a diagram, an associated `five_whys_chains` row with `reached_root = TRUE`, and the other requirements documented in `canopticon-output.md` §7.

---

### 2.19 Triggers

Three triggers operate on every substrate table:

```sql
-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- single-current-version enforcement (claims, theses, articles, scripts)
CREATE OR REPLACE FUNCTION public.enforce_single_current()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = TRUE THEN
    EXECUTE format('UPDATE public.%I SET is_current = FALSE WHERE %I = $1 AND id != $2 AND is_current = TRUE',
      TG_TABLE_NAME, TG_ARGV[0])
      USING NEW.[parent_id_column], NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- automatic event emission on substrate writes
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
```

---

## 3. THE ROLES

CANOPTICON has 17 named roles, each a Claude Skill. Each role is a prompt template invoked at specific points by orchestrator code reacting to substrate events. Roles read from substrate, write back to substrate, and emit events.

### 3.1 Shared primitives

**Substrate snapshot.** When the orchestrator invokes a role, it builds a JSON snapshot of the relevant substrate slice. The snapshot is bounded in size; large theses paginate. Pagination strategy: order by (is_linchpin desc, grade asc, updated_at desc), drop low-priority items until size fits, log the truncation.

**Standard output envelope.** Every structured-output role wraps its output in a common envelope:

```json
{
  "role": "interrogator",
  "role_invocation_id": "uuid",
  "input_summary": "string — what the role read",
  "result": { /* role-specific payload */ },
  "self_assessment": {
    "confidence": "high | medium | low",
    "limitations": "string — what I couldn't do or wasn't sure about",
    "follow_ups_recommended": ["string"]
  }
}
```

**Cost gate.** Every role invocation passes through `approvePaidOperation()` before the API call. Cost is logged to `cost_ledger`.

### 3.2 The 17 roles

For each role: trigger, reads, writes, model, API features, prompt template, output schema. The full prompt templates and JSON schemas live in the `/skills/{role-name}/SKILL.md` files. This document provides the operational summary; the SKILL.md files are the deployable artifact.

**1. Ingestion Critic.** Fires automatically on `source.created` events for sources with `ingestion_state = 'pending_critic'`. Reads the source row plus active theses' watch-sets and concept spines plus existing claims for contradiction check. Writes one row to `ingestion_critic_reports`. Updates `sources.ingestion_state` to `'pending_approval'` or `'auto_approved'`. Uses `claude-opus-4-7` with structured outputs. The Critic is the gate; correctness here matters more than cost.

**2. Verifier.** Fires on `claim.created` and `claim.updated`. Reads the target claim and all sources cited as `claim_sources.supports = TRUE`. Writes verification status to `claims.verification_status`. Uses `claude-opus-4-7` with the Citations API. Optionally cross-model with GPT-5 or Gemini for high-stakes claims (operator-toggled). Two-call pattern per claim: Citations call to ground, structured-outputs call to extract status.

**3. Interrogator.** Fires on `thesis.updated`. Reads thesis state, integrated claims, open questions (to avoid duplicates), recent role outputs. Writes 3-7 questions to `questions` with EIG scores. Uses `claude-opus-4-7` with structured outputs.

**4. Red Team.** Fires when a thesis crosses confidence threshold or operator-invoked. Reads thesis with current version and BLUF, top-claims, linchpins, existing objections. Writes rows to `red_team_objections`. Uses `claude-opus-4-7` with structured outputs. Six vantages: historian-50yr, contrarian-economist, opposing-political-tradition, foreign-observer, base-rate-skeptic, methodological-skeptic. Operator picks vantage at invocation.

**5. Steelman.** Fires after Red Team objections (severity ≥ moderate) or on contradiction resolution. Constructs the strongest opposing position. Three recommendations: rebutted, machloket, update. Writes to `red_team_objections.steelman_response`. Uses `claude-opus-4-7` with structured outputs.

**6. Premortem.** Operator-invokable; runs automatically before any thesis goes public. Imagines the thesis has been wrong; reasons backward to failure mode. Writes to `premortem_reports`. Required output: at least one falsifying observation, or `is_falsifiable = FALSE` flag. Uses `claude-opus-4-7` with structured outputs.

**7. Gap Surfacer.** Runs in selected morning cascades (rotation-based on activity); operator-invokable. Reads thesis substrate plus adjacent unintegrated claims plus existing indicators. Writes to `gap_surfacer_reports`. Seven-stage sweep:

   - Stage 1: Missing entities
   - Stage 2: Missing relations
   - Stage 3: Missing counter-evidence
   - Stage 4: Missing time periods
   - Stage 5: Missing stakeholder perspectives
   - Stage 6: Missing comparison cases
   - Stage 7: Missing disconfirming indicators

   Each stage returns 0-4 gaps with concrete next steps. Plus a `structural_holes` array identifying where clusters of substrate connect through narrow bridges (Burt's structural-hole concept applied to the claim graph).

**8. Calibration.** Runs nightly; fires on `indicator.observed` events. Reads recent resolved predictions, prediction history, indicators with new observations. Updates `predictions.status`, `resolved_at`, `resolved_outcome`, `brier_contribution`. Refreshes `mv_brier_rolling`. Optionally uses Citations API for resolutions needing source-grounding.

**9. Tier Projector.** Fires on `thesis.updated`. Reads thesis current version, all claims in `thesis_claims`, linchpins, contradictions, anchored predictions. Writes BLUF, 80-word, 800-word, full markdown to `thesis_versions`. Sets `ipcc_likelihood` based on weighted claim-grade ratio. Uses `claude-opus-4-7`. Outputs four markdown blocks separated by tier-break markers; orchestrator parses and stores each.

   IPCC qualifier derivation:
   ```
   weighted_support = Σ(grade_weight × supports_thesis_conclusion)
   weighted_total   = Σ(grade_weight)
   grade_weight: A=4, B=3, C=2, D=1, E=0, F=0
   ratio = weighted_support / weighted_total
   ratio ≥ 0.99 → virtually_certain
   ratio ≥ 0.90 → very_likely
   ratio ≥ 0.66 → likely
   0.33 ≤ ratio < 0.66 → about_as_likely_as_not
   ratio < 0.33 → unlikely
   ```
   Full-tier regenerates weekly only (cost optimization). BLUF/80/800 regenerate every cascade.

**10. Assumption Auditor.** Runs weekly; fires when a supporting claim is downgraded or refuted. Reads all assumptions plus supporting claims plus recent verifier outputs. Updates `assumptions.status`. Special handling for linchpins: status changes emit `linchpin.status_changed` with high priority. Uses `claude-opus-4-7` with structured outputs.

**11. Indicator Validator.** Fires when operator declares a new indicator or a new observation is recorded. Validates well-formedness on declaration; validates value consistency on observation. Approves/rejects via `indicators.is_active` or `indicator_observations` insertion. Uses `claude-opus-4-7` for declaration validation; smaller model acceptable for routine observation validation.

**12. Claim Extraction.** Fires after a source is approved. Reads source body, source metadata, active thesis concept spines (relevance hint). Returns 0-10 atomic claims per source with full Toulmin structure. Uses `claude-opus-4-7` with structured outputs. The orchestrator then writes `claims`, `claim_versions`, `claim_entities` (with unresolved entity_id NULL), and `claim_sources` rows.

**13. Entity Resolver.** Fires per unresolved entity mention in the cascade. Stage 3 of the entity resolution pipeline (Section 5). Compares one new mention against one candidate canonical entity; returns match / no_match / uncertain with confidence and weighted signals.

**14. Claim Deduplicator.** Fires per newly-extracted claim with non-empty candidate set. Returns one of four relationships: duplicate / refinement / contradiction / distinct. Drives the claim deduplication pipeline (Section 5).

**15. Solution Inventory Builder.** Operator-invokable when working on a contested policy question. Reads relevant claim subgraph plus operator-provided research briefs plus web search results across named jurisdictions. Writes one `solution_inventories` row plus a set of `solution_entries` rows, each with intervention_level tagged. Cost-gated. Uses `claude-opus-4-7` with structured outputs and the Citations API for source-grounding the per-jurisdiction claims.

**16. Argument Mapper.** Operator-invokable when a contested question has accumulated enough substrate. Reads the question, the relevant claim subgraph, related theses, related solution inventories, related genealogies. Writes one `argument_maps` row with the full six-layer JSONB tree. The role explicitly distinguishes between Layer 4 empirical disputes (resolvable in principle by evidence) and Layer 5 values disputes (genuine prior disagreements that evidence cannot resolve). Refuses to collapse one into the other. Uses `claude-opus-4-7` with structured outputs.

**17. Genealogy Tracer.** Operator-invokable when investigating frame propagation. Reads the named frame, the entity graph (organizations, funders, media outlets, think tanks), the source registry timeline. Writes one `frame_genealogies` row with first-appearance, introducer, amplifiers, funders, and material-interest analysis. Cost-gated; uses web search and queries against external corporate-disclosure databases. Uses `claude-opus-4-7` with structured outputs.

### 3.3 Cross-model verification

The Verifier (and optionally Red Team and Premortem) supports cross-model invocation. Operator toggles per-role in `role_definitions.metadata.cross_model_enabled`. When active:

```
function invokeWithCrossModel(role, snapshot):
  primary = invokeRole(role, snapshot, model='claude-opus-4-7')
  if not user.allow_cross_model: return primary
  
  secondary_model = user.preferences.cross_model_choice
  secondary = invokeRole(role, snapshot, model=secondary_model)
  
  agreement = compareResults(primary, secondary)
  if agreement == 'agree': return primary
  if agreement == 'minor_disagreement': return moreConservative(primary, secondary)
  if agreement == 'major_disagreement':
    flagForOperator(primary, secondary)
    return contestedResult(primary, secondary)
```

Both invocations charge `cost_ledger`. Cross-model is gated by the cost discipline; if not whitelisted, operator approves the secondary call before it runs.

### 3.4 SKILL.md packaging

Each role ships as a directory:

```
/skills/{role-name}/
├── SKILL.md            # frontmatter + prompt body
├── schema.json         # JSON Schema for structured outputs
└── examples/           # populated as runs accumulate
```

SKILL.md frontmatter:

```yaml
---
name: ingestion-critic
version: 1.0
model: claude-opus-4-7
features:
  citations_api: false
  structured_output: true
  cross_model: false
hash: <auto-computed>
---
```

The orchestrator reads SKILL.md at runtime, computes a SHA-256 hash of the prompt body, compares to `role_definitions.skill_md_hash`, updates if changed, then invokes. Prompt iteration does not require redeploys.

---

## 4. WORKFLOWS

Workflows wire roles together. Each is a function (TypeScript on Cloudflare Workers) that reads substrate, invokes roles via the orchestrator, writes back to substrate, and emits events. Each writes a `workflow_runs` row tracking step completion for idempotency and recovery.

### 4.1 The cost gate

Every paid operation across every workflow passes through one function:

```
function approvePaidOperation(user, operation_type, estimated_cents):
  current_month_spent = sum(cost_ledger where user_id = user.id and same month)
  if current_month_spent + estimated_cents > user.monthly_ceiling_cents:
    block: "ceiling_reached"
    surface to operator
    return false
  
  whitelist = cost_whitelists for user, operation_type
  if whitelist.enabled and estimated_cents <= whitelist.per_op_max_cents:
    if (whitelist.daily_max_cents is null or daily_spent_op + estimated_cents <= whitelist.daily_max_cents)
       and (whitelist.monthly_max_cents is null or monthly_spent_op + estimated_cents <= whitelist.monthly_max_cents):
      return true  # auto-approved by whitelist
  
  prompt operator with cost approval modal
  wait for response (or workflow timeout)
  if approved: return true
  else: return false
```

This is the single chokepoint for the no-silent-spending discipline. Workflows do not bypass it.

### 4.2 The cascade

The system's primary workflow. Runs unattended from cron (Cloudflare Workers cron, configurable per user via `users.cascade_cron_expr`) or on-demand from the operator's "Run Cascade" button.

```
STEP 1 — Initialize
  Create cascade_runs row, status='running'
  Snapshot user's monthly_spent_cents
  Compute remaining ceiling budget
  Set per-step timeout (30s API calls, 5min total step)

STEP 2 — Ingest pending sources
  Query sources where ingestion_state = 'pending_critic'
  For each (in batches of 5, parallel):
    STEP 2a — Fetch source body if not yet stored
      If video and Path A succeeds: youtube-transcript-api (FREE)
      If video and Path A fails: cost gate → Path B (AssemblyAI/openai), pay
      If webpage: fetch + sanitize HTML (free)
      If filing requiring premium fetch: cost gate → fetch
    STEP 2b — Run Ingestion Critic (cost-gated)
      Persist ingestion_critic_reports row
      Update sources.ingestion_state to 'pending_approval' or 'auto_approved'

STEP 3 — Auto-approve where eligible
  For each source where Critic recommended auto_approve_recommended=TRUE
    AND user.auto_ingest_a_grade_uncontested=TRUE:
    Mark ingestion_state = 'auto_approved'
    Insert ingestion_actions row (action='auto_approved')

STEP 4 — Surface non-auto-approved sources
  Sources with ingestion_state='pending_approval' appear in Sources screen
  Cascade does not block on operator review

STEP 5 — Extract claims from approved sources
  For each auto-approved source AND each newly-operator-approved source since last cascade:
    STEP 5a — Cost gate
    STEP 5b — Invoke claim_extraction skill
    STEP 5c — Resolve entity mentions in this claim:
      For each mention:
        Stage 2 blocking → candidate entities
        If candidates AND Stage 3 matcher recommended:
          Cost gate, invoke entity_resolver, apply decision matrix
        Else: provisionally new entity OR queue for operator
    STEP 5d — Deduplicate against existing claims:
      Stage 2 blocking → candidate claims
      If candidates: cost gate, invoke claim_deduplicator, apply decision matrix
      Else: write as new claim
    STEP 5e — Insert new claim row (if not duplicate/refinement)
    STEP 5f — Insert claim_versions, claim_sources, claim_entities

STEP 6 — Verify newly-created claims
  For each claim with grade A or B:
    Cost gate (Claude API + Citations)
    Invoke verifier
    Update claim.verification_status
    If contradiction detected: insert contradictions row
    Cross-model verification only if claim is_linchpin or anchored to is_public thesis

STEP 7 — Route claims to thesis inboxes
  For each new claim, compute watch-set matches
  Insert thesis_inbox rows

STEP 8 — Generate Interrogator questions
  For each thesis with status='in_progress' AND new claims integrated:
    Cost gate, invoke interrogator
    Insert questions rows

STEP 9 — Run Gap Surfacer on selected theses
  Selection: theses with last_gap_sweep_at older than 7 days OR ≥5 new claims
  For each selected: cost gate, invoke gap_surfacer
  High-priority gaps (severity ≠ minor) become Live feed items

STEP 10 — Calibration sweep
  Find predictions where resolves_by has passed OR linked indicator has new observation
  For each: cost gate, invoke calibration
  Refresh mv_brier_rolling

STEP 11 — Tier Projector on updated theses
  For each thesis with new version since last cascade:
    Cost gate, invoke tier_projector
    Update thesis_versions tiers
    If thesis is_public: trigger pub_theses_cache rebuild

STEP 12 — Assumption Auditor (weekly)
  If last_assumption_audit_at older than 7 days
  Sweep all assumptions
  Update statuses; emit linchpin.status_changed if any linchpin changes

STEP 13 — Detect convergences
  Query recent claims (last 24h) grouped by entity overlap
  Compute convergence_score = (count_sources × grade_weight_avg) / time_window_hours
  If > 0.75: mark HOT, emit convergence.detected

STEP 14 — Run production ideation
  Query recent claims and theses with sufficient cluster volume
  For each high-scoring cluster: cost gate, invoke production_ideator (a utility skill)
  Emit production.proposed events; surface in Studio Ready

STEP 15 — Assemble Live feed
  The Live feed is a derived view, not a table. The operator's Live screen queries:
    Recent claims (24h, sorted HOT first, then grade)
    Pending ingestions
    New questions (last 24h)
    New contradictions
    Production-engine items by state
    Resolved predictions
    Convergences
    Errors / health flags

STEP 16 — Finalize
  Update cascade_runs (ended_at, status, statistics, role_invocation_ids)
  Emit cascade.completed event
```

### 4.3 Other workflows

**Ingestion-only.** Fires on webhook arrival or operator upload. Creates a source row with `ingestion_state = 'pending_critic'`, emits `source.created`, defers further work to next cascade. Exception: HOT-trigger patterns (operator-defined) run inline.

**Publish-prep.** Fires when operator presses "Publish" on a thesis or article. Runs Premortem + Red Team final pass + Verifier sweep on linchpins (cross-model) + Tier Projector full regen + the undismissability check matrix (see `canopticon-output.md` §7). The seven undismissability checks gate publication: evidence density, coined phrase declared, banked predictions present (≥3), teachable diagram linked, methodology appendix present, public graph artifact wired, named operator declared. Plus four explicit BLOCK conditions: not falsifiable, fatal failure mode, fatal Red Team objection, unsupported linchpin claim. Plus the root-striking check: a thesis publishing as `intelligence_thesis` requires an associated `five_whys_chains` with `reached_root = TRUE`. Operator confirms after warnings; only then `is_public = TRUE` flips.

**Contradiction resolution.** Fires when a new contradiction is detected or operator opens an open contradiction. Steelman both sides. Surface to operator. Operator chooses: resolve_a, resolve_b, machloket, retired, defer. Apply resolution; propagate to affected theses.

**Prediction resolution.** Fires when an indicator crosses a threshold or operator marks resolved. Calibration validates. Apply resolution; refresh mv_brier_rolling; trigger public-cache rebuild for public predictions.

**Watch-set update.** Fires on operator action. Apply update to `thesis_watch_sets`. Backfill: query existing `claim_entities` for the affected entity, insert `thesis_inbox` rows for unrouted matches.

**Production publish.** Fires when operator confirms publish on a Production. Schedule platform-specific publishes via `production_publishes`. Track via background jobs that call platform APIs and write `production_perf` as data flows back.

**Error recovery.** Fires when operator clicks "Retry" on a failed run. Resume from checkpoint via `workflow_runs.steps_completed`. Idempotency keys (`workflow_run_id + step_name + input_hash`) safely re-run if state is ambiguous.

### 4.4 Idempotency

Every role invocation is keyed by `(workflow_run_id, step_name, input_hash)`. Re-running a workflow with same inputs returns cached invocation results; does not re-charge cost. Substrate writes use natural keys for deduplication. State transitions are no-ops if already in target state.

### 4.5 Event bus

Event names follow `noun.verb_past_tense`. Subscribers register interest via patterns. The full canonical list:

```
source.created, source.critic_reported, source.approved, source.rejected, source.deferred
claim.created, claim.updated, claim.verified, claim.verification_contested, claim.verification_failed
claim.merged, claim.superseded
entity.created, entity.merged, entity.split, entity.relation_created
entity_mention.captured, entity_mention.resolved, entity_mention.queued_for_review
thesis.declared, thesis.updated, thesis.tiers_regenerated, thesis.published, thesis.archived, thesis.contradiction_resolved
contradiction.detected, contradiction.resolved, contradiction.machloket
assumption.audited, linchpin.status_changed
prediction.banked, prediction.resolved
indicator.observed, indicator.resolved_prediction
question.generated, question.answered
red_team.fired, steelman.completed, premortem.completed, gap.surfaced
production.proposed, production.recording_started, production.recording_paused, production.recording_completed,
production.producing_started, production.producing_completed, production.published, production.perf_observed
cost.operation_proposed, cost.operation_approved, cost.operation_denied
cost.ceiling_warning, cost.ceiling_reached, cost.operation_blocked
cascade.started, cascade.step_completed, cascade.completed, cascade.partial, cascade.errored, cascade.resumed
workflow.started, workflow.completed, workflow.errored
publish_run.started, publish_run.blocked, publish_run.confirmed, publish_run.cancelled
user.signed_in, user.signed_out, user.ceiling_changed, user.whitelist_changed
```

Events persist to `orchestrator_events` and broadcast via Supabase Realtime to subscribed clients.

---

## 5. ENTITY RESOLUTION & CLAIM DEDUPLICATION

The two hardest correctness problems in the substrate. Both use the same four-stage pipeline.

### 5.1 The four stages (entity resolution)

**Stage 1 — Capture.** Every entity mention found during claim extraction lands in `entity_mentions` with `entity_id = NULL`. The mention captures mention_text, context_excerpt, source_id, entity_type_hint.

**Stage 2 — Block.** Reduce candidate space before expensive matching. Filters:
- `pg_trgm` trigram similarity on `entities.canonical_name` and `entities.aliases[]` (threshold > 0.3, generous for recall)
- Exact-match on aliases (case-insensitive)
- Type-bucketing (person mentions don't match against legislation)
- pgvector embedding similarity (top-K=5) when embedding is populated

Output: 0 to ~5 candidate entities. Zero candidates → provisionally a new entity.

**Stage 3 — Match (LLM).** Per-pair evaluation by the `entity_resolver` role. Decisions: match / no_match / uncertain. Each decision carries weighted signals (name similarity, context match, type match, temporal fit, disambiguation evidence) and a confidence 0.00-1.00.

**Stage 4 — Decide and write.** Decision matrix:

| Decision | Confidence | Action |
|----------|-----------|--------|
| match | ≥ 0.85 | Auto-merge: set entity_mentions.entity_id, log to entity_resolution_log |
| match | 0.70–0.85 | Surface to operator; tentatively merge but flag |
| match | < 0.70 | Surface to operator; do not merge |
| uncertain | any | Surface to operator |
| no_match | ≥ 0.85 | Move to next candidate; if none left, create new entity |
| no_match | < 0.85 | Surface ambiguity to operator |

Operator review queue lives in `entity_resolution_queue`. Operator actions: confirm match, new entity, defer.

### 5.2 Claim deduplication

Same four stages applied to claims.

Stage 2 filters: same `layer`, shared entities (≥1 entity overlap in `claim_entities`), pg_trgm on `claim_text`, pgvector cosine similarity when populated.

Stage 3 role: `claim_deduplicator`. Four relationships:
- **Duplicate** — same claim, different sources. Link new source to existing; drop new claim.
- **Refinement** — new claim is more precise. Supersede; preserve old in claim_versions.
- **Contradiction** — claims disagree. Both stay; register in `contradictions`.
- **Distinct** — related but separate. Both stay independently.

### 5.3 Provenance guarantees

Three guarantees the system maintains:

1. **Every merge is reversible.** `entity_merge_history` and `claim_versions` preserve enough state to reconstruct any prior graph state. Bad merges can be split.
2. **Every match has reasoning.** No silent merges. Every decision logs its signals or operator's reasoning to `entity_resolution_log` or `claim_versions.change_summary`.
3. **Operator decisions trump LLM decisions.** When operator and LLM disagree, operator wins; divergence is logged for prompt refinement.

### 5.4 Edge cases

**Acronyms.** `aliases[]` array catches them. New acronyms get added when operator confirms a merge.

**Role-as-entity ambiguity.** "the Prime Minister" or "the Bank Governor" refer to a *role*. CANOPTICON makes the role a first-class entity (`entity_type = 'role'`). Mentions of "the PM" resolve to the role entity; the role entity has `entity_relations` to specific people with date ranges.

**Same name, different person.** Disambiguation via context. Without disambiguating context, decision is UNCERTAIN.

**Person becomes corporate agent.** Treat as one person entity; the relations change over time via `entity_relations.start_date`/`end_date`.

**Misspellings.** Stage 2 trigram similarity catches reasonable misspellings; aggressive misspellings surface to operator.

**Foreign-language renderings.** Aliased manually for now; future LLM-assisted alias generator suggests known renderings.

**Merging mistakes.** Operator triggers split via the entity page. `entity_merge_history` records the split; affected claims and mentions move; `entity_relations` are recomputed.

### 5.5 Accuracy expectations

Realistic targets, grounded in 2025 ER benchmarks:

- **Without semantic blocking:** ~85-90% precision on auto-merges, ~50-60% recall (most surface to operator).
- **With pgvector semantic blocking:** ~90% precision, ~70% recall.

Conservative by design. False positives (wrong merges) are harder to unwind than false negatives (missed merges). The operator review queue is the safety mechanism, not a flaw.

---

## 6. THE PRODUCTION ENGINE

The production engine takes substrate (claims, theses, sources) and walks it through ideation → script → chunked recording → auto-assembly → publication → performance → archive. It is not a separate system; it is part of CANOPTICON, sharing the same substrate, the same cost discipline, the same operator authority.

The engine produces video essays, documentary cuts, shorts, audio essays, and (via parallel `articles` substrate) written work. The operator's voice is the through-line; the substrate is the source material.

### 6.1 The six states

**Ready.** System has assembled a complete script — drafted from substrate, structurally coherent — and is presenting it for greenlight. The operator decides to start recording, open the script, discard, defer, or refine.

**Recording.** Script becomes a sequence of beats (10-30 second chunks). Operator records them one at a time, can pause, can re-record any beat without re-recording the rest, can resume across sessions and across devices. Auto-save after every beat.

**Producing.** All beats recorded. Automated post-production: stitch beats, auto-edit (silence trim, fillers, breath cuts), generate captions, generate thumbnails, match B-roll, generate platform-specific cuts (e.g., 9:16 from 16:9 source), render final files.

**Publish.** Production done. Operator does final review. Per-platform toggles, per-platform metadata, sanity flags, final cost tally. Publish all, publish to selected, schedule, hold.

**Perf.** Past publications with engagement data flowing back. Tier rating, per-platform stats, system-generated insights about what worked. Perf data feeds the ideation engine — what worked drives what gets surfaced as Ready next.

**Archive.** Everything published. Browsable, searchable, reusable as context for new productions.

### 6.2 Pipeline indicator

Five steps visible across every state:

**Script → Coherence → Record → Edit → Publish**

The "Coherence" step replaces what would be "Verify" in pure factual content. For productions drawing on grounded claims, coherence still includes source-grounding via the Verifier role. For productions that are more reflective or argumentative, coherence is structural — does the script hang together, does it follow from the substrate cluster it draws from, are the connections real.

### 6.3 Script-as-beats data model

Already specified in §2.11. The bridge between ideation and recording. A script is not a wall of text; it's an ordered sequence of `beats`. Each beat has text (what the operator says), optional cue (stage direction), beat_role (open/context/turn/evidence/reflect/close/transition), source_refs (substrate items this beat draws from), claim_refs (specific claims if this is grounded content), and recording_status.

The `beat_role` field lets the system reason about narrative shape. Useful for both ideation (drafting balanced narrative shapes) and Perf analysis (which roles correlate with engagement).

### 6.4 Ideation → Ready

The cascade STEP 14 invokes a `production_ideator` skill (a utility skill, parallel to `claim_extraction` in the role list). This skill:

1. **Cluster substrate.** Group recent claims/theses by entity overlap, time window, or thematic concept. Cluster strategies:
   - Temporal (this week's high-grade claims)
   - Thematic (claims tagged to a thesis's concept_spine)
   - Longitudinal (a thesis across months)
   - Convergence-driven (HOT clusters from cascade STEP 13)

2. **Score clusters.** Volume (enough substrate for minimum-length output), coherence (on-topic), recency, format fit, repeatability check (operator hasn't already produced from this exact cluster recently).

3. **Generate candidate scripts.** For each high-scoring cluster: title proposal, format proposal, beat-by-beat draft text, source/claim refs per beat, runtime estimate, cost estimate. The skill emits a `productions` row in state='ready' with an associated `scripts` row and `beats` rows.

4. **Coherence check.** Does the script hang together? Do the connections between beats follow from the substrate cluster, or has the model fabricated bridges? Coherence check sets `scripts.coherence_check_passed`. Failures don't progress to Ready.

5. **Surface as Ready.** The verified candidate appears in Studio's Ready tab. Operator reviews and either Starts Recording or Discards. Discards feed back: future ideation weighs the discard signal.

### 6.5 Recording → Producing

When operator taps "Start Recording" on a Ready item, the production state flips to 'recording'. Full-screen mode opens. Each beat displays as a large prominent text block with optional cue. Operator records one beat, system auto-advances unless paused. Each beat's audio/video file uploads to R2 immediately and is referenced by `beats.recording_uri`.

Resumability: every beat's recording is independent. Concatenation happens in Producing, not Recording. A half-recorded item is just a script with some beats having `recording_uri` populated and some null.

When all beats are recorded (or skipped beats are explicitly accepted), state flips to 'producing'. The Producing state runs:

- Stitch beats via ffmpeg (concatenation, optional crossfade)
- Auto-edit pass (silence trim, filler removal, breath cuts)
- Caption generation via Whisper or AssemblyAI (cost-gated)
- Thumbnail generation (for video formats; cost-gated if hi-fi)
- B-roll matching from project's media library (if applicable)
- Platform-specific cuts (9:16 vertical from 16:9 source for shorts platforms)
- Final render

Each step writes progress to `productions.metadata` and emits `production.producing_started` / `production.producing_completed` events.

### 6.6 Publish → Perf

Operator reviews each platform-specific cut. Toggles per platform. Edits captions, thumbnails, descriptions. Schedules or publishes immediately. The orchestrator creates `production_publishes` rows for each platform and dispatches background jobs that call platform APIs.

Background jobs poll platform APIs for engagement data and write to `production_perf`. The Calibration role (or a related performance-analysis role to be added) extracts insights — which beat_roles correlated with watch-time, which titles outperformed, which formats performed best at which length — and writes `insight_text`. Operator marks insights as canon to feed prompt-tuning for the production_ideator.

### 6.7 Aesthetic register

Studio inherits the same dark-cockpit register as the rest of the operator app: warm dark backgrounds (`#0f1218`, slightly tan), cream/bone as primary UI accent (`#ede9de`), amber for caution states, red rare and meaningful (recording-in-progress is one of the few legitimate red signals), sage for verified/done, muted blue for neutral metadata.

Typography: EB Garamond serif for content (titles, beat text, descriptions), JetBrains Mono for metadata (timestamps, format labels, status chips, beat counts). Subtle SVG grain at low opacity. No rounded corners (≤2px). No drop shadows. No glassmorphism.

The Recording UI specifically: beat text is the largest element on screen, easily readable at arm's length, with the operator's job being simply to read it aloud. Everything else (cue, waveform, buttons, beat-progress dots) is small. Friction kills delivery; the design minimizes it.

---

## 7. INGESTION SOURCES

Sources can arrive through multiple channels. All converge at the Ingestion Critic gate; none bypass it.

### 7.1 The four ingestion modes

**operator_upload.** Operator pastes a URL, uploads a file, or types/dictates text directly via the Sources screen. Default behavior; available regardless of `users.ingestion_apis_enabled`.

**webhook_push.** External provider POSTs to a signed endpoint. Examples: YouTube PubSubHubbub for new uploads on watched channels, openparliament.ca push notifications, X stream filtered to watched accounts, generic operator-defined webhooks. Active only when `users.ingestion_apis_enabled = TRUE`.

**cron_pull.** Cloudflare Workers cron handlers run scheduled fetches against upstream APIs that don't support push. Examples: Hansard via openparliament.ca every 6h during sitting, news RSS hourly, Statistics Canada weekly, Lobbying Registry daily. Active only when `users.ingestion_apis_enabled = TRUE`.

**ai_query.** AI-driven research queries — the operator (or a workflow) issues a structured query like "find recent SEDAR+ filings mentioning X" or "find news articles about Y in the past 7 days," the orchestrator dispatches the query against the appropriate provider (Apify, MarketCheck, news APIs, web search), and results land as new `sources` rows. Active only when `users.ingestion_apis_enabled = TRUE`. Cost-gated per query.

**research_brief.** Long-form research documents (often produced by Claude Research or another deep-research tool) ingested as a source. Operator-initiated.

**derived.** Sources created by the system itself — e.g., a transcription of a video source becomes a derived `transcript` source, linked back to the original via metadata.

### 7.2 The toggle

`users.ingestion_apis_enabled` is the master switch. When FALSE, the only ingestion modes available are `operator_upload` and `research_brief`. Webhooks return 503; cron handlers no-op; ai_query returns an error.

When TRUE, all modes are available, but each individual webhook/cron source is configurable on the System screen — operator can enable Hansard cron without enabling YouTube PubSubHubbub, etc.

The default for new users is FALSE. The toggle flips after the operator has used the system enough to understand what automatic ingestion will surface.

### 7.3 Webhook signature verification

Each provider has its own signature scheme; the webhook handler validates before any processing:

- **YouTube PubSubHubbub:** `X-Hub-Signature-256` header, HMAC-SHA256 of raw body with subscription secret
- **openparliament.ca:** custom `X-OP-Signature`, HMAC-SHA256
- **X / Twitter:** `X-Twitter-Webhooks-Signature`, HMAC-SHA256 with consumer secret
- **Generic:** `X-Canopticon-Signature`, HMAC-SHA256 with per-source secret managed in Sources settings

Failures return 401. Successful validation proceeds to ingestion.

---

## 8. KNOWN OPERATIONAL CONSTRAINTS

Things the build must accommodate.

**Anthropic API rate limits.** A cascade with many sources can fire 30+ API calls in minutes. Default tier rate limits may bottleneck. Mitigation: queue role invocations with backoff; budget for tier upgrade if needed.

**Citations API + Structured Outputs incompatibility.** The two cannot be combined in a single Anthropic API call (returns 400 error). Workflows that need both (notably the Verifier) make two sequential calls: Citations call to ground, structured-outputs call to extract status from the grounding output.

**SSE connection stability on mobile.** SSE connections drop on mobile network changes. Frontend reconnects with `Last-Event-ID` and replays missed events.

**RLS performance with growing substrate.** RLS adds query overhead. For typical user volumes (low thousands of rows per table), this is fine. As substrates scale, materialized views for hot read paths reduce the cost.

**Idempotency in face of partial failures.** Workflows that fail mid-step must resume cleanly. Every step writes its `steps_completed` checkpoint before AND after the work; resume reads checkpoint and skips completed steps.

**Cross-model verification cost.** GPT-5 or Gemini calls add real money. Cross-model is operator-toggled and gated by the cost discipline; default off.

**Concurrent cascade runs.** A user has at most one cascade running at a time. Concurrent runs would require lock management on substrate writes; single-cascade is sufficient.

---

## 9. STACK

**Frontend (operator app).** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS (utility-only), custom CSS for design tokens. Hosted on Vercel. Custom domain: `app.canopticon.com`.

**Backend.** Cloudflare Workers (TypeScript), Hono router, Durable Objects for orchestrator state per cascade run, Cloudflare Queues for async webhook processing, Cloudflare R2 for source-body and recording storage, Cloudflare Cron Triggers for scheduled cascades and cron pulls. Custom domain: `api.canopticon.com`.

**Database / auth.** Supabase (Postgres 15, GoTrue auth, Realtime). Schema migrations via Supabase CLI.

**External services.** Anthropic API (`claude-opus-4-7`), AssemblyAI (Path B transcription), GPT-5 / Gemini (cross-model verification, operator-toggled), various ingestion adapters (openparliament.ca, news RSS, etc.) when `ingestion_apis_enabled = TRUE`.

**Tooling.** pnpm workspaces (monorepo: `web`, `api`, `shared`), TypeScript 5.5+, Biome for lint/format, Vitest for unit tests, Playwright for end-to-end tests.

**Public site.** Next.js, hosted on Vercel, reads from `pub_*_cache` tables via Supabase PostgREST with anon key. Custom domain: `canopticon.com`.

---

## 10. NOTES

**The full SKILL.md prompt templates and JSON schemas for all 14 roles** are deployed as files in `/skills/{role-name}/`. This document specifies the operational contract; the SKILL.md files are the deployable artifact. Prompt iteration changes the SKILL.md hash, which the orchestrator detects on next invocation.

**The OpenAPI spec** for the operator API is auto-generated and lives at `/openapi.yaml` on the API host. The companion document `canopticon-interfaces.md` specifies the API surface in prose.

**Methodology integration** (which frameworks live in which roles) is summarized in `canopticon-thinking.md`. Briefly: Admiralty grading lives in the Critic and on the `claims.admiralty_grade` column; Toulmin lives in the `claim_versions` Toulmin columns; IPCC lives in the Tier Projector and the `ipcc_likelihood` enum; Brier lives in the Calibration role and `predictions.brier_contribution`; Cynefin lives at the thesis level; Lakatos drives the Assumption Auditor; Van Evera and Popper falsifiability live in the Premortem and Verifier; the four-layer template is wired into `claim_layer` and into the Tier Projector's layer decomposition; McLuhan informs the framing layer and the platform's overall design posture.

This document is the contract. The substrate, the roles, the workflows, the entity resolution pipeline, the production engine, the ingestion architecture — all specified here. Implementation details, build choices, and orchestration code follow this contract.
