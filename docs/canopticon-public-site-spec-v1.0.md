# CANOPTICON Public Site — UI Specification v1.0

**Domain:** canopticon.com
**Access:** fully public, no paywall (paywall option preserved for future)
**Comments:** none. A contribute/tip surface may be added later.
**Relationship to operator app:** same system, same data substrate, different publisher. The operator app is the newsroom (dark, dense, console). The public site is the published paper (light, editorial, long-form).

This document specifies every public-facing surface, its contents, its controls, its transitions, and its structured-data emissions. Fourteen surfaces: seven editorial, four reference-grade (auto-generated from substrate), three utility.

---

## 0. DESIGN PRINCIPLES

**Editorial, not operational.** The public site is where someone lands for five minutes. The operator lives in the app for hours. The registers are opposite by design.

**Light, not dark.** Off-white background, charcoal text, red and amber as editorial accents. Dark-mode publications don't carry credibility the way light-mode editorial pages do, and this is a credibility product.

**Long-form first.** The unit of consumption is a full article, thesis dossier, or prediction ledger — not a stream of updates. Minimal UI chrome. Content is the product.

**Citations inline and explicit.** Every claim shows its source. Not "sources available on request." Every claim links to its source page on the site so the reader can audit.

**Receipts tucked, not hidden.** The audit trail is accessible but not the top surface. A footnote layer, a "see sources" drawer, an entity-page hyperlink from any name — the auditing reader can always drill down.

**Machine-readable natively.** Every page emits schema.org structured data, clean semantic HTML, Open Graph metadata, sitemap entries, RSS feeds. AI-search (GEO) visibility is structural, not retrofit.

**No editorializing in the content.** Declarative, evidence-first voice. Conclusions emerge from assembled facts. This is the Moose-on-the-Loose style carried forward. The site's *chrome* (taglines, section labels, about page) can have voice; the *content* should not.

**Corrections are visible, not hidden.** Every correction is logged publicly with what changed, when, why. This is credibility-building, not weakness.

---

## 1. AESTHETIC REGISTER

**Palette**

- **Paper:** #f5f1e8 (warm off-white, slight cream tint — lives in the logo's cream family)
- **Paper deeper:** #ebe6d8 (for section backgrounds, pull-quote fills)
- **Ink:** #1a1816 (primary text — not pure black, slightly warm)
- **Ink dim:** #5a564f (secondary text, metadata)
- **Ink faint:** #8a8578 (timestamps, minor labels)
- **Rule:** #c9c2b0 (hairlines, borders)
- **Signal red:** #9c2333 (editorial accent — drop caps, pull-quote marks, contradiction flags, hot predictions)
- **Amber:** #8a6520 (prediction confidence markers, caution states, machloket flags)
- **Sage:** #5a7349 (verified/grounded claim markers, resolved-correct predictions)
- **Muted blue:** #4c617e (question markers, framing-layer accents)

The public palette is the operator palette *inverted* — same hues, flipped values. Paper instead of pitch, ink instead of cream. This keeps the system coherent while making the two surfaces visually distinct.

**Typography**

- **Display:** EB Garamond (serif). Headlines, body copy, pull quotes. Same face as the operator app — continuity of voice.
- **Sans display:** GT Sectra or similar editorial serif for tall headlines (optional — can use EB Garamond weight 700 if constraints apply).
- **Mono:** JetBrains Mono (same as operator app). Metadata, timestamps, citation labels, claim IDs, prediction confidence percentages.

**Grain and texture.** Same subtle SVG grain overlay as the operator app, but at 2% opacity on paper (lighter surface needs less). Very subtle. Feels like print.

**Grid.** 12-column desktop, single-column mobile, two-column tablet. Max content width ~680px for article body (optimal line length ~65 characters). Wider for index pages and the ledger.

**Logo.** Same CAN + OPTICON wordmark, but the color split inverts: CAN in charcoal, OPTICON in signal red. Same pulse dot. Same fonts. Mobile: same 23px; desktop masthead: 32px.

**Drop caps.** The first letter of every article and thesis page is a three-line serif drop cap in signal red. Small thing but signals "this is editorial."

**Pull quotes.** Large italic EB Garamond, paper-deeper background block, red quotation marks, 1.6 line-height. Break the column grid deliberately.

