# CANOPTICON API Surface v1.0

**Purpose.** The contract between the operator app frontend (Next.js, browser/mobile) and the Cloudflare Workers backend. Specifies every endpoint the frontend calls, request and response shapes, authentication, error handling, and rate limits. The schema doc specifies the data model; this doc specifies how clients touch it.

**Scope.** Only the operator-app API. The public site reads `pub_*_cache` tables directly via Supabase's REST/PostgREST layer with anon-key access; this is not specified here as it's standard Supabase usage.

**Stack.**
- API runtime: Cloudflare Workers
- Database: Supabase Postgres (accessed via Supabase JS client from Worker)
- Auth: Supabase Auth (JWT)
- Long-running orchestration: Cloudflare Durable Objects
- Background queue: Cloudflare Queues + R2 for blobs

**Conventions.**
- Base URL: `https://api.canopticon.com/v1`
- Authentication: every request carries `Authorization: Bearer <jwt>` from Supabase Auth (except `/auth/*` endpoints).
- Content type: JSON request and response bodies. `multipart/form-data` only for file uploads.
- IDs: all UUIDs in path parameters and bodies.
- Timestamps: ISO 8601 in UTC. `2026-04-25T11:00:00Z`.
- Errors: standard envelope (Section 0.3 below).
- Idempotency: every POST and PATCH endpoint accepts an optional `Idempotency-Key` header (UUID). Repeated requests with the same key return the original response without re-executing.
- Pagination: cursor-based. `?cursor=<opaque>&limit=<n>` (default 20, max 100).
- Filtering: per-endpoint query parameters, documented per route.

---

## 0. SHARED PRIMITIVES

### 0.1 Authentication header

```
Authorization: Bearer <supabase-jwt>
```

The JWT carries `sub` (user UUID) and `role`. The Worker validates the JWT against Supabase Auth's JWKS endpoint (cached per Worker isolate). Invalid or expired tokens return `401`.

The user_id is derived from `sub`; clients never pass user_id explicitly. RLS at the Postgres layer enforces tenant isolation; the API layer is a thin wrapper that uses the authenticated user's session.

### 0.2 Standard headers

```
Content-Type: application/json
Accept: application/json
Authorization: Bearer <jwt>
Idempotency-Key: <uuid>           (optional, on POST/PATCH)
X-Cascade-Run-Id: <uuid>          (optional, set by orchestrator on automatic calls)
```

### 0.3 Error envelope

All non-2xx responses follow this shape:

```json
{
  "error": {
    "code": "string — stable identifier",
    "message": "string — human-readable",
    "details": { /* optional, varies by error code */ },
    "trace_id": "uuid — for correlating with server logs"
  }
}
```

**Standard error codes:**

```
auth_invalid_token            401
auth_expired_token            401
auth_missing_token            401
permission_denied             403
not_found                     404
validation_failed             422
conflict                      409
idempotency_key_conflict      409
rate_limited                  429
ceiling_reached               402
operation_blocked_no_approval 402
upstream_error                502
internal_error                500
service_unavailable           503
```

The `402` codes are CANOPTICON-specific: `ceiling_reached` means the user's monthly cost ceiling would be exceeded; `operation_blocked_no_approval` means a paid operation requires explicit operator approval and that approval has not been granted.

### 0.4 Rate limits

Per-user rate limits enforced at the Worker edge:

```
Standard endpoints:    600 req/min
Search endpoints:      120 req/min
Cascade trigger:       12 req/hour
File upload:           60 req/hour, 50MB max per upload
```

Rate-limited responses return `429` with a `Retry-After` header.

### 0.5 Pagination envelope

List endpoints return:

```json
{
  "data": [ /* array of records */ ],
  "pagination": {
    "next_cursor": "string | null",
    "has_more": "boolean"
  },
  "meta": {
    "total_count": "integer (optional, when cheap to compute)"
  }
}
```

---

## 1. AUTH ENDPOINTS

Authentication uses Supabase Auth directly from the client. The API layer exposes a few helpers but most auth flows go straight to Supabase.

### 1.1 GET `/v1/auth/me`

