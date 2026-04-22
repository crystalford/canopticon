export type EntityType =
  | 'person'
  | 'organization'
  | 'corporation'
  | 'government_body'
  | 'political_party'
  | 'media_outlet'
  | 'policy'
  | 'event'
  | 'place'
  | 'concept'

export type ClaimStatus = 'unverified' | 'verified' | 'disputed' | 'retracted'
export type IntakeStatus = 'pending' | 'processing' | 'done' | 'rejected'
export type HypothesisStatus = 'open' | 'confirmed' | 'refuted'
export type ContradictionSeverity = 'low' | 'medium' | 'high' | 'critical'
export type ContentStatus = 'draft' | 'published'
export type SessionStatus = 'active' | 'archived'
export type UserTier = 'admin' | 'supporter' | 'public'
export type MessageRole = 'user' | 'assistant'
export type SourceReliabilityTier = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export interface Profile {
  id: string
  tier: UserTier
  display_name: string | null
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  name: string
  slug: string
  color: string
  created_at: string
}

export interface Entity {
  id: string
  entity_id: string
  name: string
  type: EntityType
  subtype: string | null
  description: string | null
  confidence_score: number
  resonance_score: number
  status: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface EntityTag {
  entity_id: string
  tag_id: string
}

export interface Relationship {
  id: string
  from_entity_id: string
  to_entity_id: string
  relationship_type: string
  confidence: number
  evidence_ids: string[]
  start_date: string | null
  end_date: string | null
  is_current: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export interface Source {
  id: string
  url: string
  title: string | null
  author: string | null
  published_at: string | null
  reliability_tier: SourceReliabilityTier
  content_hash: string | null
  scraped_at: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Claim {
  id: string
  content: string
  claim_type: string
  confidence: number
  resonance: number
  embedding: number[] | null
  source_ids: string[]
  entity_ids: string[]
  status: ClaimStatus
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface Evidence {
  id: string
  claim_id: string
  source_id: string
  excerpt: string | null
  relevance_score: number
  added_at: string
}

export interface KnowledgeGap {
  id: string
  gap_type: string
  description: string
  entity_ids: string[]
  urgency_score: number
  created_at: string
  last_escalated_at: string | null
  resolved_at: string | null
  is_resolved: boolean
}

export interface Hypothesis {
  id: string
  title: string
  description: string
  confidence: number
  supporting_claim_ids: string[]
  contradicting_claim_ids: string[]
  status: HypothesisStatus
  created_at: string
  updated_at: string
}

export interface ConvergenceEvent {
  id: string
  claim_ids: string[]
  source_ids: string[]
  detected_at: string
  significance_score: number
  reviewed: boolean
  notes: string | null
}

export interface Contradiction {
  id: string
  claim_a_id: string
  claim_b_id: string
  severity: ContradictionSeverity
  detected_at: string
  resolved_at: string | null
  resolution_notes: string | null
}

export interface ConspiracyFlag {
  id: string
  claim_id: string
  indicators: Record<string, unknown>
  score: number
  flagged_at: string
  reviewed: boolean
}

export interface Article {
  id: string
  title: string
  slug: string
  content: string
  summary: string | null
  entity_ids: string[]
  status: ContentStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface Vlog {
  id: string
  title: string
  script: string | null
  youtube_url: string | null
  status: ContentStatus
  entity_ids: string[]
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface VideoClip {
  id: string
  vlog_id: string
  start_seconds: number
  end_seconds: number
  clip_url: string | null
  status: string
  created_at: string
}

export interface SystemPrompt {
  key: string
  content: string
  updated_at: string
}

export interface Agent {
  id: string
  name: string
  slug: string
  type: string
  model_id: string
  system_prompt_key: string | null
  is_active: boolean
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface IntakeQueueItem {
  id: string
  raw_content: string
  source_url: string | null
  submitted_by: string | null
  status: IntakeStatus
  processed_at: string | null
  extracted_entities: unknown | null
  extracted_claims: unknown | null
  created_at: string
}

export interface Session {
  id: string
  title: string
  description: string | null
  entity_ids: string[]
  status: SessionStatus
  created_at: string
  updated_at: string
}

export interface SessionMessage {
  id: string
  session_id: string
  role: MessageRole
  content: string
  tool_calls: unknown | null
  created_at: string
}

export interface ApiKey {
  id: string
  name: string
  key_hash: string
  created_by: string | null
  created_at: string
  last_used_at: string | null
  is_active: boolean
}

export interface AuditLogEntry {
  id: string
  actor_id: string | null
  action: string
  table_name: string
  record_id: string | null
  before: unknown | null
  after: unknown | null
  created_at: string
}

export type ArgumentMapStatus = 'draft' | 'published' | 'archived'
export type ArgumentMapType = 'analysis' | 'five_whys' | 'solution_inventory' | 'prediction' | 'thesis'

export interface ArgumentNode {
  claim: string
  confidence: number
  evidence_ids?: string[]
  children?: ArgumentNode[]
}

export interface DominantFrame {
  frame_name: string
  description: string
  who_benefits: string
}

export interface SolutionInventory {
  reform: string[]
  resistance: string[]
  exit: string[]
}

export interface BankedPrediction {
  claim: string
  probability: number
  resolution_date: string
  resolved: boolean
  outcome?: string
  brier_score?: number
}

export interface FiveWhysEntry {
  question: string
  answer: string
  level: number
}

export interface ArgumentMap {
  id: string
  title: string
  article_type: ArgumentMapType
  argument_tree: ArgumentNode
  dominant_frames: DominantFrame[]
  solution_inventory: SolutionInventory
  banked_predictions: BankedPrediction[]
  five_whys: FiveWhysEntry[]
  entity_ids: string[]
  claim_ids: string[]
  status: ArgumentMapStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

// API response shapes
export interface GraphHealth {
  entities: number
  relationships: number
  claims: number
  sources: number
  open_gaps: number
  open_hypotheses: number
  unresolved_contradictions: number
  last_snapshot: string | null
}