**Hairline rules.** Thin (0.5px) charcoal rules separate sections. More elegant than card-based UI.

**No hover effects that matter on mobile.** Every interaction has to work by tap. Hover is a desktop-only delight, never a requirement.

---

## 2. PAGE INVENTORY (14 surfaces)

### EDITORIAL SURFACES (seven)

1. **Homepage (`/`)** — the living masthead
2. **Article page (`/articles/{slug}`)** — single published article
3. **Thesis page (`/theses/{slug}`)** — living dossier
4. **Prediction ledger (`/predictions`)** — public Brier record
5. **Contradiction tracker (`/contradictions`)** — machloket registry
6. **Methodology (`/methodology`)** — how this works
7. **About (`/about`)** — who's behind it

### REFERENCE-GRADE SURFACES (four — auto-generated per record)

8. **Entity page (`/entities/{slug}`)** — one per entity
9. **Source page (`/sources/{slug}`)** — one per source
10. **Claim page (`/claims/{id}`)** — one per atomic claim
11. **Glossary (`/glossary`)** — public vocabulary

### UTILITY SURFACES (three)

12. **Subscribe (`/subscribe`)** — email + RSS
13. **Search (`/search`)** — cross-surface
14. **Corrections log (`/corrections`)** — every correction ever

---

## 3. HOMEPAGE

**Purpose.** The masthead of the publication. Tell a first-time visitor what this is in 15 seconds. Tell a returning visitor what's new in 5.

**Layout (desktop, top to bottom):**

- **Masthead band.** Centered CANOPTICON wordmark (32px). Tagline below in mono 10px: *Forensic intelligence · Canada.* Hairline rule. Date strip: today's date, number of live theses, number of running predictions, rolling Brier score.
- **Lead story.** Full-width. Most recent or highest-weight article. Headline (EB Garamond 42px mobile / 56px desktop), italic subhead, drop cap, 2–3 lines of excerpt, read-time, source count, "Read full article" affordance. No image unless we have one that's actually ours — stock photography kills credibility.
- **Theses in progress.** Three-column grid (single column on mobile). Each card: thesis title, current IPCC likelihood qualifier, layer count, claim count, last-updated stamp, one-sentence current state. Cards are quiet — thin border, no shadow.
- **Running predictions.** A horizontal strip. Up to six active predictions with their confidence percentages and resolution horizons. Serves both as content and as credibility signal.
- **Recent contradictions.** A small section: "Currently held as machloket" — two or three open contradictions we're tracking publicly. This is a differentiator; surface it.
- **What changed this week.** A narrow column. Bulleted, timestamped list of substantive changes: "Thesis X gained three A-grade sources," "Prediction Y resolved correct," "New contradiction surfaced on BoC 1974." Reads like a changelog. Builds the feeling of a living system.
- **Footer.** Masthead wordmark (smaller), nav links (methodology, about, predictions, contradictions, glossary, corrections, subscribe, RSS), last-updated timestamp.

**Controls.**
- Nav bar at top: HOMEPAGE · ARTICLES · THESES · PREDICTIONS · CONTRADICTIONS · METHODOLOGY · ABOUT
- Subscribe button (primary) — emails you when new theses or articles publish
- RSS icon — subscribes at the feed level

**Structured data.**
- `schema.org/NewsMediaOrganization` for the publisher
- `schema.org/CollectionPage` for the homepage
- `schema.org/Article` nested for each lead-story card
- Open Graph: site title, site description, canonical homepage image
- `application/rss+xml` autodiscovery link

**Transitions.**
- Tap article → article page
- Tap thesis card → thesis page
- Tap prediction → prediction ledger with that prediction highlighted
- Tap contradiction → contradiction tracker
- Tap what-changed item → relevant article/thesis/prediction

---

## 4. ARTICLE PAGE

**Purpose.** A single published article, stand-alone and shareable. Must work equally well as the landing page for a social-media click and as something the reader arrives at via search.

**Layout:**