Returns the current user's profile.

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "string",
    "display_name": "string | null",
    "publication_handle": "string | null",
    "monthly_ceiling_cents": 5000,
    "created_at": "2026-04-25T11:00:00Z"
  }
}
```

### 1.2 PATCH `/v1/auth/me`

Update profile fields.

**Request:**
```json
{
  "display_name": "string (optional)",
  "publication_handle": "string (optional)",
  "monthly_ceiling_cents": "integer (optional, min 0, max 100000)"
}
```

**Response 200:** updated user object.

---

## 2. SOURCES

### 2.1 GET `/v1/sources`

List sources with filtering.

**Query params:**
- `state`: `pending_critic | pending_approval | approved | deferred | rejected | auto_approved`
- `grade`: `A | B | C | D | E | F`
- `since`: ISO 8601 timestamp
- `q`: search query (matched against title and publication via pg_trgm)
- `cursor`, `limit`: pagination

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "source_type": "document",
      "title": "string",
      "url": "string | null",
      "publication": "string | null",
      "author": "string | null",
      "published_at": "iso8601 | null",
      "retrieved_at": "iso8601",
      "admiralty_grade": "A",
      "ingestion_mode": "operator_upload",
      "ingestion_state": "pending_approval",
      "slug": "string"
    }
  ],
  "pagination": { "next_cursor": "string | null", "has_more": false }
}
```

### 2.2 GET `/v1/sources/:id`

Full source detail including body.

**Response 200:**
```json
{
  "id": "uuid",
  "source_type": "document",
  "title": "string",
  "url": "string",
  "publication": "string",
  "author": "string",
  "published_at": "iso8601",
  "retrieved_at": "iso8601",
  "admiralty_grade": "A",
  "bias_profile": { "lean": "...", "ownership": "...", "notes": [] },
  "ingestion_mode": "operator_upload",
  "ingestion_state": "approved",
  "raw_text": "string (may be null if stored in R2)",
  "storage_uri": "string | null",
  "metadata": {},
  "slug": "string",
  "critic_report": { /* see 2.5 */ },
  "extracted_claims_count": 7,
  "linked_articles_count": 1
}
```

### 2.3 POST `/v1/sources`

Operator-driven source creation. Three sub-modes via `ingestion_mode`:

**Request (operator_upload — paste/URL):**
```json
{
  "source_type": "webpage",
  "title": "string",
  "url": "string (optional)",
  "publication": "string (optional)",
  "author": "string (optional)",
  "published_at": "iso8601 (optional)",
  "raw_text": "string (the body, if known)",
  "ingestion_mode": "operator_upload",
  "metadata": {}
}
```

**Request (research_brief — paste long-form):**
```json
{
  "source_type": "research_brief",
  "title": "string",
  "raw_text": "string (the brief body)",
  "ingestion_mode": "research_brief"
}
```

**File upload:** uses `POST /v1/sources/upload` (multipart/form-data, see 2.4).

**Response 202:** Source created in `pending_critic` state. Critic invocation queued. Body:
```json
{
  "source": { /* source record */ },
  "critic_invocation_id": "uuid"
}
```

### 2.4 POST `/v1/sources/upload`

Multipart file upload.

**Request:** `multipart/form-data`
- `file`: PDF, DOCX, MP3, MP4, etc.
- `title`: string
- `source_type`: enum
- `metadata`: JSON string (optional)

**Response 202:**
```json
{
  "source": { /* source record */ },
  "upload_uri": "r2-storage-key",
  "critic_invocation_id": "uuid",
  "transcription_required": true,
  "transcription_estimate_cents": 32
}
```

If `transcription_required=true`, the response includes a `pending_approval_id` the client uses to approve the transcription cost (see 11.4).

### 2.5 GET `/v1/sources/:id/critic-report`

Returns the most recent Critic report for this source.

**Response 200:**
```json
{
  "id": "uuid",
  "source_id": "uuid",
  "proposed_grade": "A",
  "bias_assessment": "string",
  "compatibility_check": { "level": "high", "commentary": "string" },
  "contradiction_flags": [],
  "watch_set_matches": [
    { "thesis_id": "uuid", "matched_entities": ["Mark Carney"] }
  ],
  "paid_op_required": false,
  "paid_op_estimate_cents": null,
  "reasoning": "string",
  "auto_approve_recommended": false,
  "created_at": "iso8601"
}
```

