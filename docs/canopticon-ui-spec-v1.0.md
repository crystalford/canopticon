# CANOPTICON UI Specification v1.0

**Functional specification of every screen the system requires.** Derived from Master Synthesis v1.5.1. Visual implementation (layout, typography, specific component styles) follows in the prototype phase.

This document specifies what each screen contains, what data it shows, what controls exist, what actions the operator can take, and what transitions exist between screens. Visual aesthetic constants (dark industrial register, monospaced typography, amber-on-black or equivalent, no rounded corners, no decorative transitions) apply by default and are not re-specified per screen.

---

## Organizing Principle

CANOPTICON has two faces: **public** and **operator**. They share infrastructure but have distinct UI.

The **public face** is what readers see at canopticon.com — investigations, the Brier calibration curve, the public Question Graph, optional MCP-queryable surfaces. Clean, citation-dense, publication-register.

The **operator face** is what the operator uses to run the system — ingestion dashboards, registries, workflow controls, cost surfaces, publication tooling. Dense, inspectable, editor-register.

Both are served from the same substrate; what differs is what they expose and how.

---

## Part I — Operator Face

### Screen 1: Home / Command Center

The landing screen after operator login. The operator's at-a-glance view of what the system is doing and what requires attention.

**Contents:**
- Ingestion status panel — last automatic ingestion timestamp per source, next scheduled run, count of items pending Ingestion Critic gate
- Cost panel — month-to-date spend against $50 ceiling (or operator-set ceiling), rendered as a horizontal bar, with per-category breakdown (transcription, generation, verification, other)
- Attention queue — items requiring operator decision, ordered by urgency: pending ingestion approvals, firing indicators, linchpin assumptions flagged for re-review, contradictions needing resolution, publication-bound claims awaiting final verification
- Active investigations list — ongoing investigations with last-activity timestamp and status (probing, drafting, verifying, ready-to-publish)
- Recent graph deltas — what the system has added to the substrate in the last 24 hours: new claims, new questions, new contradictions, new book-graph entries. Counts plus drill-in links

**Controls:**
- Global "pause automatic ingestion" toggle — emergency stop for all scheduled cron triggers
- "New investigation" button — starts a fresh investigation context
- Navigation to every other screen

**Actions:**
- Click any attention-queue item → jump to the screen where it's resolved
- Click any graph-delta count → jump to the registry filtered to those items
- Click the cost bar → Cost Control screen

---

### Screen 2: Ingestion Dashboard

Where the operator sees what is being ingested automatically and approves or rejects pending items. This is the gate that keeps the system accountable.

**Contents:**
- Live ingestion feed — scrolling log of what automatic workers are doing right now, one row per event (source pulled, items found, Ingestion Critic running, report ready)
- Pending approval queue — items through the Ingestion Critic gate awaiting operator decision, each showing: source, timestamp, Admiralty grade, bias profile flag, contradiction flags against existing registry, Ingestion Critic's written assessment, and the source content itself (inline preview, expandable)
- Source tempo view — per-source configuration: cron schedule, last successful run, failure count, items-ingested-this-week count
- Cost attribution per source — even when all sources are free, this panel exists so that if a paid source is added later, its budget consumption is visible at the source level

**Controls:**
- Approve / Reject / Defer buttons on each pending item
- Per-source pause toggle — disable automatic ingestion from a specific source without affecting others
- Edit cron schedule per source
- "Run now" manual trigger per source
- Bulk approve with a caveat filter (approve all A-grade no-contradiction-flag items)

**Actions:**
- Approve → source writes to registries, triggers downstream roles (Interrogator, etc.)
- Reject → source discarded, logged with reason
- Defer → moves to a "review later" queue, does not block

**Critical behaviors:**
- No source bypasses the gate
- Rejected sources are logged; the system does not silently forget them in case the operator later wants to reverse
- Approval is one-click but the full Ingestion Critic report is inline — operator cannot approve without having seen the assessment

---

### Screen 3: Cost Control

The no-silent-spending surface. Where every paid operation is proposed, approved, and tracked.

