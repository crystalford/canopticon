# CANOPTICON — Canonical Specification (Source of Truth)

**Version 1.0 · This document supersedes all prior CANOPTICON specs, deltas, and handoffs as the single source of truth. Where any older document conflicts with this one, THIS WINS. Read this top to bottom before building anything. It assumes you have NOT been part of any prior conversation.**

-----

# PART 0 — READ THIS FIRST: WHAT CANOPTICON IS

CANOPTICON is a **forensic intelligence publication system**. A single operator feeds it high-quality research (long documents written with a frontier LLM about subjects like foreign aid, sovereign debt, central banking, political economy). The system turns that research into a **growing body of citable, verified, public reference pages** — and into raw material the operator can spin into distributed content (social posts, scripts, video essays).

It is **not** a CMS. It is **not** a fact-checker. It is **not** a note-taking app. The closest analogy: an automated, citation-grade reference publication (think a rigorously-sourced wiki) that an LLM builds *for* the operator from the operator's research, with the operator as editor-in-chief approving what goes live.

**The one-sentence product:** the operator does research → the system proposes and drafts citable reference pages ("Briefs") grounded in that research → the operator approves → the pages publish, server-rendered and built to be cited by humans and AI answer engines.

## The single most important thing to understand (the intent that keeps getting lost)

**CANOPTICON IS AN AUTOMATED, HANDS-OFF SYSTEM. The operator's job is to APPROVE, not to AUTHOR.**

Read that again. Every part of this system is designed so the operator does as little manual work as possible. The system reads the research, the system notices what's worth publishing, the system drafts it, the system verifies it. The operator clicks "yes, publish that" or "no, discard." The operator should almost never type a Brief body or a citation by hand.

If at any point a design decision pushes work ONTO the operator (manual authoring, manual citation entry, manual approval of every claim), that is a RED FLAG that the design has drifted from intent. The default is always: **the system does it; the operator oversees.**

This intent has been misread before. A prior build interpreted "manual first" as "the operator hand-writes Briefs in a composer form." That was WRONG and is the exact failure this document exists to prevent. See the Glossary (Part 1) for the precise meaning of "manual."

-----

# PART 1 — GLOSSARY & DISAMBIGUATION (read before any other section)

These words are load-bearing. Misreading one inverts the system. Definitions are binding.

- **"Manual" / "manual first"** — refers ONLY to the **human approval gate on a system-drafted artifact**. It means: the LLM drafts the Brief (body + citations), and a human reviews and clicks Publish or Discard before it goes live. "Manual" does NOT mean the operator authors the body or types citations by hand. There is no scenario in normal use where the operator writes a Brief from scratch. (A hand-authoring composer may exist as a rare fallback, but it is NEVER the primary surface or the default flow — see Non-Goals, Part 9.)
- **"Automated" / "hands-off"** — the system performs the work (reading, proposing, drafting, verifying) without the operator initiating each step manually. The operator's interactions are: trigger extraction (a click), approve/reject proposals (a click), approve/reject drafts (a click).
- **"Brief"** — the PRODUCT. A single typed, verified, server-rendered, citable reference page answering one question or covering one subject (e.g. "What is the Domestic Stability Buffer?", "Pro vs critical positions on tied aid", "Timeline of OSFI capital rules 2020–2026"). A Brief is composed BY THE SYSTEM from grounding units, verified, and published on approval. Briefs are the unit of the system. (See Part 4.)
- **"Claim" / "atomic claim"** — a single sourced factual proposition extracted from a document. A claim is PLUMBING — grounding material the system uses to build Briefs. A claim is NOT a product, NOT a page, NOT something the operator looks at as an end in itself. (Earlier versions of the system wrongly treated the claim as the product. It is not.)
- **"Proposal" / "the proposer"** — the system's automatic suggestion of a Brief worth building. The proposer reads the grounding layer and outputs specific, well-shaped Brief suggestions with LLM-generated reasoning ("you've ingested 5 docs on OSFI capital rules; these 4 Briefs would draw from that"). The operator clicks one to build it. The proposer is the PRIMARY content of the Briefs surface.
- **"Compose"** — AVOID this word in UI and code. It implies hand-authoring. The system "drafts" or "generates"; the operator "approves." Do not build a "compose" flow as the main path.
- **"The Vault"** — safe, organized raw document storage. Drop a doc in, it's stored, hashed, deduped, auto-tagged by subject. NO extraction or synthesis fires on upload. The Vault is useful on its own. (See Part 3, Layer 1.)
- **"Grounding" / "grounding layer" / "grounding units"** — the extracted material (claims, argument units, source theses) that Briefs are built FROM. Extraction produces grounding; grounding feeds Brief generation. (See Part 3, Layer 2.)
- **"Extraction"** — the process of reading a stored document and producing grounding units. Triggered manually/in batches (a click), NOT automatically on upload. Runs on the cheap model.
- **"Verbatim verification"** — the trust mechanism. Every factual statement in a Brief carries a quote that must be a literal, exact substring of a real fetched source. If the quote isn't verbatim in the source, the claim is killed. A second, independent model judges whether the quote supports the statement. (See Part 5.)
- **"Verdict words"** — the operator forbids editorializing in published facts. Briefs state what is, sourced; analysis/interpretation is clearly separated and signed. (See hard constraints, Part 8.)

