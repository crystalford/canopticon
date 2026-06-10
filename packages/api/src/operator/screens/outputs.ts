// Outputs surface — the operator's product layer per canonical spec v2.4.
//
// Per Part 9 / Part 11 #1 of the spec: the proposer's suggestion cards are the
// PRIMARY content here. NO hand-authoring composer (deleted in this PR). The
// operator's main interaction is read proposals → click Build → review the
// verified draft → Publish or Discard.
//
// What this surface SHOULD become (later PRs):
//   - PR C (LLM-driven proposer): the proposer is rewritten to read the typed
//     graph + inquiry threads and suggest specific, well-shaped outputs across
//     both layers (factual arrangements + interpretive intents).
//   - PR E + F: proposals span both layers; suggestion cards carry layer +
//     content_type badges.
//
// What this surface IS today (be honest about it on screen):
//   - Reads from the legacy `briefs` table (rename deferred to a later
//     vocabulary-cleanup PR; URL stability matters more on the public side).
//   - Proposer is still the SQL heuristic (PR C upgrades it).
//   - Typed-graph extraction isn't populating data yet (PR B does that).
//
// Renamed from `briefs.ts` in the canonical-spec v2.4 alignment PR. The
// `briefs` D1 table, the `graph/lib/briefs/` library path, and the public
// `/briefs/:slug` URL all stay for now — covered in a later cleanup PR.

