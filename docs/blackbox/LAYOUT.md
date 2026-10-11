# Layout system — one grid for every page

The problem: pages mix widths ad hoc — a 34em column, a full-width strip, a 620px column, a 280px rail with a 72px gap — so edges don't line up from one block to the next. Fix: every element's left and right edges must land on one of a few lines.

## The lines (desktop, 1240px frame, 32px side padding → 1176px usable)

| Line | Width | Used by |
|---|---|---|
| **Full** | 1176 | header, signed-in bar, footer, index lists (Research, Essays, Ideas, Follow), front-page card grids, the desk |
| **Reading + rail** | 720 + 64 gap + 280 = 1064, left-aligned | essays, documents, reports, concepts, open problems, topic pages, About |
| **Reading** | 720 | everything in the reading column: title block, dek, byline, receipt strip, body, tables |
| **Rail** | 280 | on-this-page, cite, metadata, follow |

## Rules
1. On reading pages the **title block, dek, byline and receipt strip sit in the reading column (720)**, not full width. The rail starts level with the title block, so the page reads as two clean columns from top to bottom.
2. Nothing inside the reading column sets its own max-width (no 34em, 30em, 22ch on prose). Measure comes from the column.
3. Index pages have no rail; their title, intro and list all span Full. Intros cap at 720 so the first line length matches reading pages.
4. The desk is Full, with its two-up sections as 1fr / 1fr at 48px gap.
5. Below 960px: the rail drops under the reading column; everything becomes one column at Reading width.
6. Vertical rhythm: 64px between sections (72px on the front), 24px between a section label and its content, 12px inside cards.
7. Cards: one recipe — `background:#fffdf8;border:1px solid #e8e3d8;border-radius:14px` with `box-shadow:0 1px 2px rgba(21,23,28,.03),0 12px 32px -20px rgba(21,23,28,.18)`; card links lift 2px with a deeper shadow on hover. Tint (`#efebe1`) panels are for bands and asides, never for a thing you click. Short indexes (Front research, Essays, Ideas) are card grids at `minmax(340px,1fr)`; long lists (Research, project hubs) are flush rows.

## How the containers are written (inline, no media queries)
- Reading + rail wrapper: `display:flex;flex-wrap:wrap;gap:48px 64px;align-items:flex-start;max-width:1064px`
- Reading column: `flex:999 1 480px;min-width:0;max-width:720px` — the title block is its first child.
- Rail: `flex:1 1 280px;min-width:0` (sticky). Fills exactly 280 beside the column; wraps below it and goes full width under ~824px.
- Index rows are flush (`padding:Npx 0`), never bled with negative margins. Tables sit in `overflow-x:auto` wrappers.

## The scan (run first, in a fresh session)
Tool: `Layout Scan.dc.html` — open it and it loads every site page at 1280 and 390 and lists off-grid blocks. It checks the block tree under `<main>`; it does not look inside padded/bordered boxes, lists, tables or card grids (those are components, aligned by their container). Last run 30 Sep 2026: 24 pages, 0 off-grid.

For every page at 1280px and 390px: collect every block element's left and right edge (getBoundingClientRect), group by value, and flag any edge not on a line above. The output is a per-page list of off-grid elements; fix each by moving it into the right container, not by adjusting its width. Re-run until every page reports zero off-grid blocks.