### 2.6 POST `/v1/sources/:id/approve`

Operator approves a pending source.

**Response 200:**
```json
{
  "source": { /* updated record */ },
  "extraction_invocation_id": "uuid"
}
```

Side effects: `ingestion_state` transitions to `approved`; cascade extraction kicks off in background.

### 2.7 POST `/v1/sources/:id/defer`

**Request:** `{ "notes": "string (optional)" }`

**Response 200:** updated source record. State is `deferred`.

### 2.8 POST `/v1/sources/:id/reject`

**Request:** `{ "notes": "string (required)" }`

**Response 200:** updated source record. State is `rejected`.

### 2.9 POST `/v1/sources/:id/recritic`

Re-run the Critic (e.g., after an operator-edited bias_profile). Costs API call.

**Response 202:**
```json
{
  "critic_invocation_id": "uuid",
  "estimated_cost_cents": 4
}
```

---

## 3. CLAIMS

### 3.1 GET `/v1/claims`

**Query params:**
- `layer`: `factual | framing | architectural | distributive`
- `grade`: A-F
- `verification_status`: `unverified | grounded | partial | unsupported | contested`
- `is_linchpin`: boolean
- `entity_id`: filter to claims involving specific entity
- `thesis_id`: filter to claims integrated in specific thesis
- `q`: full-text search on claim_text
- `since`: iso8601
- `cursor`, `limit`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "current_version": {
        "data": "string",
        "claim_text": "string",
        "warrant": "string | null",
        "qualifier": "string | null",
        "rebuttal": "string | null"
      },
      "layer": "architectural",
      "admiralty_grade": "B",
      "verification_status": "grounded",
      "ipcc_qualifier": "likely",
      "is_linchpin": false,
      "entity_count": 3,
      "source_count": 2,
      "thesis_count": 1,
      "updated_at": "iso8601"
    }
  ],
  "pagination": { "next_cursor": "...", "has_more": true }
}
```

### 3.2 GET `/v1/claims/:id`

Full detail including all versions, all entities, all sources.

**Response 200:**
```json
{
  "id": "uuid",
  "current_version": { /* full Toulmin */ },
  "layer": "factual",
  "admiralty_grade": "A",
  "verification_status": "grounded",
  "ipcc_qualifier": null,
  "is_linchpin": true,
  "slug": "string",
  "entities": [
    { "id": "uuid", "canonical_name": "Mark Carney", "type": "person", "role_in_claim": "subject" }
  ],
  "sources": [
    {
      "id": "uuid",
      "title": "Hansard 2024-11-14",
      "supports": true,
      "excerpt": "string",
      "admiralty_grade": "A"
    }
  ],
  "versions": [
    {
      "id": "uuid",
      "version_number": 1,
      "is_current": true,
      "data": "string",
      "claim_text": "string",
      "warrant": "string",
      "backing": "string",
      "qualifier": "string",
      "rebuttal": "string",
      "change_summary": "initial",
      "written_by_role": "verifier",
      "created_at": "iso8601"
    }
  ],
  "theses": [ { "id": "uuid", "title": "string", "layer": "architectural" } ],
  "contradictions": [],
  "verification_history": [
    {
      "role_invocation_id": "uuid",
      "verification_status": "grounded",
      "reasoning": "string",
      "verified_at": "iso8601"
    }
  ],
  "created_at": "iso8601",
  "updated_at": "iso8601"
}
```

### 3.3 POST `/v1/claims`

Operator-authored claim (manual, outside cascade).

**Request:**
```json
{
  "data": "string",
  "claim_text": "string",
  "warrant": "string (optional)",
  "backing": "string (optional)",
  "qualifier": "string (optional)",
  "rebuttal": "string (optional)",
  "layer": "factual",
  "admiralty_grade": "A",
  "ipcc_qualifier": "likely (optional)",
  "primary_source_id": "uuid",
  "supporting_source_ids": ["uuid"],
  "entity_ids": [
    { "entity_id": "uuid", "role_in_claim": "subject" }
  ],
  "is_linchpin": false
}
```

**Response 201:** full claim record (3.2 shape).

### 3.4 PATCH `/v1/claims/:id`

Edit claim. Creates a new version row; never overwrites.

**Request:** subset of 3.3 fields. Plus `change_summary: "string"`.

**Response 200:** updated claim record with new current_version.

### 3.5 POST `/v1/claims/:id/verify`

Trigger a Verifier run on this claim.

**Request:**
```json
{
  "cross_model": false  // optional, default false. Triggers cost approval if true.
}
```

**Response 202:**
```json
{
  "role_invocation_id": "uuid",
  "estimated_cost_cents": 12
}
```

### 3.6 GET `/v1/claims/:id/related`

Returns claims related to this one via `claim_relations`.

**Query params:** `relation_type` (optional)

**Response 200:**
```json
{
  "data": [
    {
      "claim": { /* claim summary */ },
      "relation_type": "supports",
      "notes": "string"
    }
  ]
}
```

### 3.7 POST `/v1/claims/:id/relations`

Create a claim relation.

**Request:**
```json
{
  "to_claim_id": "uuid",
  "relation_type": "supports",
  "notes": "string (optional)"
}
```

### 3.8 DELETE `/v1/claims/:id`

Soft delete (archives the claim). Real deletion is not exposed via API; cascade-from-substrate is admin-only.

---

## 4. ENTITIES

### 4.1 GET `/v1/entities`

**Query params:**
- `entity_type`
- `is_excluded`: boolean
- `q`: search on canonical_name and aliases (pg_trgm)
- `cursor`, `limit`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "entity_type": "person",
      "canonical_name": "Mark Carney",
      "display_name": "Mark Carney",
      "aliases": ["M. Carney", "Carney"],
      "slug": "mark-carney",
      "claim_count": 47,
      "relation_count": 23,
      "first_seen_at": "iso8601",
      "last_seen_at": "iso8601"
    }
  ],
  "pagination": { /* ... */ }
}
```

