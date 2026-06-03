// Workbench — the node-as-working-surface. The design's flagship operator
// screen: pick an entity, see its claims, evidence rail, threads, and
// open questions. Real data: entities + claims + relations from D1.

import { all, one } from "../../lib/d1";
import { escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { commandBar, icon, opHeader, renderOpPage } from "../layout";

interface WBEntity {
  id: string;
  public_slug: string;
  canonical_name: string;
  kind: string;
  current_role: string | null;
  bio_md: string | null;
}
interface WBClaim {
  id: string;
  text: string;
  confidence: string | null;
  register: string | null;
  status: string;
}
interface WBOther {
  public_slug: string;
  canonical_name: string;
}

export async function renderWorkbench(env: { DB: D1Database }, slug?: string): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return renderEmpty();

  const allEntities = await all<WBOther>(
    env.DB,
    "SELECT public_slug, canonical_name FROM entities WHERE user_id = ? ORDER BY canonical_name LIMIT 60",
    [userId],
  );
  if (allEntities.length === 0) return renderEmpty();

  const targetSlug = slug ?? allEntities[0]?.public_slug ?? "";
  const entity = await one<WBEntity>(
    env.DB,
    `SELECT id, public_slug, canonical_name, kind, current_role, bio_md
       FROM entities WHERE user_id = ? AND public_slug = ?`,
    [userId, targetSlug],
  );
  if (!entity) return renderEmpty();

  const claims = await loadClaims(env.DB, entity.id);
  const others = allEntities.filter((e) => e.public_slug !== entity.public_slug).slice(0, 12);

  const confirmedN = claims.filter((c) => c.status === "confirmed").length;
  const draftN = claims.filter((c) => c.status !== "confirmed").length;

  const threadsBlock = others.length
    ? `<div class="row wrap" style="gap:7px">${others
        .map(
          (o) =>
            `<a class="thread" href="/op/workbench/${escapeHtml(o.public_slug)}" style="text-decoration:none">${escapeHtml(o.canonical_name)}</a>`,
        )
        .join("")}</div>`
    : `<div class="coord faint">No other entities yet.</div>`;

  const claimsBlock = claims.length
    ? `<div class="col" style="gap:10px">${claims.map(renderClaimCard).join("")}</div>`
    : `<div class="card soft" style="padding:22px;text-align:center;color:var(--ink-mute)">No claims attached to this entity yet. Drop a document in <a href="/op/ingest" style="color:var(--accent)">Ingest</a> or draft one through <a href="/op/chat" style="color:var(--accent)">Chat</a>.</div>`;

  const switcher = allEntities
    .map(
      (e) =>
        `<option value="${escapeHtml(e.public_slug)}"${e.public_slug === entity.public_slug ? " selected" : ""}>${escapeHtml(e.canonical_name)}</option>`,
    )
    .join("");

  const body = `
${opHeader("Workbench", `${entity.kind} · ${entity.public_slug}`, switcherForm(switcher))}
<div class="op-content">
  <div class="row between" style="margin-bottom:18px;flex-wrap:wrap;gap:12px">
    <div>
      <h2 style="font-family:var(--serif);font-size:26px;letter-spacing:-0.02em;margin:0 0 4px;color:var(--ink)">${escapeHtml(entity.canonical_name)}</h2>
      ${entity.current_role ? `<div class="coord" style="font-size:13px">${escapeHtml(entity.current_role)}</div>` : ""}
    </div>
    <div class="row" style="gap:8px">
      <a class="btn sm" href="/${entity.kind === "person" ? "entities" : "entities"}/${escapeHtml(entity.public_slug)}" target="_blank" style="text-decoration:none">${icon("doc", 13)} Preview public</a>
    </div>
  </div>

  ${commandBar(`Command this node — "Research the trust structure", "Find what contradicts this"…`)}

  <div style="display:grid;grid-template-columns:1.55fr 1fr;gap:28px;margin-top:22px" class="op-grid">
    <div>
      ${sectionHead("Claims on this node", `<span class="coord">${confirmedN} confirmed · ${draftN} draft</span>`)}
      ${claimsBlock}
    </div>
    <aside style="display:flex;flex-direction:column;gap:26px">
      ${entity.bio_md ? `<div>${sectionHead("Bio", "")}<div class="prose" style="font-size:13.5px;line-height:1.6">${escapeHtml(entity.bio_md.slice(0, 800))}${entity.bio_md.length > 800 ? "…" : ""}</div></div>` : ""}
      <div>
        ${sectionHead("Threads", "")}
        ${threadsBlock}
      </div>
    </aside>
  </div>
</div>`;
  return renderOpPage({
    title: `Workbench · ${entity.canonical_name}`,
    body,
    activeNav: "/op/workbench",
    fullBleed: true,
  });
}

