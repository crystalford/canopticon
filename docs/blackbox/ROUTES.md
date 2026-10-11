# Routes and redirects

Prototype files are named `Canopticon <Page>.dc.html`; production routes below. Every JSON record in `content/` already carries its `route`.

## Public

| Prototype | Route | Source of content |
|---|---|---|
| Front | `/` | curated; reads library.json for counts |
| Library | `/library` (`?kind=`, `?topic=`) | library.json (+ questions, key-figures) |
| Topic (`?topic=`) | `/topics/<slug>` | library.json, questions.json, key-figures.json, topic-timeline.json — built at runtime, every topic |
| Doc (`?d=<id>`) | `/p/<id>` | content/research/<id>.md (same ids as live slugs for the 51 already live) |
| Essay * | `/articles/<slug>` | content/articles/<slug>.md |
| Paper * | `/articles/<slug>` (labelled Paper) | content/papers/<slug>.md |
| Term (`?p=<id>`) | `/concepts/<id>` | terms.json |
| Concept · Concept CPAI · Concept Overhearer | `/concepts/self-extinguishing-maintenance` · `/concepts/cpai` · `/concepts/the-overhearer` | hand-written pages (port as-is) |
| Problem (`?p=<id>`) | `/open/<id>` | problems.json |
| Open Whey | `/open/hot-coffee-whey` | hand-written page |
| Ideas | `/ideas` | terms.json + problems.json |
| Investigations | `/investigations` | library.json rows with `shelf: "investigation"` |
| Search (`?find=`) | `/search?q=` | titles, deks, figures, questions and full document text; AND match, quoted phrases exact; every hit links to its passage |
| Method | `/about` | hand-written |
| Follow | `/follow` | form → BACKEND.md |
| Feeds | `/feed.xml`, `/feed.json`, `/feeds/<topic>.xml|json`, `/llms.txt` | generated (BACKEND.md) |

## Signed in (behind Cloudflare Access)

| Prototype | Route |
|---|---|
| Admin | `/desk` |
| Aldershot · Collection | `/desk/projects/aldershot` · `/desk/projects/ancaster` (projects are private) |
| Document Evidence | `/desk/review/<id>` (redaction / evidence-only review) |

## Passage links

Every quote and figure links to `/p/<id>#q=<encoded passage>:~:text=<encoded passage>`. The document page finds the passage in the rendered text, marks it and scrolls to it; `#:~:text=` is the browser fallback. Section anchors are `#s-N`. Encode `-` as `%2D`; never put `&` in an href.

## Redirects (301) from the live site

| Live | New |
|---|---|
| `/essays` | `/articles` |
| `/essays/<slug>` | `/articles/<slug>` |
| `/research` | `/library?kind=Research` |
| `/research/<section>` | `/topics/<matching topic>` (map the eight old sections by hand) |
| `/method` | `/about#method` |
| `/q/<id>` | `/p/<slug>#q=<passage>` (look up the quote's passage) |
| `/library` (operator, old) | `/desk` when signed in |
| `/p/<slug>` | unchanged |

Keep `/p/<slug>.md` and `/p/<slug>.json` twins.
