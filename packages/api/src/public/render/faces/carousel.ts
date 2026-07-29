// Carousel face — pure rendering (spec v2.6 Part 8 + Part 27).
//
// A carousel is a swipe-through sequence of slides for IG / LinkedIn /
// Threads. Same data the thread face uses (thesis + top judge-passed
// facts + closer with receipt) laid out for a single-slide-at-a-time
// reading rhythm. Template + query, no LLM at render time.
//
// In-page preview shows the slides stacked vertically (so the operator
// sees the whole carousel at a glance); the Produce flow renders each
// slide as a 1080×1350 PNG individually.

import { all } from "../../../lib/d1";
import { escapeAttr, escapeHtml } from "../../layout";

interface SignedAnalysisPage {
  id: string;
  slug: string;
  thesis: string | null;
  signed_by: string | null;
}

interface ClaimRow {
  claim_text: string;
  quote_id: string | null;
  piece_title: string | null;
}

const SLIDE_COUNT = 6; // 1 thesis + 4 facts + 1 closer
const FACT_COUNT = SLIDE_COUNT - 2;

async function loadCarouselClaims(db: D1Database, pageId: string): Promise<ClaimRow[]> {
  return all<ClaimRow>(
    db,
    `SELECT pc.claim_text, pc.quote_id,
            (SELECT p.title FROM quotes q
               JOIN nodes ns ON ns.id = q.source_id
               JOIN pieces p ON p.id = ns.piece_id
              WHERE q.id = pc.quote_id LIMIT 1) AS piece_title
       FROM page_claims pc
      WHERE pc.page_id = ? AND pc.judge_pass = 1 AND pc.kind = 'fact'
      ORDER BY pc.sort_order ASC
      LIMIT ?`,
    [pageId, FACT_COUNT],
  ).catch(() => []);
}

/** Compose one carousel slide as standalone HTML. Used both by the
 *  in-page preview (stacked) and by the Studio Produce flow (one PNG
 *  per slide). */
export function renderCarouselSlide(args: {
  index: number;
  total: number;
  kind: "thesis" | "fact" | "closer";
  body: string;
  receiptHref?: string;
  pieceTitle?: string;
  slug?: string;
}): string {
  const { index, total, kind, body, receiptHref, pieceTitle, slug } = args;
  const counter = `${index + 1} / ${total}`;
  const receipt =
    kind === "fact" && receiptHref
      ? `<div class="carousel-receipt"><a href="${escapeAttr(receiptHref)}">receipt ↗</a>${
          pieceTitle ? ` · ${escapeHtml(pieceTitle)}` : ""
        }</div>`
      : "";
  const canonical =
    kind === "closer" && slug
      ? `<div class="carousel-canonical">canopticon.com/s/${escapeHtml(slug)}?mode=signed</div>`
      : "";
  return `<div class="carousel-slide carousel-slide-${kind}">
  <div class="carousel-counter">${counter}</div>
  <div class="carousel-body">${escapeHtml(body)}</div>
  ${receipt}
  ${canonical}
</div>`;
}

export async function renderCarouselFace(
  db: D1Database,
  page: SignedAnalysisPage,
): Promise<string> {
  const thesis = page.thesis ?? "";
  if (!thesis) {
    return `<div class="face-empty">No thesis on this analysis yet — the carousel renders once the signed analysis is in place.</div>
<style>.face-empty { font-family: var(--serif); font-style: italic; color: var(--ink-3); font-size: 14px; }</style>`;
  }
  const facts = await loadCarouselClaims(db, page.id);
  const totalSlides = 2 + facts.length;
  const slides: string[] = [];
  slides.push(renderCarouselSlide({ index: 0, total: totalSlides, kind: "thesis", body: thesis }));
  facts.forEach((f, i) => {
    slides.push(
      renderCarouselSlide({
        index: i + 1,
        total: totalSlides,
        kind: "fact",
        body: f.claim_text,
        ...(f.quote_id ? { receiptHref: `/q/${f.quote_id}` } : {}),
        ...(f.piece_title ? { pieceTitle: f.piece_title } : {}),
      }),
    );
  });
  slides.push(
    renderCarouselSlide({
      index: totalSlides - 1,
      total: totalSlides,
      kind: "closer",
      body: "Read the full analysis + every receipt.",
      slug: page.slug,
    }),
  );

  return `<div class="carousel-face">
  <div class="carousel-meta">${totalSlides}-slide carousel · thesis · ${facts.length} judge-passed facts · closer · pure rendering, no LLM</div>
  <div class="carousel-deck">${slides.join("\n")}</div>
</div>
<style>
  .carousel-face { display: flex; flex-direction: column; gap: 12px; }
  .carousel-meta {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-3);
    letter-spacing: .03em;
  }
  .carousel-deck { display: flex; flex-direction: column; gap: 14px; }
  .carousel-slide {
    padding: 38px 32px;
    background: var(--paper, #faf6ef);
    color: var(--ink, #0c0d10);
    border: 1px solid #e7e2d6;
    border-radius: 12px;
    aspect-ratio: 1080 / 1350;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    position: relative;
  }
  .carousel-counter {
    position: absolute;
    top: 18px;
    right: 22px;
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--ink-3);
    letter-spacing: .06em;
  }
  .carousel-body {
    font-family: var(--serif);
    font-size: 26px;
    line-height: 1.3;
    font-weight: 600;
    color: var(--ink);
  }
  .carousel-slide-fact .carousel-body { font-weight: 400; font-style: italic; font-size: 22px; }
  .carousel-slide-closer .carousel-body { font-weight: 400; font-size: 20px; color: var(--ink-3); }
  .carousel-receipt, .carousel-canonical {
    position: absolute;
    bottom: 22px;
    left: 32px;
    right: 32px;
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--ink-3);
    letter-spacing: .03em;
  }
  .carousel-receipt a { color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--ink-3); }
</style>`;
}