- **Header.** Breadcrumb: *Articles › [Category]*. Article title (EB Garamond 48px mobile / 64px desktop, weight 500). Italic subhead if present. Byline: *CANOPTICON · [publication date] · [last-updated if newer] · [read time]*. Signal-red drop cap on first paragraph.
- **Body.** Single column, max 680px width on desktop. Paragraphs separated by line spacing, not indent. Section breaks marked by three-dot hairline dingbat (· · ·). Pull quotes break out into full-width-plus blocks with paper-deeper background.
- **Inline citations.** Every factual claim carries a small superscript number or bracketed citation like `[SEDAR+ 2021-04-08]` linking to the source page. Hover/tap reveals the citation in a tooltip; click navigates to the source page.
- **Claim links.** Every structurally-important claim in the article is linked to its claim page — a small dotted underline marks linked claims. Readers who want to audit can drill down; readers who don't can just read.
- **Sidebar (desktop) / bottom panel (mobile).** "Related thesis" card — the thesis this article draws from. "Related predictions" — predictions this article informs or is informed by. "Sources used" — a count with a drawer toggle revealing the list. "Entities mentioned" — chips linking to entity pages.
- **End matter.** "Corrections: none" or "Corrections: 2 (last: April 14, 2026)" with link. Version number. "Published under the CANOPTICON editorial standard" — links to methodology.
- **Footer.** Standard site footer.

**Controls.**
- Share (copy link, X, email, Mastodon, Bluesky)
- Read in reader mode (strip chrome entirely)
- Cite this article (generates BibTeX, Chicago, APA — important for the research-grade reader)
- Report correction (opens form; submissions go to operator)

**Structured data.**
- `schema.org/Article` with author, datePublished, dateModified, publisher, headline, articleBody, citation array
- `schema.org/ClaimReview` nested for each verified claim in the article
- Open Graph: title, description, canonical image (can be auto-generated from article), article:published_time, article:modified_time
- Twitter Card: summary_large_image

**Transitions.**
- Tap citation → source page
- Tap claim link → claim page
- Tap related thesis → thesis page
- Tap entity chip → entity page
- Tap prediction → prediction ledger

---

## 5. THESIS PAGE

**Purpose.** A living document, not an article. The reader sees the current state of a thesis CANOPTICON is actively building: what it argues, what it's based on, what it's vulnerable to, what would change its confidence level.

This is the surface that differentiates CANOPTICON most sharply from journalism. Journalism publishes and moves on. A thesis page updates continuously and tells you it's updating.

**Layout:**

- **Header.** Breadcrumb: *Theses › [Thesis name]*. Thesis title (EB Garamond 52px desktop). Italic one-sentence seed. Status strip: *v0.4 · In progress · Declared Feb 11, 2026 · Last updated 4h ago · 47 claims integrated · IPCC likelihood: Likely*.
- **BLUF.** Full-width quote block. The thesis's one-sentence BLUF with the IPCC likelihood qualifier in italic red. This is the most important single element on the page.
- **Tier switcher.** A row of tabs: BLUF / 80 words / 800 words / Full. Readers pick their depth. Default is 80.
- **Layer decomposition.** Four expandable sections: Factual, Framing, Architectural, Distributive. Each shows its claim count, A-grade dominance, and two-sentence description. Tap to expand and see the claims.
- **Assumptions & linchpins.** A section that explicitly names what the thesis assumes and which assumptions are load-bearing (linchpins). Each assumption shows its current status: holding, weakening, failed. This is unusual for a publication. It's a credibility feature.
- **Open questions.** The Interrogator-generated questions that remain unanswered. Gives the reader a sense of what's still uncertain.
- **Contradictions tracked.** Any contradictions relevant to this thesis. Shows posture (open, resolving, machloket).
- **Predictions anchored to this thesis.** If the thesis makes probabilistic predictions, they're listed here with confidence and horizon.
- **Version history.** A small drawer at the end. Every version of the thesis with a diff summary — "v0.3 → v0.4: +3 claims in architectural layer, +1 linchpin weakened."
- **End matter.** Sources used (count + drawer), entities central to thesis, related articles, subscribe-to-updates affordance.

**Controls.**
- Subscribe to this thesis (email when it updates)
- Share
- Cite (same citation export as articles)
- Report a problem
- View version history

**Structured data.**
- `schema.org/Report` (most accurate type for a living document of this kind)
- `schema.org/ClaimReview` for each claim in the layer decomposition
- `schema.org/Dataset` for the prediction set anchored to the thesis
- Open Graph with thesis title, current BLUF as description
- Twitter Card

