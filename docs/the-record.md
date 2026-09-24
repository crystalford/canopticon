# The Record — what Canopticon is, and the build that makes it that

> Written 2026-09-24 after reading the whole of `packages/api` against the
> live `/library`; revised the same day to cover the model, the design, the
> linking structure, the search-engine and answer-engine work, and lineage.
> This is a product definition and a build order, in one document, meant to
> replace piecemeal fixes. When it is adopted, `CLAUDE.md` is rewritten from
> it; until then `CLAUDE.md` is still the source of truth for the code.

---

## 1. What it is

**Canopticon is a research record that compounds.** You feed it documents —
your research reports and your essays. Each one is published whole at its own
URL, verified sentence by sentence against itself, and wired into everything
already in the record. Then the record tells you what it now knows, what it
can't answer, and where its documents disagree — and each of those is a button
that starts a piece of research, which becomes the next document, which cites
the one that raised the question.

So the record is a **tree you can watch grow**. Every document knows what it
grew from and what grew from it, and a reader can walk that lineage in either
direction. That is what an upload is a signal *for*: not a page, but a branch.

It has two faces:

- **canopticon.com** — the public record. Citable pages, receipts, lineage,
  machine formats. Built for readers and for answer engines. No account, no
  JavaScript needed to read.
- **/library** — the workbench. Your application. Upload, watch a document get
  processed, see what it connected to and what it raised, pick the next thing
  to research, review the draft, publish it. One page, one loop.

```
   upload ──▶ published + processed ──▶ what it connected to · what it raised
                                                      │
        publish (cites its parent) ◀── review draft ◀── research ◀┘
```

Every trip round the loop makes the earlier documents richer: new links into
them, new contradictions surfaced, questions answered, a branch below them.
That is the reason to upload the next one. It is also the honest version of
"GEO": a site whose pages cite each other, carry verified figures with named
sources and dates, and visibly grow.

## 1b. What it is for — the extension

*Added 2026-09-24 from the operator's note. This is the purpose the loop
serves; the sections after it are unchanged in mechanism and gain two
features from it (bridges, §5b; readings, §5c).*

**Canopticon is neuronal extension software.** The record is the operator's
mind extended onto the web: uploading is externalising memory; processing is
the record's own pattern recognition; the worklist is inquiry; an essay is
synthesis; a published page is the thought made citable — by people, and by
the answer engines everyone else now thinks through. That last part is what
"NEO" (neural engine optimisation) names: being cited by a model is the
extension reaching the furthest it can. §7's checklist is NEO's mechanics.

**The model case is a bridge.** The operator's best contribution so far is
in the record: *Research Pass for "The Medium Becomes the Ground"* (published
2026-07-22), §2, "McLuhan and Addiction Neuroscience: An Apparent
Theoretical Gap" — McLuhan's figure/ground mapped onto Koob & Le Moal's
allostatic model of addiction: "allostasis *is* the McLuhanian mechanism
described in neurobiological terms." The pass checked four literatures and
found no one had made the connection; it rates the move "novel theoretical
contribution … potentially the manuscript's signature original idea." The
same document names six more syntheses it rates novel. Media theory and
addiction neuroscience sit in different sections of this record; that is what
the record exists to provoke and to catch. It cannot make the leap, but it
can put the two documents side by side, say "these share a subject and sit in
different sections", and make "has anyone said this?" one button — the check
that pass did by hand. §5b.

**Verification has a human half.** Every quote is checked by code (rule 1).
But the other proof that a document has entered the record is that a person
read it and noticed something — which is what happened with McLuhan, and
what the model missed. So a document can carry the operator's **reading**: a
short note anchored to a passage, kept as a first-class artifact, shown on
the page as the operator's, and marking the document *read by a person* —
a trust signal the machine cannot fake. §5c. This is also the learning loop:
the record shows what it found; the operator adds what they found; both are
kept, and either can start the next branch.

**Framing.** Not the attention economy. The output of this system is a
personal course of study made public: education, feedback, inspiration —
and when video or audio come, they come as readings of the record, not as a
show. Studio stays parked until the loop above is pleasant to use.

