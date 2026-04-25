# CANOPTICON Changelog

**Purpose.** A paper trail of how the architecture got to where it is. When you come back to this in six months and wonder why something is the way it is, this is where you look.

Format: one entry per major version, oldest at the bottom. Each entry has *what changed*, *why*, *what it replaces*, and *known dependents*.

---

## v1.5.2 — pending (April 2026)

**What's pending in this version (not yet written into master synthesis):**

- Entity resolution approach (currently undecided — a pending action item)
- Claim deduplication and versioning approach (pending)
- Convergence scoring formula (referenced as "0.75 threshold" without spec)
- Cascade workflow exact sequence (referenced but not enumerated)
- Gap Surfacer seven-stage sweep (named but stages not enumerated)
- Verifier conflict resolution (cross-model disagreement handling)
- Brier calibration workflow (resolution mechanism not specified)

These will be folded into v1.5.2 once the schema and skills work has surfaced their constraints. Not blocking Sprint 1.

---

## v1.5.1 — patch (April 2026)

**Status:** authoritative.

**What changed:**

1. **Locked workflow orchestration over autonomous multi-agent.** Section 5 (Workflows / Agent Roles) of v1.5 was rewritten. Roles are now defined as named prompt templates packaged as Claude Skills, triggered by state transitions on the data substrate. The orchestrator is plain code (a state machine), not an agent framework.

2. **Made dual-mode ingestion explicit.** Section 7 (Ingestion) was rewritten. Operator-driven and automatic ingestion are now equal peers, both converging at the Ingestion Critic gate before registry writes. Earlier drafts ambiguously implied operator-driven was primary.

3. **Specified the eleven roles by name.** Interrogator, Red Team, Steelman, Premortem, Verifier, Gap Surfacer, Calibration, Tier Projector, Assumption Auditor, Ingestion Critic, Indicator Validator. Each has a defined trigger, input substrate read, output substrate write, and packaging as a Claude Skill.

4. **Locked three operational patterns:**
   - Structured Outputs (Anthropic, beta November 2025) for registry writes with strict schema enforcement
   - Citations API for claim grounding against source documents
   - Cross-model verification (Claude generates, GPT-5 or Gemini verifies) for high-stakes claims
   - Noted incompatibility: Structured Outputs and Citations API cannot be combined in a single call (returns 400 error). Workflow handles them sequentially.

5. **Locked LLM-as-transcriber ban.** Explicitly forbidden because models hallucinate transcripts from URL metadata. Transcription is Path A (free `youtube-transcript-api` for captions) or Path B (paid AssemblyAI / gpt-4o-mini-transcribe). No other paths.

6. **Locked no-silent-spending discipline.** Every paid operation prompts the operator before execution unless explicitly whitelisted. There is no fallback cascade where the system silently tries more expensive providers. Reflected in the cost-approval modal in the operator UI.

**Why:**

