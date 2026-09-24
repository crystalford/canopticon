# The Record — what Canopticon is, and the build that makes it that

> Written 2026-09-24 after reading the whole of `packages/api` against the
> live `/library`. This is a product definition and a build order, in one
> document, meant to replace piecemeal fixes. When it is adopted, `CLAUDE.md`
> is rewritten from it; until then `CLAUDE.md` is still the source of truth.

---

## 1. What it is

**Canopticon is a research record that compounds.** You feed it documents —
your research reports and your essays. Each one is published whole at its own
URL, verified sentence by sentence against itself, and wired into everything
already in the record. Then the record tells you what it now knows, what it
can't answer, and where its documents disagree — and each of those is a button
that starts a piece of research, which becomes the next document.

It has two faces:

- **canopticon.com** — the public record. Citable pages, receipts, machine
  formats. Built for readers and for answer engines. No account, no JS needed.
- **/library** — the workbench. Your application. Upload, watch a document get
  processed, see what it connected to, pick the next thing to research, review
  the draft, publish it. One page, one loop.

The loop is the product:

```
   upload ──▶ published + processed ──▶ what it connected to
                                              │
        publish ◀── review draft ◀── research ◀┘  (leads, questions, gaps)
```

Every trip round the loop makes the earlier documents richer: new links into
them, new contradictions surfaced, new questions answered. That is the reason
to upload the next one. That is also the honest version of "GEO": a site whose
pages cite each other, carry verified figures with named sources, and grow.

## 2. Why it feels like a mess — the actual causes

These are what the code does today, not impressions. Everything you've been
seeing ("Not extracted yet", buttons that appear then fail, rows you didn't
upload) is downstream of six things.

1. **Processing a document is five separate passes with five separate
   triggers, and only the first tick of the first one runs by itself.**
   Text extract (automatic) → digestion (automatic, *first wave only*: two
   chunks, then it re-queues itself for a cron that is switched off) → findings
   & questions (per-document button) → lead passage (button, then a second
   Approve button) → topic (bulk button). A 20KB document needs about five
   presses of "Process queue" just to finish digestion, and nothing on the
   page says so. So on the live site almost nothing is fully processed, and the
   public page — whose whole point is the receipts, the findings block, the
   lead passage and the links to other documents — renders without any of
   them.

2. **The buttons appear before their preconditions.** The "+ Extract" fold
   shows on every published row, but both buttons inside it fail with "run
   document extraction first" unless digestion has already written a source
   node. The fold is gated on publication status, not on readiness.

3. **The crawler `CLAUDE.md` calls retired is not retired.** "Dig here" on a
   lead, and the research workspace, fetch web pages and save each one as a
   `pieces` row — kind "research report", status "working material", date
   "—". That is what "Just a moment..." (a Cloudflare bot-challenge page) and
   the brainly.com row are. `/library` shows every row in `pieces` with no
   filter, and "Extract all" would happily pull quotes from those pages into
   your graph.

4. **Two products' worth of routes are still mounted.** Thirteen graph-era
   "arrangement" pages, subject pages, records, briefs, proposals, faces,
   synthesis, studio-produce, outputs — reachable, unlinked, and several of
   them shadowed by redirects so their handlers can never run. Every one is a
   thing you can stumble into and not know what it is.

5. **Some of what the site says about itself is not true.** `CLAUDE.md` and
   the upload form say PDF; `extract.ts` refuses PDFs. The document page's
   "Keep exploring" shows the four newest documents, not related ones. Topic
   pills on a document read a legacy table that is empty.

6. **Each previous round fixed the thing you had just complained about.**
   Sign-in, then rendering, then titles, then the stylesheet, then the dead
   rooms. All real, all needed, none of them the pipeline — and with the
   pipeline never completing, nothing else could look finished.

The design constraint under all of it: a Worker execution is short, and rule 4
(nothing runs unattended) is right — an idle site should cost nothing. The
project already solved this once, for research runs in #177: a state machine
that does one step per request, driven by a poller while the tab is open. **The
browser is the scheduler.** It was applied to research and never to documents.
Applying it to documents is the single change that makes everything else real.