**The tetrad**, and lenses like it, are Markdown shapes the parser can
recognise (`## Enhances · ## Obsolesces · ## Retrieves · ## Reverses`), the
way the Q&A essay convention already is: structure derived from the file,
nothing calling a model. If the tetrad proves incomplete, the shape grows.
Later than PR 3.

## 2. Why it feels like a mess — the actual causes

These are what the code does today, not impressions.

1. **Processing a document is five separate passes with five separate
   triggers, and only the first tick of the first one runs by itself.**
   Text extract (automatic) → digestion (automatic for *two chunks*, then it
   re-queues itself for a cron that is switched off) → findings & questions
   (per-document button) → lead passage (button, then a second Approve
   button) → section (bulk button). A 20KB document needs about five presses
   of "Process queue" just to finish digestion, and nothing on the page says
   so. So on the live site almost nothing is fully processed, and the public
   page — whose whole point is the receipts, the findings, the lead passage
   and the links to other documents — renders without any of them.

2. **The buttons appear before their preconditions.** "+ Extract" shows on
   every published row, but both buttons inside it fail with "run document
   extraction first" unless digestion already wrote a source node.

3. **The crawler `CLAUDE.md` calls retired is not retired.** "Dig here" on a
   lead, and the research workspace, fetch web pages and save each one as a
   `pieces` row — kind "research report", status "working material", date
   "—". That is what "Just a moment..." (a Cloudflare bot-challenge page) and
   the brainly.com row are. `/library` shows every row in `pieces` with no
   filter, and "Extract all" would pull quotes from those pages into your
   graph.

4. **Two products' worth of routes are still mounted.** Thirteen graph-era
   "arrangement" page types, subject pages, records, briefs, proposals,
   faces, synthesis, studio-produce, outputs — reachable, unlinked, several
   shadowed by redirects so their handlers can never run.

5. **Some of what the site says about itself is not true.** The upload form
   and `CLAUDE.md` say PDF; `extract.ts` refuses PDFs. "Keep exploring" shows
   the four newest documents, not related ones. Topic pills on a document
   read a legacy table that is empty.

6. **The models are the cheapest that fit a 25-second window.** Bulk
   extraction runs on Llama 4 Scout because the reasoning models timed out
   inside `waitUntil`. That constraint came from running work in the
   background of an upload request. With one step per request (below) it
   goes away, and the model can be chosen for quality.

7. **Each previous round fixed the thing you had just complained about.**
   Sign-in, rendering, titles, the stylesheet, the dead rooms. All real, none
   of them the pipeline — and with the pipeline never completing, nothing else
   could look finished.

The design constraint under all of it: a Worker execution is short, and rule 4
(nothing runs unattended) is right — an idle site should cost nothing. The
project already solved this once, for research runs in #177: a state machine
that does one step per request, driven by a poller while the tab is open.
**The browser is the scheduler.** It was applied to research and never to
documents. Applying it to documents is the single change that makes
everything else real.

## 3. The model

**Claude, billed through Cloudflare.** Cloudflare AI Gateway's Unified
Billing lets the Worker's existing `AI` binding run `anthropic/claude-…`
models against prepaid Cloudflare credits: no Anthropic account, no separate
bill, no key in the Worker. The code already has an Anthropic-shaped adapter
(`llm/anthropic.ts`); it gets a second transport that goes through the
binding instead of `api.anthropic.com`. The binding does not accept
`output_config` or `cache_control`, so calls stay plain.

Which model: **the most capable Claude the gateway lists** — Opus-tier — for
every step that is a judgement: digestion, findings, passage, title, section,
the research writer, settling a contradiction. There is no cheap tier for
"bulk" work any more, because the bulk *is* the judgement: a stronger
extractor means more quotes survive verification and better findings. With a
1M-token context, digestion becomes 2–3 calls per document instead of up to
64 small ones, so the cost per document is comparable to today's and the
yield is not.

