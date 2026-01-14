# 08_SECONDARY_ENGINE

Version: v1.0
Status: Authoritative (Deferred)
Scope: Phase 2+

---

## 1. PURPOSE

The Secondary Engine analyzes how primary political events are discussed, framed, or distorted in secondary sources.

This engine is explicitly optional and excluded from Phase 1 builds.

---

## 2. CORE PRINCIPLES

- Downstream only
- No mutation of Engine A data
- Additive analysis
- Operator-controlled execution
- Platform-agnostic design

---

## 3. INPUT SOURCES (FUTURE)

Secondary sources may include:

- Opinion journalism
- Commentary and editorials
- Blogs and newsletters
- Open social platforms (where permitted)

Engine B must never ingest or depend on Engine A outputs during synthesis.

---

## 4. ANALYSIS TYPES

### 4.1 Fallacy Detection

- Identify rhetorical fallacies
- Classify severity
- Cite supporting excerpts

---

### 4.2 Bias Analysis

- Detect framing bias
- Assign directional lean
- Provide confidence score

---

### 4.3 Contradiction Mapping

- Compare secondary claims against primary facts
- Highlight discrepancies

---

## 5. EXECUTION MODEL

1. Operator selects primary article
2. Secondary sources are collected
3. Analysis prompts are executed
4. Results are stored separately
5. Outputs are optionally published

No automated publishing is permitted.

---

## 6. SAFETY CONSTRAINTS

- No automated posting
- No coordinated amplification
- No real-time response loops
- No platform-specific coupling

---

## 7. DATA STORAGE

- Analysis results stored in dedicated tables
- References primary articles via IDs only

---

## 8. NON-GOALS

- Live social monitoring
- Sentiment scoring for engagement
- User targeting

---

END 08_SECONDARY_ENGINE

