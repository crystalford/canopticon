// Console — the operator's home screen. Recent activity + quick links.
// Phase 3 ships a working overview reading from D1; the leads queue and
// the richer console land in Phase 4 (lighthouse).

import { all } from "../../lib/d1";
import { escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { opHeader, renderOpPage } from "../layout";

export async function renderConsole(env: { DB: D1Database }): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const counts = userId ? await loadCounts(env.DB, userId) : zeroCounts();

  const stat = (label: string, value: number, href: string) =>
    `<a class="cardlink" href="${href}" style="text-align:center;padding:20px">
  <div style="font-family:var(--mono);font-size:30px;color:var(--ink);font-variant-numeric:tabular-nums">${value}</div>
  <div class="label" style="margin-top:6px">${escapeHtml(label)}</div>
</a>`;

  const body = `
${opHeader("Console", "the standing record · operator")}
<div class="op-content">
  <div class="cards-3" style="margin-bottom:32px">
    ${stat("Pieces", counts.pieces, "/op/editorial")}
    ${stat("Entities", counts.entities, "/op/workbench")}
    ${stat("Pending proposals", counts.proposals, "/op/leads")}
  </div>
  <div class="card soft" style="padding:22px;max-width:640px">
    <div class="label" style="margin-bottom:10px">Start here</div>
    <p style="font-family:var(--serif);font-size:15.5px;line-height:1.55;color:var(--ink-2);margin:0 0 14px">
      Open the chat to draft a piece, ingest a document, or ask the record a question.
      The agent has the full tool set — ingestion, the graph, publishing, studio.
    </p>
    <a href="/op/chat" class="btn accent">Open chat →</a>
  </div>
</div>`;
  return renderOpPage({ title: "Console", body, activeNav: "/op", fullBleed: true });
}

interface Counts {
  pieces: number;
  entities: number;
  proposals: number;
}

async function loadCounts(db: D1Database, userId: string): Promise<Counts> {
  const rows = await all<{ k: string; n: number }>(
    db,
    `SELECT 'pieces' AS k, COUNT(*) AS n FROM pieces WHERE user_id = ?
     UNION ALL SELECT 'entities', COUNT(*) FROM entities WHERE user_id = ?
     UNION ALL SELECT 'proposals', COUNT(*) FROM character_update_proposals WHERE status = 'pending'`,
    [userId, userId],
  );
  const map = new Map(rows.map((r) => [r.k, r.n]));
  return {
    pieces: map.get("pieces") ?? 0,
    entities: map.get("entities") ?? 0,
    proposals: map.get("proposals") ?? 0,
  };
}

function zeroCounts(): Counts {
  return { pieces: 0, entities: 0, proposals: 0 };
}