What stays on Workers AI: embeddings (`bge-m3`) for search, and the fallback.
If the gateway is not configured, every step still runs, on
`@cf/openai/gpt-oss-120b`, and the receipt on the row says which model wrote
it. Nothing silently downgrades: the library header shows the model in use.

**Setup you do once, in the Cloudflare dashboard:** create an AI Gateway,
turn on Unified Billing, load credits. The code reads the gateway name from
`wrangler.toml`. Cost per document is written to `cost_ledger` and shown on
the row.

## 4. What happens to a document

Upload is authorization — for publishing *and* for processing. Nothing
downstream asks again.

```
UPLOAD  .md .txt .html .pdf .docx .zip     (PDF/DOCX via Workers AI toMarkdown)
  │
  ├─ 1. text        extract, store, embed                       no LLM
  ├─ 2. publish     pieces row, /p/<slug> is live               no LLM
  ├─ 3. title       filename or working title → best verbatim
  │                 candidate; original kept; one click to revert
  ├─ 4. digest      typed graph, verified quotes   ~3 calls
  ├─ 5. findings    figures with source + date; questions raised
  ├─ 6. passage     lead passage, verbatim, auto-approved
  ├─ 7. section     one of eight closed sections
  ├─ 8. links       related documents by shared subjects (a query)
  ├─ 9. og image    a card rendered once, stored in R2
  └─ 10. done       receipt: what was read, what survived, what it cost
                    IndexNow ping · sitemap lastmod · feed entry
```

One state machine, `piece_processing`: `text → title → digest(i/n) →
findings → passage → section → og → done | failed(step, reason)`. One step
per request at `POST /op/process/advance`. `/library` polls it while open,
exactly as the research workspace does. Each row shows one status —
**Processing 3/7 · digesting**, **Processed**, **Failed at findings: <reason>**
with Retry. One "Process everything" button drives the whole queue while the
tab is open. Close the tab and it stops; open it and it resumes. No cron.

Rules that change:

- **The lead passage is auto-approved.** It is a verbatim passage from a
  document you already authorised, located by code. You can replace it.
- **The title is auto-corrected when — and only when — it is a filename or a
  working title.** A real title is never touched. The original is kept and
  the rename is reversible from the row. The slug never changes.
- **Findings, passage and section run on upload, not on request.** "AI output
  is an input artifact" still holds: every one is frozen into a row, nothing
  runs at render time.
- **Re-processing is one button and loses nothing silently.** Today
  "Re-extract all" cascade-deletes findings without saying so.
- **A new version replaces the body, keeps the slug, re-processes, and keeps
  the previous receipt.** Upload a file with the same title or drop it on
  the row. The page shows "Updated" only when the body changed.
- **Unpublish and delete go through `purgeTypedGraphForPiece`**, never a
  bare `DELETE FROM pieces`, so no receipt is left pointing at nothing.

## 5. Lineage — the branch structure

Two columns and one rule.

- `pieces.parent_piece_id` — the document whose lead, question or gap this
  one was researched from (null for a root upload).
- `pieces.origin` — the question or contradiction, verbatim, that started it.
- A research brief published from a run is a child of the document the run
  was started from, and its body cites that document by `/p/` link. A brief
  started from a free question in the workspace is a root.

Public, on every document page: **"Grew from"** (parent title, and the
question) and **"Grew into"** (children, with the question each answered).
On the front page and `/research`: a branch count beside the document. In
`/library`: the tree, collapsible, recent-first.

This is the internal-linking structure search engines reward and the story
a reader follows. It also makes the loop visible to *you*: an upload whose
row says "raised 2 questions · settled 1 contradiction · 0 branches yet" is
asking for its next move.

## 5b. Bridges — the fourth lead

A **bridge** is a subject (an entity or theme node with the same label) that
appears in two documents filed under *different* sections. It is a pure
query over the typed graph — label × `pieces.topic` — no model, no count,
recent-first like every other lead. The McLuhan–neuroscience synthesis is a
bridge between "Media & mind" and whatever section the neuroscience material
sits in; the record could have shown it before the operator noticed it.

