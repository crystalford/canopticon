# 04A_NO_AI_INGEST_AND_AI_GATING

Version: v1.1
Status: Authoritative Amendment
Scope: Phase 1 (Overrides where conflicting)

---

## 1. PURPOSE

This document corrects and hard-locks **AI usage boundaries** so that **ingestion and initial triage do NOT invoke AI**.

AI is **scarce, gated, and optional**. It must never trigger simply because a source syncs.

---

## 2. HARD RULES (NON-NEGOTIABLE)

1. **Ingestion is 100% AI-free**
2. **Signal creation is AI-free by default**
3. **No AI runs on sync**
4. **AI runs only after operator intent OR strict thresholds**

If any component violates these rules, it is a bug.

---

## 3. PHASE 1 PIPELINE (CORRECTED)

### 3.1 Ingestion (NO AI)

* Fetch primary sources
* Normalize plaintext
* Hard dedup (URL / external_id)
* Persist raw_articles
* Queue for deterministic clustering

**No embeddings. No models. No prompts.**

---

### 3.2 Deterministic Clustering (NO AI)

* Group by:
  * external_id
  * bill_id / vote_id / docket_id (where available)
  * title hash + time window
* Create or attach to cluster

This step uses **rules only**.

---

### 3.3 Deterministic Signal Typing (NO AI)

Signal type is assigned via rules:

* breaking: first occurrence of cluster
* repetition: same identifiers within window
* contradiction: explicit rule-based conflict flags
* shift: version change / amendment detected

Confidence defaults to **"unknown"** until AI is explicitly invoked.

---

### 3.4 Triage WITHOUT AI

Signals are triaged using **cheap heuristics only**:

* Source reliability_weight
* Document type (bill > speech > release)
* Scope (federal > ministry > agency)
* Length / completeness

Output:
* pending
* flagged (manual review)
* archived

---

## 4. WHEN AI IS ALLOWED TO RUN

AI may run **only** in the following cases:

### 4.1 Operator-Initiated

Operator explicitly clicks:
* "Generate Draft"
* "Assess Significance" (or "Analyze")

---

### 4.2 Threshold-Gated (Optional)

AI may run automatically **only if ALL are true**:

* signal_status = flagged
* reliability_weight ≥ threshold
* daily AI budget remaining
* feature flag enabled

Default: **OFF**

---

## 5. AI TASKS (STRICTLY LIMITED)

When AI runs, it may ONLY:

* Assess significance
* Generate headline
* Generate article summary
* Generate export materials

AI may NOT:

* Create signals
* Cluster events
* Run on ingestion
* Run automatically on sync

---

## 6. COST SAFETY

* Zero AI calls during steady-state ingestion
* AI spend occurs only during editorial action
* Budget predictability guaranteed

---

## 7. AI EXECUTION RULE (CRITICAL)

**AI is not a pipeline stage in Canopticon.**

* AI must never run automatically after ingestion, signal creation, or triage.
* There are no background jobs, hooks, listeners, or cron tasks that invoke AI.
* AI execution is manual only and requires an explicit operator action (e.g. clicking “Generate Article”, “Generate Summary”, or “Generate Analysis”).
* If no operator action occurs, AI never runs, regardless of how many signals are ingested.
* AI services may exist and remain idle, but must not be triggered implicitly by system state changes.
* Treat AI like a manual export tool, not a processing step.

**Any implementation that violates this rule is incorrect.**

---

## 8. OVERRIDES

If this document conflicts with:
* 04_SIGNAL_PIPELINE.md
* 05_PROMPT_LIBRARY.md

**This document wins.**

---
