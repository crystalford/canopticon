// Standalone Proposal page — `/pr/:slug` (fabric redesign Phase 7).
//
// The third fabric layer, its own citable URL: Facts (neutral) -> Signed
// Analysis (interpretive) -> Proposal (prescriptive). Modeled directly on
// brief.ts's simpler standalone-piece pattern (global .container.reading/
// .prose/.srclog classes from styles.ts, no page-local <style> needed) —
// a Proposal is prose with a thesis, same shape as a signed reading, not
// a structured-attributes arrangement like Profile.

import { renderMarkdown } from "../../../cms/lib/render-post";
import { all, one } from "../../../lib/d1";
import { resolveOperatorId } from "../../data";
import { escapeAttr, escapeHtml, renderPage } from "../../layout";

interface ProposalRow {
  id: string;
  slug: string;
  subject_node_id: string;
  thesis: string | null;
  confidence: string | null;
  signed_by: string | null;
  body_md: string | null;
  body_html: string | null;
  claims_verified: number;
  claims_killed: number;
  judge_model: string | null;
  signed_at: string | null;
  updated_at: string;
}

interface ProposalClaimRow {
  claim_text: string;
  kind: string;
  asserted_by: string | null;
  quote_id: string | null;
}

export async function renderProposalPage(
  env: { DB: D1Database },
  slug: string,
): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;
  const proposal = await one<ProposalRow>(
    env.DB,
    `SELECT id, slug, subject_node_id, thesis, confidence, signed_by,
            body_md, body_html, claims_verified, claims_killed, judge_model,
            signed_at, updated_at
       FROM page_proposals WHERE user_id = ? AND slug = ? AND status = 'published'`,
    [userId, slug],
  );
  if (!proposal) return null;

  const subject = await one<{ label: string; page_slug: string | null }>(
    env.DB,
    `SELECT n.label, p.slug AS page_slug
       FROM nodes n LEFT JOIN pages p ON p.subject_node_id = n.id AND p.user_id = ?
      WHERE n.id = ?`,
    [userId, proposal.subject_node_id],
  );

  const claims = await all<ProposalClaimRow>(
    env.DB,
    `SELECT pc.claim_text, pc.kind, pc.asserted_by,
            COALESCE(pc.quote_id, spc.quote_id) AS quote_id
       FROM page_proposal_claims pc
       LEFT JOIN page_claims spc ON spc.id = pc.source_page_claim_id
      WHERE pc.proposal_id = ?
      ORDER BY pc.sort_order ASC`,
    [proposal.id],
  );

  const bodyHtml = proposal.body_html || (proposal.body_md ? renderMarkdown(proposal.body_md) : "");
  const title = proposal.thesis || "Proposal";
  const subjectLine = subject
    ? subject.page_slug
      ? `<div class="coord">On <a href="/s/${escapeAttr(subject.page_slug)}">${escapeHtml(subject.label)}</a></div>`
      : `<div class="coord">On ${escapeHtml(subject.label)}</div>`
    : "";
  const signatureLine = `<div class="coord" style="margin-top:8px;padding:8px 12px;border:1px solid var(--rule);border-radius:6px">PROPOSAL — a prescriptive piece on top of the facts and analysis, by ${escapeHtml(proposal.signed_by ?? "the operator")}.${proposal.confidence ? ` Confidence: <b>${escapeHtml(proposal.confidence)}</b>.` : ""} This argues what should happen, not what happened — the grounded facts and analysis it builds on are listed under Sources.</div>`;
  const verificationLine = `<div class="coord" style="margin-top:6px">Verified: ${proposal.claims_verified} claims · ${proposal.claims_killed} dropped on verbatim-check · independent judge: ${escapeHtml(proposal.judge_model ?? "—")}</div>`;

  const sourcesBlock = claims.length
    ? `<section class="srclog" style="margin-top:40px">
  <h2 style="font-family:var(--sans);font-size:13px;letter-spacing:-.01em;border-bottom:1px solid var(--rule);padding-bottom:10px;margin-bottom:16px">Sources — ${claims.length}</h2>
  ${claims
    .map(
      (c, i) => `<div class="srclog-row">
  <div class="srclog-main">
    <span class="srclog-title">${c.kind === "assertion" ? `<span class="chip" title="An attributed assertion — contested material, not neutral fact">asserted by ${escapeHtml(c.asserted_by ?? "unknown")}</span> ` : ""}${escapeHtml(c.claim_text)}</span>
    ${c.quote_id ? `<span class="srclog-meta"><a href="/q/${escapeAttr(c.quote_id)}">receipt ↗</a></span>` : ""}
  </div>
  <span class="srclog-kind">${String(i + 1).padStart(2, "0")}</span>
</div>`,
    )
    .join("")}
</section>`
    : "";

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    about: subject ? { "@type": "Thing", name: subject.label } : undefined,
    url: `https://canopticon.com/pr/${proposal.slug}`,
    datePublished: proposal.signed_at ?? undefined,
    dateModified: proposal.updated_at,
    author: proposal.signed_by ? { "@type": "Person", name: proposal.signed_by } : undefined,
    publisher: { "@id": "https://canopticon.com/#org" },
  }).replace(/<\/script/gi, "<\\/script");

  const body = `
<article class="container reading" style="max-width:760px">
  <div class="kicker" style="margin-bottom:14px">Proposal · Prescriptive</div>
  <h1>${escapeHtml(title)}</h1>
  ${subjectLine}
  ${verificationLine}
  ${signatureLine}
  <div class="prose" style="margin-top:28px">${bodyHtml}</div>
  ${sourcesBlock}
  <div class="piece-note" style="margin-top:36px">
    <span class="dr-h">How this Proposal was built</span>
    <p>A Proposal argues what should happen — should, ought, needs to — never what already happened or what something means (that's Signed Analysis). Every claim traces back to a verbatim quote or an already-verified Analysis claim; an independent model confirmed both the citations and that the thesis genuinely prescribes action rather than restating a description.</p>
  </div>
</article>
<script type="application/ld+json">${jsonLd}</script>
`;

  return renderPage({
    title,
    description: `${title} — a CANOPTICON Proposal${subject ? ` on ${subject.label}` : ""}.`,
    body,
    activeNav: "/investigations",
    zone: "investigations",
  });
}
