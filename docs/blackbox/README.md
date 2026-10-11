# Handoff: Canopticon "Black Box" — the redesigned public record

> Supersedes the 28 Sep – 9 Oct HANDOFF (kept in `versions/2026-10-11/`). Where this file and an older doc disagree, this file wins. `ESSAY-CONTRACT.md` still governs how articles are made; `BACKEND.md` governs feeds and email.

## Overview

Canopticon is a citable public record: research documents published whole at a permanent address, and articles and papers that argue from them, where every quotation is verbatim and links to the exact passage it came from.

**What is live today:** canopticon.com runs `crystalford/canopticon@main` (80c6eb5, PR #183, 24 Sep 2026). It still has the old nav (Essays · Research · About), old type (Archivo / JetBrains Mono / Newsreader), no published essays, and migrations up to 0063.

**What this package is:** the redesign built since then, plus the content it shows. That is 215 listed records: 123 research documents, 28 articles, 7 papers, 13 concepts, 40 open problems and 4 private projects. There are also 26 questions, 281 key figures, and 129 research documents with full text. None of it is in the repo yet.

## About the design files

The `.dc.html` files in `pages/` are **design references made in HTML**. They are not production code. Each one is a full page: markup with inline styles, plus a small logic class at the bottom (`class Component extends DCLogic`). They render in a browser via `support.js`.

The task is to **rebuild them inside the existing Worker** (`packages/api`, Hono, server-rendered HTML strings, tokens in `public/styles.ts`), using its patterns:
- the inline styles become the stylesheet;
- the logic classes become small progressive-enhancement scripts or server logic;
- hard-coded content becomes reads from the content store.

**No model call at render time** (unchanged rule).

## Fidelity

**High-fidelity.** Colours, type, spacing, radii, copy and interactions are final. Recreate them exactly. When a page and this README disagree on a value, the page wins.

## Read in this order

1. This file.
2. `ROUTES.md`: every page → route, the passage-link format, and the 301s from the live site.
3. `site-records.schema.json`: the records in `content/`. `canopticon-record.schema.json` still governs the read (Piece, Quote, Derivation).
4. `content/`: the data (see Content below).
5. `ESSAY-CONTRACT.md`: how an article is drafted and verified.
6. `BACKEND.md`: feeds, WebSub, email signup, CASL.
7. `LAYOUT.md`, `TERMS.md`, `RESEARCH-PROMPT.md`, `FOLLOW-RESEARCH.md`, `HOMEPAGE-RESEARCH.md`: rules and research behind specific choices.

## Content (`content/`)

| Path | What | Notes |
|---|---|---|
| `library.json` | every listed record (215) | the one list Front, Library, Topic, Search and feeds read; each row has `route` |
| `articles/<slug>.md` (29: 28 listed + Ground Pattern, unlisted) | articles | YAML front matter + Markdown. Quotes are `<q doc="<id>" section="<label>">exact text</q>`. All 1,244 quotes were re-checked against their source text at export, with 0 failures. Text outside `<q>` is the author's own. `[label](doc:<id>)` = link to a document |
| `papers/<slug>.md` (7) | papers | the author's own Markdown with reference list |
| `research/<id>.md` (123) | public research documents, full text | front matter: id, title, kind, topic, date, `listed_in_library` |
| `research-held/<id>.md` (6) | held private | **never public**: personal documents and one private build brief. Store, read, do not serve |
| `terms.json` (10) · `problems.json` (39) | concepts · open problems | `route`, `artRoute`, `docRoute` |
| `questions.json` (26) · `key-figures.json` (281) | derived rows | each links to its passage |
| `topic-timeline.json` | dated works cited per topic | shown only for topics with ≥4 works |
| `research-index.json` | id → title, source file, kind, topic, date | |
| `import-list.json` (129) | what to load | `origin`: 51 already on the live site (same ids as live slugs: re-read, don't duplicate) · 78 new (72 public, 6 held) |

## Pages

All public pages share the header and footer. The content column is 720px max, and the rail is a flex column `1 1 280px`. In the gap between 1000px and 1240px the pages reflow; below that they stack.

### Shared chrome
- **Header:** `max-width:1240px; padding:8px 32px; min-height:56px; border-bottom:1px solid #e8e3d8`, flex, `gap:8px 28px`.
  - Wordmark "canopticon": 18px/700, letter-spacing −.03em, ink.
  - Nav: Library · About, 14px/500, muted `#5a5e6b`, `gap:20px`. The current page is ink/600 with `aria-current="page"`.
  - Search: right-aligned (`margin-left:auto`), 14px/500, with a `/` keycap. The `/` key focuses search on every page.
  - Admin: 30px pill, `#fffdf8` on a `#d8d2c4` border, 13px/600, radius 10px, carrying a count of things waiting. Shown only when signed in.
- **Reading progress:** a 2px cobalt bar under the header on long pages (`#read-progress`).
- **Footer:** `border-top:1px solid #e8e3d8; background:#efebe1`. Plain 13px nav and feed links.
- **Hovercards** (`hovercards.js`): hovering a link to any article, paper or document shows its kind, title, dek and meta line, read from a map keyed by page.
- **Skip link** on every page; focus ring `2px solid #2f55c4; outline-offset:3px` on links and buttons.

### Front (`/`)
Curated homepage: the lead article, the McLuhan series as one numbered list in a single card, latest research, topics, and an email strip. No numbers band, no black buttons. Card hover tints rather than outlining. Content is hand-picked; new articles do not auto-appear (author decision).

### Library (`/library`)
Every record in one list. Filter rail by kind and topic (text tabs, never pills); sort options as plain text with the active one in ink. Rows show title, dek, and a meta row of pills (kind, topic) with the computed `stat`. Topic names link to topic pages, and a hub button per topic. Finite pagination. Reads `library.json`.

### Topic (`/topics/<slug>`)
Built at runtime for any topic from `library.json`, `questions.json`, `key-figures.json` and `topic-timeline.json`. Sections in order:
- Writing
- Concepts
- Open problems (each links to its `/open/` page)
- Research
- Questions
- Key figures
- Works the research cites (a dated timeline; each pill opens the citing passage), shown only when there are ≥4 works.

A note paragraph appears only when the author wrote one (currently McLuhan).

### Document (`/p/<id>`)
The research document, whole:
- Header: kind/topic pills, title, byline, and an "In one paragraph" summary.
- Body: section anchors `#s-N`, a rail with "On this page" that follows the reader (sticky last block), and "Cited by" listing the articles quoting it.
- **Passage links:** on load it reads `#q=<passage>` (or `?q=`), finds the text in the rendered body (whitespace-insensitive), wraps it in a mark, and scrolls to it. `#:~:text=` rides along for browsers that support it.

### Article (`/articles/<slug>`)
- **Header block:**
  - kind pill: Article, blue `#e4ecf7/#1f4e8c`;
  - topic pill: sand;
  - h1 at `clamp(32px,3.8vw,48px)/1.08`, weight 500, −.025em, max 24ch;
  - dek at `clamp(18px,1.8vw,22px)/1.45`, `#2e313a`;
  - byline: author link → `/about#m-author`, `<time datetime>`, minutes, quote count;
  - **Based on:** a wrapping row of green pills `#e3f0e6/#1f5e36`, radius 10px, 14px/500, with the "Based on" label on its own line above;
  - "Why I asked" when present;
  - **Thesis.** in bold.
- **Body:** 18px/1.66 ink, paragraphs `margin:0 0 18px`.
  - Section h2: 20px/600, −.015em, with a number in brick `#b0402c`, tabular.
  - Quotes: `<mark>` with background `rgba(47,125,82,.14)`, followed by a green receipt chip (11px/500, radius 999px, `#e3f0e6/#1f5e36`, `margin-left:5px`) that names the document section and links to `/p/<id>#q=…`.
  - The author's own sentences: dotted underline `1px dotted #b0402c`, tooltip "No receipt behind this sentence — it is the author's".
  - Objection boxes: `#fbf1ea`, radius 12px, padding 16/20, with an "Objection" pill `#f6dccd/#8a3a1f`.
  - Tables: in a `#fffdf8` card with a 1px `#e8e3d8` border and radius 12px; th background `#f3eee2`, 14px; with a caption plus a receipt chip.
  - Stat figures: cards with a 1px border and radius 14px.
- **Rail:** "In this article" TOC, sticky. The active item gets `#e6ecfa` background and `#1f4e8c` text.
- **After the body:** Sources pills, then "Cite this" (APA line + copy button), then the email block ("Get new articles by email").
- **Meta:** Highwire `citation_*` tags, Article JSON-LD, and CC BY 4.0.

### Paper (`/articles/<slug>`, labelled Paper)
Violet kind pill `#efe6f6/#5a2d82`. The whole text is the author's: no dotted underlines. Author–year citations link to the reference list; highlighted text is a verbatim quote tied to a reference. Series line "Part of" (McLuhan and the senses).

### Concept (`/concepts/<id>`) · Open problem (`/open/<id>`) · Ideas (`/ideas`)
- Concept and open-problem pages render from `terms.json` / `problems.json`: kicker topic, title, body, foot (prior-art status, e.g. "scholarly check pending"), "from" document, and the article that leans on it.
- Three concepts and one open problem have hand-built long pages; port them as-is.
- Ideas lists both kinds.
- Kind colours: Concept green `#e3f0e6/#1f5e36`; Open problem clay `#fbe9df/#8a3a1f`.

### Investigations (`/investigations`)
Library rows with `shelf:"investigation"`, the same list shape.

### Search (`/search?q=`)
- Searches titles, deks, key figures, questions and the full text of every public document (sentences, at most 3 per document).
- AND-match; quoted phrases are exact.
- Each hit links to its passage via `#q=`.
- Empty state: example queries and browse links. There is no "most searched" list.

### About (`/about`)
Author, method, how verification works, CC BY 4.0, and "for machines" (feeds, llms.txt, JSON twins). Anchor `#m-author` is the byline target.

### Follow (`/follow`)
- Email first; then optional topic picks (the consent sentence names them: `pickedPhrase`); then a weekly preview; then feed and agent panels.
- `?email=` pre-fills the field. Article and homepage blocks GET here.
- Prototype state is local only; the real flow is in BACKEND.md.
- **No mailing address is shown (author, 11 Oct).** CASL requires a mailing address in the consent request and in every email, so email sending cannot launch until one exists. A PO box or virtual mailbox satisfies it.

### Desk (`/desk`, behind Cloudflare Access)
- Admin: "Add something" (drop, choose, or paste a link) and "Waiting for you". Waiting for you is a list of cards, each with a kind pill, status pill, one primary action, one secondary action, and Undo.
- **Sorting an upload:** shape before model.
  - TL;DR / Key findings / [n] markers → research.
  - Abstract + References → paper.
  - First-person prose with no findings block → article.
  - Diagnosis, medication or therapy in the first person → personal, held private.
- Nothing publishes without Publish.
- Projects (Aldershot, Ancaster) are desk-only pages. Document Evidence is the redaction / evidence-only review screen.

## Design tokens

**Colour**
- Paper `#f6f3ec` · card `#fffdf8` · tint `#efebe1` · footer and table head `#f3eee2`.
- Ink `#15171c` · body `#2e313a` · secondary `#4a4d57` · muted `#5a5e6b` · hint `#7a7e8a`.
- Rule `#d8d2c4` · hairline `#e8e3d8`.

**Accents**
- Cobalt `#2f55c4` (soft `#e6ecfa`) means interaction: link hover, focus ring, active TOC, progress bar, selection.
- Brick `#b0402c` means the author's marks: section numerals and the dotted underline on unreceipted sentences.
- Green `#2f7d52` means verified: mark tint `rgba(47,125,82,.14)`, and receipt chips `#e3f0e6/#1f5e36` with hover `#d3e8d8`.

**Kind pills** (bg/text; 11px, 999px, padding 2px 8px)

| Kind | Background | Text |
|---|---|---|
| Article | `#e4ecf7` | `#1f4e8c` |
| Paper | `#efe6f6` | `#5a2d82` |
| Concept | `#e3f0e6` | `#1f5e36` |
| Open problem | `#fbe9df` | `#8a3a1f` |
| Research / Topic / Project | `#efebe1` | `#15171c` |
| Personal | `#f3e9d4` | `#6b4e14` |

**Type**
- **Geist** everywhere (400/500/600/700). IBM Plex Mono only for machine identifiers (rare).
- Sizes in px:

| Size | Use |
|---|---|
| 11 | pills |
| 12 | labels |
| 13 | meta |
| 14 | UI |
| 16 | small body |
| 18 | article body |
| 20 | h2 |
| `clamp(32px,3.8vw,48px)` | display (h1) |

- `text-wrap: pretty` on body and `balance` on headings.

**Space and shape**
- Space on a 4px rhythm: 8 / 12 / 16 / 24 / 32 / 40 / 56.
- Radii:

| Radius | Use |
|---|---|
| 14px | cards |
| 12px | boxes and tables |
| 10px | buttons, inputs, Based-on pills |
| 8px | row hover |
| 999px | pills |

- No box-shadows. Depth comes from hairlines; hover darkens the border or turns text cobalt, and never lifts.

## Interactions

- **Links:** colour transition .15s; on hover, text turns cobalt and the border goes cobalt.
- **Smooth scroll** with `scroll-padding-top:80px`, honouring `prefers-reduced-motion`.
- **Sticky rail TOC:** the active section is highlighted by an IntersectionObserver.
- **Cite this:** copies the APA line to the clipboard and swaps to a "Copied" state.
- **Passage links:** see Document above. They must work in every browser, not only via text fragments.
- **Hovercards:** appear on link hover/focus and dismiss on leave or Esc.
- **Everything is finite:** paginated lists with an end; no infinite scroll, autoplay or streaks.

## Rules that must survive the port

- **Verbatim or nothing.** Every `<q>` must be a literal substring of its source document's text (ignoring Markdown emphasis). Run the check at build and publish time; a failure blocks publish.
- **Numbers in the author's prose** must appear in the source.
- **Held documents** (`research-held/`, personal kinds) never appear on any public surface: pages, search, feeds, llms.txt, counts.
- **Projects are private.** No project names in public titles.
- **Tetrads** are ordinary text. Theses live on articles, not on research pages.
- **McLuhan-bias guard:** research prompts carry "stay on this question" (RESEARCH-PROMPT.md). `scan/mcluhan-bias.json` flags documents that frame unrelated topics through McLuhan.
- **Article length:** as long as the research warrants; no word or section caps.

## Build order (each step leaves the site whole)

1. **Tokens and chrome** in `public/styles.ts` and `public/layout.ts`: Geist, palette, header, footer, focus, progress bar.
2. **Content store:** load `import-list.json`. Re-read the 51 live documents in place, and add the 72 new public and 6 held ones. Store articles and papers as Markdown with `<q>` tokens, and run the verbatim check.
3. **Document page** `/p/<id>` with `#q=` passage finding and `#s-N` anchors.
4. **Article and paper pages**, the Library, and Topic pages from data.
5. **Concepts, open problems, Ideas, Investigations, Search.**
6. **Redirects** (ROUTES.md) and the JSON / `.md` twins.
7. **Feeds, WebSub, email** (BACKEND.md). Email waits on the mailing address.
8. **Desk** upload and sorting cards.
9. **Delete residue** last (see the old HANDOFF build order §9).

## Open items for the author

- **Mailing address:** none for now; this blocks email sending (CASL).
- **CASL consent wording:** for counsel.
- **Article text to confirm:** Public Sector "Why I asked" (drafted from the document), and the Curious Attention topic filing.
- **Herpes article:** not expanded, because its source must be handled in a script.
- **Front:** curated, so the articles published since 10 Oct are not on it.

## Files

- `pages/`: 51 public prototype pages and 4 desk pages, plus `support.js` and `hovercards.js` to open them in a browser. Open `pages/Canopticon Front.dc.html` and navigate from there.
- `content/`: data (above).
- `ROUTES.md` · `site-records.schema.json` · `canopticon-record.schema.json` · `ESSAY-CONTRACT.md` · `BACKEND.md` · `LAYOUT.md` · `TERMS.md` · `RESEARCH-PROMPT.md` · `FOLLOW-RESEARCH.md` · `HOMEPAGE-RESEARCH.md` · `feed.xml` · `feed.json` · `feeds/` · `llms.txt`.
