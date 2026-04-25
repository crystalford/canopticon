# CANOPTICON — Master Synthesis v1.5.1

**Patch to v1.5.** Locks the implementation architecture (workflow orchestration over a rich data substrate, not autonomous multi-agent) and corrects the operator-centric framing of ingestion (operator-driven and automatic ingestion are equal peers).

All other sections of v1.5 remain in force. This document supersedes v1.5 only on the changes explicitly noted below.

---

## What Changed from v1.5

Two substantive changes:

**First**, the implementation architecture is now explicit. v1.5 described agent roles without specifying how they would be implemented. v1.5.1 locks the answer: roles are named prompt templates (Claude Skills) triggered by state transitions on the data substrate. Intelligence lives in the data structures and the prompts, not in autonomous agents negotiating with one another. The only deviation from pure workflow orchestration is cross-model verification — the Verifier role runs on a different model family than the Generator to catch same-model blind spots.

**Second**, ingestion is now framed as dual-mode. v1.5's Section 7 treated the operator as the primary ingestion surface with automatic imports as an adjunct. v1.5.1 treats them as equal peers: automatic ingestion populates the Claim Graph continuously in the background; operator-driven ingestion shapes investigations and priorities. The operator is not the bottleneck for raw data flow; the operator is the bottleneck for what gets treated as an investigation and published.

Neither change alters the methodology spine. The canon, the data structures, the workflows, the constitutional principles all stand. What changes is the implementation substrate underneath them.

---

## Revised Section 5 — Workflows and Agent Roles (Replaces v1.5 Section 5)

### 5.0 The Architectural Posture

Every role described below is implemented as a **named prompt template invoked by the orchestrator when a specific state condition occurs on a data structure**. Roles are stateless functions over rich state. The orchestrator is plain code — a state machine over the data substrate — not an agent framework. Roles do not talk to each other; they read from and write to the registries.

This posture reflects the current empirical consensus on building reliable Claude-powered analytical systems. Multi-agent architectures (autonomous agents negotiating with one another via frameworks like LangGraph, CrewAI, AutoGen) deliver measurable gains only in narrow circumstances — primarily heavily parallelizable breadth-first information gathering — and at 4–15× the token cost of equivalent workflow orchestration. For analytical systems with inter-claim dependencies and tight reasoning coherence requirements, workflow orchestration with a shared inspectable data substrate outperforms autonomous multi-agent on reliability, debuggability, cost, and latency. This consensus is reflected in Anthropic's published guidance ("Building Effective Agents"), Cognition's production experience ("Don't Build Multi-Agents"), and the MAST taxonomy research at ICLR 2025 and NeurIPS 2025.

Roles are packaged as **Claude Skills** — folders of instructions, scripts, and resources with a SKILL.md metadata file, loaded dynamically via progressive disclosure. This is Anthropic's now-open standard for procedural knowledge modules and gives CANOPTICON portability across the API, Claude Code, and future model iterations without rework.

Three operational patterns govern how roles interact with the substrate:

