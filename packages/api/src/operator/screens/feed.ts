// Feed — the front door. Drop research reports; the system digests them
// automatically and the graph grows. No confirmation gauntlets.
//
// P1 ships the real backend: POST /op/feed/upload runs the five-step
// digestion pipeline (digestion.ts) and writes orchestrator_events rows
// for each step. This screen reads those events to render:
//   - a dropzone shell (POSTs to /op/feed/upload)
//   - a digestion-theater card for the most recent in-flight or recently
//     completed upload (the operator can ?digested=<slug>-pinned focus)
//   - a live activity log showing the 5-step trail for every digested doc

import { all, one } from "../../lib/d1";
import { escapeAttr, escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { renderOpPage } from "../layout";

interface EventRow {
  id: string;
  event_type: string;
  subject_kind: string | null;
  subject_id: string | null;
  payload: string;
  created_at: string;
}

interface RecentDigestion {
  piece_id: string;
  piece_slug: string;
  title: string;
  started_at: string;
  steps: Array<{
    step: string;
    state: "started" | "completed" | "failed";
    payload: Record<string, unknown>;
    created_at: string;
  }>;
}

const STEP_LABELS: Record<string, string> = {
  extract_text: "extract text",
  recognize_entities: "recognize entities",
  extract_claims: "extract claims",
  embed: "embed → vectorize",
  detect_chains: "detect chains",
};

const STEP_ORDER = [
  "extract_text",
  "recognize_entities",
  "extract_claims",
  "embed",
  "detect_chains",
];

function parsePayload(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function loadActivity(db: D1Database, userId: string): Promise<EventRow[]> {
  return all<EventRow>(
    db,
    `SELECT id, event_type, subject_kind, subject_id, payload, created_at
       FROM orchestrator_events
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 80`,
    [userId],
  );
}

async function loadRecentDigestion(
  db: D1Database,
  userId: string,
  pieceId: string,
): Promise<RecentDigestion | null> {
  // Pull the 5-step feed.* event trail for one piece (in order).
  const rows = await all<EventRow>(
    db,
    `SELECT id, event_type, subject_kind, subject_id, payload, created_at
       FROM orchestrator_events
      WHERE user_id = ? AND subject_kind = 'piece' AND subject_id = ?
        AND event_type LIKE 'feed.%'
      ORDER BY created_at ASC`,
    [userId, pieceId],
  );
  if (rows.length === 0) return null;
  const piece = await one<{ slug: string; title: string }>(
    db,
    "SELECT slug, title FROM pieces WHERE id = ? AND user_id = ?",
    [pieceId, userId],
  );
  if (!piece) return null;
  return {
    piece_id: pieceId,
    piece_slug: piece.slug,
    title: piece.title,
    started_at: rows[0]?.created_at ?? "",
    steps: rows.map((r) => {
      const parts = r.event_type.split(".");
      return {
        step: parts[1] ?? "",
        state: (parts[2] ?? "started") as "started" | "completed" | "failed",
        payload: parsePayload(r.payload),
        created_at: r.created_at,
      };
    }),
  };
}

// Map an event_type to the activity-log tag class.
function tagFor(eventType: string): { cls: string; label: string } {
  if (eventType.startsWith("feed.")) {
    if (eventType.endsWith(".failed")) return { cls: "lt-promote", label: "failed" };
    if (eventType.includes("detect_chains")) return { cls: "lt-chain", label: "chain" };
    if (eventType.includes("extract_claims")) return { cls: "lt-synth", label: "claims" };
    return { cls: "lt-ingest", label: "ingest" };
  }
  if (eventType === "role.completed") return { cls: "lt-synth", label: "role" };
  if (eventType === "role.failed") return { cls: "lt-promote", label: "failed" };
  if (eventType.startsWith("cascade.")) return { cls: "lt-ingest", label: "cascade" };
  if (eventType.startsWith("character.")) return { cls: "lt-promote", label: "character" };
  if (eventType === "worker_error") return { cls: "lt-error", label: "error" };
  return { cls: "lt-ingest", label: "event" };
}

function describeEvent(row: EventRow): string {
  const payload = parsePayload(row.payload);
  const slug = (payload.piece_slug as string | undefined) ?? "";
  const slugBit = slug ? `<b>${escapeHtml(slug)}</b>` : "";
  if (row.event_type === "feed.extract_text.completed") {
    return `${slugBit} <b>extract text</b> · ${String(payload.chars ?? 0)} chars`;
  }
  if (row.event_type === "feed.recognize_entities.completed") {
    return `${slugBit} <b>recognize entities</b> · ${String(payload.entities_proposed ?? 0)} proposed`;
  }
  if (row.event_type === "feed.extract_claims.completed") {
    return `${slugBit} <b>extract claims</b> · ${String(payload.claims_drafted ?? 0)} drafted`;
  }
  if (row.event_type === "feed.embed.completed") {
    return `${slugBit} <b>embed</b> · vector landed (${String(payload.dims ?? 0)} dims)`;
  }
  if (row.event_type === "feed.detect_chains.completed") {
    const action = String(payload.action ?? "");
    if (action === "extends") {
      return `${slugBit} <b>extends chain</b> · ${escapeHtml(String(payload.chain_id ?? ""))} (score ${formatScore(payload.score)})`;
    }
    if (action === "duplicate") {
      return `${slugBit} <b>duplicate detected</b> · against ${escapeHtml(String(payload.against ?? "").slice(0, 8))} (${formatScore(payload.score)})`;
    }
    if (action === "related") {
      return `${slugBit} <b>related</b> · score ${formatScore(payload.score)}`;
    }
    return `${slugBit} <b>standalone</b> · no near-duplicate match`;
  }
  if (row.event_type.endsWith(".failed")) {
    return `${slugBit} <b>${escapeHtml(row.event_type.split(".")[1] ?? "")}</b> failed · ${escapeHtml(String(payload.error ?? "unknown"))}`;
  }
  if (row.event_type === "role.completed") {
    return `<b>${escapeHtml(String(payload.role_name ?? "role"))}</b> completed`;
  }
  if (row.event_type === "cascade.started") {
    return `<b>cascade</b> started · ${escapeHtml(String(payload.trigger ?? ""))}`;
  }
  if (row.event_type === "cascade.completed") {
    return "<b>cascade</b> completed";
  }
  if (row.event_type === "worker_error") {
    const method = escapeHtml(String(payload.method ?? ""));
    const path = escapeHtml(String(payload.path ?? ""));
    const msg = escapeHtml(String(payload.message ?? "unknown error"));
    const name = payload.name
      ? `<span class="mono" style="color:var(--c-contra)">${escapeHtml(String(payload.name))}</span> `
      : "";
    return `${name}<b>${method} ${path}</b> · ${msg}`;
  }
  return escapeHtml(row.event_type);
}

function formatScore(s: unknown): string {
  if (typeof s !== "number") return "—";
  return s.toFixed(2);
}

function ago(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86_400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86_400)}d`;
}

function dropzone(): string {
  return `<form method="POST" action="/op/feed/upload" enctype="multipart/form-data" id="feed-form">
  <label class="dropzone" for="feed-file" id="dz-label">
    <div class="dz-ico">
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
        <path d="M8 11V3.5M5 6l3-3 3 3" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 11.5v1.5a1 1 0 001 1h8a1 1 0 001-1v-1.5" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="dz-1">Drop documents here</div>
    <div class="dz-2">Markdown · plain text · PDF · .zip of any of these</div>
    <div class="dz-3">Documents land in the Vault — safely stored, hashed, and indexed. Run extraction from <a href="/op/library" style="color:var(--amber-hi)">Library</a> when you're ready; nothing fires automatically.</div>
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
    // DO NOT disable the input before submit — disabled form controls are
    // omitted from the form payload, so the server sees no file field.
    // The label being hidden already prevents a re-click; flag the form
    // itself to guard against accidental double-submit.
    if (form.dataset.submitting === "1") return;
    form.dataset.submitting = "1";
    form.submit();
  });
})();
</script>`;
}

function digestionTheater(d: RecentDigestion): string {
  // Build a sequential 5-step view. For each step, look at what landed:
  //   * any "failed" → status "fail"
  //   * any "completed" → status "done"
  //   * any "started" but no completion yet → "run"
  //   * nothing yet → "pending"
  const stateByStep = new Map<
    string,
    { state: "pending" | "run" | "done" | "fail"; payload: Record<string, unknown> }
  >();
  for (const step of STEP_ORDER) {
    stateByStep.set(step, { state: "pending", payload: {} });
  }
  for (const event of d.steps) {
    const cur = stateByStep.get(event.step) ?? { state: "pending" as const, payload: {} };
    if (event.state === "failed")
      stateByStep.set(event.step, { state: "fail", payload: event.payload });
    else if (event.state === "completed")
      stateByStep.set(event.step, { state: "done", payload: event.payload });
    else if (event.state === "started" && cur.state === "pending")
      stateByStep.set(event.step, { state: "run", payload: event.payload });
  }
  const doneCount = [...stateByStep.values()].filter((s) => s.state === "done").length;
  const failed = [...stateByStep.values()].find((s) => s.state === "fail");
  const allDone = doneCount === STEP_ORDER.length && !failed;
  const progress = (doneCount / STEP_ORDER.length) * 100;

  const stepsHtml = STEP_ORDER.map((step) => {
    const s = stateByStep.get(step) ?? { state: "pending" as const, payload: {} };
    const cls =
      s.state === "done" ? "done" : s.state === "run" ? "run" : s.state === "fail" ? "done" : "";
    const ringOrCheck =
      s.state === "done"
        ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3.5 8.5l3 3 6-6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : `<span class="ring"></span>`;
    const result = stepResultLine(step, s.state, s.payload);
    return `<div class="dstep ${cls}">
  <span class="di">${ringOrCheck}</span>
  <span class="dlabel">${escapeHtml(STEP_LABELS[step] ?? step)}</span>
  <span class="dresult">${result}</span>
