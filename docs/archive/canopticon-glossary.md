# CANOPTICON Glossary

**Purpose.** This document defines every non-obvious term that appears in CANOPTICON's master synthesis, methodology canon, UI spec, architecture docs, and codebase. It is the reference point for anyone — operator, Claude Code, future contributor, future Chris — trying to read the system without having to reconstruct a decade of reading from context clues.

**Scope.** Epistemic and methodological terms, system-specific terms, operational terms, and a handful of philosophical and regional terms that recur.

**Conventions.** Each entry gives (1) a plain-language definition, (2) how CANOPTICON uses it specifically, (3) a source if relevant. Where a term has both an external meaning and a CANOPTICON-specific meaning, both are given.

---

## EPISTEMIC VOCABULARY

### Admiralty grading
A source-reliability scale originating in British naval intelligence and adopted across NATO and civilian intelligence training. Sources are rated A through F on reliability (A = completely reliable, F = cannot be judged), and information is rated 1 through 6 on credibility (1 = confirmed, 6 = cannot be judged). CANOPTICON uses the A-F dimension on every source in the Source Registry and on every claim in the Claim Graph. A-grade means a primary document, gazette entry, legal filing, or direct verbatim transcript. B-grade means a credible secondary source (reporter, analyst, academic). C and below are flagged for extra scrutiny. The Ingestion Critic uses Admiralty grades as a first-pass filter before registry writes.

### Assumption Registry
A CANOPTICON data structure that tracks every load-bearing assumption behind any thesis or argument, with the evidence currently supporting it, the degree to which it is contested, and the consequences if it fails. Swept periodically by the Assumption Auditor role. Distinct from the Claim Graph: claims are first-order assertions about the world; assumptions are second-order commitments the thesis depends on but may not argue for directly. See also: Linchpin Registry.

### Brier score
A measure of calibration for probabilistic predictions, equal to the mean squared error between predicted probability and actual outcome. Lower is better. A perfectly calibrated forecaster who predicts 70% on a set of events will see 70% of them occur; their Brier contribution from that cohort is low. CANOPTICON uses rolling Brier across all resolved predictions in the Brier Registry, surfaces it in the System screen, and uses it as the accountability mechanism for the Calibration role. Named after Glenn Brier (1950).

### catuṣkoṭi
A four-cornered logic from early Buddhist philosophy (Nagarjuna, Madhyamaka school) that admits four truth states for a proposition: affirmation, negation, both, and neither. CANOPTICON uses it as one of several non-binary posture options for claims under contested framing. Useful when a contradiction resists resolution and "machloket" (see below) is also not quite right.

### Cynefin
A sense-making framework developed by David Snowden that sorts problems into five domains: clear (simple/obvious), complicated, complex, chaotic, and disorder. Different problem types require different response patterns. CANOPTICON tags investigations with their Cynefin domain so the operator doesn't apply the wrong methodology — treating a complex problem as if it were complicated is the most common failure mode. Pronunciation: *kuh-NEV-in*.

### Expected Information Gain (EIG)
Roughly, how much a given question, if answered, would reduce uncertainty about the matter at hand. Used by the Interrogator role to prioritize which questions to surface. High-EIG questions are those whose answer would materially change the thesis, resolve a contradiction, or collapse a range of possible scenarios. Low-EIG questions are ones where any answer would leave everything roughly where it started.

### IPCC calibrated language
The Intergovernmental Panel on Climate Change uses standardized verbal probability qualifiers mapped to numeric ranges: *virtually certain* (99–100%), *very likely* (90–100%), *likely* (66–100%), *about as likely as not* (33–66%), *unlikely* (0–33%), *very unlikely* (0–10%), *exceptionally unlikely* (0–1%). CANOPTICON adopts this vocabulary in tier projections (BLUF, 80-word, 800-word, Full) so readers have a consistent verbal scale that maps to real probability ranges rather than vibes.

