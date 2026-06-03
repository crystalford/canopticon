// Timeline — the chronology cast across the corpus. Each event ties to
// pieces and/or entities; "major" significance highlights the structural
// dates the operator wants the eye to find first.

import { renderMarkdown } from "../../cms/lib/render-post";
import { type PublicEnv, listTimelineEvents, parseJson, resolveOperatorId } from "../data";
import { escapeHtml, renderPage } from "../layout";
import { emptyState, sectionHeader } from "./components";

export async function renderTimelineIndex(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const events = userId ? await listTimelineEvents(env.DB, userId) : [];

  const items = events.length
    ? `<ol style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:18px">${events
        .map((e) => {
          const pieceIds = parseJson<string[]>(e.related_piece_ids, []);
          const entityIds = parseJson<string[]>(e.related_entity_ids, []);
          const refs: string[] = [];
          if (pieceIds.length)
            refs.push(`${pieceIds.length} piece${pieceIds.length > 1 ? "s" : ""}`);
          if (entityIds.length)
            refs.push(`${entityIds.length} entit${entityIds.length > 1 ? "ies" : "y"}`);
          const refLine = refs.join(" · ");
          return `<li class="card" style="padding:18px 22px">
  <div class="row between" style="margin-bottom:6px;gap:12px">
    <div class="coord" style="font-size:13px">${escapeHtml(e.event_date.slice(0, 10))}</div>
    ${e.significance === "major" ? `<span class="chip">major</span>` : ""}
  </div>
  <h3 style="font-family:var(--serif);font-size:19px;line-height:1.3;margin:0 0 6px;color:var(--ink)">${escapeHtml(e.title)}</h3>
  ${e.body_md ? `<div class="prose" style="font-size:14.5px">${renderMarkdown(e.body_md)}</div>` : ""}
  ${refLine ? `<p class="coord" style="margin-top:8px;font-size:12px">${escapeHtml(refLine)}</p>` : ""}
</li>`;
        })
        .join("")}</ol>`
    : emptyState(
        "The timeline is empty. Operator-curated events tie pieces and entities to dates as the corpus grows.",
      );

  const body = `
<section style="margin-bottom:24px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> The lighthouse · across time</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 12px;color:var(--ink)">Timeline</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--ink-2);max-width:680px">
    Cross-document chronology. The structural dates — appointments, statements,
    reversals — placed alongside the pieces and entities they touch.
  </p>
</section>
<section>${sectionHeader(`Events (${events.length})`)}${items}</section>
`;
  return renderPage({
    title: "Timeline",
    description: "Cross-document chronology of Canadian power.",
    body,
    activeNav: "/patterns",
    zone: "patterns",
  });
}
