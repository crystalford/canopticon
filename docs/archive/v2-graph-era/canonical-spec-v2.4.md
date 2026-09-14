# CANOPTICON — Canonical Specification v2.4 (Source of Truth)

**Version 2.4 · This document supersedes ALL prior versions, and ALL prior CANOPTICON specs, deltas, research reports, and handoffs as the single source of truth. Where anything older conflicts with this, THIS WINS. Read it top to bottom before building. It assumes you have NOT been part of any prior conversation.**

**What changed in v2.4:** (a) "Storage" retired; replaced throughout with **Storage** (the layer where documents live; the Library is its public view). **What changed in v2.3:** (a) Part 19 gains LEGACY CORPUS ONBOARDING (the ~60 existing report-only documents); (b) Part 19 gains ESSAY HANDLING (interpretive drafts are digested and regenerated — no direct-import-to-publish side door). **What changed in v2.2:** (a) PART 18 — the PUBLIC SITE structure under the new model (lean nav; intents as badges not nav; the factual substrate as unmarked ground; research reports public in the Library); (b) PART 19 — the MIGRATION/TRANSITION rules for existing data and pages; (c) PART 20 — an end-to-end ACCEPTANCE TEST scenario; (d) a stub defining research wrap-up packages. **What changed in v2.1:** (a) the MODEL STRATEGY is updated — Llama 3.3 70B is RETIRED as the default; the system uses a tiered lineup of the strongest cheap Cloudflare-hosted models (Part 16); (b) the SURFACING INTELLIGENCE ENGINE is now specified (Part 17) — the two-level architecture replacing naive frequency-counting. **What changed from v1.0:** v1.0 modeled extraction as a thin "three-level" pull and used the word "Briefs" as the umbrella for all output. v2.0 replaces that with (a) a properly TYPED data model — different KINDS of facts, different TYPES of links, and contested assertions as a first-class thing; (b) a clean split between a neutral FACTUAL layer and a signed INTERPRETIVE layer, dropping the muddy word "Briefs"; (c) factual outputs reframed as ARRANGEMENTS and interpretive outputs as INTENTS; (d) a fact/interpretation FIREWALL as a hard constraint; (e) LIVE INQUIRY THREADS so the system is a living reservoir, not a dead archive. Everything else from v1.0 (decoupled layers, verbatim verification, operator console, model strategy, non-goals) carries forward.

-----

# PART 0 — READ THIS FIRST: WHAT CANOPTICON IS

CANOPTICON is a **forensic intelligence publication system**. A single operator feeds it high-quality research (long documents, written with a frontier LLM, about subjects like foreign aid, sovereign debt, central banking, political economy — but the system is subject-agnostic). The system turns that research into a **growing, citable, verified body of public reference pages and signed investigations** — and into raw material the operator can spin into distributed content (social posts, scripts, video essays).

It is **not** a CMS, **not** a fact-checker, **not** a note-taking app. The closest analogy: an automated, citation-grade reference publication — a rigorously-sourced substrate of facts that an LLM grows *for* the operator from the operator's research, with signed interpretation layered on top, and the operator as editor-in-chief approving what goes live.

**The one-sentence product:** the operator does research → the system extracts it into a typed graph of facts → the system proposes and drafts citable pages (neutral facts) and investigations (signed readings) grounded in that graph → the operator approves → pages publish, server-rendered, built to be cited by humans and AI answer engines.

## The prime directive (the intent that keeps getting lost)

**CANOPTICON IS AN AUTOMATED, HANDS-OFF SYSTEM. The operator's job is to APPROVE, not to AUTHOR.**

The system reads the research, notices what's worth publishing, drafts it, verifies it. The operator clicks "publish that" or "discard." The operator should almost never type a page body or a citation by hand. If any design decision pushes authoring work onto the operator, that is a RED FLAG that the design has drifted. The default is always: the system does it; the operator oversees. (A prior build misread "manual first" as "operator hand-writes pages in a composer." That was WRONG and is the exact failure this document exists to prevent — see the Glossary.)

-----

# PART 1 — GLOSSARY & DISAMBIGUATION (binding; read before any other section)

These words are load-bearing. Misreading one inverts the system.