### 4.2 GET `/v1/entities/:id`

Full entity detail.

**Response 200:** full entity record with relations and recent claims.

### 4.3 POST `/v1/entities`

Operator-authored entity.

**Request:**
```json
{
  "entity_type": "person",
  "canonical_name": "string",
  "display_name": "string",
  "aliases": ["string"],
  "description": "string (optional)",
  "metadata": {}
}
```

### 4.4 PATCH `/v1/entities/:id`

Edit entity (rename, add aliases, mark excluded, etc.).

### 4.5 POST `/v1/entities/:id/merge`

Merge another entity into this one.

**Request:**
```json
{
  "from_entity_id": "uuid",
  "reasoning": "string"
}
```

**Response 200:**
```json
{
  "merged_entity": { /* the surviving entity */ },
  "merge_history_id": "uuid",
  "affected_mention_count": 12,
  "affected_claim_count": 5
}
```

### 4.6 POST `/v1/entities/:id/split`

Split an entity. Identifies which mentions/claims should move to the new entity.

**Request:**
```json
{
  "new_entity": {
    "canonical_name": "string",
    "display_name": "string",
    "entity_type": "person"
  },
  "mention_ids_to_move": ["uuid"],
  "reasoning": "string"
}
```

**Response 200:**
```json
{
  "original_entity": { /* original */ },
  "new_entity": { /* new */ },
  "merge_history_id": "uuid"
}
```

### 4.7 GET `/v1/entities/:id/relations`

Entity relations involving this entity.

### 4.8 GET `/v1/entities/:id/timeline`

Chronological mentions/claims/events involving this entity.

---

## 5. THESES

### 5.1 GET `/v1/theses`

**Query params:** `status`, `is_public`, `q`, `cursor`, `limit`

**Response 200:** array of thesis summaries.

### 5.2 GET `/v1/theses/:id`

Full thesis with current version, layer counts, claim counts, etc.

### 5.3 POST `/v1/theses`

**Request:**
```json
{
  "title": "string",
  "slug": "string (optional, auto-generated)",
  "seed_paragraph": "string",
  "cynefin_domain": "complex (optional)"
}
```

### 5.4 PATCH `/v1/theses/:id`

Update thesis metadata (title, status, public, etc.). Content updates create new versions via 5.5.

### 5.5 POST `/v1/theses/:id/versions`

Create a new thesis version.

**Request:**
```json
{
  "seed_paragraph": "string (optional, otherwise inherits)",
  "change_summary": "string"
}
```

