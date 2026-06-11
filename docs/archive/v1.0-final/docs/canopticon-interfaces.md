# CANOPTICON — Interfaces

This document describes how CANOPTICON is accessed: the operator app (where the operator does intelligence work), the public site (where readers encounter the published work), and the API surface (the contract between frontends and backend, and between external systems and the substrate).

---

## 1. THE OPERATOR APP

The operator app is mobile-first, dark, dense. It is a cockpit. The operator lives in it for hours at a time. Its register is industrial-editorial: serif content on a hard mono frame, the kind of tool that respects the work being done.

### 1.1 Aesthetic register

**Palette.** Warm dark backgrounds (`#0f1218` — slight tan tint, less clinical than pitch black). Cream/bone (`#ede9de`) as primary UI accent — same family as the logo's warm white. Amber (`#d4a24a`) for caution, in-progress, attention states. Red (`#d14156`) rare and meaningful: HOT convergences, contradictions, the recording-in-progress chip, errors. Sage (`#7a8c5f`) for verified, done, good-tier. Muted blue (`#4c617e`) for neutral metadata. Tan (`#b89968`) for quotes and predictions.

**Typography.** EB Garamond serif for content (titles, headlines, body, descriptions, beat text). JetBrains Mono for metadata (timestamps, format labels, status chips, counts, IDs). The contrast — soft serif content on hard mono frame — is the design.

**Texture.** Subtle SVG grain at 4% opacity over the base background. Just enough to keep surfaces from feeling sterile. No drop shadows. No glassmorphism. Borders are 1px, hairline.

**Geometry.** No rounded corners (≤2px max where rounding is unavoidable). Cards have 1px borders, subtle elevation via background tone shift, not shadow. Section dividers are thin gradient hairlines that fade out toward the edge.

**Logo.** "CANOPTICON" wordmark in EB Garamond, with "CAN" in cream and "OPTICON" in red. A small pulse dot to the right when active (cron running, cascade firing, etc.). Mobile size 23px; desktop masthead 32px.

**Motion.** Minimal. State transitions are the work surface, not the work. Tab switches are instant. Modals fade. Recording state has a single subtle pulse on the active recording chip; nothing else moves.

### 1.2 Information architecture

Six screens, accessible via persistent bottom navigation:

**LIVE · GRAPH · STUDIO · LIBRARY · SOURCES · SYSTEM**

Each screen is a single scrollable view. No sidebar nav. No multi-pane layouts on mobile. Desktop expands the same single-column layout to a max-width of around 480px and centers it; the operator app does not become a "desktop dashboard" at larger viewports. Density is consistent across form factors.

The bottom nav bar shows the six labels in mono, the current screen in cream, others in muted. A small indicator line under the active label.

A masthead at the top of every screen shows: CANOPTICON wordmark with pulse dot, current screen name in mono small caps with screen number (e.g., `1 LIVE`, `6 SYSTEM`), and a date strip showing the current time and last cascade run age.

### 1.3 Live screen

The Live screen is the operator's daily entry point. It shows what the system has surfaced — what changed, what needs attention, what's in progress.

The screen is a feed. Each item is a card. Cards have:

- **Timestamp** (mono, small) and **type label** (mono, small caps): CLAIM, CONTRADICTION · REVIEW, ARTICLE DRAFT READY, THESIS EXTENDED, RED TEAM · OBJECTION, QUESTION GENERATED, INDICATOR FIRED, etc.
- **Tier/grade chip** when applicable: A-tier, partial verification, 2 flags, etc.
- **Title** (serif, large): the headline of what happened
- **Italic description** (serif, smaller, faintly muted): the one-paragraph summary of why this is on the feed
- **Action buttons** (mono, small caps): Open, Resolve, Hold open, Dismiss, etc.

A **left rail** color-codes each card: red for HOT/contradiction, sage for verified/draft-ready, amber for review-needed, blue for question-generated, cream for default.

Above the feed: a row of filter chips (mono, small caps): ALL · CLAIM · CONTRADICTION · QUESTION · DRAFT · CONVERGENCE · RECORDING. Tap to filter; counts shown next to each.

Below filter chips: a "Run Cascade" button (cream outlined). Tapping triggers an on-demand cascade run; the button shows progress (cream pulse dot during run).