**Contents:**
- Current month spend vs ceiling, rendered as a bar with exact dollar amounts
- Ceiling editor — current ceiling, history of ceiling changes, operator can raise or lower
- Spend forecast — at current rate, projected end-of-month total (lightweight, not a commitment, just a signal)
- Per-category breakdown — transcription, generation (Claude API), verification (cross-model), image/video generation, paid downloads, research briefs
- Per-operation history — every paid operation, with timestamp, cost, purpose, and outcome
- Pending cost approvals — operations queued up waiting for operator approval

**Controls:**
- Approve / Reject / Modify on each pending operation
- Ceiling adjustment
- "Block all paid operations" toggle — emergency stop
- Whitelist rules — operator can create standing rules (e.g., "auto-approve transcription under $0.50" or "auto-approve verifier calls under $0.10") within the monthly ceiling. Whitelisted operations do not prompt individually but do count against the ceiling and are logged

**Actions:**
- Approving a pending operation → operation runs immediately, cost is logged
- Rejecting → operation is cancelled, the upstream workflow handles it (either halts that investigation step or uses free alternative)

**Critical behaviors:**
- When the ceiling is reached, all non-whitelisted paid operations block until operator raises ceiling or month resets
- Whitelist rules never raise the ceiling; they only auto-approve within it
- The ceiling applies to both operator-driven and automatic ingestion — the system cannot silently spend through automatic ingestion because automatic ingestion has no whitelist for paid operations by default

---

### Screen 4: Claim Graph Explorer

The primary substrate view. Where the operator inspects, traces, and edits the claim network.

**Contents:**
- Search bar — full-text search across claim text
- Filter controls — by Admiralty grade, IPCC likelihood, inference type (deduction/induction/abduction), Cynefin domain, leverage-point level, Gettier-audit status, recency, source
- Result list — claims matching filter, each row showing claim text, grade stack, centrality score, linked-question count, contradiction flag
- Detail pane on selected claim — full Toulmin decomposition with mandatory warrant, all supporting evidence with Van Evera test typing, confidence stack (Admiralty source, Admiralty credibility, IPCC likelihood, numeric range), Gettier-audit status, belief-trajectory history graph, linked questions, linked contradictions, linked assumptions, inference-type tag, leverage-point tag if applicable, Cynefin domain tag
- Graph view toggle — switch from list to network visualization of the claim and its neighbors

**Controls:**
- Edit any field on the selected claim
- Retract a claim (with required reason)
- Manually add a new claim (which then runs through Ingestion Critic as an operator-sourced claim)
- "Run role on this claim" dropdown — manually invoke Interrogator, Red Team, Steelman, Assumption Auditor, or Gap Surfacer on the selected claim

**Actions:**
- Click a linked question → Question Dashboard filtered to that question
- Click a linked contradiction → Contradiction Registry filtered to that contradiction
- Click a linked assumption → Assumption Registry filtered to that assumption
- Click an evidence source → Book Graph or Source Registry filtered to that source

---

### Screen 5: Question Dashboard

The interrogatives surface. Where the operator sees what the system is asking, prioritizes, and tracks answers.

**Contents:**
- Question list, sortable by urgency, expected-information-gain, age, status
- Per-question row — question text, type tag, Kipling classification, linked-claim references, status (open / in-progress / answered / unanswerable / abandoned)
- Detail pane — full question text, generation provenance (which role generated it from which claim), linked parent/child/sibling questions, adversarial-relationship links, cost-to-answer estimate, answer attempts history

**Controls:**
- Status dropdown per question
- "Answer this" button → opens a workflow where operator provides evidence and the system updates linked claims
- "Abandon with reason" — abandoned questions are preserved in the graph
- "Generate sub-questions" — fires Interrogator on the selected question
- Filter by linked investigation

**Actions:**
- Click a linked claim → Claim Graph Explorer
- Mark answered → prompts for evidence, triggers claim updates

**Critical behavior:**
- Questions are never auto-closed; operator must explicitly resolve or abandon. This prevents the system from quietly deciding it has the answer when it doesn't.

---

### Screen 6: Assumption & Linchpin Registry

Where load-bearing assumptions are tracked and linchpins are flagged.

**Contents:**
- Assumption list with filter (all / linchpins only / challenged / under revision)
- Per-assumption row — text, dependent claim count, confidence, test-that-would-falsify, status
- Linchpins in red at top of list, always visible regardless of other filters
- Detail pane — full text, dependent claims (list), falsification test, revision history, date of last re-review