- **"Manual" / "manual first"** — refers ONLY to the **human approval gate on a system-drafted artifact**: the LLM drafts (body + citations), a human reviews and clicks Publish or Discard. It does NOT mean the operator authors anything by hand. There is no normal flow where the operator writes a page from scratch.
- **"Automated" / "hands-off"** — the system performs the work (reading, extracting, proposing, drafting, verifying). The operator's interactions are clicks: trigger extraction, approve/reject proposals, approve/reject drafts.
- **"The factual layer" / "the citable factual substrate"** — the PRODUCT, side one. The neutral, sourced, checkable account of what IS. The bedrock that grows from research and that machines and humans cite. It is defined here by FUNCTION; its public-facing proud NAME is an open slot (see Part 13). Do NOT call it "Briefs."
- **"Investigation" (and the other interpretive types)** — the PRODUCT, side two. The signed, authored reading of what facts MEAN. Sits on top of the factual substrate. "Investigations" is the kept name for the flagship interpretive type.
- **"Briefs"** — DEPRECATED. Do not use. It drifted across both layers and destroyed trackability. Replaced by the factual-layer / interpretive-layer split.
- **"Fact" vs "Assertion"** — a FACT is neutral, sourced, treated as established. An ASSERTION is what some ACTOR claims (pro/critical/disputed) — stored distinctly, never silently treated as a fact. (See Part 4; this distinction is the system's spine.)
- **"Claim"** — historically ambiguous; AVOID as a bare term. Use "neutral fact" or "attributed assertion" specifically.
- **"Arrangement"** — a factual content type. A lens that pulls a subset of stored facts into a shape (timeline, profile, comparison). Facts are stored once; arrangements are views, not separate storage.
- **"Intent"** — an interpretive content type, distinguished by epistemic stance (investigation = probe; argument = verdict; pattern = recurring structure; etc.).
- **"Storage"** — where raw uploaded research documents live (R2 + D1 metadata). The Library is its public view. Not a content type — just where documents live. Distinct from the factual layer, which is what the system BUILDS from stored documents.
- **"Grounding" / "extraction"** — reading a stored document and producing typed graph nodes/edges. Triggered manually/in batches, never automatically on upload. Runs on the cheap model.
- **"Verbatim verification"** — the trust mechanism: every published factual statement's quote must be a literal substring of a real fetched source; an independent model judges support; failures are killed.
- **"Compose"** — AVOID in UI/code. Implies hand-authoring. The system "drafts"; the operator "approves."
- **"Inquiry thread"** — an open question or unfinished direction that persists and resurfaces (the "things still worth chasing"). A first-class object that keeps the system a living reservoir. (See Part 6.)

-----

# PART 2 — THE CORE ARCHITECTURE

The original system was built around the wrong primitive (`document → extract → claims → store`, claim-as-product) and produced a filing cabinet that knew nothing. The corrected architecture has two ideas:

**Idea 1 — Three decoupled processing layers (unchanged from v1.0):**

```
STORAGE       upload → stored, hashed, deduped, auto-tagged (NO processing fires)
                ↓ (operator triggers extraction, later)
EXTRACTION  stored doc → typed graph nodes + edges (atomic, idempotent, cheap model)
                ↓ (the proposer reads the graph, automatically)
OUTPUT      propose → operator clicks Build → system drafts + verifies → operator approves → publish
```

Each layer is independently triggered — NOT one automatic chain. Upload never auto-fires extraction; extraction never auto-fires publish. Maps to medallion: Storage = bronze, Extraction = silver, Output = gold.

**Idea 2 — The output is TWO layers, on one typed graph:**

- **The factual substrate** (neutral facts, arranged into citable pages). The commodity. The ground.
- **The interpretive layer** (signed investigations/arguments/patterns built on the facts). The moat. The figure.

Both are built BY THE SYSTEM from the same typed graph. One research pass FANS OUT into many outputs of both kinds. The fan-out is the value.

-----

# PART 3 — THE THREE PROCESSING LAYERS

## Layer 1 — Storage (store first, no processing)

**Trigger:** upload. **Does:** store raw doc immutably in R2; SHA-256 hash → `uploaded_files.sha256` (dedup: identical hash short-circuits with "Already in Storage"); metadata to D1 (filename, hash, subject auto-tags, date, `status='stored'`); one doc-level embedding → Vectorize for subject clustering. **Does NOT:** extract, build pages, or call an expensive model. **Operator-facing:** this is the **Library** surface — the searchable archive, each doc with an Extract button + status pill (`stored / queued / extracting… / extracted / failed`) and "Extract all (N)".

## Layer 2 — Extraction (manual/batch, idempotent, cheap model)

**Trigger:** operator clicks Extract, or a batch job. NEVER on upload. **Idempotent:** keyed on content hash / completed-job; re-running reprocesses only changed docs (so wipe-and-re-extract during dev is cheap). **Model:** cheap (extraction quality gap is small with downstream verification). **Produces the typed graph (Part 4)** — nodes and edges with unbroken provenance to the raw source span in R2. **Infra (already built):** `digest_jobs` + every-minute cron drain + idempotent `runDigestJob`; extend it to emit the full typed graph, not just atomic claims.

## Layer 3 — Output (propose → build → verify → approve → publish)

The flow, as an explicit click-sequence (this is the part most misbuilt before):

1. **The proposer runs automatically** after extraction. It reads the typed graph and outputs specific, well-shaped page suggestions across multiple content types — factual AND interpretive — each with LLM-generated reasoning. (See Part 7.)
1. **The operator sees proposals** as the PRIMARY content of the output surfaces — suggestion cards (title, type, one-line reasoning, **Build →**).
1. **Operator clicks Build →.**
1. **The system drafts the entire page** — body + structured citations — via the generation pipeline. The operator authors NOTHING.
1. **The system shows the verified draft** with verified vs. killed/flagged claims visible.
1. **Operator clicks Publish or Discard** (editing a draft before publish is supported). On Publish, the page renders server-side.

"Manual first" = steps 1–6 with per-item human approval (no auto-publish). It does NOT mean authoring. Automation later = the proposer surfaces a steady queue; the operator still approves. Generation runs on the cheap model in dev; switch to the frontier model near launch (synthesis quality gap is large — this is where frontier cost is justified).

-----

# PART 4 — THE TYPED DATA MODEL (the heart of v2.0)

The graph is NOT "facts connected by what they're about." That flatness was the core defect. Facts have KINDS; links have TYPES. Grounded in established practice (intelligence tradecraft's fact-vs-reporting-vs-assessment separation; OCCRP Aleph / FollowTheMoney typed entities + relationship-entities; W3C PROV-O provenance; Wikidata's statement-rank model; Toulmin / argument-mining claim-vs-evidence).

## Node-kinds (6)

| Node-kind | What it is | Layer |
|-----------|------------|-------|
| **Entity / Actor** | a person, company, org, place, asset that persists | evidence → factual |
| **Attribute** | a stable property — what something IS (founded, owned-by, HQ) | evidence → factual |
| **Event** | a dated occurrence — what HAPPENED (a layoff, a merger) | evidence → factual |
| **Neutral Fact** | a sourced, established, uncontested proposition | evidence → factual |
| **Attributed / Contested Assertion** | what an ACTOR claims (pro/critical/disputed) — NOT asserted true by the system | evidence → interpretive (the hinge) |
| **Source / Document** | the external artifact a fact rests on, with verbatim quote | evidence (plumbing) |

## Edge-families (6) — replacing the single "is-about" link

1. **Aboutness** — `is_about` (fact → subject). Retained, demoted to one family of six.
1. **Relationship** (entity→entity, typed, time-bounded): `owns`, `funded`, `appointed`, `employed_by`, `controls`, `member_of`. Carries start/end date + role (the labeled-property-graph pattern; from Aleph/FtM relationship-entities + LittleSis).
1. **Temporal**: `before`, `after`, `during`, `coincides_with` — orders Events for timelines.
1. **Causal**: `caused`, `contributed_to`, `enabled` — flagged WEAKER/interpretive (causation is usually a judgment).
1. **Evidential**: `supports`, `contradicts`, `corroborates`, `rebuts`, `undercuts` — connect Sources/Facts to Assertions. This is what lets a contested assertion show its evidence and render as GRAY.
1. **Attribution**: `asserted_by` (assertion → actor), `derived_from` (fact → source), `attributed_to` (output → author). Keeps provenance unbroken.

## Contested assertions stored distinctly (the central fix)

An Assertion row carries: `text`, `asserted_by` (→ actor), `stance` (pro/critical/neutral), `rank` (preferred/normal/deprecated/contested), and a computed `evidence_balance` (weighted supports − contradicts). Supporting/contradicting Sources attach via evidential edges. An assertion with weak/conflicting support is shown as CONTESTED — neither hidden nor asserted as fact. (Borrowed directly from Wikidata's rank + "disputed by" mechanism, plus the Admiralty two-axis source-reliability/info-credibility idea.) This is the bridge between the factual and interpretive layers.

## D1 implementation (solo-dev feasible)

- `nodes(id, kind, label, ...)` — `kind` discriminator (single-table inheritance).
- `node_props(node_id, key, value, valid_from, valid_to)` — EAV for attributes/qualifiers.
- `edges(id, src_id, dst_id, type, family, valid_from, valid_to, weight, ...)` — typed edges with properties (edge table = correct relational projection of a property graph; SQLite has no native graph type).
- `sources(id, url, title, retrieved_at, reliability, ...)`, `quotes(id, source_id, verbatim_text, node_id)` — provenance + mandatory verbatim quote.
- `assertions(id, node_id, asserted_by, stance, rank, evidence_balance)`.
- Vectorize = embeddings over fact text / labels for retrieval + entity resolution. R2 = raw source documents.

-----

# PART 5 — THE TWO OUTPUT LAYERS

## The factual layer = ARRANGEMENTS (neutral lenses over stored facts)

Different queries over the same nodes/edges — NOT separately stored. Most graph-derived; each maps to a schema.org type for citability. Build graph-derived first.

| Arrangement | Arranges | schema.org | Derivation |
|-------------|----------|------------|------------|
| Definition / Glossary | one concept; first sentence = the answer | DefinedTerm | graph-derived |
| Timeline | Events about a subject, ordered | Event + ItemList | graph-derived |
| Entity / Actor profile | all attributes + relationships of one entity | Person/Organization | graph-derived |
| Ownership / network map | relationship edges among entities | Organization + OwnershipInfo | graph-derived |
| Who's-who roster | actors filtered by role/relationship | ItemList of Person | graph-derived |
| Comparison matrix | N entities × M attributes | Table/ItemList | graph-derived |
| FAQ / Q&A hub | facts as question→answer pairs | FAQPage/QAPage | graph-derived |
| Statistics roundup | quantitative facts on a topic | Dataset | computational |
| Ledger of flows | payment/funding edges aggregated | Dataset/MonetaryAmount | computational |
| Mechanism explainer | how a process works | HowTo/Article | mixed |
| Document-of-record | a single primary source, verbatim + provenance | CreativeWork/Legislation | graph-derived |
| Claim-and-source table | assertions + attributed actor + supporting/contradicting sources, shown NEUTRALLY | Claim (+ ClaimReview) | graph-derived |

Cross-cutting (GEO/citability practice, Princeton GEO study KDD'24): front-load a direct 1–2 sentence answer (most AI citations come from the top of a page); statistics density and cited sources and verbatim quotations are the top visibility levers; question-shaped headings; correct schema.org JSON-LD; visible `dateModified`; server-rendered, readable with no JS.

## The interpretive layer = INTENTS (signed readings on top of the facts)

Each defined by epistemic stance; each draws on neutral facts (as grounds) and assertions (as the contested material it probes); each SIGNED and carrying CONFIDENCE (per ODNI ICD 203 analytic standards). Factual outputs are unsigned/neutral; interpretive outputs are signed.

| Intent | Stance | Concludes? |
|--------|--------|------------|
| **Investigation** | open skeptical probe — "are they telling the truth? dig for what doesn't add up" | often NOT; may stay open |
| **Argument / Thesis** | closed case — "I'm convinced; here's why you should be" | YES |
| **Pattern** | a recurring structure across instances (e.g. outlets flipping a narrative in sync) | describes; may not assign cause |
| **Hypothesis / Open Question** | a candidate explanation posed for testing | NO — provisional |
| **Assessment / Estimate** | a judgment with explicit confidence | YES, probabilistically |
| **Critique / Rebuttal** | attacks a specific assertion or argument | YES — against a target |
| **Explanation / Synthesis** | makes sense of a body of facts; connects dots | explains; low advocacy |

The Investigation-vs-Argument split is well-grounded: Investigation = abductive inquiry (probe, may not conclude); Argument = inference-to-best-explanation / advocacy (closed, persuades). "Investigations" is the flagship and the kept name.

## The FIREWALL (hard constraint)

An attributed assertion can NEVER be silently rendered as a neutral fact. The factual layer stays neutral; contested material is always shown with its attribution and its supporting/contradicting evidence. This firewall is the system's core integrity guarantee. Violating it (an assertion shown as fact) is a stop-work bug.

-----

# PART 6 — LIVE INQUIRY THREADS (what makes it a living reservoir)

A normal research archive is dead — you file a report, it sits. CANOPTICON must be alive: research deposits not just facts but **open threads** — unfinished directions that persist and resurface. (Example: an investigation finds 3 instances of a media-sync pattern and notes "4 more we could chase"; those 4 must not die in a chat transcript — they land as live threads.)

- An **inquiry thread** is a first-class object: an open question / unfinished direction, attached to the entities/assertions it concerns, with a status (open / being-pursued / resolved-into-an-output / dropped).
- Threads surface in the operator console (Synthesis/Chat) so the inquiry resumes instead of restarting.
- Threads are INPUTS to the proposer (they suggest what to build or research next), never auto-acted-on.
- This is the difference between a filing cabinet and a reservoir: facts + unfinished directions accumulating into an extending terrain.

-----

# PART 7 — THE PROPOSER

**Today (insufficient):** a brittle SQL heuristic (entities with ≥5 claims → a Definition; `candidate` patterns → Comparison/Timeline). Flat reasoning, one type per entity.

**Intended:** an LLM-driven research-assistant suggester that reads the typed graph (and open inquiry threads) and proactively proposes specific, well-shaped outputs across BOTH layers — factual arrangements AND interpretive intents — each with substantive reasoning. Worked example: *5 docs on OSFI capital rules → proposes (a) Definition "What is the DSB?", (b) Timeline "OSFI capital changes 2020–26", (c) Q&A "How does the DSB affect retail mortgages?", (d) Stat-roundup "Canadian bank capital ratios", and (e) an Investigation "Does the DSB's stated rationale hold up?" — each with reasoning.* The proposer's output is the PRIMARY content of the output surfaces; the operator's main act is read proposals → click Build. The proposer is fed by the graph AND by inquiry threads AND (later) by research wrap-up packages (see the stub in Part 18.4) — all as inputs to ONE proposer, never competing proposers.

-----

# PART 8 — THE TRUST MODEL (verbatim verification — non-negotiable)

Already built; never weaken. For every factual statement in a drafted output:

1. **Retrieve** the actual cited source; store fetched text (hashed) for reproducibility.
1. **Verbatim substring check (load-bearing):** the statement's quote must be a literal substring of the fetched source. If not → the claim is KILLED. Kills most hallucinations.
1. **Independent judgment:** a DIFFERENT model (or same model, generation hidden, different framing) judges whether the quote supports the statement. Same-model self-verification is theater and forbidden.
1. **Audit:** store source hash + offsets.

The trust boundary is MECHANICAL verification, not operator vouching — which is exactly why the operator approves rather than authors.

-----

# PART 9 — THE OPERATOR CONSOLE (six surfaces)

Private operator workspace, dark theme (the workshop behind the public site). Philosophy across all surfaces: **upload is authorization; the system does the work; the operator oversees, not manages.** No confirmation gauntlets, no task-queue chores.

1. **Feed** — intake. Drop docs → stored in Storage (no auto-extraction). Activity log of what the system did; below it an infinite-scroll of recently ingested docs (temporal view).
1. **Chat** — one continuous, never-resetting conversational stream to interrogate/command the graph by intent ("what do we have on Brookfield", "find contradictions in the Carney timeline", "what threads are open"). The stream is also the activity log; pairs with a persistent command bar.
1. **Synthesis** — read-only oversight of what the system surfaces: finding cards (pattern, contradiction, connection, thesis-candidate, gap) AND open inquiry threads. The only per-card action is **"Use in Studio →"**. No Watch/Nudge/Dismiss. Silence is valid. Findings use the WEIGHTING MODEL (count distinct investigations not documents; evidence-bearing docs only; distinctiveness not raw counts).
1. **Library** — Storage's front end: the full document archive, grouped by subject/chain, searchable, each with extraction status + Extract button. Where extraction is triggered.
1. **Outputs** (factual + interpretive) — the proposer's suggestion cards are the PRIMARY content (Part 7), each with Build →. Clicking Build runs draft+verify; operator approves/discards. NO hand-authoring composer as the primary surface (niche fallback only). (This surface presents both the factual-layer pages and the Investigations; they may be two tabs/sections of one surface or two surfaces — design choice — but both are proposer-driven, not hand-authored.)
1. **Studio** — turn findings/outputs into distributed content. Lock a **reasoning skeleton** (the operator's argument STRUCTURE/order — NOT voice), then generate in any medium (X post, thread, TikTok/video-essay script, podcast segment) following the locked structure, expanded/compressed per medium. Build Stage 1 = reasoning lock + script generation first; audio/video/export are additive later stages — do not block launch on them.

-----

# PART 10 — HARD CONSTRAINTS (never violate)

1. **Automated, hands-off — operator approves, never authors.** (Prime directive.)
1. **The output is the product; the typed graph is the substrate; raw claims are plumbing.**
1. **Three independently-triggered layers.** Upload never auto-fires extraction; extraction never auto-fires publish.
1. **Verbatim verification is mandatory and mechanical** — literal substring of a real fetched source, independently judged, killed on failure.
1. **The fact/interpretation FIREWALL** — an attributed assertion is never silently rendered as a neutral fact.
1. **No self-citing / no citogenesis** — evidence always points to an EXTERNAL source. Build-time invariant: fail if any `derived_from`/`evidenced_by` URL is internal.
1. **No auto-publish** — a human approves every published output.
1. **Server-rendered, citable HTML** — every public page fully readable with no JavaScript.
1. **Neutral facts vs signed interpretation kept distinct** — factual layer unsigned/neutral; interpretive layer signed and confidence-tagged. No verdict words in factual content.
1. **The weighting model governs Synthesis counts** — distinct investigations (chains collapse via `investigation_id`), evidence-bearing docs only, distinctiveness not raw counts.
1. **Tiered model use** — cheap model for high-volume extraction; frontier model for generation near launch; result-caching so re-extraction doesn't re-bill unchanged docs.

-----

# PART 11 — NON-GOALS (explicitly do NOT build)

1. **Do NOT build a hand-authoring composer as the primary output surface.** The operator approves system-drafted outputs; it does not write bodies or type citations as the main flow. (Built once by mistake; inverted the product. Hidden niche fallback only, never primary.)
1. **Do NOT auto-publish anything.**
1. **Do NOT auto-fire extraction on upload.**
1. **Do NOT treat raw claims as an end-user product surface.**
1. **Do NOT use same-model self-verification.**
1. **Do NOT show raw mention counts in Synthesis** — use the weighting model.
1. **Do NOT render an attributed assertion as a neutral fact** (the firewall).
1. **Do NOT rebuild working primitives** — the generation pipeline, the verify pipeline, the digest infra, Storage, the server-rendered page renderer, the content-type templates all exist; extend, don't replace.
1. **Do NOT capture "voice" in Studio** — lock argument structure, not personality.
1. **Do NOT require JavaScript to read any public page.**
1. **Do NOT use the word "Briefs"** — use the factual-layer / interpretive-layer split.

-----

# PART 12 — WHAT EXISTS / WHAT CHANGES / WHAT TO KEEP

**Exists & works — KEEP and extend:** the auto-generate pipeline (draft → fetch → verbatim-check → independent judge → persist); the server-rendered citable page renderer with schema.org JSON-LD; durable extraction infra (`digest_jobs` + cron + idempotent job); Storage (`pieces`/`sources`/`uploaded_files` + R2 + content-hash dedup); content-type templates; grounding query (Vectorize + SQL); the six console surfaces (built in design); the public site (Worker-from-D1).

**Exists but WRONG — fix:** any hand-authoring composer that is the primary output surface → demote/remove; make the proposer's suggestions primary. The dumb SQL proposer → upgrade to LLM-driven (Part 7).

**Missing — BUILD:** the full TYPED data model (6 node-kinds incl. contested assertions, 6 edge-families) — today extraction emits only flat atomic claims; this is the biggest build. Inquiry threads (Part 6). The interpretive intents as first-class signed outputs (today only thin "thesis" exists). The fact/interpretation firewall in rendering. Edit-a-draft-before-publish. Switch generation to the frontier model near launch. Citation tracker (later).

**Correctly done already (post-pivot):** decoupled ingest (upload no longer auto-extracts); content-hash dedup; idempotent extract.

-----

# PART 13 — OPEN SLOTS (decide later; do not block on these)

1. **The factual layer's proud public NAME.** Defined here by function ("the citable factual substrate" / bedrock). The operator rejected posture-implying names (Record/Ledger/Archive felt framed) because the layer must feel author-less — its neutrality is the point, since citability depends on it. Name it when it clicks; until then, "the factual layer" is the working term. Do not force a name into the build.
1. **Whether the factual layer and Investigations are two console surfaces or two sections of one.** Design choice; both are proposer-driven regardless.

-----

# PART 14 — BUILD SEQUENCE

1. **Build the typed data model** (6 node-kinds incl. contested assertions, 6 edge-families, provenance, the `assertions` table). This is the foundation; everything else sits on it. Extend extraction to emit it.
1. **Fix the output surface direction** — proposer suggestions primary; demote/remove any hand-authoring composer.
1. **Upgrade the proposer** to LLM-driven, proposing across both layers, fed by graph + inquiry threads.
1. **Ship graph-derived factual arrangements first** (Definition, Timeline, Entity/Ownership Profile, Who's-who, Claim-and-source) — server-rendered with schema.org, GEO triggers applied.
1. **Ship the interpretive intents** — Investigation and Argument first, then the rest; signed, confidence-tagged; firewall enforced.
1. **Inquiry threads** — model open threads; surface in Synthesis/Chat; feed the proposer.
1. **Edit-a-draft-before-publish.**
1. **Computational arrangements** (Stats, Ledger).
1. **Switch generation to the frontier model near launch; add result-caching.**
1. **Citation tracker.**
1. **Studio Stage 1** (reasoning lock + script gen), then later media stages.

Stay on the cheap model until near launch; reserve the frontier model for generation.

-----

# PART 15 — STACK & ENVIRONMENT

Single Cloudflare Worker serves public `/*` + operator `/op/*` + API `/v1/*`. D1 (SQLite) = source of truth (nodes, node_props, edges, sources, quotes, assertions, inquiry_threads, outputs, digest_jobs, uploaded_files). R2 = raw documents + fetched-source text (hashed). Vectorize = embeddings for retrieval + entity resolution + subject clustering. Models per Part 16 (tiered Cloudflare-hosted lineup; paid frontier API as optional top tier near launch only). Public site server-rendered from D1; no JS required to read.

*Note on technology specifics: this spec names MODEL ROLES ("the cheap extraction model," "the frontier generation model," "the independent-judge model"), not specific products/versions, because the codebase owns those choices and may have changed them. Use whatever the codebase currently uses for each role; do not let this spec override a tech decision made in the codebase.*

-----

-----

# PART 16 — MODEL STRATEGY (updated: Llama retired as default)

**The decision:** the old default — Llama 3.3 70B as the cheap baseline — is RETIRED. The reasoning that kept selecting it ("extraction is cheap, so use the cheapest model") was valid only while cost was the binding constraint. It no longer is: on Cloudflare Workers AI's neuron-billed catalog, substantially stronger open models cost the same or LESS than Llama 3.3 70B (which is actually one of the most expensive on output). Within the cheap Cloudflare tier, optimize for BEST QUALITY, not lowest cost — the absolute dollar differences are trivial.

**The tiered lineup (current recommendations as of this writing — VERIFY against the live Workers AI catalog and pricing before committing; the catalog churns and models get deprecated on short notice; if a newer/stronger model has appeared in the same cheap tier, prefer it under the same logic):**

| Pipeline stage | Model (current pick) | Why |
|----------------|----------------------|-----|
| Bulk extraction (entities, attributes, events, neutral facts) | **Gemma 4 26B A4B** (or gpt-oss-20b low effort) | cheapest strong model; JSON mode; high volume |
| Hard extraction (assertions, stance, typed relations, evidential links) | **gpt-oss-120b, medium reasoning effort** | large quality jump where it matters; cheaper on output than Llama 70B |
| Surfacing intelligence — ambitious tier (pattern discovery, assessments) | **gpt-oss-120b, high reasoning effort** | adjustable-effort reasoning model; one backbone, dialed up |
| Very-large-context graph reasoning (fallback) | **Nemotron 3 Super 120B** | 1M-token window; cap max_tokens (verbose) |
| Independent verification judge | a DIFFERENT model than the generator (any capable model not the producer) | same-model self-verification is forbidden |
| Optional top tier (near launch only, never during development) | paid frontier API (e.g. Claude) via AI Gateway | hardest adjudications + final generation quality |

**Rules:**

1. **Reasoning effort is a dial, not a default.** High reasoning effort HURTS high-volume extraction (5–8× cost/latency, can break structural fidelity). Bulk extraction runs on non-reasoning/low-effort; high effort is reserved for the surfacing engine's ambitious tier.
1. **One inference abstraction.** Wrap all model calls in a single routing layer (model string + effort per stage; OpenAI-compatible endpoint, optionally fronted by AI Gateway) so any single stage can later be pointed at a frontier API by changing base URL + key — no rearchitecting.
1. **Paid frontier APIs are top-tier-only and OPTIONAL** — never used during development; wired in near launch, behind the same interface, for the hardest reasoning and final generation only.
1. **The codebase owns specifics.** These model names are the current recommended choices, not commandments. If the codebase has already adopted a different model for a role (or the catalog has changed), the ROLE definition here governs, not the name.

-----

# PART 17 — THE SURFACING INTELLIGENCE ENGINE

**What it is:** the system's analytical mind — the engine that surfaces MEANING from the typed graph (contradictions, contested gray-area assertions, non-obvious connections, structural patterns, gaps, open threads) instead of counting repetitions. Naive frequency promotion ("appears 5 times → promote") is explicitly REJECTED as not smart enough: a pattern that matters may appear twice; a trivial thing may appear fifty times. Meaning lives in structure and stance, not frequency. This engine is the novel core of CANOPTICON and is a mirror of the operator's own analytical practice — it must be able to both VALIDATE and CHALLENGE the operator's hunches.

## Two-level architecture (the line = computation vs. judgment)

**Level 1 — Deterministic tier (cheap, reliable, runs on every ingest, incremental).** Mechanical, verifiable operations only — no LLM judgment calls:

- **Contradiction candidates:** when a new assertion lands, fetch assertions about the same target (graph adjacency + Vectorize semantic neighbors) and run an entailment/contradiction check → contradiction-candidate edges.
- **Connection detection:** SQL graph queries for new short paths / common neighbors; embedding proximity for latent connections not yet edged.
- **Evidence-balance computation:** per assertion, aggregate supporting vs. contradicting evidential edges (weighted by source reliability + confidence) → balance score; both-sides-nontrivial → "contested" flag (the gray area, shown AS gray).
- **Thread tracking:** open-question nodes; recompute balance/recency when neighbors change; resurface on new evidence or persistent non-resolution.
- **Lightweight anomaly signals:** degree spikes, new bridges between previously-separate communities, synchronized stance-changes within a time window.

**Level 2 — Ambitious tier (frontier-reasoning, runs rarely/deliberately, output = CANDIDATE insight).**

- **Pattern discovery:** the system deterministically assembles a VERIFIED subgraph, then the high-effort reasoning model proposes patterns a human did not flag — genuine discovery, explicitly instructed toward novel structure.
- **Assessment with calibrated confidence:** ACH-style — enumerate competing hypotheses, score evidence against ALL of them (seeking disconfirmation), output likelihood + confidence with the information-vs-judgment separation (ICD-203 discipline).
- **Mandatory verification:** every entity/edge/count the model cites is checked against the graph before the insight is shown; unverifiable claims are DISCARDED. LLMs hallucinate graph structure at very high rates when unconstrained — the LLM never traverses or counts the graph itself; deterministic engines retrieve/aggregate, the LLM only interprets verified subgraphs.

## Incrementality (the cost answer)

New input does NOT recompute the whole graph. Extraction touches only the new document. Surfacing re-checks only the AFFECTED NEIGHBORHOOD: graph-adjacent nodes (1–2 hops) + semantically adjacent nodes (Vectorize topK). Maintain prior findings as state; propagate only deltas. If per-ingest surfacing time grows with corpus size, neighborhood bounding is broken — that is a bug.

## Anti-confirmation-bias defenses (required, since the engine mirrors the operator's views)

1. Every finding carries likelihood + confidence and visibly separates underlying information from the system's judgment. Prefer agreement-based confidence (k-run consistency) over the model's verbalized confidence (LLMs are over-confident).
1. Minimum evidential basis before promoting any finding (e.g. ≥2 independent sources, or a quantified deviation from baseline) — no false significance.
1. For any hunch the operator marks as believed, the system surfaces the strongest DISCONFIRMING evidence by default. Competing hypotheses are always present. A source-diversity check flags "patterns" supported only by sources the operator already favors.
1. Findings rank by evidential strength + unexpectedness + relevance (serendipity model), showing the few highest-value items — not everything.

## Surfacing into the console

Findings appear as cards in Synthesis: contradiction · contested-assertion/gray-area · connection · pattern (candidate, from Level 2) · gap · open-thread. Cards carry confidence, provenance spans, and the information/judgment separation. Operator actions feed back into ranking thresholds. Extraction quality sets this engine's ceiling: no stance edges → no synchronized-narrative patterns; no evidential polarity → no gray areas. Advanced extraction (Part 16 routing) is therefore a hard dependency, not a nicety.

-----

-----

# PART 18 — THE PUBLIC SITE (structure under the new model)

The public site is the system's output made visible. It replaces the old five-destination nav (Topics · Investigations · The Record · Patterns · Library). "The Record" and "Patterns" are DISSOLVED as nav destinations under the new model.

## 18.1 The nav (lean)

- **Investigations** — the branded, signed, front-door experience. ALL interpretive pieces live here, across all seven intents.
- **Topics** — entity hubs; the one browsable doorway into the factual substrate ("look something up").
- **Library** — the public window into source documents (the receipts).
- **About / Methodology** — how the system works and why it's trustworthy.

## 18.2 Intents are badges and filters, NOT nav

Readers don't navigate by epistemic stance. Inside Investigations: a filter row (All · Investigations · Arguments · Patterns · Assessments · …). Every piece wears its intent as a typed, clickable badge; clicking a badge opens the filtered view. So everything is findable by click — "show me all Patterns" is one tap — without taxonomy-as-navigation. The intent also shapes the piece's presentation (an Investigation shows open questions; an Assessment shows its confidence band).

## 18.3 The factual substrate is UNMARKED ground

Entity pages, timelines, definitions, claim-and-source tables, ownership maps are NOT gathered under a proud nav label. They are reached by: links from Investigations (every interpretive piece links down into the facts it stands on), search, external citation, and the Topics doorway. Heavily interlinked, server-rendered, citable, everywhere — named nothing. The reader lands ON the facts because something pointed there; they don't "go to the Record." (The factual layer's proud name remains an open slot — Part 13 — and may stay deliberately absent; its neutrality is the brand.)

## 18.4 The Library and source documents — PUBLIC BY DEFAULT

The operator's research reports (and other documents in Storage) are published in the Library by default: indexable, searchable, citable, each with a stable URL — they are part of the content as well as sources. A per-document private flag exists for working material the operator withholds. Raw uploads are NEVER published as anything other than what they are (a source document in the Library); everything else public passed through the graph and the approval gate.

**Research wrap-up packages (stub):** a planned ingestion input — at the end of a research chat the operator triggers a structured package (intent/angle, key findings ranked by confidence with verbatim quotes, informal conclusions, OPEN THREADS, entities/cast, candidate output angles) uploaded alongside the report. Packages are treated as INPUT to the proposer and to inquiry-thread creation — never as a competing second proposer. The package format is specced separately; the system should anticipate this input type.

## 18.5 What appears where (the provenance rule)

- Investigations section → system-generated, operator-approved, SIGNED interpretive pieces (badged by intent)
- Topics + the unmarked substrate → system-generated neutral factual pages from the graph
- Library → the source documents themselves (public per flag)
- Nothing public is a raw upload published as-is, except the Library's source documents shown AS source documents.

-----

# PART 19 — MIGRATION / TRANSITION (what happens to what already exists)

The typed data model (Part 4) replaces a built system with FLAT atomic claims and an OLD public nav. The rules:

1. **Storage's raw documents are the durable asset.** Nothing about the pivot touches them. They are already stored, hashed, deduped.
1. **Old flat claims are SUPERSEDED, not migrated.** Do not hand-migrate or transform old claim rows into the typed model. When the typed extraction lands, RE-EXTRACT from the stored raw documents (extraction is idempotent and cheap; the docs are all in R2). Old claim data may be kept read-only for reference during transition, then retired. No data archaeology.
1. **Old public pages are REGENERATED, not edited.** Pages built from the flat model (old Record pages, old Patterns pages, topic hubs) are regenerated from the new typed graph once re-extraction has run. Preserve URLs where the page concept survives (entity pages, investigations); redirect where a destination dissolved (e.g. old "Patterns" index → Investigations filtered to Pattern).
1. **The operator console surfaces survive** (Part 9); their data wiring moves to the typed graph. The Outputs surface replaces any Briefs-era surface; any hand-authoring composer is demoted per Part 11.
1. **Nothing is auto-deleted.** Supersede, regenerate, redirect — destruction only by explicit operator decision.

## 19.6 Legacy corpus onboarding (the existing ~60 research reports)

The operator's backlog of existing research reports has NO wrap-up packages (the originating chats are scattered/gone). Rules:

- **Packages are an enrichment, NEVER a requirement.** Report-only documents are first-class input. Bank all legacy reports into Storage immediately (no processing fires); extract in batches, idempotent, like any other document.
- What's lost without packages (explicit intent, open threads) is partially recovered by the surfacing engine itself — cross-report connections, contradictions, and clusters emerge mechanically from extraction across the corpus.
- **Retro-packaging is optional and operator-driven:** for high-value reports, the operator may generate a wrap-up package after the fact in a fresh chat and upload it alongside; the system attaches it to the existing document.

## 19.7 Essays and other interpretive drafts (including unfinished ones)

The operator has pre-system essays (often ~80% complete) synthesized from research. Rules:

- An essay is INTERPRETIVE source material. It enters Storage (typically private-flagged as working material). Extraction harvests it primarily as ATTRIBUTED ASSERTIONS — the operator's thesis, readings, and claims, stance-tagged, attributed to the operator, linked to underlying facts. The firewall holds: the essay's argument never becomes a neutral fact.
- The proposer, seeing a thesis with substantial grounding in the graph, proposes the corresponding Argument/Investigation piece. The operator clicks Build; the system REGENERATES the piece fresh (through verification and the locked reasoning skeleton); the operator edits and publishes.
- **There is NO direct-import-to-publish path for essays.** A nearly-finished essay is never pushed into review/publish as-is — that is the hand-authoring side door (Part 11 #1) in another costume. One pipeline: Storage → graph → proposer → regenerate → approve. Anything beloved from the original prose is restored at the edit-before-publish step.

-----

# PART 20 — ACCEPTANCE TEST (the CTV scenario — the build is correct when this flows)

A real end-to-end scenario from the operator's actual research. Use it as the definition of done for the core pipeline.

**Input:** one research report: ~5 documented, dated instances of a media reframe pattern (criticism of one political figure redirected by panelists onto another), some CTV/Bell background, an opened-but-unpursued thread on one panelist's background (an op-ed author), and the operator's framing ("panelists synchronized, same language, same window").

**Expected flow:**

1. **Upload** → Storage: stored, hashed, public-flagged → appears in Library with stable URL. NOTHING else fires.
1. **Operator clicks Extract** → typed graph receives: entities (CTV, Bell, the political figures, each panelist, the op-ed author); 5 dated reframe EVENTS with verbatim spans; neutral facts (ownership/structure); attributed ASSERTIONS per panelist (stance-tagged, time-stamped); and an INQUIRY THREAD: "[panelist] background — opened, not pursued."
1. **Deterministic surfacing fires automatically:** synchronized stance-change detector → finding card "Synchronized reframe: 5 instances, N speakers, X-day window, same target." Open-thread card appears.
1. **The proposer suggests** (cards in Outputs): factual — Timeline of the instances; Entity profile (CTV/Bell); Claim-and-source table (who said what, when, verbatim). Interpretive — a Pattern piece drafted from the 5 instances; plus a prompt: "open thread unpursued — research before drafting?"
1. **Operator clicks Build on the Pattern** → system drafts (instances, verbatim quotes, timing) → every quote verbatim-verified against fetched sources; unverifiable claims killed and shown struck-through → operator reviews/edits → Publish.
1. **Result:** a signed Pattern piece in Investigations (badged PATTERN), linking down into the simultaneously-published unmarked factual pages (timeline, claim table, profile). The source report is citable in the Library. The open thread persists; a later ingestion about the op-ed author ATTACHES to it and proposes an UPDATE to the published Pattern.

**Pass criteria:** every step occurs in that order with no operator authoring; the only operator acts are Upload, Extract, Build, Publish; the firewall holds (panelist assertions never render as neutral facts); provenance is unbroken end to end.

-----

*End of canonical spec v2.4. Hand this WHOLE document to the code side; never hand deltas without it. When something is ambiguous, the prime directive (Part 0), the Glossary (Part 1), and the firewall (Part 5) decide it: the system is automated and hands-off; the operator approves, never authors; neutral facts and signed interpretation stay distinct; an assertion is never silently a fact.*
