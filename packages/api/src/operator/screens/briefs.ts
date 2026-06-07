import { all } from "../../lib/d1";
import { escapeAttr, escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { emptyState, icon, renderOpPage } from "../layout";

interface BriefRow {
  id: string;
  slug: string;
  title: string;
  content_type: string;
  status: string;
  why_proposed_md: string;
  body_md: string;
  claims_verified: number;
  claims_killed: number;
  updated_at: string;
}

interface BriefClaimRow {
  id: string;
  claim_text: string;
  source_url: string;
  source_quote: string;
  verified: number;
  killed: number;
  kill_reason: string | null;
  judge_pass: number;
  judge_notes: string | null;
  sort_order: number;
}

const TYPE_META: Record<string, { cls: string; label: string; cite: string }> = {
  definition: { cls: "b-pattern", label: "Definition", cite: "46% cite rate" },
  comparison: { cls: "b-thesis", label: "Comparison", cite: "61% cite rate" },
  timeline: { cls: "b-connection", label: "Timeline", cite: "33% cite rate" },
  faq: { cls: "b-contradiction", label: "FAQ", cite: "58% cite rate" },
  "stat-roundup": { cls: "b-pattern", label: "Stat roundup", cite: "52% cite rate" },
};

async function loadBriefs(db: D1Database, userId: string): Promise<BriefRow[]> {
  return all<BriefRow>(
    db,
    `SELECT id, slug, title, content_type, status, why_proposed_md, body_md,
            claims_verified, claims_killed, updated_at
       FROM briefs
      WHERE user_id = ?
      ORDER BY
        CASE status
          WHEN 'building' THEN 0
          WHEN 'draft'    THEN 1
          WHEN 'proposal' THEN 2
          WHEN 'published' THEN 3
          ELSE 4 END,
        updated_at DESC
      LIMIT 60`,
    [userId],
  );
}

async function loadClaims(db: D1Database, briefId: string): Promise<BriefClaimRow[]> {
  return all<BriefClaimRow>(
    db,
    `SELECT id, claim_text, source_url, source_quote, verified, killed,
            kill_reason, judge_pass, judge_notes, sort_order
       FROM brief_claims
      WHERE brief_id = ?
      ORDER BY sort_order ASC`,
    [briefId],
  );
}

function proposalCard(b: BriefRow): string {
  const meta = TYPE_META[b.content_type] ?? TYPE_META.definition;
  if (!meta) return "";
  return `<div class="brief-proposal">
  <div class="bp-head">
    <span class="bp-type-badge ${meta.cls}">${escapeHtml(meta.label)}</span>
    <div class="bp-title">${escapeHtml(b.title)}</div>
    <span class="bp-cite">${escapeHtml(meta.cite)}</span>
  </div>
  <p class="bp-why">${escapeHtml(b.why_proposed_md)}</p>
  <div class="bp-actions">
    <form method="POST" action="/op/briefs/${escapeAttr(b.id)}/build" style="display:inline">
      <button type="submit" class="btn btn-amber">Build →</button>
    </form>
  </div>
</div>`;
}

function draftCard(b: BriefRow, claims: BriefClaimRow[]): string {
  const meta = TYPE_META[b.content_type] ?? TYPE_META.definition;
  if (!meta) return "";
  const verified = claims.filter((c) => c.verified === 1 && c.killed === 0);
  const killed = claims.filter((c) => c.killed === 1);
  const claimsHtml = claims.map(claimRow).join("");
  return `<div class="brief-proposal review">
  <div class="bp-head">
    <span class="bp-type-badge ${meta.cls}">${escapeHtml(meta.label)}</span>
    <div class="bp-title">${escapeHtml(b.title)}</div>
  </div>
  <div class="bp-draft">
    <div class="bp-draft-bar">
      ${icon("check")}
      <span>Verification complete</span>
      <span class="bdb-counts">${verified.length} verified${killed.length > 0 ? ` · <span class="bdb-killed">${killed.length} killed</span>` : ""}</span>
    </div>
    <div class="bp-draft-title">${escapeHtml(b.title)}</div>
    <div class="bp-claims">${claimsHtml}</div>
    <div class="bp-draft-actions">
      <form method="POST" action="/op/briefs/${escapeAttr(b.id)}/publish" style="display:inline">
        <button type="submit" class="btn btn-amber solid">Publish Brief</button>
      </form>
      <form method="POST" action="/op/briefs/${escapeAttr(b.id)}/discard" style="display:inline">
        <button type="submit" class="btn">Discard</button>
      </form>
      <span class="mono" style="font-size:10.5px;color:var(--faint);margin-left:auto">server-rendered · citable · no JS required</span>
    </div>
  </div>
</div>`;
}

function buildingCard(b: BriefRow): string {
  const meta = TYPE_META[b.content_type] ?? TYPE_META.definition;
  if (!meta) return "";
  const steps = [
    { label: "Retrieve source material", sub: "fetch real pages, hash content to R2" },
    { label: "Draft Brief", sub: "apply content-type template + citation levers" },
    {
      label: "Verbatim substring verification",
      sub: "every claim must be a literal substring of a fetched source",
    },
    { label: "Independent judgment", sub: "a different model checks quote ↔ claim support" },
  ];
  return `<div class="brief-proposal building">
  <div class="bp-head">
    <span class="bp-type-badge ${meta.cls}">${escapeHtml(meta.label)}</span>
    <div class="bp-title">${escapeHtml(b.title)}</div>
  </div>
  <div class="bp-pipeline">
    ${steps
      .map(
        (s) => `<div class="bp-step run">
  <span class="bps-icon"><span class="bps-ring"></span></span>
  <div class="bps-body">
    <div class="bps-label">${escapeHtml(s.label)}</div>
    <div class="bps-sub">${escapeHtml(s.sub)}</div>
  </div>
</div>`,
      )
      .join("")}
  </div>
</div>`;
}

function claimRow(c: BriefClaimRow): string {
  const killed = c.killed === 1;
  return `<div class="bp-claim${killed ? " killed" : ""}">
  <span class="bpc-dot">${killed ? "✕" : "✓"}</span>
  <div class="bpc-body">
    <div class="bpc-text">${escapeHtml(c.claim_text)}</div>
    ${killed ? `<div class="bpc-kill">${escapeHtml(c.kill_reason ?? "verbatim match not found in fetched source — claim dropped")}</div>` : `<div class="bpc-src">${escapeHtml(c.source_url)}${c.judge_pass === 1 ? " · independent judge approved" : c.judge_notes ? ` · judge: ${escapeHtml(c.judge_notes.slice(0, 80))}` : ""}</div>`}
  </div>
</div>`;
}

function publishedRow(b: BriefRow): string {
  const meta = TYPE_META[b.content_type] ?? TYPE_META.definition;
  if (!meta) return "";
  return `<div class="briefs-arc-row">
  <span class="bar-dot" style="background:var(--c-thesis)"></span>
  <span class="bar-title">${escapeHtml(b.title)}</span>
  <span class="bar-type">${escapeHtml(meta.label)}</span>
  <span class="bar-when">just now</span>
  <a class="mono" href="/briefs/${escapeAttr(b.slug)}" target="_blank" style="color:var(--c-pattern);font-size:11px;text-decoration:none">View →</a>
</div>`;
}

export async function renderBriefsScreen(
  env: { DB: D1Database },
  args: { composed?: string | undefined } = {},
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const briefs = userId ? await loadBriefs(env.DB, userId) : [];

  const proposals = briefs.filter((b) => b.status === "proposal");
  const drafts = briefs.filter((b) => b.status === "draft");
  const building = briefs.filter((b) => b.status === "building");
  const published = briefs.filter((b) => b.status === "published");

  // Load claims only for drafts (avoid the round-trip on every proposal).
  const draftClaims = new Map<string, BriefClaimRow[]>();
  if (userId) {
    for (const d of drafts) {
      draftClaims.set(d.id, await loadClaims(env.DB, d.id));
    }
  }

  // "Compose Brief" is the primary entry point (manual authoring is the
  // product per the architecture pivot). Re-propose is secondary — auto
  // proposals are suggestions, not the main flow.
  const topbarActions = `<a href="/op/briefs/compose" class="btn btn-amber">${icon("spark")} Compose Brief</a>
  <form method="POST" action="/op/briefs/propose" style="display:inline">
    <button class="btn" type="submit" title="Re-scan the graph for auto-proposal suggestions">Re-propose</button>
  </form>`;

  const queueHtml = building
    .map(buildingCard)
    .concat(drafts.map((d) => draftCard(d, draftClaims.get(d.id) ?? [])))
    .concat(proposals.map(proposalCard))
    .join("");

  const queue =
    queueHtml.length > 0
      ? `<div class="briefs-queue">${queueHtml}</div>`
      : `<div class="briefs-empty">
  No proposals yet. As entities accumulate references across claims, or as Synthesis surfaces concept clusters,
  the proposer will suggest Briefs to build here. Hit Re-propose to scan the corpus now.
</div>`;

  const publishedArc = published.length
    ? `<div class="briefs-arc">${published.map(publishedRow).join("")}</div>`
    : emptyState({
        iconName: "briefs",
        title: "No Briefs published yet.",
        body: "Publishing a verified draft renders it as a citable page at /briefs/:slug (server-rendered, no JS).",
      });

  const composedBanner = args.composed
    ? `<div class="okflag" style="margin-bottom:14px">
  <span class="ftext"><b>Brief composed.</b> Citations are being verified now — the draft will appear below in a few seconds.</span>
</div>`
    : "";

  const body = `
${composedBanner}
<div class="briefs-sh">
  <div class="bsh-title">Proposal queue</div>
  <div class="bsh-count">${proposals.length + building.length + drafts.length}</div>
  <div class="bsh-sub">graph coverage gaps · build is always your click · nothing auto-publishes</div>
</div>

${queue}

<div style="margin-top:30px">
  <div class="briefs-sh">
    <div class="bsh-title">Published archive</div>
    <div class="bsh-count">${published.length}</div>
    <div class="bsh-sub">server-rendered citable pages · no JS required</div>
  </div>
  ${publishedArc}
</div>
`;

  return renderOpPage({
    title: "Briefs",
    sub: "citable answer-objects · proposal-only · verbatim-verified",
    topbarActions,
    body,
    activeNav: "/op/briefs",
  });
}
