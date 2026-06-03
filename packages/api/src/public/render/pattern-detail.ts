// Pattern detail page. Surfaces a signed pattern with: the statement,
// constituent documents (the lighthouse beams), the disconfirming
// evidence (transparency), and the operator's notes.

import { renderMarkdown } from "../../cms/lib/render-post";
import { collapseByChain, recurringActorLabel } from "../../graph/lib/lighthouse";
import { type PublicEnv, getPatternBySlug, piecesForPattern, resolveOperatorId } from "../data";
import { escapeHtml, renderPage } from "../layout";
import { emptyState, formatDate, pieceCard, sectionHeader } from "./components";

export async function renderPatternDetail(env: PublicEnv, slug: string): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;
  const pattern = await getPatternBySlug(env.DB, userId, slug);
  if (!pattern) return null;

  const pieces = await piecesForPattern(env.DB, userId, pattern.id);
  const counts = collapseByChain(pieces.map((p) => ({ id: p.id })));
  const countLabel = recurringActorLabel(counts, {
    from: pattern.date_range_from,
    to: pattern.date_range_to,
  });

  const statementHtml = renderMarkdown(pattern.statement_md);
  const disconfirmingHtml = pattern.disconfirming_md
    ? renderMarkdown(pattern.disconfirming_md)
    : "";
  const notesHtml = pattern.notes_md ? renderMarkdown(pattern.notes_md) : "";

  const piecesSection = pieces.length
    ? `<section style="margin-bottom:36px">
        ${sectionHeader(`Constituent documents (${pieces.length})`)}
        <p class="coord" style="margin-bottom:14px">${escapeHtml(countLabel)}</p>
        <div class="cards-row">${pieces.map((p) => pieceCard(p)).join("")}</div>
      </section>`
    : `<section style="margin-bottom:36px">${sectionHeader("Constituent documents")}${emptyState("No constituent documents linked yet.")}</section>`;

  const body = `
<article style="max-width:var(--reading-width);margin:0 auto">
  <p class="kicker" style="margin-bottom:14px">Signed pattern · ${escapeHtml(pattern.confidence)} confidence${pattern.signed_at ? ` · ${escapeHtml(formatDate(pattern.signed_at))}` : ""}</p>
  <h1 style="font-family:var(--serif);font-size:42px;line-height:1.1;letter-spacing:-0.018em;margin:0 0 18px;color:var(--ink)">${escapeHtml(pattern.title)}</h1>
  <div class="prose" style="margin-bottom:32px">${statementHtml}</div>
</article>
${piecesSection}
${disconfirmingHtml ? `<section style="margin-bottom:36px;max-width:var(--reading-width);margin-left:auto;margin-right:auto">${sectionHeader("Disconfirming evidence")}<div class="prose">${disconfirmingHtml}</div></section>` : ""}
${notesHtml ? `<section style="margin-bottom:36px;max-width:var(--reading-width);margin-left:auto;margin-right:auto">${sectionHeader("Operator notes")}<div class="prose">${notesHtml}</div></section>` : ""}
`;
  return renderPage({
    title: pattern.title,
    description: `${pattern.title} — a signed pattern.`,
    body,
    activeNav: "/patterns",
    zone: "patterns",
  });
}
