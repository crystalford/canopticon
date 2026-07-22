# Canopticon — The Renovation

> One document. What canopticon is, what it looks like, what dies, and what you
> do this week. Read once, then go produce.

---

## Preamble — the thing you've been circling

You already said it, twice, without hearing yourself:

- You named the project **Canopticon** — the panopticon, inverted. The watched,
  watching back.
- You built a design system and titled it **"The Standing Record."**

That's the whole identity. **Canopticon keeps files on power.** Not articles,
not posts, not a wiki — *files*. Every subject page is a dossier: what is
established, what is contested, who said what, when, with the receipt one click
away. The video essay is what happens when a file gets thick enough that
someone has to open it on camera.

The six-month loop happened because you kept building the machine that makes
the files and never once opened a file. The spec was right — *"a rendering
system, not a generation system"* — and then you spent your energy on
generation infrastructure (a video render pipeline, an instrument) instead of
rendering what you have onto a screen worth looking at and putting one real
investigation through it.

The renovation is three moves, in order:

1. **Invert the ground.** The public face goes dark. The palette already exists
   in your own tokens; you built the brand and then served visitors the beige.
2. **Collapse the site into one product: the Record.** Four nav lists become
   one dossier machine. The test corpus dies today.
3. **Ship one investigation on both faces in two weeks** using the machine as
   it stands, fixing only the two integrity holes that block signing.

Nothing below adds a format, an arm, or a spec. Everything below reduces.

---

## 1. What Canopticon is

**One paragraph, for a stranger:**

Canopticon is a one-person forensic media brand that keeps files on power. A
machine reads primary documents into a graph of verified facts and grows a
dark, citable dossier on every person, event, and received account those
documents touch — every published claim traceable, in one click, to a verbatim
quote inside a stored source; every contested claim shown as contested, never
laundered into fact. On top of that standing record, the operator signs
interpretive readings, and the strongest of them become video essays whose
every frame can be checked against the site. The site is the record; the video
is the broadcast. Same investigation, two faces — and the reader can always
walk from one to the other.

**One sentence:**

> Canopticon keeps the file: machine-verified dossiers on power, published as a
> living reference site and as video essays — every claim one click from its
> receipt.

**The tagline register** (pick one, put it under the wordmark, stop tinkering):

- *The standing record.*
- *The watched, watching.*

That's the identity. Not "an investigative publication system," not "a typed
graph of facts." Those are how it works. What it *is*: **the file they didn't
expect anyone to keep.**

---

## 2. The brand, made concrete

### The verdict on beige: invert

The vibe contradiction in the brief is real and the fix is already in your CSS.
`styles.ts` defines two grounds: public warm-paper and operator
dark-instrument (`--op-paper: #0d0e11`, cool glow accent, dark variants of
every semantic color already present). The operator theme *is* the brand —
dark, precise, quietly glowing — and you've been keeping it for yourself while
serving readers a beige government archive.