Above the run button: a "Why surfaced?" toggle. When on, each card expands with a reasoning trace — which signals fired, which thresholds were crossed, which roles ran, in what order. Off by default (most operators don't want that detail every time).

A "What changed today" summary at the very top: a numeric line in mono showing claims written, questions generated, contradictions detected, predictions resolved, productions surfaced, all since the last cascade. Tap any number to filter to that type.

### 1.4 Graph screen

The Graph is a node-link visualization of the substrate's entity graph. Nodes are entities, edges are entity relations.

**Node visual encoding:**
- Type by shape: person (circle), organization (rounded square), institution (square), legislation (diamond), event (triangle), concept (hexagon)
- Centrality by size: nodes with more relations are larger
- Heat by color: HOT entities pulse with red glow, normal entities are muted; entities pinned in any active thesis's watch-set get a cream outline ring

**Edge visual encoding:**
- Relation type by line style: chaired/employed (solid), attended/cited (dashed), opposed/contradicted (red dotted)
- Relation strength by line weight
- Active vs historical by opacity (start_date/end_date driven)

**Controls:**
- Pinch zoom, pan
- Tap node → inspector slides up from bottom with entity name, type, relation count, claim count, links to entity page in operator's substrate detail
- Long-press node → "filter graph to this entity's neighborhood" (1-hop or 2-hop)
- Top filter chips: ALL ENTITIES · PINNED · HOT · BY TYPE
- A "Concept Spine" filter that scopes the graph to an active thesis's spine

**Inspector panel:**
- Entity name (serif, large)
- Type and grade (mono, small)
- Recent claims involving this entity (top 3, expandable)
- Pin/unpin to active thesis affordance
- Open full entity page

The Sprint-1-equivalent of the graph (when substrate is small) is a force-directed layout via Cytoscape.js. Larger substrates require progressive disclosure techniques (semantic clustering by entity type, focus+context fisheye views, time-as-axis layouts) — designed but not implemented in the initial build, surfaced via a "View" mode picker when substrate exceeds the force-directed threshold.

### 1.5 Studio screen

Studio is the production engine's home. Six tabs across the top:

**READY · RECORDING · PRODUCING · PUBLISH · PERF · ARCHIVE**

Each tab shows count badges. Sticky at the top.

Each tab shows production cards. Card structure is identical across tabs; contents vary by state.

**Card structure:**
- Top row: format and metadata (mono, small caps) — e.g., "VIDEO ESSAY · 11:20" or "SHORT · 1:24" — and a status chip
- Title (serif, prominent)
- Description (serif italic, smaller) — what this production is about, status detail
- **Pipeline indicator**: five segments showing Script / Coherence / Record / Edit / Publish, with done segments filled in sage, current pulsing in amber, future faint outline
- Footer: action buttons appropriate to state

**Status chip colors:**
- Ready: cream filled (something to greenlight)
- Recording: red (active operator work)
- Producing: amber (system working)
- Publish: cream (operator decision needed)
- Perf: tier-color (A=sage, B=amber, C=neutral)
- Archive: muted

**Ready tab actions per card:** Start Recording (cream outlined primary), Open script, Discard, Defer, Refine.

**Recording tab actions:** Resume, Restart, Edit script, End session.

**Producing tab:** mostly automated; Cancel, Preview when ready.

**Publish tab actions:** Publish all (cream outlined primary), Edit captions, Per-platform toggles, Schedule, Hold.

**Perf tab cards** show metrics differently — top row has format/age and tier color, then a row of stat blocks (mono, large numbers; small uppercase labels): VIEWS, IMPS, OPENS, SAVES, SHARES, COMMENTS, etc., then an italic insight callout in serif: "the personal anecdote opener outperformed the abstract framing by 3.2× — future scripts will weight first-person concrete openings."

**Archive tab cards** are compact: format/date, title, single key stat. Tap to open full historical view.

### 1.6 The Recording overlay

When the operator taps "Start Recording" or "Resume," a full-screen overlay opens.

**Top bar:** Back button (cream outlined small), beat counter ("Beat 13 of 34" in mono).

**Main area:**
- Cue label, mono small caps: "CUE · OPTIONAL DIRECTION"
- Beat text (serif, large — 26px on mobile, even larger on desktop) — the operator's job is to read this aloud, so it's the most prominent element on screen
- Waveform display (mono, with red signal during recording): "● ████████░░ 3.2s"
- Three buttons (mono, equal width): Record (red filled primary), Skip, Re-record
- Beat-progress dots: 34 small circles, one per beat, sage filled for done, red filled with red glow for current, muted for pending

**Behavior:**
- Tap Record → starts MediaRecorder, shows red signal in waveform
- Tap Stop (button toggles) → uploads beat audio/video to R2, marks beat recorded, auto-advances to next beat
- Tap Skip → marks beat status='skipped', advances
- Tap Re-record → discards current recording, restarts capture
- Tap Back → saves progress, returns to Studio Recording tab; production stays in 'recording' state

The friction-minimization principle: every UI element other than the beat text is small. The operator's cognitive load is reading and delivering the beat. The system gets out of the way.

### 1.7 Library screen

The Library is the operator's reference shelf. Four tab views: ALL · BOOKS · ARTICLES · NOTES.

Each tab shows a list. Each list item:
- Type icon (book, article, note) on left
- Title (serif)
- Author / source (mono small)
- Date / version (mono small, right-aligned)
- Progress bar where applicable (book ingestion progress, etc.)

**Search:** a search input at the top, filters as you type. Powered by `pg_trgm` initially; pgvector later for semantic search. Cross-substrate: hits across articles, books, notes, claims, sources, theses, glossary.

**Book detail:** opens a full-screen view showing the book's three-mode ingestion options (Surface / Substrate / Influence), current progress, extracted claims if Substrate mode, framing notes if Influence mode.

### 1.8 Sources screen

The Sources screen is the ingestion queue and source registry combined.

**Top bar:** filter chips — PENDING · APPROVED · ALL · BY GRADE.

**Pending Critic reports section:** each pending source as a card with the Critic's report inline. Shows proposed grade, bias assessment, compatibility check (which active theses' watch-sets matched), contradiction flags (linked claims), paid-op flags, reasoning paragraph.

