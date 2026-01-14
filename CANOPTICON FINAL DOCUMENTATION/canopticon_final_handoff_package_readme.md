# CANOPTICON — FINAL HANDOFF PACKAGE (v1.0)

Status: **Authoritative developer / coding‑agent handoff**

This package is the single source of truth for building Canopticon Phase 1.
All documents in this package are **specifications**, not summaries.
No implementation decisions should be made outside these files.

---

## HOW TO USE THIS PACKAGE

1. Read documents in numeric order.
2. If two documents appear to conflict, the **lower‑numbered document wins**.
3. Phase 1 ignores Engine B unless explicitly referenced.
4. No features outside this package are in scope.

---

## PACKAGE CONTENTS

### 00_PRODUCT_DEFINITION.md
Defines what Canopticon is, what it is not, scope boundaries, legal posture, and Phase 1 commitments.

### 01_ARCHITECTURE_OVERVIEW.md
Defines the two‑engine system, data flow, and non‑negotiable architectural constraints.

### 02_DATA_SCHEMA.md
Complete PostgreSQL schema with tables, enums, constraints, and lifecycle states.

### 03_INGESTION_ARCHITECTURE.md
Primary‑source ingestion workers, scheduling, deduplication at ingest, and failure handling.

### 04_SIGNAL_PIPELINE.md
Exact signal creation, clustering, deduplication, triage order, and mutation rules.

### 05_PROMPT_LIBRARY.md
Literal, versioned AI prompts with JSON I/O contracts and model selection rules.

### 06_API_SPEC.md
All backend API endpoints, auth assumptions, and mutation boundaries.

### 07_UI_ARCHITECTURE.md
Public site and operator dashboard routes, page responsibilities, and explicit non‑features.

### 08_SECONDARY_ENGINE.md
Optional Engine B (discourse, fallacy, bias analysis). Not required for Phase 1.

### 09_COST_AND_GATING.md
AI cost control, cheap vs expensive model escalation, hard caps, and circuit breakers.

---

## PHASE 1 BUILD REQUIREMENTS

Phase 1 requires only:
- Engine A (Primary Source Engine)
- Ingestion
- Signal Pipeline
- Article Synthesis
- Operator Dashboard
- Public Read‑Only Site

Engine B is excluded from Phase 1 builds.

---

## CHANGE CONTROL

All changes to this package require:
- Version bump
- Explicit rationale
- Documented diff

---

END README

