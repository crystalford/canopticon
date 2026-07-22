# The Record — canopticon's site, fully mapped

> The functional design of the core product: every surface, what's on it, how it
> functions, how it interlinks. This is the map the visual mockup realizes and the
> renderers implement. One product, one spine: **canopticon keeps files on power,
> and this site is the files.**

## The system in one sentence

Everything on the site is a node in one web — dossiers link to dossiers through
typed connections, investigations stand on dossiers, dossiers stand on sources,
sources show what they fed — so **no page is a dead end and every claim is at most
two clicks from the verbatim quote in the primary source.**

## The surfaces (five, not ten)

### 1. `/` — the front of the Record
Not a feed. Not a card grid. The **living state of the files**: which dossiers are
active (grew recently, and from what), the one lead investigation, the depth of the
record in numbers that mean something (subjects tracked · sources on file · claims
verified · claims killed), and the doorway to browse. The feeling on landing: *this
machine is watching, accumulating, and shows its receipts.* One screen of gravity,
then browse.

### 2. `/s/:slug` — the Dossier (THE core artifact)
One per entity / event / theme. This is the "profile worth the name." Anatomy, top
to bottom:

- **Identity strip** — name, kind, aliases, one-line designation, file metadata
  (opened, last updated, sources count). Reads like the cover of a file.
- **The established record** — facts with receipts. Every fact carries its inline
  citation chip; the chip opens the verbatim quote + source without leaving the page
  (details element — no JS needed to read).
- **The contested layer** — attributed assertions, visibly separated, who-said-what
  with stance. Never blended into the established record. This *is* the firewall,
  rendered.
- **Timeline** — the subject's events in time, each dated and receipted.
- **Connections** — the typed edges, as navigation: employer-of, funded-by,
  contradicts, party-to… each one a link to another dossier. This is how the web
  is *walked*, and what makes it a graph product instead of a page list.
- **On file** — the sources feeding this dossier, each linking to its source page.
- **The reading (seam)** — when the operator has signed a reading on this subject,
  it appears behind a visible seam: the neutral record above, the signed
  interpretation below, typographically distinct, with the mandatory
  what-complicates-this box. Unsigned subjects simply show the record.
- Every block has a stable anchor + JSON-LD. The dossier is the citable atom.

### 3. `/investigations` + `/i/:slug` — the signed layer
The editorial voice. An investigation is the operator's signed reading rendered as
long-form argument — but every load-bearing claim is a chip that resolves to a
dossier fact and its receipt. The investigation page ends in its **foundation**:
the dossiers it stands on, the sources behind them, what remains contested. The
index (`/investigations`) is the front door for social/video traffic.

### 4. `/doc/:slug` — the source page
One per document on file. What it is, where it came from, and — the signature move —
**what it fed the record**: the facts, assertions, and dossiers this document
produced, each linking back. The Library-as-nav-list dies; provenance becomes a
property of every page rather than a destination.

### 5. `/search` — ask the record
One box. Results are dossiers, facts (with receipts), investigations. The record is
queryable; this is also the GEO surface AI answers walk in through.

**Nav: Record · Investigations · Method.** (Method = the trust page: how
verification works, what killed means.) Search is the ever-present box. About folds
into Method. Library/Topics as destinations are gone — their content is reached by
walking the web.

## The journeys (why it makes sense)

- **Reader from a video/social**: lands on `/i/:slug` → hits a claim chip → dossier
  → receipt → primary source. The trust chain IS the navigation.
- **Reader from Google/an AI answer**: lands on a dossier (the citable atom) →
  walks connections → finds the investigation → finds the channel. GEO inverted
  into an acquisition funnel.
- **The operator**: browses the same site logged in; drop + extract grows the
  record; signing publishes the reading onto the dossier and the investigations
  index. One site, permission layers (already the v2.6 model — kept).

## What makes it "next-gen" (the checkable claims)

1. **Nobody wrote the dossiers** — they grew from extraction, and say so.
2. **Receipts are structural** — every fact resolves to a verbatim quote in a
   stored primary source, mechanically verified; failures killed visibly.
3. **Contested is a first-class state** — no wiki or CMS renders disagreement as
   disagreement.
4. **The graph is walkable** — typed connections as navigation, not tags.
5. **Instant** — server-rendered from the graph, no client framework, sub-100ms.
6. **Citable by machines** — JSON-LD + stable anchors on every block; built to be
   the thing AI answers cite.

## Register

Dark instrument. The operator tokens (`#0d0e11` ground, cool glow accent, mono
coordinates) become the public face — but the *design* is the anatomy above; the
palette just dresses it. Three voices kept: Geist (instrument), Newsreader (the
signed voice), Geist Mono (coordinates/receipts).

## Status

- The visual realization of this map is the clickable mockup (built from this doc).
- Once approved: the mockup is the build spec; the existing renderers + graph
  already supply ~80% of the data model (facts, assertions, edges, quotes,
  arrangements, JSON-LD). This is a re-composition of working parts, not a rebuild.