Three buttons per pending card: Approve (cream outlined primary), Defer, Reject. Long-press for "Edit grade before approving" (operator override).

**Recently approved section:** a thinner list of recently-approved sources for quick access.

**Add source** affordance (top-right): tap to upload a file, paste a URL, or paste/dictate text. This is the operator-driven ingestion path; available regardless of the `ingestion_apis_enabled` toggle.

**Entity review tab** (when entity_resolution_queue has pending rows): surfaces unresolved entity mentions with candidate matches. Three buttons per item: Confirm match, New entity, Defer.

**Claim deduplication tab** (when claim deduplication queue has pending rows): surfaces unresolved claim deduplications with proposed relationships. Four buttons per item: Duplicate, Refinement, Contradiction, Distinct.

### 1.9 System screen

The System screen is the operator's health dashboard.

**Cost panel:** month-to-date spend versus monthly ceiling. Horizontal bar showing fill, with amber at 80% threshold and red beyond. Below: per-category breakdown (Claude completions, transcription, generation, verification, premium fetches). Tap any category for cost-ledger drill-down.

**Cascade panel:** last cascade run summary — completed_at, status, sources ingested, claims written, questions generated, contradictions detected, total cost, duration. "Run cascade now" button (cream outlined). Below: history of last 10 cascade runs.

**Roles panel:** a small dashboard of role activity. Each role's name, count of invocations in last 24h, count of errors. Tap to drill into role-invocation log.

**Workflows panel:** active workflow runs (publish-prep in progress, contradiction resolution awaiting operator, etc.). Tap to drill in.

**Whitelists panel:** the cost whitelist rules. Each rule shows operation_type, per-op max, daily max if any, monthly max if any, enabled toggle. "Add rule" affordance.

**Ingestion APIs toggle:** master switch for `users.ingestion_apis_enabled`. When on, individual webhook/cron source toggles appear below for fine-grained control.

**Ceiling controls:** monthly ceiling slider with current value; warn-threshold settings; cron schedule for cascade.

**Errors needing attention:** list of any open errors — failed cascades, failed role invocations, webhook signature failures, RLS test failures.

**Brier panel:** rolling Brier score, per-domain breakdown, calibration chart over time.

### 1.10 Modals

A few modals appear across the app:

**Cost approval modal.** Triggered by `cost.operation_proposed` events. Shows operation type, provider, model, estimated cost, reason. Three buttons: Approve once, Approve and add to whitelist, Deny. The "Approve and add to whitelist" affordance lets the operator turn an approval into a standing rule.

**Confirm modal.** Generic destructive-action confirm. Used for thesis archive, entity split, source rejection.

**Workflow status modal.** Slides up when a long-running workflow (publish-prep, large cascade) needs operator interaction or has completed.

### 1.11 Realtime updates

The operator app subscribes to Supabase Realtime channels filtered by user_id. Substrate inserts/updates flow to the UI as they happen: cascade progress, role completions, new feed items, Critic reports landing, productions advancing through states. The Live feed updates without polling.

The frontend uses Supabase's client library:

```javascript
supabase
  .channel('substrate')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    filter: `user_id=eq.${userId}`
  }, payload => { /* handle insert/update/delete */ })
  .subscribe()
```

For workflow status that doesn't naturally map to substrate row changes (cascade step progress, cost approval prompts), the API exposes an SSE stream at `/v1/orchestrator/events`.

---

## 2. THE PUBLIC SITE

The public site (`canopticon.com`) is where readers encounter the published work. Its register is opposite to the operator app: light, editorial, long-form. Same system, different room.

### 2.1 Aesthetic register

**Palette.** Paper (`#f5f1e8`, warm off-white). Paper deeper (`#ebe6d8`) for section backgrounds and pull-quote fills. Ink (`#1a1816`) for primary text — not pure black, slightly warm. Ink dim (`#5a564f`) for secondary text and metadata. Hairline rules in (`#c9c2b0`). Editorial accents: signal red (`#9c2333`) for drop caps and pull-quote marks and contradiction flags; amber (`#8a6520`) for prediction confidence; sage (`#5a7349`) for verified/grounded markers; muted blue (`#4c617e`) for question markers.

The palette is the operator palette *inverted*: same hues, flipped values. Coherence between surfaces, distinct visual identity per surface.

**Typography.** EB Garamond serif dominant. Headlines, body copy, pull quotes. JetBrains Mono for metadata, citations, claim IDs, prediction confidence percentages. Drop caps on first paragraph of articles and theses, three-line size, in signal red.

**Logo.** Same CANOPTICON wordmark, but inverted: CAN in charcoal, OPTICON in signal red.

**Layout.** Single-column body for article and thesis pages, max ~680px width (optimal line length ~65 characters). Wider for index pages and the prediction ledger.

**Texture.** Same SVG grain overlay as operator app, but at 2% opacity (lighter surface needs less). Just enough tactility. The site reads like print.

