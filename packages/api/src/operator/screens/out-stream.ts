// OUT — the single operator stream (Phase 2).
//
// Replaces Synthesis + Outputs with one editorial surface, shaped like the
// operator's full-system prototype:
//
//   1. The morning brief    — a plain-language paragraph: what changed
//   2. Awaiting your signature — finished drafts, read & sign / edit / discard
//   3. The wiki grew        — pages that grew, no action needed
//   4. Worth your attention — a FEW findings, each carrying its evidence
//   5. Still chasing        — open inquiry threads
//   6. Silence              — the substance gate, visible
//
// The prime directive: the work is already done when the operator looks.
// The operator reads and decides; never operates a pipeline.

import { renderMarkdown } from "../../cms/lib/render-post";
import { all, one } from "../../lib/d1";
import { escapeAttr, escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { renderOpPage } from "../layout";

interface DraftRow {
  id: string;
  slug: string;
  title: string;
  content_type: string;
  layer: string;
  thesis: string | null;
  body_md: string | null;
  claims_verified: number;
  claims_killed: number;
  confidence: string | null;
}

interface FindingRow {
  id: string;
  kind: string;
  title: string;
  statement_md: string;
  confidence: string;
}

interface ThreadRow {
  id: string;
  question: string;
  status: string;
}

interface GraphPulse {
  pages: number;
  facts: number;
  contested: number;
  themes: number;
  newPages: number;
}

const INTENT_LABEL: Record<string, string> = {
  investigation: "Investigation",
  argument: "Argument",
  assessment: "Assessment",
  definition: "Definition",
  comparison: "Comparison",
  timeline: "Timeline",
  faq: "FAQ",
  "stat-roundup": "Statistics",
  "entity-profile": "Entity profile",
  "claim-table": "Claim & source table",
};

const FINDING_TAG: Record<string, { cls: string; label: string }> = {
  contradiction: { cls: "t-contra", label: "Contradiction" },
  connection: { cls: "t-conn", label: "Connection" },
  "recurring-actor": { cls: "t-pat", label: "Pattern" },
  pattern: { cls: "t-pat", label: "Pattern" },
  gap: { cls: "t-gap", label: "Gap" },
  other: { cls: "t-pat", label: "Pattern" },
};

export async function renderOutStream(
  env: { DB: D1Database },
  args: { signed?: string | undefined; err?: string | undefined } = {},
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) {
    return renderOpPage({
      title: "OUT",
      sub: "the system writes · you decide",
      body: `<div class="brief">No operator yet. Run the deploy workflow to seed.</div>`,
      activeNav: "/op/out",
    });
  }

  const [drafts, findings, threads, pulse] = await Promise.all([
    loadDrafts(env.DB, userId),
    loadFindings(env.DB, userId),
    loadThreads(env.DB, userId),
    loadPulse(env.DB, userId),
  ]);

  const brief = renderBrief(pulse, drafts, findings, threads);
  const draftsBlock = renderDrafts(drafts);
  const wikiBlock = renderWikiGrew(pulse);
  const attentionBlock = renderAttention(findings);
  const threadsBlock = renderThreads(threads);

  const okBanner = args.signed
    ? `<div class="okline">✓ Signed and published — <a href="/s/${escapeAttr(args.signed)}?mode=signed" target="_blank">view the public reading →</a></div>`
    : "";
  const errBanner = args.err ? `<div class="errline">${escapeHtml(args.err)}</div>` : "";

  const topbarActions = `<form method="POST" action="/op/out/refresh" style="display:inline">
    <button class="btn" type="submit" title="Re-read the corpus: re-surface findings, re-name themes, re-propose, auto-draft">↻ Re-read</button>
  </form>`;

  const body = `${okBanner}${errBanner}${brief}${draftsBlock}${wikiBlock}${attentionBlock}${threadsBlock}${OUT_STYLES}`;

  return renderOpPage({
    title: "OUT",
    sub: "the system writes · you read and decide",
    topbarActions,
    body,
    activeNav: "/op/out",
    width: "narrow",
  });
}

// ---- loaders --------------------------------------------------------------