### Lakatos — progressive and degenerating research programmes
Imre Lakatos argued that scientific theories should be evaluated not by falsifiability of individual claims (per Popper) but by whether their research programme is *progressive* or *degenerating*. A progressive programme predicts new phenomena and generates novel claims that then check out. A degenerating programme only generates ad hoc adjustments to preserve existing claims in the face of disconfirming evidence. CANOPTICON uses this lens on its own theses: a thesis that keeps generating successful new predictions is healthy; a thesis that only absorbs new evidence by qualifying itself is degenerating and should be reconsidered.

### machloket
A term from rabbinic tradition for a disagreement that is preserved rather than resolved, because both sides contribute to the full picture. Distinguished from ordinary disagreement where one side is simply wrong. CANOPTICON uses "machloket posture" in the Contradiction Registry for contradictions that should be held open indefinitely because collapsing them would lose information. Contrast with contradictions that resolve one way through new evidence.

### Meadows leverage points
Donella Meadows's twelve-level taxonomy of places to intervene in a system, ordered from least leverage (parameters, buffer sizes) to most leverage (paradigms, the power to transcend paradigms). CANOPTICON uses this as a filter for policy proposals: most surface-level policy debate happens at low-leverage points, while the high-leverage points (rules, information flows, goals, paradigms) are often invisible. Meadows's original paper: *Places to Intervene in a System* (1999).

### Peirce abduction
Inference to the best explanation, distinct from deduction (certainty from premises) and induction (generalization from instances). Charles Sanders Peirce argued that scientific hypothesis formation is primarily abductive: faced with a surprising phenomenon, we reason backward to the most plausible cause. CANOPTICON's role-based reasoning is mostly abductive — the Interrogator surfaces questions whose answers would discriminate between competing abductive hypotheses.

### Popper falsifiability
Karl Popper's criterion for scientific claims: a claim must, in principle, be capable of being shown false by observation. Claims that could not be falsified by any possible evidence are not scientific (which does not necessarily mean they are false, only that they do not belong to science). CANOPTICON uses falsifiability as a question the Red Team asks of every thesis: "What would we observe that would convince us this is wrong?" Theses without an answer get flagged.

### Red Team / Steelman
Complementary adversarial roles. A Red Team attacks a thesis to find its weaknesses. A Steelman constructs the strongest possible version of the opposing view. CANOPTICON runs both: Red Team identifies where the thesis is thin; Steelman ensures the thesis author actually understands what the best opposition would say. The term "steelman" (opposite of "strawman") comes from late-2010s internet discourse but the practice is ancient (Socrates, the Talmudic tradition).

### Six Thinking Hats
Edward de Bono's framework for structured group (or solo) thinking: White (data), Red (emotion), Black (caution), Yellow (benefits), Green (creativity), Blue (process). CANOPTICON uses the hats as prompts for the Red Team role when running from a specific vantage: "run the Black Hat on this thesis" yields different concerns than "run the Green Hat."

### Toulmin warrant
In Stephen Toulmin's model of argument, a warrant is the (often implicit) rule of inference that licenses moving from data to claim. Example: data = "Carney worked at Brookfield." Claim = "Carney has conflicts of interest." Warrant = "Former executives of an entity retain financial/social commitments that conflict with impartial regulation of that entity." CANOPTICON requires warrants to be explicit in the Claim Graph so they can be separately attacked — most political disagreement is about warrants, not data.

### Van Evera tests
Stephen Van Evera's four tests for qualitative evidence in political science: straw-in-the-wind (weak but suggestive), hoop test (necessary but not sufficient — failing it eliminates the hypothesis), smoking gun (sufficient but not necessary — passing it strongly supports), doubly decisive (both necessary and sufficient). CANOPTICON uses these to tag evidence in the Claim Graph with its logical weight, rather than treating all evidence as equivalent.

---

## CANOPTICON-SPECIFIC VOCABULARY

### BLUF
"Bottom Line Up Front." Military and intelligence shorthand for leading with the conclusion. CANOPTICON's tier projection system offers every thesis at four lengths: BLUF (one-sentence conclusion with IPCC likelihood qualifier), 80-word, 800-word, Full. BLUF is the default surface because operator time is the binding constraint.