**Controls:**
- Re-review button — fires Assumption Auditor on this assumption
- Edit assumption text (changes are versioned)
- Promote to linchpin / demote from linchpin
- Mark challenged / under revision / abandoned

**Actions:**
- Click a dependent claim → Claim Graph Explorer

**Critical behavior:**
- Linchpins trigger a scheduled sweep automatically every N days (operator-configurable, default weekly). The sweep result shows up in the attention queue on the home screen.

---

### Screen 7: Indicator Wall

Forward-looking observables that would shift beliefs when they fire.

**Contents:**
- Indicator list, filterable by status (monitoring, fired, stale, retired) and by linked hypothesis
- Per-indicator row — description, linked hypothesis, diagnosticity score, monitoring status, threshold condition, last-fired date if applicable
- Detail pane — full specification, firing history, linked belief-update effects, base-rate annotation if available

**Controls:**
- Manual "fire this indicator" button (with reason logged) — useful for testing or when the system misses a firing
- Edit threshold condition
- Retire indicator (with reason)
- Mark stale (stops monitoring without retiring)

**Actions:**
- When an indicator fires, the home-screen attention queue shows it; operator confirms or contests the firing
- Confirmed firings trigger downstream belief updates on linked claims

---

### Screen 8: Contradiction Registry

Where detected contradictions are held, worked through, and either resolved or preserved.

**Contents:**
- Contradiction list with filter (unresolved / resolved / held-as-machloket)
- Per-contradiction row — claim A side summary, claim B side summary, contradiction type, resolution status
- Detail pane — full claim A with Toulmin decomposition, full claim B with Toulmin decomposition, steelman of each, ACH matrix if constructed, diagnostic evidence that would resolve, preservation note if held as machloket

**Controls:**
- Mark resolved (with resolution note and which side was upheld / how they were synthesized)
- Hold as machloket — preserve as productive disagreement, not forced to resolution
- Request additional evidence — generates a question in the Question Graph
- "Run Red Team on this" / "Run Steelman on this" manual triggers

**Actions:**
- Click into either claim → Claim Graph Explorer

**Critical behavior:**
- Contradictions can be held indefinitely; the system does not pressure the operator to resolve them. Some contradictions are analytically productive to preserve.

---

### Screen 9: Book Graph

Where books are ingested, browsed, and their extracted claims are reviewed.

**Contents:**
- Book list — title, author, acquisition mode (A full-text / B AI-extracted / C hybrid-chat), date added, claim count, concept count
- Per-book detail pane — metadata, full claim list extracted from the book, concepts, citations out (what the book cites), citations in (what in CANOPTICON cites this book), margin notes
- Concept browser — cross-book concept view, showing which books address which concepts

**Controls:**
- Add book (opens mode selector — operator picks A, B, or C)
- In Mode C, opens a chat interface where operator and Claude read together; claims extracted conversationally
- Edit extracted claims
- Retract a book (with reason) — all claims from it are flagged; operator chooses to retract them or mark them as unsupported

**Actions:**
- Click a concept → shows all books and claims touching it
- Click a claim → Claim Graph Explorer

**Critical behavior:**
- Mode B claims are always flagged "model-recalled, not primary-verified" until operator promotes them with evidence
- Methodology canon books (tier 1 and 2 from the canon document) are pre-loaded as an optional starter library

---

### Screen 10: Brier Registry & Calibration

The public-facing-by-default credibility surface. Operator view has more detail than public view.

**Contents:**
- Calibration curve plot — predicted probability bands on x-axis, observed frequency on y-axis, with the ideal 45-degree line, color-coded by topic or by time period
- Aggregate Brier score, expected calibration error (ECE), number of resolved predictions
- Prediction list with filter (resolved / pending / by topic / by confidence band)
- Per-prediction detail — probability stated, resolution date, resolution outcome, contribution to calibration, linked claim or indicator, which role/context produced the prediction
- Systematic bias flags — if the system detects consistent miscalibration (e.g., overconfident in the 70-90% band), it surfaces this as a warning with recommended prompt-level corrections

**Controls:**
- Resolve a prediction manually (with outcome and evidence)
- Retract a prediction with reason (counts against credibility but preserves honesty)
- Toggle between public view and full-detail operator view