**Transitions.**
- Tap layer → expand inline, showing claims with citations
- Tap claim → claim page
- Tap assumption → assumption detail (or link to explanation)
- Tap question → question page (if we make question pages) or just expand inline
- Tap contradiction → contradiction tracker
- Tap prediction → prediction ledger with prediction highlighted
- Tap entity → entity page
- Tap source (via citation) → source page
- Tap version-history item → diff view

---

## 6. PREDICTION LEDGER

**Purpose.** The site's central credibility mechanism. Every probabilistic prediction CANOPTICON has ever banked, with confidence level, time horizon, resolution criterion, and outcome. Running Brier score visible. Track record broken down by domain and horizon.

This is the page that separates CANOPTICON from a blog that feels good. Over time, the ledger becomes the asset.

**Layout:**

- **Header.** *Prediction Ledger.* Subhead: *Every probabilistic call we've banked, and how they've resolved.* Status strip: *Active: 14 · Resolved: 9 · Rolling Brier: 0.142 · Best domain: Monetary policy (0.08) · Worst domain: Electoral outcomes (0.24).*
- **Summary row.** A Brier sparkline or rolling-12-prediction chart. Accuracy by confidence bucket (were 70%-confidence predictions right ~70% of the time? the calibration question).
- **Active predictions table.** For each active prediction: the claim, confidence percentage, resolution criterion, horizon, date banked, source thesis (if any). Sort by horizon, confidence, date, domain.
- **Resolved predictions table.** For each resolved: the claim, original confidence, outcome (correct/incorrect/ambiguous), Brier contribution, resolution evidence with link.
- **By domain.** Breakdown: monetary policy, electoral outcomes, corporate filings, policy announcements, etc. Brier per domain.
- **By horizon.** Short (< 3mo), medium (3–12mo), long (> 12mo). Brier per horizon.

**Controls.**
- Filter by domain, confidence bucket, horizon, status (active/resolved)
- Sort by date, confidence, horizon
- Export full ledger as CSV (research-grade affordance — important)
- Subscribe to ledger updates

**Structured data.**
- `schema.org/Dataset` with prediction records as `DataRecord`s
- Each prediction also emits `schema.org/Claim` with `confidenceInterval` where appropriate
- `application/csv` download advertised in `<link rel="alternate">`
- Open Graph with current rolling Brier as key metric

**Transitions.**
- Tap prediction → prediction detail (full resolution criteria, evidence gathered so far)
- Tap source thesis → thesis page
- Tap domain filter → filtered view

---

## 7. CONTRADICTION TRACKER

**Purpose.** Publicly visible list of contradictions currently held by the system. Four postures: open (actively being resolved), resolved-one-way, resolved-other-way, machloket (preserved deliberately).

This page is unusual. Journalism hides its contradictions because it presents finished stories. Academia hides them in footnotes. CANOPTICON surfaces them as a core product because acknowledging what isn't settled is the most credible move a publication can make.

**Layout:**

- **Header.** *Contradictions.* Subhead: *What the graph can't reconcile, and why.* Status strip: *Open: 8 · Resolved this year: 12 · Held as machloket: 3.*
- **Legend.** Four posture labels with definitions: Open (unresolved, actively investigated), Resolved (settled, with which source won), Machloket (preserved deliberately — both sides contribute to the picture). Brief, plain-language.
- **Open contradictions.** Full-width cards. Each: a two-line summary of the contradiction, the two competing claims with their sources, when it was detected, which roles have run on it (Red Team, Steelman), current posture, related thesis.
- **Machloket registry.** Separate section. Contradictions we've deliberately decided to preserve. Same card format, with a paragraph explaining why this one is machloket rather than resolvable.
- **Resolved archive.** A chronological list. Compact. Each row: contradiction, when resolved, which way, what evidence tipped it. Click to expand.

**Controls.**
- Filter by posture, date, thesis
- Subscribe to contradictions feed

**Structured data.**
- `schema.org/CollectionPage`
- Each contradiction emits as a `schema.org/Claim` with `contradicts` property
- Machloket entries emit with a custom annotation

**Transitions.**
- Tap contradiction → contradiction detail page (full evidence, full history, full reasoning)
- Tap related thesis → thesis page
- Tap source → source page

