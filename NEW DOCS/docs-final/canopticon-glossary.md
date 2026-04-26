# CANOPTICON — Glossary

This glossary defines every non-obvious term that appears in CANOPTICON's documentation, code, and operator-facing surfaces. It is the reference point for anyone trying to read the system without reconstructing context from scratch.

Terms are organized by category. Each entry gives a plain-language definition, how CANOPTICON uses the term specifically, and a source attribution where relevant.

---

## EPISTEMIC AND METHODOLOGICAL VOCABULARY

### Admiralty grading
A six-point scale (A through F) for source reliability, originating in NATO intelligence training. A is primary/official/verbatim (gazette, OIC, SEDAR+ filing, Hansard, court ruling, peer-reviewed paper). B is credible secondary (reporter at established outlet, analyst at known firm). C is tertiary or partisan. D is anonymous or low-quality. E is known unreliable. F is cannot-assess. CANOPTICON wires Admiralty grading into `sources.admiralty_grade` and `claims.admiralty_grade` columns. The Ingestion Critic applies the rubric on every source. The Tier Projector uses grade-weighted averages to derive IPCC likelihood for theses.

### BLUF
"Bottom Line Up Front." Military and intelligence shorthand for leading with the conclusion. CANOPTICON's tier-projection system offers every thesis at four lengths: BLUF (one-sentence conclusion with IPCC likelihood qualifier), 80-word, 800-word, Full. BLUF is the default surface because operator time is the binding constraint.

### Brier score
A measure of calibration for probabilistic predictions, equal to the mean squared error between predicted probability and actual outcome. Lower is better. A perfectly calibrated forecaster who predicts 70% on a set of events will see 70% of them occur; their Brier contribution from that cohort is low. CANOPTICON uses rolling Brier across all resolved predictions, surfaced on the System screen and on the public Prediction Ledger. Named after Glenn Brier (1950).

### catuṣkoṭi
A four-cornered logic from early Buddhist philosophy (Nagarjuna, Madhyamaka school) that admits four truth states for a proposition: affirmation, negation, both, neither. CANOPTICON uses it as a non-binary posture option for claims under contested framing. Available when even *machloket* does not quite fit. Rare but in the vocabulary.

### Coherence check
The fourth step in the production-engine pipeline (Script → Coherence → Record → Edit → Publish). Before a script reaches Ready in the Studio, the system runs a coherence check: does this script actually hang together as an argument or narrative? Does it follow from the substrate cluster it draws from? Are the connections real, or did the model fabricate links between unrelated entries? For research-grounded productions, coherence includes source-grounding via the Verifier role. For more reflective productions, coherence is structural — does the beat sequence form a real argument.

### Coined phrase / coined vocabulary
A landed thesis includes a phrase that compresses the structural finding into transmissible language. Not marketing — analytical work. *Manufacturing consent. Surveillance capitalism. Shock doctrine.* The phrase travels independently of the full argument, preserving the structural insight in fewer words. Required for thesis publication; stored in `theses.coined_phrase`.

### Confucian zhengming (rectification of names)
The discipline of flagging when a term has drifted from its referent. *"If names are not rectified, speech will not be in accordance with things."* CANOPTICON runs a zhengming check on every institutional noun in published outputs: does the name correspond to the practice? "Journalist," "non-profit," "independent," "carbon-neutral" may or may not map to the practices they claim.

### Cynefin
A sense-making framework developed by David Snowden that sorts problems into five domains: clear, complicated, complex, chaotic, and disorder. Different problem types require different response patterns. CANOPTICON tags theses with their Cynefin domain at the `theses.cynefin_domain` column so the operator does not apply complicated-problem methodology to a complex problem. Pronunciation: *kuh-NEV-in*.

### Expected Information Gain (EIG)
Roughly, how much a given question, if answered, would reduce uncertainty about the matter at hand. Used by the Interrogator role to prioritize which questions to surface. High-EIG questions are those whose answer would materially change the thesis, resolve a contradiction, or collapse a range of possible scenarios. Stored in `questions.expected_information_gain`.

