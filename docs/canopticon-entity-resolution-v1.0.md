# CANOPTICON Entity Resolution & Claim Deduplication v1.0

**Purpose.** Specify how CANOPTICON resolves entity mentions across sources to canonical entities, and how it deduplicates claims that say substantially the same thing. These are the two hardest correctness problems in the substrate.

**Why this matters.** When three sources say "Mark Carney," "M. Carney," and "the Prime Minister," CANOPTICON must decide: one entity or three? When two sources both report Carney chaired Brookfield from 2018, CANOPTICON must decide: one claim with two supporting sources, or two claims that contradict if the dates differ slightly? Get these wrong and the Claim Graph fragments into noise. Get them right and the substrate compounds value over time.

**Scope.** This document is design only. It specifies the algorithm, the data model additions, the role-prompt approach, the operator review surface, and the phased rollout. Implementation lives in the build handoff package.

---

## 0. PROBLEM STATEMENT

### 0.1 Entity resolution

CANOPTICON's case is what the literature calls **dirty entity resolution** — partitioning a single growing collection of mentions into clusters where each cluster represents one real-world entity. There is no clean reference table to match against. There is no canonical Carney record we're trying to align messy mentions to. We're building the canonical record from the mentions.

Three things make CANOPTICON's version of this problem distinctive:

1. **Provenance is non-negotiable.** Every merge must be auditable. Operators must be able to ask "why does the system think these two mentions are the same person?" and get a specific answer with citations.

2. **Single-tenant per user, but compounding.** The graph grows over months. Bad merges early become harder to unwind later. Caution is correct.

3. **Heterogeneous entity types.** People, organizations, institutions, legislation, events, concepts — they need different matching heuristics. "Bank of Canada" and "the Bank" can resolve to the same institution; "the Bank" alone is hopelessly ambiguous without context.

### 0.2 Claim deduplication

Claims arrive from multiple sources. Two cases:

- **Same claim, multiple sources.** Globe and Mail and Reuters both report Carney's swearing-in date. This should be ONE claim with TWO supporting sources, not two competing claims.
- **Similar claims, slight variation.** Globe says Carney took office March 14; Reuters says March 13. Same fact or contradiction? Sometimes a typo, sometimes a real disagreement.

Deduplication has the same provenance requirement as entity resolution. Operators must be able to see why two claims merged.

### 0.3 What we are NOT trying to solve

- **Universal entity resolution across all users.** Each user has their own substrate. Carney in user A's substrate is not automatically the same row as Carney in user B's substrate.
- **Real-time merge during ingestion.** Resolution runs as a workflow step, not in the hot path. New mentions arrive in `entity_mentions` with `entity_id = NULL` and resolve later.
- **Perfect accuracy.** The goal is high-precision merging (very few false-positive merges) with a clear surface for operator review of low-confidence cases. False negatives (missed merges) are correctable by the operator over time; false positives are harder to unwind.

---

## 1. RESEARCH GROUNDING (2025 state of the art)

The design below is grounded in current published practice. Key references:

- **In-context Clustering-based ER with LLMs** (Fu et al., 2025, arxiv 2506.02509) — establishes the "dirty ER as in-context clustering" framing and validates LLM-based matching with explicit hallucination handling.
- **Enhancing ER using GenAI** (Reveriano, 2025) — validated the standard pipeline pattern: concatenate fields → embed → vector DB → top-K retrieval → LLM as yes/no matcher. ~80% accuracy on Amazon-Google benchmark; top-K=5 sufficient.
- **GAPLink** (Wang et al., ICIC 2025) — entropy-driven rule selection followed by rule-prompt co-compilation. Validates a two-stage approach: cheap rules first, expensive LLM second.
- **EntityRAG / Tilores** — emphasizes that fuzzy matching (cosine similarity, edit distance) remains essential as a first-pass filter even when LLMs are available.
- **The Rise of Semantic Entity Resolution** (Towards Data Science, 2025) — emphasizes that strict idempotence is impossible with hosted LLMs and that provenance tracking must be statistical, not deterministic.

CANOPTICON's design synthesizes these into a four-stage pipeline appropriate to a forensic intelligence substrate.

---

## 2. ENTITY RESOLUTION — FOUR-STAGE PIPELINE