</div>`;
  }).join("");

  const headStatus = failed
    ? `<span class="dh-status">failed</span>`
    : allDone
      ? `<span class="dh-status ok">digested</span>`
      : `<span class="dh-status">digesting…</span>`;
  const headIcon = allDone
    ? `<svg class="done-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3.5 8.5l3 3 6-6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<span class="spin"></span>`;

  return `<div class="digest">
  <div class="digest-head">
    ${headIcon}
    <span class="dh-name">${escapeHtml(d.title)}</span>
    ${headStatus}
  </div>
  <div class="digest-bar"><i style="transform:scaleX(${(progress / 100).toFixed(3)})"></i></div>
  <div class="digest-steps">${stepsHtml}</div>
</div>`;
}

function stepResultLine(
  step: string,
  state: "pending" | "run" | "done" | "fail",
  payload: Record<string, unknown>,
): string {
  if (state === "pending") return "";
  if (state === "fail") return escapeHtml(String(payload.error ?? "failed"));
  if (state === "run") return "running…";
  // done
  if (step === "extract_text") return `${String(payload.chars ?? 0)} chars`;
  if (step === "recognize_entities")
    return `${String(payload.entities_proposed ?? 0)} entities proposed`;
  if (step === "extract_claims") return `${String(payload.claims_drafted ?? 0)} claims drafted`;
  if (step === "embed") return `${String(payload.dims ?? 0)} dims`;
  if (step === "detect_chains") {
    const action = String(payload.action ?? "");
    if (action === "extends") return `extends ${escapeHtml(String(payload.chain_id ?? ""))}`;
    if (action === "duplicate") return `duplicate · ${formatScore(payload.score)}`;
    if (action === "related") return `related · ${formatScore(payload.score)}`;
    return "standalone";
  }
  return "";
}

