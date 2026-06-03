// Gaps — honest negative knowledge. What we have on a subject, what we
// lack, and the operator's next step. Spec §6.5: the corpus's open
// questions surfaced explicitly, not hidden under thin coverage.

import { renderMarkdown } from "../../cms/lib/render-post";
import { type PublicEnv, listGaps, resolveOperatorId } from "../data";
import { escapeHtml, renderPage } from "../layout";
import { emptyState, sectionHeader } from "./components";

export async function renderGapsIndex(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const gaps = userId ? await listGaps(env.DB, userId) : [];

  const list = gaps.length
    ? `<div style="display:flex;flex-direction:column;gap:18px">${gaps
        .map(
          (g) => `<article class="card" style="padding:22px">
  <div class="row between" style="margin-bottom:8px">
    <div class="label">${escapeHtml(subjectKindLabel(g.subject_kind))} · ${escapeHtml(g.status)}</div>
    ${g.signed_by ? `<div class="coord">signed · ${escapeHtml(g.signed_by)}</div>` : ""}
  </div>
  <h2 style="font-family:var(--serif);font-size:22px;line-height:1.25;margin:0 0 14px;color:var(--ink)">${escapeHtml(g.title)}</h2>
  ${g.what_we_have_md ? `<div style="margin-bottom:12px"><div class="label" style="margin-bottom:4px">What we have</div><div class="prose">${renderMarkdown(g.what_we_have_md)}</div></div>` : ""}
  ${g.what_we_lack_md ? `<div style="margin-bottom:12px"><div class="label" style="margin-bottom:4px">What we lack</div><div class="prose">${renderMarkdown(g.what_we_lack_md)}</div></div>` : ""}
  ${g.suggested_next_step_md ? `<div><div class="label" style="margin-bottom:4px">Next step</div><div class="prose">${renderMarkdown(g.suggested_next_step_md)}</div></div>` : ""}
</article>`,
        )
        .join("")}</div>`
    : emptyState(
        "No documented gaps yet. The operator surfaces gaps as the corpus grows — what we know, and where coverage is thin.",
      );

  const body = `
<section style="margin-bottom:24px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> The lighthouse · what's missing</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 12px;color:var(--ink)">Gaps</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--ink-2);max-width:680px">
    The corpus's open questions, surfaced explicitly. For each subject: what we have,
    what we lack, and the operator's next step. Better an honest gap than a thin claim.
  </p>
</section>
<section>${sectionHeader(`Open gaps (${gaps.length})`)}${list}</section>
`;
  return renderPage({
    title: "Gaps",
    description: "What the corpus doesn't yet cover — open questions on Canadian power.",
    body,
    activeNav: "/patterns",
    zone: "patterns",
  });
}

function subjectKindLabel(kind: string): string {
  switch (kind) {
    case "entity":
      return "Entity gap";
    case "topic":
      return "Topic gap";
    case "corpus":
      return "Corpus gap";
    default:
      return "Gap";
  }
}