It joins contradictions, unsourced figures and open questions in "What the
record wants", with two buttons: **Research** (a run on "what connects X in
A and B?", parented to the newer document) and **Has anyone said this?** (a
run whose question is the novelty check, so the answer — nobody, or these
three people — is itself a document). A bridge with a reading on it (§5c) is
shown first in the list, not because it is more frequent but because a person
marked it.

## 5c. Readings — the operator's half of verification

A **reading** is a short note the operator writes on a document, anchored to
a passage the way a receipt is: the passage is selected verbatim
(`locateVerbatim`), the note is the operator's own words, both are stored.

- Table `readings`: `piece_id, quote_id, note_md, created_at`. The passage
  is a `quotes` row like any receipt, so `/q/<id>` works for it.
- Written from the `/p/` page when signed in: select a passage → "Note
  this". No model is involved at any point.
- Public: rendered in the margin of the passage on wide screens, inline under
  it on narrow ones, signed and dated. A document with at least one reading
  carries **"Read by the operator"** beside its receipt line; a document
  without one does not claim it.
- A reading is a lead: it appears in "What the record wants" with
  **Research** and **Draft an essay from this** (which opens a new `.md`
  with the passage quoted and the note as the opening paragraph — a file the
  operator then writes, not a model).
- JSON-LD: a `Comment` on the `Quotation`, `author` the operator.

This replaces nothing and gates nothing. It is the one place on the site
where the operator's own sentences appear that are not a whole essay.

## 6. The surfaces

### Public — canopticon.com