### Five Whys protocol
A discipline that traces a symptom back to its root cause through five iterative "why" questions. CANOPTICON does not publish a thesis until it has reached Why #4 or Why #5 — the structural condition or the root design choice. Outputs that only reach Why #1 or #2 are classified as news coverage, not structural analysis. Stored in `five_whys_chains` table.

### Forensic intelligence
CANOPTICON's self-description. Not journalism (too editorial, narrative-shaped), not analysis (too abstract), not investigation in the police sense (too narrow). Forensic: examining evidence methodically, reconstructing structure from documented facts, preserving chain of custody. The voice is declarative and evidence-first. Conclusions emerge from assembled facts.

### IPCC calibrated language
The Intergovernmental Panel on Climate Change's verbal probability scale, mapped to numeric ranges: virtually certain (99–100%), very likely (90–100%), likely (66–100%), about as likely as not (33–66%), unlikely (0–33%), very unlikely (0–10%), exceptionally unlikely (0–1%). CANOPTICON adopts this in the `ipcc_likelihood` enum. Tier projections, claims, and theses all carry calibrated qualifiers. Operators are forbidden from writing "obviously" or "clearly" inside calibrated outputs.

### Intervention level
Every CANOPTICON investigation tags the level it is operating at: symptom (managing downstream effects), mechanism (targeting proximate causes), or structural (addressing root conditions). Wired into the `intervention_level` enum. Theses and policy briefs operating at symptom or mechanism level cannot publish without explicit operator override; the system's contribution is structural diagnosis at the root level.

### Lakatos — progressive and degenerating research programmes
Imre Lakatos argued that scientific theories should be evaluated not by single-claim falsifiability but by whether their broader research programme is *progressive* (predicts new phenomena that check out) or *degenerating* (only generates ad hoc adjustments to preserve existing claims). CANOPTICON applies this to its own theses: a thesis that keeps generating successful predictions is healthy; a thesis that absorbs new evidence only by qualifying itself is degenerating. The Assumption Auditor role looks for degeneration patterns.

### Layered-topic template
Every contested topic CANOPTICON addresses decomposes into four analytical layers: Factual (what is documented), Framing (how is the topic being framed and by whom), Architectural (what structural pattern is visible), Distributive (who pays and who receives). Each layer holds its own claims with its own sources and postures. Cross-layer contradictions are preserved, not flattened. Wired into `claim_layer` enum.

### machloket
A term from rabbinic tradition for a disagreement preserved rather than resolved, because both sides contribute to the picture. Distinguished from ordinary disagreement where one side is wrong. CANOPTICON uses "machloket posture" in the contradictions table for contradictions that should be held open indefinitely. Visible publicly on the contradiction tracker as a credibility offering.

### McLuhan — the medium is the message
Marshall McLuhan's thesis that the form of a medium embeds itself in any message communicated through it. CANOPTICON is influenced by this in three ways: the platform itself is treated as a medium (not neutral infrastructure), the methodology-first architecture treats the operator's tools for thinking as more consequential than any specific output, and the Framing layer of the four-layer template is direct McLuhan territory.

### Meadows leverage points
Donella Meadows's twelve-level taxonomy of where to intervene in a system, ordered from least leverage (parameters) to most leverage (paradigms). CANOPTICON uses this as a filter when evaluating policy proposals at the architectural and distributive layers. Original paper: *Places to Intervene in a System* (1999).

### Peirce abduction
Inference to the best explanation, distinct from deduction (certainty from premises) and induction (generalization from instances). Charles Sanders Peirce argued that scientific hypothesis formation is primarily abductive: faced with a surprising phenomenon, reason backward to the most plausible cause. CANOPTICON's role-based reasoning is largely abductive. The Interrogator surfaces questions whose answers would discriminate between competing abductive hypotheses.

### Popper falsifiability
Karl Popper's criterion: a claim must in principle be capable of being shown false by observation. Claims that no possible evidence could falsify are not scientific. CANOPTICON uses falsifiability as a question the Premortem role asks of every thesis: "What would convince us this is wrong?" Theses without an answer get flagged.