---

## 8. METHODOLOGY

**Purpose.** Plain-language explanation of how CANOPTICON works. The public version of v1.5.1. Credibility-building. Also useful for AI search systems trying to characterize the publication.

**Layout:**

- **Header.** *How this works.* Subhead: *The methodology behind CANOPTICON's claims, grades, and predictions.* Estimated read time.
- **Section 1 — Sources and grading.** Admiralty A–F explained with examples. Which source types get which grades. What happens when a B-grade source is the only source.
- **Section 2 — Claims and evidence.** Toulmin warrant structure explained plainly. Van Evera tests with examples. Why every claim has a visible source.
- **Section 3 — The four layers.** Factual / Framing / Architectural / Distributive. With worked examples showing how the same topic decomposes differently across layers.
- **Section 4 — Predictions and calibration.** How predictions get banked, IPCC language, Brier scoring. The calibration charts link here.
- **Section 5 — Contradictions.** How contradictions get detected, the difference between resolvable and machloket, why preserving contradictions is a feature.
- **Section 6 — The roles.** The eleven roles explained briefly: what each does, when it runs, what it produces. Readable, not exhaustive.
- **Section 7 — Corrections and updates.** How corrections work, how version history works, how to report a problem.
- **End matter.** Link to full methodology doc (v1.5.1 markdown) for readers who want the complete technical spec. Link to glossary.

**Controls.**
- Jump to section (TOC)
- Print / PDF export
- Cite methodology (BibTeX, etc.)

**Structured data.**
- `schema.org/TechArticle` or `schema.org/AnalysisNewsArticle`
- OG, Twitter Card

**Transitions.**
- Tap section anchor → scroll
- Tap glossary term → glossary entry
- Tap "see full spec" → v1.5.1 markdown (hosted at canopticon.com/spec)

---

## 9. ABOUT

**Purpose.** Who makes this, why, what it's for. Shorter than methodology. More personal.

**Layout:**

- **Header.** *About CANOPTICON.*
- **Paragraph 1 — What it is.** One paragraph: forensic intelligence on Canadian political and economic structure.
- **Paragraph 2 — Why.** One paragraph: because most political coverage frames without structure, and most academic work structures without publication.
- **Paragraph 3 — Editorial standard.** One paragraph: no editorializing, conclusions from documented facts, contradictions preserved, track record public.
- **Byline.** Chris Telford. Brief bio — a few sentences, not a resume. Link to personal site / other writing.
- **Funding / independence.** One paragraph. If independent: "Currently self-funded. No advertising, no sponsorship, no institutional affiliation." When this changes, it's updated publicly.
- **Contact.** Email. No phone, no address. "For corrections, use the correction form. For tips or information, email [address]." A tip/contribute surface may be added later.
- **Footer.** Publisher name, canopticon.com, year.

**Structured data.**
- `schema.org/AboutPage`
- `schema.org/Person` (Chris Telford) with `jobTitle` etc.
- Publisher's `NewsMediaOrganization` markup

---

## 10. ENTITY PAGE (generated)

**Purpose.** One page per entity in the graph: every person, institution, corporation, event, piece of legislation, concept. Auto-generated from the Claim Graph.

**Layout:**

- **Header.** Entity name as headline. Type below (Person / Corporation / Institution / Legislation / Concept / Event). Grade. Stats: relations count, claims count, first mentioned, last mentioned.
- **Plain-language summary.** A few sentences describing the entity. Auto-generated from the highest-grade claims, reviewed by Tier Projector role.
- **Timeline.** Horizontal timeline of events/claims involving this entity, oldest to newest. Hoverable/tappable markers.
- **Relations.** List of other entities this one is linked to. Each with the relation type, claim count, and a link to the relation detail.
- **Claims about this entity.** Sortable table. Each claim with its grade, source, date, verification status.
- **Theses mentioning this entity.** If this entity is on any thesis's watch-set, list those theses.
- **Predictions touching this entity.** Predictions that concern this entity.
- **Related entities (suggested).** Cluster of entities with the most shared relations — an implicit "see also."

**Controls.**
- Filter claims by grade, source, date, verification status
- Show/hide resolved-unverified claims
- Export entity sheet as structured data