**Response 201:** new version row. Tier Projector is automatically queued; tier content is set asynchronously.

### 5.6 GET `/v1/theses/:id/versions`

List all versions.

### 5.7 GET `/v1/theses/:id/claims`

Claims integrated into this thesis.

**Query params:** `layer`

### 5.8 POST `/v1/theses/:id/claims`

Integrate a claim into this thesis.

**Request:**
```json
{
  "claim_id": "uuid",
  "layer": "architectural"
}
```

### 5.9 DELETE `/v1/theses/:id/claims/:claim_id`

Soft-remove a claim from a thesis (sets `removed_at`).

### 5.10 GET `/v1/theses/:id/inbox`

Claims awaiting integration decision.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "claim": { /* claim summary */ },
      "routed_by": "watch_set_match",
      "added_at": "iso8601"
    }
  ]
}
```

### 5.11 POST `/v1/theses/:id/inbox/:inbox_id/act`

Act on an inbox item.

**Request:**
```json
{
  "action": "integrated | rejected | deferred",
  "layer": "factual (required if action=integrated)"
}
```

### 5.12 GET `/v1/theses/:id/watch-set`

### 5.13 POST `/v1/theses/:id/watch-set`

**Request:**
```json
{
  "entity_id": "uuid (optional)",
  "exclusion_term": "string (optional)",
  "pin_type": "pinned"
}
```

### 5.14 DELETE `/v1/theses/:id/watch-set/:entity_id`

### 5.15 POST `/v1/theses/:id/publish`

Triggers publish-prep workflow.

**Request:** `{ "force": false }` (force=true bypasses non-fatal warnings).

**Response 202:**
```json
{
  "workflow_run_id": "uuid",
  "estimated_cost_cents": 250
}
```

The workflow runs Premortem + Red Team + Verifier sweep + Tier Projector. Client polls workflow status (Section 11).

### 5.16 GET `/v1/theses/:id/concept-spine`

### 5.17 POST `/v1/theses/:id/concept-spine`

**Request:** `{ "concept_text": "string", "ordering": 0 }`

---

## 6. ARTICLES

### 6.1 GET `/v1/articles`

**Query params:** `status`, `thesis_id`, `is_public`, `q`, `cursor`, `limit`

### 6.2 GET `/v1/articles/:id`

Full article with current version body.

### 6.3 POST `/v1/articles`

**Request:**
```json
{
  "title": "string",
  "slug": "string (optional)",
  "thesis_id": "uuid (optional)",
  "body_markdown": "string"
}
```

### 6.4 POST `/v1/articles/:id/versions`

Create new version (after edits).

**Request:**
```json
{
  "body_markdown": "string",
  "change_summary": "string",
  "is_correction": false,
  "correction_notes": "string (required if is_correction=true)"
}
```

### 6.5 POST `/v1/articles/:id/publish`

### 6.6 POST `/v1/articles/:id/correct`

Convenience endpoint that creates a correction version + an `article_corrections` row.

**Request:**
```json
{
  "what_changed": "string",
  "why": "string",
  "new_body_markdown": "string"
}
```

### 6.7 GET `/v1/articles/:id/corrections`

---

## 7. PREDICTIONS

### 7.1 GET `/v1/predictions`

**Query params:** `status`, `thesis_id`, `domain`, `is_public`

### 7.2 GET `/v1/predictions/:id`

### 7.3 POST `/v1/predictions`

Bank a prediction.

**Request:**
```json
{
  "thesis_id": "uuid (optional)",
  "claim_text": "string",
  "confidence": 0.72,
  "ipcc_qualifier": "likely",
  "resolution_criterion": "string",
  "resolves_by": "iso8601 (optional)",
  "domain": "monetary_policy",
  "notes": "string (optional)"
}
```

### 7.4 POST `/v1/predictions/:id/resolve`

Manually resolve a prediction.

**Request:**
```json
{
  "outcome": "correct | incorrect | ambiguous",
  "evidence_source_id": "uuid (optional)",
  "evidence_indicator_id": "uuid (optional)",
  "notes": "string (optional)"
}
```

### 7.5 GET `/v1/predictions/brier`

Returns rolling Brier scores.

**Response 200:**
```json
{
  "rolling_brier": 0.142,
  "by_domain": [
    { "domain": "monetary_policy", "brier": 0.08, "resolved_count": 4 }
  ],
  "by_horizon": [
    { "horizon": "short", "brier": 0.11, "resolved_count": 8 }
  ],
  "by_confidence_bucket": [
    { "bucket": "0.60-0.70", "predicted": 4, "actual_correct": 3 }
  ]
}
```

---

## 8. CONTRADICTIONS

### 8.1 GET `/v1/contradictions`

**Query params:** `posture`, `is_public`, `cursor`, `limit`

### 8.2 GET `/v1/contradictions/:id`

### 8.3 POST `/v1/contradictions`

Manual contradiction registration (the Verifier creates them automatically; this is for operator-noticed conflicts).

**Request:**
```json
{
  "claim_a_id": "uuid",
  "claim_b_id": "uuid",
  "description": "string"
}
```

### 8.4 POST `/v1/contradictions/:id/resolve`

**Request:**
```json
{
  "posture": "resolved_a | resolved_b | machloket | retired",
  "resolution_notes": "string"
}
```

### 8.5 POST `/v1/contradictions/:id/steelman`

Trigger Steelman role on this contradiction.

**Response 202:** `{ "role_invocation_id": "uuid", "estimated_cost_cents": 8 }`

---

## 9. ASSUMPTIONS, INDICATORS

### 9.1 GET / POST / PATCH `/v1/assumptions`

Standard CRUD. Key fields: `text`, `status`, `is_linchpin`, `consequence_if_failed`, `thesis_id`.

### 9.2 POST `/v1/assumptions/:id/audit`

Trigger Assumption Auditor on this specific assumption.

### 9.3 GET / POST / PATCH `/v1/indicators`

Standard CRUD on indicators. POST validates via Indicator Validator.

### 9.4 POST `/v1/indicators/:id/observe`

Record an observation.

**Request:**
```json
{
  "observed_value": "any (typed per indicator)",
  "observed_at": "iso8601",
  "source_id": "uuid (optional)"
}
```

---

## 10. QUESTIONS

### 10.1 GET / POST / PATCH `/v1/questions`

### 10.2 POST `/v1/questions/:id/answer`

Mark a question answered.

**Request:**
```json
{
  "answer_claim_id": "uuid (optional — if claim answers it)",
  "notes": "string (optional)"
}
```

### 10.3 POST `/v1/theses/:id/interrogate`

Trigger Interrogator on a thesis.

**Response 202:**
```json
{
  "role_invocation_id": "uuid",
  "estimated_cost_cents": 6
}
```

---

## 11. ORCHESTRATOR / WORKFLOW

### 11.1 POST `/v1/cascade/run`

Trigger a manual cascade.

**Request:**
```json
{
  "scope": "all | new_sources | this_thesis",
  "thesis_id": "uuid (required if scope=this_thesis)"
}
```

**Response 202:**
```json
{
  "cascade_run_id": "uuid",
  "estimated_cost_cents": 150,
  "estimated_duration_seconds": 90
}
```

### 11.2 GET `/v1/cascade/runs`

List recent cascade runs.

### 11.3 GET `/v1/cascade/runs/:id`

Cascade run detail with role invocations summary, costs, errors.

**Response 200:**
```json
{
  "id": "uuid",
  "triggered_by": "operator_manual",
  "started_at": "iso8601",
  "ended_at": "iso8601",
  "status": "completed",
  "sources_ingested": 8,
  "claims_written": 21,
  "questions_generated": 6,
  "contradictions_detected": 1,
  "total_cost_cents": 142,
  "role_invocation_count": 17,
  "error_summary": null
}
```

### 11.4 GET `/v1/workflows/runs/:id`

Generic workflow run status (publish-prep, etc.).

### 11.5 GET `/v1/orchestrator/events`

Server-sent events stream for the operator app's Live screen.

**Connection:** `GET /v1/orchestrator/events` with `Accept: text/event-stream`.

**Events:** every event in `orchestrator_events` for the user, formatted as:

```
event: claim.created
data: {"id":"uuid","entity_id":"uuid","entity_type":"claim","payload":{...},"created_at":"iso8601"}