**Actions:**
- Click a prediction → linked claim or indicator

**Critical behavior:**
- The calibration curve is public by default on the published site; the operator view has the same curve plus bias flags and unresolved-prediction queue

---

### Screen 11: Investigation Workspace

Where actual investigations happen — the work surface for a specific case.

**Contents:**
- Investigation metadata — title, status, Cynefin domain tag, linked thesis, start date
- Layered analysis panel — the investigation's layer decomposition (factual, framing, architectural, distributive) with claims attached to each layer
- Claim subgraph for this investigation — scoped view of the Claim Graph filtered to this investigation
- Active questions panel — open questions generated for this investigation
- Tier preview — live-updating BLUF, 80-word, 800-word projections of the current investigation state
- Role invocation log — every role that's fired on this investigation, with timestamp and output summary

**Controls:**
- "Run Gap Surfacer" button — fires the seven-stage sweep on this investigation
- "Draft publication" button — locks the current state and generates the full Investigation Report template (Executive Summary, Background, Narrative parts, Conclusion, Timeline, Key Players, Key Quotes, Sources, Methodology)
- "Generate derivative content" button — after publication draft, generates email alert, standalone articles, YouTube script, TikTok scripts, X threads
- Manual role triggers on selected claims

**Actions:**
- Click any tier preview → full-screen view of that tier
- Click publication draft → Publication Workspace (next screen)

---

### Screen 12: Publication Workspace

Where a draft investigation is reviewed, verified, and pushed to publication surfaces.

**Contents:**
- Full investigation report rendered in publication format
- Inline citation density indicator per paragraph — visual signal of how grounded each section is
- Verification status panel — every claim's verification status from the two-stage Verifier, with flags for anything unsupported or partially grounded
- Derivative content tabs — email, standalone articles, YouTube script, TikTok scripts, X threads
- Final cost tally for this publication (transcription, generation, verification)

**Controls:**
- Edit any section
- "Re-verify all" — fires the Verifier on every claim again (costs real money, prompts for approval per cost-control UX)
- Per-surface publish toggles — push to canopticon.com, push to X, push to YouTube, push to TikTok, push to Substack, push to email subscribers. Each toggleable independently
- "Schedule publication" — queue for later
- "Preview public view" — see what readers will see

**Actions:**
- Publish → all toggled surfaces receive the content, the investigation's status flips to published, Brier-tracked predictions embedded in it start tracking

**Critical behavior:**
- Publication cannot proceed if any claim is flagged unsupported by the Verifier, unless operator explicitly overrides with a logged reason
- Once published, edits are logged as versioned corrections, not silent updates

---

### Screen 13: Registry Admin

Meta-controls for the substrate itself.

**Contents:**
- Schema version and last-modified timestamp per registry
- Source Registry view — every source and its track record across investigations
- Eval suite status — periodic runs of the 20–50 representative task suite, pass/fail rates per role Skill
- Git log view — recent commits to the registries and Skills
- System health — Worker status, Durable Object counts, Postgres connection health, R2 storage used

**Controls:**
- Run eval suite on demand
- Roll back a registry to a previous git commit (emergency only, logged)
- Edit Skill prompts (opens Skills editor)

**Actions:**
- Click a Skill → Skill editor for that role's prompt

---

### Screen 14: Skills Editor

Where role prompts live, version, and are tested.

**Contents:**
- List of all Skills (Interrogator, Red Team, Steelman, Premortem, Verifier, Gap Surfacer, Calibration, Tier Projector, Assumption Auditor, Ingestion Critic, Indicator Validator)
- Per-Skill view — SKILL.md content, prompt template, output schema, recent invocation history, eval pass rate
- Edit mode for each Skill with git-backed versioning

**Controls:**
- Edit SKILL.md
- Edit prompt template
- Edit output schema (triggers registry schema check)
- "Test on sample" — run the Skill against a canned input to preview output
- Commit changes (triggers eval suite)

**Actions:**
- Revert to previous version
- Diff against previous version

**Critical behavior:**
- Schema changes that break existing registry data are blocked until operator resolves migration
- Eval suite must pass before changes take effect in production flows

---

## Part II — Public Face

### Screen P1: canopticon.com Home

The published-work landing page. Reader-facing, publication-register.

