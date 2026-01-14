# 07_UI_ARCHITECTURE

Version: v1.0
Status: Authoritative
Scope: Phase 1

---

## 1. PURPOSE

This document defines all user-facing routes, page responsibilities, and UI constraints for Canopticon Phase 1.

The UI is strictly divided into:
- Public read-only surfaces
- Authenticated operator dashboard

No UI behavior may be inferred outside this document.

---

## 2. DESIGN PRINCIPLES

- Read-only by default
- No engagement mechanics
- Deterministic data loading
- Explicit mutation boundaries
- Desktop-first (Phase 1)

---

## 3. PUBLIC SITE

### 3.1 Homepage (/)

**Purpose**
- Display curated, published articles

**Content**
- Article headline
- Short excerpt
- Published timestamp

**Constraints**
- No pagination beyond simple paging
- No filters or personalization
- No live updates

---

### 3.2 Article Page (/articles/[slug])

**Purpose**
- Display synthesized article

**Tabs**
- Read (default)
- Analyze (only if available)
- Watch (only if available)

**Read Tab**
- Headline
- Full summary
- Topics and entities
- Source references (links)

**Constraints**
- No comments
- No inline editing
- No dynamic updates

---

## 4. OPERATOR DASHBOARD

### 4.1 Dashboard Home (/dashboard)

**Purpose**
- Review incoming signals

**Content**
- Signal list
- Status indicators
- Significance scores

---

### 4.2 Signal Detail (/dashboard/signal/[id])

**Purpose**
- Inspect cluster and raw articles

**Actions**
- Approve
- Reject
- Archive

---

### 4.3 Article Management (/dashboard/article/[id])

**Purpose**
- Review and manage draft article

**Actions**
- Generate draft
- Edit (pre-publish only)
- Publish

---

### 4.4 Video Export (/dashboard/video/[article_id])

**Purpose**
- Generate and download export materials

---

### 4.5 Source Management (/dashboard/sources)

**Purpose**
- Monitor ingestion health

**Actions**
- Enable/disable sources

---

## 5. MUTATION RULES

- Public UI: no mutations
- Dashboard UI: authenticated mutations only
- No bulk actions (Phase 1)

---

## 6. NON-GOALS

- Mobile-first design
- User accounts
- Comments or reactions
- Search
- Analytics dashboards

---

END 07_UI_ARCHITECTURE