-----

# PART 2 — THE CORE ARCHITECTURE (the inversion)

The system was originally built around the wrong primitive: `document → extract → claims → store`, treating the claim as the product. This produced a filing cabinet that didn't *know* anything.

The correct architecture inverts this. **The Brief is the product. Extraction is plumbing. The graph is connective tissue.**

```
Layer 1: VAULT        document dropped → stored, hashed, deduped, auto-tagged (NO processing)
                              ↓ (operator clicks Extract, later)
Layer 2: EXTRACTION   stored doc → grounding units (atomic claims + argument units + source thesis)
                              ↓ (the proposer reads grounding, automatically)
Layer 3: BRIEFS       proposer suggests Briefs → operator clicks Build → system drafts + verifies →
                       operator approves → published as citable page
```

Each layer is **independently triggered** — NOT one automatic chain. Upload does not fire extraction. Extraction does not fire publishing. This decoupling is deliberate: it lets the operator safely bank research without triggering machinery, and lets each stage be developed and de-risked separately.

This maps to the medallion data pattern: Vault = bronze (raw, immutable), Extraction = silver (cleaned grounding units), Briefs = gold (curated published product).

**One research pass fans out into MANY Briefs.** A single foreign-aid research report should yield a definition Brief, a pro-vs-critical comparison Brief, a timeline Brief, a Q&A Brief, an actor profile, and a thesis synthesis — not collapse into a pile of claims. The fan-out is the value.

-----

# PART 3 — THE THREE LAYERS IN DETAIL

## Layer 1 — The Vault (store first, no processing)

**Trigger:** document upload (operator drops a file or zip).

**What it does:**

- Stores the raw document immutably in R2.
- Computes SHA-256 of the upload bytes; persists to `uploaded_files.sha256`. If a piece with the same hash exists, short-circuit and show "Already in the Vault" (dedup). Zip uploads count duplicates separately.
- Writes metadata to D1: filename, hash, subject auto-tags, upload date, `status='stored'`.
- Generates one document-level embedding → Vectorize, for light subject auto-classification/clustering.

**What it does NOT do:** extract claims, build Briefs, or call an expensive model. Upload ends at the stored row. **No digestion fires on upload.**

**Operator-facing:** this is the **Library** surface — the Vault's front end. Stored docs, searchable, grouped by subject, each with an "Extract" button and a status pill (`stored / queued / extracting… / extracted / failed`). A header "Extract all (N)" batch button.

## Layer 2 — Extraction (manual/batch trigger, idempotent, cheap model)

**Trigger:** operator clicks "Extract" on a doc or "Extract all"; or a batch job. NEVER automatic on upload.

**Idempotent:** keyed on content hash / existing completed job. Clicking Extract twice on an unchanged doc is a free no-op. Failed jobs re-queue. Re-running extraction across the corpus reprocesses only changed docs — so the operator can wipe and re-extract during development without runaway cost.

