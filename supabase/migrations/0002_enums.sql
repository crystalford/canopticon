-- Migration 0002 — Enums (Sprint 1 subset)
-- See canopticon-schema-v1.0.md §2.
-- Mirrored in TypeScript at packages/shared/src/constants/enums.ts.
-- Keep the two in lock-step.

CREATE TYPE admiralty_grade AS ENUM ('A', 'B', 'C', 'D', 'E', 'F');

CREATE TYPE verification_status AS ENUM (
  'unverified',
  'grounded',
  'partial',
  'unsupported',
  'contradicted'
);

CREATE TYPE ipcc_likelihood AS ENUM (
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

CREATE TYPE entity_type AS ENUM (
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

CREATE TYPE claim_layer AS ENUM ('factual', 'framing', 'architectural', 'distributive');

CREATE TYPE thesis_status AS ENUM ('draft', 'active', 'archived');

CREATE TYPE source_type AS ENUM (
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

CREATE TYPE ingestion_mode AS ENUM ('operator', 'automatic');

CREATE TYPE ingestion_state AS ENUM (
  'pending_critic',
  'critic_completed',
  'approved',
  'deferred',
  'rejected'
);

CREATE TYPE role_name AS ENUM (
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
  'claim_extraction'
);

CREATE TYPE cost_operation_type AS ENUM (
  'anthropic_call',
  'cross_model_call',
  'transcription',
  'image_gen'
);

CREATE TYPE question_status AS ENUM ('open', 'answered', 'deferred', 'retired');
