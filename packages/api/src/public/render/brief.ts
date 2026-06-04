// Public Brief page — server-rendered citable page at /briefs/:slug.
//
// Per the spec: server-rendered, no JS required to read, schema.org
// JSON-LD per content type, dated update log, bolded inline sources,
// 120–180 word section blocks (the renderer doesn't enforce paragraph
// length; the model targets it during generation).

import { renderMarkdown } from "../../cms/lib/render-post";
import { all, one } from "../../lib/d1";
import { resolveOperatorId } from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";

interface BriefRow {
  id: string;
  slug: string;
  title: string;
  content_type: string;
  body_md: string;
  body_html: string;
  claims_verified: number;
  claims_killed: number;
  judge_model: string | null;
  published_at: string | null;
  updated_at: string;
}

interface ClaimRow {
  claim_text: string;
  source_url: string;
  source_quote: string;
}

const SCHEMA_TYPE: Record<string, string> = {
  definition: "DefinedTerm",
  comparison: "Article",
  timeline: "Article",
  faq: "FAQPage",
  "stat-roundup": "Dataset",
};

export async function renderBriefPage(
  env: { DB: D1Database },
  slug: string,
): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;
  const brief = await one<BriefRow>(
    env.DB,
    `SELECT id, slug, title, content_type, body_md, body_html, claims_verified,
            claims_killed, judge_model, published_at, updated_at
       FROM briefs WHERE user_id = ? AND slug = ? AND status = 'published'`,
    [userId, slug],
  );
  if (!brief) return null;

  const claims = await all<ClaimRow>(
    env.DB,
    `SELECT claim_text, source_url, source_quote FROM brief_claims
      WHERE brief_id = ? AND verified = 1 AND killed = 0 AND judge_pass = 1
      ORDER BY sort_order ASC`,
    [brief.id],
  );

  const bodyHtml = brief.body_html || renderMarkdown(brief.body_md);
  const updatedLine = brief.updated_at
    ? `<div class="coord" style="margin-top:14px">Updated ${escapeHtml(brief.updated_at.slice(0, 10))}</div>`
    : "";

  const sourcesBlock = claims.length
    ? `<section class="srclog" style="margin-top:40px">
  <h2 style="font-family:var(--sans);font-size:13px;letter-spacing:-.01em;border-bottom:1px solid var(--rule);padding-bottom:10px;margin-bottom:16px">Sources — ${claims.length}</h2>
  ${claims
    .map(
      (c, i) => `<div class="srclog-row">
  <div class="srclog-main">
    <span class="srclog-title">${escapeHtml(c.claim_text)}</span>
    <span class="srclog-meta">"${escapeHtml(c.source_quote.slice(0, 200))}${c.source_quote.length > 200 ? "…" : ""}" — <a href="${escapeAttr(c.source_url)}" rel="external nofollow noopener" target="_blank">${escapeHtml(displayDomain(c.source_url))}</a></span>
  </div>
  <span class="srclog-kind">${String(i + 1).padStart(2, "0")}</span>
</div>`,
    )
    .join("")}
</section>`
    : "";

  const verificationLine = `<div class="coord" style="margin-top:6px">Verified: ${brief.claims_verified} claims · ${brief.claims_killed} dropped on verbatim-check · independent judge: ${escapeHtml(brief.judge_model ?? "—")}</div>`;

  const ld = jsonLd(brief, claims);

  const body = `
<article class="container reading" style="max-width:760px">
  <div class="kicker" style="margin-bottom:14px">Brief · ${escapeHtml(contentTypeLabel(brief.content_type))}</div>
  <h1>${escapeHtml(brief.title)}</h1>
  ${updatedLine}
  ${verificationLine}
  <div class="prose" style="margin-top:28px">${bodyHtml}</div>
  ${sourcesBlock}
  <div class="piece-note" style="margin-top:36px">
    <span class="dr-h">How this Brief was built</span>
    <p>Every factual claim in this Brief survived a literal verbatim substring check against an actually-fetched external source. A different model than the one that drafted the Brief independently judged whether each quote supports its claim. The trust boundary is mechanical, not editorial.</p>
  </div>
</article>
<script type="application/ld+json">${ld}</script>
`;

  return renderPage({
    title: brief.title,
    description: `${brief.title} — a CANOPTICON Brief. ${brief.claims_verified} verified claims, every quote verbatim-checked against external sources.`,
    body,
    activeNav: "/briefs",
    zone: "briefs",
  });
}

function contentTypeLabel(t: string): string {
  return (
    {
      definition: "Definition",
      comparison: "Comparison",
      timeline: "Timeline",
      faq: "FAQ",
      "stat-roundup": "Stat roundup",
    }[t] ?? t
  );
}

function displayDomain(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function jsonLd(brief: BriefRow, claims: ClaimRow[]): string {
  const type = SCHEMA_TYPE[brief.content_type] ?? "Article";
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    name: brief.title,
    headline: brief.title,
    dateModified: brief.updated_at,
    datePublished: brief.published_at ?? brief.updated_at,
    author: { "@type": "Organization", name: "CANOPTICON" },
    citation: claims.map((c) => ({
      "@type": "CreativeWork",
      url: c.source_url,
    })),
  };
  // FAQ schema has a distinct mainEntity shape; for v1 we keep it simple.
  return JSON.stringify(base)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
