// /react pages — the reaction-video tool's project list + scripting
// review surface. Same string-concatenation HTML discipline as the rest
// of this Worker's pages/ (shell.ts).

import type { ReactPointRow, ReactProjectRow } from "../react/db";
import { escapeAttr, escapeHtml, htmlPage } from "./shell";

const STATUS_LABEL: Record<string, string> = {
  transcribing: "transcribing",
  ready_for_scripting: "ready for scripting",
  scripting: "segmenting into points",
  ready_to_record: "ready to record",
  recording: "recording",
  stitching: "stitching",
  rendered: "rendered — awaiting approval",
  published: "published",
  failed: "failed",
};

function statusPillClass(status: string): string {
  if (status === "failed") return "failed";
  if (status === "published" || status === "rendered") return "succeeded";
  if (status === "transcribing" || status === "scripting" || status === "stitching")
    return "running";
  return "queued";
}

// ---------------------------------------------------------------------------
// List page
// ---------------------------------------------------------------------------
export function renderReactListPage(args: { projects: ReactProjectRow[] }): Response {
  const { projects } = args;
  const newForm = `<div class="card">
  <div class="k">new project</div>
  <form method="POST" action="/react/projects" style="margin-top:10px;display:flex;flex-direction:column;gap:10px;max-width:560px">
    <input type="text" name="title" placeholder="Title — e.g. 'Freeland on the Economist'" required
      style="font-family:var(--serif);font-size:15px;padding:9px 12px;border:1px solid var(--rule);border-radius:8px">
    <input type="url" name="source_url" placeholder="Source video URL (YouTube, network site, etc.)" required
      style="font-family:var(--mono);font-size:13px;padding:9px 12px;border:1px solid var(--rule);border-radius:8px">
    <button class="btn" type="submit" style="align-self:flex-start">Transcribe + find points →</button>
  </form>
</div>`;

  const rows = projects.length
    ? projects
        .map(
          (
            p,
          ) => `<div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:14px">
  <div>
    <a href="/react/projects/${escapeAttr(p.id)}" style="color:var(--ink);text-decoration:none;font-size:17px">${escapeHtml(p.title)}</a>
    <div class="sub" style="margin:4px 0 0">${escapeHtml(p.source_url.slice(0, 70))}</div>
  </div>
  <span class="pill ${statusPillClass(p.status)}">${escapeHtml(STATUS_LABEL[p.status] ?? p.status)}</span>
</div>`,
        )
        .join("")
    : `<div class="card"><div class="v empty">No projects yet — paste a source video URL above to start.</div></div>`;

  const body = `
  <div class="h1">Reaction videos</div>
  <div class="sub">standalone content tool · point-by-point reaction scripting + recording</div>
  ${newForm}
  ${rows}
`;
  return htmlPage({ title: "Reaction videos", body });
}

// ---------------------------------------------------------------------------
// Detail / review page
// ---------------------------------------------------------------------------
export function renderReactDetailPage(args: {
  project: ReactProjectRow;
  points: ReactPointRow[];
}): Response {
  const { project, points } = args;
  const stillWorking =
    project.status === "transcribing" ||
    project.status === "scripting" ||
    project.status === "stitching";

  const errorBlock = project.error ? `<pre class="err">${escapeHtml(project.error)}</pre>` : "";

  const waitingBlock = stillWorking
    ? `<div class="card"><div class="v empty">${escapeHtml(STATUS_LABEL[project.status] ?? project.status)}… this page refreshes automatically.</div></div>`
    : "";

  const pointsBlock = points.length
    ? points.map((p) => renderPointCard(project, p)).join("")
    : project.status === "ready_for_scripting" || project.status === "scripting"
      ? ""
      : project.status === "failed"
        ? ""
        : `<div class="card"><div class="v empty">No points yet.</div></div>`;

  const approved = points.filter((p) => p.status === "approved");
  const recorded = approved.filter((p) => p.reaction_r2_key);
  const summaryLine = points.length
    ? `<div class="sub" style="margin-bottom:16px">${points.length} point${points.length === 1 ? "" : "s"} found · ${approved.length} approved · ${recorded.length} recorded</div>`
    : "";

  const stitchBlock = renderStitchBlock(project, approved.length, recorded.length);

  const body = `
  <div class="h1">${escapeHtml(project.title)}</div>
  <div class="sub">${escapeHtml(project.source_url)}</div>
  <div style="margin:10px 0 20px"><span class="pill ${statusPillClass(project.status)}">${escapeHtml(STATUS_LABEL[project.status] ?? project.status)}</span></div>
  ${errorBlock}
  ${waitingBlock}
  ${stitchBlock}
  ${summaryLine}
  ${pointsBlock}
`;
  return htmlPage({
    title: project.title,
    body,
    ...(stillWorking ? { refreshSeconds: 8 } : {}),
  });
}