**Runs on the cheap model** (Llama 3.3 70B on Workers AI) during development and likely in production — extraction quality gap between cheap and frontier models is small for constrained extraction with downstream verification.

**Produces THREE nested levels of grounding** (this is critical — today only atomic claims exist; the other two must be built):

- **Level 0 — Atomic claim:** one proposition + verbatim source span + document ID + character offsets (+ numeric value if any). Feeds Definitions, Stats, Timelines, Q&A.
- **Level 1 — Argument unit:** `{claim, grounds[] (references Level-0 ids), warrant? (optional/best-effort), stance (pro/critical/neutral), actor?}`. **This is what lets the system build Position-Comparison Briefs** — without a stance signal there's nothing to cluster pro vs critical. Today this is MISSING and must be migrated (new `argument_units` table).
- **Level 2 — Source thesis:** the document's overall position/major claim (references Level-1 ids). Feeds Actor Profiles and gives every Brief its "who argued this, where." Today MISSING (new `source_theses` table).

Nesting: Level 2 → Level 1 → Level 0 → raw source span in R2. Provenance is unbroken end to end (required for verbatim verification and no-self-citing).

**Infrastructure (already built, pre-pivot):** `digest_jobs` table + every-minute cron drain + idempotent `runDigestJob`, survives Worker timeouts. Reuse this. Extend it to produce Level 1 and Level 2, not just Level 0.

## Layer 3 — Briefs (the product: propose → build → verify → approve → publish)

This is the heart of the system and the part that has been most misbuilt. The flow, as an explicit click-sequence:

1. **The proposer runs automatically** after extraction has populated the grounding layer. It reads the grounding (claims, argument units, theses, entities) and outputs **specific, well-shaped Brief suggestions across multiple content types**, each with LLM-generated reasoning. (See Part 6 — the proposer is the thing most needing an upgrade.)
1. **The operator sees proposals** as the primary content of the Briefs surface — a list of suggestion cards. Each card: proposed title, content type, one-line reasoning ("5 docs cover OSFI capital rules; this Q&A would draw from them"), and a **Build →** button.
1. **The operator clicks Build →** on a proposal they like.
1. **The system drafts the entire Brief** — body + structured citations — using the existing `buildBrief()` pipeline (Llama 70B drafts per content-type template; fetches each cited URL; verbatim-checks; independent-judge). The operator does NOT write anything.
1. **The system shows the verified draft** with verified claims and any killed/flagged claims visible (struck through).
1. **The operator clicks Publish or Discard.** (Editing a draft before publishing is a desired enhancement — see Part 7.) On Publish, the Brief renders server-side as a citable page.

**Manual at first** means steps 1–6 happen with the operator approving each Brief individually (no auto-publish), AND the proposer/build may be run deliberately rather than on a schedule. It does NOT mean the operator authors anything. Automation later = the proposer runs continuously and surfaces a steady queue; the operator still approves.

**Built with:** Llama for drafting during development; switch the drafting/generation step to Claude (Opus/Sonnet) near launch for quality (the synthesis quality gap is large and is where frontier models earn their cost). Extraction stays cheap.

-----

# PART 4 — THE BRIEF TYPES (the product taxonomy)

Each Brief is a typed content artifact with the schema.org type that maximizes AI/search citability. Build graph-derived types first; computational types last.

| # | Brief type | What it is | schema.org | Notes / build priority |
|---|------------|------------|------------|------------------------|
| 1 | **Q&A / Query-Answer** | hub of real questions + concise sourced answers | FAQPage / QAPage | **FIRST** — highest citation surface; each Q&A pair is a discrete answer target |
| 2 | **Position-Comparison** | pro vs critical positions, each with grounds | ItemList/Table + Claim | **FIRST** — the payoff Brief; comparison content earns very high citation rates. GATED on Level-1 argument extraction (needs stance) |
| 3 | **Definition / Glossary** | authoritative sourced definition of a term | DefinedTerm | early; easiest win |
| 4 | **Timeline** | dated sequence of events | ItemList of Event (ISO 8601 dates) | early |
| 5 | **Mechanism Explainer** | how a process works | Article / TechArticle | mid |
| 6 | **Actor Profile** | person/institution/state: roles, positions, timeline | Person / Organization / GovernmentOrganization | mid; uses Level-2 theses aggregated by actor |
| 7 | **Thesis / Argument Synthesis** | a substantive argument + grounds + counter-position | Article + Claim/ClaimReview | mid; the analytical core |
| 8 | **Statistics / Data-Point** | roundup of sourced figures | Dataset | later; figures must be verbatim-verified |
| 9 | **Calculator / Computational** | interactive computation | WebApplication | **LAST** — needs bespoke formulas, NOT graph-derived |