event: cascade.completed
data: {"id":"uuid","cascade_run_id":"uuid","payload":{...}}
```

The client subscribes once on Live screen mount and renders incoming events into the feed without polling.

### 11.6 POST `/v1/orchestrator/approve-cost`

The cost-approval modal POSTs here when operator confirms a paid operation.

**Request:**
```json
{
  "pending_approval_id": "uuid",
  "approve": true
}
```

**Response 200:** confirmation; the blocked operation resumes.

### 11.7 GET `/v1/orchestrator/pending-approvals`

Open cost-approval requests. Polled or via SSE.

---

## 12. ROLE INVOCATIONS

### 12.1 GET `/v1/role-invocations`

**Query params:** `role_name`, `since`, `cursor`, `limit`

### 12.2 GET `/v1/role-invocations/:id`

Full detail including prompt, output, citations.

---

## 13. ENTITY RESOLUTION QUEUE

### 13.1 GET `/v1/entity-resolution/queue`

Pending entity-resolution decisions.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "mention": {
        "text": "M. Carney",
        "context_excerpt": "...the central banker M. Carney noted...",
        "source": { /* summary */ }
      },
      "candidates": [
        { "entity": { /* summary */ }, "match_score": 0.78 }
      ],
      "llm_decision": "match",
      "llm_confidence": 0.78,
      "llm_reasoning": "string",
      "surfaced_at": "iso8601"
    }
  ]
}
```

