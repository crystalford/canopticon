# CANOPTICON Workflow Specifications v1.0

**Purpose.** The skills package documents what each role does. This document documents *when* and *in what sequence* roles fire, how the orchestrator wires them together, and how gates and branching work.

**Scope.** Eight workflows. The morning cascade is the centerpiece. Seven others cover the operator's other primary jobs (on-demand cascade, ingestion-only, publish-prep, contradiction resolution, predictive resolution, watch-set update, error recovery).

**Implementation context.** Workflows are plain code (a state machine, in TypeScript on Cloudflare Workers + Durable Objects), not an agent framework. Each workflow is a function that reads substrate, invokes roles via the Anthropic API, writes back to substrate, and emits orchestrator events. The orchestrator is functions calling functions — no agentic autonomy.

**Conventions.**
- Each workflow has a unique `workflow_name` logged in `cascade_runs.triggered_by` or `orchestrator_events.payload.workflow`.
- Steps are numbered. Branches are explicit. Gates are explicit.
- Errors propagate: a failure in step N marks the workflow `partial`, logs error_summary, and surfaces to the operator.
- No silent retries beyond the documented retry policy per step.
- Every paid operation passes through the cost discipline before execution.

---

## 0. SHARED INFRASTRUCTURE

### 0.1 The cost gate

Every paid operation across every workflow passes through this single function:

```
function approvePaidOperation(user, operation_type, estimated_cents):
  current_month_spent = sum(cost_ledger where user_id = user.id and same month)
  
  if current_month_spent + estimated_cents > user.monthly_ceiling_cents:
    block: "ceiling_reached"
    surface to operator: "Monthly ceiling reached. Increase ceiling or wait."
    return false
  
  whitelist = cost_whitelists for user, operation_type
  
  if whitelist.enabled and estimated_cents <= whitelist.per_op_max_cents:
    daily_spent_op = sum(cost_ledger where user_id, operation_type, today)
    monthly_spent_op = sum(cost_ledger where user_id, operation_type, this month)
    
    if (whitelist.daily_max_cents is null or daily_spent_op + estimated_cents <= whitelist.daily_max_cents)
       and (whitelist.monthly_max_cents is null or monthly_spent_op + estimated_cents <= whitelist.monthly_max_cents):
      return true  # auto-approved by whitelist
  
  prompt operator with cost approval modal
  wait for response (or workflow timeout)
  if approved: return true
  else: return false
```

This is the single chokepoint for the no-silent-spending discipline. Workflows do not bypass it.

### 0.2 Substrate snapshot pagination

Several roles operate on substrate snapshots that may exceed the model's context window. The orchestrator paginates:

```
function getThesisSnapshot(thesis_id, max_tokens):
  thesis = load thesis
  claims = load claims, ordered by (is_linchpin desc, grade asc, updated_at desc)
  while estimateTokens(snapshot) > max_tokens:
    drop one claim from end (lowest priority)
  return snapshot
```

For roles requiring the full graph (Verifier, Tier Projector full-tier), pagination falls back to summarizing dropped content and noting the truncation in the prompt. Truncation is logged.

### 0.3 Workflow status reporting

Every workflow writes a status record. For the morning cascade, `cascade_runs`. For others, a generic `workflow_runs` table:

```sql
CREATE TABLE public.workflow_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workflow_name   TEXT NOT NULL,
  triggered_by    TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'running',
  steps_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  role_invocation_ids UUID[] DEFAULT '{}',
  error_step      TEXT,
  error_detail    TEXT,
  output_summary  JSONB
);

CREATE INDEX idx_workflow_runs_user ON public.workflow_runs (user_id, started_at DESC);
CREATE INDEX idx_workflow_runs_name ON public.workflow_runs (user_id, workflow_name, started_at DESC);
```

(Add to schema in v1.1.)

---

## 1. MORNING CASCADE

The system's primary daily workflow. Runs unattended from cron or on-demand from the operator's "Run Cascade" button.

### Triggers

- **Cron:** Cloudflare Workers cron at `0 11 * * *` UTC (07:00 ET) when DST in effect; `0 12 * * *` UTC (07:00 EST) when not. Configurable per user via `users.cascade_cron_expr`.
- **Manual:** Operator presses "Run Cascade" on the Live screen.
- **Event-driven (later):** A high-priority event (e.g., HOT convergence detected) can fire a partial cascade.

### Steps