**Cross-cutting requirements for every Brief (established citability practice):** front-load a direct 1–2 sentence answer at the very top (most AI citations come from the top of a page); question-shaped H2/H3 headings; correct schema.org JSON-LD; visible `dateModified`; named author/publisher. Server-rendered HTML, readable with no JavaScript.

**Today's status:** content-type templates for definition / comparison / timeline / faq / stat-roundup are already wired in `buildBrief()`. Position-Comparison is blocked until Level-1 extraction lands.

-----

# PART 5 — THE TRUST MODEL (verbatim verification — non-negotiable)

This is what makes a fresh-generated Brief trustworthy without the operator vouching for every fact. It is already built (`buildBrief` pipeline) and must never be removed or weakened.

For every factual statement in a drafted Brief:

1. **Retrieve** — fetch the actual cited source page; store fetched text (hashed) so checks are reproducible.
1. **Verbatim substring check (load-bearing):** the statement's `source_quote` must be a literal, exact substring of the fetched source text. If it is NOT, the claim is **killed** — dropped or flagged, never published. This alone kills most hallucinations.
1. **Independent judgment:** a DIFFERENT model (today QwQ-32B; or the same model with generation hidden and different framing) judges whether the quote actually supports the statement. Same-model self-verification is theater and is not acceptable.
1. **Audit:** store source hash + offsets per claim.

The trust boundary is **mechanical verification, not operator vouching.** That is precisely why the operator does not need to author or hand-verify Briefs — the pipeline guarantees grounding.

-----

# PART 6 — THE PROPOSER (the piece most needing work)

**Today (insufficient):** a brittle SQL heuristic — pick entities with ≥5 atomic claims → propose a "What is X?" Definition; pick patterns marked `candidate` → propose Comparison/Timeline. It proposes one type per entity, fires only after extraction, and gives flat "X has lots of claims" reasoning.

**Intended (the actual ask):** an **LLM-driven research-assistant-style suggester.** It reads the grounding layer and proactively proposes specific, well-shaped Briefs across multiple content types, each with substantive reasoning. Worked example:

> Operator has uploaded 5 docs about OSFI capital rules. The proposer outputs ~4 specific suggestions:
> 
> - (a) **Definition**: "What is the Domestic Stability Buffer?"
> - (b) **Timeline**: "OSFI capital changes, 2020–2026"
> - (c) **Q&A**: "How does the DSB affect retail mortgages?"
> - (d) **Stat-roundup**: "Canadian bank capital ratios"
>   …each with LLM-generated reasoning for why it's a good candidate from the grounding on hand.

The proposer is the **primary content of the Briefs surface.** The operator's main interaction with Briefs is: read proposals → click Build on the good ones. Wire the proposer's output as the main `/op/briefs` content; the existing `buildBrief` handles the rest once Build is clicked.

-----

# PART 7 — THE OPERATOR CONSOLE (six surfaces)

The console is the private operator workspace. Dark theme (the "workshop behind the warm-paper public site"). Six nav surfaces. The operating philosophy across all of them: **upload is authorization; the system does the work; the operator oversees, not manages.** No confirmation gauntlets, no task-queue chores.

