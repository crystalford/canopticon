# 03_INGESTION_ARCHITECTURE

Version: v1.0
Status: Authoritative
Scope: Phase 1

---

## 1. PURPOSE

The ingestion system is responsible for detecting new primary-source documents and persisting normalized raw content for downstream processing.

Ingestion is strictly separated from signal logic, AI processing, and publication.

---

## 2. DESIGN PRINCIPLES

- Primary sources only
- No real-time guarantees
- Idempotent execution
- Failure isolation
- Replaceable workers

---

## 3. SUPPORTED SOURCE TYPES (PHASE 1)

### 3.1 Government APIs

- Parliament of Canada (Hansard, bills, votes)
- PMO statements
- Federal ministries and regulators

Protocols:
- JSON
- XML

---

### 3.2 Unsupported / Explicitly Excluded

- RSS feeds
- Social media
- Authenticated scraping
- Browser automation

---

## 4. INGESTION WORKERS

Each worker is a stateless process dedicated to a single source or protocol.

### 4.1 Worker Responsibilities

- Poll source endpoint
- Detect new items
- Fetch full content or discard
- Normalize to plaintext
- Apply ingestion-level deduplication
- Persist raw_articles

Workers do not:
- Perform clustering
- Perform AI analysis
- Publish content

---

### 4.2 Example Worker Types

| Worker | Protocol | Notes |
|------|----------|------|
| PARLIAMENT_API_WORKER | JSON | Bills, votes |
| PMO_WORKER | JSON | Statements |
| REGULATOR_WORKER | JSON/XML | Decisions |

---

## 5. INGESTION FLOW

1. Scheduler triggers worker
2. Worker fetches candidate list
3. Known IDs/URLs are filtered
4. Full content fetched
5. Content normalized to plaintext
6. Quality gates applied
7. raw_articles inserted
8. Item queued for signal pipeline

---

## 6. QUALITY GATES

Items are discarded if:
- body_text < 500 characters
- content is non-textual
- missing published_at
- duplicate original_url

---

## 7. DEDUPLICATION (INGESTION)

Deduplication at ingestion is limited to:

- Hard deduplication: original_url, external_id
- Soft deduplication: title hash within 24h

Semantic deduplication is handled later.

---

## 8. ERROR HANDLING

- 3 retries per fetch
- Exponential backoff
- Worker-level failure logging
- Automatic source deactivation on repeated failure

---

## 9. SECURITY & COMPLIANCE

- Respect robots.txt
- No authenticated access
- No paywall circumvention
- No script execution

---

## 10. OUTPUT CONTRACT

Ingestion produces:

- raw_articles records
- ingestion logs

No other side effects are permitted.

---

END 03_INGESTION_ARCHITECTURE