```
STEP 1 — Initialize
  - Create cascade_runs row, status='running'
  - Snapshot user's monthly_spent_cents
  - Compute remaining ceiling budget for this run
  - Set per-step timeout (default: 30s API calls, 5min total step)

STEP 2 — Ingest pending sources from webhooks/cron pulls
  - Query sources where ingestion_state = 'pending_critic'
  - For each (in batches of 5, parallel):
    STEP 2a — Fetch source body if not yet stored
      - If source_type = 'video' and Path A succeeds: youtube-transcript-api (FREE)
      - If source_type = 'video' and Path A fails: cost gate → Path B (AssemblyAI/openai), pay
      - If source_type = 'webpage': fetch + sanitize HTML (free)
      - If source_type = 'filing' and requires premium fetch: cost gate → fetch
    STEP 2b — Run Ingestion Critic
      - cost gate (Claude API)
      - invoke ingestion_critic skill
      - persist ingestion_critic_reports row
      - update sources.ingestion_state to 'pending_approval' or 'auto_approved'
      - emit source.critic_reported event

STEP 3 — Auto-approve where eligible
  - For each source where Critic recommended auto_approve_recommended=TRUE
    AND user.auto_ingest_a_grade_uncontested=TRUE:
    - Mark ingestion_state = 'auto_approved'
    - Insert ingestion_actions row (action='auto_approved')
    - Proceed to STEP 5 with this source

STEP 4 — Surface non-auto-approved sources to operator
  - Sources with ingestion_state='pending_approval' appear in Sources screen
  - Cascade does not block on operator review; these sources sit in the queue
  - Live feed item type='input' is generated for each pending source

STEP 5 — Extract claims from approved sources
  - For each auto-approved source AND each newly-operator-approved source since last cascade:
    STEP 5a — cost gate (Claude API)
    STEP 5b — Invoke claim_extraction skill (special non-role skill, see §1.x below)
    STEP 5c — For each extracted claim:
      - Insert claim row (status='unverified')
      - Insert claim_versions row (version_number=1, is_current=true)
      - Insert claim_sources row(s)
      - Insert claim_entities row(s) — entities resolved via Section 2 of entity-resolution doc
      - Emit claim.created event

STEP 6 — Verify newly-created claims
  - For each claim emitted in STEP 5 with grade A or B (others are skipped — too low to be worth verifying):
    STEP 6a — cost gate (Claude API + Citations)
    STEP 6b — Invoke verifier skill
    STEP 6c — Update claim.verification_status
    STEP 6d — If contradiction detected: insert contradictions row, emit contradiction.detected
    STEP 6e — Cross-model verification only if claim is_linchpin or anchored to is_public thesis (cost gate triggers operator prompt unless whitelisted)

STEP 7 — Route claims to thesis inboxes
  - For each new claim, compute watch-set matches:
    - Find theses where any thesis_watch_sets.entity_id matches a claim_entities.entity_id
    - Find theses where claim_text contains terms from thesis_concept_spine
    - Insert thesis_inbox rows (one per match)
  - These appear in the operator's thesis-detail Inbox section

STEP 8 — Generate Interrogator questions for active theses
  - For each thesis with status='in_progress' AND any new claims integrated since last cascade:
    STEP 8a — cost gate
    STEP 8b — Invoke interrogator skill
    STEP 8c — Insert questions rows
    STEP 8d — Live feed items of type='question' generated

STEP 9 — Run Gap Surfacer on selected theses
  - Selection rule: theses with last_gap_sweep_at older than 7 days OR with significant
    new-claim activity (>= 5 new claims since last sweep)
  - For each selected thesis:
    STEP 9a — cost gate
    STEP 9b — Invoke gap_surfacer skill
    STEP 9c — Persist gap_surfacer_reports row
    STEP 9d — High-priority gaps (severity != minor) become Live feed items

STEP 10 — Calibration sweep
  - Find predictions where:
    - resolves_by has passed in the last 24h, OR
    - associated indicator has new observation since last calibration sweep
  - For each:
    STEP 10a — cost gate (Claude API; small)
    STEP 10b — Invoke calibration skill
    STEP 10c — Update predictions.status, resolved_at, resolved_outcome, brier_contribution
    STEP 10d — Refresh mv_brier_rolling
    STEP 10e — Resolved predictions become Live feed items of type='resolved'

STEP 11 — Tier Projector on updated theses
  - For each thesis with thesis_versions.created_at since last cascade (= a new version was written):
    STEP 11a — cost gate
    STEP 11b — Invoke tier_projector skill
    STEP 11c — Update thesis_versions.{bluf, tier_80, tier_800, tier_full, ipcc_likelihood}
    STEP 11d — If thesis is_public: trigger pub_theses_cache rebuild (background job)

STEP 12 — Assumption Auditor (weekly only)
  - Run only if last_assumption_audit_at is more than 7 days ago
  - Sweep all assumptions for the user
  - Cost gate; invoke assumption_auditor skill
  - Update assumption statuses; emit linchpin.status_changed if any linchpin changes

STEP 13 — Detect convergences
  - Query recent claims (last 24h) grouped by entity overlap
  - For any entity mentioned in 3+ claims from 3+ distinct sources within a 120-min window:
    - Compute convergence_score = (count_sources * grade_weight_avg) / time_window_hours
    - If convergence_score > 0.75: mark items as HOT
    - Emit convergence.detected event
    - Generate Live feed item of type='converge'

STEP 14 — Assemble Live feed
  - The Live feed is a derived view, not a table. The operator's Live screen queries:
    - Recent claims (24h, sorted by HOT first, then grade)
    - Pending ingestions
    - New questions (last 24h)
    - New contradictions
    - Ready scripts (status='ready' productions, see Studio)
    - Ready drafts
    - Resolved predictions
    - Convergences
    - Errors / health flags
  - Cascade does not write the Live feed; the Live feed query reads from substrate.

STEP 15 — Finalize
  - Update cascade_runs:
    - ended_at = NOW()
    - status = 'completed' or 'partial' if any step had errors
    - sources_ingested, claims_written, questions_generated, contradictions_detected
    - total_cost_cents = sum of role_invocations costs in this run
    - role_invocation_ids = array of all role runs
  - If total_cost_cents pushed user near ceiling: set warn flag
  - Emit cascade.completed event
```