| Page | What it is |
|---|---|
| `/` | The latest essay; the essays; research by section; the record's size in plain words (documents, verified quotes, branches). |
| `/essays`, `/research` | The two indexes. `/research` grouped by section. |
| `/research/<section>` | **Section hub.** One per closed section: a two-line description, the documents, the leads that live there. Eight pages, all in the sitemap. |
| `/p/<slug>` | **The document.** See below. |
| `/q/<id>` | The receipt. As now. |
| `/search` | One box. Results are documents and verbatim passages with receipts — the answer-engine surface. |
| `/about` | The operator as an entity (Person JSON-LD, sameAs), the license, the mailing list. |
| `/method` | How a document is processed and verified; describes §4 and nothing that isn't built. |
| machine | `/p/<slug>.md`, JSON-LD, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`, `/feed.json`, `/og/<slug>.png`. |

Nav: **Essays · Research · About** + search. Footer: Library / Sign in /
Method / llms.txt / Feed. Nothing else is reachable.

**The document page, top to bottom:**

1. Kind · section · breadcrumbs (Home › Research › Section › Title).
2. Title, dek, byline, date, read time, "Updated" only if true.
3. **Lead passage** — verbatim, with its receipt link.
4. **Key figures** — the findings block, moved *above* the body: figure ·
   what it measures · period · source · receipt. This is the block answer
   engines lift, so it comes first, compact, four to six rows.
5. The document's own summary and gaps, promoted (as now).
6. **Body** with verified figures linked to receipts and phrases linked to
   the other documents that share the subject, one pass, receipts win.
7. **Grew from / Grew into.**
8. **Related documents** — by shared subjects, not by date.
9. Cite this (APA, BibTeX). Rail: kind, words, dates, license, `.md`.
10. JSON-LD: Article or DigitalDocument, FAQPage for essays, Quotation for
    the passage, BreadcrumbList, `isBasedOn` for lineage.

### The workbench — `/library` (signed in)

One page, four parts, in this order:

1. **Upload.** Dropzone. A file lands and its row appears below, processing.
2. **Documents.** Your uploads and your published briefs, as a tree,
   recent-first. Each row: title (with "renamed from …" if it was), kind,
   section, status, date, and its receipt: read in full / truncated at N,
   quotes verified, findings, questions, links in, links out, branches,
   cost, model. Actions: Re-process · New version · Replace passage · Rename
   · Unpublish.
3. **What the record wants.** The worklist, recent-first, never by
   frequency: contradictions between two documents, figures with no source
   named, questions raised and not answered, **bridges** between sections
   (§5b), and the operator's **readings** (§5c). Each has **Research**.
   Contradictions settle from documents already held (as now); the rest
   start a run, parented to the document that raised them.
4. **Research.** Every run, its state, its one next action; runs advance
   while this tab is open. Finished runs: "Read the draft →", then Publish
   (which processes it like an upload) or Discard.

On any `/p/` page when signed in: an action bar — this document's own
leads, a free question box, "Research this" on a selected phrase, and "Note
this" on a selected passage (§5c). (Operator-only JavaScript; the reader
page needs none.)

Header line, always: the model in use and this month's spend.

### Research runs

As built in #177–#178, with three changes:

- **Sources are never `pieces`.** Fetched pages go into `sources` only; the
  writer reads from `sources`. Bot-challenge pages and pages under 400
  characters are rejected at fetch time and listed as rejected in the run.
- **A run has a home** (the Research section) and a parent (§5).
- **The writer is Claude via the gateway** by default; Workers AI remains the
  per-run alternative for comparison, as the toggle from #178 already
  allows.

## 7. Findable, quotable, provenance intact — the checklist (NEO)

Everything here is server-rendered from the same rows as the page (rule 3).
This is the mechanics of §1b's "neural engine optimisation": the same work
the trade calls GEO/AEO, framed as what it is for — the operator's thinking
reaching the models other people think through.

| Item | State | What changes |
|---|---|---|
| Canonical, OG, Twitter card, `.md` twin, JSON-LD Article/DigitalDocument/FAQPage/Quotation | built | keep |
| `sitemap.xml`, `feed.json`, `llms.txt` | built | `lastmod` from the receipt; add `/llms-full.txt` (every document's plain text) and section hubs |
| BreadcrumbList, Organization, WebSite + SearchAction, Person (author) | missing | add to layout / about |
| OG image per document | missing | rendered once at processing, R2, `/og/<slug>.png` |
| Key figures above the fold | below the body | move up (§6) |
| Section hub pages | missing | `/research/<section>` |
| Related documents | recency | shared-subject query |
| Lineage links (`isBasedOn`, Grew from/into) | missing | §5 |
| IndexNow ping on publish | missing | one `fetch` per publish; Bing, DuckDuckGo, Yandex accept it |
| AI crawlers allowed at the edge | operator-checked 2026-09-15 | re-check after any zone change: `curl -A GPTBot https://canopticon.com/` |
| Crawler log `/citations` | built | show it in the workbench header, weekly count |
| Web analytics | none | Cloudflare Web Analytics beacon: free, no cookies, billed to nothing, optional JS that a reader never needs |
| Core Web Vitals | unknown | `look.mts` gains a Lighthouse pass; no client framework, so this is mostly image sizing and font loading |
| Search Console | unknown | operator adds the property; the sitemap is already there |

## 8. Design

The identity stays: dark ground, one red accent, Archivo / JetBrains Mono /
Newsreader. What changes is that the site gets *one* design instead of a
public design and an operator design that share tokens.

- **Type and space on a scale.** Six type sizes, one spacing scale, one
  radius. Every rule in `styles.ts` and `operator-styles.ts` maps to a token
  or is deleted. The stylesheet invariants test pins it.
- **The reading page is the hero.** A 68-character measure for prose; the
  rail collapses under it on narrow screens; receipts and cross-document
  links use one quiet underline each, distinguishable by colour, never a
  box. Key figures are a table, not cards.
- **The workbench looks like an application.** A left rail (Upload ·
  Documents · Worklist · Research) that becomes tabs on a phone; a status
  language (Processing / Processed / Failed) used everywhere; no banners
  that need dismissing; every action a plain button with its consequence in
  its label ("Publish — processes and goes live").
- **Every state has a screenshot.** The fixture seeds a processed document,
  a failed one, a run at each state, a lineage of three, and `look.mts`
  captures them. If it cannot be screenshotted it is not designed.
- **One OG card template** is the same card that appears in "Grew into" and
  in search results: title, kind, one verified figure, the site mark.

