// Library — the full document archive.
//
// Stats bar (live counts), search input (P3 wires the keyword filter),
// chain filter chips, and the bordered list with chain sub-headers
// + expandable detail rows. Per the design's §4 spec.

import { all } from "../../lib/d1";
import { escapeAttr, escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { icon, renderOpPage } from "../layout";

interface PieceListRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  kind: string;
  publication_status: string;
  chain_id: string | null;
  byline: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  body_md: string | null;
  metadata: string | null;
  // Typed-graph rows extracted from this piece (nodes.piece_id, kind!='source').
  node_count: number;
  // Latest digest_jobs row for this piece, if any. Null when never extracted.
  digest_status: string | null;
}

interface Stats {
  documents: number;
  nodes: number;
  quotes: number;
  chains: number;
  published: number;
  working: number;
}

async function loadStats(db: D1Database, userId: string): Promise<Stats> {
  const scalar = async (sql: string, binds: unknown[]): Promise<number> => {
    const row = await db
      .prepare(sql)
      .bind(...binds)
      .first<{ n: number }>()
      .catch(() => null);
    return row?.n ?? 0;
  };
  const [documents, nodes, quotes, chains, published, working] = await Promise.all([
    scalar("SELECT count(*) AS n FROM pieces WHERE user_id = ?", [userId]),
    // Typed-graph extraction output (spec Part 4) — the real measure of what
    // the system has understood. Source-kind nodes are bookkeeping, not signal.
    scalar("SELECT count(*) AS n FROM nodes WHERE user_id = ? AND kind != 'source'", [userId]),
    scalar("SELECT count(*) AS n FROM quotes WHERE user_id = ?", [userId]),
    scalar(
      "SELECT count(DISTINCT chain_id) AS n FROM pieces WHERE user_id = ? AND chain_id IS NOT NULL",
      [userId],
    ),
    scalar(
      "SELECT count(*) AS n FROM pieces WHERE user_id = ? AND publication_status IN ('published','canonical')",
      [userId],
    ),
    scalar(
      "SELECT count(*) AS n FROM pieces WHERE user_id = ? AND publication_status = 'working-material'",
      [userId],
    ),
  ]);
  return { documents, nodes, quotes, chains, published, working };
}

interface JobProgress {
  queued: number;
  running: number;
  completed: number;
  failed: number;
}

// Live extraction progress for the strip — counts across all digest jobs.
async function loadJobProgress(db: D1Database, userId: string): Promise<JobProgress> {
  const rows = await all<{ status: string; n: number }>(
    db,
    "SELECT status, COUNT(*) AS n FROM digest_jobs WHERE user_id = ? GROUP BY status",
    [userId],
  ).catch(() => []);
  const out: JobProgress = { queued: 0, running: 0, completed: 0, failed: 0 };
  for (const r of rows) {
    if (r.status === "queued") out.queued = r.n;
    else if (r.status === "running") out.running = r.n;
    else if (r.status === "completed") out.completed = r.n;
    else if (r.status === "failed") out.failed = r.n;
  }
  return out;
}

async function loadDocuments(db: D1Database, userId: string): Promise<PieceListRow[]> {
  // The digest_status sub-select prefers the latest job's status so a row
  // accurately reflects "stored / extracting / extracted / failed". When no
  // digest_jobs row exists yet, status is NULL → rendered as "stored".
  return all<PieceListRow>(
    db,
    `SELECT p.id, p.slug, p.title, p.subtitle, p.kind, p.publication_status,
            p.chain_id, p.byline, p.published_at, p.created_at, p.updated_at,
            p.body_md, p.metadata,
            (SELECT COUNT(*) FROM nodes n
              WHERE n.piece_id = p.id AND n.kind != 'source') AS node_count,
            (SELECT j.status FROM digest_jobs j
              WHERE j.user_id = p.user_id AND j.piece_id = p.id
              ORDER BY j.created_at DESC LIMIT 1) AS digest_status
       FROM pieces p
      WHERE p.user_id = ?
      ORDER BY p.chain_id IS NULL, p.chain_id, COALESCE(p.published_at, p.updated_at, p.created_at) DESC
      LIMIT 200`,
    [userId],
  );
}

