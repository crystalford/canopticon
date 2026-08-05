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
  const stillWorking = project.status === "transcribing" || project.status === "scripting";

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

  const approvedCount = points.filter((p) => p.status === "approved").length;
  const summaryLine = points.length
    ? `<div class="sub" style="margin-bottom:16px">${points.length} point${points.length === 1 ? "" : "s"} found · ${approvedCount} approved</div>`
    : "";

  const body = `
  <div class="h1">${escapeHtml(project.title)}</div>
  <div class="sub">${escapeHtml(project.source_url)}</div>
  <div style="margin:10px 0 20px"><span class="pill ${statusPillClass(project.status)}">${escapeHtml(STATUS_LABEL[project.status] ?? project.status)}</span></div>
  ${errorBlock}
  ${waitingBlock}
  ${summaryLine}
  ${pointsBlock}
`;
  return htmlPage({
    title: project.title,
    body,
    ...(stillWorking ? { refreshSeconds: 8 } : {}),
  });
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

  return `<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
    <div class="k">${p.start_s.toFixed(1)}s–${p.end_s.toFixed(1)}s</div>
    ${statusTag}
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
</div>`;
}