function activityLog(events: EventRow[]): string {
  if (events.length === 0) {
    return `<div class="log">
  <div class="log-row" style="border-bottom:none">
    <span class="lago">—</span>
    <span class="ltext">No activity yet. Drop a document above to see the digestion pipeline fire.</span>
  </div>
</div>`;
  }
  const rows = events
    .slice(0, 40)
    .map((event) => {
      const tag = tagFor(event.event_type);
      return `<div class="log-row">
  <span class="lago">${escapeHtml(ago(event.created_at))}</span>
  <span class="ltext">${describeEvent(event)}</span>
  <span class="log-tag ${tag.cls}">${escapeHtml(tag.label)}</span>
</div>`;
    })
    .join("");
  return `<div class="log">${rows}</div>`;
}

interface ProcessingPiece {
  id: string;
  title: string;
  slug: string;
}

// Pieces created in the last 5 minutes that haven't finished digesting yet.
// Drives the live processing panel. Reads from digest_jobs (the source of
// truth) rather than guessing from pieces/events. Includes recently-failed
// jobs (last 10 min) so the operator sees + can retry; jobs older than that
// fall off automatically. Queued + running jobs always appear.
async function loadProcessing(db: D1Database, userId: string): Promise<ProcessingPiece[]> {
  return all<ProcessingPiece>(
    db,
    `SELECT j.piece_id AS id, j.title, j.slug
       FROM digest_jobs j
      WHERE j.user_id = ?
        AND (j.status IN ('queued','running')
             OR (j.status = 'failed' AND j.updated_at >= datetime('now', '-10 minutes')))
      ORDER BY j.created_at DESC
      LIMIT 50`,
    [userId],
  );
}