## 3. What happens to a document

Upload is authorization — for publishing *and* for processing. Nothing
downstream asks again.

```
UPLOAD  .md .txt .html .pdf .zip
  │
  ├─ 1. text        extract (PDF via Workers AI toMarkdown)      no model
  ├─ 2. publish     pieces row, /p/<slug> is live                no model
  ├─ 3. title       if the title is a filename or a working title,
  │                 rename to the best verbatim candidate; keep
  │                 original_title; one click to revert           no model
  ├─ 4. digest      typed graph, verified quotes   N chunks      2 calls/chunk
  ├─ 5. findings    figures with source+date, questions          1 call/chunk ×3
  ├─ 6. passage     lead passage, verbatim, auto-approved        1 call
  ├─ 7. section     one of eight closed sections                 1 call
  └─ 8. done        receipt written: what was read, what survived
```

One state machine, `piece_processing`: `text → title → digest(i/n) → findings
→ passage → section → done | failed(reason)`. One step per request at
`POST /op/process/advance`. The `/library` page polls it while open, exactly
as the research workspace does. Each row shows one status: **Processing 3/7 ·
digesting**, **Processed**, or **Failed: <reason>** with a Retry. There is one
"Process everything" button that drives the whole queue while the tab is open.
Close the tab and it stops; open it and it resumes. No cron.

What changes from today's rules:

- **The lead passage is auto-approved.** It is a verbatim passage from a
  document you already authorised, located and verified by code. Publishing it
  is no more of a claim than publishing the document. (You can still replace
  it.)
- **The title is auto-corrected when — and only when — it is a filename or a
  working title.** A real title is never touched. The original is kept and the
  rename is reversible from the row.
- **Findings, passage and section run on upload, not on request.** "AI output
  is an input artifact" still holds: every one is frozen into a row, nothing
  runs at render time.
- **Re-processing is one button and does not lose anything silently.** Today
  "Re-extract all" cascade-deletes findings without saying so.

Model budget per document: Scout for bulk, gpt-oss-120b for relations, as now.
Roughly 2×chunks + 5 calls. Cost is yours to see in the receipt.

## 4. The surfaces

### Public — canopticon.com

| Page | What it is |
|---|---|
| `/` | Latest essay, the essays, research by section. As now. |
| `/essays`, `/research` | The two indexes. As now. |
| `/p/<slug>` | **The document.** Title, dek, lead passage, the document's own summary and gaps promoted, the body with verified figures linked to their receipts and phrases linked to the other documents that share them, the findings block, "Related documents" (by shared subjects, not by date), cite box, `.md` twin. |
| `/q/<id>` | The receipt. As now. |
| `/search` | One box. As now. |
| `/about`, `/method` | As now; `/method` describes §3. |
| machine | `/p/<slug>.md`, JSON-LD, `/sitemap.xml`, `/llms.txt`, `/feed.json`. As now. |

Nav: **Essays · Research · About** + search. Footer adds Library / Sign in /
Method / llms.txt / Feed. Nothing else is reachable.

### The workbench — `/library` (signed in)

One page, four parts, top to bottom:

1. **Upload.** Dropzone. The moment a file lands, its row appears below with
   a live status. Nothing else to press.
2. **Documents.** Your uploads and your published research briefs — nothing
   else. Each row: title (with "renamed from …" if it was), kind, section,
   status (Processing i/n · Processed · Failed), date, and its receipt: read in
   full / truncated at N chars, quotes verified, findings, questions, links in,
   links out. Actions: Re-process, Replace passage, Rename, Unpublish.
3. **What the record wants.** The worklist, recent-first, never ranked by
   frequency: contradictions between two documents, figures with no source
   named, questions the documents raise and don't answer. Each one has a
   **Research** button. Contradictions settle from documents already held
   (as now). The rest start a research run.