### 13.2 POST `/v1/entity-resolution/queue/:id/resolve`

**Request:**
```json
{
  "action": "confirm_match | new_entity | defer",
  "matched_entity_id": "uuid (required if action=confirm_match)",
  "new_entity": { /* if action=new_entity */ }
}
```

---

## 14. COST LEDGER

### 14.1 GET `/v1/costs/ledger`

**Query params:** `since`, `operation_type`, `cursor`, `limit`

### 14.2 GET `/v1/costs/summary`

**Response 200:**
```json
{
  "current_month_spent_cents": 1842,
  "monthly_ceiling_cents": 5000,
  "remaining_cents": 3158,
  "by_operation_type": [
    { "operation_type": "claude_completion", "cents": 1200, "count": 89 },
    { "operation_type": "transcription_assemblyai", "cents": 642, "count": 4 }
  ],
  "projected_month_end_cents": 4100
}
```

### 14.3 GET / POST / PATCH `/v1/costs/whitelists`

Manage whitelist rules.

---

## 15. SEARCH

### 15.1 GET `/v1/search`

Cross-substrate search.

**Query params:** `q` (required), `types` (comma-separated subset of `source,claim,entity,thesis,article,prediction,contradiction,question`), `limit` (default 20, max 50)

**Response 200:**
```json
{
  "results": [
    {
      "type": "thesis",
      "id": "uuid",
      "title": "string",
      "snippet": "...string with <mark>q</mark>...",
      "score": 0.84
    }
  ]
}
```

Implementation: pg_trgm + tsvector across substrate tables. v1.1 may upgrade to a search service.

---

## 16. EXPORT

### 16.1 GET `/v1/export/predictions.csv`

Public-grade ledger export. CSV download.

### 16.2 GET `/v1/export/thesis/:id.{json,md,pdf}`

Thesis snapshot export.

### 16.3 GET `/v1/export/substrate.json`

Full substrate dump (operator only). Large download. Used for backup/migration.

---

## 17. PUBLIC SITE INTERFACE (read-side)

The public site does NOT use this API. It reads from `pub_*_cache` tables via a Supabase anon-key role. The schemas are:

```
GET pub_articles_cache?slug=eq.<slug>
GET pub_theses_cache?slug=eq.<slug>
GET pub_entities_cache?slug=eq.<slug>
GET pub_sources_cache?slug=eq.<slug>
GET pub_claims_cache?id=eq.<uuid>
GET pub_predictions_cache?... (with filters)
GET pub_contradictions_cache?...
```

These are PostgREST endpoints exposed by Supabase, with anon-key access scoped by Postgres RLS policies (`SELECT` on `is_public=true` rows).

The public site queries these directly. Server-side rendering means the pub-site Next.js app is the only client; no browser-side credentials needed.

---

## 18. WEBHOOKS (inbound)