async function loadDrafts(db: D1Database, userId: string): Promise<DraftRow[]> {
  return all<DraftRow>(
    db,
    `SELECT p.id, p.slug, n.label AS title, 'investigation' AS content_type,
            'interpretive' AS layer, p.thesis, p.body_md,
            p.claims_verified, p.claims_killed, p.confidence
       FROM pages p JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ? AND p.signed_status = 'draft' AND p.body_md IS NOT NULL
      ORDER BY p.updated_at DESC LIMIT 10`,
    [userId],
  ).catch(() => []);
}

async function loadFindings(db: D1Database, userId: string): Promise<FindingRow[]> {
  // Substance gate: only findings whose statement carries real evidence
  // (length is a crude proxy; the surfacer already attaches the quote).
  return all<FindingRow>(
    db,
    `SELECT id, kind, title, statement_md, confidence FROM patterns
      WHERE user_id = ? AND status = 'candidate' AND length(statement_md) > 80
      ORDER BY (confidence = 'high') DESC, updated_at DESC LIMIT 4`,
    [userId],
  ).catch(() => []);
}

async function loadThreads(db: D1Database, userId: string): Promise<ThreadRow[]> {
  return all<ThreadRow>(
    db,
    `SELECT id, question, status FROM inquiry_threads
      WHERE user_id = ? AND status IN ('open','being_pursued')
      ORDER BY CASE status WHEN 'being_pursued' THEN 0 ELSE 1 END, created_at DESC LIMIT 8`,
    [userId],
  ).catch(() => []);
}

async function loadPulse(db: D1Database, userId: string): Promise<GraphPulse> {
  const row = await one<GraphPulse>(
    db,
    `SELECT
       (SELECT COUNT(*) FROM pages WHERE user_id = ?) AS pages,
       (SELECT COUNT(*) FROM nodes WHERE user_id = ? AND kind = 'neutral_fact') AS facts,
       (SELECT COUNT(*) FROM assertions WHERE rank = 'contested' AND node_id IN
          (SELECT id FROM nodes WHERE user_id = ?)) AS contested,
       (SELECT COUNT(*) FROM nodes WHERE user_id = ? AND kind = 'theme') AS themes,
       (SELECT COUNT(*) FROM pages WHERE user_id = ?
          AND created_at > datetime('now','-1 day')) AS newPages`,
    [userId, userId, userId, userId, userId],
  ).catch(() => null);
  return row ?? { pages: 0, facts: 0, contested: 0, themes: 0, newPages: 0 };
}

// ---- renderers ------------------------------------------------------------

function renderBrief(
  pulse: GraphPulse,
  drafts: DraftRow[],
  findings: FindingRow[],
  threads: ThreadRow[],
): string {
  if (pulse.pages === 0) {
    return `<div class="brief"><div class="who">canopticon</div>
  <p>Nothing read yet. Drop research reports in <a href="/op/library">IN</a> — the system reads them, builds the wiki, and brings finished things here. You read and decide.</p></div>`;
  }
  const bits: string[] = [];
  bits.push(
    `The wiki holds <b>${pulse.pages} page${pulse.pages === 1 ? "" : "s"}</b> built from <b>${pulse.facts} sourced fact${pulse.facts === 1 ? "" : "s"}</b>.`,
  );
  if (pulse.themes > 0)
    bits.push(
      `<b>${pulse.themes} theme${pulse.themes === 1 ? "" : "s"}</b> the corpus engages with.`,
    );
  if (drafts.length > 0)
    bits.push(
      `<b>${drafts.length} signed reading${drafts.length === 1 ? "" : "s"}</b> drafted and waiting for your signature.`,
    );
  if (findings.length > 0)
    bits.push(
      `<b>${findings.length}</b> finding${findings.length === 1 ? "" : "s"} worth your eye.`,
    );
  if (threads.length > 0)
    bits.push(`<b>${threads.length}</b> open thread${threads.length === 1 ? "" : "s"}.`);
  return `<div class="brief"><div class="who">canopticon · the corpus right now</div>
  <p>${bits.join(" ")}</p></div>`;
}