### 2.2 Surfaces

Fourteen public surfaces. Seven editorial, four reference-grade auto-generated, three utility.

**Editorial:**

1. **Homepage (`/`)** — masthead, lead story, theses-in-progress grid, running predictions strip, recent contradictions section, what-changed-this-week column
2. **Article page (`/articles/{slug}`)** — single published article with inline citations, claim links, related sidebar
3. **Thesis page (`/theses/{slug}`)** — living document with BLUF, tier switcher (BLUF / 80 / 800 / Full), expandable layer decomposition, assumptions and linchpins, open questions, contradictions tracked, anchored predictions, version history
4. **Prediction ledger (`/predictions`)** — full public Brier record with active/resolved tables, breakdown by domain and horizon, CSV export
5. **Contradiction tracker (`/contradictions`)** — open contradictions, machloket registry, resolved archive
6. **Methodology (`/methodology`)** — plain-language explanation of how the system works
7. **About (`/about`)** — who's behind it, editorial standards

**Reference-grade (auto-generated):**

8. **Entity page (`/entities/{slug}`)** — one per entity in the graph, with timeline, relations, claims, theses
9. **Source page (`/sources/{slug}`)** — one per source, with extracted claims, citations
10. **Claim page (`/claims/{id}`)** — one per atomic claim, with full Toulmin structure
11. **Glossary (`/glossary`)** — the public vocabulary

**Utility:**

12. **Subscribe (`/subscribe`)** — email + RSS
13. **Search (`/search`)** — cross-surface search
14. **Corrections log (`/corrections`)** — every correction ever, publicly

### 2.3 The homepage

The homepage is the masthead of the publication. A first-time visitor should understand what this is in 15 seconds. A returning visitor should see what's new in 5.

**Top:** Centered CANOPTICON wordmark (32px). Tagline below in mono, small caps: *Forensic intelligence · Canada.* Hairline rule. Date strip showing today, number of live theses, running predictions count, rolling Brier.

**Lead story:** Full-width. Most recent or highest-weight article. Headline (EB Garamond, 56px desktop / 42px mobile), italic subhead, drop cap, 2-3 lines of excerpt, read-time, source count, "Read full article" affordance.

**Theses in progress:** Three-column grid (single column on mobile). Each card: thesis title, current IPCC likelihood qualifier, claim count, layer count, last-updated stamp, one-sentence current state. Cards are quiet — thin border, no shadow.

**Running predictions:** Horizontal strip. Up to six active predictions with confidence percentages and resolution horizons. Serves as content and as credibility signal.

**Recent contradictions:** "Currently held as machloket" — two or three open contradictions tracked publicly. Differentiator from journalism (which hides contradictions); surface it.

**What changed this week:** Narrow column, bulleted, timestamped. Reads like a changelog. "Thesis X gained three A-grade sources." "Prediction Y resolved correct." "New contradiction surfaced." Builds the feeling of a living system.

**Footer:** Wordmark, nav links, last-updated timestamp.

### 2.4 The article page

A single published article, standalone, shareable.

**Header:** Breadcrumb (Articles › [Category]). Article title (EB Garamond, 64px desktop / 48px mobile, weight 500). Italic subhead if present. Byline: *CANOPTICON · [date] · [last-updated if newer] · [read time]*. Signal-red drop cap on first paragraph.

**Body:** Single column, max 680px. Paragraphs separated by line spacing. Section breaks marked by three-dot hairline dingbat (· · ·). Pull quotes break out into full-width-plus blocks with paper-deeper background.

**Inline citations:** Every factual claim carries a small bracketed citation like `[SEDAR+ 2021-04-08]` linking to the source page. Hover/tap reveals citation in tooltip; click navigates.

**Claim links:** Structurally important claims have a dotted underline. Click navigates to the claim page. Reading the article does not require clicking these; they're for the auditing reader.

**Sidebar (desktop) / bottom panel (mobile):** Related thesis card; related predictions; sources used (count + drawer); entities mentioned (chips linking to entity pages).

**End matter:** Provenance strip — "Corrections: none" or "Corrections: 2 (last: April 14)" with link; version number; "Published under the CANOPTICON editorial standard" linking to methodology.

**Controls:** Share (copy link, X, email, Mastodon, Bluesky); Read in reader mode; Cite (BibTeX, Chicago, APA); Report correction.

### 2.5 The thesis page

The thesis page is what differentiates CANOPTICON most sharply from journalism. Journalism publishes and moves on. A thesis page updates continuously and tells you it's updating.

**Header:** Breadcrumb. Title (EB Garamond, 52px desktop). Italic one-sentence seed. Status strip in mono small caps: *v0.4 · In progress · Declared Feb 11 · Last updated 4h ago · 47 claims integrated · IPCC: Likely.*

**BLUF:** Full-width quote block. The thesis's one-sentence BLUF with IPCC likelihood qualifier in italic red. Most important single element on the page.

**Tier switcher:** Tabs — BLUF / 80 words / 800 words / Full. Reader picks depth. Default 80.

