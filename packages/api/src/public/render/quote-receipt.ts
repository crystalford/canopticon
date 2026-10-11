// Quote receipt — /q/:id.
//
// One verbatim quote, its source document, the node it supports, the
// subject pages that cite it. Deep-linkable evidence. This is the receipt
// at the end of every superscript in the publication: click [3] on a
// signed reading and land HERE, where the quote is shown verbatim, the
// source document is named and linked, and every page that cites this
// quote is listed.
//
// GEO move: schema.org Quotation + ClaimReview JSON-LD so AI answer
// engines can cite this receipt directly. Princeton GEO research shows
// schema-tagged citations outcite untagged by 30–40% in answer engines.

import { all, one } from "../../lib/d1";
import { type PublicEnv, resolveOperatorId } from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";

interface QuoteRow {
  id: string;
  verbatim_text: string;
  byte_offset: number | null;
  byte_length: number | null;
  created_at: string;
  // The node this quote supports.
  node_label: string;
  node_kind: string;
  // The source document (via the source node → pieces).
  source_node_label: string;
  source_node_id: string;
  piece_slug: string | null;
  piece_title: string | null;
}

interface CitingPage {
  slug: string;
  label: string;
  kind: string;
  signed_status: string;
  thesis: string | null;
}

export async function renderQuoteReceipt(env: PublicEnv, quoteId: string): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;

  const quote = await one<QuoteRow>(
    env.DB,
    `SELECT q.id, q.verbatim_text, q.byte_offset, q.byte_length, q.created_at,
            target.label AS node_label, target.kind AS node_kind,
            src.label AS source_node_label, src.id AS source_node_id,
            p.slug AS piece_slug, p.title AS piece_title
       FROM quotes q
       JOIN nodes target ON target.id = q.node_id
       JOIN nodes src ON src.id = q.source_id
       LEFT JOIN pieces p ON p.id = src.piece_id
      WHERE q.id = ? AND q.user_id = ?`,
    [quoteId, userId],
  );
  if (!quote) return null;

  // Pages that cite THIS quote: page_claims.quote_id = quoteId, joined to
  // pages + subject node for the label.
  const citingPages = await all<CitingPage>(
    env.DB,
    `SELECT DISTINCT p.slug, n.label, n.kind, p.signed_status, p.thesis
       FROM page_claims pc
       JOIN pages p ON p.id = pc.page_id
       JOIN nodes n ON n.id = p.subject_node_id
      WHERE pc.quote_id = ? AND pc.user_id = ?
      ORDER BY (p.signed_status = 'published') DESC, p.updated_at DESC
      LIMIT 12`,
    [quoteId, userId],
  ).catch(() => []);

  // Kind label for the node this quote supports.
  const NODE_KIND_LABEL: Record<string, string> = {
    neutral_fact: "Neutral fact",
    assertion: "Attributed assertion",
    event: "Event",
    entity: "Entity attribute",
    theme: "Theme",
  };
  const nodeKindLabel = NODE_KIND_LABEL[quote.node_kind] ?? "Fact";

  // schema.org JSON-LD — Quotation as the @type lets AI answer engines
  // cite the exact quote with attribution. Adds isBasedOn linking to the
  // source document URL.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Quotation",
    text: quote.verbatim_text,
    isBasedOn: quote.piece_slug ? `https://canopticon.com/p/${quote.piece_slug}` : undefined,
    citation: quote.piece_title ?? quote.source_node_label,
    dateCreated: quote.created_at.slice(0, 10),
    creator: { "@id": "https://canopticon.com/#org" },
    inLanguage: "en",
  }).replace(/<\/script/gi, "<\\/script");

  const citingPagesSection = citingPages.length
    ? `<section class="q-citing">
  <div class="sec-k">Pages that cite this quote</div>
  <div class="q-citing-list">
    ${citingPages
      .map(
        (
          c,
        ) => `<a class="q-cite-row" href="/s/${escapeAttr(c.slug)}${c.signed_status === "published" ? "?mode=signed" : ""}">
  <span class="q-cite-kind">${escapeHtml(c.kind)}${c.signed_status === "published" ? " · signed" : ""}</span>
  <span class="q-cite-label">${escapeHtml(c.label)}</span>
  ${c.thesis ? `<span class="q-cite-thesis">"${escapeHtml(c.thesis.slice(0, 110))}"</span>` : ""}
