// Leads — the triage queue. Pulls from character_update_proposals (entity
// updates suggested by the heat-score worker) and orchestrator_events
// flagged 'lead' or 'near_duplicate' as project-scale opportunities.

import { all } from "../../lib/d1";
import { escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { icon, opHeader, renderOpPage } from "../layout";

interface ProposalLead {
  id: string;
  entity_name: string;
  entity_slug: string;
  kind: string;
  rationale: string | null;
  created_at: string;
}

interface EventLead {
  id: string;
  event_type: string;
  payload: string | null;
  subject_kind: string | null;
  subject_id: string | null;
  created_at: string;
}

export async function renderLeads(env: { DB: D1Database }): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return renderEmpty();

  const [proposals, events] = await Promise.all([
    all<ProposalLead>(
      env.DB,
      `SELECT p.id, e.canonical_name AS entity_name, e.public_slug AS entity_slug,
              p.kind, p.rationale, p.created_at
         FROM character_update_proposals p
         JOIN entities e ON e.id = p.entity_id
        WHERE p.status = 'pending'
        ORDER BY p.created_at DESC
        LIMIT 20`,
    ),
    all<EventLead>(
      env.DB,
      `SELECT id, event_type, payload, subject_kind, subject_id, created_at
         FROM orchestrator_events
        WHERE user_id = ? AND event_type IN ('lead','near_duplicate','new_pass','duplicate')
        ORDER BY created_at DESC
        LIMIT 20`,
      [userId],
    ),
  ]);

  const proposalsBlock = proposals.length
    ? `<div class="col" style="gap:10px">${proposals
        .map(
          (p) => `<div class="lead-card">
  <div class="row between" style="margin-bottom:8px;gap:10px;flex-wrap:wrap">
    <span class="row" style="gap:8px"><span class="label">Entity update · ${escapeHtml(p.kind.replace(/_/g, " "))}</span></span>
    <span class="coord">${escapeHtml(p.id.slice(0, 8))}</span>
  </div>
  <div style="font-family:var(--serif);font-size:16px;line-height:1.45;margin-bottom:6px"><a href="/op/workbench/${escapeHtml(p.entity_slug)}" style="color:var(--ink);text-decoration:none">${escapeHtml(p.entity_name)}</a></div>
  ${p.rationale ? `<div style="font-size:13.5px;color:var(--ink-2);line-height:1.5;margin-bottom:12px">${escapeHtml(p.rationale)}</div>` : ""}
  <div class="row" style="gap:8px">
    <a class="btn sm on" href="/op/workbench/${escapeHtml(p.entity_slug)}" style="text-decoration:none">Chase</a>
  </div>
</div>`,
        )
        .join("")}</div>`
    : `<div class="card soft" style="padding:18px 22px;color:var(--ink-mute);font-size:13.5px">No pending entity updates. The heat-score worker surfaces leads as evidence accumulates.</div>`;

  const eventsBlock = events.length
    ? `<div class="col" style="gap:10px">${events
        .map((e) => {
          const payload = parsePayloadSummary(e.payload);
          return `<div class="lead-card${e.event_type === "near_duplicate" || e.event_type === "duplicate" ? " project" : ""}" style="border-left:2px solid ${e.event_type === "near_duplicate" || e.event_type === "duplicate" ? "var(--correction)" : e.event_type === "new_pass" ? "var(--accent)" : "var(--ink-faint)"}">
  <div class="row between" style="margin-bottom:6px;gap:10px;flex-wrap:wrap">
    <span class="row" style="gap:8px"><span class="chip">${escapeHtml(e.event_type.replace(/_/g, " "))}</span>${e.subject_kind ? `<span class="coord">${escapeHtml(e.subject_kind)}</span>` : ""}</span>
    <span class="coord">${escapeHtml(formatRelative(e.created_at))}</span>
  </div>
  <div style="font-size:13.5px;color:var(--ink-2);line-height:1.5">${escapeHtml(payload)}</div>
</div>`;
        })
        .join("")}</div>`
    : `<div class="card soft" style="padding:18px 22px;color:var(--ink-mute);font-size:13.5px">No recent orchestrator events. Near-duplicate detection runs at ingest — drop new documents in <a href="/op/ingest" style="color:var(--accent)">Ingest</a> to surface leads.</div>`;

  const body = `
${opHeader("Leads", "patterning · the quiet engine")}
<div class="op-content">
  <p class="muted" style="max-width:680px;margin-bottom:28px;font-family:var(--serif);font-size:16px;line-height:1.55">
    Patterning watches the whole graph and hands over hunches to chase — small leads and project-scale opportunities. It surfaces; it never authors.
  </p>

  ${sectionHead("Entity update proposals", `<span class="coord">${proposals.length} pending</span>`)}
  <div style="margin-bottom:36px">${proposalsBlock}</div>

  ${sectionHead("Orchestrator events", `<span class="coord">${events.length} recent</span>`)}
  ${eventsBlock}
</div>`;

  return renderOpPage({ title: "Leads", body, activeNav: "/op/leads", fullBleed: true });
}

function sectionHead(label: string, action: string): string {
  return `<div class="row between" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:16px;gap:16px">
  <div class="label">${escapeHtml(label)}</div>
  ${action}
</div>`;
}

function parsePayloadSummary(raw: string | null): string {
  if (!raw) return "(no payload)";
  try {
    const obj = JSON.parse(raw);
    if (typeof obj === "string") return obj;
    if (obj.message) return String(obj.message);
    if (obj.summary) return String(obj.summary);
    if (obj.detail) return String(obj.detail);
    return JSON.stringify(obj).slice(0, 220);
  } catch {
    return raw.slice(0, 220);
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const delta = Date.now() - t;
  const min = Math.round(delta / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d`;
  return iso.slice(0, 10);
}

function renderEmpty(): string {
  return renderOpPage({
    title: "Leads",
    body: `${opHeader("Leads", "patterning · the quiet engine")}<div class="op-content"><div class="card soft" style="padding:30px;text-align:center;color:var(--ink-mute)">${icon("spark", 28, "var(--accent)")}<div style="margin-top:12px;font-size:14.5px">No leads yet. As entities accumulate evidence, the worker surfaces them here.</div></div></div>`,
    activeNav: "/op/leads",
    fullBleed: true,
  });
}