### Probe
In McLuhan, a short, aphoristic, often paradoxical statement designed to provoke recognition rather than to prove. CANOPTICON's published voice defaults to probe-shape where appropriate. The Tier Projector's BLUF output is probe-like: compressed, one-sentence, with a likelihood qualifier.

### Red Team / Steelman
Complementary adversarial roles. A Red Team attacks a thesis to find its weaknesses. A Steelman constructs the strongest possible version of the opposing view. CANOPTICON runs both as named roles. The term "steelman" (opposite of "strawman") comes from late-2010s internet discourse but the practice is ancient.

### Six Thinking Hats
Edward de Bono's framework for structured thinking: White (data), Red (emotion), Black (caution), Yellow (benefits), Green (creativity), Blue (process). CANOPTICON uses the hats as vantages for the Red Team role.

### Toulmin warrant
In Stephen Toulmin's model of argument, a warrant is the (often implicit) rule of inference that licenses moving from data to claim. CANOPTICON requires warrants to be explicit in `claim_versions.warrant` so they can be separately attacked. Most political disagreement is about warrants, not data — the Toulmin decomposition makes the disagreement legible.

### Van Evera tests
Stephen Van Evera's four logical weights for qualitative evidence: straw-in-the-wind (suggestive), hoop test (necessary but not sufficient — failing eliminates the hypothesis), smoking gun (sufficient but not necessary — passing strongly supports), doubly decisive (both necessary and sufficient). CANOPTICON tags evidence in claim metadata with its Van Evera weight.

---

## CANOPTICON-SPECIFIC VOCABULARY

### Beat
The atomic unit of recording in the production engine. A short chunk of script (10-30 seconds typically) that the operator reads aloud as a single take. A complete production is a sequence of beats. Mistakes localize to a single beat; re-recording one beat does not require re-recording the rest. Stored in the `beats` table with text, optional cue (stage direction), beat_role (open/context/turn/evidence/reflect/close/transition), recording_status, recording_uri.

### Argument map
A six-layer decomposition of a contested question, distinct from the four-layer topic template. Layers: surface (what people argue about), evidence (what each side cites), dependencies (what has to be true), empirical disputes (where facts are contested), values disputes (where priors differ), meta (why the argument keeps recurring without resolution). Stored in `argument_maps`. Output by the Argument Mapper role.

### Argument tree
*See Argument map.*

### Cascade
The system's primary workflow. Runs unattended from cron (configurable per user via `users.cascade_cron_expr`) or on-demand from the operator's "Run Cascade" button. The cascade processes pending sources through the Ingestion Critic, extracts claims from approved sources, runs entity resolution and claim deduplication, verifies new claims, generates Interrogator questions, runs the Gap Surfacer on selected theses, calibrates resolved predictions, regenerates tier projections on updated theses, audits assumptions weekly, detects convergences, surfaces production-ideation candidates, and assembles the Live feed view. Tracked in `cascade_runs` with full step provenance.

### Claim Graph
The collective term for `claims`, `claim_versions`, `claim_sources`, `claim_entities`, and `claim_relations`. The substrate's central data structure. A claim links entities (people, institutions, events, concepts) to assertions about them, with full Toulmin structure, Admiralty-graded sources, and a verification status. The graph is queryable as relational data and renderable as a visualization.

### Cluster
In the production-ideation context, a grouping of recent substrate items (claims, sources, theses) that shares enough thematic coherence to potentially produce a single piece of content. Strategies: temporal (this week's high-grade claims), thematic (claims tagged to a thesis's concept_spine), longitudinal (a thesis across months), convergence-driven (HOT clusters from the cascade's convergence-detection step). The production_ideator skill scores clusters and proposes scripts for high-scoring ones.

### Coherence check
*See epistemic vocabulary above.*

### Concept Spine
A thesis-specific list of core concepts that give the thesis its shape. Evolves as the thesis grows. Used by the cascade to route incoming claims — a claim mentioning concepts on a thesis's spine becomes a candidate for the thesis's inbox. Stored in `thesis_concept_spine`.

### Contradiction Registry
Tracks contradictions — pairs of claims that cannot both be true. Each entry records the two claims, the role that detected the contradiction, and the current posture: open, resolved-one-way, resolved-other-way, or machloket. Stored in `contradictions`. Surfaced publicly on the contradiction tracker.

### Convergence
A cascade-derived signal: how many independent sources mention the same entity in the same time window, weighted by source Admiralty grade. A convergence_score above 0.75 marks a HOT signal worth elevating in the Live feed. Computed transiently during the cascade rather than stored persistently.

### Forensic intelligence
*See epistemic vocabulary above.*

### Gap Surfacer
A role that runs a seven-stage sweep looking for things a thesis *doesn't* address that it should: missing entities, missing relations, missing counter-evidence, missing time periods, missing stakeholder perspectives, missing comparison cases, missing disconfirming indicators. Plus structural-hole detection (Burt's structural-hole concept applied to the claim graph — narrow bridges between large clusters).