**Structured data.**
- `schema.org/Person`, `Organization`, `Legislation`, `Event`, or `DefinedTerm` depending on type
- Each claim as `schema.org/Claim` with `about` linking to this entity
- Heavy structured data because these pages are the primary AI-search-visible surface

**Transitions.**
- Tap relation → other entity page
- Tap claim → claim page
- Tap source (in claim row) → source page
- Tap thesis → thesis page
- Tap prediction → prediction ledger

---

## 11. SOURCE PAGE (generated)

**Purpose.** One page per source. Transparency surface.

**Layout:**

- **Header.** Source title / document name. Metadata: URL if external, publication date, author, Admiralty grade, bias profile (if known).
- **What we extracted.** List of claims extracted from this source, with their grades and current status.
- **Entities identified.** List of entities this source mentions.
- **Citations.** Articles, theses, and predictions that cite this source.
- **Ingestion provenance.** When ingested, how (webhook / cron / operator upload / research brief), which Critic report was generated. A condensed version of the Critic's assessment.
- **Corrections affecting this source.** If we've corrected anything based on a later re-reading, it's noted here.

**Controls.**
- View original (outbound link — clearly marked as leaving the site)
- Report a problem with extraction

**Structured data.**
- `schema.org/CreativeWork` (book, article, report, transcript — subclass as appropriate)
- Each extracted claim linked via `citation` property
- Provenance data

**Transitions.**
- Tap claim → claim page
- Tap entity → entity page
- Tap citing article → article page
- Tap citing thesis → thesis page

---

## 12. CLAIM PAGE (generated)

**Purpose.** One page per atomic claim in the graph. The reference-grade surface.

**Layout:**

- **Header.** The claim itself, rendered as a prominent serif statement. Metadata: claim ID, Admiralty grade, verification status (grounded / partial / unsupported), when first claimed, when last verified.
- **Toulmin structure.** Laid out explicitly:
  - *Data:* what observable fact the claim rests on
  - *Warrant:* the inference rule from data to claim
  - *Backing:* what supports the warrant
  - *Qualifier:* IPCC likelihood qualifier if applicable
  - *Rebuttal:* known counterarguments
- **Sources supporting.** List with grades and links.
- **Sources contradicting.** List with grades and links (if any).
- **Verification history.** Log of verification runs: which role, when, result.
- **Entities involved.** Chips linking to entity pages.
- **Used in.** Articles, theses, predictions that rest on this claim.
- **Contradictions.** If this claim is part of a registered contradiction, link to the contradiction tracker entry.

**Structured data.**
- `schema.org/Claim` with all properties populated
- `schema.org/ClaimReview` with `reviewRating` (using the verification status)
- Heavy structured data — these are the AI-search extraction targets

**Transitions.**
- Tap source → source page
- Tap entity → entity page
- Tap article/thesis using claim → respective page
- Tap contradiction → contradiction tracker

---

## 13. GLOSSARY

**Purpose.** Public version of the internal glossary. Readable, linked, searchable.

**Layout:**

- **Header.** *Glossary.* Brief explanation of what's here.
- **Sections mirrored from internal glossary:**
  - Epistemic vocabulary
  - CANOPTICON-specific vocabulary
  - Operational vocabulary
  - Philosophical terms
  - Regional Canadian vocabulary
- Each entry: term, plain definition, CANOPTICON-specific usage, source/attribution.
- Hyperlinked — every term that appears in articles, theses, and methodology pages links back to its glossary entry.

**Controls.**
- Search / filter
- Jump-to-letter alphabetic nav

**Structured data.**
- `schema.org/DefinedTermSet` with each entry as `DefinedTerm`

---

## 14. SUBSCRIBE

**Purpose.** Email + RSS. No paywall now; architecture preserves the option.

**Layout:**

- **Header.** *Subscribe.* Subhead: *Email updates, RSS feeds, or follow on X / Mastodon / Bluesky.*
- **Email form.** Email address. Optional: which categories to receive (articles, theses, predictions resolving, contradictions, weekly digest). Double opt-in. Clear statement: no tracking, no sharing, unsubscribe in every email.
- **RSS section.** Feed URLs:
  - `/feed.xml` — everything
  - `/feed/articles.xml`
  - `/feed/theses.xml`
  - `/feed/predictions.xml`
  - `/feed/{thesis-slug}.xml` per thesis