**Layer decomposition:** Four expandable sections — Factual, Framing, Architectural, Distributive. Each shows claim count, A-grade dominance, two-sentence description. Tap to expand and see claims inline.

**Assumptions & linchpins:** Section explicitly naming what the thesis assumes and which assumptions are load-bearing. Each assumption shows current status (holding, weakening, failed, strengthened). Unusual for a publication; credibility feature.

**Open questions:** Interrogator-generated questions remaining unanswered. Gives the reader a sense of what's still uncertain.

**Contradictions tracked:** Any contradictions relevant to this thesis. Shows posture (open, resolving, machloket).

**Anchored predictions:** If the thesis makes probabilistic predictions, listed here with confidence and horizon.

**Version history:** Drawer at the end. Every version with diff summary — "v0.3 → v0.4: +3 architectural claims, +1 linchpin weakened."

**End matter:** Sources used (count + drawer); entities central to thesis; related articles; subscribe-to-this-thesis affordance.

### 2.6 The prediction ledger

The site's central credibility mechanism. Every probabilistic prediction CANOPTICON has banked, with confidence, horizon, resolution criterion, outcome. Rolling Brier visible.

**Header:** *Prediction Ledger.* Subhead: *Every probabilistic call we've banked, and how they've resolved.* Status strip: *Active: 14 · Resolved: 9 · Rolling Brier: 0.142 · Best domain: Monetary policy (0.08) · Worst domain: Electoral outcomes (0.24).*

**Calibration chart:** Brier sparkline over time, plus accuracy by confidence bucket — were 70%-confidence predictions right ~70% of the time? The calibration question made visible.

**Active predictions table:** For each: claim, confidence percentage, resolution criterion, horizon, banked date, source thesis. Sortable by horizon, confidence, date, domain.

**Resolved predictions table:** For each: claim, original confidence, outcome, Brier contribution, resolution evidence with link.

**By-domain and by-horizon breakdowns.**

**CSV export.** Research-grade affordance. The full ledger as a downloadable file.

### 2.7 The contradiction tracker

Publicly visible list of contradictions held by the system. Four postures: open, resolved-one-way, resolved-other-way, machloket. Most publications hide their contradictions. CANOPTICON surfaces them as a core product.

**Header:** *Contradictions.* Subhead: *What the graph can't reconcile, and why.*

**Legend:** Four posture labels with plain-language definitions.

**Open contradictions:** Full-width cards. Two-line summary, the two competing claims with sources, detection date, roles that have run on it (Red Team, Steelman), current posture, related thesis.

**Machloket registry:** Separate section. Contradictions held deliberately. Each card includes a paragraph explaining why this one is machloket rather than resolvable.

**Resolved archive:** Chronological list, compact. Each row: contradiction, when resolved, which way, what evidence tipped it.

### 2.8 Reference-grade pages

**Entity page.** Auto-generated per entity. Header with entity name as headline, type below, stats. Plain-language summary auto-generated by the Tier Projector. Horizontal timeline of events/claims. Relations list (other entities linked to this one). Claims about this entity (sortable table). Theses mentioning this entity. Predictions touching this entity. Related entities (cluster of most-shared-relations entities). Heavy structured data — these pages are the primary AI-search-visible surface.

**Source page.** Auto-generated per source. Title, metadata, Admiralty grade, bias profile. List of extracted claims with grades and statuses. Entities identified. Articles/theses/predictions citing this source. Ingestion provenance (when, how, Critic report condensed). Corrections affecting this source.

**Claim page.** Auto-generated per atomic claim. The claim itself, rendered as a prominent serif statement. Toulmin structure laid out: data, warrant, backing, qualifier, rebuttal. Sources supporting and contradicting (each with grades and links). Verification history. Entities involved. Articles/theses/predictions resting on this claim. Linked contradictions if any. Heavy schema.org Claim and ClaimReview structured data.

### 2.9 Editorial standards (the visible ten)

Stated on the methodology page, referenced in every article footer:

1. No editorializing in content. Declarative, evidence-first voice.
2. Every factual claim has a visible source.
3. Grades are honest. A-grade means primary, official, verbatim.
4. Contradictions are preserved. Machloket is legitimate.
5. Predictions are banked publicly with confidence. Brier score is public.
6. Corrections are public and logged.
7. No advertising, no sponsorship, no paid placement.
8. No AI-generated content without operator review.
9. No stock photography.
10. Open methodology, schema, and glossary.

### 2.10 AI-search architecture (GEO)

The public site is built to be cited by AI search engines (ChatGPT, Claude, Perplexity, Google AI Overviews, Gemini). Every surface emits structured data:

- **Article pages:** `schema.org/Article` + nested `ClaimReview` for each verified claim
- **Thesis pages:** `schema.org/Report` + `Claim` + `ClaimReview` per claim
- **Prediction ledger:** `schema.org/Dataset` with prediction records as DataRecords
- **Claim pages:** `schema.org/Claim` + `ClaimReview` with full Toulmin properties
- **Entity pages:** `schema.org/Person` / `Organization` / `Legislation` / etc. with `mentionedIn` cross-references
- **Source pages:** `schema.org/CreativeWork` subclass with citation arrays