### HOT
A convergence_score above 0.75. HOT items are surfaced prominently in the Live feed and marked with a red rail. The threshold is tunable per user.

### Indicator Registry
Tracks measurable indicators whose future values would confirm or disconfirm a thesis. Each indicator has a definition, current value, source URI, cadence, and thresholds for confirm/disconfirm. The Calibration role resolves indicators when new observations arrive and propagates outcomes to predictions and theses. Stored in `indicators` and `indicator_observations`.

### Ingestion APIs toggle
The master switch (`users.ingestion_apis_enabled`) for all automatic external ingestion: webhook intake, cron pulls, AI-driven queries. Default FALSE for new users — operator-driven only. When TRUE, individual webhook and cron sources can be enabled/disabled granularly on the System screen.

### Ingestion Critic
A role that runs on every incoming source before it writes to registries. Produces a written assessment: Admiralty grade, bias profile, compatibility check against active watch-sets, contradiction check against existing claims, paid-op flags. The operator approves, defers, or rejects. The Critic is the gate; nothing writes to claims without passing Critic review (except A-grade uncontested items if auto-ingest is enabled).

### Interrogator
A role that generates questions from existing graph state. Unlike a search-based system that answers operator questions, the Interrogator asks new questions the operator hadn't thought of, prioritized by Expected Information Gain.

### Layered-topic template
*See epistemic vocabulary above.*

### Linchpin
An assumption whose failure would collapse the entire thesis, not merely weaken it. Flagged in the system so the operator knows where the thesis is most vulnerable and where scrutiny is best invested. Stored as `assumptions.is_linchpin = TRUE`. A claim can also be a linchpin (`claims.is_linchpin = TRUE`) when the claim is so structural that its disconfirmation would unwind the thesis.

### Operator
The person using CANOPTICON to do intelligence work. The operator is the gate at every paid operation, every publish transition, every contested merge. The system serves the operator; it does not autonomously act on the operator's behalf.

### Pipeline indicator
The five-step visual element showing where a production is in the production-engine pipeline: Script → Coherence → Record → Edit → Publish. Done steps filled in sage; current step pulsing in amber; future steps faint outline. Visible across all six Studio tabs.

### Production
A first-class object in the production engine, parallel to articles but for video/audio output. Has a current script, a state (Ready / Recording / Producing / Publish / Perf / Archive), a format (long_video / short_video / video_essay / audio_essay / article / thread / newsletter / documentary), and a thesis it draws from. Stored in `productions`.

### Production engine
The half of CANOPTICON that turns substrate into shippable content (videos, audio, articles, threads). Six states (Ready / Recording / Producing / Publish / Perf / Archive). Pipeline (Script → Coherence → Record → Edit → Publish). Beats data model. Resumable recording. Perf-feeds-ideation feedback loop. Lives in the Studio screen of the operator app.

### Question Graph
Parallel to the Claim Graph. Nodes are questions (generated by the Interrogator or declared by the operator), edges are dependencies between them (`question_dependencies` table). Questions can be answered, deferred, or retired. High-EIG questions surface in the Live feed.