- **Social.** Links to X, Mastodon, Bluesky.

**Controls.**
- Subscribe email
- Copy RSS URL

**Structured data.**
- Standard RSS autodiscovery links in page head

---

## 15. SEARCH

**Purpose.** Find anything on the site. Cross-surface.

**Layout:**

- **Header.** Search input dominates. Large, centered.
- **Results grouped by surface type:** Articles, Theses, Predictions, Entities, Sources, Claims, Glossary entries.
- **Result cards.** Compact. Title, snippet with match highlighted, surface type label, last-updated.

**Controls.**
- Filter by surface type
- Sort by relevance / recency
- Keyboard shortcut: `/` focuses the search

**Implementation note.** Static-site search (Pagefind, Lunr) initially. Upgrade to a real search backend if/when volume demands it.

---

## 16. CORRECTIONS LOG

**Purpose.** Every correction ever made, publicly. Credibility-building.

**Layout:**

- **Header.** *Corrections.* Subhead: *Every correction made since CANOPTICON launched.*
- **Table/log entries.** Each correction: what changed, when, why, which article/thesis/claim was affected. Link to the corrected item. The old incorrect state is preserved in version history and linked.
- **Statistics.** Total corrections to date, corrections this year, mean time from publication to correction.

**Controls.**
- Filter by affected surface type
- Sort by date

**Structured data.**
- `schema.org/CollectionPage`
- Each correction as an entry with `datePublished`, `about` (the affected item), `description`

---

## 17. AI-SEARCH ARCHITECTURE (GEO)

**Purpose.** Make CANOPTICON visible and quotable inside AI search products (ChatGPT, Claude, Perplexity, Google AI Overviews, Gemini).

**Core principle.** AI search engines extract *structured, attributable, verifiable claims* from pages and cite them. A publication that serves those claims natively — with schema.org `Claim`, `ClaimReview`, `Report`, `Dataset` types — gets cited. A publication that buries claims in flowing prose does not.

CANOPTICON's Claim Graph already produces exactly the kind of structured evidence AI search wants. The public site just needs to *emit* it.

**Specific requirements:**

**Structured data per surface.**
- Article pages: `schema.org/Article` + nested `ClaimReview` for every verified claim
- Thesis pages: `schema.org/Report` + `Claim` + `ClaimReview` per claim
- Prediction ledger: `schema.org/Dataset` with prediction records
- Claim pages: `schema.org/Claim` + `ClaimReview` with full Toulmin properties
- Entity pages: `schema.org/Person`/`Organization`/etc. with `mentionedIn` crossreferences
- Source pages: `schema.org/CreativeWork` subclass with `citation` to extracted claims

**`/ai.txt` file.** A new (informal but gaining adoption) convention — a plain-text file at the root that describes the publication for AI crawlers. Includes: what the publication is, its editorial standard, how to cite it, which sections are stable vs. updating. We publish one.

**`robots.txt` permitting AI crawlers explicitly.** Allow GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Bingbot. The goal is to be cited, not protected. (The default deny-AI stance makes sense for some publications; CANOPTICON wants citation.)

**Sitemap strategy.**
- `/sitemap.xml` — index
- `/sitemap-articles.xml`, `/sitemap-theses.xml`, etc. — one per surface type
- Change-frequency hints: theses update often, articles rarely, entity pages regularly
- Lastmod timestamps accurate

**Canonical URLs.** Every page has a clean canonical. No query-string variants. Trailing slash policy consistent.

**Open Graph + Twitter Card** on every page with appropriate type.

**RSS feeds** for every feed surface (articles, theses, predictions, per-thesis, contradictions, corrections).

**No `noindex` anywhere** except on the search results page itself.

**Server-side rendering.** Every page rendered as real HTML, not client-side React that crawlers can't read. This is non-negotiable for both traditional SEO and AI search.

**Clean semantic HTML.** `<article>`, `<section>`, `<aside>`, `<nav>`, `<time datetime=...>`, `<cite>`, `<q>`, `<blockquote>`, `<figure>` used properly. Headings nested correctly (one `<h1>` per page). `<abbr title="...">` on acronyms.