function statusInfo(status: string): { cls: string; label: string } {
  if (status === "canonical") return { cls: "published", label: "canonical" };
  if (status === "published") return { cls: "published", label: "published" };
  return { cls: "working", label: "working" };
}

function relativeAge(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 86_400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86_400)}d`;
}

function extractionInfo(status: string | null): { cls: string; label: string } {
  if (status === "completed") return { cls: "extracted", label: "extracted" };
  if (status === "running") return { cls: "extracting", label: "extracting…" };
  if (status === "queued") return { cls: "extracting", label: "queued" };
  if (status === "failed") return { cls: "failed", label: "failed" };
  return { cls: "stored", label: "stored" };
}

// "Extract" button rendered when the piece has no completed digest_jobs row
// — i.e. it's only in the Vault. The button uses the HTML form= attribute to
// target a per-row <form> rendered OUTSIDE the bulk-delete form (forms can't
// nest). All per-row forms are appended together below the list.
function extractCellFor(p: PieceListRow): string {
  if (p.digest_status === "completed") return `<span class="lib-doc-extract-done mono">✓</span>`;
  if (p.digest_status === "running" || p.digest_status === "queued") {
    return `<span class="lib-doc-extract-done mono">…</span>`;
  }
  const label = p.digest_status === "failed" ? "Retry" : "Extract";
  return `<button type="submit" form="lib-extract-form-${escapeAttr(p.id)}" class="btn btn-amber lib-doc-extract">${label}</button>`;
}

function extractFormsFor(docs: PieceListRow[]): string {
  return docs
    .filter(
      (d) =>
        d.digest_status !== "completed" &&
        d.digest_status !== "running" &&
        d.digest_status !== "queued",
    )
    .map(
      (d) =>
        `<form id="lib-extract-form-${escapeAttr(d.id)}" method="POST" action="/op/library/extract" style="display:none"><input type="hidden" name="piece_ids" value="${escapeAttr(d.id)}" /></form>`,
    )
    .join("");
}

function pieceRow(p: PieceListRow): string {
  const s = statusInfo(p.publication_status);
  const x = extractionInfo(p.digest_status);
  const titleOrSlug = p.title?.trim() || p.slug;
  const searchText = `${titleOrSlug} ${p.kind} ${p.chain_id ?? ""}`.toLowerCase();
  return `<div class="lib-doc" data-status="${s.cls}" data-chain="${escapeAttr(p.chain_id ?? "")}" data-search="${escapeAttr(searchText)}">
  <label class="lib-doc-check"><input type="checkbox" name="piece_ids" value="${escapeAttr(p.id)}" form="lib-bulk-form" /></label>
  <span class="lib-dot ${s.cls}"></span>
  <a class="lib-doc-name" href="/op/library/${escapeAttr(p.slug)}">${escapeHtml(titleOrSlug)}</a>
  <span class="lib-doc-kind">${escapeHtml(p.kind)}</span>
  <span class="lib-doc-extract-pill ${x.cls} mono" title="extraction status">${escapeHtml(x.label)}</span>
  <span class="lib-doc-claims">${p.node_count} nodes</span>
  <span class="lib-doc-date">${escapeHtml(relativeAge(p.published_at ?? p.updated_at))}</span>
  ${extractCellFor(p)}
  <a class="mono lib-doc-arrow" href="/op/library/${escapeAttr(p.slug)}">→</a>
</div>`;
}

function chainHeader(chainId: string, count: number, claimCount: number): string {
  return `<div class="lib-chain-hd" data-chain="${escapeAttr(chainId)}">
  <span class="lch-arrow">↳</span>
  <span class="lch-name">${escapeHtml(chainId)}</span>
  <span class="lch-count">· ${count} doc${count === 1 ? "" : "s"}</span>
  <span class="lch-claims">${claimCount} nodes</span>
