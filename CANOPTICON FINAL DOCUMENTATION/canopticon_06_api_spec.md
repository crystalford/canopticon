# 06_API_SPEC

Version: v1.0
Status: Authoritative
Scope: Phase 1

---

## 1. PURPOSE

This document defines the backend API surface for Canopticon Phase 1.

All APIs are internal-facing except where explicitly noted. The public site is read-only and consumes only GET endpoints.

---

## 2. GENERAL RULES

- All endpoints use JSON
- All mutating endpoints require authentication
- All AI-triggering endpoints are asynchronous
- No endpoint performs cross-engine mutation

---

## 3. AUTHENTICATION

### 3.1 Operator Authentication

- Session or JWT-based authentication
- Single-operator model (Phase 1)
- No public authentication

---

## 4. INGESTION ENDPOINTS

### POST /api/ingest/raw-article

Used by ingestion workers only.

**Input (JSON)**
{
  "source_id": "uuid",
  "external_id": "string",
  "original_url": "string",
  "title": "string",
  "body_text": "string",
  "published_at": "timestamp",
  "raw_payload": {}
}

**Behavior**
- Validates payload
- Applies hard deduplication
- Inserts raw_articles
- Enqueues for signal pipeline

---

## 5. SIGNAL PIPELINE ENDPOINTS

### POST /api/signals/triage

Triggers signal pipeline processing for unprocessed raw articles.

**Behavior**
- Executes full signal pipeline
- Does not publish
- Updates signal and cluster records

---

### GET /api/signals

Query signals.

**Query Params**
- status
- signal_type

---

### GET /api/signals/{id}

Fetch signal detail, including cluster membership.

---

## 6. ARTICLE ENDPOINTS

### POST /api/articles/generate

Generates draft article from approved signal.

**Input (JSON)**
{
  "signal_id": "uuid"
}

**Behavior**
- Validates signal status
- Runs synthesis prompts
- Stores draft article

---

### POST /api/articles/publish

Publishes approved draft article.

**Input (JSON)**
{
  "article_id": "uuid"
}

---

### GET /api/articles

Public and internal.

Returns published articles only.

---

### GET /api/articles/{id}

Fetch article detail.

---

## 7. VIDEO EXPORT ENDPOINTS

### POST /api/video-materials/generate

Generates export materials.

**Input (JSON)**
{
  "article_id": "uuid"
}

---

### GET /api/video-materials/{article_id}

Fetch export materials.

---

## 8. SOURCE MANAGEMENT

### GET /api/sources

List sources.

---

### POST /api/sources/{id}/disable

Deactivate a source.

---

## 9. ERROR HANDLING

- 4xx: validation or auth failure
- 5xx: system failure
- AI failures logged, not surfaced publicly

---

END 06_API_SPEC