Plus: `/ai.txt` describing the publication for AI crawlers; `robots.txt` permitting GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Bingbot explicitly; sitemap.xml index plus per-surface sitemaps; canonical URLs; Open Graph and Twitter Card on every page; RSS feeds (per surface, per thesis); server-side rendering throughout (no client-side hydration tricks that hide content from crawlers); clean semantic HTML (`<article>`, `<section>`, `<time datetime>`, `<cite>`, `<q>`, `<blockquote>` used properly); proper heading hierarchy.

The architecture is structural, not retrofit. Every page is AI-citable from day one.

### 2.11 Subscribe and corrections

**Subscribe.** Email + RSS. No paywall (option preserved for later). Email form with optional channel selection (articles, theses, predictions resolving, contradictions, weekly digest). Double opt-in. Clear statement: no tracking, no sharing, unsubscribe in every email. RSS feeds per surface and per thesis.

**Corrections log.** Every correction ever, publicly. Each entry: what changed, when, why, which item was affected, link to corrected version. Statistics at top: total corrections, corrections this year, mean time from publication to correction. Credibility-building.

### 2.12 Reading the public site from substrate

The public site reads from `pub_*_cache` tables via Supabase PostgREST with anon key. The operator app writes to substrate; background jobs materialize public-facing views into the cache tables; the public site reads from the cache. This separation keeps public reads cheap and lets the cache be optimized for SSR/ISR.

When a thesis updates in the operator app, the cascade triggers a `pub_theses_cache` rebuild for that thesis. The Next.js public site uses Incremental Static Regeneration to revalidate within seconds.

---

## 3. THE API SURFACE

The API is the contract between the operator app frontend and the backend, plus the contract for external systems integrating with the substrate (webhooks in; subscriber emails out; RSS feeds out).

### 3.1 Conventions

**Base URLs.**
- Operator API: `https://api.canopticon.com/v1`
- Public API: served via Supabase PostgREST at `https://[supabase].supabase.co/rest/v1/` for `pub_*_cache` tables (anon key)
- Webhook intake: `https://api.canopticon.com/wh/v1`

**Authentication.**
- Operator API: `Authorization: Bearer <supabase_jwt>` on every request. Supabase issues JWTs via standard auth flow. Workers backend validates against Supabase JWKS, extracts user_id, lets RLS scope queries.
- Public API: no auth. RLS policies on `pub_*_cache` tables permit anonymous reads.
- Webhook intake: provider-specific HMAC signature per provider.

**Content type.** `application/json`, UTF-8.

**Timestamps.** ISO-8601 with timezone, UTC on the wire.

**UUIDs.** RFC 4122 v4 lowercase strings.

**Pagination.** Cursor-based: `?cursor=<opaque>&limit=<int>`. Response includes `next_cursor` and `total_estimate`.

**Field naming.** snake_case in JSON, matching database columns.

**Idempotency.** Mutating endpoints accept `Idempotency-Key: <uuid>` header. Repeated requests with the same key within 24 hours return the original response. Required for cost-incurring operations.

**Versioning.** Path-prefixed (`/v1`). Breaking changes require a new prefix.

### 3.2 Error format

Every error response:

```json
{
  "error": {
    "code": "string_machine_code",
    "message": "Human-readable string",
    "details": { /* optional */ },
    "request_id": "uuid",
    "documentation_url": "https://docs.canopticon.com/errors/<code>"
  }
}
```

HTTP status codes: 200 success, 201 created, 202 accepted (async), 204 no content, 400 malformed, 401 unauthenticated, 403 not authorized, 404 not found, 409 conflict, 422 validation error, 429 rate limited, 451 cost-blocked, 500 internal, 503 unavailable.

Error codes are namespaced strings: `auth.token_expired`, `cost.ceiling_reached`, `cost.operation_not_whitelisted`, `workflow.cascade_already_running`, `substrate.entity_not_found`, `publish.blocked_by_premortem`, etc.

### 3.3 Rate limiting

- Read endpoints: 600 req/min per user
- Write endpoints: 60 req/min per user
- Workflow triggers: 10/min per user (debounces "Run Cascade")
- Public API reads: 1000 req/min per IP
- Webhook intake: 100 req/min per provider domain

Exceeded limits return 429 with `Retry-After` header.

### 3.4 Resource endpoints

CRUD endpoints for substrate. Most match Supabase's PostgREST auto-generation closely; the operator API specifies these explicitly as the authoritative contract, with extra logic (cost gating, role triggering, cache invalidation) layered on the database.