</div>`;
}

// Client-side filter: all docs are already in the DOM (LIMIT 200), so the
// search box + chips filter rows by data-attrs with no server round-trip.
const LIB_FILTER_JS = `<script>
(function () {
  var q = document.getElementById("lib-search-input");
  var chips = document.querySelectorAll(".lib-fchip");
  var rows = document.querySelectorAll(".lib-doc");
  var heads = document.querySelectorAll(".lib-chain-hd");
  var active = "all";
  function apply() {
    var text = ((q && q.value) || "").trim().toLowerCase();
    var shown = {};
    rows.forEach(function (r) {
      var okFilter =
        active === "all" ||
        (active.indexOf("status:") === 0 && r.dataset.status === active.slice(7)) ||
        (active.indexOf("chain:") === 0 && r.dataset.chain === active.slice(6));
      var okText = !text || (r.dataset.search || "").indexOf(text) !== -1;
      var show = okFilter && okText;
      r.style.display = show ? "" : "none";
      if (show) shown[r.dataset.chain || ""] = true;
    });
    heads.forEach(function (h) {
      h.style.display = shown[h.dataset.chain || ""] ? "" : "none";
    });
  }
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      chips.forEach(function (x) { x.classList.remove("on"); });
      c.classList.add("on");
      active = c.dataset.filter || "all";
      apply();
    });
  });
  if (q) q.addEventListener("input", apply);
})();
</script>`;

// Dropzone — moved here from the old Feed surface. Uploads POST to
// /op/feed/upload (route unchanged) and redirect back to /op/library with a
// result banner. Documents bank into the Vault; extraction is triggered from
// the list below.
function dropzone(): string {
  return `<form method="POST" action="/op/feed/upload" enctype="multipart/form-data" id="feed-form" style="margin-bottom:16px">
  <label class="dropzone" for="feed-file" id="dz-label">
    <div class="dz-ico">
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
        <path d="M8 11V3.5M5 6l3-3 3 3" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 11.5v1.5a1 1 0 001 1h8a1 1 0 001-1v-1.5" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="dz-1">Drop documents here</div>
    <div class="dz-2">Markdown · plain text · PDF · .zip of any of these</div>
    <div class="dz-3">Documents bank into the Vault — stored, hashed, indexed. Then hit <b>Extract</b> on a row below to build the graph.</div>
    <input type="file" id="feed-file" name="file" accept=".md,.txt,.pdf,.zip,text/markdown,text/plain,application/pdf,application/zip,application/x-zip-compressed" required style="display:none" />
  </label>
  <div class="dz-uploading" id="dz-uploading" hidden>
    <span class="dz-spinner"></span>
    <span class="dz-up-text"><b>Uploading…</b> banking in the Vault. You can leave this page.</span>
  </div>