4. **Research.** Every run, its state, its one next action. Runs in progress
   advance while this tab is open. Finished runs show "Read the draft →";
   the review page has Publish and Discard. Publish sends the brief through
   the same pipeline as an upload.

Plus, on any `/p/` page when signed in: a small action bar — "Research this"
with the document's own leads, and a free question box. Selecting a phrase and
pressing Research starts a run on it. (Operator-only JS; the reader page needs
none.)

### Research runs

As built in #177–#178: bank sources → write → one follow-up at a time → brief,
one step per request, writer chosen per run. Two changes:

- **Sources are never `pieces`.** They go into `sources` only. The brief reads
  from `sources`. The crawler cannot put a page in your library.
- **A run has a home.** The Research section above lists them; the workspace
  is reached from there.

## 5. What is cut

Unmounted from the app (files can go in a follow-up once nothing imports them):

- Public: `/s/*`, the 13 arrangement routes (`/d /t /profile /n /pr /w /b /c
  /f /stat /l /m /ct`), `/record/*`, `/briefs/*`, `/topics`, `/activity`,
  `/instruments`, `/studio/*`, `/bulk-expand`, `/investigations/:slug`, the
  `/p/` fallback to subject pages.
- Operator: `/op/records/*` (expand, produce-video, draft-analysis,
  draft-proposal, bulk-expand), `/op/out/*`, `/op/proposals/*`, `/op/faces/*`,
  `/op/synthesis/*`, `/op/outputs/*`, `/op/studio/*`, `/op/answers/*/research`,
  `/op/feed/clear`, the ⌘K palette.
- Admin: `auto-expand`, `reextract` (replaced by the pipeline).
- The record-expand rows in `pieces`: purged through `nodes`, once no research
  run still references them.

Kept, unchanged: verification (`locateVerbatim`), the typed graph and
digestion, findings extraction, leads, `answer-lead`, the research state
machine, the design system, `look.mts`, every machine output, every test.

## 6. Build order

Four pull requests. Each leaves the site coherent on its own; none depends on
a later one to make sense. What you will see after each is stated so we can
both check it.

**PR 1 — Clean the ground.**
Crawler writes `sources` only; research reads from `sources`. Purge the
web-fetched rows. Unmount everything in §5. `/library` lists only your
material. Row status becomes honest: no "Not extracted yet" on rows that can't
be extracted, no buttons before their preconditions. Fix PDF (toMarkdown) or
remove it from the form — toMarkdown, if it works in the sandbox test.
*You will see:* a library with only your documents, a clear status on each,
and nothing you didn't put there.

**PR 2 — One pipeline.** The state machine in §3, the poller, "Process
everything", auto passage, auto title, Retry, receipts per row. Run it over
the live corpus from the library tab and watch it finish.
*You will see:* every document Processed; every `/p/` page with its passage,
findings, receipts and links; the research index grouped by section.

**PR 3 — The record shows what it built.** "What the record wants" and
"Research" sections; "Research this" bar on `/p/`; Related documents by
shared subjects; the post-upload summary ("linked to 3 documents, 1
contradiction, 2 questions"); research index.
*You will see:* an upload produce visible consequences, each with a button.

**PR 4 — Say what is true.** `/method`, `/about`, the trust line, `CLAUDE.md`
rewritten from this document; `look.mts` fixture seeds a processed document
and a run at every state so a screenshot can show each.
*You will see:* the site describe exactly what it does, and nothing else.

PR 2 is the big one and the one everything hangs on. PR 1 first because the
pipeline must not run over pages you did not upload.

## 7. What this is not

- Not the dossier / "files on power" product in `docs/site-design.md` and
  `docs/canopticon-renovation.md`. Those were the graph era. The graph stays
  as machinery under the documents; it is not a destination.
- Not autonomous. Nothing runs without the tab open. The idle cost is zero.
- Not a summariser. Every public sentence that is not the operator's own is a
  verbatim passage from a stored document, located by code.
