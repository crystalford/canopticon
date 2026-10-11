---
id: stateless-partners-shared-traces-common-ground-stigmergy-and-naturalis
title: "Stateless Partners, Shared Traces: Common Ground, Stigmergy and Naturalistic Decision Making in AI-Directed Software Development"
kind: "Research"
topic: "AI-directed development"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/archive-3/stateless-partners-shared-traces.md"
---

# Stateless Partners, Shared Traces: Common Ground, Stigmergy and Naturalistic Decision Making in AI-Directed Software Development

The specific synthesis you are looking for — common ground/transactive memory + stigmergy + Klein's recognition-primed decision model, applied to a developer directing an AI coding agent — does not yet exist in the literature as of September 2026; what exists are strong single-theory findings and a handful of two-theory precedents (grounding + boundary objects, grounding + transactive memory), while stigmergy has been applied only to agent-to-agent coordination and NDM has never been applied to directing coding agents.

## TL;DR

- **Part 1 is well-evidenced but only half-theorized.** LLMs measurably under-ground — Shaikh, Mozannar, Bansal, Fourney and Horvitz (ACL 2025) found LLMs "three times less likely to initiate clarification and sixteen times less likely to provide follow-up requests than humans" — and 2026 work is starting to name the "asymmetric persistence" problem — the human carries common ground the agent cannot — but no one has built a full theory of grounding with a collaborator whose memory resets while the human's does not.
- **Part 2's core hypothesis is supported in practice but not named in theory.** Artifact-mediated coordination (AGENTS.md/CLAUDE.md, rules files, specs, decision records) is now a mass practice with its own empirical literature, yet no paper calls it stigmergy; and the best controlled evidence shows that *naive* artifacts (prose context files) do not raise task success — which suggests the effective traces are the ones that constrain the work itself (tests, types, executable specs), not notes about it.
- **Part 3 is an open field.** RPD has been applied to software architecture and code review, but not to directing AI agents; the "single simulated option, expensive to test" failure mode is theoretically well-grounded in Klein's own writing and maps cleanly onto AI-mediated rework, making this the most original contribution available for your essay.

## Key Findings

1. **Grounding failure with LLMs is quantified.** Shaikh et al. (NAACL 2024) found LLMs "generate text that appears to simply presume common ground," and that preference-optimization training reduces grounding acts. Their follow-up (Shaikh, Mozannar, Bansal, Fourney and Horvitz, ACL 2025, "Rifts"), drawing on WildChat, MultiWOZ and Bing Chat logs, found LLMs "three times less likely to initiate clarification and sixteen times less likely to provide follow-up requests than humans," and that early grounding failures predict later breakdowns.
2. **The stateless/asymmetric case has just begun to be named.** A 2026 preprint (Çögenli, arXiv 2609.04542) describes each human–LLM session opening "with the participant restoring, from artefacts he maintains, a common ground the other party cannot carry," calling this "the repeated re-establishment of a working ground under asymmetric persistence." This is the closest existing statement of your Part 1 thesis — but it concerns scholarly writing, not coding, and is an unreviewed single-author preprint.
3. **New grounding frameworks are emerging, mostly as extensions rather than replacements of Clark & Brennan.** The Oxford group (Vishwarupe, Jirotka, Shadbolt, Flechais; ECSCW 2026 poster) proposes that "collaboration breaks down when the appearance of partnership outpaces the grounding capacity of the interaction," distinguishing one-shot assistance, weak collaboration (repair burden almost entirely human) and grounded collaboration. Poelitz, Doshi-Velez and Lindley (2026 benchmark) caution that LLM "grounding acts" may not "signal the development of an underlying common ground."
4. **Stigmergy in software is established for humans (FLOSS) and for agent swarms, but not for human→agent direction.** Bolici, Howison and Crowston's work on FLOSS teams and Heylighen's 2007 analysis treat code as a stigmergic medium; 2025–2026 multi-agent systems (SwarmWorld, EvoGit, CodeCRDT) use stigmergy between agents. No paper found treats a human directing a coding agent through repository artifacts as stigmergic coordination.
5. **Artifact-mediated direction of agents is a documented mass practice with mixed efficacy evidence.** Chatlatanagulchai et al.'s analysis (ACM TOSEM) of 2,303 agent context files from 1,925 repositories found they "evolve like configuration code through frequent, small additions," and that "security (14.8%) and performance (14.5%) are rarely specified." But Gloaguen, Mündler, Müller, Raychev and Vechev (ETH Zürich SRI Lab; ICLR 2026 Workshop on Memory for LLM-Based Agentic Systems) found context files produced no improvement in task success while increasing inference cost by over 20%, concluding human-written files "should describe only minimal requirements"; they add that "repository overviews, although popular and recommended by model providers, are not helpful," while "context files are useful for specifying non-standard coding practices."
6. **NDM has touched software engineering but not AI-agent direction.** Power and Wirfs-Brock (ECSA 2019) studied RPD in software architecture; Gullstrand Heander, Söderberg and Rydenfält (Lund University; *Empirical Software Engineering*, 2025), in "an ethnographic think-aloud study involving 10 participants and 34 code reviews," found code review resembles "recognition-primed decision-making." No peer-reviewed paper applies RPD or the premortem to directing coding agents; premortem-for-Claude-Code tools exist only as practitioner GitHub plugins.
7. **The full synthesis is absent.** The nearest precedents combine two frameworks: Sato (arXiv 2607.26517) uses grounding + boundary objects for AI-assisted development; Çögenli uses grounding + transactive memory; a 2026 *Journal of Intelligence* paper uses transactive memory + distributed cognition. None invokes stigmergy or NDM.

