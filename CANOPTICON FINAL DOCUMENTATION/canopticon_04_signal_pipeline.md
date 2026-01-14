# 04_SIGNAL_PIPELINE

Version: v1.0
Status: Authoritative
Scope: Phase 1

---

## 1. PURPOSE

The signal pipeline transforms raw ingested documents into classified, de-duplicated political events suitable for synthesis.

This pipeline defines event identity, significance, and lifecycle.

---

## 2. CORE DEFINITIONS

- **Raw Article**: A single ingested primary-source document.
- **Cluster**: A group of raw articles referring to the same underlying event.
- **Signal**: A classified representation of an event, derived from a cluster.

---

## 3. SIGNAL TYPES

Signals are classified into one of the following types:

- **breaking**: First occurrence of a new event.
- **repetition**: Subsequent reports of the same event.
- **contradiction**: Conflicting statements or actions.
- **shift**: Material change in position, policy, or framing.

---

## 4. EXECUTION ORDER (MANDATORY)

1. Raw article enters pipeline
2. Embedding generated (title + first 800 characters)
3. Similarity search against recent clusters
4. Cluster assignment or creation
5. Signal type determination
6. Confidence scoring
7. Significance scoring
8. Triage decision
9. Signal persistence

No steps may be reordered.

---

## 5. CLUSTERING LOGIC

### 5.1 Similarity Search

- Vector model: small embedding model
- Time window: 24 hours

Similarity thresholds:
- ≥ 0.85: auto-match
- 0.70–0.84: candidate match (manual review if ambiguous)
- < 0.70: new cluster

---

### 5.2 Primary Article Selection

Within a cluster, the primary article is selected based on:

1. Source reliability_weight
2. Earliest publication time
3. Content completeness

---

## 6. SIGNAL TYPE DETERMINATION

Precedence order:

1. contradiction
2. shift
3. repetition
4. breaking

Rules:
- Contradiction requires semantic conflict
- Shift requires material change over time
- Repetition requires high similarity

---

## 7. SCORING

### 7.1 Confidence Score

- Range: 0–100
- Measures certainty of classification

---

### 7.2 Significance Score

- Range: 0–100
- Measures potential public impact

---

## 8. TRIAGE RULES

- significance < 40 → auto-archive
- significance 40–79 → pending
- significance ≥ 80 → flagged

Flagged signals require operator review.

---

## 9. MUTATION WINDOW

- Clusters may mutate for 24 hours
- Maximum 10 raw articles per cluster
- After window closes, signal becomes immutable

---

## 10. FAILURE HANDLING

- Embedding failures retry twice
- Ambiguous clusters flagged
- No signal auto-published

---

## 11. OUTPUT CONTRACT

Signal pipeline produces:

- clusters
- signals
- classification logs

No publication occurs at this stage.

---

END 04_SIGNAL_PIPELINE