</a>`,
      )
      .join("")}
  </div>
</section>`
    : `<section class="q-citing q-citing-empty">
  <div class="sec-k">Pages that cite this quote</div>
  <p>This quote is in the graph but not yet on any signed page. It will appear here when a signed analysis rests on it.</p>
</section>`;

  const sourceLink = quote.piece_slug
    ? `<a class="q-src-link" href="/p/${escapeAttr(quote.piece_slug)}">${escapeHtml(quote.piece_title ?? quote.source_node_label)}</a>`
    : `<span class="q-src-link">${escapeHtml(quote.source_node_label)}</span>`;

  const offsetLine =
    quote.byte_offset !== null && quote.byte_length !== null
      ? // NOT "byte offset", and NOT a document position. locateVerbatim uses
        // indexOf/slice, so these are UTF-16 character indices, and they are
        // measured against the extraction window — a ~3000-char chunk whose
        // index is never stored — rather than the document. Labelling them
        // honestly is the whole point of this page.
        `<div class="q-offset">Position ${quote.byte_offset} · ${quote.byte_length} characters <span class="q-offset-note">(within the extraction window)</span></div>`
      : "";

  const body = `
<script type="application/ld+json">${jsonLd}</script>
<article class="q-receipt">
  <header class="q-head">
    <div class="kicker">Verbatim quote · Receipt</div>
    <h1 class="q-h1">A verified quote</h1>
    <p class="q-sub">This is the receipt at the end of every superscript. The text below is a literal substring of the source document — checked mechanically, not vouched.</p>
  </header>

  <blockquote class="q-quote">"${escapeHtml(quote.verbatim_text)}"</blockquote>

  <section class="q-attribution">
    <div class="q-attr-row">
      <span class="q-attr-k">From</span>
      <span class="q-attr-v">${sourceLink}</span>
    </div>
    <div class="q-attr-row">
      <span class="q-attr-k">Supports</span>
      <span class="q-attr-v">${escapeHtml(nodeKindLabel)} · ${escapeHtml(quote.node_label)}</span>
    </div>
    ${offsetLine ? `<div class="q-attr-row"><span class="q-attr-k">Provenance</span><span class="q-attr-v">${offsetLine}</span></div>` : ""}
    <div class="q-attr-row">
      <span class="q-attr-k">Extracted</span>
      <span class="q-attr-v"><time datetime="${escapeAttr(quote.created_at)}">${formatLongDate(quote.created_at)}</time></span>
    </div>
  </section>

  ${citingPagesSection}

  <aside class="q-method">
    <div class="q-method-k">How this quote is verified</div>
    <p>Every quote on canopticon is a <b>literal substring</b> of a stored source document. Whitespace differences are tolerated; word substitutions are not. The original file is preserved in object storage at upload time; this quote is a span inside the text extracted from it.</p>
    <p>The check is mechanical, not vouched for. It runs when the quote is extracted, and again every time the document's own page is rendered: the span is located in the document afresh, and <b>if it can no longer be found, nothing is linked</b> — the page will not point at text that is not there.</p>
    <p class="q-caveat">The position recorded above is relative to the window the extractor read, not to the whole document, and it is a character count rather than a byte count. It is kept because it is what was measured; it is not a citable coordinate, and this page would rather say so than imply a precision it does not have.</p>
  </aside>
</article>

<style>
  .q-receipt { max-width: 760px; margin: 0 auto; padding: 28px 0 80px; }
  .q-head { margin-bottom: 28px; }
  .q-head .kicker {
    font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--ink-3); font-weight: 600; margin-bottom: 12px;
  }
  .q-h1 {
    font-family: var(--serif);
    font-size: 38px; line-height: 1.1; letter-spacing: -.018em;
    color: var(--ink); margin: 0 0 14px;
  }
  .q-sub {
    font-family: var(--serif);
    font-size: 16px; line-height: 1.55;
    color: var(--ink-2);
    max-width: 660px;
  }
  .q-quote {
    font-family: var(--serif);
    font-size: 22px; line-height: 1.55;
    color: var(--ink);
    font-style: italic;
    margin: 0 0 36px;
    padding: 24px 28px;
    border: 1px solid var(--rule);
    border-radius: 9px;
    background: var(--surface, #fff);
  }
  .q-attribution {
    padding: 22px 24px;
    border: 1px solid var(--rule);
    border-radius: 9px;
    background: var(--paper-2, #f4f1ea);
    margin-bottom: 36px;
  }
  .q-attr-row {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 14px;
    padding: 8px 0;
    border-top: 1px solid var(--rule-soft, var(--rule));
  }
  .q-attr-row:first-child { border-top: none; }
  .q-attr-k {
    font-size: 11px; letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--ink-3); font-weight: 600;
    padding-top: 4px;
  }
  .q-attr-v {
    font-family: var(--serif);
    font-size: 15.5px; line-height: 1.5;
    color: var(--ink);
  }
  .q-src-link { color: var(--accent); text-decoration: none; }
  .q-src-link:hover { text-decoration: underline; }
  .q-offset {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink-3);
    letter-spacing: .02em;
  }
  .q-offset-note { color: var(--ink-mute); }
  .q-caveat { color: var(--ink-3); }

  .q-citing { margin-bottom: 36px; }
  .q-citing .sec-k {
    font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--ink-3); font-weight: 600; margin-bottom: 14px;
  }
  .q-citing-list { display: flex; flex-direction: column; }
  .q-cite-row {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 14px;
    padding: 13px 0;
    border-top: 1px solid var(--rule);
    text-decoration: none;
    color: var(--ink);
  }
  .q-cite-row:first-child { border-top: none; }
  .q-cite-row:hover { background: rgba(0,0,0,0.02); }
  .q-cite-kind {
    font-size: 11px; letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--ink-3);
  }
  .q-cite-label {
    font-family: var(--serif);
    font-size: 16px; line-height: 1.4;
  }
  .q-cite-thesis {
    grid-column: 2;
    font-family: var(--serif); font-style: italic;
    font-size: 13.5px; color: var(--ink-3);
    margin-top: 4px;
  }
  .q-citing-empty p {
    font-family: var(--serif);
    font-size: 14.5px; color: var(--ink-3);
    font-style: italic;
    max-width: 640px;
  }

  .q-method {
    padding: 24px 26px;
    background: var(--paper-2, #f4f1ea);
    border: 1px solid var(--rule);
    border-radius: 9px;
    margin-top: 16px;
  }
  .q-method-k {
    font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--ink-3); font-weight: 600; margin-bottom: 10px;
  }
  .q-method p {
    font-family: var(--serif);
    font-size: 14.5px; line-height: 1.6;
    color: var(--ink-2);
    margin: 0 0 10px;
    max-width: 660px;
  }
  .q-method p:last-child { margin-bottom: 0; }
  .q-method b { color: var(--ink); }

  @media (max-width: 640px) {
    .q-h1 { font-size: 28px; }
    .q-quote { font-size: 18px; padding: 18px 20px; }
    .q-attr-row { grid-template-columns: 1fr; gap: 4px; }
    .q-attr-k { padding-top: 0; }
    .q-cite-row { grid-template-columns: 1fr; gap: 4px; }
  }
</style>
`;

  return renderPage({
    title: `Verbatim quote · From ${quote.piece_title ?? quote.source_node_label}`,
    description: quote.verbatim_text.slice(0, 200),
    body,
    activeNav: "/desk",
    zone: "library",
  });
}

function formatLongDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = months[Number(mo) - 1] ?? mo;
  return `${Number(d)} ${month} ${y}`;
}