### Role
A named prompt template, packaged as a Claude Skill (`/skills/{role-name}/SKILL.md`), invoked by the orchestrator at specific points in workflows. The 17 roles: Interrogator, Red Team, Steelman, Premortem, Verifier, Gap Surfacer, Calibration, Tier Projector, Assumption Auditor, Ingestion Critic, Indicator Validator, Claim Extraction (utility), Entity Resolver (utility), Claim Deduplicator (utility), Solution Inventory Builder, Argument Mapper, Genealogy Tracer. Roles read from substrate and write back to substrate. They are not agents in the multi-agent-framework sense — they are prompt templates invoked by plain orchestration code.

### Source Registry
Every source CANOPTICON has ingested, with metadata, Admiralty grade, bias profile, and ingestion provenance. Stored in `sources`. The audit trail: any claim can be traced back to every source supporting it via `claim_sources`.

### Solution inventory
A comparative analysis of every intervention that has been tried for a given policy question, across jurisdictions, with conditions, results, exportability, and the real disagreement once surface arguments are stripped. Stored in `solution_inventories` and `solution_entries`. Built by the Solution Inventory Builder role. The contribution to public discourse is the map itself — most policy debate happens without the map.

### Root-striking discipline
The discipline that every investigation identifies its intervention level (symptom / mechanism / structural) and that publishable theses operate at the structural level. From Thoreau's *"There are a thousand hacking at the branches of evil to one who is striking at the root."* Enforced via the Five Whys protocol: theses must reach Why #4 or Why #5 to publish.

### Frame genealogy
The intellectual supply chain of a public framing. When did this framing first appear, who introduced it, who amplified it, who funds the amplifiers, what is the funders' material interest in this framing prevailing. Stored in `frame_genealogies`. Built by the Genealogy Tracer role. Not conspiracy thinking — structural analysis of how ideas move through political ecosystems.

### Undismissability architecture
The seven requirements every published thesis must satisfy: evidence density beyond rebuttal capacity, coined vocabulary, banked predictions (≥3), teachable diagram or model, methodology transparency, public graph artifact, named human accountability under COPE standards. Enforced by the publish-prep workflow. Designed so that critics who want to dismiss the thesis must engage every piece of the evidence trail. The cost of dismissal is made high by design.

### Substrate
The collective term for all CANOPTICON's persistent data: claims, theses, articles, productions, entities, sources, assumptions, indicators, predictions, contradictions, questions, books, plus their version histories and relations. Roughly 30+ tables in Postgres. The substrate is the system's memory and reasoning surface. Everything the UI shows is rendered from substrate; everything the roles do reads from and writes to substrate.

### Tier projection
The four-length rendering of a thesis (BLUF, 80-word, 800-word, Full) generated by the Tier Projector role. Regenerates on `thesis.updated`. BLUF/80/800 regenerate every cascade; Full regenerates weekly for cost optimization.

### Verifier
A role that grounds claims against their cited sources using the Anthropic Citations API. Returns verification status: grounded, partial, unsupported, or contested. Optionally cross-model with GPT-5 or Gemini for high-stakes claims (operator-toggled). Two-call pattern per claim because the Citations API and Structured Outputs cannot be combined in a single call.

### Watch-set
A thesis-specific list of entities and exclusion terms that determine which incoming claims should be routed to the thesis's inbox. Pinned entities mean "claims involving this entity are likely relevant"; tracked entities are softer; excluded terms mean "claims involving this term should NOT route here." Stored in `thesis_watch_sets`.

---

## OPERATIONAL VOCABULARY

### Cost gate / approvePaidOperation
The single chokepoint through which every paid operation passes. Function `approvePaidOperation(user, operation_type, estimated_cents)` checks ceiling, checks whitelist, either auto-approves, prompts the operator, or blocks. There is no fallback path that bypasses the gate.

### Cron pull
Scheduled polling of a source that doesn't support push. Runs on Cloudflare Workers Cron Triggers at intervals tuned to source volatility. Active only when `ingestion_apis_enabled = TRUE`.

### Ingestion
The flow from external source to substrate write. Four modes: operator_upload (paste/upload/dictate), webhook_push (provider POSTs), cron_pull (Workers cron), ai_query (AI-driven research queries). Plus research_brief (operator-initiated long-form research) and derived (transcripts produced from existing sources). All converge at the Ingestion Critic gate.

