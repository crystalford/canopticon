// Enum mirrors of Postgres types defined in supabase/migrations/0002_enums.sql.
// Keep this file and the SQL migration in lock-step.

export const ADMIRALTY_GRADES = ["A", "B", "C", "D", "E", "F"] as const;
export type AdmiraltyGrade = (typeof ADMIRALTY_GRADES)[number];

export const VERIFICATION_STATUSES = [
  "unverified",
  "grounded",
  "partial",
  "unsupported",
  "contradicted",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const IPCC_LIKELIHOODS = [
  "virtually_certain",
  "extremely_likely",
  "very_likely",
  "likely",
  "more_likely_than_not",
  "about_as_likely_as_not",
  "unlikely",
  "very_unlikely",
  "extremely_unlikely",
  "exceptionally_unlikely",
] as const;
export type IpccLikelihood = (typeof IPCC_LIKELIHOODS)[number];

export const ENTITY_TYPES = [
  "person",
  "organization",
  "institution",
  "corporation",
  "department",
  "office",
  "legislation",
  "event",
  "concept",
  "location",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const CLAIM_LAYERS = ["factual", "framing", "architectural", "distributive"] as const;
export type ClaimLayer = (typeof CLAIM_LAYERS)[number];

export const THESIS_STATUSES = ["declared", "active", "archived"] as const;
export type ThesisStatus = (typeof THESIS_STATUSES)[number];

export const SOURCE_TYPES = [
  "hansard",
  "news",
  "social",
  "video",
  "book",
  "filing",
  "report",
  "operator_note",
  "other",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const INGESTION_MODES = ["operator", "automatic"] as const;
export type IngestionMode = (typeof INGESTION_MODES)[number];

export const INGESTION_STATES = [
  "pending_critic",
  "critic_completed",
  "approved",
  "deferred",
  "rejected",
] as const;
export type IngestionState = (typeof INGESTION_STATES)[number];

export const ROLE_NAMES = [
  "ingestion_critic",
  "verifier",
  "interrogator",
  "red_team",
  "steelman",
  "premortem",
  "gap_surfacer",
  "calibration",
  "tier_projector",
  "assumption_auditor",
  "indicator_validator",
  "claim_extraction",
  "novelty_surfacer",
] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export const SPRINT_1_ROLE_NAMES: readonly RoleName[] = [
  "ingestion_critic",
  "claim_extraction",
  "verifier",
  "interrogator",
] as const;

export const COST_OPERATION_TYPES = [
  "anthropic_call",
  "cross_model_call",
  "transcription",
  "image_gen",
] as const;
export type CostOperationType = (typeof COST_OPERATION_TYPES)[number];

export const QUESTION_STATUSES = ["open", "answered", "deferred", "retired"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];
