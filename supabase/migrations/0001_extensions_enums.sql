-- 0001_extensions_enums.sql
-- Postgres extensions and enum types underpinning the entire substrate.
-- Every enum here is referenced by later migrations; do not reorder.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "vector";

-- Source grading (Admiralty Code).
create type admiralty_grade as enum ('A', 'B', 'C', 'D', 'E', 'F');

-- IPCC verbal scale for calibrated language. Wider than the standard 7
-- to permit interior buckets used by Tier Projector when a thesis sits
-- between two adjacent qualifiers.
create type ipcc_likelihood as enum (
  'virtually_certain',
  'extremely_likely',
  'very_likely',
  'likely',
  'more_likely_than_not',
  'about_as_likely_as_not',
  'unlikely',
  'very_unlikely',
  'extremely_unlikely',
  'exceptionally_unlikely'
);

-- Source kinds we ingest.
create type source_type as enum (
  'hansard',
  'news',
  'social',
  'video',
  'book',
  'filing',
  'report',
  'operator_note',
  'other'
);

-- Lifecycle of a source from arrival to registry entry.
create type ingestion_state as enum (
  'pending_critic',
  'critic_completed',
  'approved',
  'deferred',
  'rejected'
);

-- Entity taxonomy.
create type entity_type as enum (
  'person',
  'organization',
  'institution',
  'corporation',
  'department',
  'office',
  'legislation',
  'event',
  'concept',
  'location'
);

-- Toulmin layer of a claim.
create type claim_layer as enum (
  'factual',
  'framing',
  'architectural',
  'distributive'
);

-- Verification status from the Verifier role.
create type verification_status as enum (
  'unverified',
  'grounded',
  'partial',
  'unsupported',
  'contradicted'
);

-- Edge type between claims.
create type claim_relation_type as enum (
  'supports',
  'contradicts',
  'refines',
  'depends_on',
  'narrows',
  'broadens'
);

-- Edge type between entities.
create type entity_relation_type as enum (
  'employs',
  'chairs',
  'attended',
  'cited',
  'opposed',
  'allied_with',
  'funded_by',
  'subsidiary_of',
  'mentor_of',
  'introduced_by',
  'amplified_by'
);

-- Cynefin domain pinned to a thesis.
create type cynefin_domain as enum (
  'simple',
  'complicated',
  'complex',
  'chaotic'
);

-- Posture on a contradiction.
create type contradiction_posture as enum (
  'open',
  'resolved_a',
  'resolved_b',
  'machloket',
  'retired'
);

-- Production lifecycle (state machine across Studio tabs).
create type production_state as enum (
  'ready',
  'recording',
  'producing',
  'publish',
  'perf',
  'archive'
);

-- Article type taxonomy.
create type article_type as enum (
  'intelligence_thesis',
  'policy_brief',
  'argument_map',
  'solution_inventory',
  'root_cause_analysis',
  'prediction_log',
  'book_chapter',
  'investigation_note',
  'frame_genealogy'
);

-- Intervention level for root-striking.
create type intervention_tier as enum (
  'symptom',
  'mechanism',
  'structural'
);

-- Book ingestion mode.
create type book_ingest_mode as enum (
  'surface',
  'substrate',
  'influence'
);

-- All 18 named roles. Order is not significant; later migrations seed by name.
create type role_name as enum (
  'ingestion_critic',
  'verifier',
  'interrogator',
  'red_team',
  'steelman',
  'premortem',
  'gap_surfacer',
  'calibration',
  'tier_projector',
  'assumption_auditor',
  'indicator_validator',
  'novelty_surfacer',
  'claim_extraction',
  'entity_resolver',
  'claim_deduplicator',
  'solution_inventory_builder',
  'argument_mapper',
  'genealogy_tracer'
);

-- Cascade run status.
create type cascade_status as enum (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

-- Workflow run status (publish-prep, contradiction resolution, etc.).
create type workflow_status as enum (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'awaiting_operator'
);

-- Cost approval lifecycle.
create type cost_approval_status as enum (
  'pending',
  'approved',
  'denied',
  'expired'
);

-- Question state for the Interrogator output.
create type question_state as enum (
  'open',
  'answered',
  'retired',
  'deferred'
);

-- Posture of a prediction.
create type prediction_status as enum (
  'active',
  'resolved_correct',
  'resolved_incorrect',
  'resolved_ambiguous',
  'retired'
);

-- Indicator state.
create type indicator_status as enum (
  'active',
  'paused',
  'rejected',
  'retired'
);

-- Assumption status.
create type assumption_status as enum (
  'holding',
  'weakening',
  'broken',
  'confirmed'
);

-- Five Whys protocol level.
create type five_whys_level as enum (
  'why_1_proximate',
  'why_2_immediate_mechanism',
  'why_3_systemic_pattern',
  'why_4_structural_condition',
  'why_5_root_design_choice'
);