## 9. What is cut

Unmounted (files go once nothing imports them):

- Public: `/s/*`, the 13 arrangement routes, `/record/*`, `/briefs/*`,
  `/topics`, `/activity`, `/instruments`, `/studio/*`, `/bulk-expand`,
  `/investigations/:slug`, the `/p/` fallback to subject pages.
- Operator: `/op/records/*`, `/op/out/*`, `/op/proposals/*`, `/op/faces/*`,
  `/op/synthesis/*`, `/op/outputs/*`, `/op/studio/*`,
  `/op/answers/*/research`, `/op/feed/clear`, the ⌘K palette.
- Admin: `auto-expand`, `reextract`.
- The record-expand rows in `pieces`, purged through `nodes`.
- The five-pass extraction buttons, replaced by the one pipeline.

Kept: verification (`locateVerbatim`), the typed graph, findings extraction,
leads, `answer-lead`, the research state machine, the design tokens,
`look.mts`, every machine output, every test that still describes something
that exists.

## 10. Build order

*Status 2026-09-24: all five built, and the "after PR 5" list with them —
the document as workbench, new version, resurface, narrow answers for
unsourced figures, the tetrad shape, the sectioned research writer, and the
graph era's code deleted. PR 1 merged (#180); the rest on #181.
`docs/HANDOFF.md` has what remains.*

Five pull requests. Each leaves the site coherent on its own. What you will
see after each is stated so we can both check it.

**PR 1 — Clean the ground.** Crawler writes `sources` only; research reads
from `sources`; bot-challenge pages rejected. Purge the web-fetched rows.
Unmount everything in §9. `/library` lists only your material with honest
statuses and no buttons before their preconditions. PDF/DOCX via
`toMarkdown`. Claude through the gateway wired as a transport, with the
Workers AI fallback and the model shown in the header.
*You will see:* a library with only your documents, a clear status on each,
nothing you didn't put there, and the model named.

**PR 2 — One pipeline.** The state machine of §4, the poller, "Process
everything", auto passage, auto title, Retry, new version, receipts with
cost. Run it over the live corpus from the library tab and watch it finish.
*You will see:* every document Processed; every `/p/` page with its passage,
key figures, receipts and links.

**PR 3 — Lineage, bridges, readings, the worklist.** §5, §5b, §5c; "What
the record wants" and "Research" sections; "Research this" and "Note this"
on `/p/`; Related by shared subjects; the post-upload summary; runs parented
and briefs citing their parent; "Read by the operator" on the page.
*You will see:* an upload produce visible consequences with a button on
each; a bridge between two sections appear without anyone asking; a note you
write show up beside its passage; and a branch appear under a document when
its research publishes.

**PR 4 — Findable.** §7: section hubs, key figures up top, JSON-LD
additions, OG images, `llms-full.txt`, IndexNow, analytics beacon,
Lighthouse in `look.mts`.
*You will see:* a document shared anywhere shows a card; Search Console and
`/citations` have something to report.

**PR 5 — One design, and say what is true.** §8 in full; `/method`,
`/about`, the trust line and `CLAUDE.md` rewritten from this document; the
fixture seeds every state.
*You will see:* one product, and the site describing exactly what it does.

PR 2 is the one everything hangs on. PR 1 comes first because the pipeline
must not run over pages you did not upload, and because the model transport
has to exist before the pipeline uses it.

## 11. What this is not

- Not the dossier / "files on power" product in `docs/site-design.md` and
  `docs/canopticon-renovation.md`. The graph stays as machinery under the
  documents; it is not a destination.
- Not an analytics or SEO tool. An outside review read the site as a static
  blog and proposed building a rank-tracker; that is a different business.
  What was worth taking from it is in §7.
- Not autonomous. Nothing runs without the tab open. The idle cost is zero.
- Not a summariser. Every public sentence that is not the operator's own is
  a verbatim passage from a stored document, located by code.
- Not a content machine. §1b: the output is a course of study made public,
  and the measure is whether the operator learned and was cited — not reach.