// ---------------------------------------------------------------------------
// Stitch + two-gate publish controls. "Rendering succeeded" and "approved
// for publication" are separate gates (same rule as the GDELT/reading
// pipeline's segments.published_at) — a render lands as 'rendered' and
// stays operator-only until both /approve and /publish are clicked.
// ---------------------------------------------------------------------------
function renderStitchBlock(
  project: ReactProjectRow,
  approvedCount: number,
  recordedCount: number,
): string {
  if (project.status === "rendered" || project.status === "published") {
    const videoUrl = project.stitched_r2_key
      ? `/assets/${encodeURIComponent(project.stitched_r2_key)}`
      : null;
    const player = videoUrl
      ? `<video controls src="${escapeAttr(videoUrl)}" style="width:100%;max-width:420px;border-radius:8px;margin-bottom:14px"></video>`
      : "";
    const actions =
      project.status === "published"
        ? `<span class="pill succeeded">published</span>`
        : project.approved_at
          ? `<form method="POST" action="/react/projects/${escapeAttr(project.id)}/publish" style="display:inline">
              <button class="btn" type="submit">Publish →</button>
            </form>`
          : `<form method="POST" action="/react/projects/${escapeAttr(project.id)}/approve" style="display:inline">
              <button class="btn" type="submit" style="background:#fff;color:var(--ink);border:1px solid var(--rule)">Approve render</button>
            </form>`;
    return `<div class="card">
  <div class="k">stitched render</div>
  <div style="margin-top:10px">${player}</div>
  ${actions}
</div>`;
  }

  if (approvedCount < 2) return "";
  const ready = recordedCount === approvedCount;
  return `<div class="card">
  <div class="k">stitch</div>
  <div class="sub" style="margin:6px 0 12px">${recordedCount}/${approvedCount} approved points have a recorded reaction</div>
  <form method="POST" action="/react/projects/${escapeAttr(project.id)}/stitch">
    <button class="btn" type="submit" ${ready ? "" : "disabled"}>Stitch into final video →</button>
  </form>
</div>`;
}

function renderPointCard(project: ReactProjectRow, p: ReactPointRow): string {
  const angleLine =
    p.suggested_angle_kind && p.suggested_angle_kind !== "none" && p.suggested_angle_text
      ? `<div class="k" style="margin-top:10px">suggested ${escapeHtml(p.suggested_angle_kind === "fact_check" ? "fact-check" : "fallacy-check")} angle ${
          p.angle_judge_pass === 1
            ? `<span class="pill succeeded" style="margin-left:6px">judge: coherent</span>`
            : p.angle_judge_pass === 0
              ? `<span class="pill failed" style="margin-left:6px">judge: rejected</span>`
              : ""
        }</div>
  <div class="v" style="font-size:15px;font-style:italic">${escapeHtml(p.suggested_angle_text)}</div>
  ${p.angle_judge_notes ? `<div class="sub" style="margin-top:2px">${escapeHtml(p.angle_judge_notes)}</div>` : ""}`
      : "";

  const statusTag =
    p.status === "approved"
      ? `<span class="pill succeeded">approved</span>`
      : p.status === "skipped"
        ? `<span class="pill" style="background:rgba(0,0,0,.06);color:var(--ink-3)">skipped</span>`
        : `<span class="pill queued">pending</span>`;

  const recordedTag = p.reaction_r2_key
    ? `<span class="pill succeeded">recorded${p.reaction_duration_ms ? ` · ${(p.reaction_duration_ms / 1000).toFixed(0)}s` : ""}</span>`
    : "";

  const recordLink =
    p.status === "approved"
      ? `<a href="/react/projects/${escapeAttr(project.id)}/points/${escapeAttr(p.id)}/record" class="btn" style="background:${p.reaction_r2_key ? "#fff" : "var(--amber)"};color:var(--ink);border:1px solid var(--rule);margin-top:10px;display:inline-block">${p.reaction_r2_key ? "Re-record" : "⏺ Record reaction"}</a>`
      : "";

  return `<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
    <div class="k">${p.start_s.toFixed(1)}s–${p.end_s.toFixed(1)}s</div>
    <div style="display:flex;gap:6px">${recordedTag}${statusTag}</div>
  </div>
  <div class="v" style="font-size:17px;margin-top:6px">${escapeHtml(p.summary)}</div>
  <div class="sub" style="font-style:italic;margin-top:6px">"${escapeHtml(p.transcript_text.slice(0, 300))}${p.transcript_text.length > 300 ? "…" : ""}"</div>
  ${angleLine}
  <form method="POST" action="/react/projects/${escapeAttr(project.id)}/points/${escapeAttr(p.id)}" style="margin-top:14px;display:flex;flex-direction:column;gap:8px">
    <input type="text" name="summary" value="${escapeAttr(p.summary)}"
      style="font-family:var(--serif);font-size:14px;padding:7px 10px;border:1px solid var(--rule);border-radius:7px">
    <div style="display:flex;gap:14px;align-items:center;font-family:var(--mono);font-size:12px;color:var(--ink-3)">
      <label><input type="radio" name="cue_mode" value="bullets" ${p.cue_mode === "bullets" ? "checked" : ""}> bullets</label>
      <label><input type="radio" name="cue_mode" value="verbatim" ${p.cue_mode === "verbatim" ? "checked" : ""}> verbatim script</label>
    </div>
    <textarea name="cue_text" rows="3" placeholder="Your cue — bullet points to riff on, or a full script to read, depending on the mode above."
      style="font-family:var(--serif);font-size:14px;padding:9px 10px;border:1px solid var(--rule);border-radius:7px">${escapeHtml(p.cue_text ?? p.suggested_angle_text ?? "")}</textarea>
    <div style="display:flex;gap:8px">
      <button class="btn" type="submit" name="action" value="save" style="background:#fff;color:var(--ink);border:1px solid var(--rule)">Save</button>
      <button class="btn" type="submit" name="action" value="approve">Approve</button>
      <button class="btn btn-warn" type="submit" name="action" value="skip">Skip</button>
    </div>
  </form>
  ${recordLink}
</div>`;
}