1. **Feed** — the intake surface. Drop documents → stored in Vault (no auto-extraction). Shows an activity log of what the system did. Below the log, an infinite-scroll list of recently ingested docs (the temporal view).
1. **Chat** — one continuous, never-resetting conversational stream to interrogate and command the graph by intent ("what do we have on Brookfield", "find contradictions in the Carney timeline"). Not new-chat-per-conversation. The stream is also the activity log. Pairs with a persistent command bar.
1. **Synthesis** — read-only oversight of what the system surfaces from the grounding layer: finding cards (pattern, contradiction, connection, thesis-candidate, gap). The operator observes; the only action per card is **"Use in Studio →"** (send to Studio as content source). No Watch/Nudge/Dismiss — those were removed. Silence is valid; this is oversight, not a task queue. Findings must use the WEIGHTING MODEL (Part 8): count distinct investigations not documents, evidence-bearing docs only, distinctiveness not raw counts.
1. **Library** — the Vault's front end. The full document archive: stored docs, grouped by subject/chain, searchable, each with extraction status + Extract button. Both the organized archive and the place extraction is triggered.
1. **Briefs** — the citable-page layer. PRIMARY content = the proposer's suggestion cards (Part 6), each with Build →. Clicking Build runs the draft+verify pipeline; the operator approves/discards. A hand-authoring composer is NOT the primary surface (it may exist only as a niche fallback — see Non-Goals).
1. **Studio** — turn findings/Briefs into distributed content. Core concept: lock a **reasoning skeleton** (the operator's argument structure/information order — NOT voice), then generate output in any medium (X post, thread, TikTok script, video essay script, podcast segment) following that locked structure, expanded/compressed per medium. (Studio has been expanded in design into a fuller Script→Audio→Video→Export pipeline; build Stage 1 = reasoning lock + script generation first; audio/video/export are additive later stages, do not block launch on them.)

**Reasoning skeleton (Studio detail):** the operator's frustration is that LLM output rambles, goes out of order, doesn't land the point. The fix is locking an explicit argument structure (e.g. "1. the thing nobody says · 2. the contradiction, evidence first · 3. why it matters structurally · 4. the implication · ✕ never: hedges, digressions"). Extract this from examples the operator drops (their own best work), let them edit it, lock it. NOT voice/personality capture — argument structure. Medium only changes how much each beat expands.

-----

# PART 8 — HARD CONSTRAINTS (never violate)

1. **Automated, hands-off — operator approves, does not author.** (Part 0. The prime directive.)
1. **The Brief is the product; the claim is plumbing.** Never invert this.
1. **Three independently-triggered layers.** Upload never auto-fires extraction; extraction never auto-fires publish.
1. **Verbatim verification is mandatory and mechanical.** Every Brief fact's quote is a literal substring of a real fetched source, independently judged. Kill on failure. (Part 5.)
1. **No self-citing / no citogenesis.** A fact's evidence always points to an EXTERNAL source, never to CANOPTICON itself. Build-time invariant: fail if any `evidenced_by` URL is internal.
1. **No auto-publish.** A human approves every Brief before it goes live.
1. **Server-rendered, citable HTML.** Every public page is fully readable with no JavaScript. Machines that cite don't run JS.
1. **Facts vs analysis kept separate.** Briefs state sourced facts without editorializing; interpretation is clearly marked and signed. No verdict words in factual content.
1. **The weighting model governs Synthesis counts.** Count distinct investigations (chains collapse via `investigation_id`), compute over evidence-bearing documents only (not the operator's own essays), show distinctiveness vs. baseline, not raw mention counts. (Prevents manufacturing false significance from research attention.)
1. **Tiered model use.** Cheap model (Llama) for high-volume extraction; frontier model (Claude) for Brief generation/synthesis near launch. Add result-caching so re-extraction doesn't re-bill unchanged docs.

-----

# PART 9 — NON-GOALS (explicitly do NOT build these)

1. **Do NOT build a hand-authoring Brief composer as the primary surface.** The operator does not write Brief bodies or type citation tuples as the main flow. (This was built once by mistake and inverted the whole product. A manual composer may exist ONLY as a hidden niche fallback, never the default, never the primary `/op/briefs` content.)
1. **Do NOT auto-publish anything.** Generation is automated; publishing requires a human click.
1. **Do NOT auto-fire extraction on upload.** Upload stores only.
1. **Do NOT treat claims as a product surface.** No "browse all claims" as an end-user feature; claims are grounding.
1. **Do NOT use same-model self-verification.** The judge must be independent.
1. **Do NOT show raw mention counts in Synthesis.** Use the weighting model.
1. **Do NOT rebuild working primitives.** `buildBrief`, the verify pipeline, the digest infrastructure, the Vault, the server-rendered Brief page, the content-type templates all exist and work — extend, don't replace.
1. **Do NOT capture "voice" in Studio.** Lock argument structure, not personality.
1. **Do NOT require JavaScript to read any public page.**

-----

# PART 10 — WHAT EXISTS / WHAT CHANGES / WHAT TO KEEP

**Exists and works — KEEP and extend (do not rebuild):**

- `buildBrief()` auto-generate pipeline (Llama draft → fetch → verbatim-check → independent judge → persist). THE core. Use it.
- Server-rendered citable Brief page `/briefs/:slug` with schema.org JSON-LD, no JS.
- Durable extraction infra: `digest_jobs` + cron drain + idempotent `runDigestJob`.
- The Vault: `pieces` + `sources` + `uploaded_files` + R2 + content-hash dedup.
- Content-type templates (definition/comparison/timeline/faq/stat-roundup) in `pipeline.ts`.
- Grounding query: `searchVectors` over Vectorize + SQL search over `claim_versions.claim_text`.
- The six console surfaces (built in design); the public site (Worker-from-D1, in progress).

**Exists but WRONG — fix:**

- Manual Brief composer is currently the PRIMARY `/op/briefs` surface (PRs #107–108). Demote it to a hidden fallback or remove it; make the proposer's suggestions the primary content.
- The proposer is a dumb SQL heuristic. Upgrade to the LLM-driven suggester (Part 6).

**Missing — BUILD:**

- Level-1 (argument units, with stance) and Level-2 (source theses) extraction + their tables. Without Level-1, Position-Comparison Briefs can't be built.
- LLM-driven proposer.
- Edit-a-draft-before-publish (today only Publish/Discard).
- Switch Brief generation to Claude near launch.
- Citation tracker (later phase).

**Correctly done already (post-pivot):**

- Decoupled ingest (#106): upload no longer auto-extracts. Correct.
- Content-hash dedup (#109). Correct.
- Idempotent extract (#110). Correct.

-----

# PART 11 — BUILD SEQUENCE

1. **Fix the Briefs surface direction.** Demote/remove the manual composer as primary; make the proposer's suggestions the primary content of `/op/briefs`. (Undo the inversion.)
1. **Upgrade the proposer** to the LLM-driven suggester (Part 6) — reads grounding, outputs multi-type suggestions with reasoning.
1. **Exercise and harden `buildBrief` on real content** — it hasn't been run much; make sure it produces good drafts from real grounding.
1. **Build Level-1 + Level-2 extraction** (argument units with stance, source theses) so Position-Comparison and Actor Profile Briefs can be built.
1. **Ship Q&A + Position-Comparison Briefs end to end** (propose → build → verify → approve → publish).
1. **Add remaining Brief types.**
1. **Edit-a-draft-before-publish.**
1. **Switch generation to Claude near launch; add result-caching.**
1. **Citation tracker.**
1. **Studio Stage 1** (reasoning lock + script gen), then later stages.

Stay on the free model until near launch. Reserve Claude for Brief generation.

-----

# PART 12 — STACK & ENVIRONMENT (reference)

- Cloudflare Worker (single Worker serves public `/*` + operator `/op/*` + API `/v1/*`).
- D1 (SQLite) = source of truth: pieces, sources, claims/claim_versions, argument_units (new), source_theses (new), briefs, brief_claims, digest_jobs, uploaded_files, entities, patterns.
- R2 = raw document storage + fetched-source text (hashed).
- Vectorize = embeddings for grounding search + document subject clustering.
- Workers AI = Llama 3.3 70B (extraction, dev-time drafting), QwQ-32B (independent judge). Claude API (Opus/Sonnet) for Brief generation near launch.
- Public site server-rendered from D1; no JS required to read.

-----

*End of canonical spec v1.0. This is the source of truth. Hand this WHOLE document to the code side. Do not hand deltas without this. When something is ambiguous, the Glossary (Part 1) and the prime directive (Part 0) decide it: the system is automated and hands-off; the operator approves, never authors.*