## Details

### Part 1 — Common ground and transactive memory with a (semi-)stateless collaborator

**What is established.** Clark and Brennan's (1991) grounding — establishing mutual understanding "sufficient for current purposes" through presentation, acknowledgment and repair — is now routinely applied to LLMs, and the empirical finding is consistent: LLMs perform the *surface* of grounding without doing its work. Shaikh et al. traced part of this to training: "training on contemporary preference data leads to a reduction in generated grounding acts." In other words, the models are optimized to act as if common ground exists. This is the mirror image of your failure mode: the human presumes accumulated ground, and the model is trained to presume ground too, so neither party triggers repair.

**The asymmetric-persistence problem.** Classic grounding theory assumes both parties carry the accumulated record (Clark's "personal common ground" built from prior joint experience). In your situation, one party's record is continuous and the other's is reconstructed each session from whatever enters the context window. The best current technical framing comes from a 2026 misconceptions paper (arXiv 2608.20421, also in PMC), which separates three memory layers: parametric (frozen weights), contextual (what is in the current prompt), and external product-level memory (logs, profiles, documents "selectively injected back into prompts"). The human's felt continuity maps onto none of these reliably. Çögenli's "continuity labour" is the most precise description of what the human must then do.

**Evidence that humans misjudge AI memory.** Direct evidence exists but is thin and not specific to long-running coding relationships:
- A 2025 study of users' mental models of LLM memory found four models — memory as a transient dialogue buffer, as training data, as an active processing mechanism, and "a widespread acknowledged lack of understanding" — with uncertainty persisting "regardless of the user's technical background."
- A 2025 catalog of misconceptions about LLM programming assistants flags "session memory" confusion about "when information from previous conversations is available."
- A 2026 cross-disciplinary taxonomy of misunderstanding names "Common-Ground Overestimation" as a mechanism, reinforced by the curse of knowledge and the illusion of transparency ("speakers … overestimate how evident their own intentions are, so that they supply less than the listener needs").
- Steyvers et al. (*Nature Machine Intelligence*) found users consistently overestimated LLM accuracy when given default explanations.

What does **not** exist: a longitudinal study of developers over months showing that felt relational continuity increases under-specification. That is a genuine gap and a testable hypothesis.

**An under-exploited concept: the agent as overhearer.** A 2026 paper on vision-language models (arXiv 2606.31719) found models "confuse potential with established common ground," calling it "the computational analogue of the overhearer's illusion: overhearers systematically overestimate their understanding of a conversation because they have access to referential context but lack the interactive grounding process." This inverts neatly onto agentic coding: every fresh agent session is structurally an *overhearer* of the project — it sees the repository (referential context) but not the history of negotiated meanings that produced it. Clark and Schober's overhearer research predicts exactly the failure you experienced: the agent confidently acts on surface context without the grounded interpretation. I found no one who has made this connection explicitly.

**Transactive memory.** TMS research on human–AI teams exists but mostly treats AI as a knowledge *source* inside a human team, not as a partner whose own "who-knows-what" directory resets. Findings:
- A study of 180 ICU physicians and nurses found accessing AI information was linked to novel hypotheses and speaking up, but only in higher-performing teams.
- An *Academy of Management Proceedings* 2026 paper on GitHub data found human–AI teams increased specialization, but "for knowledge coordination, no evidence was found for significant changes."
- A 2026 software-team model (arXiv 2608.03462) argues TMS "credibility" is "an inherently interpersonal judgment" and that trust in AI is "conceptually distinct."

The breakdown you describe — the human assuming the agent "knows what it knows" like a long-term colleague — is theoretically predicted by TMS (a transactive directory requires both parties to update it) but not directly studied. The strongest indirect evidence is behavioral: in "Compass vs Railway Tracks" (Petridis et al., DIS 2026), 16 professionals delegating long-horizon work gave humans a "compass" of high-level intent but gave AI "rigid, exhaustive instructions to minimize ambiguity and deviation," because of a perception "that current AI struggles to infer intent." Experienced delegators, in other words, already refuse to extend transactive trust to AI — suggesting your rework episodes occurred precisely when the relationship *felt* long enough to switch to compass mode.

**New frameworks versus critiques.** The 2024–2026 frameworks (Vishwarupe et al.'s grounding-capacity/repair-burden model; Poelitz et al.'s action-based benchmark; Sato's "repair as representational work") extend rather than replace Clark & Brennan. Sato's is the sharpest critique: he argues AI-assisted development bottlenecks "differ from grounding failure in the sense of Clark and Brennan" because they concern "an already-received contribution that cannot become actionable at the point of receipt." None of these tackles session discontinuity head-on.

### Part 2 — Stigmergy and artifact-mediated direction of AI agents

**Established ground.** Grassé's 1959 concept was generalized by Heylighen ("a process is stigmergic if the work … done by one agent provides a stimulus … that entices other agents to continue the job"), who applied it to open-source development in 2007. Bolici, Howison and Crowston (*Cognitive Systems Research*, 2016) showed FLOSS developers coordinate through the shared code itself, integrating explicit and implicit mechanisms; Crowston's group later theorized "work features to support stigmergic coordination." A 2023 *JMIS* study of Wikipedia decomposed stigmergy into "collective modification and collective excitation." Heylighen's distinction between **sematectonic** stigmergy (the work itself is the signal) and **marker-based** stigmergy (a separate trace, like a pheromone or annotation) is directly usable for your essay.

**Stigmergy among AI agents (2025–2026).** SwarmWorld (Pal, Wang, Buehler; arXiv 2608.26081) ran populations of 50–200 LLM agents and found "physical stigmergy alone supports capable societies" and that successful work "becomes part of the environment rather than remaining only in a transcript." Practitioner systems (Stigmera, stigmergy-mcp, KeepALifeUS/autonomous-agents) coordinate coding agents through tickets, branches and knowledge files "without direct communication." All of this is agent-to-agent.

**The human→agent case: practice without the name.** The shift you describe — from conversational instruction to leaving artifacts for the agent — is now an industry-scale practice with its own literature, none of which uses the word stigmergy:
- **Context files.** The Agent READMEs study (Chatlatanagulchai et al., arXiv 2511.12884) found developers prioritize test procedures (75.9%), implementation details (70.8%) and architecture (68.1%).
- **AI IDE rules.** A mining study (Cai et al., arXiv 2606.12231) extracted 7,310 rules from 83 projects into a taxonomy of 5 primary and 25 secondary categories, triangulated with 99 practitioners; rule evolution was driven mainly by "constructive context expansions (29.17%) and enrichments (26.59%)." A secondary summary reports that rule updates raised artifact compliance from 49.14% to 72.13%; I could not verify this figure in the primary text.
- **Spec-driven development.** SDD (GitHub spec-kit, AWS Kiro, Tessl) has an academic wave: Diaz et al. (arXiv 2609.00252) frame SDD as the "harness" for human–agent teamwork; the SDAD report argues agentic speed "relocates discipline upstream into specification precision."
- **Intent as artifact.** Storey's triple debt model (ACM Queue, 2026) puts it most crisply: "Technical debt lives in code. Cognitive debt lives in people. Intent debt lives in artifacts," defining intent debt as the absence of "externalized goals, constraints, and rationale that both humans and AI systems need."
- **Decisions as shared medium.** Aporia (arXiv 2604.05203) makes design decisions "explicit and structured, serving as the shared medium between the programmer and the agent"; in a 14-programmer study, participants' mental models were "5x less likely to disagree with the code than a baseline coding agent."

**Does artifact-mediated coordination beat dialogue? The evidence is mixed, and that is informative.**
- *For:* Aporia's 5x reduction in mental-model disagreement; the Keyhole Effect paper (arXiv 2602.00947) arguing chat "is not a stable external representation. It is a transient stream"; and a large behavioral analysis of 11,579 AI-assisted IDE sessions finding developers send terse messages like "still not working," leaving the assistant as "the only judge of both what the code does and whether it is correct."
- *Against:* Gloaguen et al. found context files yield no improvement in task success and cost over 20% more; agents do follow the files, but "unnecessary requirements from context files make tasks harder." Daniel Vaughan's Codex Knowledge Base (27 March 2026), citing the paper, reports that "auto-generated AGENTS.md files reduced task success rates by an average of 3%" and that "human-authored context files improved success rates by only 4% on AGENTbench"; I have not verified these figures against the paper's own tables. A separate study (arXiv 2601.20404) reports context files mainly reduce cost in a few very expensive runs.

**Interpretation (my synthesis, not found in the literature).** The contradiction resolves if you apply Heylighen's distinction. Prose context files are *marker-based* stigmergy — pheromone notes about the work — and they compete for attention in a finite context window. Tests, types, schemas, executable specs and decision records wired to code are *sematectonic* — the trace *is* the work, and it constrains the next action mechanically. Sato's observation that a boundary object's "interpretive flexibility" may "expose no comparable constraint surface to a generative system" points the same way: ambiguity that helps human collaborators hurts agents. The prediction for your essay: **stigmergic direction outperforms dialogic direction only when the traces are constraining rather than descriptive.** This is testable and, as far as I can find, unstated.

**Distributed and extended cognition.** Hutchins' distributed cognition is increasingly invoked (a CACM opinion piece; Meske et al. on vibe coding as "distributed cognition across human and machine agents"), and the Extended Mind is used to describe AI as part of the programmer's cognitive system. But the Clark & Chalmers criteria for extension — reliable availability and automatic trust — are exactly what a stateless agent fails on *across sessions*, which is an unmade argument: the agent can be part of an extended mind within a session and fall out of it between sessions, while the repository persists. The repository, not the agent, is the durable extension.

### Part 3 — Recognition-Primed Decision making and AI-directed development

**Current state of RPD/NDM.** RPD (Klein, 1989; *Sources of Power*, 1998) holds that experts recognize a situation as typical, generate one workable option, and evaluate it by mental simulation rather than comparing alternatives. Klein and Kahneman's 2009 "Conditions for Intuitive Expertise: A Failure to Disagree" set the boundary conditions: intuition is trustworthy in high-validity environments with timely feedback. Recent NDM work (2020–2026) has turned heavily toward AI: Klein, Hoffman and Mueller's naturalistic models of explanation for XAI; a 2023 *Frontiers* NDM research topic arguing NDM tools suit the emergent behaviors of AI in sociotechnical systems; NDM 2024 (Auckland) sessions on AI evaluation; and studies of LLM sycophancy with military decision makers.

**Software engineering applications.** Power and Wirfs-Brock (ECSA 2019) studied RPD among software architects and gave guidance on when NDM approaches fit; Gullstrand Heander, Söderberg and Rydenfält's 2025 *Empirical Software Engineering* code-review study — "an ethnographic think-aloud study involving 10 participants and 34 code reviews" that produced a "Code Review as Decision Making (CRDM) model" — found "similarities between the cognitive process in code review and decision-making processes, especially recognition-primed decision-making"; reverse-engineering research used Klein's Critical Decision Method. **None addresses directing AI agents or vibe coding.** The vibe-coding literature (e.g., Pimenova, Fakhoury, Bird, Storey, Endres, "Good Vibrations?", 190,000+ words of practitioner data) frames experience around flow and trust, not decision theory.

**The single-simulation failure mode.** Klein himself identified the weakness: in *Sources of Power* he wrote that "we become too confident in the [simulations] we construct" and that "the power of mental simulation can be used against itself." RPD works because the simulating expert is also the executor and gets fast feedback. Delegation to an AI agent breaks this in three ways, which together form the essay's most original argument:
1. **The simulation and the execution diverge.** The developer simulates *their* implementation of the recognized pattern; the agent executes *its* interpretation. The mental simulation validates an action that is never actually taken.
2. **The intuition is not transmitted with the decision.** RPD's recognized pattern carries cues, goals, expectancies and typical actions; the prompt carries only the action. The agent inherits the conclusion without the expectancies that would tell it when the pattern does not apply. (Klein's earlier work on commander's intent addressed exactly this problem for human delegation; "Compass vs Railway Tracks" shows people instinctively give humans intent and give AI procedures.)
3. **Expectancy violations surface late.** In RPD, violated expectancies trigger rediagnosis. With an agent, the violation surfaces only when the developer reviews the output — often after it has been built on — which is where rework cost compounds.

The corollary is optimistic: coding agents make *external* simulation cheap. The design implications in "Compass vs Railway Tracks" ("rough drafts" and end-to-end "test runs") and Aporia's decision elicitation effectively turn RPD's mental simulation into a real, low-cost simulation before commitment. This links Part 3 back to Part 2: tests and executable specs are both the sematectonic stigmergic trace and the cheap simulation that RPD lacks in delegation.

### Part 4 — Has anyone made the synthesis?

**No.** Partial precedents, in order of closeness:

| Work | Frameworks combined | Domain | Gap relative to your synthesis |
|---|---|---|---|
| Sato, "Repair as Representational Work" (arXiv 2607.26517, 2026) | Grounding + boundary objects + Norman's gulfs | AI-assisted development (18 public accounts) | No stigmergy, no NDM, no statelessness |
| Çögenli, "Matched Starts, Divergent Objects" (arXiv 2609.04542, 2026) | Grounding + transactive memory | Human–LLM scholarly work | Names asymmetric persistence; not coding |
| "Coding Alone?" (*Journal of Intelligence* 14(5), 2026) | Transactive memory + distributed cognition | AI coding and public knowledge infrastructure | Macro-level; no direction dynamics |
| Vishwarupe et al. (ECSCW 2026 poster) | Grounding + repair | Practitioners incl. developers | Single framework |
| Aporia (arXiv 2604.05203) | Implicitly grounding + shared artifact | AI-assisted programming | Design probe; no theory named |
| Storey, triple debt (ACM Queue 2026) | Implicitly distributed cognition + externalized intent | AI-assisted SE | No grounding/stigmergy/NDM vocabulary |

The absence is real but bounded by method: a lead search plus a dedicated subagent search did not find one, which is strong but not proof.

## Recommendations

**For the essay:**
1. **Lead with "asymmetric persistence."** Frame the problem as grounding in which one party's common ground accumulates and the other's is rebuilt from scratch each session. Cite Çögenli as a precedent for the term, and Shaikh et al. for the model-side presumption of ground.
2. **Introduce the agent-as-overhearer.** This is the most novel and explanatory move in Part 1, and it has solid backing in the overhearer literature.
3. **Frame the fix as relocating common ground from dialogue to environment,** and use Heylighen's sematectonic/marker-based distinction to explain why Gloaguen et al. found prose context files unhelpful. This turns a contradictory evidence base into a sharp, falsifiable claim.
4. **Make the RPD argument the essay's centrepiece contribution.** No one has written that delegating an RPD-generated option to an agent separates simulation from execution and strips the expectancies. Label it clearly as your theoretical proposal.
5. **Flag speculation explicitly.** The stigmergy framing of human→agent direction, the overhearer mapping and the RPD-delegation argument are original syntheses, not findings.

**For practice (what the evidence supports now):**
- Encode intuitions as constraints (tests, types, schemas, acceptance criteria) before encoding them as prose; keep context files minimal.
- Convert your mental simulation into a cheap external one: ask the agent for a plan, rough draft or failing test before implementation, and treat divergence from your simulation as the rediagnosis trigger.
- Transmit expectancies, not just actions: state what you expect to see and what would mean the pattern does not apply (a commander's-intent format).
- Keep a decision log wired to code, Aporia-style, so the next session inherits negotiated meanings rather than only their residue.
- Watch for the moment the relationship *feels* long-established — that is when you are most likely to drop into compass-mode delegation with a partner that cannot follow a compass.

## Caveats

- Much of the most relevant 2026 work (Çögenli, Sato, Vishwarupe et al., Aporia, Rule Taxonomy, SDAD) is preprints or posters, several single-author, and not yet peer-reviewed.
- Some figures come from secondary summaries and are flagged as unverified: the 49.14%→72.13% compliance change and the +4%/−3% context-file effects reported by Daniel Vaughan's Codex Knowledge Base.
- Gloaguen et al. test benchmark-style issue resolution (SWE-bench Lite and a 138-task AGENTbench), not months-long solo projects where intent drift dominates; their negative result may not transfer to your setting.
- Memory features (persistent memory, retrieval over past sessions) are changing fast; "stateless" increasingly means "selectively and opaquely stateful," which arguably worsens the misattribution problem but changes the mechanics.
- The Klein quotations are taken from a secondary summary of *Sources of Power*, and the commander's-intent connection draws on background knowledge of Klein's work rather than a source retrieved in this research.