function switcherForm(options: string): string {
  return `<form method="GET" action="" onchange="this.submit()" style="display:flex;gap:6px;align-items:center">
  <label class="coord" style="font-size:11px">switch:</label>
  <select name="slug" style="background:var(--surface);border:1px solid var(--rule);border-radius:var(--r-sm);padding:5px 8px;color:var(--ink);font-size:12.5px">${options}</select>
</form>`;
}

function sectionHead(label: string, action: string): string {
  return `<div class="row between" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:16px;gap:16px">
  <div class="label">${escapeHtml(label)}</div>
  ${action}
</div>`;
}

function renderClaimCard(c: WBClaim): string {
  const conf = c.confidence ?? "medium";
  const register = c.register ?? "fact";
  const isAnalysis = register === "analysis";
  const status = c.status ?? "draft";
  return `<div class="claimcard ${status === "confirmed" ? "confirmed" : "draft"}${conf === "low" ? " lowconf" : ""}">
  <span class="cc-register ${isAnalysis ? "analysis" : "fact"}"></span>
  <div class="cc-top">
    <span class="row" style="gap:8px">
      <span class="coord">${escapeHtml(c.id.slice(0, 8))}</span>
      <span class="chip${isAnalysis ? " accent" : ""}">${isAnalysis ? "analysis · signed" : "fact"}</span>
    </span>
    <span class="row" style="gap:8px">
      <span class="chip ${status === "confirmed" ? "confirmed" : "draft"}">${escapeHtml(status)}</span>
    </span>
  </div>
  <div class="cc-body">${escapeHtml(c.text)}</div>
</div>`;
}

async function loadClaims(db: D1Database, entityId: string): Promise<WBClaim[]> {
  const rows = await all<{
    id: string;
    claim_text: string | null;
    admiralty_grade: string | null;
    verification_status: string | null;
    layer: string | null;
  }>(
    db,
    `SELECT c.id, cv.claim_text, c.admiralty_grade, c.verification_status, c.layer
       FROM claims c
       JOIN claim_entities ce ON ce.claim_id = c.id
       LEFT JOIN claim_versions cv ON cv.id = c.current_version_id
      WHERE ce.entity_id = ?
      ORDER BY c.created_at DESC
      LIMIT 30`,
    [entityId],
  );
  return rows.map((r) => ({
    id: r.id,
    text: r.claim_text ?? "(no claim text)",
    confidence:
      r.admiralty_grade === "A" || r.admiralty_grade === "B"
        ? "high"
        : r.admiralty_grade === "C"
          ? "medium"
          : r.admiralty_grade
            ? "low"
            : "medium",
    register: r.layer === "factual" ? "fact" : r.layer ? "analysis" : null,
    status: r.verification_status === "grounded" ? "confirmed" : (r.verification_status ?? "draft"),
  }));
}

function renderEmpty(): string {
  const body = `
${opHeader("Workbench", "node as working surface")}
<div class="op-content">
  <div class="card soft" style="padding:40px 36px;max-width:680px;margin:24px auto 0;text-align:center">
    <div style="margin-bottom:14px;display:inline-flex;width:48px;height:48px;align-items:center;justify-content:center;background:var(--paper-2);border-radius:50%;color:var(--accent)">${icon("layers", 22)}</div>
    <h3 style="font-size:18px;margin:0 0 8px;color:var(--ink);font-family:var(--serif);font-weight:600">No entities yet</h3>
    <p style="font-family:var(--serif);font-size:15px;line-height:1.6;color:var(--ink-2);margin:0 0 22px;max-width:480px;margin-left:auto;margin-right:auto">
      The Workbench opens any entity's working surface — its claims, sources, relations, and open leads.
      Entities accumulate as pieces are ingested and the assistant resolves people, organizations, and concepts inside them.
    </p>
    <div class="row" style="gap:10px;justify-content:center;flex-wrap:wrap">
      <a class="btn accent" href="/op/ingest" style="text-decoration:none">${icon("arrowUR", 14)} Ingest documents</a>
      <a class="btn" href="/op/build" style="text-decoration:none">${icon("plus", 14)} Build a node</a>
    </div>
  </div>
</div>`;
  return renderOpPage({
    title: "Workbench",
    body,
    activeNav: "/op/workbench",
    fullBleed: true,
  });
}