</form>
<script>
(function () {
  var form = document.getElementById("feed-form");
  var input = document.getElementById("feed-file");
  var label = document.getElementById("dz-label");
  var busy = document.getElementById("dz-uploading");
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
}

// Banner for the upload result query params that the /feed/upload route
// redirects back with (piece / dedup / ingested / error / cleared).
function uploadBanner(args: LibraryArgs): string {
  if (args.error) {
    return `<div class="flag" style="margin-bottom:14px"><span class="fdot"></span><span class="ftext"><b>Upload failed:</b> ${escapeHtml(args.error)}</span></div>`;
  }
  if (args.dedup && args.piece) {
    return `<div class="okflag" style="margin-bottom:14px"><span class="ftext"><b>Already in the Vault.</b> That file has the same SHA-256 as an existing document — pointing at that one instead of duplicating it.</span></div>`;
  }
  if (args.piece) {
    return `<div class="okflag" style="margin-bottom:14px"><span class="ftext"><b>Banked.</b> Document stored in the Vault — hit <b>Extract</b> on its row to build the graph.</span></div>`;
  }
  if (args.ingested && /^\d+$/.test(args.ingested)) {
    const dupes =
      args.dupes && /^\d+$/.test(args.dupes) ? ` · ${args.dupes} duplicate(s) skipped` : "";
    return `<div class="okflag" style="margin-bottom:14px"><span class="ftext"><b>Banked ${escapeHtml(args.ingested)} document(s).</b>${dupes} Extract them below.</span></div>`;
  }
  return "";
}

interface LibraryArgs {
  extracting?: string | undefined;
  piece?: string | undefined;
  dedup?: string | undefined;
  ingested?: string | undefined;
  dupes?: string | undefined;
  error?: string | undefined;
  cleared?: string | undefined;
}

export async function renderLibraryScreen(
  env: { DB: D1Database },
  args: LibraryArgs = {},
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const stats = userId
    ? await loadStats(env.DB, userId)
    : { documents: 0, nodes: 0, quotes: 0, chains: 0, published: 0, working: 0 };
  const docs = userId ? await loadDocuments(env.DB, userId) : [];
  const progress = userId
    ? await loadJobProgress(env.DB, userId)
    : { queued: 0, running: 0, completed: 0, failed: 0 };

  // Group by chain.
  const chained = new Map<string, PieceListRow[]>();
  const standalone: PieceListRow[] = [];
  for (const d of docs) {
    if (d.chain_id) {
      const list = chained.get(d.chain_id) ?? [];
      list.push(d);
      chained.set(d.chain_id, list);
    } else {
      standalone.push(d);
    }
  }

  const statsBar = `<div class="lib-stats">
  <div class="lib-stat"><div class="ls-n">${stats.documents}</div><div class="ls-l">Documents</div></div>
  <div class="lib-sep"></div>
  <div class="lib-stat"><div class="ls-n">${stats.nodes}</div><div class="ls-l">Graph nodes</div></div>\n  <div class="lib-sep"></div>\n  <div class="lib-stat"><div class="ls-n">${stats.quotes}</div><div class="ls-l">Quotes</div></div>
  <div class="lib-sep"></div>
  <div class="lib-stat"><div class="ls-n">${stats.chains}</div><div class="ls-l">Chains</div></div>
  <div class="lib-sep"></div>
  <div class="lib-stat"><div class="ls-n" style="color:var(--c-thesis)">${stats.published}</div><div class="ls-l">Published</div></div>
  <div class="lib-sep"></div>
  <div class="lib-stat"><div class="ls-n" style="color:var(--amber)">${stats.working}</div><div class="ls-l">Working</div></div>
</div>`;

  const search = `<div class="lib-search" style="margin-bottom:14px">
  ${icon("search")}
  <input id="lib-search-input" class="lib-search-input" type="search" placeholder="Search documents, chains, entities…" />
</div>`;

  const chainSlugs = [...chained.keys()].sort();
  const filterChips = `<div class="lib-filters" style="margin-bottom:16px">
  <button class="lib-fchip on" data-filter="all">All <span class="mono" style="font-size:10px;color:var(--faint);margin-left:6px">${stats.documents}</span></button>
  <button class="lib-fchip" data-filter="status:published">Published <span class="mono" style="font-size:10px;color:var(--faint);margin-left:6px">${stats.published}</span></button>
  <button class="lib-fchip" data-filter="status:working">Working <span class="mono" style="font-size:10px;color:var(--faint);margin-left:6px">${stats.working}</span></button>
  ${chainSlugs
    .slice(0, 12)
    .map((chainId) => {
      const c = chained.get(chainId)?.length ?? 0;
      return `<button class="lib-fchip" data-filter="chain:${escapeAttr(chainId)}">${escapeHtml(chainId)} <span class="mono" style="font-size:10px;color:var(--faint);margin-left:6px">${c}</span></button>`;
    })
    .join("")}
</div>`;

  let listInner = "";
  for (const chainId of chainSlugs) {
    const group = chained.get(chainId) ?? [];
    const claimSum = group.reduce((s, p) => s + p.node_count, 0);
    listInner += chainHeader(chainId, group.length, claimSum);
    listInner += group.map(pieceRow).join("");
  }
  if (standalone.length > 0 && chainSlugs.length > 0) {
    listInner += `<div class="lib-chain-hd" data-chain=""><span class="lch-arrow">↳</span><span class="lch-name">standalone</span><span class="lch-count">· ${standalone.length} doc${standalone.length === 1 ? "" : "s"}</span></div>`;
  }
  listInner += standalone.map(pieceRow).join("");

  const list = docs.length
    ? `<form id="lib-bulk-form" method="POST" action="/op/library/delete">
  <div class="lib-list">${listInner}</div>
  <div class="lib-bulk-bar" id="lib-bulk-bar">
    <label class="lib-bulk-all"><input type="checkbox" id="lib-check-all" /> Select all visible</label>
    <span class="lib-bulk-count" id="lib-bulk-count">0 selected</span>
    <button type="submit" name="mode" value="selected" class="btn btn-danger" id="lib-bulk-delete" disabled onclick="return confirm('Delete the selected documents? Claims, entities, and sources tied to them will be removed too. This cannot be undone.');">Delete selected</button>
    <button type="submit" name="mode" value="all" class="btn btn-danger-ghost" onclick="return confirm('Wipe the ENTIRE corpus — every document, claim, entity, source, pattern, and orchestrator event for this operator. The studio skeleton, briefs, and chat history are kept. This cannot be undone.');">Delete all documents</button>
  </div>
</form>`
    : `<div class="lib-list"><div class="lib-empty">No documents yet. Drop research reports in the box above — they bank into the Vault, then you extract them into the graph.</div></div>`;

  const unextractedCount = docs.filter(
    (d) =>
      d.digest_status !== "completed" &&
      d.digest_status !== "running" &&
      d.digest_status !== "queued",
  ).length;
  const extractAllForm =
    unextractedCount > 0
      ? `<form method="POST" action="/op/library/extract" style="display:inline">
  <input type="hidden" name="mode" value="all-unextracted" />
  <button type="submit" class="btn btn-amber" title="Extract every document that has no completed extraction yet">
    ${icon("spark")} Extract all (${unextractedCount})
  </button>
</form>`
      : "";
  const topbarActions = extractAllForm;

  // Per-row extract forms sit outside the bulk-delete form (HTML forms can't
  // nest). The row buttons reference them by id.
  const extractForms = extractFormsFor(docs);

  // Surface a one-shot "extracting N" banner after the /library/extract POST.
  const extractingN = args.extracting && /^\d+$/.test(args.extracting) ? args.extracting : null;
  const extractingBanner = extractingN
    ? `<div class="okflag" style="margin-bottom:14px">
  <span class="ftext"><b>Extracting ${escapeHtml(extractingN)} document${extractingN === "1" ? "" : "s"}</b> · the status pills below will update as each completes.</span>
</div>`
    : "";

  // Extraction-in-progress strip: visible whenever work is pending so a
  // 50-document bulk run reads as steady progress, not a hang. The cron
  // drain processes 8 jobs/minute; refresh updates the numbers.
  const active = progress.queued + progress.running;
  const progressStrip =
    active > 0
      ? `<div class="okflag" style="margin-bottom:14px">
  <span class="ftext"><b>Extracting…</b> ${progress.running} running · ${progress.queued} queued · ${progress.completed} done${progress.failed > 0 ? ` · ${progress.failed} failed (Retry on the row)` : ""}.
  The drain works through the queue automatically (~8/min) — safe to leave this page. When the last document finishes, findings and proposals regenerate against the whole corpus.</span>
</div>`
      : "";

  return renderOpPage({
    title: "Library",
    sub: "drop documents · the full archive · extract into the graph",
    topbarActions,
    body: `${uploadBanner(args)}${progressStrip}${extractingBanner}${dropzone()}${statsBar}${search}${filterChips}${list}${extractForms}${LIB_FILTER_JS}${LIB_BULK_JS}`,
    activeNav: "/op/library",
    width: "wide",
  });
}

// Bulk-selection helper: keeps the count badge live and toggles the
// "Delete selected" button's disabled state. The "Select all visible"
// checkbox only ticks rows currently shown (filter-aware).
const LIB_BULK_JS = `<script>
(function () {
  var form = document.getElementById("lib-bulk-form");
  if (!form) return;
  var countEl = document.getElementById("lib-bulk-count");
  var btn = document.getElementById("lib-bulk-delete");
  var all = document.getElementById("lib-check-all");
  function refresh() {
    var n = form.querySelectorAll('input[name="piece_ids"]:checked').length;
    if (countEl) countEl.textContent = n + " selected";
    if (btn) btn.disabled = n === 0;
  }
  form.addEventListener("change", refresh);
  if (all) all.addEventListener("change", function () {
    form.querySelectorAll('input[name="piece_ids"]').forEach(function (cb) {
      var row = cb.closest(".lib-doc");
      if (row && row.style.display !== "none") cb.checked = all.checked;
    });
    refresh();
  });
  refresh();
})();
</script>`;