### Cascade / Morning Cascade
The scheduled daily run that processes overnight ingestion, updates registries, and produces the Live feed. Triggered by Cloudflare Workers cron at 07:00 ET by default. Operator can also run on demand via the Run Cascade button. The cascade sequence: ingestion → Critic gate → approved items write to registries → Interrogator generates questions → Verifier runs on new claims → Red Team fires on any thesis crossing a confidence threshold → Gap Surfacer sweeps → Calibration resolves any indicators → Live feed assembles.

### Claim Graph
The central data structure. A directed graph where nodes are entities (people, institutions, events, concepts) and edges are claims linking them, with each claim carrying: source, Admiralty grade, Toulmin components (data/claim/warrant/backing/qualifier/rebuttal), timestamp, verification status, provenance trail. This is the substrate everything else reads from and writes to. Distinct from the visualization: the visualization is *one view* of the graph. The graph itself is just relational data.

### Concept Spine
A thesis-specific list of the core concepts that give the thesis its shape. Evolves as the thesis grows. Used by the system to route new incoming claims — if a claim mentions concepts on a thesis's spine, the thesis's inbox is a candidate destination.

### Contradiction Registry
Tracks contradictions — claims that cannot both be true. Each entry records the two claims, sources, when the contradiction was detected, which role detected it, and its current posture: open, resolved one way, resolved other way, or machloket (held open deliberately). Contradictions are valuable signal, not noise to be eliminated.

### Forensic intelligence
CANOPTICON's self-description. Not journalism (too editorial), not analysis (too abstract), not investigation (too narrow). Forensic: examining evidence methodically, reconstructing structure from documented facts, preserving chain of custody. The voice is declarative and evidence-first. No editorializing; conclusions emerge from assembled facts.

### Gap Surfacer
A role that runs a seven-stage sweep looking for things the thesis *doesn't* address that it should: missing entities, missing relations, missing counter-evidence, missing timeline periods, missing stakeholder perspectives, missing comparison cases, missing disconfirming indicators. Fires on the thesis detail view and on the cascade. Named because gaps in the graph are usually more important than what's in it.

### Hot
A convergence score above 0.75. Convergence is an internal metric — roughly, how many independent sources mention the same entity in the same window, weighted by source grade. Hot items are surfaced prominently in the Live feed and marked with a red rail. The threshold is tunable.

### Indicator Registry
Tracks measurable indicators whose future values would confirm or disconfirm a thesis. Each indicator has a definition, a current value, a source, a cadence for updates, and a list of theses that depend on it. The Calibration role resolves indicators when new data comes in and propagates confirmation/disconfirmation back to theses.

### Ingestion Critic
A role that runs on every incoming source before it writes to registries. Produces a written assessment: Admiralty grade, bias profile, compatibility check against active watch-sets, contradiction check against existing claims, cost estimate if any paid operations are needed. The operator approves, defers, or rejects. This is the gate. Nothing writes to registries without passing Critic review, except A-grade uncontested items if the operator has enabled auto-ingest.

### Interrogator
A role that generates questions from existing graph state. Unlike a search-based system that answers operator questions, the Interrogator asks new questions the operator hadn't thought of, prioritized by Expected Information Gain. Questions accumulate in the Question Graph.

### Layered-topic template
Every contested topic CANOPTICON addresses is decomposed into four analytical layers, each with its own claims, sources, and postures:
- **Factual layer.** What is documented? Empirical, verifiable claims with Admiralty grades.
- **Framing layer.** How is the topic being framed and by whom? The genealogy of the given — whose definitions are in play.
- **Architectural layer.** What structural pattern is visible? Follow-the-money, actor-network mapping, institutional-capture diagnosis.
- **Distributive layer.** Who pays and who receives? Incidence analysis across class, generational, sectoral lines.

Contradictions across layers are preserved, not flattened. A claim can be true at the factual layer and misleading at the framing layer; both get recorded.

### Linchpin Registry
A subset of the Assumption Registry. A linchpin is an assumption whose failure would collapse the entire thesis, not just weaken it. Flagged so the operator knows where the thesis is most vulnerable and where scrutiny is best invested.

### Operator / user zero
The operator is the person using CANOPTICON to do intelligence work. "User zero" means the founder using his own system — but the architecture does not assume user zero is the only user. Every component is multi-tenant from the start. Data models carry user IDs; workflows are not hardcoded to one person's habits.

