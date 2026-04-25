// Orchestrator event types — see workflows-v1.0.md §10 and schema-v1.0.md §11.3.
//
// Events are written to `orchestrator_events` and tailed by the SSE endpoint.
// The discriminator is `event_type` in `noun.verb_past_tense` form. Payload
// shapes are intentionally narrow — events should reference substrate IDs, not
// embed substrate state, so subscribers re-read the source of truth.

export type SourceEventType =
  | "source.created"
  | "source.critic_completed"
  | "source.approved"
  | "source.deferred"
  | "source.rejected";

export type ClaimEventType =
  | "claim.extracted"
  | "claim.created"
  | "claim.versioned"
  | "claim.verified"
  | "claim.contradicted";

export type QuestionEventType = "question.generated" | "question.answered" | "question.retired";

export type CascadeEventType =
  | "cascade.started"
  | "cascade.step_started"
  | "cascade.step_completed"
  | "cascade.completed"
  | "cascade.failed";

export type CostEventType =
  | "cost.operation_proposed"
  | "cost.operation_approved"
  | "cost.operation_denied"
  | "cost.charged";

export type RoleEventType =
  | "role.invocation_started"
  | "role.invocation_completed"
  | "role.invocation_failed";

export type EventType =
  | SourceEventType
  | ClaimEventType
  | QuestionEventType
  | CascadeEventType
  | CostEventType
  | RoleEventType;

export interface OrchestratorEvent<T extends EventType = EventType> {
  id: string;
  user_id: string;
  event_type: T;
  cascade_run_id: string | null;
  workflow_run_id: string | null;
  role_invocation_id: string | null;
  subject_table: string | null;
  subject_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}