```
Sources
  GET    /v1/sources                          # list with filters
  GET    /v1/sources/:id
  POST   /v1/sources                          # operator URL/text upload
  POST   /v1/sources/upload                   # multipart file upload to R2
  GET    /v1/sources/:id/critic-report
  POST   /v1/sources/:id/approve
  POST   /v1/sources/:id/defer
  POST   /v1/sources/:id/reject
  PATCH  /v1/sources/:id

Entities
  GET    /v1/entities
  GET    /v1/entities/:id
  GET    /v1/entities/:id/claims
  GET    /v1/entities/:id/timeline
  POST   /v1/entities                         # manual creation
  PATCH  /v1/entities/:id
  POST   /v1/entities/:id/merge               # body: merge_into_entity_id, reasoning
  POST   /v1/entities/:id/split

Claims
  GET    /v1/claims
  GET    /v1/claims/:id                       # full Toulmin + sources + entities
  GET    /v1/claims/:id/versions
  POST   /v1/claims                           # operator-authored
  PATCH  /v1/claims/:id                       # creates new version
  POST   /v1/claims/:id/verify                # cost-gated, invokes Verifier
  GET    /v1/claims/:id/verification

Theses
  GET    /v1/theses
  GET    /v1/theses/:id
  GET    /v1/theses/:id/versions
  GET    /v1/theses/:id/inbox
  GET    /v1/theses/:id/watch_set
  POST   /v1/theses
  POST   /v1/theses/:id/versions
  POST   /v1/theses/:id/inbox/:claim_id       # body: action (integrate/reject/defer)
  POST   /v1/theses/:id/watch_set             # body: entity_id, pin_type
  DELETE /v1/theses/:id/watch_set/:id
  POST   /v1/theses/:id/publish               # invokes publish-prep workflow
  POST   /v1/theses/:id/regenerate_tiers

Predictions
  GET    /v1/predictions
  GET    /v1/predictions/:id
  POST   /v1/predictions                      # bank a new prediction
  POST   /v1/predictions/:id/resolve          # body: outcome, evidence_source_id
  POST   /v1/predictions/:id/retract

Contradictions
  GET    /v1/contradictions
  GET    /v1/contradictions/:id
  POST   /v1/contradictions/:id/steelman      # invokes steelman workflow
  POST   /v1/contradictions/:id/resolve       # body: posture, reasoning

Articles
  GET    /v1/articles
  GET    /v1/articles/:id
  GET    /v1/articles/:id/versions
  POST   /v1/articles                         # create draft
  PATCH  /v1/articles/:id                     # creates new version
  POST   /v1/articles/:id/publish             # invokes publish-prep workflow
  POST   /v1/articles/:id/correction

Productions
  GET    /v1/productions
  GET    /v1/productions/:id
  POST   /v1/productions                      # operator-authored production
  PATCH  /v1/productions/:id
  POST   /v1/productions/:id/start_recording
  POST   /v1/productions/:id/pause_recording
  POST   /v1/productions/:id/finish_recording  # transitions to producing
  POST   /v1/productions/:id/publish

Beats
  GET    /v1/scripts/:script_id/beats
  POST   /v1/beats/:id/recording               # multipart upload of recording for one beat
  PATCH  /v1/beats/:id                          # edit text or skip
  POST   /v1/beats/:id/rerecord                 # mark for re-record

Indicators / Assumptions / Questions / Books — standard CRUD
```

### 3.5 Workflow endpoints

```
POST   /v1/cascade/run                        # body: scope, max_cost_cents
GET    /v1/cascade/runs
GET    /v1/cascade/runs/:id
POST   /v1/cascade/runs/:id/resume
POST   /v1/cascade/runs/:id/cancel

POST   /v1/workflows/publish_thesis/:id
POST   /v1/workflows/publish_article/:id
GET    /v1/workflows/publish_runs/:id
POST   /v1/workflows/publish_runs/:id/confirm
POST   /v1/workflows/publish_runs/:id/cancel

POST   /v1/workflows/invoke_role               # generic role invocation
GET    /v1/workflows/role_invocations/:id
```

Cost-gated endpoints return 202 with `cost_approval_required` link if the operation requires operator approval. The frontend opens the cost approval modal at that URL.

### 3.6 Queue endpoints

```
GET    /v1/queues/sources                     # pending Critic-reviewed sources
POST   /v1/queues/sources/:id/approve         # body: notes, skip_extraction, auto_run_verifier
POST   /v1/queues/sources/:id/reject
POST   /v1/queues/sources/:id/defer

GET    /v1/queues/entity_resolution
POST   /v1/queues/entity_resolution/:id/match  # body: entity_id
POST   /v1/queues/entity_resolution/:id/new_entity
POST   /v1/queues/entity_resolution/:id/defer

GET    /v1/queues/claim_deduplication
POST   /v1/queues/claim_deduplication/:id/duplicate  # body: merge_into_claim_id
POST   /v1/queues/claim_deduplication/:id/refinement
POST   /v1/queues/claim_deduplication/:id/contradiction
POST   /v1/queues/claim_deduplication/:id/distinct
POST   /v1/queues/claim_deduplication/:id/defer

GET    /v1/cost/approvals
GET    /v1/cost/approvals/:id
POST   /v1/cost/approvals/:id/approve
POST   /v1/cost/approvals/:id/deny
POST   /v1/cost/approvals/:id/whitelist        # approves AND adds whitelist rule
```

### 3.7 Aggregate endpoints

