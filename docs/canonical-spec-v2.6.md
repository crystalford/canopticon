# CANOPTICON — Canonical Specification v2.6 (Source of Truth)

**Version 2.6 · Supersedes ALL prior versions including the v2.5 chat draft. This is the only document that matters. Read it top to bottom before building anything.**

**The headline reframe:** canopticon is a **rendering system**, not a generation system. The graph is the truth. Pages are renderings. URLs are rendering identities. Every projection of the graph — a timeline, a thread, a video script, a meme — is a re-arrangement of the same underlying facts, not a new generation. The only places where generation legitimately happens are (a) extracting graph data from raw documents and (b) writing the signed reading body itself. Everything else is rendering.

**What changed since v2.5:**

- Part 3 RENDERING SYSTEM: new — the conceptual core. The rule: if a face can be a template + query, it is. LLM seasoning only where argumentative sequencing genuinely needs it. Every face renders in under 100ms once data is in place.
- Part 6 ARRANGEMENTS: every arrangement type also gets its own addressable URL (`/timeline/:slug`, `/network/:slug`, `/stats/:slug`, etc.) with its own JSON-LD. The subject page composes from these arrangements; the arrangements are also citable as standalone pages.
- Part 8 FACES: faces are renderings of signed readings, not regenerations. A face that can be template + query is template + query. Only faces that need argumentative sequencing get one writer-LLM call (during draft, persisted, rendered instantly thereafter).
- Part 11 TRUST GAUNTLET: now correctly describes the verbatim + firewall + judge gauntlet on the drafter (was unimplemented in v2.5; now real in code as of the v2.6 build).
- Part 12 ONE SITE, ONE PAGE: corrects v2.5 Part 9. There is no separate operator home and no "stream" surface. The operator browses the public site; logged-in affordances overlay onto the same pages every reader sees. The IN/OUT framing — and "OUT as a dashboard" — is fully retired in this version, not just in spirit.
- Part 27 STUDIO: reframed from "destination dies" (v2.5 Part 24's claim) to "production pipeline lives." Studio is not where you generate content. It's where you assemble it — record voice chunks, stitch audio, match visuals, manage voice profile. Generation happens upstream (faces render automatically); Studio is the finishing room.

-----

# PART 0 — READ THIS FIRST: WHAT CANOPTICON IS

CANOPTICON is a **forensic intelligence publication system**. A single operator feeds it research documents. The system grows a verified, citable body of public reference pages and signed investigations from that research — and produces raw material for distributed content (social posts, scripts, video essays).

It is not a CMS. It is not a wiki. It is not a note-taking app. The closest analogy: an automated, citation-grade reference publication where structured graph data fans out into every format the publication needs to ship, with the operator as editor-in-chief approving what goes live.

**The one-sentence product:** operator drops research → system extracts a typed graph of facts → system grows citable pages (Records · timelines · networks · stats) from the graph → system drafts signed Investigations on top → operator approves → every published thing is automatically available in every face (thread, script, meme, chapter, video) — selection, not generation.

## The prime directive

**CANOPTICON IS AUTOMATED AND HANDS-OFF. THE OPERATOR APPROVES, NEVER AUTHORS.**

The system reads, notices, drafts, verifies. The operator clicks Approve or Discard. The operator should almost never type a page body or a citation by hand. If any design decision pushes writing onto the operator, that design has drifted.

-----

# PART 1 — GLOSSARY (binding — read before any other section)

These words are load-bearing. Misreading one can invert the system.

- **"Rendering"** — turning graph data into a viewable / shareable surface. Templates + queries + light formatting. Fast (<100ms), no LLM, no per-view generation. Most of canopticon is rendering.
- **"Generation"** — producing new text via LLM. Only two places this happens legitimately: extraction (raw document → typed graph nodes) and the writing of a signed reading body (the argument synthesis). Everywhere else, "generation" is a smell — it usually means a rendering was misdesigned as a generation.
- **"Record"** — the canonical term for a subject or theme page in its neutral mode. A Record is the citable, neutral, sourced account of what IS about a subject. The Carney record, the Bell Media record, the Sharon Kaur record. It accumulates, it deepens, it never closes. DO NOT call these pages "wiki pages" — the word "wiki" triggers MediaWiki thinking and has caused drift before. DO NOT call them "profiles" (too shallow) or "dossiers" (implies prosecution).
- **"Arrangement"** — a content type that projects the graph in a specific shape: Timeline, Network, Stats, FAQ, Comparison, Ledger, Document-of-record, Claim-and-source table, Mechanism explainer, Who's-who roster, Definition, Entity profile. Each arrangement is BOTH a section that can be embedded inside a Record AND a standalone addressable page with its own URL and JSON-LD.
- **"Investigation"** — a signed, interpretive piece. The operator's reading laid over the facts. Badged by intent (Investigation, Argument, Pattern, Hypothesis, Assessment, Critique, Explanation). This is the flagship signed product.
- **"Face"** — one format of any published thing. Thread, video script, meme, chapter outline (today) — TikTok script, voiceover, animation, more (later). Faces are renderings, not regenerations. The truth claims live on the source (signed reading, Record, timeline); the face re-arranges. See Part 8.
- **"Studio"** — NOT a generation destination. The production room where rendered content meets operator voice meets visuals meets export. See Part 27.
- **"Briefs"** — DEPRECATED. Never use. The factual layer is Arrangements; the interpretive layer is Investigations. There is no separate Briefs surface.
- **"Wiki"** — DO NOT USE. Use Record.
- **"OUT" / "the stream"** — RETIRED. There is no separate operator home. The operator browses the public site. Logged-in affordances overlay on the same pages every reader sees. See Part 12.
- **"Fact" vs "Assertion"** — a FACT is neutral, sourced, established. An ASSERTION is what someone CLAIMS — stored distinctly, never silently treated as fact. The hinge.
- **"Storage"** — where raw uploaded documents live (R2 + D1 metadata). The Library is its public view. Not a content type.
- **"Extraction"** — reading a stored document and producing typed graph nodes/edges. Triggered manually, never automatically on upload. This is the only slow operation in the system; everything downstream is rendering and should be instant.
- **"Verbatim verification"** — the trust mechanism. Every published claim's quote must be a literal substring of a real fetched source. Failures are killed and shown.
- **"The trust gauntlet"** — three checks in order: verbatim substring (mechanical) → firewall (an attributed assertion is never silently a neutral fact) → independent judge (a different model family than the writer answers "does the quote actually support the claim?"). See Part 11.
- **"Compose" / "Generate"** — AVOID in UI/code. Both imply hand-authoring or new-text-generation as a primary action. Faces render. Pages render. Readings are drafted by the system, not by the operator.
- **"Inquiry thread"** — a first-class open question or unfinished direction that persists in the system until resolved.

-----

# PART 2 — THE CORE ARCHITECTURE

Three decoupled processing layers. Each is independently triggered — NOT one automatic chain.

```
STORAGE      upload → stored, hashed, deduped, auto-tagged. NOTHING ELSE FIRES.
                  ↓  (operator clicks Extract)
EXTRACTION   stored doc → typed graph (nodes + edges + provenance). Idempotent.
                  ↓  (proposer reads the graph automatically)
RENDERING    graph → every arrangement, every Record, every Investigation, every face.
             Templates + queries + (rare) one LLM call per reading.
             Operator approves signed readings; approval is the only gate.
```

Maps to medallion: Storage = bronze, Extraction = silver, Rendering = gold.

The previous spec called the third layer "Output" and treated each piece as a generated thing. v2.6 renames it RENDERING because that's what it actually is. Generation is constrained to two places (extraction; the writing of signed reading bodies). The rest is queries against the typed graph rendered through templates.

**Two layers within Rendering:**

- **The factual layer** — Records (the neutral reference pages) composed from Arrangements (timeline, network, stats, etc.). All renderings of graph data.
- **The interpretive layer** — Investigations (signed readings with intent badges, confidence bands, complicating-facts box). The reading body is the one piece of generation; everything that wraps it (the page chrome, the timeline section, the faces) is rendering.

-----

# PART 3 — THE RENDERING SYSTEM (the conceptual core)

This is the part of the spec that didn't exist before and that the rest now depends on. Read it carefully.

## The rule

**If a face can be a template + a query, it is a template + a query. The LLM is the seasoning, not the meal.**

Examples:

- **A meme** = thesis line + the single highest-evidence-balance fact + receipt URL. Template + query. No LLM at render time.
- **A 4-post thread** = thesis + the four highest-rank quotes about the subject, sorted by relevance. Template + query. No LLM at render time.
- **A timeline** = `SELECT events WHERE subject = X ORDER BY date`. Template + query.
- **A network map** = graph traversal of relationship edges from the subject. Template + query.
- **A stats roundup** = `SELECT numeric facts WHERE subject = X`. Template + query.
- **A document-of-record page** = the raw source rendered with provenance overlay. Template + query.
- **A claim-and-source table** = `SELECT assertions WHERE about(subject) WITH attribution`. Template + query.

Where LLM seasoning genuinely earns its place:

- **The signed reading body itself** (the argument synthesis). This is generation; it happens once per reading; it's persisted as `body_md` and rendered thereafter as a static string.
- **The video essay script** (because argument sequencing matters). One LLM call when the reading is signed; persisted as a face; rendered instantly thereafter.
- **The chapter outline** (because structure of long-form needs sequencing). One LLM call on sign; persisted; rendered.

What does NOT need LLM seasoning even though earlier versions of canopticon used it:

- A meme caption. (Pick the highest-balance fact; lay it out. No LLM.)
- A thread. (Top N quotes by relevance, sorted. No LLM.)
- A stat-roundup-as-TikTok-script. (Numbers + template. No LLM.)
- An FAQ page. (Q-shaped facts queried and laid out. No LLM.)

## Why this matters

Every face that's template + query renders in under 100ms because it's just SQL + HTML. Every face that needs an LLM is generated ONCE (on sign) and stored, so subsequent views are also instant.

**Result:** the publication never says "generating your TikTok script…". A reader (or the operator) clicks "TikTok script of Mark Carney's timeline" and the page renders. The graph already holds the data; the template knows the shape; the rendering is a query.

## The split nobody named before

- **The argument** is generated. (Writing the signed reading body, ~once.)
- **Every face of that argument** is rendered. (Templates + queries against the persisted body + the graph.)

Before v2.6, faces were regenerated by the writer LLM on signing — ~30-60 seconds per face × 4 faces. That's the regression v2.6 fixes structurally.

## Implications for the build

- New folder: `packages/api/src/public/render/arrangements/` — one renderer per arrangement type. Each is a function that takes (env, subject_slug) and returns HTML.
- New folder: `packages/api/src/public/render/faces/` — one renderer per face kind. Most are pure template + query; the few that need LLM seasoning have a build step that persists their `body_md` on sign and a render step that reads it.
- The `page_faces` table stays. For LLM-seasoned faces (video script, chapter outline), the body_md is persisted on sign and rendered thereafter. For template + query faces (thread, meme, stat-TikTok), there's no persistence — the render IS the query.

-----

# PART 4 — THE THREE PROCESSING LAYERS

## Layer 1 — Storage

**Trigger:** upload. Stores raw doc in R2; SHA-256 content hash (dedup — identical hash = "Already in Storage"); metadata to D1 (filename, hash, subject auto-tags, date, status=`stored`); one doc-level embedding → Vectorize for subject clustering. Does NOT extract, build pages, or call any expensive model.

## Layer 2 — Extraction

**Trigger:** operator click or batch job. NEVER on upload. **Idempotent:** content-hash keyed — re-running an unchanged document costs nothing (zero LLM calls). Must be CONCURRENT not sequential — see Part 25 for the required architecture.

**Produces the typed graph** (Part 5) — nodes and edges with unbroken provenance to raw source spans in R2.

**This is the only slow operation in the system.** Everything downstream is rendering and should be instant.

## Layer 3 — Rendering

The graph fans out into every projection canopticon publishes. Pages, arrangements, Investigations, faces.

1. The proposer runs automatically after extraction, reads the graph, outputs specific suggestions for which Investigations would be worth signing.
2. Operator sees proposals on `/` (logged in) — each with a "Build →" affordance.
3. Operator clicks Build →.
4. System drafts the signed reading body (one LLM call — the argument synthesis). Persists.
5. Trust gauntlet runs on the draft (verbatim + firewall + judge). Failed claims killed and shown.
6. Faces queue automatically — LLM-seasoned faces generate once and persist; template + query faces don't need persistence at all.
7. Operator clicks Sign & Publish.
8. Every face of the signed reading is now instantly available on the signed page; every standalone arrangement URL exists; the Record updates to include the signed reading band.

-----

# PART 5 — THE TYPED DATA MODEL

The graph is NOT "facts connected by what they're about." That flatness produced a junk drawer. Facts have KINDS; links have TYPES.

## Seven node-kinds

| Node-kind | What it is |
|---|---|
| **Entity / Actor** | a person, company, org, place, asset that persists |
| **Attribute** | a stable property — what something IS |
| **Event** | a dated occurrence — what HAPPENED |
| **Neutral Fact** | a sourced, established, uncontested proposition |
| **Attributed / Contested Assertion** | what an ACTOR claims — NOT asserted true by the system. THE HINGE between factual and interpretive layers. |
| **Source / Document** | the external artifact a fact rests on, with verbatim quote |
| **Theme** | a received account the corpus engages with. Surfaced when 3+ documents converge on contradicting the same proposition. The system NAMES it; convergence creates it. |

## Six edge-families

1. **Aboutness** — `is_about`
2. **Relationship** (typed, time-bounded): `owns`, `funded`, `appointed`, `employed_by`, `controls`, `member_of`
3. **Temporal**: `before`, `after`, `during`, `coincides_with`
4. **Causal**: `caused`, `contributed_to` — flagged as interpretive/weaker
5. **Evidential**: `supports`, `contradicts`, `corroborates`, `rebuts` — connects Sources to Assertions; makes gray areas visible
6. **Attribution**: `asserted_by`, `derived_from`, `attributed_to` — keeps provenance unbroken

## Contested assertions (the central fix)

An assertion row carries: `text`, `asserted_by` (→ actor), `stance` (pro/critical/neutral), `rank` (preferred/normal/deprecated/contested), `evidence_balance` (weighted supports − contradicts). An assertion with conflicting evidence is shown as CONTESTED — neither hidden nor asserted as fact. Gray shown as gray.

## D1 schema

- `nodes(id, kind, label, ...)` — kind ∈ the seven above
- `node_props(node_id, key, value, valid_from, valid_to)`
- `edges(id, src_id, dst_id, type, family, valid_from, valid_to, weight, ...)`
- `quotes(id, source_id, node_id, verbatim_text, byte_offset, byte_length)`
- `assertions(id, node_id, asserted_by, stance, rank, evidence_balance)`
- `pages(id, subject_node_id, slug, thesis, intent, body_md, body_html, signed_status, signed_by, signed_at, confidence, claims_verified, claims_killed, ...)`
- `page_claims(page_id, claim_text, quote_id, kind, asserted_by, judge_pass, judge_notes, sort_order)` — the receipt trail
- `page_faces(page_id, kind, body_md, body_html, status, generate_model, error)` — only for LLM-seasoned faces
- `themes(node_id, received_account, convergence_count, evidence_quote_ids)`
- `inquiry_threads(id, question, status, related_node_ids, ...)`
- Vectorize = embeddings for retrieval + entity resolution. R2 = raw documents.

-----

# PART 6 — ARRANGEMENTS AS STANDALONE RENDERINGS

Every arrangement type is BOTH a section embedded inside a Record AND a standalone addressable page with its own URL and JSON-LD.

## The twelve arrangements + their URLs

| Arrangement | URL | schema.org | Derivation |
|---|---|---|---|
| Definition / Glossary | `/d/:slug` | DefinedTerm | graph-derived |
| Timeline | `/t/:slug` | ItemList + Event | graph-derived |
| Entity / Actor profile | `/p/:slug` | Person / Organization | graph-derived |
| Ownership / network map | `/n/:slug` | OwnershipInfo | graph-derived |
| Who's-who roster | `/w/:slug` | ItemList of Person | graph-derived |
| Comparison matrix | `/c/:slug` | Table + ClaimReview | graph-derived |
| FAQ / Q&A hub | `/f/:slug` | FAQPage | graph-derived |
| Statistics roundup | `/stat/:slug` | Dataset | computational |
| Ledger of flows | `/l/:slug` | Dataset + MonetaryAmount | computational |
| Mechanism explainer | `/m/:slug` | HowTo / Article | mixed |
| Document-of-record | `/doc/:slug` | CreativeWork / Legislation | graph-derived |
| Claim-and-source table | `/ct/:slug` | Claim + ClaimReview | graph-derived |

(URL prefixes are first-pass picks. They should be short enough to read in a tweet — `/t/mark-carney` for "timeline of Mark Carney" — and distinct enough not to collide with `/s/` for Subject or `/p/` for the legacy piece URL. Final URLs subject to revision once collisions are checked.)

Each standalone URL renders the SAME data the embedded section renders, plus:
- A short masthead explaining what this arrangement IS (so a first-time reader landing here knows)
- Its own schema.org JSON-LD per arrangement type
- A back-link to the subject's full Record
- A "faces of this arrangement" strip (yes — even a timeline can have its own thread / TikTok script / meme)

## Why standalone URLs matter

- **GEO/SEO:** AI answer engines reward fine-grained citable URLs with specific schema. A timeline page with ItemList of Event JSON-LD is more citable than a subject page that has a timeline section inside it.
- **Composability:** the operator should be able to share `/t/mark-carney` directly without sharing the whole Record.
- **Faces of arrangements:** a timeline can itself become a thread or a TikTok script. Without a standalone URL, the face has no anchor.

## Embedding

Subject pages compose from arrangement sections — the same renderer that produces `/t/mark-carney` produces the timeline section embedded inside `/s/mark-carney`. One renderer, two contexts. The embedded version omits the masthead and the back-link; everything else is identical.

-----

# PART 7 — INVESTIGATIONS AND THE SEVEN INTENTS

The interpretive layer = INVESTIGATIONS composed of INTENTS

Each intent is an epistemic stance. Intents are BADGES on pieces, not nav destinations.

| Intent | Stance | Concludes? |
|---|---|---|
| **Investigation** | open skeptical probe | often NOT — stays open |
| **Argument / Thesis** | closed case | YES |
| **Pattern** | recurring structure across instances | describes; may not assign cause |
| **Hypothesis** | candidate explanation, provisional | NO |
| **Assessment** | judgment with confidence band | YES, probabilistically |
| **Critique / Rebuttal** | attacks a specific assertion | YES |
| **Explanation / Synthesis** | connects the dots | low advocacy |

The signed reading body is the ONE genuine generation step in the system: writing the argument. The drafter calls the writer LLM once per reading. The body_md is persisted. Every face of that reading thereafter is a rendering of the body.

## THE FIREWALL

An attributed assertion is NEVER silently rendered as a neutral fact. This is a stop-work bug if violated.

-----

# PART 8 — FACES (RENDERINGS, NOT REGENERATIONS)

Faces are projections of any addressable graph thing — a Record, a signed reading, an Arrangement, a theme — into shareable formats.

## Face kinds (today)

- **Thread** — thesis + the highest-rank facts as 4 posts. Template + query (no LLM).
- **Meme** — thesis line + the single highest-balance fact + receipt URL. Template + query (no LLM).
- **TikTok script** (NEW) — thesis + 6-10 dated facts in spoken-rhythm format. Template + query (no LLM).
- **Stat card / stat thread** (NEW) — numeric facts laid out in stat-card grid. Template + query (no LLM).
- **Video essay script** — locked reasoning skeleton in BEAT format. ONE LLM call on sign, persisted, rendered thereafter.
- **Chapter outline** — long-form structure expanded. ONE LLM call on sign, persisted, rendered thereafter.

## The rule for adding a new face

Before building a new face, ask: can this be a template + query?

- If yes: build it as a renderer in `packages/api/src/public/render/faces/`. No persistence; no LLM call at render time; renders in <100ms.
- If no (it needs argumentative sequencing or long-form structure): build it as an LLM-seasoned face. Generate ONCE on the source's sign event; persist to `page_faces`; render thereafter from the persisted body_md.

## Where faces appear

- On the signed reading view (the tab strip from v2.5 Part 24, retained)
- On the Record view (when the Record has enough graph density to support them — e.g. a timeline-rich Record gets a "timeline as thread" face)
- On standalone arrangement URLs (each arrangement gets its own faces strip)
- On the theme view (themes can have faces — a "Themes the corpus engages with" thread, e.g.)

## No generate buttons

No "Generate TikTok script" button. The TikTok script IS already there — the operator clicks the TikTok tab and the rendered page is instant. If it isn't instant, it means we built it as a regeneration when it should have been a rendering, and that's a bug.

-----

# PART 9 — LIVE INQUIRY THREADS

An inquiry thread is a first-class object: an open question / unfinished direction, attached to entities/assertions, with a status (open / being-pursued / resolved / dropped). Threads surface to the operator so the inquiry resumes instead of restarting. Threads are inputs to the proposer — never auto-acted-on.

-----

# PART 10 — THE PROPOSER

The proposer reads the typed graph and open threads, then outputs specific, well-shaped suggestions across BOTH layers — factual arrangements AND interpretive intents — each with LLM-generated reasoning.

Example: 5 docs on OSFI capital rules → proposes (a) Definition of "What is the DSB?", (b) Timeline "OSFI capital changes 2020-26", (c) Q&A "How does the DSB affect retail mortgages?", (d) Stat-roundup "Canadian bank capital ratios", (e) Investigation "Does the DSB's stated rationale hold up?"

Proposals appear inline on the operator's logged-in `/` (woven into the same activity feed everyone reads). The operator's main act: read proposals → click Build.

-----

# PART 11 — THE TRUST GAUNTLET (non-negotiable)

The publication's distinguishing claim is that its citations are mechanically trustworthy. Three checks fire on every published claim, in order:

## Check 1 — Verbatim substring

Every quote is a literal substring of a real stored document. Whitespace differences are tolerated; word substitutions are not. The original document bytes are preserved at upload time in object storage; the quote is a span inside them. A quote that fails this check never reaches a public page.

## Check 2 — The firewall

An attributed assertion ("X claimed Y") is never silently rendered as a neutral fact. Contested claims are stored as contested and rendered as contested. A signed reading is REQUIRED to display the facts that complicate it (the complicating-facts box; mandatory, not optional).

## Check 3 — Independent judgment

A different model than the one that drafted reads each load-bearing claim and its source quote and answers: does the quote actually support the claim? Self-verification is forbidden. The judge model must be a DIFFERENT family from every generator that touches the writing.

**As of v2.6:** the gauntlet runs on BOTH the briefs pipeline AND the signed-reading drafter. Earlier versions had the drafter skipping the judge (storing `judge_pass=1` hardcoded). That was a trust hole and it is closed.

## Audit trail

Every published claim has its source hash + offsets stored. Every judge call records `judge_notes`. Every kill (verbatim failure, firewall failure, judge failure) is counted and displayed on the signed page ("X claims verified · Y killed").

-----

# PART 12 — ONE SITE, ONE PAGE (revised — corrects v2.5 Part 9)

**There is no separate operator console. There is no separate "stream" surface. The operator browses the public site.**

When the operator is logged in, the SAME pages every reader sees gain operator-only affordances woven inline:

- On `/` (the home): a system briefing aside at the top ("From the system, this morning: 2 new pages · 11 new facts · 3 drafts waiting for your signature"); drafts-awaiting-signature cards ABOVE the lead piece; findings strip beneath the tail; open threads at the bottom.
- On `/library`: an Extract / Re-extract band at the top.
- On a thin Record (`/s/:slug`): an Expand-this-Record affordance that triggers the web-search + extract loop (Part 26).
- On a signed reading: Edit / Re-sign / Discard affordances; per-face re-render affordance when a face fails.
- On any Library document: an Extract status pill.

The session cookie (`canopticon_op`, signed HMAC-SHA256 with `SESSION_SECRET`, 30-day expiry, HttpOnly + Secure + SameSite=Lax) is the only operator signal on public routes. Cloudflare Access gates `/auth/login`; the cookie is minted from the validated Access JWT; from then on every public URL recognises the operator without further Access challenges.

**What "OUT" was, and where its content now lives:**

| Old "OUT" section | Where it lives in v2.6 |
|---|---|
| System briefing | An aside at the top of `/` when logged in |
| Awaiting your signature (drafts) | Inline cards on `/` above the lead piece |
| The wiki / record grew | Folded into the home activity feed |
| Worth your attention (findings) | Findings strip at the bottom of `/` |
| Still chasing (threads) | Open-threads list at the foot of `/` |
| Ask the corpus | Deferred — built when search lands |

The retired OUT screen function (`out-stream.ts`) is kept in the tree because the operator's action endpoints (sign / edit / discard) live next to it. It is no longer reached as a destination.

-----

# PART 13 — THE PUBLIC SITE

## Nav (lean — four items)

- **Investigations** — all signed interpretive pieces, across all seven intents
- **Topics** — the index. Themes lead (hero treatment with the received-account quote); Entities + Events follow as standard card grids.
- **Library** — the source documents; the receipts layer
- **Methodology** — how the system works and why it's trustworthy

## Intents are badges and filters, NOT nav items

Inside Investigations: a filter row (All · Investigations · Arguments · Patterns · Assessments · Critiques · …). Every piece wears its intent as a badge with intent-specific colour.

## Records are unmarked ground

Records (entity pages, themes, events) carry no collective nav label. They are reached by: links from Investigations, search, external citation, and the Topics doorway.

## Standalone arrangement URLs

Each arrangement (Part 6) is addressable. They don't appear in nav — they're reached through the subject page they belong to, through search, and through citations.

## Research reports are public by default

Source documents in the Library are indexable, searchable, citable, each with a stable URL. They are part of the content as well as sources. A per-document private flag exists for working material.

## The signed reading band

On any Record where the operator has a signed reading: a band appears near the top offering "Read the operator's reading of this →". Clicking shifts the same page into signed mode — same facts, same receipts, but the prose argues.

## The trust strip

Every public page renders a small editorial bar above the footer: "Every fact you read here is a verbatim quote from a real document we have stored. Contested claims are shown as contested. An attributed assertion is never silently rendered as a neutral fact. → How verification works." The firewall, made legible to a reader who's never heard of "the firewall."

-----

# PART 14 — HARD CONSTRAINTS (never violate)

1. **Operator approves, never authors.**
2. **The graph is the truth; pages are renderings; URLs are rendering identities; faces are reformatting.**
3. **Three independently-triggered layers.** Upload never auto-fires extraction; extraction never auto-fires publish.
4. **The trust gauntlet is mandatory** (verbatim + firewall + judge). Self-verification is forbidden.
5. **The fact/interpretation firewall.** An attributed assertion is never silently a neutral fact.
6. **No self-citing.** Evidence always points to an external source.
7. **No auto-publish.** A human approves every published Investigation.
8. **Server-rendered, citable HTML.** Every public page fully readable with no JavaScript.
9. **Neutral facts vs signed interpretation stay distinct.** No verdict words in factual content.
10. **The weighting model governs surfacing counts.** Distinct investigations, evidence-bearing docs only, distinctiveness not raw counts.
11. **Tiered model use.** Cheap model for high-volume extraction; reasoning model for stance + relations; frontier model for generation near launch.
12. **The UI never waits.** Every view renders immediately from whatever the graph holds. No spinners. Faces render in <100ms.
13. **Extraction is concurrent, not sequential.** See Part 25.
14. **Renderings are pure renderings.** If a face can be template + query, it IS template + query. No LLM at render time unless argumentative sequencing genuinely requires it.
15. **No generate buttons.** Faces are renderings; rendering happens on view, not on click.

-----

# PART 15 — NON-GOALS (explicitly do NOT build)

1. **No hand-authoring composer.** The operator approves system-drafted outputs. (Built once by mistake — do not repeat.)
2. **No auto-publish.**
3. **No auto-fire extraction on upload.**
4. **No raw claims as an end-user product surface.**
5. **No same-model self-verification.**
6. **No raw mention counts in surfacing** — use the weighting model.
7. **No assertion silently rendered as a neutral fact** (the firewall).
8. **No rebuilding working primitives** — extend, don't replace.
9. **No JavaScript required to read any public page.**
10. **No "Briefs" or "wiki"** — use Records and the factual/interpretive layer split.
11. **No separate operator app / console / "OUT" surface.** One site, permission layers. The operator browses the public site.
12. **No generate buttons for format transforms.** Faces are renderings.
13. **No sequential extraction.** Never process document chunks or documents one-at-a-time. See Part 25.
14. **No Studio as a generation destination.** Studio is the production pipeline (Part 27) — assembly, not authoring.
15. **No "Stream" surface, no "Brief" composer, no "Outputs" dashboard.** All retired.

-----

# PART 16 — DECIDED NAMES

- **"Records"** — DECIDED. Subject and theme pages in neutral mode.
- **"Arrangements"** — DECIDED. The twelve factual content types, each also a standalone URL.
- **"Investigations"** — DECIDED. Signed interpretive pieces.
- **"Faces"** — DECIDED. Renderings of any addressable thing into shareable formats.
- **"Studio"** — DECIDED. The production pipeline. Not a destination for generation.
- **"The trust gauntlet"** — DECIDED. Internal term for verbatim + firewall + judge.

The factual layer's proud collective name remains deliberately absent. Its neutrality is the brand.

-----

# PART 17 — WHAT EXISTS / WHAT CHANGES / WHAT TO KEEP

**Keep and extend (working as of the v2.6 build):**

- One-site permission model (PR 1). Session cookie, `attachAuthState` middleware, operator overlays inline on `/`.
- Two-pass extraction (Gemma 4 bulk + gpt-oss-120b hard). Parallel chunk waves at concurrency 4 within a document. Smaller chunks (3000 chars). Tighter cron drain (4 docs/min).
- The trust gauntlet on signed readings (just landed in v2.6 build — closes the trust gap that had been open since v2.5).
- Intent classification (seven kinds, drafter classifies, badge renders on signed pages + Investigations cards + drafts).
- Topics-themes-lead with hero cards.
- Library research-weight band + per-row "fed the fabric" column.
- Investigations editorial framing (lead + secondaries + tail).
- Home editorial hierarchy (lead + secondaries + tail + operator overlays).
- Trust strip on every public page.
- Subject pages (neutral with court-record contested cards + vertical-rail timeline + shape block; signed with dramatised thesis + signature line + proud complicating-facts box).
- Quote receipt page `/q/:id` with schema.org Quotation JSON-LD.
- Methodology + About substantively explain the verification mechanics.
- Faces-on-signing (thread/script/meme/chapter) — but currently regenerated each time. See "fix" below.

**Fix (wrong per v2.6):**

- Faces are currently regenerated by the writer LLM. Per Part 3 + Part 8 the template + query faces (thread, meme) should be pure renderings; only argumentative faces (video script, chapter) should be LLM-seasoned. Refactor faces into `packages/api/src/public/render/faces/` with one renderer per kind.
- Arrangements only exist as embedded sections inside subject pages. Per Part 6 each should ALSO have a standalone URL with its own renderer and JSON-LD.
- Briefs surface (`/briefs/:slug`) still serves pages. Per the deprecation in Part 1, redirect or freeze for citation stability.
- `/search` is a placeholder; remove the SearchAction from home JSON-LD until it ships (already done in the v2.6 build) and either implement search or remove the nav entry.

**Build (missing — the v2.6 frontier):**

- Per-arrangement renderers + URLs (Part 6).
- Faces refactor: template + query for thread/meme/TikTok/stat-card; LLM-seasoned for video/chapter.
- Record-building Phase 2 — the fetch + extract loop behind "Expand this Record" (Part 26). Currently search half done, fetch+extract stubbed.
- Studio as production pipeline (Part 27).
- Concurrent extraction architecture — Cloudflare Queues + Workers AI Async Batch + Durable Object WebSocket for live extraction log (Part 25). Needs operator's CF account setup.
- "Ask the corpus" — the conversational interrogation surface, when search lands.

-----

# PART 18 — BUILD SEQUENCE

The build follows the rendering-system reframe. Order is binding.

1. **Per-arrangement URLs + renderers.** Twelve renderers; one URL each. Each gets JSON-LD. Embedded sections on subject pages start using the same renderers.
2. **Faces refactor.** Template + query for thread/meme/TikTok/stat. LLM-seasoned for video script + chapter outline (one writer call on sign, persisted, rendered thereafter). Drop the writer call from template + query faces entirely.
3. **Record-building Phase 2** — finish the fetch + extract loop. Operator clicks thin Record → Brave Search → fetch found pages → run typed extraction over them. Live progress narration in the page banner.
4. **Concurrent extraction architecture** — Cloudflare Queues + Workers AI Async Batch + Durable Object WebSocket. Speed benchmarks enforced. (Needs operator's CF account setup; parked until queue + DO bindings exist.)
5. **Studio as production pipeline.**
6. **"Ask the corpus" / search.** Built once the rendering system supports it.
7. **Frontier model near launch + result-caching.** One line in the router; result-caching content-hash keyed.
8. **Citation tracker.** AI-bot hit logging is already in place; surfacing it as a "who's citing us" report comes later.

-----

# PART 19 — MODEL STRATEGY

Llama 3.3 70B is RETIRED.

**The tiered lineup** (verify against the live Workers AI catalog — it changes):

| Stage | Model | Why |
|---|---|---|
| Bulk extraction (entities, attributes, events, neutral facts, aboutness) | **Gemma 4 26B A4B** | cheapest strong model; JSON mode; high volume |
| Hard extraction (assertions, stance, typed relations, evidential links) | **gpt-oss-120b, medium reasoning effort** | large quality jump where it matters |
| Surfacing — ambitious tier (patterns, assessments) | **gpt-oss-120b, high reasoning effort** | one backbone, dialed up |
| Very-large-context graph reasoning (fallback) | **Nemotron 3 Super 120B** | 1M-token window; cap max_tokens |
| Writer (signed reading body + LLM-seasoned faces) | **Llama 4 Scout 17B** | fast, non-reasoning, clean JSON |
| Independent verification judge | **Qwen QwQ 32B** | different family than every generator |
| Top tier (near launch only) | paid frontier API via AI Gateway | hardest adjudications + final generation quality |

**Rules:**

- Reasoning effort is a dial, not a default. High effort HURTS bulk extraction. Dial OFF for bulk, ON for surfacing.
- The judge MUST be a different family than every generator role. Hard constraint.
- One routing abstraction (`packages/api/src/llm/router.ts`) — model string + effort per stage. Any stage can later point at a frontier API by changing base URL + key.
- Paid frontier API never used in development.

-----

# PART 20 — THE SURFACING INTELLIGENCE ENGINE

## Level 1 — Deterministic tier (every ingest, neighborhood-bounded)

- Contradiction candidates (NLI check on assertion pairs about same target)
- Connection detection (SQL short paths + Vectorize proximity)
- Evidence-balance computation (balance score → contested flag → rendered gray)
- Thread tracking (open-question nodes, resurface on new evidence)
- Anomaly signals (degree spikes, synchronized stance shifts)

## Level 2 — Ambitious tier (rare, deliberate, frontier model, output = CANDIDATE)

- Pattern discovery (verified subgraph → reasoning model proposes novel patterns)
- Calibrated assessment (ACH-style — competing hypotheses, disconfirmation-first, ICD-203 confidence)
- **Mandatory graph-verification** before any insight is shown. LLMs hallucinate graph structure — the LLM never traverses the graph; deterministic engines retrieve, LLM interprets the verified subgraph.

## Incrementality

Surfacing re-checks only the AFFECTED NEIGHBORHOOD (1-2 hops + Vectorize topK). If per-ingest surfacing time grows with corpus size, the bounding is broken.

## Anti-confirmation-bias

- Disconfirming evidence surfaced by default for believed hunches
- Competing hypotheses always present
- Source-diversity checks
- Minimum evidential basis before promotion (≥2 independent sources)
- The mirror must challenge as well as validate

-----

# PART 21 — MIGRATION / TRANSITION

1. **Storage's raw documents are the durable asset.** Nothing touches them.
2. **Old flat claims are SUPERSEDED, not migrated.** Re-extract from stored raw documents. No data archaeology.
3. **Old public pages are REGENERATED, not edited.** Preserve URLs; redirect dissolved destinations.
4. **Nothing is auto-deleted.** Supersede, regenerate, redirect — destruction only by explicit operator decision.
5. **Legacy corpus:** bank into Storage immediately; extract in batches, idempotent. Packages are an enrichment, never a requirement.

-----

# PART 22 — ACCEPTANCE TEST

**Input:** five research reports on Mark Carney (BoC tenure, BoE tenure, GFANZ, Brookfield, return to politics).

**Expected flow:**

1. Operator drops all five into Storage via `/library`. They appear in the table; nothing else fires.
2. Operator clicks "Extract all (5)". Each piece goes through extraction → typed graph rows land.
3. The settle gate runs: L1 surfacing → theme surfacer → autoseed-pages → proposer → draft-reading.
4. Operator visits `/` (logged in). Sees: system briefing aside ("5 new pieces, 247 new facts, 1 reading drafted and waiting for your signature"), Carney draft card above the lead, findings strip, threads.
5. Operator clicks the Carney draft. Lands on `/s/mark-carney?mode=signed`. The signed reading has a thesis, an intent badge (Argument), a confidence band, the complicating-facts box, and four face tabs (thread / video script / meme / chapter).
6. Operator clicks the thread tab. **Instant render** (template + query). Operator copies, posts to Twitter.
7. Operator clicks the timeline section on the Record. Lands on `/t/mark-carney`. Standalone timeline page with its own JSON-LD. The timeline page ALSO has face tabs (a timeline can become a thread). Operator clicks "thread of this timeline". Instant render.
8. Operator clicks "Expand this Record" on Carney's Record. Brave Search fires; pages fetched; extraction runs. The Record fills in over ~3 minutes; the live progress banner narrates. After completion, all signed reading faces and arrangement pages re-render automatically with the richer graph.

**Pass criteria:**
- The only operator acts are Upload, Extract (click), Expand (click), Sign (click), Publish (click).
- Every face renders in under 100ms.
- The firewall holds throughout.
- Standalone arrangement URLs are citable.

-----

# PART 23 — STACK & ENVIRONMENT

- Single Cloudflare Worker serving public `/*` + auth-gated affordances for the logged-in operator
- D1 (SQLite) = source of truth: nodes, node_props, edges, sources, quotes, assertions, inquiry_threads, pages, page_claims, page_faces, themes, digest_jobs, uploaded_files, citation_hits
- R2 = raw documents + fetched-source text (hashed)
- Vectorize = embeddings for retrieval + entity resolution + subject clustering
- Cloudflare Queues = metering layer for concurrent extraction (Part 25)
- Durable Objects = stateful background jobs + Hibernatable WebSocket streaming for live progress (Part 25)
- Brave Search API = web discovery for record-building on click (Part 26)
- Public site server-rendered from D1; no JS required to read
- One routing abstraction for all model calls (Part 19)

-----

# PART 24 — FLUIDITY & POLISH (the UX standard)

**If the operator ever wonders what the system is doing, something in this part was not implemented.**

## Global

- Any click produces visible feedback within 200ms.
- Pages render from whatever the graph currently holds — immediately. Never wait for a full build before showing anything.
- Every background process narrates itself in plain language, in real time.
- Empty states explain what goes here and what action fills it. Never a blank panel.
- Error states are specific: what failed, why, what to do next.

## Faces

- Template + query faces render in <100ms. If a face takes longer, it's been misbuilt.
- LLM-seasoned faces (video script, chapter outline) generate ONCE on signing in waitUntil; subsequent views render the persisted body in <100ms.
- Switching between faces is a tab switch, not a page reload.

## Extraction progress

When a document is extracting, the operator sees a live log streaming via Durable Object WebSocket — NOT a spinner, NOT a percentage alone. The log narrates every step in plain language.

## Record-building progress

When the operator clicks "Expand this Record", a banner on the same page narrates the search + fetch + extract progress in real time. Facts appear in the relevant sections as they clear verification.

## Empty states

- Subject page with no facts: shows the SHAPE block (what would fill each section), not a blank.
- Topics with no themes: section still renders with an explainer of what themes ARE.
- Investigations with no signed readings: shape block listing the seven intents.

## Operator strip on `/library`

Status pills update in real time without page refresh (Durable Object pushes). Batch extraction: live count.

-----

# PART 25 — EXTRACTION PERFORMANCE (concurrent architecture required)

Extraction is the only slow operation in the system. Everything downstream is rendering and should be instant. Extraction itself MUST be concurrent.

## Required architecture

- Worker enqueues one message per document/chunk into **Cloudflare Queues**
- Queue consumer Worker pulls batches and calls Workers AI via the **Async Batch API** (`queueRequest: true`)
- Different tasks routed to different models (entity extraction on Gemma 4, stance extraction on gpt-oss-120b) — multiplies effective throughput
- On capacity error: retry with exponential backoff. Never fail silently.
- Cache: content-hash keyed. Re-extraction of an unchanged document costs zero LLM calls.

## Two chunk sizes (dual-resolution)

| Pass | Size | Purpose |
|---|---|---|
| Fast (bulk) | ~512 tokens | Entities, attributes, events, neutral facts, aboutness |
| Slow (hard) | ~1500-2000 tokens | Stance, relationships, contested assertions |

Both passes run as separate concurrent queues. The Record gets partially populated fast from the bulk pass, then deepens as the hard pass completes.

## Speed benchmarks (required)

- A single 5,000-word research report: complete extraction in under 60 seconds
- A batch of 10 documents: must not take longer than a single document
- Re-extraction of an unchanged document: under 1 second (cache hit)
- Total extraction of a 60-document legacy corpus: under 20 minutes

## Live log

Extraction status streams via Durable Object Hibernatable WebSocket. No polling. No page refresh.

-----

# PART 26 — RECORD-BUILDING ON CLICK

When the operator (logged in) clicks a thin Record, the click IS the build signal.

## The sequence

1. Operator clicks a thin Record.
2. Record page renders immediately with whatever exists.
3. A subtle banner: "Expanding this record — searching for [subject name]…"
4. **Brave Search** fires for the subject name (News + web endpoints).
5. System fetches the found pages.
6. **Same extraction pipeline** runs on the fetched content — same typed extraction as research reports.
7. Facts appear in the relevant sections as they clear verification. The Record fills in while the operator reads it.
8. Banner updates: "Record expanded — 8 facts added from 4 sources." Fades after 5 seconds.

## Architecture

Subject-agnostic and jurisdiction-aware but global. Not Canada-hardcoded. Use `country` parameters where available; fall back to global search.

## Current state

Half-built. Brave Search call works. The fetch + extract loop is stubbed (`record-builder.ts:88`). Finishing the loop is one of the v2.6 frontier items.

-----

# PART 27 — STUDIO AS PRODUCTION PIPELINE (NOT GENERATION DESTINATION)

Earlier specs implied Studio should die. v2.6 corrects that: Studio is real, but its role has shifted.

## What Studio is NOT

- NOT a place to generate scripts or threads. (Faces render automatically; there are no generate buttons.)
- NOT a destination for "make a video essay of Carney". (That's a face on the signed reading, rendered instantly.)
- NOT a separate operator app. (The operator browses the public site; Studio is one tab away from any signed reading.)

## What Studio IS

The production pipeline that turns a rendered face into a finished asset.

- **Voice profile** — operator records voice samples; system characterises tone, pace, register. Persisted.
- **Record voice over a script** — the operator opens the video script face; Studio shows it in chunked form (one bullet per chunk); operator records each chunk. System captures audio per chunk.
- **Stitch** — system stitches the recorded chunks into a continuous voiceover. Crossfades, trim silences.
- **Match visuals** — the script's beats specify B-roll cues; operator drops visuals against each beat. System assembles a timeline.
- **Export** — final audio file, final video file, final TikTok cut. Downloadable.

## Architecture

Studio's data lives in two new tables (to be added):

- `voice_profile(user_id, samples_url, characterisation, updated_at)` — one row per operator.
- `studio_projects(id, user_id, source_face_id, status, audio_url, video_url, ...)` — one row per assembly project.

The production pipeline is a queue of jobs (record → stitch → match → export). Each job runs in waitUntil; the operator's view polls for status. Stage 1 (skeleton + compose) already exists in code as scaffolding for this; it should be kept and absorbed into the production-pipeline architecture, not deleted.

## When Studio is built

Studio is the LAST item on the build sequence (Part 18). It's the production frontier. It depends on a working rendering system + faces refactor + record-building on click. Without those, Studio has nothing real to assemble.

## What Stage 1 (deferred to a later phase but namable now)

- Operator's voice profile: capture, characterise, version.
- The recording UI: per-chunk record + redo + accept.
- The stitcher: cross-fade, trim, normalise.
- The visual matcher: drop-zones per beat, preview, export.

This part is a roadmap, not a build commitment. It lives in v2.6 so when we DO build it, we build against this shape, not a fresh interpretation.

-----

# PART 28 — INPUT TYPES

The system accepts five input types. All enter through Storage (upload). Nothing is published as-is except source documents in the Library.

| Input type | What it is | How it's processed |
|---|---|---|
| **Research report** | the primary input — frontier-model research sessions, exported | extracted into the typed graph; becomes source documents in Library |
| **Essay** | operator's interpretive draft, often 80% complete | digested as attributed assertions (operator's stance, attributed to operator); NO direct-publish path; proposer regenerates from the graph |
| **Wrap-up package** | structured end-of-chat capture (intent, findings, threads, candidate angles) | treated as input to proposer and inquiry-thread creation; not a competing proposer |
| **Primary source** | a bill, transcript, contract, memo | extracted + published as document-of-record pages |
| **Web-fetched content** | pages fetched by record-building on click (Part 26) | extracted same as research reports; source URL is the provenance |

-----

*End of canonical spec v2.6. Hand this WHOLE document to the code side alongside the prototype HTML and the feels-like brief. When something is ambiguous: the prime directive (Part 0), the Glossary (Part 1), the rendering-system rule (Part 3), the firewall (Part 11), and the OUT-collapse (Part 12) decide it. The operator approves, never authors. The graph is the truth. Rendering, not generation, is the system.*
