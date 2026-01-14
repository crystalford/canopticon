# 02_DATA_SCHEMA

Version: v1.0
Status: Authoritative
Scope: Phase 1

---

## 1. DATABASE OVERVIEW

The Canopticon Phase 1 system uses a relational database (PostgreSQL) as the authoritative store for all persisted state.

Design goals:
- Explicit lifecycle states
- Clear ownership boundaries
- Auditability
- Deterministic querying

No data model assumptions may be inferred outside this document.

---

## 2. ENUM DEFINITIONS

### signal_type
- breaking
- repetition
- contradiction
- shift

### signal_status
- pending
- flagged
- approved
- archived

### analysis_severity (Phase 2+)
- low
- medium
- high

---

## 3. TABLE DEFINITIONS

### 3.1 sources

Stores authoritative primary sources.

| Column | Type | Notes |
|------|------|------|
| id | uuid (PK) | Generated |
| name | text | Human-readable |
| protocol | text | json, xml, html |
| endpoint | text | Source URL |
| polling_interval | interval | Scheduler hint |
| reliability_weight | integer | Higher = more trusted |
| is_active | boolean | Kill switch |
| created_at | timestamp | |
| updated_at | timestamp | |

---

### 3.2 raw_articles

Stores ingested primary-source documents.

| Column | Type | Notes |
|------|------|------|
| id | uuid (PK) | |
| source_id | uuid (FK) | sources.id |
| external_id | text | Source-native ID |
| original_url | text | Unique |
| title | text | |
| body_text | text | Cleaned plaintext |
| published_at | timestamp | Source time |
| raw_payload | jsonb | Original response |
| is_processed | boolean | Pipeline flag |
| created_at | timestamp | |

Constraints:
- unique(original_url)

---

### 3.3 clusters

Groups related raw articles into a single event.

| Column | Type | Notes |
|------|------|------|
| id | uuid (PK) | |
| primary_article_id | uuid (FK) | raw_articles.id |
| created_at | timestamp | |

---

### 3.4 signals

Represents classified events.

| Column | Type | Notes |
|------|------|------|
| id | uuid (PK) | |
| cluster_id | uuid (FK) | clusters.id |
| signal_type | signal_type | Enum |
| confidence_score | integer | 0–100 |
| significance_score | integer | 0–100 |
| status | signal_status | |
| created_at | timestamp | |
| updated_at | timestamp | |

Indexes:
- signal_type
- status

---

### 3.5 articles

Published synthesized articles.

| Column | Type | Notes |
|------|------|------|
| id | uuid (PK) | |
| signal_id | uuid (FK) | signals.id |
| headline | text | |
| summary | text | |
| topics | text[] | |
| entities | text[] | |
| published_at | timestamp | |
| created_at | timestamp | |

---

### 3.6 video_materials

Optional export artifacts.

| Column | Type | Notes |
|------|------|------|
| id | uuid (PK) | |
| article_id | uuid (FK) | articles.id |
| script_60s | text | |
| key_quotes | jsonb | |
| angles | text[] | |
| created_at | timestamp | |

---

### 3.7 logs

Operational logging.

| Column | Type | Notes |
|------|------|------|
| id | uuid (PK) | |
| component | text | worker / pipeline |
| run_id | uuid | |
| message | text | |
| metadata | jsonb | |
| created_at | timestamp | |

---

## 4. RELATIONSHIP RULES

- raw_articles belong to exactly one source
- clusters reference a primary raw_article
- signals belong to exactly one cluster
- articles belong to exactly one signal
- video_materials belong to exactly one article

Cross-engine mutation is prohibited.

---

## 5. DATA RETENTION

- raw_articles: configurable retention window
- logs: append-only, time-based pruning
- articles: permanent

---

END 02_DATA_SCHEMA