```
GET    /v1/live                               # the operator's main feed (UNION query)
GET    /v1/system/health                      # full operator dashboard data
GET    /v1/metrics/brier                      # rolling Brier with breakdowns
GET    /v1/metrics/brier/by_domain
GET    /v1/metrics/brier/by_horizon
GET    /v1/graph/entity/:id/neighbors         # adjacency neighbors with depth
GET    /v1/graph/path                         # body: from_id, to_id; returns shortest path
GET    /v1/graph/centrality                   # cached entity centrality
GET    /v1/search                             # cross-substrate search
GET    /v1/system/roles/recent                # recent role_invocations across roles
GET    /v1/system/roles/:role_name/recent
GET    /v1/system/roles/invocations/:id
```

### 3.8 Realtime / SSE

```
GET    /v1/orchestrator/events                # SSE stream of orchestrator_events filtered by user_id
```

The SSE stream is the operator app's transport for events that don't naturally map to substrate row changes — cascade step progress, cost approval prompts, role invocation completion. Substrate row changes themselves go through Supabase Realtime WebSockets directly to the frontend.

### 3.9 Public read endpoints

The public site reads via Supabase PostgREST against the anon key:

```
GET    /rest/v1/pub_articles_cache?slug=eq.<slug>
GET    /rest/v1/pub_theses_cache?slug=eq.<slug>
GET    /rest/v1/pub_predictions_cache
GET    /rest/v1/pub_contradictions_cache
GET    /rest/v1/pub_entities_cache?slug=eq.<slug>
GET    /rest/v1/pub_sources_cache?slug=eq.<slug>
GET    /rest/v1/pub_claims_cache?id=eq.<id>
```

The Next.js public site does these reads server-side during build/revalidation; the rendered HTML is what users actually fetch.

The site also serves directly:

```
GET    https://canopticon.com/feed.xml
GET    https://canopticon.com/feed/articles.xml
GET    https://canopticon.com/feed/theses.xml
GET    https://canopticon.com/feed/predictions.xml
GET    https://canopticon.com/feed/contradictions.xml
GET    https://canopticon.com/feed/theses/<slug>.xml
GET    https://canopticon.com/sitemap.xml
GET    https://canopticon.com/sitemap-articles.xml
GET    https://canopticon.com/sitemap-theses.xml
GET    https://canopticon.com/robots.txt
GET    https://canopticon.com/ai.txt
GET    https://canopticon.com/predictions.csv
GET    https://canopticon.com/openapi.yaml
```

### 3.10 Webhook intake

External providers POST here. Each has its own URL, signature scheme, and payload format.

```
POST   /wh/v1/youtube                         # YouTube PubSubHubbub
POST   /wh/v1/openparliament                  # openparliament.ca push
POST   /wh/v1/x_stream                        # X / Twitter filtered stream
POST   /wh/v1/generic/:source_handle          # operator-defined webhooks
```

Plus internal endpoints triggered by Cloudflare Workers cron:

```
[internal] /wh/v1/cron/hansard                # configurable cadence
[internal] /wh/v1/cron/news_rss
[internal] /wh/v1/cron/lobbying
[internal] /wh/v1/cron/statscan
```

All webhook intake is gated by `users.ingestion_apis_enabled`. When the toggle is FALSE, webhook endpoints return 503 and cron handlers no-op.

### 3.11 OpenAPI

A full OpenAPI 3.1 spec is auto-generated and served at:

```
GET    https://canopticon.com/openapi.yaml
GET    https://canopticon.com/docs            # interactive Swagger UI
```

The OpenAPI spec is the contract. This document is the prose explanation. When they conflict, the OpenAPI spec wins.

---

## 4. ACCESSIBILITY AND PERFORMANCE

The operator app and the public site both target:

**Performance budgets** (public site especially):
- First Contentful Paint < 1.0s on 4G
- Largest Contentful Paint < 2.0s
- Total page weight < 500KB excluding images for article pages
- No blocking third-party scripts
- Minimal JavaScript — most pages work with JS disabled

**Accessibility** (both surfaces):
- WCAG 2.2 AA minimum
- Proper heading hierarchy (one h1 per page)
- Alt text on every meaningful image
- Color contrast 4.5:1 minimum (easy with both palettes)
- Keyboard-navigable everywhere
- Reader-mode compatibility
- Reduced-motion respected (the Live feed's pulse, the recording chip, the cascade indicator all check `prefers-reduced-motion`)

The operator app additionally:
- Works at 375px width minimum (small phones)
- Touch targets 44pt minimum
- One-thumb operability for all primary actions

The public site additionally:
- Server-side rendering everywhere (Next.js with ISR)
- Print stylesheet for article and thesis pages
- BibTeX / Chicago / APA citation generation for academic readers

---

## 5. CONNECTING THE TWO

The operator app and public site share substrate. The relationship is:

- Operator writes to substrate via the operator API
- Background jobs materialize `pub_*_cache` from substrate when public-flagged rows change
- Public site reads `pub_*_cache` via PostgREST

This means the public site is always derived from the operator's substrate. Corrections, new versions, contradictions resolved, predictions banked — all flow from operator action through substrate to the public surface within seconds.

The architecture preserves the disciplines: the public site cannot show anything the operator hasn't reviewed, because publishing requires `is_public = TRUE` which only gets set through the publish-prep workflow which runs Premortem and Red Team and the Verifier sweep before flipping the flag.