### Question Graph
Parallel to the Claim Graph. Nodes are questions (generated by the Interrogator or declared by the operator), edges are dependencies between them. A question can be answered, deferred, retired, or split into sub-questions. High-EIG questions are surfaced in the Live feed.

### Role
A named prompt template, packaged as a Claude Skill, invoked by the orchestrator at specific points in workflows. The eleven roles: Interrogator, Red Team, Steelman, Premortem, Verifier, Gap Surfacer, Calibration, Tier Projector, Assumption Auditor, Ingestion Critic, Indicator Validator. Roles read from substrate and write back to substrate in structured formats. They are not agents in the multi-agent-framework sense — they are functions with personalities, invoked by plain orchestration code.

### Source Registry
Every source CANOPTICON has ever ingested, with metadata: URL, title, publication, author, date, Admiralty grade, bias profile (if known), claims extracted from it, and ingestion provenance (webhook? cron? operator upload? research brief?). The source registry is the audit trail — for any claim, the operator can trace back to every source that supports it.

### Substrate
Collective term for the registries and graphs: Claim Graph, Question Graph, Source Registry, Assumption Registry, Linchpin Registry, Indicator Registry, Contradiction Registry, Brier Registry, Book Graph. The substrate is the system's memory and reasoning surface. Everything the UI shows is rendered from substrate. Everything the roles do reads from and writes to substrate.

### Tier Projector
A role that regenerates the four-tier projection (BLUF, 80, 800, Full) for a thesis whenever the underlying Claim Graph updates. Deterministic in the sense that the same graph state yields the same projection. Projections include IPCC calibrated language for likelihood claims.

### Verifier
A role that cross-checks claims against their cited sources using the Claude Citations API, and optionally runs an adversarial pass with a second model (GPT-5 or Gemini) to catch errors the primary model missed. Produces verification status: grounded, partial, unsupported. Cross-model verification is enabled by default for any claim entering a thesis; pure Citations-API grounding is adequate for claims that are not load-bearing.

### Watch-set
A list of entities a specific thesis is actively tracking. New sources mentioning watch-set entities get routed to that thesis's inbox. Pinned entities are always tracked; derived entities are added automatically as the thesis grows; excluded entities are explicit keep-outs (e.g., "goldbug content").

### Why surfaced?
The reasoning trace panel on Live feed items. When expanded, shows the chain of inference that caused the item to appear: which signals triggered, which thresholds were crossed, which watch-sets matched, which roles ran. The operator should always be able to audit why the system is showing something.

---

## OPERATIONAL VOCABULARY

### Cron pull
Scheduled polling of a source that doesn't support push (RSS, sitemaps, parliament scrapers). Runs on Cloudflare Workers cron at an interval tuned to source volatility: Hansard every few hours during sitting, Parl.ca every 6 hours, news RSS hourly, Statistics Canada weekly, Lobbying Registry daily.

### Ingestion
The flow from external source to registry write. Two modes: operator-driven (operator pastes, uploads, or points at a URL) and automatic (cron or webhook fires). Both converge at the Ingestion Critic gate. Automatic ingestion uses only free surfaces; any paid operation requires explicit operator approval per the no-silent-spending discipline.

### No silent spending
CANOPTICON's financial discipline. Every paid API call — transcription, cross-model verification, hi-fi video generation, premium data fetches — must prompt the operator for approval before execution, unless the operator has explicitly whitelisted that operation type in Cost settings. There is no "fallback cascade" where the system silently tries more expensive providers when cheap ones fail. If the cheap option fails, the operator sees the failure and decides.

### Orchestrator
Plain code (state machine) that invokes roles at specific points in workflows based on state transitions on substrate. Not an agent framework. Not multi-agent. A function-call-and-event-bus architecture inspired by Anthropic's "Building Effective Agents" (2024) guidance and Cognition's "Don't Build Multi-Agents" (June 2025) argument. Workflow patterns implemented: sequential pipeline, branch-on-condition, parallel-fan-out-and-gather, loop-until-threshold, human-in-the-loop-gate.

