# 09_COST_AND_GATING

Version: v1.0
Status: Authoritative
Scope: Phase 1

---

## 1. PURPOSE

This document defines cost control, model selection, and execution limits for all AI operations in Canopticon Phase 1.

The objective is to ensure:
- Predictable operating costs
- Bounded AI usage
- Graceful degradation under failure

---

## 2. MODEL TIERS

### 2.1 Cheap Model Tier

Used for:
- Signal classification
- Deduplication checks
- Confidence and significance scoring

Characteristics:
- Low cost
- Deterministic settings
- Short context windows

---

### 2.2 Expensive Model Tier

Used for:
- Article synthesis
- Headline generation
- Video/export materials

Escalation to this tier is conditional and operator-controlled.

---

## 3. ESCALATION RULES

Escalation to the expensive tier is permitted only when:

- signal_status = approved
- significance_score ≥ 40
- daily cost cap not exceeded

No expensive model call may occur before signal approval.

---

## 4. HARD COST CAPS

The system enforces the following caps:

- Per-signal AI calls: fixed maximum
- Daily AI spend: fixed maximum
- Monthly AI spend: fixed maximum

When a cap is reached:
- Further AI calls are blocked
- Operator is notified
- System continues ingesting but does not synthesize

---

## 5. CIRCUIT BREAKERS

Circuit breakers trigger when:

- AI provider returns repeated errors
- JSON output validation fails repeatedly
- Cost anomalies are detected

On trigger:
- AI execution halts
- Signals remain pending
- Manual intervention required

---

## 6. FALLBACK BEHAVIOR

If AI synthesis is unavailable:

- Signals remain visible in dashboard
- No partial or degraded articles are published
- Operator may retry or archive

---

## 7. MONITORING & LOGGING

The system must log:

- AI calls per signal
- Tokens used
- Cost per call
- Model tier used
- Failure reasons

These logs are mandatory for audit and tuning.

---

## 8. NON-GOALS

- Dynamic pricing optimization
- Auto-scaling AI budgets
- Model fine-tuning (Phase 1)

---

END 09_COST_AND_GATING

