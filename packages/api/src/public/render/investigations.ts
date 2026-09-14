// Investigations — the signed-analysis index + the Library (raw research
// archive). The piece page itself is rendered by piece-template.ts, not
// here — see that file for the public face of a single document.

import { looksLikeMachineFilename } from "../../lib/title";
import { type PublicEnv, listInvestigations, resolveOperatorId } from "../data";
import { escapeHtml, renderPage } from "../layout";
import { emptyState, formatDate, kindLabel, pieceCard, sectionHeader } from "./components";
import { renderLiveStatusBanner } from "./status-banner";

// Reader-facing intent labels for signed readings (spec Part 18.2: intents
// are badges and filters, not nav). The seven canonical signed-reading
// intents — spec v2.5 Part 5, and the only values pages.intent's CHECK
// constraint (migration 0032) permits.
const INTENT_LABELS: Record<string, string> = {
  investigation: "Investigation",
  argument: "Argument",
  pattern: "Pattern",
  hypothesis: "Hypothesis",
  assessment: "Assessment",
  critique: "Critique",
  explanation: "Explanation",
};

export async function renderInvestigationsIndex(
  env: PublicEnv,
  intentFilter?: string,
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const pieces = userId ? await listInvestigations(env.DB, userId) : [];

  // Signed readings from the fabric (pages.signed_status='published'). These
  // are the Phase-3 auto-drafted, operator-signed readings of subjects — the
  // only "published analysis" pipeline actually being fed going forward.
  // (The older `briefs` table/pipeline this index used to also list here is
  // sunset — see settle-pipeline.ts. Already-published briefs still resolve
  // at their own /briefs/:slug URLs; they just don't surface here anymore.)
  const { all } = await import("../../lib/d1");
  const readings = userId
    ? await all<{
        slug: string;
        label: string;
        kind: string;
        thesis: string | null;
        intent: string | null;
        signed_by: string | null;
        signed_at: string | null;
        confidence: string | null;
      }>(
        env.DB,
        `SELECT p.slug, n.label, n.kind, p.thesis, p.intent, p.signed_by, p.signed_at, p.confidence
           FROM pages p JOIN nodes n ON n.id = p.subject_node_id
          WHERE p.user_id = ? AND p.signed_status = 'published'
          ORDER BY p.signed_at DESC LIMIT 40`,
        [userId],
      ).catch(() => [])
    : [];

  // Apply the intent filter to readings — clicking an intent badge narrows.
  const shownReadings = intentFilter ? readings.filter((r) => r.intent === intentFilter) : readings;

  // Editorial hierarchy: a LEAD reading + secondary cards row + the rest as
  // a compact ordered list. A real investigations page foregrounds the
  // strongest piece instead of treating every reading as equal.
  const leadReading = shownReadings[0];
  const secondaryReadings = shownReadings.slice(1, 3);
  const tailReadings = shownReadings.slice(3);

  const intentChip = (intent: string | null | undefined): string =>
    intent
      ? `<span class="intent-badge intent-${escapeHtml(intent)}">${escapeHtml(INTENT_LABELS[intent] ?? intent)}</span>`
      : `<span class="chip">Signed analysis</span>`;

  const leadReadingCard = leadReading
    ? `<a class="inv-lead" href="/s/${escapeHtml(leadReading.slug)}?mode=signed">
  <div class="inv-lead-kicker">
    ${intentChip(leadReading.intent)}
    ${leadReading.confidence ? `<span class="inv-meta">${escapeHtml(leadReading.confidence)} confidence</span>` : ""}
    ${leadReading.signed_by ? `<span class="inv-meta">signed · ${escapeHtml(leadReading.signed_by)}</span>` : ""}
    ${leadReading.signed_at ? `<span class="inv-meta inv-date">${escapeHtml(formatDate(leadReading.signed_at))}</span>` : ""}
  </div>
  <h2 class="inv-lead-title">${escapeHtml(leadReading.label)}</h2>
  ${leadReading.thesis ? `<p class="inv-lead-thesis">${escapeHtml(leadReading.thesis.slice(0, 220))}</p>` : ""}
</a>`
    : "";

  const secondaryReadingsRow = secondaryReadings.length
    ? `<div class="inv-secondaries">${secondaryReadings
        .map(
          (r) => `<a class="inv-secondary" href="/s/${escapeHtml(r.slug)}?mode=signed">
  <div class="inv-secondary-kicker">${intentChip(r.intent)}${r.confidence ? ` <span class="inv-meta">${escapeHtml(r.confidence)} confidence</span>` : ""}</div>
  <h3 class="inv-secondary-title">${escapeHtml(r.label)}</h3>
  ${r.thesis ? `<p class="inv-secondary-thesis">${escapeHtml(r.thesis.slice(0, 130))}</p>` : ""}
  ${r.signed_at ? `<div class="inv-meta inv-date">${escapeHtml(formatDate(r.signed_at))}</div>` : ""}
</a>`,
        )
        .join("")}</div>`
    : "";

  const tailReadingsList = tailReadings.length
    ? `<div class="inv-tail-list">${tailReadings
        .map(
          (r) => `<div class="inv-row">
  ${intentChip(r.intent)}
  <a class="inv-row-link" href="/s/${escapeHtml(r.slug)}?mode=signed">${escapeHtml(r.label)}</a>
  ${r.signed_at ? `<span class="inv-meta inv-date">${escapeHtml(formatDate(r.signed_at))}</span>` : ""}
</div>`,
        )
        .join("")}</div>`
    : "";

  const readingCards = leadReadingCard + secondaryReadingsRow + tailReadingsList;

  // Filter row collects intents from signed readings (pages.intent). Click
  // an intent to narrow.
  const presentTypes = [...new Set(readings.map((r) => r.intent).filter((i): i is string => !!i))];
  const filterRow = presentTypes.length
    ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
  <a href="/investigations" class="chip" style="text-decoration:none${intentFilter ? "" : ";border-color:var(--accent)"}">All</a>
  ${presentTypes
    .map(
      (t) =>
        `<a href="/investigations?intent=${escapeHtml(t)}" class="chip" style="text-decoration:none${intentFilter === t ? ";border-color:var(--accent)" : ""}">${escapeHtml(INTENT_LABELS[t] ?? t)}</a>`,
    )
    .join("")}
</div>
<style>
  .intent-badge { display:inline-block; font-size:10px; padding:2px 9px; border-radius:4px;
    font-weight:600; letter-spacing:.04em; margin-right:6px; }
  .intent-investigation { background:rgba(77,156,111,.16); color:#4d9c6f; }
  .intent-argument { background:rgba(201,106,83,.16); color:#c96a53; }
  .intent-pattern { background:rgba(126,166,216,.16); color:#7ea6d8; }
  .intent-hypothesis { background:rgba(183,158,224,.16); color:#b79ee0; }
  .intent-assessment { background:rgba(209,171,92,.16); color:#d1ab5c; }
  .intent-critique { background:rgba(196,123,152,.16); color:#c47b98; }
  .intent-explanation { background:rgba(126,200,227,.16); color:#7ec8e3; }
</style>`
    : "";

  const list = pieces.length
    ? `<div class="cards-row">${pieces.map((p) => pieceCard(p)).join("")}</div>`
    : "";

  // The fabric-era ledger: signed readings of subjects/themes. When no
  // readings exist yet — and we only have legacy CMS-era pieces (or
  // nothing) — explain the SHAPE that fills this page rather than show a
  // dead empty.
  const shapeBlock =
    readings.length === 0
      ? `<section class="shape-block" aria-label="What this page will contain">
  <div class="sec-k">What lands here</div>
  <ul>
    <li><b>Signed analyses</b> — the operator picks a subject (entity, event, or theme) with enough material on it, optionally gives it an angle, and drafts an analysis; then reads and signs it. Each carries a thesis, a confidence band, and a mandatory box of facts that complicate it.</li>
    <li><b>Intent badges</b> — every signed piece wears its kind: Investigation · Argument · Pattern · Assessment · Critique · Explanation. Filter above when there are enough to filter.</li>
    <li><b>Receipts</b> — every load-bearing assertion ties back to a verbatim quote from a stored source document.</li>
  </ul>
  ${pieces.length > 0 ? `<p>Showing ${pieces.length} legacy investigation${pieces.length === 1 ? "" : "s"} from before the fabric era below. No fabric-era signed analyses yet — draft one from any subject's page.</p>` : '<p>No signed analyses yet — draft one from any subject\'s page ("Draft an analysis").</p>'}
</section>`
      : "";

  const body = `
<section style="margin-bottom:24px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> Signed analysis</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 12px;color:var(--ink)">Investigations</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--ink-2);max-width:680px">
    The figure cut across the facts. Every piece wears its intent as a badge;
    every load-bearing assertion ties back to the evidence it rests on.
  </p>
</section>
${shapeBlock}
${filterRow}
<section>${readingCards}${list}</section>
<style>
  .shape-block { padding:20px 22px; border:1px solid var(--rule); border-radius:9px;
    background:var(--panel-soft, rgba(0,0,0,.02)); margin-bottom:28px; }
  .shape-block .sec-k { font-size:11px; letter-spacing:.14em; color:var(--ink-3);
    text-transform:uppercase; font-weight:600; margin:0 0 12px; }
  .shape-block ul { list-style:none; padding:0; margin:0 0 14px; }
  .shape-block li { font-size:14.5px; line-height:1.6; color:var(--ink-2); padding:7px 0;
    border-top:1px solid var(--rule); }
  .shape-block li:first-child { border-top:none; }
  .shape-block li b { color:var(--ink); font-weight:600; }
  .shape-block p { font-size:13.5px; color:var(--ink-3); font-style:italic; margin:0; }

  /* Investigations editorial hierarchy — lead piece, two secondaries,
     compact tail list. Matches the home pattern so the reader's mental
     model carries across surfaces. */
  .inv-lead {
    display: block; text-decoration: none;
    padding: 28px 32px; margin-bottom: 24px;
    border: 1px solid var(--rule); border-radius: 13px;
    background: var(--surface, #fff);
    transition: border-color .12s;
  }
  .inv-lead:hover { border-color: var(--accent-bd); }
  .inv-lead-kicker { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .inv-lead-title {
    font-family: var(--serif);
    font-size: 32px; line-height: 1.16;
    letter-spacing: -0.018em;
    color: var(--ink);
    margin: 0 0 12px;
  }
  .inv-lead-thesis {
    font-family: var(--serif);
    font-size: 18px; line-height: 1.55;
    font-style: italic;
    color: var(--ink-2);
    margin: 0;
    max-width: 720px;
  }
  .inv-secondaries { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 28px; }
  .inv-secondary {
    display: block; text-decoration: none;
    padding: 20px 22px;
    border: 1px solid var(--rule); border-radius: 10px;
    background: var(--surface, #fff);
    transition: border-color .12s;
  }
  .inv-secondary:hover { border-color: var(--accent-bd); }
  .inv-secondary-kicker { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 9px; }
  .inv-secondary-title {
    font-family: var(--serif);
    font-size: 20px; line-height: 1.22;
    color: var(--ink);
    margin: 0 0 8px;
  }
  .inv-secondary-thesis {
    font-family: var(--serif);
    font-size: 14px; line-height: 1.5;
    color: var(--ink-2);
    margin: 0 0 10px;
  }
  .inv-tail-list { margin-top: 16px; }
  .inv-row {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 12px 0; border-top: 1px solid var(--rule);
  }
  .inv-row:first-child { border-top: none; }
  .inv-row-link {
    font-family: var(--serif); font-size: 17px;
    color: var(--ink); text-decoration: none;
    flex: 1;
  }
  .inv-row-link:hover { color: var(--accent); }
  .inv-meta {
    font-size: 12px;
    color: var(--ink-3);
    letter-spacing: .03em;
  }
  .inv-date { font-family: var(--mono); font-size: 11.5px; }
  @media (max-width: 720px) {
    .inv-secondaries { grid-template-columns: 1fr; }
    .inv-lead-title { font-size: 26px; }
    .inv-lead-thesis { font-size: 16px; }
  }
</style>
`;
  return renderPage({
    title: "Investigations",
    description: "Signed analysis on Canadian power — investigations, arguments, assessments.",
    body,
    activeNav: "/investigations",
    zone: "investigations",
  });
}

// Library — the raw research layer. Lists everything (incl. working-
// material) with an honest status tag.
// A stored piece's title is sometimes the raw upload filename — e.g.
// "compass_artifact_wf-c96cfa7c-3f5d-…_text_markdown.md" — when the
// operator dropped a file whose name was never meant to be read. Showing
// that verbatim as a page title reads as broken, not honest. Detect the
// machine-filename shape (long, no spaces, a file extension or a uuid-ish
// segment) and show a plain placeholder with the real filename kept
// visible underneath in mono, never hidden.
// Essay lint notes, written into the piece's metadata at upload time. Shown
// here rather than only on the upload confirmation, which is seen once and
// then gone. Advisory — the piece published regardless.
function renderLintNotes(metadataJson: string | null | undefined): string {
  let notes: Array<{ level: string; message: string }> = [];
  try {
    const meta = JSON.parse(metadataJson || "{}") as { essay_lint?: typeof notes };
    notes = Array.isArray(meta.essay_lint) ? meta.essay_lint : [];
  } catch {
    return "";
  }
  const loud = notes.filter((n) => n.level === "error" || n.level === "warn");
  if (!loud.length) return "";
  return `<details class="lint">
  <summary>${loud.length} note${loud.length === 1 ? "" : "s"} on this essay's structure</summary>
  <ul>${loud.map((n) => `<li>${escapeHtml(n.message)}</li>`).join("")}</ul>
</details>`;
}

export async function renderLibraryIndex(
  env: PublicEnv,
  opts: {
    isOperator?: boolean;
    ingested?: string;
    error?: string;
    importing?: string;
    videoError?: string;
    /** Count of jobs started by the "Process queue" button. */
    draining?: string;
  } = {},
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const { listLibrary } = await import("../data");
  const pieces = userId ? await listLibrary(env.DB, userId) : [];

  // working-material never gets a public page (renderPiece refuses it,
  // by design — see piece-template.ts) — EXCEPT an on-demand research
  // draft (graph/lib/deep-research.ts's researchOnDemand), which is
  // working-material specifically so it can't go live before review, but
  // still needs to be readable somewhere. This is that somewhere: link it
  // to the operator review screen instead of leaving it dead text like
  // every other piece of raw working material.
  const { all: allRows2 } = await import("../../lib/d1");
  const onDemandDrafts = new Set<string>();
  if (userId && opts.isOperator) {
    const rows = await allRows2<{ id: string }>(
      env.DB,
      `SELECT id FROM pieces WHERE user_id = ? AND publication_status = 'working-material'
         AND tags LIKE '%on-demand%'`,
      [userId],
    ).catch(() => []);
    for (const r of rows) onDemandDrafts.add(r.id);
  }

  const uploadBanner = opts.error
    ? `<div class="op-banner op-banner-error">${escapeHtml(opts.error)}</div>`
    : opts.ingested
      ? `<div class="op-banner">Uploaded ${escapeHtml(opts.ingested)} document${opts.ingested === "1" ? "" : "s"} — extraction started automatically.</div>`
      : opts.draining
        ? `<div class="op-banner">${
            opts.draining === "0"
              ? "Nothing was waiting in the queue."
              : `Started ${escapeHtml(opts.draining)} queued job${opts.draining === "1" ? "" : "s"}. They run in the background — reload in a minute, and press again if more are still queued.`
          }</div>`
        : "";

  // Operator affordance strip — only rendered when logged in. Surfaces the
  // bulk extract action (the work behind it lives at POST /op/library/extract
  // and is unchanged). Spec v2.5 Part 9: same URL, controls woven in. Visual
  // treatment is deliberately minimal — a band, two buttons. The handoff doc
  // says "implement the model and leave the exact visual treatment for review".
  let opStrip = "";
  if (opts.isOperator && userId) {
    const { one } = await import("../../lib/d1");
    const counts = await one<{ total: number; unextracted: number; queued: number }>(
      env.DB,
      `SELECT
         (SELECT COUNT(*) FROM pieces WHERE user_id = ?) AS total,
         (SELECT COUNT(*) FROM pieces p
            WHERE p.user_id = ? AND NOT EXISTS (
              SELECT 1 FROM digest_jobs j
               WHERE j.user_id = p.user_id AND j.piece_id = p.id AND j.status = 'completed')
         ) AS unextracted,
         (SELECT COUNT(*) FROM digest_jobs
            WHERE user_id = ? AND status IN ('queued','running')) AS queued`,
      [userId, userId, userId],
    ).catch(() => null);
    const total = counts?.total ?? 0;
    const unextracted = counts?.unextracted ?? 0;
    const queued = counts?.queued ?? 0;
    const extractBtn =
      unextracted > 0
        ? `<form method="POST" action="/op/library/extract" style="display:inline;margin-right:8px">
  <input type="hidden" name="mode" value="all-unextracted" />
  <button type="submit" class="op-strip-btn op-strip-btn-primary">Extract all (${unextracted})</button>
</form>`
        : "";
    const reextractBtn =
      total > 0
        ? `<form method="POST" action="/op/library/extract" style="display:inline" onsubmit="return confirm('Re-extract all ${total} documents?');">
  <input type="hidden" name="mode" value="all" />
  <button type="submit" class="op-strip-btn">Re-extract all (${total})</button>
</form>`
        : "";
    // Queued jobs used to be drained by the every-2-minute cron. The cron is
    // off (nothing runs unattended any more), so anything enqueued without
    // being run inline — zip entries past the first three — would otherwise
    // sit in the queue forever with no way to move it. A button the operator
    // presses is the whole mechanism, and it costs nothing unpressed.
    const drainBtn =
      queued > 0
        ? `<form method="POST" action="/op/library/drain" style="display:inline;margin-right:8px">
  <button type="submit" class="op-strip-btn op-strip-btn-primary">Process queue (${queued})</button>
</form>`
        : "";
    // The upload dropzone. This existed only on the old /op/library screen
    // (operator/screens/library.ts's dropzone()) before that screen was
    // redirected away into this same public page — the extract/re-extract
    // buttons made the trip over, the upload form never did, leaving no
    // reachable way to add a document at all. Same backend (POST
    // /op/feed/upload, unchanged), same auto-submit-on-choose behaviour.
    const dropzone = `<form method="POST" action="/op/feed/upload" enctype="multipart/form-data" id="feed-form" class="op-dropzone-form">
  <label class="op-dropzone" for="feed-file" id="op-dz-label">
    <div class="op-dz-1">Drop a document here, or click to choose</div>
    <div class="op-dz-2">Markdown · plain text · PDF · a .zip of any of these</div>
    <input type="file" id="feed-file" name="file" accept=".md,.txt,.pdf,.zip,text/markdown,text/plain,application/pdf,application/zip,application/x-zip-compressed" required style="display:none" />
  </label>
  <div class="op-dz-uploading" id="op-dz-uploading" hidden>Uploading — banking into the Library. You can leave this page.</div>
</form>
<script>
(function () {
  var form = document.getElementById("feed-form");
  var input = document.getElementById("feed-file");
  var label = document.getElementById("op-dz-label");
  var busy = document.getElementById("op-dz-uploading");
  if (!form || !input || !label || !busy) return;
  input.addEventListener("change", function () {
    if (!input.files || input.files.length === 0) return;
    label.setAttribute("hidden", "");
    busy.removeAttribute("hidden");
    if (form.dataset.submitting === "1") return;
    form.dataset.submitting = "1";
    form.submit();
  });
})();
</script>`;

    // Video-as-source-material (Phase 1, 2026-07-24): the same "drop it in,
    // no confirmation gauntlet" upload philosophy as the dropzone above,
    // pointed at a video URL instead of a file. POSTs to
    // /op/library/import-video, which fetches+transcribes via the video
    // Worker's Container and (once done) turns the transcript into a piece
    // exactly like an uploaded document — see graph/lib/video-intake.ts.
    const videoImportBanner = opts.videoError
      ? `<div class="op-banner op-banner-error">${escapeHtml(opts.videoError)}</div>`
      : "";
    const videoStatus = opts.importing
      ? renderLiveStatusBanner(
          `/op/library/import-video/${encodeURIComponent(opts.importing)}/status`,
          "Fetching and transcribing…",
        )
      : "";
    const videoImportForm = opts.importing
      ? ""
      : `<form method="POST" action="/op/library/import-video" class="op-video-form">
  <input type="url" name="url" placeholder="Paste a video URL to transcribe and add to the record" required class="op-video-input" />
  <button type="submit" class="op-strip-btn">Import video</button>
</form>`;

    opStrip = `<div class="op-strip">
  <div class="op-strip-top">
    <div class="op-strip-label">Operator</div>
    <div class="op-strip-actions">${drainBtn}${extractBtn}${reextractBtn}</div>
  </div>
  ${dropzone}
  ${videoImportBanner}
  ${videoStatus}
  ${videoImportForm}
  <style>
    .op-video-form { display:flex; gap:8px; margin-top:10px; }
    .op-video-input { flex:1; font-size:13px; padding:8px 10px; border-radius:6px;
      border:1px solid var(--rule); background:var(--surface); color:var(--ink); }
  </style>
</div>
<style>
  .op-strip { padding:14px 16px; margin:0 0 18px;
    border:1px solid var(--rule); border-radius:8px; background:rgba(0,0,0,.03); }
  .op-strip-top { display:flex; align-items:center; gap:14px; margin-bottom:12px; }
  .op-strip-label { font-size:11px; letter-spacing:.12em; text-transform:uppercase;
    color:var(--ink-3); font-weight:600; }
  .op-strip-actions { display:flex; gap:8px; flex-wrap:wrap; margin-left:auto; }
  .op-strip-btn { font-size:12.5px; padding:6px 14px; border-radius:6px; cursor:pointer;
    border:1px solid var(--rule); background:var(--surface); color:var(--ink); }
  .op-strip-btn-primary { background:var(--ink); color:#fff; border-color:var(--ink); }
  .op-dropzone-form { margin:0; }
  .op-dropzone {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:4px; padding:22px 16px; border:1px dashed var(--rule-bright, var(--rule));
    border-radius:8px; background:var(--surface); cursor:pointer; text-align:center;
    transition: border-color .12s, background .12s;
  }
  .op-dropzone:hover { border-color: var(--accent); background: var(--accent-bg, var(--surface)); }
  .op-dz-1 { font-size:13.5px; color:var(--ink); font-weight:500; }
  .op-dz-2 { font-size:11.5px; color:var(--ink-3); }
  .op-dz-uploading { padding:14px; text-align:center; font-size:12.5px; color:var(--ink-3); }
  .op-banner { padding:11px 14px; margin:0 0 16px; border-radius:8px; font-size:13px;
    border:1px solid var(--conf-bd, var(--rule)); background:var(--conf-bg, var(--surface)); color:var(--ink); }
  .op-banner-error { border-color:var(--corr-bd, var(--rule)); background:var(--corr-bg, var(--surface)); }
</style>`;
  }

  // Library weight — the proof-of-work line. Documents read, facts extracted,
  // subjects fed, contested claims surfaced. Numbers come straight from the
  // typed graph; if extraction hasn't run, the line shrinks honestly.
  const { one, all: allRows } = await import("../../lib/d1");
  const weight = userId
    ? await one<{
        docs: number;
        facts: number;
        subjects: number;
        contested: number;
        threads: number;
      }>(
        env.DB,
        `SELECT
           (SELECT COUNT(*) FROM pieces WHERE user_id = ?) AS docs,
           (SELECT COUNT(*) FROM nodes WHERE user_id = ?
              AND kind IN ('neutral_fact', 'event', 'entity', 'assertion')) AS facts,
           (SELECT COUNT(DISTINCT subject_node_id) FROM pages WHERE user_id = ?) AS subjects,
           (SELECT COUNT(*) FROM assertions a JOIN nodes n ON n.id = a.node_id
              WHERE n.user_id = ? AND a.rank = 'contested') AS contested,
           (SELECT COUNT(*) FROM inquiry_threads WHERE user_id = ?) AS threads`,
        [userId, userId, userId, userId, userId],
      ).catch(() => null)
    : null;

  // Per-piece "what it fed" — one query, indexed by piece_id. Renders in the
  // table row so the operator can see at a glance which docs are pulling
  // weight and which are dead. Includes node count and distinct-subjects count.
  const fedRows = userId
    ? await allRows<{ piece_id: string; nodes: number; subjects: number }>(
        env.DB,
        `SELECT n.piece_id,
                COUNT(*) AS nodes,
                COUNT(DISTINCT e.dst_node_id) AS subjects
           FROM nodes n
           LEFT JOIN edges e ON e.src_node_id = n.id AND e.family = 'aboutness'
          WHERE n.user_id = ? AND n.piece_id IS NOT NULL
            AND n.kind IN ('neutral_fact', 'event', 'assertion')
          GROUP BY n.piece_id`,
        [userId],
      ).catch(() => [])
    : [];
  const fedByPiece = new Map(fedRows.map((r) => [r.piece_id, r] as const));

  const rows = pieces.length
    ? pieces
        .map((p) => {
          const fed = fedByPiece.get(p.id);
          const isOnDemandDraft =
            p.publication_status === "working-material" && onDemandDrafts.has(p.id);
          const status = isOnDemandDraft
            ? `<span class="chip">draft — awaiting review</span>`
            : p.publication_status === "working-material"
              ? `<span class="chip">working material</span>`
              : p.publication_status === "canonical"
                ? `<span class="chip">canonical</span>`
                : `<span class="chip">published</span>`;
          const href = isOnDemandDraft
            ? `/op/library/research/${escapeHtml(p.id)}/review`
            : p.publication_status === "working-material"
              ? ""
              : `/library/${escapeHtml(p.slug)}`;
          const isRawFilename = looksLikeMachineFilename(p.title);
          const displayTitle = isRawFilename ? "Untitled research document" : p.title;
          const rawFilenameLine = isRawFilename
            ? `<div class="lib-title-raw">${escapeHtml(p.title)}</div>`
            : "";
          const title = href
            ? `<a href="${href}" class="ac">${escapeHtml(displayTitle)}</a>${rawFilenameLine}`
            : `${escapeHtml(displayTitle)}${rawFilenameLine}`;
          const fedCell =
            fed && fed.nodes > 0
              ? `<span><b>${fed.nodes}</b> fact${fed.nodes === 1 ? "" : "s"}${fed.subjects > 0 ? ` · ${fed.subjects} subject${fed.subjects === 1 ? "" : "s"}` : ""}</span>`
              : `<span class="lib-fed-quiet">not extracted</span>`;
          return `<tr>
  <td>${title}${renderLintNotes(p.metadata)}</td>
  <td class="coord">${escapeHtml(kindLabel(p.kind))}</td>
  <td class="lib-fed">${fedCell}</td>
  <td>${status}</td>
  <td class="coord">${p.published_at ? escapeHtml(formatDate(p.published_at)) : "—"}</td>
</tr>`;
        })
        .join("")
    : "";

  const table = pieces.length
    ? `<table class="lib-table">
  <thead><tr>
    <th class="label">Title</th>
    <th class="label">Kind</th>
    <th class="label">Fed the fabric</th>
    <th class="label">Status</th>
    <th class="label">Date</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`
    : emptyState(
        "No documents yet. Once research reports are dropped into the Library, every one will land here with what it fed showing in its row.",
      );

  // The research-weight band — proof-of-work line that sits between the lede
  // and the table. Sized for skim: large numerals, plain English on the labels.
  const weightBand =
    weight && weight.docs > 0
      ? `<div class="lib-weight">
  <div class="lw-cell"><b>${weight.docs}</b><span>source document${weight.docs === 1 ? "" : "s"}</span></div>
  ${weight.facts > 0 ? `<div class="lw-cell"><b>${weight.facts.toLocaleString()}</b><span>facts extracted</span></div>` : ""}
  ${weight.subjects > 0 ? `<div class="lw-cell"><b>${weight.subjects}</b><span>subject page${weight.subjects === 1 ? "" : "s"} fed</span></div>` : ""}
  ${weight.contested > 0 ? `<div class="lw-cell"><b>${weight.contested}</b><span>contested claim${weight.contested === 1 ? "" : "s"}</span></div>` : ""}
  ${weight.threads > 0 ? `<div class="lw-cell"><b>${weight.threads}</b><span>open thread${weight.threads === 1 ? "" : "s"}</span></div>` : ""}
</div>`
      : "";

  const body = `
<section style="margin-bottom:18px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> The raw research</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 12px;color:var(--ink)">Library</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--ink-2);max-width:680px">
    Every document the rest is built on, kept whole. Each row shows what it fed the record —
    facts extracted, subjects it touched. Working material feeds the record but
    doesn't get its own public page.
  </p>
</section>
${weightBand}
${uploadBanner}
${opStrip}
<section>${sectionHeader(`All material (${pieces.length})`)}${table}</section>
<style>
  .lib-weight {
    display: flex; flex-wrap: wrap;
    gap: 20px 36px;
    padding: 22px 24px;
    margin: 0 0 28px;
    border: 1px solid var(--rule);
    border-radius: 11px;
    background: var(--surface, #fff);
  }
  .lw-cell { display: flex; flex-direction: column; gap: 2px; }
  .lw-cell b {
    font-family: var(--serif);
    font-size: 28px; line-height: 1;
    color: var(--ink);
    font-weight: 600;
  }
  .lw-cell span {
    font-size: 12.5px;
    color: var(--ink-3);
    letter-spacing: .02em;
  }
  .lib-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-family: var(--serif); }
  .lib-table th { text-align: left; padding: 10px 14px 10px 0; border-bottom: 1px solid var(--rule); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); font-weight: 600; }
  .lib-table td { padding: 14px 14px 14px 0; border-bottom: 1px solid var(--rule-soft, var(--rule)); vertical-align: top; font-size: 15px; line-height: 1.4; }
  .lib-table td.coord { font-family: var(--mono); font-size: 12.5px; color: var(--ink-3); }
  .lib-table tr:hover td { background: rgba(0,0,0,0.015); }
  .lib-fed { color: var(--ink-2); font-size: 13.5px; }
  .lib-fed b { color: var(--ink); font-weight: 600; }
  .lib-fed-quiet { color: var(--ink-3); font-style: italic; font-size: 13px; }
  .lib-title-raw { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); margin-top: 3px; word-break: break-all; }
</style>
`;
  return renderPage({
    title: "Library",
    description:
      "Every source document the rest is built on. Each row shows what it fed the record — facts extracted, subjects it touched.",
    body,
    activeNav: "/library",
    zone: "library",
  });
}