### No silent spending
CANOPTICON's financial discipline. Every paid API call must prompt the operator for approval before execution unless explicitly whitelisted. There is no fallback cascade where the system silently tries more expensive providers when cheap ones fail.

### Orchestrator
Plain code (TypeScript on Cloudflare Workers, state machine pattern) that invokes roles at specific points in workflows based on substrate events. Not an agent framework. Not multi-agent. A function-call-and-event-bus architecture. Workflow patterns: sequential pipeline, branch-on-condition, parallel-fan-out-and-gather, loop-until-threshold, human-in-the-loop-gate.

### Path A / Path B transcription
The two-path discipline for transcription. Path A (free): `youtube-transcript-api` pulls captions when available. Path B (paid): AssemblyAI or `gpt-4o-mini-transcribe` when Path A returns nothing — costs money, requires operator approval. LLM-as-transcriber is explicitly forbidden because models hallucinate transcripts from URL metadata.

### Pending approval
The queue state. An item has passed automatic ingestion and the Ingestion Critic has produced its assessment, but registry writes haven't happened because the operator hasn't approved. Items live in this queue until approved, deferred, or rejected.

### Research brief
A long-form research document (often produced by Claude Research or another deep-research tool) that CANOPTICON ingests as a source. Operator-initiated; goes through the Ingestion Critic.

### RLS test matrix
A CI-required test suite that uses the Supabase anon key to attempt reads against every non-public substrate table. Build fails if any read succeeds. The deny-by-default safety mechanism that prevents single-policy misconfigurations from leaking private data.

### SKILL.md
The packaging format for roles. Each role lives in `/skills/{role-name}/SKILL.md` with frontmatter (name, version, model, features) and prompt body. The orchestrator reads SKILL.md at runtime, computes a SHA-256 hash, compares to `role_definitions.skill_md_hash`, updates if changed, then invokes. Prompt iteration does not require redeploys.

### Webhook intake
Push-based ingestion. Each provider has its own URL, signature scheme, and payload format. Active only when `ingestion_apis_enabled = TRUE`. Failures of signature validation return 401.

---

## CANADIAN REGIONAL VOCABULARY

### BoC
Bank of Canada. Central bank. Responsible for monetary policy, currency issuance, and financial stability.

### Big Five
Colloquial term for Canada's five largest banks: Royal Bank of Canada (RBC), Toronto-Dominion (TD), Bank of Nova Scotia (Scotiabank), Bank of Montreal (BMO), Canadian Imperial Bank of Commerce (CIBC). Systemically important; regulated by OSFI.

### DOF
Department of Finance Canada. Federal department responsible for fiscal policy and financial-sector regulation (jointly with OSFI and BoC).

### Hansard
The verbatim transcript of debates in the Parliament of Canada. Published daily during sittings. A-grade source because it is verbatim and official. Accessed via openparliament.ca for structured API; via parl.ca for authoritative original.

### OIC
Order-in-Council. A formal executive-branch instrument issued by the Governor-in-Council (Cabinet). Used for appointments and regulatory actions. Registry is public.

### PBO
Parliamentary Budget Officer. An independent officer of Parliament who provides analysis of the federal budget and of the economic and fiscal implications of legislation. Appointed by the Governor-in-Council.

### PMO
Prime Minister's Office. Political staff of the Prime Minister. Distinct from the Privy Council Office (PCO), which is the non-partisan public service secretariat to Cabinet.

### SEDAR+
The Canadian filing system for public-company disclosures. Primary source for Canadian corporate filings. A-grade.

---

## NOTES ON USE

This glossary is a living document. When a new term gets introduced — a new role, a new data structure, a new methodology — it should be added here. Terms that fall out of use should be marked deprecated rather than deleted, so older documents remain readable.

Terms in this glossary are case-insensitive in prose but case-sensitive in code. `ClaimGraph` in TypeScript types is `claim_graph` in Postgres column names; in prose it is "Claim Graph." The glossary uses prose conventions.

Where a term has both an external academic meaning and a CANOPTICON-specific usage, the external meaning is given first, then the system-specific specialization.