### Branching and gates

- **Cost ceiling reached at any step:** workflow halts with status='partial', logs the step at which it halted, surfaces to operator. The operator can resume via "Continue cascade" once ceiling is raised or new month starts.
- **API failure on a role invocation:** the role invocation marks itself error; the cascade continues to the next role unless the failed role was structurally required (e.g., Critic — without the report, the source can't proceed). Required-role failures halt that source's pipeline; other sources continue.
- **Operator interruption:** if operator presses "Stop cascade" the workflow finishes its current step atomically and halts. No half-written substrate.

### Outputs

- A row in `cascade_runs` with full statistics
- N rows in `role_invocations` (one per role call)
- New rows in `claims`, `questions`, `contradictions`, `predictions` (resolutions), as applicable
- Updated `claim_versions`, `thesis_versions`
- Live feed populated (via queries; not a write)
- A summary visible on the System screen and the cascade's last-run line on Live

### Cost envelope (typical)

For a daily cascade processing ~10 new sources, ~50 new claims, 3 active theses:

- Critic on 10 sources: ~$0.30
- Claim extraction: ~$0.20
- Verifier on 30 grade-A/B claims: ~$0.40 (more if cross-model)
- Interrogator × 3 theses: ~$0.15
- Gap Surfacer × 1 thesis (weekly rotation): ~$0.10
- Calibration: ~$0.05
- Tier Projector × 3 theses: ~$0.30

**Total: ~$1.50** for a representative day. Heavier days with cross-model verification on linchpin claims can run $4–$6.

### Notes

- The `claim_extraction` skill (referenced in STEP 5) is not in the eleven roles. It is a utility skill that takes a source body and returns structured claim candidates. Specified in §1.x of the skills package addendum (to be added in skills v1.1).
- STEP 9's Gap Surfacer rotation prevents every active thesis from running gap-surfacing every day (cost). Selection is round-robin within the activity threshold.
- STEP 11's Tier Projector cost is significant if `tier_full` is regenerated for a large thesis. Optimization: only regenerate `tier_full` weekly; regenerate BLUF/80/800 every cascade.

---

## 2. ON-DEMAND CASCADE (PARTIAL)

Operator-triggered. Same steps as morning cascade but with operator-specified scope.

### Triggers

- Operator presses "Run Cascade" on Live screen
- Optional scope filter: "this thesis only", "new sources only", "verify pending only"

### Steps

Identical to Morning Cascade with the following modifications:

- STEP 8, 9, 10, 11, 12 are scoped to operator's filter
- STEP 13 (convergences) always runs (cheap, broadly useful)
- STEP 14 (Live feed) always reflects whole substrate, regardless of scope

### Notes

This is what the "Run Cascade" button does on the Live screen. By default, scope = "everything since last cascade." Scope filter is power-user functionality reachable via long-press or settings menu.

---

## 3. INGESTION-ONLY WORKFLOW

Sources arrive through three channels. Each runs a minimal workflow on arrival, deferring most work to the next cascade.

### Triggers

- **Webhook fire:** YouTube PubSubHubbub, openparliament.ca push, X stream, etc.
- **Cron pull:** Cloudflare Workers cron schedule per source (Hansard 6h, news 1h, Stats Can weekly, Lobbying daily, etc.)
- **Operator upload:** drop file or paste URL via Sources screen

### Steps

```
STEP 1 — Materialize source row
  - Insert sources row with ingestion_state = 'pending_critic'
  - Store body in R2 if non-trivial; otherwise inline raw_text
  - Emit source.created event

STEP 2 — Defer to next cascade OR run inline if HOT
  - Default: do nothing further; the next cascade will pick up the source
  - If source's URL or content matches a HOT-trigger pattern (operator-defined):
    - Run Ingestion Critic immediately (cost gated)
    - If approved: extract one or two highest-confidence claims immediately
    - Surface a Live feed item right away
```

### Notes

The default deferred behavior is what keeps ingestion cheap. The cascade does the heavy lifting.

---

## 4. PUBLISH-PREP WORKFLOW

Operator-triggered when a thesis or article is about to go public. A safety pass.

### Triggers

- Operator presses "Publish" or "Make Public" on a thesis or article
- Operator requests "Pre-publish review" without publishing

### Steps

```
STEP 1 — Premortem
  - Cost gate, invoke premortem skill
  - Persist premortem_reports row
  - If is_falsifiable=false: BLOCK publication, surface to operator
  - If failure_modes contains a 'fatal' severity: BLOCK, surface

STEP 2 — Red Team final pass
  - Run Red Team from the most adversarial vantage relevant to the thesis
  - If any objection.severity = 'fatal': BLOCK, surface
  - Less-than-fatal objections are recorded but not blocking; surface as warnings

STEP 3 — Verifier sweep on linchpin claims
  - Re-verify every linchpin's supporting claims with cross-model verification
  - If any linchpin's claims are 'unsupported' or 'contested': BLOCK, surface

STEP 4 — Tier Projector regenerate Full tier
  - Even if recently regenerated, ensure it's fresh
  - Update thesis_versions.tier_full

STEP 5 — Gate
  - If all blocks cleared: continue
  - Surface summary to operator with all warnings (non-blocking)

STEP 6 — Operator confirmation
  - Display Premortem and Red Team output to operator
  - Operator confirms or cancels
  - If confirmed: set thesis.is_public = TRUE

STEP 7 — Materialization
  - Trigger pub_theses_cache build for this thesis
  - Trigger pub_articles_cache builds for any articles linked to this thesis
  - Emit thesis.published event
  - Send subscriber notifications (background job)
```

### Notes

- Premortem and Red Team running pre-publication is the system's safety net against publishing something the operator should think harder about.
- "Block" means the publish action does not complete until operator explicitly overrides.
- Steps 1–5 are roughly $1–$3 in cost. Expensive enough to budget for; cheap relative to a published mistake.

---

## 5. CONTRADICTION RESOLUTION WORKFLOW

A contradiction has been detected (by the Verifier or by the Critic). This workflow guides resolution.

### Triggers

- New row in `contradictions` with posture='open'
- Operator opens a contradiction from the Live feed or Contradiction tracker

### Steps

```
STEP 1 — Steelman both sides
  - Cost gate × 2 (one steelman per claim)
  - Invoke steelman skill on claim_a, then on claim_b
  - Persist outputs

STEP 2 — Surface to operator
  - Display both steelman outputs
  - Show all sources for each claim
  - Show the Verifier's reasoning that detected the contradiction
  - Operator chooses: resolve_a, resolve_b, machloket, retired, defer

STEP 3 — Apply resolution
  - Update contradictions.posture
  - If resolve_a: mark claim_b as 'unsupported' or 'contested', preserve in registry
  - If resolve_b: same for claim_a
  - If machloket: keep both claims active, update theses to reference both with machloket-posture markers
  - If retired: contradiction was a false flag, mark as such
  - If defer: leave open, operator returns later

STEP 4 — Propagate
  - For each thesis containing either claim: emit thesis.contradiction_resolved event
  - Tier Projector regenerates affected theses
  - If contradiction was on a linchpin claim: trigger Assumption Auditor on the affected assumption
```

### Notes

- Machloket is a legitimate resolution. The system actively supports it via dedicated columns and public-site surfacing.
- Operator is always the final decider on contradiction resolution. Roles inform; operator decides.

---

## 6. PREDICTION RESOLUTION WORKFLOW

A prediction's resolution criterion has been met (or its horizon has passed).

### Triggers

- `indicator.observed` event whose new value crosses a threshold linked to a prediction
- Calibration role's nightly sweep flagging a prediction
- Operator manual mark-resolved

### Steps

```
STEP 1 — Identify resolving evidence
  - For indicator-driven: the indicator_observation row + its source
  - For operator-driven: operator provides the source
  - For calibration-flagged: cited evidence in calibration output

STEP 2 — Calibration validates the resolution
  - Cost gate (small)
  - Invoke calibration skill (or use the prior output if from nightly sweep)
  - Confirm: outcome, brier_contribution, evidence_source_ids

STEP 3 — Apply resolution
  - Update predictions.status, resolved_at, resolved_outcome, brier_contribution
  - Add to indicator_observations.resolved_predictions if applicable
  - Refresh mv_brier_rolling

STEP 4 — Propagate
  - Emit prediction.resolved event
  - For thesis-anchored predictions: emit to thesis (potentially affecting confidence)
  - If prediction was public: trigger pub_predictions_cache rebuild
  - Subscriber notifications for "this thesis resolved" if anyone follows it

STEP 5 — Calibration aggregate update
  - Refresh per-domain Brier scores
  - If user's rolling Brier crossed a threshold (e.g., went above 0.30): surface to operator
```

### Notes

- Resolution is one-way. Once resolved, status changes are exceptional and require operator manual override.
- The public prediction ledger is the credibility moat; resolution accuracy matters more than resolution speed.

---

## 7. WATCH-SET UPDATE WORKFLOW

When operator pins/unpins/excludes an entity for a thesis.

### Triggers

- Operator action on thesis-detail Watch-Set section: add pinned, add tracked, mark derived, exclude, remove

### Steps

```
STEP 1 — Apply update
  - Insert/update/delete thesis_watch_sets row
  - Emit watch_set.changed event

STEP 2 — Backfill
  - Query existing claim_entities for the affected entity
  - Find claims mentioning this entity that aren't yet in this thesis's inbox
  - Insert thesis_inbox rows for those claims (with routed_by='watch_set_backfill')

STEP 3 — Update routing
  - Subsequent ingest cycles will route new mentions of this entity automatically
```

### Notes

This is fast and cheap. No paid operations. Just bookkeeping.

---

## 8. ERROR RECOVERY WORKFLOW

A workflow run failed. The operator wants to recover or retry.

### Triggers

- Operator clicks "Retry" on a failed cascade run or workflow run
- Operator clicks "Continue cascade" after raising ceiling

### Steps

```
STEP 1 — Inspect failure
  - Load workflow_runs row (or cascade_runs)
  - Identify error_step and error_detail
  - Identify which substrate writes succeeded (idempotency)

STEP 2 — Determine recovery mode
  - If error was cost ceiling: prompt operator to raise ceiling or wait
  - If error was API failure on a role: retry that role
  - If error was substrate corruption: surface to operator, no auto-retry
  - If error was timeout: retry from last checkpoint

STEP 3 — Resume from checkpoint
  - Workflows write to steps_completed jsonb on each step
  - Resume picks up at first step not in steps_completed
  - Steps with idempotency keys (most do) safely re-run if state is ambiguous

STEP 4 — Update workflow_run status
  - On success: status='completed' or 'partial'
  - On repeat failure: surface to operator with recommendation
```

### Notes

- Idempotency is built into role invocations: each one logs to `role_invocations` with deterministic deduplication keys (workflow_run_id + step_name + input_hash).
- For genuinely stuck workflows (e.g., a source the Critic keeps failing on), the operator can mark the source 'rejected' and continue.

---

## 9. ROLE INVOCATION SEQUENCING

For reference, the order roles fire during a typical morning cascade:

```
Sources arrive (webhooks/cron) → cascade_run starts
  ↓
Ingestion Critic (per source)
  ↓
[operator approves OR auto_approved]
  ↓
claim_extraction (utility skill, per approved source)
  ↓
Verifier (per A/B-grade claim)
  ↓
Interrogator (per active thesis with new integrations)
  ↓
Gap Surfacer (per thesis on rotation)
  ↓
Calibration (sweep of resolving predictions)
  ↓
Tier Projector (per updated thesis)
  ↓
Assumption Auditor (weekly only)
  ↓
[Convergence detection — pure SQL, no role]
  ↓
Live feed query (no write, just read)
  ↓
cascade_run finalizes
```

Red Team, Steelman, and Premortem do not fire in the cascade by default. They fire on:
- Red Team: thesis crossing confidence threshold, operator-invoked, publish-prep workflow
- Steelman: after Red Team objection, on contradiction resolution, operator-invoked
- Premortem: publish-prep workflow, operator-invoked

This sequencing keeps cascade cost predictable. Adversarial roles run on operator-initiated workflows where the cost is justified by stakes.

---

## 10. ORCHESTRATOR EVENT BUS

The full list of events emitted across all workflows. Subscribers (other workflow steps, the operator UI, the public site cache) listen on `orchestrator_events`.

```
source.created
source.critic_reported
source.approved
source.rejected
source.deferred

claim.created
claim.updated
claim.verified
claim.verification_contested
claim.verification_failed

entity.created
entity.merged    (entity resolution outcome)
entity.relation_created

thesis.declared
thesis.updated
thesis.tiers_regenerated
thesis.published
thesis.archived
thesis.contradiction_resolved

contradiction.detected
contradiction.resolved
contradiction.machloket

assumption.audited
linchpin.status_changed

prediction.banked
prediction.resolved

indicator.observed
indicator.resolved_prediction

question.generated
question.answered

red_team.fired
steelman.completed
premortem.completed
gap.surfaced

cost.ceiling_warning
cost.ceiling_reached
cost.operation_blocked
cost.whitelist_consumed

cascade.started
cascade.completed
cascade.partial
cascade.error

workflow.started
workflow.completed
workflow.error
```

Naming convention: `noun.verb_past_tense`. The noun is the substrate entity affected. The verb is what happened to it. Subscribers register interest in event patterns (e.g., `claim.*`, `*.failed`).

---

## 11. WORKFLOW IDEMPOTENCY

All workflows are idempotent at the level of substrate writes. Specifically:

- **Role invocations** are keyed by `(workflow_run_id, step_name, input_hash)`. Re-running a workflow with the same inputs returns cached invocation results; does not re-charge cost.
- **Substrate writes** check existence before insert. `claims`, `questions`, `contradictions` use natural keys (claim_text + primary_source_id, question_text + thesis_id, claim_a_id + claim_b_id) for dedup.
- **State transitions** check current state before applying. Marking a source 'approved' that is already 'approved' is a no-op.

Idempotency lets the orchestrator retry workflows safely without operator anxiety about duplicate writes.

---

## 12. WORKFLOW OBSERVABILITY

Every workflow logs:

- `workflow_runs` row (or `cascade_runs` for the cascade specifically)
- `role_invocations` rows for every role call
- `cost_ledger` rows for every paid operation
- `orchestrator_events` rows for every state transition

The operator's System screen shows:

- Last cascade run summary (claims written, questions generated, cost, duration, error count)
- Workflow run history (last 10)
- Role activity rollups (last 24h, last 7d)
- Cost rollups by operation type
- Open errors needing operator attention

This is enough observability for the active build. Future: per-step timing histograms, per-role token usage, etc.

---

## 13. NOTES AND DEFERRALS

**Deferred to v1.1:**

- Concurrent cascade runs. A user has at most one cascade running at a time; concurrent runs would require lock management on substrate writes. Single-cascade is sufficient for current loads.
- Workflow composition language. Workflows are imperative TypeScript today. A future declarative format (YAML or DSL) could let operators tune cascade behavior without code changes.
- Failure escalation. When a role consistently fails on a class of input, surface to operator as "this source type keeps failing the Critic — adjust the Critic prompt?" Currently the operator has to notice patterns manually.

**Active workflows:**

`morning_cascade` (running), `ingestion_only` (deferred-mode), `watch_set_update`. The publish-prep, contradiction-resolution, and prediction-resolution workflows activate when the corresponding substrate features come online (publishing, contradictions in real volume, prediction ledger). Error recovery is wired in from the start because failures will happen and the operator needs a path forward.

The seven workflows specified here are the operator's complete operational surface. Beyond these, every other operator action (writing a thesis, drafting an article, declaring a prediction) is direct CRUD on substrate, not a workflow.