- The autonomous multi-agent pattern was failing in published research (Cognition's "Don't Build Multi-Agents" June 2025; Anthropic's multi-agent post documenting 15× token cost; ICLR/NeurIPS 2025 MAST taxonomy of 1,600+ MAS traces with 14 named failure modes). The data was clear: workflow orchestration with prompted roles outperforms agent-framework autonomy on tasks like CANOPTICON's.
- Earlier drafts had ambiguity about whether automatic ingestion bypassed the Critic. Making both modes converge at the same gate eliminates a class of correctness bugs and makes the trust model explicit.
- Citations API and Structured Outputs being incompatible was discovered during architecture research. Documented so future contributors don't try to combine them.

**What it replaces:**

- v1.5 Section 5 entirely. Read v1.5.1 Section 5, not v1.5 Section 5, for orchestration spec.
- v1.5 Section 7 entirely. Same for ingestion.
- The 28-item methodology roadmap (an earlier planning artifact) — formally dissolved into v1.5/v1.5.1.

**Known dependents:**

- Postgres schema (must accommodate role-prompt invocations, structured-output writes, citation provenance)
- Skills package (must conform to Claude Skills SKILL.md format)
- API surface (must expose orchestrator events)
- Build handoff (Sprint 1 must implement Critic gate, structured-output writes, and operator approval flow)

---

## v1.5 — methodology-first rewrite (April 2026)

**Status:** superseded by v1.5.1 for sections 5 and 7. Otherwise authoritative.

**What changed:**

This was a structural rewrite, not a patch. The architecture inverted from "platform with methodology bolted on" (v1.4) to "methodology-first."

**Key restructuring:**

1. **Document organization.** Seventeen sections, organized as: why CANOPTICON exists → how it thinks → what it handles → what it produces → how it publishes. Earlier versions were organized by feature, which buried the conceptual core.

2. **Six constitutional principles** stated up front, before any architecture:
   - Methodology pluralism, not monism (no single framework dominates; each contested topic uses the framework appropriate to it)
   - Layered topics over flattened topics (factual / framing / architectural / distributive)
   - Provenance over assertion (every claim has a visible source and grade)
   - Calibrated language over rhetorical certainty (IPCC qualifiers)
   - Contradictions preserved over contradictions resolved (machloket is legitimate)
   - Operator voice as default (the system serves a person, not vice versa)

3. **Methodology canon as substrate.** A separate document (the methodology canon) catalogs 65+ frameworks across 10 domains. The top 12 are first-class integrations: Admiralty grading, Toulmin warrants, Van Evera tests, IPCC calibrated language, Brier scoring, Cynefin, Lakatos progressive/degenerating, Peirce abduction, Meadows leverage, de Bono Six Hats, McLuhan probe methodology, Popper falsifiability. Five received deep-dive specifications.

4. **Five meta-disciplines** for the operator's daily practice:
   - Calibration (Brier-tracked predictions, IPCC language)
   - Falsifiability discipline (every thesis has a "what would change my mind?" answer)
   - Layer discipline (every contested topic decomposes into the four layers)
   - Provenance discipline (every claim has a source)
   - Contradiction discipline (contradictions preserved, machloket flagged)

5. **Data structures locked:** Claim Graph, Question Graph, Assumption Registry, Linchpin Registry, Indicator Registry, Contradiction Registry, Source Registry, Brier Registry, Book Graph. Conceptual specifications only — actual schema deferred to a separate document.

6. **Layered-topic template formalized.** Every contested topic is decomposed into Factual / Framing / Architectural / Distributive, with their own claims, sources, and postures. Cross-layer contradictions are preserved.

7. **Three-mode book ingestion specified.** Surface (skim for relevance), Substrate (full claim extraction), Influence (the book's framing is itself a claim about how to see). Distinct workflows for each.

8. **Two-path transcription specified.** Path A (free) and Path B (paid). LLM-as-transcriber explicitly banned (formalized in v1.5.1).

9. **Cost-control UX with $50/month ceiling** specified. Auto-blocks at ceiling. Prompts for every paid operation (formalized in v1.5.1 as no-silent-spending).

10. **Tier projection system formalized.** Every thesis projects to BLUF, 80-word, 800-word, Full. The Tier Projector role regenerates these whenever the underlying claim graph updates.

**Why:**

The earlier architecture treated methodology as features (an "Admiralty grading feature," a "Brier scoring feature") bolted onto a content-management platform. This made the methodology feel optional and made the platform feel like a content tool with extras.

The methodology-first inversion treats the methodology as the system's reason to exist. The platform exists to *enforce* methodology. Without the discipline, CANOPTICON is a blog. With it, CANOPTICON is forensic intelligence.

This change was forced by recognizing that the operator's actual problem isn't "where do I publish things" — it's "how do I think about contested political-economic structure rigorously enough that what I publish holds up." The platform should be downstream of that question, not upstream.

**What it replaces:**

- v1.4 entirely. v1.4 is archived. v1.5 (with v1.5.1 patches) is authoritative.

**Known dependents:**

- Operator UI spec (rewritten to surface methodology-first features)
- Public site spec (rewritten around prediction ledger and contradiction tracker as central credibility surfaces)
- Methodology canon document (referenced from v1.5)

---

## v1.4 — superseded (March 2026)

**Status:** archived.

**What it was:**

A platform-first architecture. Sections organized by feature: ingestion features, drafting features, publishing features, distribution features. Methodology was a section within the document, not the organizing principle.

**Why archived:**

The methodology was the actual product. v1.4 hid it. v1.5 surfaces it.

**What survives from v1.4 into v1.5:**

- The technical stack (Cloudflare Workers + Durable Objects + Supabase + R2 + Claude API + Vercel + Apify)
- The drophead-aesthetic design language (dark amber-on-black, EB Garamond + JetBrains Mono, no rounded corners, no glassmorphism)
- The Moose-on-the-Loose declarative voice as the editorial default
- The cost discipline (now formalized as no-silent-spending in v1.5.1)
- Most of the data-structure naming (Claim Graph, registries, etc.)

**What changed from v1.4:**

- The eleven roles were not yet named or scoped
- The methodology canon did not exist as a separate document
- The layered-topic template was implicit, not formalized
- The operator UI was specified as desktop-first with sidebar nav (changed in design phase to mobile-first six-nav)
- Multi-agent autonomy was implied but not committed (later rejected in v1.5.1)
- Cross-model verification was not specified
- Public site was a placeholder section, not a separate spec

**Do not read v1.4 except for historical reference.** v1.5 + v1.5.1 is the authoritative architecture.

---

## v1.3 and earlier — pre-architecture exploration

Various planning documents, design experiments, methodology readings, naming explorations. Not versioned formally. Useful as creative substrate but not as architecture.

Includes:
- The 28-item methodology roadmap (dissolved into v1.5)
- Initial drophead aesthetic explorations
- "CANOPTICON" naming finalization (over earlier candidates)
- Carbon-policy stress-test exercises (still useful as case studies; will be reformatted as layered-topic examples)
- Earlier UI sketches (v9-attempt-desktop-first; abandoned)

---

## CONVENTIONS GOING FORWARD

**Versioning.** Major version bumps for structural changes (v1 → v2 would be a fundamentally different architecture). Minor version bumps for substantive additions or rewrites of sections (v1.5 → v1.6 would add or replace sections). Patch versions for tightening, locking decisions, or fixing internal contradictions (v1.5 → v1.5.1).

**Decision provenance.** Every architectural decision should be traceable to either (a) a piece of evidence (research finding, empirical data, vendor documentation) or (b) a stated principle (one of the six constitutional principles, or an explicit operator preference). Decisions without provenance become technical debt.

**Archive, don't delete.** Superseded versions remain readable. The changelog explains what replaced them and why. Future-you should be able to reconstruct past-you's reasoning.

**Pending lists are visible.** v1.5.2's pending list (above) makes explicit what's not yet decided. This is healthier than pretending the architecture is complete when it isn't.

---

## CROSS-REFERENCES

- Master synthesis: `canopticon-master-synthesis-v1.5.1.md` (the v1.5 base, with v1.5.1 patches applied to sections 5 and 7)
- Methodology canon: `canopticon-methodology-canon.md`
- Operator UI spec: `canopticon-ui-spec-v1.0.md`
- Public site spec: `canopticon-public-site-spec-v1.0.md`
- Glossary: `canopticon-glossary.md`
- Operator prototype (current): `canopticon-prototype-v92.html`
- Public prototype (current): `canopticon-public-prototype-v1.html`

Schema, skills package, API surface, and build handoff documents are pending.