---

## 18. CONTENT PROVENANCE

Every published surface shows:

- **Publication date** (when it first went live)
- **Last updated** (when it last changed)
- **Version** (for theses and articles that have revisions)
- **Source count and grade distribution** ("14 sources: 9 A-grade, 4 B-grade, 1 C-grade")
- **Verification status** ("All claims cross-model verified" / "Partial verification: 11 of 14 claims grounded")
- **Corrections** ("No corrections" or "2 corrections")
- **Editorial standard link** (goes to methodology page)

This provenance strip appears at the end of every article and thesis, in mono 10–11px. It's a consistent credibility signal.

---

## 19. PERFORMANCE AND ACCESSIBILITY

**Performance budgets.**
- First Contentful Paint < 1.0s on 4G
- Largest Contentful Paint < 2.0s
- Total page weight < 500KB (excluding images) for article pages
- No blocking third-party scripts
- Minimal JavaScript — most pages work with JS disabled

**Accessibility.**
- WCAG 2.2 AA minimum
- Proper heading hierarchy
- Alt text on every meaningful image
- Color contrast 4.5:1 minimum (easy with paper/ink palette)
- Keyboard-navigable everywhere
- Reader-mode compatibility (semantic HTML makes this free)
- Reduced-motion respected

---

## 20. EDITORIAL STANDARDS (visible to reader)

Stated on methodology page, referenced in every article footer:

1. **No editorializing in content.** Declarative, evidence-first voice. Conclusions from documented facts.
2. **Every factual claim has a visible source.** If it doesn't, it's not a claim — it's framing, and it says so.
3. **Grades are honest.** A-grade means primary/official/verbatim. We don't upgrade.
4. **Contradictions are preserved.** Machloket is legitimate.
5. **Predictions are banked publicly with confidence.** Brier score is public.
6. **Corrections are public and logged.** Every one of them.
7. **No advertising, no sponsorship, no paid placement.** If this ever changes, it will be announced publicly.
8. **No AI-generated content without human review.** AI is used in the production pipeline (extraction, verification, drafting), but every published surface is operator-reviewed.
9. **No stock photography.** If we use an image, it's ours or properly licensed and credited.
10. **Open source where practical.** Methodology, schema, and glossary are public. Code may follow.

---

## 21. TECHNICAL IMPLEMENTATION (preview)

Full implementation spec is separate (see build handoff doc). Brief preview:

- **Stack.** Next.js (App Router) on Vercel, reading from the same Supabase/Postgres that the operator app writes to. Server-side rendered. Incremental Static Regeneration for theses and articles (revalidate on substrate updates).
- **Asset hosting.** Cloudflare R2 for any images, PDFs, data exports.
- **Search.** Pagefind (static-site search) initially. Re-evaluate at ~500 surfaces.
- **Analytics.** Plausible or similar privacy-friendly. No Google Analytics.
- **Email.** Buttondown, Beehiiv, or similar. Double opt-in.
- **RSS generation.** Build-time for stable feeds; dynamic for per-thesis feeds.
- **Structured data validation.** Schema.org validator check in CI. No deploy if structured data is broken.

---

## 22. ROLLOUT ORDER (when the time comes)

Not a timeline, a dependency order:

1. Homepage + Article page + Methodology + About (the minimum viable publication)
2. Thesis page + Entity pages + Source pages + Claim pages (reference-grade surfaces)
3. Prediction ledger + Contradiction tracker (credibility surfaces)
4. Search + Glossary + Corrections + Subscribe (utility)
5. AI-search architecture (structured data, ai.txt, sitemaps, RSS feeds) — can and should be live from day one, not last

Step 5 being last in the list doesn't mean it's deprioritized — it means it's woven through every previous step, not a separate surface.

---

## NOTES

This spec describes the public site as it should exist. It does not specify:

- Visual prototype (separate HTML artifact, to follow)
- Exact page-by-page HTML/CSS implementation (for build phase)
- Content production workflow (how articles get written, how theses evolve — partially covered by operator app workflows, separately for public editorial)
- Marketing / launch plan (out of scope)
- Monetization (explicitly deferred)

The prototype pass will focus on the homepage, an article page, and a thesis page — the three surfaces that define the register. Everything else follows that register.