import { all } from "../../lib/d1";
import { escapeAttr, escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { emptyState, icon, renderOpPage } from "../layout";

interface OutputRow {
  layer: string;
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

interface OutputClaimRow {
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
  // Factual arrangements (unsigned, neutral)
  definition: { cls: "b-pattern", label: "Definition", cite: "46% cite rate" },
  comparison: { cls: "b-thesis", label: "Comparison", cite: "61% cite rate" },
  timeline: { cls: "b-connection", label: "Timeline", cite: "33% cite rate" },
  faq: { cls: "b-contradiction", label: "FAQ", cite: "58% cite rate" },
  "stat-roundup": { cls: "b-pattern", label: "Stat roundup", cite: "52% cite rate" },
  "entity-profile": { cls: "b-pattern", label: "Entity profile", cite: "factual" },
  "claim-table": { cls: "b-contradiction", label: "Claim & source table", cite: "firewall" },
  // Interpretive intents (signed, confidence-tagged)
  investigation: { cls: "b-thesis", label: "Investigation", cite: "signed" },
  argument: { cls: "b-thesis", label: "Argument", cite: "signed" },
  assessment: { cls: "b-connection", label: "Assessment", cite: "signed" },
};

function layerBadge(o: OutputRow): string {
  return o.layer === "interpretive"
    ? `<span class="mono" style="font-size:9.5px;letter-spacing:.08em;color:var(--amber-hi);border:1px solid var(--amber);border-radius:4px;padding:1px 6px;margin-left:8px">INTERPRETIVE · SIGNED</span>`
    : "";
}

async function loadOutputs(db: D1Database, userId: string): Promise<OutputRow[]> {
  // Still reads the `briefs` table — rename deferred to a later cleanup PR.
  return all<OutputRow>(
    db,
    `SELECT id, slug, title, content_type, status, layer, why_proposed_md, body_md,
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

async function loadClaims(db: D1Database, outputId: string): Promise<OutputClaimRow[]> {
  return all<OutputClaimRow>(
    db,
    `SELECT id, claim_text, source_url, source_quote, verified, killed,
            kill_reason, judge_pass, judge_notes, sort_order
       FROM brief_claims
      WHERE brief_id = ?
      ORDER BY sort_order ASC`,
    [outputId],
  );
}

function proposalCard(o: OutputRow): string {
  const meta = TYPE_META[o.content_type] ?? TYPE_META.definition;
  if (!meta) return "";
  return `<div class="brief-proposal">
  <div class="bp-head">
    <span class="bp-type-badge ${meta.cls}">${escapeHtml(meta.label)}</span>
    <div class="bp-title">${escapeHtml(o.title)}${layerBadge(o)}</div>
    <span class="bp-cite">${escapeHtml(meta.cite)}</span>
  </div>
  <p class="bp-why">${escapeHtml(o.why_proposed_md)}</p>
  <div class="bp-actions">
    <form method="POST" action="/op/outputs/${escapeAttr(o.id)}/build" style="display:inline">
      <button type="submit" class="btn btn-amber">Build →</button>
    </form>
  </div>
</div>`;
}

function draftCard(o: OutputRow, claims: OutputClaimRow[]): string {
  const meta = TYPE_META[o.content_type] ?? TYPE_META.definition;
  if (!meta) return "";
  const verified = claims.filter((c) => c.verified === 1 && c.killed === 0);
  const killed = claims.filter((c) => c.killed === 1);
  const claimsHtml = claims.map(claimRow).join("");
  return `<div class="brief-proposal review">
  <div class="bp-head">
    <span class="bp-type-badge ${meta.cls}">${escapeHtml(meta.label)}</span>
    <div class="bp-title">${escapeHtml(o.title)}</div>
  </div>
  <div class="bp-draft">
    <div class="bp-draft-bar">
      ${icon("check")}
      <span>Verification complete</span>
      <span class="bdb-counts">${verified.length} verified${killed.length > 0 ? ` · <span class="bdb-killed">${killed.length} killed</span>` : ""}</span>
    </div>
    <div class="bp-draft-title">${escapeHtml(o.title)}</div>
    <div class="bp-claims">${claimsHtml}</div>
    <div class="bp-draft-actions">
      <form method="POST" action="/op/outputs/${escapeAttr(o.id)}/publish" style="display:inline">
        <button type="submit" class="btn btn-amber solid">Publish</button>
      </form>
      <a href="/op/outputs/${escapeAttr(o.id)}/edit" class="btn">Edit</a>
      <form method="POST" action="/op/outputs/${escapeAttr(o.id)}/discard" style="display:inline">
        <button type="submit" class="btn">Discard</button>
      </form>
      <span class="mono" style="font-size:10.5px;color:var(--faint);margin-left:auto">server-rendered · citable · no JS required</span>
    </div>
  </div>
</div>`;
}

function buildingCard(o: OutputRow): string {
  const meta = TYPE_META[o.content_type] ?? TYPE_META.definition;
  if (!meta) return "";
  const steps = [
    { label: "Gather grounding", sub: "relevant nodes, stored quotes, attributed assertions" },
    { label: "Draft body", sub: "writer role; claims reference stored quote ids" },
    {
      label: "Mechanical verify + firewall",
      sub: "quote ids checked; unattributed assertions killed",
    },
    { label: "Independent judgment", sub: "a different model checks quote ↔ claim support" },
  ];
  return `<div class="brief-proposal building">
  <div class="bp-head">
    <span class="bp-type-badge ${meta.cls}">${escapeHtml(meta.label)}</span>
    <div class="bp-title">${escapeHtml(o.title)}</div>
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

function claimRow(c: OutputClaimRow): string {
  const killed = c.killed === 1;
  return `<div class="bp-claim${killed ? " killed" : ""}">
  <span class="bpc-dot">${killed ? "✕" : "✓"}</span>
  <div class="bpc-body">
    <div class="bpc-text">${escapeHtml(c.claim_text)}</div>
    ${killed ? `<div class="bpc-kill">${escapeHtml(c.kill_reason ?? "verbatim match not found in fetched source — claim dropped")}</div>` : `<div class="bpc-src">${escapeHtml(c.source_url)}${c.judge_pass === 1 ? " · independent judge approved" : c.judge_notes ? ` · judge: ${escapeHtml(c.judge_notes.slice(0, 80))}` : ""}</div>`}
  </div>
</div>`;
}

function publishedRow(o: OutputRow): string {
  const meta = TYPE_META[o.content_type] ?? TYPE_META.definition;
  if (!meta) return "";
  // Public URL still /briefs/:slug — rename deferred per scope plan.
  return `<div class="briefs-arc-row">
  <span class="bar-dot" style="background:var(--c-thesis)"></span>
  <span class="bar-title">${escapeHtml(o.title)}</span>
  <span class="bar-type">${escapeHtml(meta.label)}</span>
  <span class="bar-when">just now</span>
  <a class="mono" href="/briefs/${escapeAttr(o.slug)}" target="_blank" style="color:var(--c-pattern);font-size:11px;text-decoration:none">View →</a>
</div>`;
}

export async function renderOutputsScreen(
  env: { DB: D1Database },
  args: { composed?: string | undefined } = {},
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const outputs = userId ? await loadOutputs(env.DB, userId) : [];

  const proposals = outputs.filter((o) => o.status === "proposal");
  const drafts = outputs.filter((o) => o.status === "draft");
  const building = outputs.filter((o) => o.status === "building");
  const published = outputs.filter((o) => o.status === "published");

  const draftClaims = new Map<string, OutputClaimRow[]>();
  if (userId) {
    for (const d of drafts) {
      draftClaims.set(d.id, await loadClaims(env.DB, d.id));
    }
  }

  // Per canonical spec v2.4 Part 11 #1: NO hand-authoring composer entry.
  // The only topbar action is "Re-propose" (automation trigger, not authoring).
  // When the proposer is upgraded (later PR), the surface populates from the
  // graph and even Re-propose may not need to be a manual click.
  const topbarActions = `<form method="POST" action="/op/outputs/propose" style="display:inline">
    <button class="btn" type="submit" title="Re-scan the graph for proposal suggestions">${icon("spark")} Re-propose</button>
  </form>`;

  const honestyBanner = `<div class="okflag" style="margin-bottom:14px">
  <span class="ftext"><b>Proposer-driven outputs.</b>
    The LLM proposer reads the typed graph + open inquiry threads and suggests outputs across both
    layers — neutral factual arrangements and signed interpretive intents. Hit <b>Re-propose</b> after
    extracting new documents. Build → review the verified draft → Edit if needed → Publish or Discard.
    Assertion-backed claims always carry attribution (the firewall); unattributed ones are killed at build.</span>
</div>`;

  const composedBanner = args.composed
    ? `<div class="okflag" style="margin-bottom:14px">
  <span class="ftext"><b>Submitted.</b> The pipeline is running in the background.</span>
</div>`
    : "";

  const queueHtml = building
    .map(buildingCard)
    .concat(drafts.map((d) => draftCard(d, draftClaims.get(d.id) ?? [])))
    .concat(proposals.map(proposalCard))
    .join("");

  const queue =
    queueHtml.length > 0
      ? `<div class="briefs-queue">${queueHtml}</div>`
      : `<div class="briefs-empty">
  No proposals yet. As the typed graph populates (extraction is triggered from Library), the proposer will
  surface candidate Outputs here. Click Re-propose to scan the current corpus.
</div>`;

  const publishedArc = published.length
    ? `<div class="briefs-arc">${published.map(publishedRow).join("")}</div>`
    : emptyState({
        iconName: "briefs",
        title: "Nothing published yet.",
        body: "Publishing a verified draft renders it server-side at /briefs/:slug — citable, no JS required.",
      });

  const body = `
${honestyBanner}
${composedBanner}
<div class="briefs-sh">
  <div class="bsh-title">Proposal queue</div>
  <div class="bsh-count">${proposals.length + building.length + drafts.length}</div>
  <div class="bsh-sub">proposer-driven · build is always your click · nothing auto-publishes</div>
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
    title: "Outputs",
    sub: "proposer-driven · verbatim-verified · operator approves, never authors",
    topbarActions,
    body,
    activeNav: "/op/outputs",
  });
}