**Contents:**
- Tagline: "Canadian political intelligence — long-form investigations, deep dives, and forensic analysis"
- Latest investigation — full preview with Executive Summary
- Investigation archive — chronological list with filter by topic and by year
- Brier calibration curve — public view, credibility forcing-mechanism
- Public Question Graph link — readers can see what investigations left open
- MCP endpoint link for developers/researchers who want to query the substrate

**Controls (reader):**
- Subscribe to email
- Filter archive
- Follow investigation RSS feed

---

### Screen P2: Investigation Page

Individual published investigation.

**Contents:**
- Full investigation in publication format (Executive Summary through Methodology)
- Inline citations with expandable source panels
- Claim-level grade indicators (Admiralty + IPCC likelihood) — subtle, available-on-hover, not cluttering the prose
- Linked Question Graph subsection — the questions this investigation left open
- Related investigations

**Controls (reader):**
- Cite this investigation
- Share to each platform
- Download as PDF
- View methodology

---

### Screen P3: Public Brier Dashboard

The calibration curve and track record, publicly available.

**Contents:**
- Aggregate Brier score, ECE, total resolved predictions
- Calibration curve plot
- Resolved-prediction log — every prediction, its probability, and its outcome
- Filter by topic and time period

**Controls (reader):**
- No edit controls; read-only
- Download calibration data as CSV for independent analysis

---

### Screen P4: Public Question Graph

The interrogatives the system is tracking that haven't been resolved.

**Contents:**
- Open questions grouped by topic
- Each question shows linked investigation (if any), age, and type
- "Contribute an answer" contact form — readers can submit evidence toward open questions, which goes through the Ingestion Critic gate

**Critical behavior:**
- Not every question is public; operator marks which questions are public-facing
- Reader submissions are treated as a new source with appropriate Admiralty grading

---

## Transitions and Cross-Screen Behavior

The operator face is navigation-heavy. Every claim, question, assumption, indicator, contradiction, or source reference is a link that opens the relevant registry screen filtered to that item. Deep linking should work for every entity in every registry.

The home screen's attention queue is the operator's primary navigation pattern — items in the queue link directly to the screen where they're resolved, not just to the registry they live in.

Modal dialogs are used sparingly. Cost approval is a modal because it requires an immediate decision. Most other operator actions happen inline on the relevant screen.

Keyboard-first navigation is supported where possible — registry screens have vim-style j/k navigation between rows, enter to open, escape to close.

---

## Responsive Posture

The operator face is desktop-first. It assumes a full-size screen with enough real estate for a substrate view plus detail pane. It does not need to work well on mobile — the operator does not run investigations from a phone.

The public face is responsive. Investigation pages must read well on mobile, tablet, and desktop. The Brier calibration curve and Question Graph must be legible on mobile.

---

## Accessibility

Keyboard navigation works on every screen. Screen reader support on public-facing pages is mandatory. Color is never the sole signal — grade indicators, status flags, and attention markers use text and icons alongside color. The aesthetic constants (dark industrial, monospace, amber) do not override accessibility requirements; contrast ratios meet WCAG AA minimum.

---

## What This Spec Does Not Cover

Visual layout, component library choice, specific typography, animation timing, specific shades of amber or black. Those decisions happen in the prototype phase when the operator can react to rendered screens.

Copy — button labels, tooltip text, error messages. That's editorial work that happens during implementation with the operator's voice.

Exact URL structures for the public site. That's an SEO and routing decision made during the build.

---

## Implementation Priority

Not every screen needs to exist on day one. The build order, aligned with v1.5.1's implementation phases:

**Must exist early:** Home / Command Center, Ingestion Dashboard, Cost Control, Claim Graph Explorer, Question Dashboard, Investigation Workspace, Brier Registry (operator view), canopticon.com Home, Investigation Page.

**Add as substrate fills:** Assumption & Linchpin Registry, Indicator Wall, Contradiction Registry, Book Graph, Registry Admin, Skills Editor.

**Last:** Publication Workspace derivative-content tabs, Public Question Graph, Public Brier Dashboard, MCP endpoint surface.

The operator can run useful investigations with only the must-exist-early screens. Everything else adds capability as needed.

---

*End of UI Specification v1.0. Companion to Master Synthesis v1.5.1. Visual implementation follows in prototype phase.*