**Structured Outputs** (Anthropic's schema-guaranteed response mode) are used for all registry updates. Schemas are compiled into grammars that constrain token generation during inference, producing near-zero malformed JSON. Every write to the Claim Graph, Question Graph, Assumption Registry, Indicator Registry, Contradiction Registry, Book Graph, and Brier Registry goes through schema-enforced structured output.

**The Citations API** is used for all document-backed claims. Documents are passed with citations enabled, and Claude returns byte-indexed quotes guaranteed to come from source documents. This is the single most important hallucination-prevention primitive currently available — internal Anthropic evaluations show up to 15% recall improvement over prompt-based citations, and production users report source-hallucination rates dropping from 10% to zero.

**Cross-model verification** is mandatory for publication-bound claims. The Verifier role runs on a different model family than the Generator — Claude generates, GPT-5 or Gemini verifies — because same-model self-critique empirically produces weaker results than cross-model adversarial checking. This adds one API vendor relationship and modest cost, and catches structural blind spots that same-model verification systematically misses.

**Sprint-1 deferral.** Cross-model verification is *infrastructure* in Sprint 1 — the orchestrator wires the secondary-model code path (skills-v1.0 §14) and the cost gate accommodates it — but the *invocation* is deferred until the first thesis is set `is_public = TRUE`. Sprint 1 ships no publication-bound claims, no public predictions, and no public theses, so no claim crosses the publication threshold that triggers the secondary call. The Verifier in Sprint 1 runs Citations-API grounding only; the cross-model branch is exercised in Sprint 2 the moment a thesis goes public. This is a phased activation, not a relaxation of the principle. The build handoff (§1, §5) reflects this by listing GPT-5/Gemini as "deferred"; the principle in this section governs Sprint 2 onward.

### 5.1 Role Implementations

Each role below is a prompt template triggered by state conditions. The trigger, input context, skill prompt intent, output schema, and implementation notes are specified.

**The Interrogator** fires when a new claim is added to the Claim Graph without linked verification questions. It takes the claim text, provenance, and related open questions as input. It generates three to seven verification questions that, if answered with evidence, would materially change confidence in the claim, preferring questions that discriminate between competing explanations. Output is a structured list of questions with target-claim-ID and discrimination-type fields, written to the Question Graph. Implemented as a single Claude call; uses Haiku 4.5 for cost efficiency on straightforward claims.

**The Red Team** fires when a claim reaches confidence threshold before publication, or when a thesis is being drafted. It takes the claim, supporting evidence, and adjacent claims as input. It finds the strongest objections and counter-evidence, assuming an adversarial analyst with access to the same sources would try to refute the claim, listing specific failure modes, missing evidence, and alternative explanations. Output is structured objections linked to specific evidence gaps, written to the Contradiction Registry. **Runs cross-model**: Claude generates the claim, GPT-5 or Gemini produces the Red Team pass. The rotating adversary vantage points (ideological opponent, foreign-interference adversary, critic-journalist, regulatory-agency adversary, historian-in-fifty-years) are invoked via prompt parameters on the same Skill, not via separate agent instances.

**The Steelman** fires when an objection or competing claim is added to the Contradiction Registry. It takes the opposing claim and all available evidence as input. It presents the strongest possible case for the competing claim without hedging, identifies the single strongest piece of evidence it rests on, and specifies what would need to be true for it to be correct. Output is a steelman narrative plus a key-load-bearing-assumption list written to the Assumption Registry. For politically charged topics, the operator verifies the steelman passes acceptance — a simulated ideological Turing test is a stretch for current models on culturally-specific positions.

**The Premortem** fires before any Brier-tracked prediction is committed and before any thesis is added to the analytic line. It takes the forecast, supporting reasoning, and base rates as input. The prompt stipulates that the prediction horizon has passed and the forecast turned out to be wrong; the role writes a five-paragraph postmortem explaining what went wrong, what evidence was missed, and which assumptions failed. Named failure modes are logged to Brier Registry metadata for later calibration analysis.

**The Verifier** fires on any claim slated for publication or any citation-bearing output. Two-stage implementation. Stage one is deterministic grounding: the source passage is re-run through Claude's Citations API with the claim as the query; if the API cannot return a supporting cited-text span, the claim is flagged as unsupported. Stage two is cross-model adversarial verification: the claim plus supporting citations are passed to a different model (GPT-5 or Gemini) with the prompt framed as "find errors" rather than "check correctness," because adversarial framing consistently outperforms neutral framing in empirical studies of LLM-as-judge. Output is a verification status of grounded, partially grounded, unsupported, or contradicted, plus specific span-level flags.

**The Gap Surfacer** fires on scheduled sweeps and on publication assembly. It takes the Question Graph filtered to unanswered questions plus Claim Graph gaps (claims with weak evidence support) as input. It runs the seven-stage protocol specified in v1.5 — domain-checklist comparison, topological gap analysis, perspective rotation, Lakatosian diagnosis, Gettier audit, Bayesian sensitivity, premortem by simulated adversary — and outputs a ranked investigation queue. Each stage is a separate Skill invocation; the orchestrator sequences them and aggregates outputs.

**The Calibration Agent** fires on prediction resolution and on periodic review. The mechanical calculation — Brier scores, expected calibration error, bin analysis — is non-LLM code because mechanical scoring is more reliable than asking an LLM to compute its own calibration. The LLM's role is narrative: given resolved forecasts and their Brier/ECE scores, identify systematic bias (overconfidence, underconfidence, category drift) and propose prompt-level corrections. Current Claude models are demonstrably worse-calibrated than human superforecasters on prediction-market benchmarks, so the calibration layer treats LLM probability estimates as inputs to be recalibrated via post-hoc Platt scaling or isotonic regression once sufficient resolved predictions accumulate.

**The Tier Projector** fires when a claim reaches sufficient supporting evidence to warrant a tier change, or during publication. It takes the claim, evidence count and quality, contradictions, and assumption graph as input. It projects what happens at each tier — BLUF, 80-word, 800-word, full substrate — using centrality, salience, novelty, linchpin status, and Brier-track-record weight as projection parameters. Output is the deterministic projection to all four tiers. Same graph state produces same tiers; graph updates propagate automatically.

**The Assumption Auditor** fires on new claim addition or new contradiction registration. It takes the claim and referenced Assumption Registry entries as input. It extracts every load-bearing assumption the claim depends on, marks confidence and provenance, and flags any assumption that also appears in contradicted claims. Output is updates to the Assumption Registry plus flags for re-review.

**The Ingestion Critic** fires on any new source document entering the system — operator-driven or automatic. It takes the source, metadata, and Book Graph context as input. It assesses reliability, bias profile, and compatibility with existing Book Graph entries, and flags contradictions with established claims. Output is a source metadata record plus provisional trust score plus contradiction flags. Critically, **ingestion does not complete automatically**. The Ingestion Critic produces a report; the operator approves or rejects before registry writes commit. This preserves human judgment at the gate without burdening operator time on routine ingestion.

**The Indicator Validator** fires when the Tier Projector proposes new indicators or when an existing indicator fires. It takes the indicator definition, Brier Registry history, and related claims as input. It tests whether the indicator is well-specified, falsifiable, and discriminates between scenarios in the Claim Graph, and whether historical analogs with known base rates exist. Output is a validation verdict plus base-rate annotation.

### 5.2 Orchestration

The orchestrator is plain code — approximately one thousand to two thousand lines of Python wrapping the Anthropic SDK, Postgres, and git. It is a state machine over the data substrate with an event bus that fires role invocations on state transitions. Events include claim addition, contradiction registration, source ingestion, prediction resolution, threshold crossings, and scheduled sweeps. The orchestrator enforces retry policy, rate limits, per-task cost budgets, and the no-silent-spending discipline. It logs every role invocation with inputs and outputs to git-friendly JSON for inspection and replay.

Role outputs are applied as **diff-style updates** to the substrate, not full regenerations. When the Assumption Auditor updates the Assumption Registry, it returns additions, modifications, and retractions; the orchestrator applies them programmatically. This pattern is directly analogous to how modern code-assistants handle file edits with atomic apply operations and is materially more robust than the full-regeneration pattern.

Tools for registry reads are exposed via MCP (Model Context Protocol) — the Claim Graph, Question Graph, Contradiction Registry, Book Graph, and Brier Registry are queryable as MCP resources. Writes go through Structured Outputs with strict schema enforcement. This decouples the substrate from specific model versions and keeps the system portable.

### 5.3 Workflow Triggers

New claim ingestion triggers Admiralty grading via Ingestion Critic, Interrogator question generation, and linchpin-dependency check. Contradiction detection triggers Red Team, Steelman, and ACH matrix construction. Thesis reaching confidence threshold triggers Red Team, Steelman, and Premortem before analytic-line commit. Publication commit triggers Calibration Agent prediction recording and Tier Projector output generation. Scheduled sweeps run Gap Surfacer, Assumption Auditor linchpin recheck, and Indicator Validator follow-through. Belief-trajectory drift beyond threshold triggers explanation generation and Van Evera test reclassification. All triggers are specified in the orchestrator's state machine; none involve autonomous agent decisions about when to fire.

### 5.4 When Multi-Agent Becomes Justified

The architectural posture is workflow-first, not workflow-exclusive. There are narrow conditions under which true multi-agent coordination — not the workflow-step-called-an-agent — becomes justified. These are documented so scope creep is disciplined rather than drift-driven.

Multi-agent becomes justified when information genuinely exceeds a single context window and cannot be summarized without loss; when tasks are heavily parallelizable and genuinely independent with no shared-context dependencies; when different agents require fundamentally different tool environments; or when a specific high-value workload tolerates 15× token cost for 90% quality gains.

None of these apply to CANOPTICON's core analytical workflow today. The Book Graph, the Claim Graph, and the registry reads all fit comfortably in current context windows with retrieval patterns. The investigations have inter-claim dependencies that defeat naive parallelism. The tools are uniform reads and writes over the same substrate. The 15× cost premium is prohibitive for a solo hobby project.

If conditions change — for example, if real-time monitoring of many independent information streams becomes a workload, or if the Book Graph grows past single-call feasibility — the escalation is documented as a specific condition, not an architectural rewrite. Even then, the first move is parallel invocations of the same Skill rather than autonomous agents negotiating with one another.

---

## Revised Section 7 — Ingestion (Replaces v1.5 Section 7)

Ingestion serves the methodology. CANOPTICON has two equal ingestion modes: operator-driven and automatic. Neither is primary; both populate the same registries and go through the same Ingestion Critic workflow.

**Operator-driven ingestion** is the thinking-companion surface. The operator converses with the system through chat, and the system captures claims, questions, assumptions, and indicators from the conversation in real time. The Ingestion Critic flags when ingested chat content shows signs of confirmation bias in the framing — the operator's prompt itself being a possible source of distortion. This mode shapes investigations and priorities; it is how the operator directs the system's attention.

**Automatic ingestion** is the continuous-intake surface. Scheduled pulls from Hansard, news feeds, social media, video sources, and book acquisitions populate the Claim Graph in the background without operator prompting. The same Ingestion Critic workflow applies — every source is graded, bias-profiled, and compatibility-checked before registry writes commit. The operator is not the bottleneck for raw data flow; they are the bottleneck for what gets treated as an investigation and published. Automatic ingestion runs whether the operator is active or not.

Both modes converge at the Ingestion Critic gate. No source bypasses grading. No claim writes to the Claim Graph without provenance, Admiralty scoring, and compatibility checking. The operator sees a dashboard of recent automatic ingestions with trust scores and contradiction flags, and can promote, demote, or investigate any of them. This preserves human judgment without requiring human presence at every ingestion event.

**Books as graph citizens** are ingested in three modes as specified in v1.5. Mode A ingests full-text EPUB or PDF with page-level A-grade claims. Mode B uses AI-assisted extraction when full-text is unavailable, with claims flagged model-recalled-not-primary-verified. Mode C is hybrid reading via chat. The methodology canon itself is populated partly through the Book Graph. Book ingestion can be operator-driven or automatic; the Ingestion Critic gate applies equally.

**Transcription is two-path** as specified in v1.5. Path A uses the YouTube timedtext endpoint via youtube-transcript-api — free, silent, primary. Path B uses audio download via yt-dlp combined with paid transcription (gpt-4o-mini-transcribe primary, AssemblyAI fallback). Path B is operator-confirmed with cost preview per the no-silent-spending principle. LLMs are never used as transcribers; they hallucinate transcripts from URLs.

**Ingestion incentive surface** shows visible graph deltas on both operator-driven and automatic ingestion. New nodes, new edges, new contradictions detected, new questions generated, new indicators proposed. This is feedback, not gamification — the metrics that would be gameable are deliberately not surfaced; the metrics that are analytically meaningful (claim density around a thesis, contradiction-resolution rate, Brier score on resolved predictions, automatic-ingestion trust-score distribution) are the ones shown.

---

## What Stays from v1.5

Everything else. The six constitutional principles. The methodology canon with its three tiers. The five meta-disciplines. The data structures — Claim Graph, Question Graph, Assumption Registry, Linchpin Registry, Indicator Registry, Contradiction Registry, Book Graph, Source Registry, Brier Registry. The layered-topic template for contested multi-dimensional questions. The output production with tiered projections, investigation reports, and derivative content. The publication surfaces and ecosystem presence. The remix production tiers. The cost-control UX with no-silent-spending and the default fifty-dollar monthly ceiling. The stack — Cloudflare Workers with Durable Objects, Postgres, Supabase, R2, AssemblyAI and gpt-4o-mini-transcribe, Claude API via Vercel AI SDK, Flux and Recraft, deferred hi-fi video, yt-dlp, Apify, ffmpeg, Neo4j explicitly dropped in favor of Postgres with graph patterns through adjacency tables. The security and privacy discipline. The what-this-system-is-not statements. The closing principle that the system is the thinking and everything else serves.

None of those change in v1.5.1. The methodology spine is locked and the architectural substrate is now specified.

---

## Closing Note on the Patch

v1.5.1 is the architecture version. v1.5 said what the system does; v1.5.1 says how it is built without compromising what it does. The architectural posture — workflow orchestration over a rich data substrate, stateless roles as prompt templates, cross-model verification, Citations API for grounding, Structured Outputs for registry writes — is not a compromise of the methodology. It is the enabling substrate that makes the methodology implementable by a solo operator without the failure modes of autonomous multi-agent systems.

The rich data substrate is the moat. The Claim Graph, Assumption Registry, Contradiction Registry, and Brier Registry, populated over time with versioned provenance and cross-links, are what give CANOPTICON its analytical power. Claude is a stateless worker over that substrate. As underlying models improve, the substrate continues to accumulate, and the system gets smarter automatically — without architectural rework.

Build the substrate. Package the roles as Skills. Use Structured Outputs for writes, Citations API for grounding, and a different model family for verification. Ship.

---

*End of Master Synthesis v1.5.1.*