**The move: one register. The dark instrument becomes everyone's ground.**
Public and operator see the same dark product; the operator just sees more
affordances (which is exactly v2.6 Part 12's one-site model anyway). This is
not a redesign — it is rebinding the `:root` active variables to the `--op-*`
set, tuning contrast for long-form reading, and deleting the beige register
once you're sure. One axis of maintenance dies with it.

What survives untouched, because it's already right:

- **The three voices.** Geist for the instrument, Newsreader serif for the
  signed voice, Geist Mono for coordinates. On a dark ground the mono
  coordinates stop reading as "archival metadata" and start reading as
  "case-file stamps." Same CSS, different meaning.
- **The semantic colors.** Confirmed green, contested rose, correction red —
  dark-ground variants already exist (`--confirmed-bg-d` etc.).
- **One accent, used like a highlighter.** Keep the cool glow
  (`--op-accent: #5d8bc6`). Amber reads warm; the brand is cold.

One new motif, used sparingly: **the redaction bar.** Loading states, empty
states, and hover-reveals render as solid ink bars that resolve into text. It
costs a few lines of CSS and it *is* the brand — the file, being unredacted for
you. Do not build a texture system, do not add animation libraries. One motif.

### Tone

Cold, precise, understated. The site never exclaims, never markets itself,
never uses an exclamation point. Numbers are tabular. Dates are ISO-adjacent.
The only warm thing on any page is the signed reading's serif voice — and that
contrast is the point: the human shows up *inside* the machine's record, marked
as human.

### The reader's first ten seconds

They land on a near-black page. Wordmark top-left: **CANOPTICON·** with the
accent dot. One line of small serif under it: *The standing record.* Then, at
display size, the current investigation: its title, its one-sentence thesis,
a still from the video if one exists, and a mono coordinate line —
`SIGNED 2026-07-30 · 41 FACTS · 6 CONTESTED · 12 SOURCES`. Below the fold, the
Record: a dense list of dossiers with their own coordinate lines, most-alive
first.

The feeling in ten seconds: *someone has been keeping files, the files are
real, and one of them is open on the table.* Mysterious because it's
understated; credible because every number on screen is a real count from the
graph; cool because it looks like an instrument, not a blog.

### The operator's home

Same site, same dark. You log in (the one-site cookie) and the same pages grow
affordances: the OUT stream's "awaiting your signature" surfaces at the top of
`/`, Extract buttons appear on source rows, Edit/Sign/Discard appear on
readings. You do not go to a dashboard to operate Canopticon; **you walk your
own site and the site responds to you.** That's v2.6's best idea — keep it.

---

## 3. The site as product — the next-gen wiki that never materialized

"Categorically better than a CMS or a wiki" is not a graph database or a
schema.org tag. On screen, it is exactly four things a wiki cannot do, and your
machine already produces the data for all four:

1. **Every claim carries its receipt.** Not a footnote to a URL — the verbatim
   quote, from a stored copy of the source, machine-checked as a literal
   substring, one click away, on the page.
2. **Contested is a first-class visual state.** Wikipedia hides its fights in
   Talk pages. Canopticon renders them: *X asserts A; Y asserts not-A;
   here are both receipts.* The firewall, made visible, is the product.
3. **The page has a pulse.** Real "last fed" timestamps, real fact counts, a
   timeline that grows as the corpus grows. A wiki article is a text someone
   edited; a dossier is a record something *feeds*.
4. **The neutral/signed seam.** The same page carries the reference record and
   the operator's argument, visibly separated, with the mandatory
   "what complicates this" box. No wiki and no CMS has an epistemically honest
   opinion layer. You do.

### The page a reader inhabits: the Dossier

Name it internally and design to the name. `/s/:slug` is **a dossier**. Its
anatomy, top to bottom — all buildable on the existing `subject-page.ts`
renderer, mostly by restyling sections that already exist:

- **The stamp.** Subject name at display size. Under it the coordinate line in
  mono: kind · fact count · contested count · source count · first entered the
  record · last fed. This block is the brand doing its work; make it beautiful
  and identical on every dossier.
- **The lede.** Two serif sentences, machine-composed from the graph
  (`buildLede` exists). What this subject is and why it's in the record.
- **Established.** The neutral facts, each row ending in its cite chip
  (`.cite` exists). Clicking a chip opens the verbatim quote inline
  (server-rendered `<details>` — no JS needed to read).
- **Contested.** The rose-bordered block. Attribution on every assertion:
  *who* claims it, against *what*. This section is your moat — never let it
  collapse into the established block, never hide it.
- **Timeline.** The chronology, already rendered by the arrangement renderer,
  embedded with a deep-linkable anchor.
- **Connections.** Typed backlinks as pills — the graph made walkable. This is
  what makes it feel like *one* record instead of pages: you can follow an edge
  from any dossier to any other in one click, and every pill states its
  relation type.
- **The seam, then the Reading.** If a signed reading exists: the seam band
  (`.seam` exists), the byline with the intent badge, the serif argument, the
  complicating box. `?mode=signed` becomes the *reveal*, and the mode toggle
  should feel like flipping a file open.
- **The trust strip.** Already designed. Every page ends by stating, in plain
  language, that every quote above is a checked substring of a stored source.

Speed is part of the design: server-rendered strings from D1 at the edge means
these pages load like static files. **Advertise it by never adding anything
that would slow it down.** Instant + dense + dark is a feeling no CMS site has.

### The home that has gravity

`/` stops being an activity feed of plumbing events. Three blocks:

1. **The open file** — the current investigation, hero-sized (described above).
   There is always exactly one. If none is signed yet, the most-alive dossier
   stands in.
2. **The Record** — the dossier index itself, dense, mono-coordinated, sorted
   by alive-ness. Not cards. Rows. A filing cabinet, not a Pinterest board.
3. **Latest evidence** — the last few sources ingested, each linking to the
   dossiers it fed ("what it fed the fabric" already exists per-document).

### Four nav lists become one product

Current nav: Investigations / Topics / Library / About — four sibling lists,
no hierarchy, no gravity. New nav, three items:

> **The Record** · **Investigations** · **Method**

- **The Record** (`/record`, un-redirect it — the 301 to /topics inverts:
  /topics 301s *to* /record) is the single browsable index: entities, events,
  themes, one search box, one dense list. Topics dies as a word.
- **Investigations** stays: the signed readings, each with its video when one
  exists.
- **Method** replaces About as the trust page: how verification works, what
  the gauntlet is, what "contested" means here. For a forensic brand, the
  methodology page *is* marketing, and for GEO it's the page that teaches AI
  search engines to describe you correctly.
- **Library leaves the nav.** Sources are evidence, not product. They remain
  public at their URLs (citability is sacred), reachable from every receipt
  chip and from a `/sources` index linked in the footer. A table of raw upload
  filenames will never again be presented as a destination.

### What makes GEO cite you

Not more JSON-LD (though finish the CollectionPage/Article gaps from the June
audit — they're free). AI search cites the page that gives it: a stable URL, a
clean answer shape, explicit sourcing, and dates. The dossier anatomy above
*is* that shape. The one genuinely new GEO asset worth the hour: the Method
page stating the verification contract in plain machine-quotable language.
Everything else is corpus: **engines cannot cite files you haven't built.**
The reason GEO "hasn't succeeded" is not schema markup — it's that the graph
has never eaten a real corpus. Which is Section 6.

---

## 4. Keep / Freeze / Cut

The standard: does it serve the dossier site or the first video essay in the
next month? Keep means "use and polish." Freeze means "real, stays in the
repo, zero further thought until after investigation #1 ships." Cut means
"delete, archive, or formally never."

### KEEP (the machine that matters)

| Thing | Why it stays |
|---|---|
| Typed graph — 7 node kinds, 6 edge families, contested assertions | The data spine of the dossier. Built, working, don't touch. |
| Trust gauntlet — verbatim check, firewall, independent judge, re-gate | The soul of the product and the only truly novel tech you own. Fix its two holes (§6), never weaken it. |
| Extraction (text / markdown / HTML / URL) | Works, durable, resumable, free. It feeds everything. |
| Unified subject page, two modes | It IS the product. All design effort lands here. |
| Settle pipeline: L1 surfacing → autoseed → proposer → draft readings | This is "the operator approves, never authors" made real. Keep it running. |
| Embedded arrangements the dossier uses: timeline, connections, claim-table | They're sections of the product page. |
| Faces: **video script** and **thread** | Script feeds the co-equal product; thread is distribution for both. Two faces, no more. |
| Studio Stage 1 (script skeleton + compose) | The bridge from signed reading to your voice in a mic. That's all Studio is for now. |
| Public rendering stack: Workers + Hono + string HTML + D1/R2/Vectorize | Boring, fast, cheap, yours. The renovation is CSS and templates on top of it. |

### FREEZE (real, not now)

| Thing | Terms of the freeze |
|---|---|
| The other ~9 standalone arrangement URLs (network, stats, FAQ, definition, comparison…) | Routes may keep serving if merged; zero further investment. Revisit only if a real reader need appears. |
| The 7 investigation intents | The badge renders; the `?intent=` filter work stops. Seven epistemic stances is spec-brain; one investigation has one stance. |
| Faces: card, carousel, chapter | Pre-render code stays; no polish, no surfaces. |
| Studio Stages B–F (voice cloning, auto-render, podcast, distribution log) | Frozen until you have shipped **three** human-made videos and know what actually needs automating. |
| Live inquiry threads + proposer novelty polish | Running is fine; improving is banned. |
| Surfacing L2 / frontier tier | Manual trigger stays buried. Not needed for investigation #1. |
| Theme surfacing | Under-verified (§4 of the brief) and not needed for the first investigation. Freeze rather than fix. |
| Queues + Durable Objects + Async Batch (audit item 16) | Throughput is not your bottleneck; production is. Revisit when a real corpus actually chokes extraction. |
| Anthropic top-tier wire-up | One line, near launch of something that needs it. Not now. |

### CUT (the nerve part)

| Thing | Verdict |
|---|---|
| **The video engine arm** (`video.canopticon.com`, daily forensic render pipeline) | **Cut.** This was the ninth rebuild wearing a costume — three days after a shippable action list, you built a new machine instead of using the old one. The video essay is the *peak human synthesis of an investigation*, and the first ten of them are made by you, from the script face, with your voice and a normal editor. A daily automated video product is a different business. Archive the branch, delete the subdomain from your head. |
| **Instruments / The Blind Spot** | **Cut formally.** You said parked; parked things whisper. Move the code out of the mental estate (archive branch), write one line in CLAUDE.md: "Instruments: not part of Canopticon." |
| **The test corpus** | **Cut today.** `reset-graph?confirm=1`. The single cheapest fix to "it feels empty" is to stop displaying scaffolding as content. From now on the live graph only ever contains real corpus. |
| **The warm-paper public register** | Cut after the dark flip proves out (keep the tokens for two weeks as fallback, then delete). One ground, one product. |
| **Legacy `/briefs` in any index** | URLs keep serving (citation stability); they vanish from every list the moment investigation #1 is live. |
| **`/sources` as a nav destination + placeholder** | The placeholder page becomes a real, plain index (the CSS — `.src-index` — already exists) linked from the footer only. If that's more than an hour, just remove it from nav and JSON-LD SearchAction until it's real. |
| **Spec v2.6 as an active document** | Cut from daily reference. It was right about the center and it metastasized. CLAUDE.md + this document are the working truth. **No v2.7. No v3.0. The next spec-shaped document you're allowed to write is the script of a video essay.** |

Net result: the maintained surface is **one site, one page type, one pipeline,
two faces, one production tool.** Everything else is frozen scaffolding or
gone.

---

## 5. A Tuesday, and who's on the other side

### The operator's Tuesday (45–90 minutes, then optional production)

**08:40 — Feed.** You found two documents last night — a committee transcript,
a regulator's report (HTML/text for now; see PDF in §6). You open `/op/library`
on your phone, drop both. Upload is authorization: extraction starts on its
own, no second click. You leave.

**09:30 — Walk the record.** Coffee. You open canopticon.com — the public
site, logged in. The dossiers those documents touched show fresh "last fed"
stamps. You open the main one and read it *as a reader*: does the timeline hold,
did the contested block pick up the denial, do the connections point where you
thought? This is the loop the specs never described: **operating Canopticon is
mostly reading your own site.** If a record is thin where it matters, you hit
Expand and move on.

**09:50 — Sign or decline.** OUT (surfaced at the top of `/` for you) has one
reading awaiting signature. You read it against its own complicating box. Two
claims got judge-killed overnight — visible, listed, dead. You tighten one
sentence (which re-runs verification — §6), and sign. The dossier now carries
the seam; Investigations updates; the thread face pre-renders.

**10:05 — Broadcast, or not.** Most Tuesdays end here — the site grew, the
record deepened, thirty minutes spent, nothing authored. But this reading is
the one. You open its Studio script: your signed argument re-sequenced into
beats, receipts inline. You record the voiceover in three takes. B-roll is
screen captures of the live dossiers — **the site is the set**; every frame of
the video is a page a viewer can visit. You cut it in a normal editor over two
evenings. Thumbnail is the dossier stamp on black.

**Thursday — Ship both faces.** Video up. Embed on the investigation page.
Thread posted from the thread face, last tweet linking the dossier. Done.

The cadence that follows: feed daily in minutes, sign weekly, broadcast when a
file is thick enough — roughly monthly. **The site compounds daily; the videos
punctuate.** That's what co-equal means in practice.

### The reader on the other side

Three doors, one product:

- **The searcher (human or AI)** lands mid-dossier from a query. They get the
  reference answer — established, contested, dated, sourced — faster and more
  honestly shaped than a news article or a wiki stub. The AI engine gets the
  same, plus JSON-LD and a Method page that tells it exactly what this site
  verifies. This door is why the Record is the SEO/GEO bedrock — but it only
  opens if the files are real.
- **The viewer** clicks through from a video. They land on the exact dossier
  on screen in the essay, click one receipt, and read the verbatim line in the
  primary source. *No other video essayist can offer that click.* That single
  interaction converts a viewer into someone who trusts the channel — it's the
  moat, and it's already built; it just needs to be pointed at real material.
- **The returner** comes back because the file grew. "Last fed" stamps, a
  fatter timeline, a new contested entry. A wiki is finished; a record is
  alive. The reason to return is the pulse.

What they get nowhere else, in one line: **every claim is one click from its
receipt, and the site tells you what it *doesn't* know.**

---

## 6. The first-production path — one investigation, both faces, two weeks

The deliverable that matters. Rules of engagement: use the machine as it
stands; fix only what blocks the chain below; anything frozen stays frozen even
when it itches.

**The chain that must work once** (this is the definition of done):

> A stranger watches the video → clicks the link → lands on the dossier →
> clicks a receipt → reads the verbatim quote in a stored primary source.

When that chain works once with real material, Canopticon has shipped. Nothing
else this month matters.

### Day 0 — Choose the investigation (one evening, on paper)

One subject you genuinely care about. Criteria, strictly: (a) 10–30 real
source documents you can actually obtain, mostly as HTML/text/markdown — the
formats extraction already handles; (b) a live tension — someone's account
that the documents complicate — so the reading has a thesis; (c) visual enough
to carry 6–12 minutes of video. Canadian politics qualifies; so does anything
else you'd make a video about anyway. **Decide in one evening. The corpus you
can get beats the corpus you want.**

### Days 1–2 — Clear the ground

1. **Merge the v2.6 core branch to `main`.** It's green (189 tests) and it
   contains the unified pages and search you need. It deploys itself. Stop
   sitting on your own best work.
2. **Reset the graph** (`/v1/admin/reset-graph?confirm=1`). The test corpus
   dies. The live site is briefly empty and honest — better than full and
   fake.
3. **Integrity fix #1 — edit-then-sign.** The one place you can become an
   author unverified. Route edited prose back through the verbatim check +
   judge before `signed_status` flips. (~2h; mirror the buildBrief loop —
   the June audit's item 13 pattern.)
4. **Integrity fix #2 — PDF fails closed.** Don't build PDF ingest. Make the
   upload path *reject* PDFs/images with a visible "not yet supported" instead
   of letting the adapter fabricate text. (~1h.) If a load-bearing source for
   this investigation only exists as PDF, extract its text yourself and upload
   the text — the system stores it as the source and the chain stays honest.
   Full PDF ingest is scheduled by the first corpus that truly demands it, not
   before.
5. **Auto-extract on upload.** Remove the manual Extract step — upload is
   authorization. (~1h.)

### Days 2–4 — The dark flip + the one-product nav

All CSS-variable and template work on the existing renderer; no new stack:

1. Rebind `:root` to the dark instrument tokens; tune serif contrast for
   long-form on dark. (~half day.)
2. The dossier stamp: restyle the `/s/:slug` header into the coordinate-stamped
   file head (§3). (~half day.)
3. Home gravity: hero the current investigation (or most-alive dossier), then
   the Record list, then latest evidence. (~half day.)
4. Nav collapse: **The Record / Investigations / Method**. `/topics` 301s to
   `/record`. Library out of nav; receipts and footer keep it reachable.
   Method page written (an hour of prose — the trust contract in plain
   language). (~half day.)

Ship each of these to `main` as it's done — the site improves live while the
corpus grows. Do not let the flip expand into a design project: the tokens,
type, and components exist; you are re-grounding them, not redrawing them.

### Days 3–7 — Feed the machine (overlaps the flip)

Ingest the real corpus, 3–5 documents a day, watching what extraction actually
does to real material. This is deliberate: you have never watched the machine
eat a real corpus, and the renovation's whole premise is *improve in contact
with real work*. Fix only what blocks — a chunking hiccup, a dedup miss — and
log everything else as post-ship. Let the settle gate run; watch dossiers
autoseed and grow; walk the record daily like the Tuesday above. Silent-failure
note: while feeding, keep `/v1/admin/runtime` open; if a stage dies silently,
add the one `console→orchestrator_events` line for *that stage only* — no
general catch-audit this month.

### Days 7–10 — The Reading (face one ships)

The settle pipeline drafts readings for the highest-tension subjects. Take the
best draft; where it's thin, Expand the records it leans on; edit (now
re-verified) and **sign it**. The killed-claims list stays visible — that's the
brand. Give its dossier and the 3–5 dossiers it cites a reader's-eye pass on
the new dark ground. Then it's live: the dossier seam, the Investigations
index, the thread face. **Face one — the site — has shipped.** Post the thread.

### Days 10–14 — The Broadcast (face two ships)

1. Open the signed reading's Studio script face; tighten beats by hand on
   paper if needed (you are allowed to author the *performance* — the
   directive governs the published record, not your voice).
2. Record the voiceover — mic, phone, three takes, done.
3. B-roll: screen-capture the live dossiers, receipts opening, the timeline,
   the contested block. The site is the set.
4. Cut in any editor. 6–12 minutes. Thumbnail: the dossier stamp on black.
5. Publish (unlisted → watch once → public). Embed on the investigation page.
   Post the announcement thread with the dossier link.

**The chain test:** click through it yourself as a stranger — video → dossier →
receipt → quote. If it holds, Canopticon exists.

### What must be true / what gets ignored

- **Must be true:** real corpus in the graph · one signed reading through the
  full gauntlet · dossiers presentable on the dark ground · one video public ·
  the chain clicks end to end.
- **Ignored, even when they itch:** everything in the freeze list, the video
  engine, PDFs beyond fail-closed, themes, L2, Queues/DO, JSON-LD completeness
  beyond what's free, any thought beginning "what if the system could…"

### After it ships

Do it again. Investigation #2 through the same machine is where you'll learn
what actually deserves building — with evidence instead of specs. The rule
that ends the loop for good: **no new capability until the capability's absence
has hurt a real production twice.**

---

*The operator approves, never authors. Verification is mechanical, not
vouched. The firewall holds. Simplicity above all — and now: production above
simplicity-projects. Open a file.*
