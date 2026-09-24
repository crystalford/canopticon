# The screenshot catalogue

Every state the product can be in, photographed in one run against the seeded
fixture (`packages/api/scripts/fixture.mts`) by `packages/api/scripts/look.mts`.
This is the designer's inventory: if a state is not in this table it has not
been looked at, and the fix is to seed it into the fixture and add a row here.

## Regenerate

```
cd /home/user/canopticon && pnpm add -D -w playwright \
  && cd packages/api \
  && CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm exec tsx scripts/look.mts <outDir> \
  && cd /home/user/canopticon && git checkout package.json pnpm-lock.yaml
```

`<outDir>` defaults to `packages/api/.look/`. Playwright is deliberately not a
repo dependency, which is why the `git checkout` at the end is mandatory and
why `playwright install` is never run — point `CHROMIUM_PATH` at the Chromium
already on the machine. The run takes about ten seconds and prints one line
per shot; a line carrying `⚠` reports a page error, a horizontal overflow
(with the widest element), or a failed SEO audit on a public page. A clean run
has no `⚠` anywhere.

The operator console scrolls inside its own pane, not the document, so the
tool grows the viewport to the tallest internal scroller before each shot —
otherwise every workspace shot stopped at 1000px and the review panel was
never in a picture.

## The shots

Widths: 1400 is the desktop frame, 390 is a phone. "Reader" is anonymous;
"operator" is signed in with the fixture's session secret.

| Shot | Route | State it shows | Who sees it | Width |
|---|---|---|---|---|
| `front` | `/` | Front page: latest essay, the essays list, research grouped by section (one section left as "Everything else") | reader | 1400 |
| `front-mobile` | `/` | The same on a phone: the collapsed nav, sections stacked | reader | 390 |
| `search` | `/search?q=housing` | Results with no stored answer: three verified passages with receipts, then two documents with excerpts and match scores | reader | 1400 |
| `search-mobile` | `/search?q=housing` | The same on a phone | reader | 390 |
| `search-answered` | `/search?q=Did housing funding rise in 2026?` | **"From the record"**: a frozen answer (`lead_answers`, kind `question`) above the passages — the model tag, one quote with its receipt, one without, and the red discard count | reader | 1400 |
| `search-operator` | same | The same page signed in: "Ask the record again", the "with Claude" switch and "Research this on the web" — the only forms on the page | operator | 1400 |
| `hub` | `/hub` | Optional: skipped with a 404 note if the route is not mounted on this tree | reader | 1400 |
| `essays` | `/essays` | The essays index | reader | 1400 |
| `essays-mobile` | `/essays` | The same on a phone | reader | 390 |
| `research` | `/research` | The research index, grouped by section | reader | 1400 |
| `piece` | `/p/the-logic-costume` | An essay: TOC, question-shaped sections, sources, a reading in the margin and one whose passage is no longer in the text | reader | 1400 |
| `piece-mobile` | `/p/the-logic-costume` | The same essay on a phone | reader | 390 |
| `piece-operator` | `/p/the-logic-costume` | The same essay signed in: the action bar, the note form, the readings with their delete/draft buttons | operator | 1400 |
| `piece-auto` | `/p/budget-2026-estimates` | A research document: provenance banner, summary table promoted, findings block, a pipe table, cross-links, lineage ("Grew into"), a finding whose quote has gone missing | reader | 1400 |
| `research-mobile` | `/p/budget-2026-estimates` | The research document on a phone — the wide table is the one construct that can push a page sideways | reader | 390 |
| `about` | `/about` | About | reader | 1400 |
| `research-workspace` | `/op/research?q=What is the genuine white space…` | A sectioned run mid-write: plan ticked, two of five sections written (one with a killed quote in red), sources landing, one rejected as a bot challenge, the one next action | operator | 1400 |
| `research-workspace-mobile` | same | The workspace on a phone | operator | 390 |
| `research-review` | `/op/research?q=Does reprofiling explain the gap…` | **The review, draft**: a done run, the brief at reading measure, sections with counts, gaps, Publish and Download | operator | 1400 |
| `research-review-warning` | `/op/research?q=How much of the housing transfer was new money?` | **The review, warning**: more quotes killed than verified — the red line above Publish | operator | 1400 |
| `research-review-published` | `/op/research?q=Which vote did the housing transfer come out of?` | **The review, published**: the panel says Published, links to `/p/<slug>`, offers Download only; the header reads "published · in the record" | operator | 1400 |
| `library` | `/library` | The workbench: model in use, upload, resurfaced passage, every pipeline state in the status column (processed, mid-read, queued, failed, never processed), receipts, leads with a stored answer, the worklist | operator | 1400 |
| `library-mobile` | `/library` | The workbench on a phone: the rail becomes tabs | operator | 390 |
| `library-uploaded` | `/library?uploaded=budget-2026-estimates,transfer-payments-2025` | The "Just uploaded" banner: one document processed, one still queued | operator | 1400 |

## Not photographed

- **The search miss** (`No matches for … yet`, and the operator's labelled AI
  preview). The fixture's vector stub answers every query with the same
  passages, so a miss cannot be produced from it; `tests/search-model.test.ts`
  covers both branches instead.
- **`/q/<id>`** receipts, `/method`, the sign-in page, and the sectioned run's
  failed state. None are in the run yet.
- **The mobile operator console's left rail** overlaps the workspace at 390px
  (visible in `research-workspace-mobile` and `library-mobile`) — a
  pre-existing layout state, recorded here rather than hidden.