CANOPTICON receives webhooks from external sources. These are public unauthenticated endpoints with HMAC verification.

### 18.1 POST `/webhooks/youtube/pubsub`

YouTube PubSubHubbub. Verified via HMAC-SHA1 signature.

### 18.2 POST `/webhooks/openparliament`

openparliament.ca push. (If/when they implement push; for now, polled.)

### 18.3 POST `/webhooks/x-stream`

X (Twitter) filtered stream events.

Webhooks land in a queue (Cloudflare Queue), worker processes inbound, materializes a `sources` row in `pending_critic` state.

---

## 19. ERROR DETAIL EXAMPLES

### 19.1 `ceiling_reached`

```json
{
  "error": {
    "code": "ceiling_reached",
    "message": "Operation would exceed monthly cost ceiling.",
    "details": {
      "current_spent_cents": 4980,
      "operation_estimate_cents": 35,
      "monthly_ceiling_cents": 5000
    },
    "trace_id": "uuid"
  }
}
```

Client renders a dialog: raise ceiling or wait until next month.

### 19.2 `operation_blocked_no_approval`

```json
{
  "error": {
    "code": "operation_blocked_no_approval",
    "message": "Paid operation requires explicit approval.",
    "details": {
      "operation_type": "transcription_assemblyai",
      "estimated_cents": 32,
      "pending_approval_id": "uuid"
    },
    "trace_id": "uuid"
  }
}
```

Client renders cost-approval modal with the `pending_approval_id`. Operator approves via 11.6.

### 19.3 `validation_failed`

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request body failed validation.",
    "details": {
      "fields": [
        { "path": "confidence", "issue": "must be < 1" }
      ]
    },
    "trace_id": "uuid"
  }
}
```

---

## 20. VERSIONING

The API version is in the URL path (`/v1/`). Breaking changes increment the major version (`/v2/`). Both versions run side-by-side during migration windows.

Non-breaking changes (new fields, new endpoints, new optional parameters) ship within `/v1/` without version bump. The OpenAPI spec is the source of truth; this document is the human-readable companion.

Deprecation notices are sent via `Sunset` and `Deprecation` headers per RFC 8594.

---

## 21. NOTES AND DEFERRALS

**Deferred:**
- WebSocket support (using SSE for now via 11.5; WebSocket may come if bidirectional channels become necessary)
- Bulk-write endpoints (no `POST /v1/claims/bulk` — current load doesn't justify it)
- Conditional requests (`If-None-Match`, ETag) — added when caching becomes a concern
- API key auth (only JWT auth in v1; API keys for programmatic use deferred)

**Sprint 1 minimum endpoints:**

The endpoints required to make the operator app functional end-to-end:

```
Auth:        /v1/auth/me (GET, PATCH)
Sources:     GET /v1/sources, GET /v1/sources/:id, POST /v1/sources, POST /v1/sources/upload, GET /v1/sources/:id/critic-report, POST /v1/sources/:id/{approve,defer,reject}
Claims:      GET /v1/claims, GET /v1/claims/:id, POST /v1/claims/:id/verify
Entities:    GET /v1/entities, GET /v1/entities/:id, POST /v1/entities
Theses:      GET /v1/theses, GET /v1/theses/:id, POST /v1/theses, POST /v1/theses/:id/versions, GET/POST /v1/theses/:id/claims, GET /v1/theses/:id/inbox, POST /v1/theses/:id/inbox/:inbox_id/act
Cascade:     POST /v1/cascade/run, GET /v1/cascade/runs, GET /v1/cascade/runs/:id
SSE stream:  GET /v1/orchestrator/events
Cost:        GET /v1/costs/summary, POST /v1/orchestrator/approve-cost
Search:      GET /v1/search (basic version)
Webhooks:    /webhooks/youtube/pubsub
```

That's ~30 endpoints. Everything else (predictions, contradictions, articles, assumptions, indicators, questions, role invocations, entity resolution queue, full export) ships in Sprints 2+ as the corresponding substrate features come online.

The full surface is ~80 endpoints. None of it is exotic; it's all CRUD-plus-orchestration on the schema we already specified. Claude Code can implement Sprint 1's 30 endpoints and the 18-table schema in a single sustained build session.