function processingPanel(pieces: ProcessingPiece[]): string {
  if (pieces.length === 0) return "";
  const rows = pieces
    .map(
      (
        p,
      ) => `<div class="proc-row" data-piece="${escapeAttr(p.id)}" data-slug="${escapeAttr(p.slug)}">
  <span class="proc-spinner"></span>
  <span class="proc-name">${escapeHtml(p.title || p.slug)}</span>
  <span class="proc-step mono" data-role="step">queued</span>
  <span class="proc-claims mono" data-role="claims" hidden></span>
</div>`,
    )
    .join("");
  return `<div class="proc-card" id="proc-card" style="margin-bottom:18px">
  <div class="proc-head">
    <span class="livedot"></span>
    <span class="proc-h-title">Processing <b>${pieces.length}</b> document${pieces.length === 1 ? "" : "s"}</span>
    <span class="proc-h-sub mono">extract → entities → claims → embed → chain</span>
  </div>
  <div class="proc-list">${rows}</div>
</div>
<script>
(function () {
  var card = document.getElementById("proc-card");
  if (!card) return;
  var rows = Array.from(card.querySelectorAll(".proc-row"));
  function tick() {
    var pending = 0;
    rows.forEach(function (r) {
      var piece = r.getAttribute("data-piece");
      if (!piece || r.dataset.done === "1") return;
      pending++;
      fetch("/op/feed/status?piece=" + encodeURIComponent(piece), { credentials: "same-origin" })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (j) {
          if (!j) return;
          var stepEl = r.querySelector('[data-role="step"]');
          var claimsEl = r.querySelector('[data-role="claims"]');
          var sp = r.querySelector(".proc-spinner");
          if (stepEl) stepEl.textContent = j.step;
          if (claimsEl && j.claims) {
            claimsEl.textContent = j.claims + " claim" + (j.claims === 1 ? "" : "s");
            claimsEl.removeAttribute("hidden");
          }
          if (j.state === "completed" || j.state === "failed") {
            r.dataset.done = "1";
            r.classList.add("proc-row-done");
            if (sp) sp.classList.add(j.state === "failed" ? "failed" : "done");
            var slug = r.getAttribute("data-slug");
            if (slug && j.state === "completed") {
              var name = r.querySelector(".proc-name");
              if (name) {
                var a = document.createElement("a");
                a.href = "/op/library/" + slug;
                a.textContent = name.textContent;
                name.replaceWith(a);
              }
            }
          }
        })
        .catch(function () {});
    });
    if (pending === 0) clearInterval(handle);
  }
  var handle = setInterval(tick, 2000);
  tick();
})();
</script>`;
}

export async function renderFeedScreen(
  env: { DB: D1Database },
  args: {
    focusPieceId?: string | undefined;
    error?: string | undefined;
    ingested?: string | undefined;
    processing?: string | undefined;
    cleared?: string | undefined;
    dedup?: string | undefined;
    dupes?: string | undefined;
  } = {},
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const [activity, focus, processing] = userId
    ? await Promise.all([
        loadActivity(env.DB, userId),
        args.focusPieceId
          ? loadRecentDigestion(env.DB, userId, args.focusPieceId)
          : Promise.resolve(null),
        loadProcessing(env.DB, userId),
      ])
    : [[] as EventRow[], null as RecentDigestion | null, [] as ProcessingPiece[]];

  const errorBanner = args.error
    ? `<div class="flag" style="margin-bottom:14px">
  <span class="fdot"></span>
  <span class="ftext"><b>Ingest failed:</b> ${escapeHtml(args.error)}</span>
</div>`
    : "";

  const dupesN = args.dupes && /^\d+$/.test(args.dupes) ? Number(args.dupes) : 0;
  const okBanner =
    args.ingested && /^\d+$/.test(args.ingested)
      ? `<div class="okflag" style="margin-bottom:14px">
  <span class="ftext"><b>Ingested ${escapeHtml(args.ingested)} document${args.ingested === "1" ? "" : "s"}</b>${dupesN > 0 ? ` <span class="mono" style="color:var(--mute)">· ${dupesN} were already in the Vault and were skipped (content-hash match)</span>` : ""} · go to Library to extract.</span>
</div>`
      : "";

  const dedupBanner = args.dedup
    ? `<div class="okflag" style="margin-bottom:14px">
  <span class="ftext"><b>Already in the Vault.</b> The file you dropped has the same SHA-256 as an existing document — pointing at that one instead of duplicating it.</span>
</div>`
    : "";

  const clearedBanner = args.cleared
    ? `<div class="okflag" style="margin-bottom:14px">
  <span class="ftext"><b>Activity log cleared.</b></span>
</div>`
    : "";

  // Strip the transient query params from the URL after a hard render so a
  // manual reload doesn't resurrect a stale banner or processing flag.
  const cleanUrlScript =
    args.error || args.ingested || args.processing || args.cleared || args.dedup
      ? `<script>history.replaceState(null,'', '/op');</script>`
      : "";

  const body = `
${errorBanner}
${okBanner}
${dedupBanner}
${clearedBanner}
${dropzone()}
${cleanUrlScript}

${processingPanel(processing)}

${focus ? `<div style="margin-top:18px">${digestionTheater(focus)}</div>` : ""}

<div class="log-head">
  <span class="eyebrow"><span class="livedot"></span>Activity log</span>
  <span class="undo-hint">every step is logged to <span class="mono">orchestrator_events</span></span>
</div>
${activityLog(activity)}
`;

  return renderOpPage({
    title: "Feed",
    sub: "drop research reports · digest into the graph",
    body,
    activeNav: "/op",
  });
}