### Stage 1: Capture

Every entity mention found during claim extraction lands in `entity_mentions` with `entity_id = NULL`. The mention captures:

- `mention_text` — the surface string ("Mark Carney", "M. Carney", "the PM")
- `context_excerpt` — the surrounding 200 characters of source text
- `source_id` — where the mention was found
- `entity_type_hint` — the extractor's best guess (person | org | institution | etc.)

Sprint 1 ships this stage. Resolution stages can run in deferred mode, leaving mentions unresolved until the operator triggers resolution. The substrate is queryable even with unresolved mentions; entity pages just don't surface them yet.

### Stage 2: Block (cheap, broad)

Reduce the candidate space before any expensive matching.

The blocking function takes a new mention and returns a candidate set of existing entities to compare against. It uses:

**For Sprint 1 (cheap, no LLM):**
- `pg_trgm` trigram similarity on `entities.canonical_name` and `entities.aliases[]` against the mention text. Threshold: similarity > 0.3 — generous, designed for recall.
- Exact-match on aliases (case-insensitive).
- Type-bucketing: only compare against entities of compatible `entity_type` (person mentions don't match against legislation).

**For v1.1 (semantic):**
- pgvector embedding similarity against pre-computed entity embeddings (top-K=5).
- Stored as a column on `entities`: `embedding vector(1536)` populated from `canonical_name + aliases + description`.
- Refreshed when an entity is updated.

**Output of Stage 2:** zero to ~5 candidate entities to evaluate. If zero candidates, the mention is provisionally a new entity (proceed to Stage 4 with no merge candidate).

### Stage 3: Match (LLM, structured)

Per the 2025 standard pipeline pattern, an LLM acts as a yes/no/uncertain matcher on each candidate pair.

**Role:** new role added to the skills package — `entity_resolver`.

**Prompt:**

```xml
<task>
You are the Entity Resolver for a forensic intelligence system. Given a new entity
mention found in a source, and a candidate canonical entity from the existing graph,
determine whether they refer to the same real-world entity.

Three possible answers:
- MATCH: confident this is the same entity
- NO_MATCH: confident this is a different entity
- UNCERTAIN: cannot determine without operator judgment

Be conservative. False positives (wrong merges) are harder to unwind than false
negatives (missed merges). When in doubt, return UNCERTAIN.
</task>

<input>
<new_mention>
  <text>{{mention.mention_text}}</text>
  <context>{{mention.context_excerpt}}</context>
  <source>{{source.title}} — {{source.publication}} — {{source.published_at}}</source>
  <entity_type_hint>{{mention.entity_type_hint}}</entity_type_hint>
</new_mention>

<candidate_entity>
  <canonical_name>{{entity.canonical_name}}</canonical_name>
  <type>{{entity.entity_type}}</type>
  <aliases>{{entity.aliases}}</aliases>
  <description>{{entity.description}}</description>
  <recent_claims_involving_this_entity>
{{top 3 most recent claims with grade A or B}}
  </recent_claims_involving_this_entity>
</candidate_entity>
</input>

<matching_criteria>
1. Surface similarity: how close are the names, accounting for honorifics, role titles,
   abbreviations, common variants?

2. Contextual fit: does the mention's surrounding text describe a person/org consistent
   with what we know about the candidate entity?

3. Disambiguating evidence: is there anything in the context that distinguishes this
   from a known different entity? (E.g., "Mark Carney the Manitoba MLA" vs the central
   banker.)

4. Type compatibility: does the entity_type_hint match the candidate's type?

5. Temporal plausibility: does the source date fit the candidate's known activity period?
</matching_criteria>

<output_format>
Emit JSON conforming to the EntityResolverOutput schema.
</output_format>

<constraints>
- Default to UNCERTAIN if the only signal is name similarity. "Mark Carney" alone is
  not enough — Mark Carney the central banker has at least two known namesakes.
- MATCH requires at least two convergent signals (e.g., name match + role context
  consistent with candidate's known activities).
- NO_MATCH is appropriate when context contradicts the candidate (e.g., the mention
  is described as deceased in 1992 and the candidate is active in 2025).
- Always include a confidence score 0.00–1.00.
</constraints>
```

**Output schema:**

```json
{
  "type": "object",
  "required": ["decision", "confidence", "signals", "reasoning"],
  "properties": {
    "decision": {
      "type": "string",
      "enum": ["match", "no_match", "uncertain"]
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "signals": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["signal_type", "weight", "description"],
        "properties": {
          "signal_type": {
            "type": "string",
            "enum": ["name_similarity", "context_match", "type_match", "temporal_fit", "disambiguation_evidence", "alias_exact_match"]
          },
          "weight": { "type": "string", "enum": ["strong", "moderate", "weak"] },
          "description": { "type": "string" }
        }
      }
    },
    "reasoning": { "type": "string" },
    "operator_review_recommended": { "type": "boolean" }
  }
}
```

**Cost:** small. Each Stage 3 invocation is ~$0.005 for Opus 4.7. With Stage 2 typically returning ≤5 candidates per mention, a typical mention costs <$0.03 to fully resolve.

### Stage 4: Decide and write

Decision matrix from Stage 3 output:

| Decision | Confidence | Action |
|----------|-----------|--------|
| match | ≥ 0.85 | Auto-merge: set `entity_mentions.entity_id`, update `entity_mentions.resolution_confidence`, log to `entity_resolution_log` |
| match | 0.70–0.85 | Surface to operator for review; tentatively merge but flag |
| match | < 0.70 | Surface to operator; do not merge |
| uncertain | any | Surface to operator |
| no_match | ≥ 0.85 | Move to next candidate (Stage 3 retry); if no candidates left, create new entity |
| no_match | < 0.85 | Surface ambiguity to operator |

Surfaced cases live in a queue (Sources screen — new tab "Entity review") and remain unresolved until the operator clears them.

**When operator approves a merge:**
- `entity_mentions.entity_id` set
- The mention's surface text added to `entities.aliases[]` if not already present
- `entity_resolution_log` row written

**When operator rejects (says it's a new entity):**
- New `entities` row created
- `entity_mentions.entity_id` set to new entity
- The new entity inherits the mention's surface text as `canonical_name` (operator can rename later)

**When operator says "split" (a previous merge was wrong):**
- New `entities` row created
- Affected mentions move from old entity to new
- All claims involving those mentions get reviewed (their `claim_entities` updates)
- An audit row in `entity_merge_history` records the split with full reasoning

---

## 3. SCHEMA ADDITIONS

Three new tables. Add to schema in v1.1.

```sql
-- Tracks every resolution decision the system or operator made
CREATE TABLE public.entity_resolution_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mention_id      UUID NOT NULL REFERENCES public.entity_mentions(id) ON DELETE CASCADE,
  resolved_to_entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  decision_source TEXT NOT NULL CHECK (decision_source IN ('llm_auto', 'llm_then_operator', 'operator_only', 'rule_based')),
  decision        TEXT NOT NULL CHECK (decision IN ('match', 'no_match', 'new_entity', 'split')),
  confidence      NUMERIC(3,2),
  candidates_evaluated UUID[] DEFAULT '{}',
  signals         JSONB,
  reasoning       TEXT,
  role_invocation_id UUID REFERENCES public.role_invocations(id),
  operator_acted_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entity_resolution_log_mention ON public.entity_resolution_log (mention_id, created_at DESC);
CREATE INDEX idx_entity_resolution_log_entity ON public.entity_resolution_log (resolved_to_entity_id) WHERE resolved_to_entity_id IS NOT NULL;

COMMENT ON TABLE public.entity_resolution_log IS 'Append-only audit log of every entity resolution decision. Required for provenance.';

-- Tracks merge/split events when operators correct prior decisions
CREATE TABLE public.entity_merge_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('merge', 'split')),
  primary_entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  affected_entity_ids UUID[] NOT NULL,
  affected_mention_ids UUID[] NOT NULL DEFAULT '{}',
  affected_claim_ids UUID[] NOT NULL DEFAULT '{}',
  reasoning       TEXT NOT NULL,
  performed_by    TEXT NOT NULL CHECK (performed_by IN ('operator', 'automatic_recall')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entity_merge_history_entity ON public.entity_merge_history (primary_entity_id) WHERE primary_entity_id IS NOT NULL;

COMMENT ON TABLE public.entity_merge_history IS 'Records of merge and split operations. Permits unwinding bad merges with full lineage.';

-- Tracks operator-pending entity-resolution queue
CREATE TABLE public.entity_resolution_queue (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mention_id      UUID NOT NULL REFERENCES public.entity_mentions(id) ON DELETE CASCADE,
  candidate_entity_ids UUID[] NOT NULL,
  llm_decision    TEXT,
  llm_confidence  NUMERIC(3,2),
  llm_reasoning   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'deferred')),
  surfaced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_entity_resolution_queue_pending ON public.entity_resolution_queue (user_id, surfaced_at) WHERE status = 'pending';
```

Plus one column on existing `entities` (Sprint 1 ships without it; v1.1 adds):

```sql
ALTER TABLE public.entities ADD COLUMN embedding vector(1536);
CREATE INDEX idx_entities_embedding ON public.entities USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 4. CLAIM DEDUPLICATION — PARALLEL APPROACH

Same four-stage pipeline as entity resolution, applied to claims.

### Stage 1: Capture

Every extracted claim lands in `claims` with `verification_status = 'unverified'`. No dedup attempted yet.

### Stage 2: Block

Find candidate existing claims that might be duplicates of the new claim. Filters:

- Same `layer` (factual claims don't dedup against framing claims)
- Shared entities: `claim_entities` overlap of ≥ 1 entity
- For Sprint 1: `pg_trgm` similarity on `claim_text` against existing claims, threshold 0.4
- For v1.1: pgvector cosine similarity on claim embeddings, top-K=5

Output: zero to ~10 candidate claims.

### Stage 3: Match

A new role: `claim_deduplicator`. Same envelope as entity_resolver. Decides whether two claims are:

- **Duplicate** (same claim, different sources — link the new source to the existing claim, drop the new claim)
- **Refinement** (new claim adds detail or qualification — supersede the old claim with the new one as a new version, preserving the old in `claim_versions`)
- **Contradicting** (claims disagree — both stay, contradiction registered in `contradictions`)
- **Distinct** (related but not the same — both stay independently)

**Prompt template:**

```xml
<task>
You are the Claim Deduplicator. Given a newly extracted claim and a candidate existing
claim, determine the relationship between them.

Four possible answers:
- DUPLICATE: same claim, different source. Link new source to existing claim.
- REFINEMENT: new claim is a more precise/qualified version. Supersede the existing.
- CONTRADICTION: claims disagree on a load-bearing element. Register a contradiction.
- DISTINCT: related but separate claims. Keep both.

Be conservative on DUPLICATE. False-positive duplicates lose information. False-negative
duplicates can be cleaned up later by the operator.
</task>

<input>
<new_claim>
  <data>{{new_claim.data}}</data>
  <claim_text>{{new_claim.claim_text}}</claim_text>
  <warrant>{{new_claim.warrant}}</warrant>
  <qualifier>{{new_claim.qualifier}}</qualifier>
  <source>{{new_claim.primary_source}}</source>
  <grade>{{new_claim.admiralty_grade}}</grade>
</new_claim>

<candidate_existing_claim>
  <data>{{existing.data}}</data>
  <claim_text>{{existing.claim_text}}</claim_text>
  <warrant>{{existing.warrant}}</warrant>
  <qualifier>{{existing.qualifier}}</qualifier>
  <existing_supporting_sources>{{existing.sources}}</existing_supporting_sources>
  <grade>{{existing.admiralty_grade}}</grade>
</candidate_existing_claim>

<shared_entities>{{entities mentioned in both}}</shared_entities>
</input>

<analysis_steps>
1. Are the data points the same factual proposition, or different propositions about
   the same entities?

2. Do the qualifiers match? (A claim "X likely happened" vs "X happened" are different.)

3. Are the warrants the same inference rule? (Two claims with the same data but
   different warrants are distinct.)

4. Does the new claim's source genuinely add evidentiary weight, or is it citing
   the same primary source as the existing?

5. Is there a meaningful disagreement that should be preserved as a contradiction?
</analysis_steps>

<output_format>
Emit JSON conforming to ClaimDeduplicatorOutput schema.
</output_format>

<constraints>
- DUPLICATE only when data, warrant, and qualifier are substantially the same.
- REFINEMENT requires the new version to be strictly more informative (more specific
  date, more sources, narrower qualifier).
- CONTRADICTION requires actual disagreement, not different framing of the same fact.
- When in doubt: DISTINCT. The operator can merge later; an incorrect merge loses
  signal.
</constraints>
```

### Output schema

```json
{
  "type": "object",
  "required": ["relationship", "confidence", "reasoning"],
  "properties": {
    "relationship": {
      "type": "string",
      "enum": ["duplicate", "refinement", "contradiction", "distinct"]
    },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "reasoning": { "type": "string" },
    "elements_compared": {
      "type": "object",
      "properties": {
        "data_match": { "type": "string", "enum": ["same", "different", "partial"] },
        "warrant_match": { "type": "string", "enum": ["same", "different", "partial"] },
        "qualifier_match": { "type": "string", "enum": ["same", "different", "partial"] }
      }
    },
    "operator_review_recommended": { "type": "boolean" }
  }
}
```

### Stage 4: Decide and write

| Relationship | Confidence | Action |
|--------------|-----------|--------|
| duplicate | ≥ 0.85 | Auto-link: new source attached to existing claim via `claim_sources`, new claim row deleted |
| duplicate | 0.70–0.85 | Surface to operator |
| refinement | ≥ 0.85 | Auto-supersede: existing claim's `is_current` version becomes the new claim's content; old version preserved in `claim_versions`; supporting sources combined |
| refinement | < 0.85 | Surface to operator |
| contradiction | any | Register in `contradictions`, both claims preserved |
| distinct | any | Both claims independent in graph |

Surfaced cases queue alongside entity-resolution review.

---

## 5. CLAIM-LEVEL PROVENANCE GUARANTEES

Three guarantees the system maintains:

1. **Every merge is reversible.** `entity_merge_history` and `claim_versions` preserve enough state to reconstruct any prior graph state. Bad merges can be split.

2. **Every match has reasoning.** No silent merges. Every `entity_resolution_log` and every claim merge writes the LLM's signals or the operator's reasoning.

3. **Operator decisions trump LLM decisions.** When operator and LLM disagree, the operator wins and the divergence is logged. Over time, divergence patterns can inform prompt refinement.

---

## 6. OPERATOR REVIEW SURFACE

The Sources screen gets a new tab — **Entity review** — surfaced when `entity_resolution_queue` has pending rows.

For each pending row:

- The new mention with its source context
- The candidate entity (or entities)
- The LLM's decision and confidence
- The signals the LLM weighted
- Three buttons: **Confirm match**, **New entity**, **Defer**
- A "Compare more deeply" affordance that pulls additional context (other mentions of the candidate entity, recent claims involving it)

Same surface for claim deduplication, with the four relationship options instead of merge/no-merge.

This becomes part of the operator's daily flow: alongside approving sources, they clear the entity/claim review queue. Items deferred more than 7 days surface a System screen warning.

---

## 7. PHASED ROLLOUT

### Sprint 1 (the minimum)

- Schema: `entity_mentions` ships with `entity_id` nullable. No resolution runs yet.
- All new mentions land unresolved. Entity pages show only mentions explicitly tied to entities (which, in practice, means manually tied).
- Claim deduplication: not active. Every extracted claim is its own claim row. Operator can manually merge later.
- Sprint 1 ships *correct* but *unresolved* substrate. Resolution waits for Sprint 2.

### Sprint 2 (cheap resolution)

- Add `entity_resolution_log`, `entity_merge_history`, `entity_resolution_queue` tables.
- Stage 2 blocking: pg_trgm only.
- Stage 3 matcher: `entity_resolver` role with the prompt above.
- Stage 4 decision matrix as specified.
- Operator review surface in Sources screen.
- Same for claim deduplication.

### Sprint 3 (semantic resolution)

- Add pgvector embeddings on entities and claims.
- Background job to populate embeddings on existing rows.
- Stage 2 blocking expands to use semantic similarity alongside pg_trgm.
- Top-K=5 retrieval (per Reveriano 2025 finding that K=10 yields marginal gains).
- Performance becomes the focus: bulk-resolution sweep on accumulated unresolved mentions.

### v1.1 and beyond

- Cross-source consistency check: an entity's claims and relations should be internally consistent. Flag entities whose recent claims contradict known earlier claims.
- Cross-model verification on high-stakes merges (linchpin entities, public-facing entities).
- Periodic rebuild: full re-resolution pass on the substrate when the prompt template version changes (`entity_resolver.skill_md_hash` updated → trigger rebuild).
- Active learning: surface random samples of auto-merges to the operator for accuracy spot-checks; use feedback to refine prompts.

---

## 8. ACCURACY EXPECTATIONS

Based on 2025 benchmarks (Amazon-Google: ~80% accuracy with GPT-4.1 or Llama-4-maverick on yes/no matching), and accounting for:

- CANOPTICON's stricter conservatism (default to UNCERTAIN, requiring two convergent signals for MATCH)
- The operator-review safety net (low-confidence cases never auto-merge)
- The phased rollout (semantic similarity not until Sprint 3)

**Realistic Sprint 2 targets:**

- ~85–90% precision on auto-merges (very few false positives)
- ~50–60% recall on auto-merges (significant fraction surface to operator review)
- ~30% of mentions resolve cleanly via auto-merge; 60% surface to operator; 10% become new entities

**Realistic Sprint 3 targets (with semantic blocking):**

- ~90% precision on auto-merges
- ~70% recall on auto-merges
- ~50% of mentions auto-resolve; 40% surface to operator; 10% new entities

These numbers are conservative. Better numbers are possible with cross-model verification and prompt iteration. The point is that the system never auto-merges with low confidence and the operator surface absorbs the residual.

---

## 9. EDGE CASES AND HANDLING

**Acronyms.** "BoC" → Bank of Canada. The `aliases[]` array on entities covers this. Stage 2 alias-exact-match catches it. New acronyms get added to the alias list when the operator confirms a merge.

**Role-as-entity ambiguity.** "the Prime Minister" or "the Bank Governor" refer to a *role*, and the actual person changes. Two design choices:

1. The role is its own entity (`role` in entity_type), and a `succession_event` creates a new entity_relation when the holder changes.
2. The role mention resolves to whoever held the role at the time of the source's publication.

CANOPTICON uses option 1 — the role is a first-class entity. Mentions of "the PM" resolve to the role entity; the role entity has relations to specific people with date ranges. Public site entity pages for roles show the succession.

**Same name, different person.** "Mark Carney" the central banker vs. "Mark Carney" the Manitoba MLA. Disambiguation requires context. The entity_resolver prompt asks for disambiguating evidence specifically. Without it, decision is UNCERTAIN.

**Person becomes corporation (or vice versa).** Carney as private citizen vs Carney as agent of the Liberal Party. Treat as one person entity, but the *relations* change over time. The entity_relations.start_date / end_date fields handle this.

**Misspellings.** Stage 2 trigram similarity catches reasonable misspellings. For aggressive misspellings (e.g., transcription errors), operator review remains the safety net.

**Foreign-language renderings.** "Banque du Canada" vs "Bank of Canada." For Sprint 2, these are aliased manually. v1.1+: an LLM-assisted alias generator runs on entities to suggest known foreign-language renderings.

**Merging mistakes.** When operator notices a wrong merge later, they trigger a split via the entity page. `entity_merge_history` records the split; affected claims and mentions move; `entity_relations` are recomputed.

---

## 10. CLAIM EDGE CASES

**Same fact, different precision.** "Carney was sworn in March 2025" vs "Carney was sworn in March 14, 2025." The deduplicator handles this as a REFINEMENT — the more precise claim supersedes, the less precise version preserved in claim_versions for audit.

**Same data, different warrant.** "Carney chaired Brookfield" used to argue (a) conflict of interest vs (b) financial-sector expertise. Same data, different inference rules. The deduplicator returns DISTINCT — both warrants are valid analytical moves and shouldn't merge.

**Compound claims.** A source says "Carney chaired Brookfield, then advised Trudeau, then became PM." This decomposes into three atomic claims at extraction time, each independently dedup'd. Compound claims are not stored; they're decomposed.

**Implicit claims.** "Carney denied the rumor" implies (a) a rumor existed, (b) Carney commented on it. Two claims. Extraction surfaces both; deduplicator handles each separately against the existing graph.

**Predictive claims vs. retrospective claims.** A March 2024 source says "Carney will likely become PM by 2026"; a March 2025 source says "Carney became PM in March 2025." These do NOT dedup — they're different claim types (prediction vs fact). The first lives in `predictions`, the second in `claims`.

---

## 11. INTEGRATION WITH CASCADE WORKFLOW

Cascade STEP 5 (claim extraction) currently states "entities resolved via Section 2 of entity-resolution doc." That hand-wave gets replaced as follows:

```
STEP 5 — Extract claims from approved sources

  STEP 5a — Cost gate (Claude API)
  STEP 5b — Invoke claim_extraction skill

  For each extracted claim:
  
    STEP 5c — Resolve entity mentions in this claim:
      For each mention:
        - Stage 2 blocking → candidate entities
        - If candidates AND Stage 3 matcher recommended:
          - Cost gate
          - Invoke entity_resolver
          - Stage 4 decision matrix
        - Else: provisionally new entity OR queue for operator
    
    STEP 5d — Deduplicate against existing claims:
      - Stage 2 blocking → candidate claims
      - If candidates:
        - Cost gate
        - Invoke claim_deduplicator
        - Stage 4 decision matrix:
          - duplicate → link source, drop new claim
          - refinement → supersede, preserve old as version
          - contradiction → register, both preserved
          - distinct → write as new claim
      - Else: write as new claim
    
    STEP 5e — Insert new claim row (if not duplicate/refinement)
    STEP 5f — Insert claim_versions (version_number=1, is_current=true)
    STEP 5g — Insert claim_sources, claim_entities rows
    STEP 5h — Emit claim.created event
```

Sprint 1 skips 5c and 5d entirely (entities resolve nullable, claims dedup later). Sprint 2 activates them.

---

## 12. COST IMPACT

Resolution adds API calls per source. Estimating for a typical source with 5 entity mentions and 3 extracted claims:

- 5 mentions × ~3 candidates each × $0.005 per match call = $0.075 per source
- 3 claims × ~2 candidates each × $0.005 per match call = $0.030 per source
- **Total: ~$0.10 per source for resolution**

For a 10-source cascade day: ~$1.00 added cost. Pushes the typical cascade from ~$1.50 to ~$2.50.

This is acceptable. Cost gates remain in place; the operator can disable resolution if budget pressure spikes (deferring to manual cleanup later).

---

## 13. WHAT THIS DOCUMENT DOES NOT SOLVE

- **Cross-thesis entity coherence.** If two theses both reference Brookfield but mean slightly different scopes (Brookfield Asset Management vs. Brookfield Corporation), the system treats them as one entity by default. v1.1 may add per-thesis entity scoping if this becomes a real problem.

- **Multilingual mention resolution.** French-language sources will be added later. The current pipeline handles translation at extraction time (claim_extraction skill translates to English in canonical_text); resolution then runs on English. Native French resolution is a v1.2+ concern.

- **Identity disclosure.** When a source uses a pseudonym or undisclosed source label ("a senior official"), no resolution attempted. These mentions remain as-is, attributed to the source's framing.

- **Fully automated split detection.** Currently splits are operator-triggered. A future system could detect inconsistencies (an entity's recent claims contradict its older claims) and propose a split. v1.1+ research direction.

---

## 14. SUMMARY

**The shape of the design:** four-stage pipeline (capture → block → match → decide), structured-output LLM matchers, conservative auto-merge thresholds, mandatory operator review queue for low-confidence cases, complete provenance via append-only logs, reversible merges via split history.

**Sprint 1:** capture only. Mentions and claims accumulate unresolved. Substrate is correct but unmerged.

**Sprint 2:** activate cheap resolution (pg_trgm blocking + LLM matching). Operator review surface live. Most mentions auto-resolve or queue.

**Sprint 3:** semantic resolution (pgvector). Higher recall, fewer operator-review surfaces.

**Beyond:** cross-model verification on high-stakes merges, periodic re-resolution sweeps when prompts change, active learning from operator decisions, multilingual support.

The architecture is conservative by design. Forensic intelligence cannot afford silent wrong merges. The operator review queue is not a flaw to be minimized; it's the safety mechanism that makes the substrate trustworthy.