// ---------------------------------------------------------------------------
// Recording page — full-screen-feeling cue + camera capture. The only
// other place in this Worker that uses client JS is voice.ts (MediaRecorder
// for audio-only samples); this reuses that same discipline for a video+
// audio capture. No PiP, no synced source-clip playback — the operator has
// already watched/scripted the point, so recording is just "press record,
// talk, stop."
// ---------------------------------------------------------------------------
const RECORD_JS = `
const $ = (q) => document.querySelector(q);
let mediaRecorder = null;
let stream = null;
let chunks = [];
let recStart = 0;

async function setup() {
  stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  $('#preview').srcObject = stream;
}

function start() {
  chunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  mediaRecorder.onstop = onStop;
  recStart = Date.now();
  mediaRecorder.start();
  $('#rec').disabled = true;
  $('#stop').disabled = false;
  $('#retake').style.display = 'none';
  $('#status').textContent = 'Recording...';
}

function stop() {
  if (mediaRecorder) mediaRecorder.stop();
  $('#rec').disabled = false;
  $('#stop').disabled = true;
}

async function onStop() {
  const durationMs = Date.now() - recStart;
  const blob = new Blob(chunks, { type: 'video/webm' });
  $('#preview').srcObject = null;
  $('#preview').src = URL.createObjectURL(blob);
  $('#preview').controls = true;
  $('#preview').muted = false;
  $('#retake').style.display = 'inline-block';
  $('#status').textContent = 'Uploading (' + (durationMs / 1000).toFixed(1) + 's)...';
  const res = await fetch(window.location.pathname.replace(/\\/record$/, '/upload') + '?duration_ms=' + durationMs, {
    method: 'POST',
    headers: { 'content-type': 'video/webm' },
    body: blob,
  });
  $('#status').textContent = res.ok ? 'Uploaded ✓' : 'Upload failed: ' + res.status;
}

function retake() {
  $('#preview').src = '';
  $('#preview').controls = false;
  $('#preview').muted = true;
  $('#preview').srcObject = stream;
  $('#retake').style.display = 'none';
  $('#status').textContent = 'Ready.';
}

window.addEventListener('DOMContentLoaded', () => {
  setup();
  $('#rec').addEventListener('click', start);
  $('#stop').addEventListener('click', stop);
  $('#retake').addEventListener('click', retake);
});
`;

export function renderRecordPage(args: {
  project: ReactProjectRow;
  point: ReactPointRow;
}): Response {
  const { project, point } = args;
  const cueText = point.cue_text ?? point.suggested_angle_text ?? "";
  const cueBlock =
    point.cue_mode === "verbatim"
      ? `<div style="font-family:var(--serif);font-size:26px;line-height:1.5">${escapeHtml(cueText)}</div>`
      : `<ul style="font-family:var(--serif);font-size:22px;line-height:1.7;padding-left:22px;margin:0">${cueText
          .split("\n")
          .filter((l) => l.trim())
          .map((l) => `<li>${escapeHtml(l.replace(/^[-*]\s*/, ""))}</li>`)
          .join("")}</ul>`;

  const body = `
  <div class="h1">${escapeHtml(project.title)}</div>
  <div class="sub">${point.start_s.toFixed(1)}s–${point.end_s.toFixed(1)}s · ${escapeHtml(point.cue_mode === "verbatim" ? "verbatim script" : "bullet cue")}</div>

  <div class="card" style="background:#fbf3df">
    ${cueBlock}
  </div>

  <div class="card">
    <video id="preview" autoplay muted playsinline></video>
    <div class="row" style="margin-top:14px">
      <button id="rec" class="btn">⏺ Record</button>
      <button id="stop" class="btn" style="background:#fff;color:var(--ink);border:1px solid var(--rule)" disabled>⏹ Stop &amp; upload</button>
      <button id="retake" class="btn btn-warn" style="display:none">↺ Retake</button>
    </div>
    <div id="status" style="margin-top:12px;font-family:var(--mono);font-size:12px;color:var(--ink-3)">Requesting camera…</div>
  </div>

  <a href="/react/projects/${escapeAttr(project.id)}" style="font-family:var(--mono);font-size:12px;color:var(--ink-3)">← back to points</a>

  <script>${RECORD_JS}</script>
`;
  return htmlPage({ title: `Record — ${point.summary}`, body });
}
