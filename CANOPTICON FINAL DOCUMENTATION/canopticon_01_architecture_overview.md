# 01_ARCHITECTURE_OVERVIEW

Version: v1.0
Status: Authoritative
Scope: Phase 1

---

## 1. SYSTEM OVERVIEW

Canopticon is a pipeline-based system designed to ingest authoritative political sources, detect discrete events, classify them as signals, and synthesize publishable articles.

The architecture prioritizes:
- Deterministic execution order
- Clear separation of concerns
- Bounded AI usage
- Operator control

---

## 2. TWO-ENGINE MODEL

The system is divided into two independent engines:

### Engine A — Primary Source Engine (Phase 1)

Mandatory core system.

Responsibilities:
- Ingest authoritative sources
- Normalize raw content
- Detect and cluster events
- Classify signals
- Generate articles and export materials

Engine A has no dependency on Engine B.

---

### Engine B — Secondary / Discourse Engine (Phase 2+)

Optional and out of scope for Phase 1.

Responsibilities (future):
- Ingest secondary sources
- Analyze discourse, framing, and fallacies
- Reference Engine A outputs only

Engine B must never modify Engine A data.

---

## 3. HIGH-LEVEL DATA FLOW

Authoritative Sources
→ Ingestion Workers
→ Raw Articles
→ Signal Pipeline
→ Approved Signals
→ Article Synthesis
→ Operator Approval
→ Public Publication

All steps are asynchronous except operator approval.

---

## 4. COMPONENT RESPONSIBILITIES

### 4.1 Ingestion Workers

- Fetch source updates on a schedule
- Retrieve full content or discard
- Apply ingestion-level deduplication
- Persist raw content

No AI processing occurs at this stage.

---

### 4.2 Signal Pipeline

- Groups raw articles into clusters
- Determines signal type
- Assigns confidence and significance
- Applies triage rules

This pipeline defines event identity.

---

### 4.3 Article Synthesis

- Generates neutral headlines and summaries
- Extracts topics and entities
- Produces optional video/export materials

Synthesis occurs only after signal approval.

---

### 4.4 Operator Interface

- Reviews signals and clusters
- Approves or rejects publication
- Triggers article and export generation

No public mutations occur without operator action.

---

## 5. DATA OWNERSHIP & MUTABILITY

### 5.1 Immutable Data

- Raw articles (post-ingestion)
- Published articles

---

### 5.2 Mutable Data (Time-Bounded)

- Signal clusters (mutation window defined in 04_SIGNAL_PIPELINE)
- Draft articles (pre-publication only)

---

## 6. FAILURE ISOLATION

Failures must be contained to their component:

- Ingestion failure does not halt pipeline
- Signal failure does not block ingestion
- AI failure does not auto-publish

Circuit breakers and retries are mandatory.

---

## 7. PLATFORM INDEPENDENCE

The architecture must not depend on:
- Social media APIs
- Third-party publishing platforms
- Proprietary data sources

All external dependencies must be replaceable.

---

## 8. NON-GOALS (ARCHITECTURAL)

- Real-time streaming
- Cross-engine mutation
- Autonomous publishing
- User personalization

---

END 01_ARCHITECTURE_OVERVIEW