### Path A / Path B transcription
CANOPTICON's two-path transcription strategy.
- **Path A (free):** `youtube-transcript-api` pulls captions when available. Instant and zero cost.
- **Path B (paid):** AssemblyAI or gpt-4o-mini-transcribe when Path A returns nothing. Costs money, requires operator approval unless whitelisted.

LLM-as-transcriber (feeding URLs to a general-purpose LLM and asking it to "transcribe") is explicitly banned because it hallucinates transcripts from URL metadata rather than actually accessing the content.

### Pending approval
The queue state. An item has passed automatic ingestion and the Ingestion Critic has produced its assessment, but registry writes haven't happened yet because the operator hasn't approved. Items live in this queue until approved, deferred, or rejected. Surfaced in Sources.

### Research brief
A long-form research document (often produced by Claude Research or another deep-research tool) that CANOPTICON ingests as a source. Distinct from webhooks and cron pulls because briefs are operator-initiated and have higher trust by default — but still go through the Ingestion Critic.

### Webhook / PubSub
Push-based ingestion. YouTube PubSubHubbub fires on new uploads. openparliament.ca webhooks fire on new Hansard publications. X API streams fire on watch-list updates. Webhook ingestion is lower-latency than cron and preferred where available.

---

## PHILOSOPHICAL TERMS THAT RECUR

### McLuhan — the medium is the message
Marshall McLuhan's thesis that the form of a medium embeds itself in any message it communicates, creating a relationship whose effects are easier to see from outside the medium than from within. CANOPTICON is influenced by this in three ways: the platform itself is a medium (not neutral infrastructure), the methodology-first architecture treats the operator's *tools for thinking* as more consequential than any specific output, and the layered-topic template's Framing layer is direct McLuhan territory.

### Probe
In McLuhan, a short, aphoristic, often paradoxical statement designed to provoke recognition rather than to prove. The operator's writing style defaults to probes where appropriate. The Tier Projector's BLUF output is probe-like: compressed, one-sentence, with a likelihood qualifier.

---

## REGIONAL (CANADIAN) VOCABULARY

### BoC
Bank of Canada. Central bank. Responsible for monetary policy, currency issuance, and financial stability.

### Big Five
Colloquial term for Canada's five largest banks: Royal Bank of Canada (RBC), Toronto-Dominion (TD), Bank of Nova Scotia (Scotiabank), Bank of Montreal (BMO), Canadian Imperial Bank of Commerce (CIBC). Systemically important; regulated by OSFI.

### DOF
Department of Finance Canada. Federal department responsible for fiscal policy and financial-sector regulation (jointly with OSFI and BoC).

### Hansard
The verbatim transcript of debates in the Parliament of Canada (both House of Commons and Senate). Published daily during sittings. A-grade source because it is verbatim and official. Accessed via openparliament.ca for structured API; via parl.ca for authoritative original.

### OIC
Order-in-Council. A formal executive-branch instrument issued by the Governor-in-Council (Cabinet). Used for appointments (including PBO, Supreme Court, senior civil service) and regulatory actions. Registry is public.

### PBO
Parliamentary Budget Officer. An independent officer of Parliament who provides analysis of the federal budget and of the economic and fiscal implications of legislation. Appointed by the Governor-in-Council.

### PMO
Prime Minister's Office. Political staff of the Prime Minister. Distinct from the Privy Council Office (PCO), which is the non-partisan public service secretariat to Cabinet.

### SEDAR+
The Canadian filing system for public-company disclosures (replaces the older SEDAR). Primary source for Canadian corporate filings. A-grade.

---

## NOTES ON USE

This glossary is a living document. When a new term gets introduced to the system — a new role, a new data structure, a new methodology import — it should be added here. Terms that fall out of use should be marked deprecated rather than deleted, so older documents remain readable.

Terms in this glossary are case-insensitive in prose but case-sensitive in code. `ClaimGraph` in Postgres is `claim_graph`; in TypeScript types it is `ClaimGraph`; in prose it is "Claim Graph." The glossary uses prose conventions.

Where a term has both an external academic meaning and a CANOPTICON-specific usage, future contributors should cite the external meaning in docstrings and link to the relevant glossary entry for the CANOPTICON specialization.