function renderDrafts(drafts: DraftRow[]): string {
  if (drafts.length === 0) return "";
  const cards = drafts
    .map((d) => {
      const intent = INTENT_LABEL[d.content_type] ?? d.content_type;
      const preview = d.thesis
        ? escapeHtml(d.thesis)
        : escapeHtml((d.body_md ?? "").replace(/[#*_`>]/g, "").slice(0, 220));
      return `<div class="draft">
  <div class="dh">
    <span class="l">Draft · signed reading</span>
    <span class="badge b-arg">${escapeHtml(intent)}</span>
    <span class="dmeta">${d.claims_verified} verified${d.claims_killed > 0 ? ` · ${d.claims_killed} killed` : ""}${d.confidence ? ` · ${escapeHtml(d.confidence)} confidence` : ""}</span>
  </div>
  <div class="thz">"${preview}"</div>
  <div class="dactions">
    <form method="POST" action="/op/out/${escapeAttr(d.id)}/sign" style="display:inline"><button class="btn primary" type="submit">Sign &amp; publish</button></form>
    <a class="btn ghost" href="/op/out/${escapeAttr(d.id)}/edit">Edit</a>
    <a class="btn ghost" href="/s/${escapeAttr(d.slug)}?mode=signed" target="_blank">Preview</a>
    <form method="POST" action="/op/out/${escapeAttr(d.id)}/discard" style="display:inline"><button class="btn ghost" type="submit">Discard</button></form>
  </div>
</div>`;
    })
    .join("");
  return `<div class="sect">Awaiting your signature — drafted by the system, verified, yours to approve</div>${cards}`;
}

function renderWikiGrew(pulse: GraphPulse): string {
  if (pulse.pages === 0) return "";
  const newLine =
    pulse.newPages > 0
      ? `<b style="color:var(--teal,#4fb59a)">+${pulse.newPages} new page${pulse.newPages === 1 ? "" : "s"}</b> in the last day · `
      : "";
  return `<div class="sect">The wiki grew — no action needed</div>
<div class="grew">${newLine}<b>${pulse.pages}</b> subject pages · <b>${pulse.contested}</b> contested claims shown as contested · <a href="/topics" target="_blank">browse the wiki →</a></div>`;
}

function renderAttention(findings: FindingRow[]): string {
  if (findings.length === 0) return "";
  const cards = findings
    .map((f) => {
      const tag = FINDING_TAG[f.kind] ?? FINDING_TAG.other ?? { cls: "t-pat", label: "Pattern" };
      return `<div class="opcard">
  <div class="och"><span class="otag ${tag.cls}">${escapeHtml(tag.label)}</span><span class="cmeta">${escapeHtml(f.confidence)} confidence</span></div>
  <div class="t">${escapeHtml(f.title)}</div>
  <div class="cbody">${renderMarkdown(f.statement_md.slice(0, 320))}</div>
</div>`;
    })
    .join("");
  return `<div class="sect">Worth your attention — each carries its evidence</div><div class="cardrow">${cards}</div>
<div class="silence">Lower-signal observations stayed quiet — the wiki absorbs them silently. <a href="/op/synthesis">See all findings</a></div>`;
}

function renderThreads(threads: ThreadRow[]): string {
  if (threads.length === 0) return "";
  const rows = threads
    .map(
      (t) => `<div class="threadrow">
  <span class="tstatus ${t.status === "being_pursued" ? "pursuing" : ""}">${t.status === "being_pursued" ? "PURSUING" : "OPEN"}</span>
  <span class="tq">${escapeHtml(t.question)}</span>
  ${t.status === "open" ? `<form method="POST" action="/op/synthesis/thread/${escapeAttr(t.id)}/pursue" style="display:inline"><button class="btn ghost tbtn">Pursue</button></form>` : `<form method="POST" action="/op/synthesis/thread/${escapeAttr(t.id)}/resolve" style="display:inline"><button class="btn ghost tbtn">Resolve</button></form>`}
  <form method="POST" action="/op/synthesis/thread/${escapeAttr(t.id)}/drop" style="display:inline"><button class="btn ghost tbtn">Drop</button></form>
</div>`,
    )
    .join("");
  return `<div class="sect">Still chasing — open questions the corpus raised</div>${rows}`;
}

const OUT_STYLES = `<style>
  .okline { background:#243a30; color:#6dbd9a; padding:9px 14px; border-radius:7px; font-size:13px; margin-bottom:14px; }
  .okline a { color:#9adcb8; }
  .errline { background:#3a2a22; color:#d89a6a; padding:9px 14px; border-radius:7px; font-size:13px; margin-bottom:14px; }
  .brief { background:var(--dark2,#1e1e24); border:1px solid var(--dline,#2e2e38); border-radius:11px; padding:18px 22px; margin-bottom:8px; }
  .brief .who { font-size:10px; letter-spacing:.08em; color:var(--dmut,#6e6a62); text-transform:uppercase; margin-bottom:9px; }
  .brief p { font-size:15px; line-height:1.7; color:#d8d4ca; }
  .brief b { color:#f0ece2; font-weight:600; }
  .brief a { color:var(--amber,#d9a441); }
  .sect { font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--dmut,#6e6a62); margin:30px 0 12px; }
  .draft { background:var(--dark2,#1e1e24); border:1px solid #3a3426; border-radius:11px; padding:18px 20px; margin-bottom:14px; }
  .draft .dh { display:flex; align-items:center; gap:10px; margin-bottom:11px; flex-wrap:wrap; }
  .draft .dh .l { font-size:10px; letter-spacing:.08em; color:var(--amber,#d9a441); text-transform:uppercase; font-weight:600; }
  .draft .dmeta { font-size:11px; color:var(--dmut,#6e6a62); margin-left:auto; }
  .draft .thz { font-family:Georgia,serif; font-size:17px; font-style:italic; color:#ece8de; margin-bottom:14px; line-height:1.5; }
  .badge { display:inline-block; font-size:9.5px; letter-spacing:.08em; padding:2px 8px; border-radius:4px; font-weight:600; }
  .b-arg { background:#f4e9e6; color:#8a3324; }
  .dactions { display:flex; gap:8px; flex-wrap:wrap; }
  .btn { font-size:12px; padding:7px 16px; border-radius:6px; cursor:pointer; border:1px solid transparent; text-decoration:none; display:inline-block; }
  .btn.primary { background:var(--amber,#d9a441); color:#1c1608; font-weight:600; }
  .btn.ghost { background:none; border-color:#3a3a46; color:#c8c5bd; }
  .grew { font-size:14px; color:#c8c5bd; background:var(--dark2,#1e1e24); border:1px solid var(--dline,#2e2e38); border-radius:9px; padding:14px 18px; }
  .grew b { color:#e8e4da; } .grew a { color:var(--amber,#d9a441); }
  .cardrow { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  @media(max-width:680px){ .cardrow { grid-template-columns:1fr; } }
  .opcard { background:var(--dark2,#1e1e24); border:1px solid var(--dline,#2e2e38); border-radius:9px; padding:13px 15px; }
  .och { display:flex; align-items:center; gap:8px; margin-bottom:7px; }
  .otag { font-size:9px; letter-spacing:.08em; padding:2px 7px; border-radius:3px; font-weight:600; }
  .t-contra { background:#3a2a22; color:#d89a6a; } .t-conn { background:#262e3a; color:#7aa3d8; }
  .t-pat { background:#22303a; color:#6ab8c8; } .t-gap { background:#2e2a34; color:#9a8ab8; }
  .och .cmeta { font-size:10px; color:var(--dmut,#6e6a62); margin-left:auto; }
  .opcard .t { font-size:13px; color:#e0dcd2; line-height:1.45; margin-bottom:5px; font-weight:600; }
  .opcard .cbody { font-size:12px; color:#9a968c; line-height:1.5; }
  .silence { font-size:12px; color:var(--dmut,#6e6a62); margin-top:12px; padding-top:10px; border-top:1px solid var(--dline,#2e2e38); }
  .silence a { color:var(--dmut,#6e6a62); }
  .threadrow { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--dline,#2e2e38); }
  .tstatus { font-size:9px; letter-spacing:.06em; color:var(--dmut,#6e6a62); min-width:70px; }
  .tstatus.pursuing { color:var(--amber,#d9a441); }
  .tq { flex:1; font-size:13px; color:#c8c5bd; }
  .tbtn { font-size:11px; padding:3px 10px; }
</style>`;
