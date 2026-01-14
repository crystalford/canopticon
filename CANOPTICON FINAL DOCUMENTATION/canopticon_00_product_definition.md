# 00_PRODUCT_DEFINITION

Version: v1.0
Status: Authoritative
Scope: Phase 1

---

## 1. PRODUCT MISSION

Canopticon is a primary-source political synthesis system that converts authoritative Canadian political events into neutral, structured, and publishable articles within minutes of occurrence.

The system prioritizes speed, accuracy, and structural understanding over opinion, engagement, or platform-driven amplification.

---

## 2. CORE PROBLEM

Primary political events (legislation, votes, rulings, official statements) occur continuously, but public understanding lags due to:

- Fragmented source distribution
- Delayed media interpretation
- Opinion-driven framing
- Platform incentives that favor reaction over structure

Canopticon exists to close this gap by synthesizing primary events directly.

---

## 3. CORE PRINCIPLES

### 3.1 Primary Sources Only (Engine A)

Phase 1 operates exclusively on authoritative, primary sources:

- Parliament of Canada
- Prime Minister’s Office
- Federal ministries and regulators
- Supreme Court of Canada
- Elections Canada

No opinion journalism, social media, or commentary is ingested by Engine A.

---

### 3.2 Instant Synthesis

Events are detected, clustered, triaged, and synthesized into articles on a near-real-time basis.

Latency targets:
- Detection to signal: minutes
- Signal to draft article: minutes
- Publication: operator-controlled

---

### 3.3 Neutral Posture

All Phase 1 output is:
- Non-performative
- Non-adversarial
- Non-editorial

The system explains what happened, why it matters structurally, and what it may affect next.

---

### 3.4 Operator-Gated Publishing

All public publication requires explicit operator approval.

AI systems:
- Propose
- Classify
- Synthesize

They do not publish autonomously.

---

## 4. WHAT CANOPTICON IS NOT

Canopticon is explicitly NOT:

- A news aggregator
- A social media platform
- A real-time alert feed
- A personalization engine
- A comment or debate platform
- A fact-checking service (Phase 1)

---

## 5. PRODUCT SURFACES

### 5.1 Public Site

- Read-only
- Curated
- Article-based
- No accounts
- No comments
- No engagement mechanics

---

### 5.2 Operator Dashboard

- Authenticated
- Single-operator (Phase 1)
- Signal review and approval
- Article generation and management
- Video/export material generation

---

## 6. ENGINE MODEL

Canopticon is composed of two independent engines:

- **Engine A**: Primary Source Engine (Phase 1, mandatory)
- **Engine B**: Secondary / Discourse Engine (Phase 2+, optional)

Engine A must be fully functional without Engine B.

---

## 7. PHASE DEFINITIONS

### Phase 1 (MVP)

Included:
- Engine A
- Ingestion workers
- Signal pipeline
- Article synthesis
- Operator dashboard
- Public read-only site

Excluded:
- Social media ingestion
- Fallacy or bias detection
- Automated posting
- User accounts

---

### Phase 2+ (Out of Scope)

- Engine B (discourse analysis)
- Secondary source ingestion
- Platform monitoring

---

## 8. LEGAL & COMPLIANCE POSTURE

- Uses publicly available primary-source material
- Does not republish full source texts
- Produces original synthesized editorial content
- No paywall circumvention
- No scraping requiring authentication

Raw ingestion data retention policies are defined in later documents.

---

## 9. SUCCESS CRITERIA (PHASE 1)

- Accurate detection of primary political events
- Low false-duplicate rate in signal clustering
- Clear, readable articles within minutes of event occurrence
- Zero unauthorized publication
- Predictable and bounded AI costs

---

END 00_PRODUCT_DEFINITION

