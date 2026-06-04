// Studio — production workspace, Stage 1.
//
// Reasoning lock (skeleton beats + Never list), composer (source +
// medium + Generate), projects shelf. Per-project workspace renders
// the Script tab; Audio/Video/Export tabs show "Stage 2/3 — not yet
// built" empty states per the handoff's explicit deferral.

import { all, one } from "../../lib/d1";
import { escapeAttr, escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { emptyState, icon, renderOpPage } from "../layout";

interface SkeletonRow {
  id: string;
  beats_json: string;
  never_json: string;
  examples_json: string;
  locked_at: string | null;
}
interface ProjectRow {
  id: string;
  title: string;
  medium: string;
  stage: string;
  beats_json: string;
  source_finding_id: string | null;
  created_at: string;
  updated_at: string;
}
interface FindingRow {
  id: string;
  kind: string;
  title: string;
}

const MEDIA: Array<{ key: string; label: string; hint: string }> = [
  { key: "x-thread", label: "X thread", hint: "6–10 beats · ≤280 chars" },
  { key: "tiktok", label: "TikTok", hint: "5–8 beats · spoken" },
  { key: "video-essay", label: "Video essay", hint: "8–14 beats · w/ B-roll" },
  { key: "podcast", label: "Podcast", hint: "8–12 beats · 3–6 sentences" },
  { key: "meme-brief", label: "Meme brief", hint: "4–6 epigrams" },
  { key: "book-chapter", label: "Book chapter", hint: "6–10 sections" },
];

const MEDIUM_LABELS: Record<string, string> = Object.fromEntries(
  MEDIA.map((m) => [m.key, m.label] as const),
);

function parseJsonOr<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

async function loadSkeleton(db: D1Database, userId: string): Promise<SkeletonRow | null> {
  return one<SkeletonRow>(
    db,
    "SELECT id, beats_json, never_json, examples_json, locked_at FROM studio_skeleton WHERE user_id = ?",
    [userId],
  );
}

async function loadProjects(db: D1Database, userId: string): Promise<ProjectRow[]> {
  return all<ProjectRow>(
    db,
    `SELECT id, title, medium, stage, beats_json, source_finding_id, created_at, updated_at
       FROM studio_projects WHERE user_id = ?
      ORDER BY updated_at DESC LIMIT 40`,
    [userId],
  );
}

async function loadFindings(db: D1Database, userId: string): Promise<FindingRow[]> {
  return all<FindingRow>(
    db,
    `SELECT id, kind, title FROM patterns
      WHERE user_id = ? AND status IN ('candidate','signed')
      ORDER BY signed_at IS NULL DESC, updated_at DESC LIMIT 30`,
    [userId],
  );
}

function skeletonCard(skeleton: SkeletonRow | null): string {
  const beats = skeleton
    ? parseJsonOr<Array<{ n: number; text: string }>>(skeleton.beats_json, [])
    : [];
  const never = skeleton ? parseJsonOr<string[]>(skeleton.never_json, []) : [];
  const locked = skeleton?.locked_at;

  const lockBadge = locked
    ? `<span class="lockbadge">${icon("check")}locked</span>`
    : `<span class="setup-toggle">unlocked</span>`;

  const beatsHtml =
    beats.length > 0
      ? beats
          .map(
            (b) => `<div class="skel-row">
  <span class="sn">${b.n}.</span>
  <span class="stext" contenteditable="true" data-n="${b.n}">${escapeHtml(b.text)}</span>
</div>`,
          )
          .join("")
      : `<div class="skel-row"><span class="sn">—</span><span class="stext" style="color:var(--mute);font-style:italic">Add beats below to lock your argument skeleton. Each beat is one move in the structure you want every output to follow.</span></div>`;

  const neverHtml =
    never.length > 0
      ? `<div class="skel-never">
  <span class="nx">✕</span>
  <span class="nlist">${never.map((n) => escapeHtml(n)).join(" · ")}</span>
</div>`
      : "";

  return `<div class="studio-setup${locked ? " locked" : ""}">
  <div class="setup-head">
    <svg class="sh-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.5" y="7" width="9" height="6.5" rx="1.2"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>
    <div>
      <div class="sh-title">Reasoning lock</div>
      <div class="sh-sub">argument structure that every output inherits</div>
    </div>
    ${lockBadge}
  </div>
  <form method="POST" action="/op/studio/skeleton" class="setup-grid">
    <div class="setup-col">
      <h4><span class="num">01</span>Examples you trust (3–7)</h4>
      <div class="ex-drop">Drop the writers you want to sound like</div>
      <div class="skel-extract-note">Drop-target wiring is Stage 1.1 — for now, write the skeleton beats directly on the right.</div>
    </div>
    <div class="setup-col">
      <h4><span class="num">02</span>The skeleton</h4>
      <div class="skel" id="skel-list">${beatsHtml}</div>
      <textarea name="beats" placeholder="One beat per line — they get numbered automatically. Example:&#10;Open with the structural surprise (not the personal story).&#10;Name the pattern in concrete terms.&#10;Show one instance with primary-source evidence.&#10;Generalize to the structure.&#10;Close with the throughline." style="width:100%;min-height:96px;background:var(--bg);border:1px solid var(--rule-2);border-radius:8px;padding:8px 10px;color:var(--ink);font-family:var(--serif);font-size:13.5px;line-height:1.4;resize:vertical">${beats.map((b) => b.text).join("\n")}</textarea>
      ${neverHtml}
      <textarea name="never" placeholder="Moves to avoid, one per line (optional)" style="width:100%;min-height:48px;background:var(--bg);border:1px solid var(--rule-2);border-radius:8px;padding:8px 10px;color:var(--ink);font-family:var(--serif);font-size:13px;font-style:italic;margin-top:8px;resize:vertical">${never.join("\n")}</textarea>
      <div class="setup-actions" style="margin-top:12px">
        <button type="submit" class="btn btn-amber" name="action" value="lock">${icon("check")} Lock this skeleton</button>
        ${locked ? `<button type="submit" class="btn" name="action" value="unlock">Unlock</button>` : ""}
      </div>
    </div>
  </form>
</div>`;
}

function composer(findings: FindingRow[], skeletonLocked: boolean, defaultSource: string): string {
  const sourceOptions = findings.length
    ? findings
        .map(
          (f) =>
            `<option value="${escapeAttr(f.id)}" ${f.id === defaultSource ? "selected" : ""}>${escapeHtml(f.kind)} · ${escapeHtml(f.title.slice(0, 80))}</option>`,
        )
        .join("")
    : `<option value="">No findings yet — surface some in Synthesis first</option>`;

  const mediumPills = MEDIA.map(
    (m) => `<label class="mpill">
  <input type="radio" name="medium" value="${escapeAttr(m.key)}" required style="position:absolute;opacity:0;pointer-events:none" />
  <span class="mp-l">${escapeHtml(m.label)}</span>
  <span class="mp-h">${escapeHtml(m.hint)}</span>
</label>`,
  ).join("");

  return `<div class="composer">
  <div class="composer-head">
    <svg class="ch-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 1.5l1.6 4.4 4.4 1.6-4.4 1.6L8 13.5l-1.6-4.4L2 7.5l4.4-1.6z" stroke-linejoin="round"/></svg>
    <div>
      <div class="ch-title">New script</div>
      <div class="ch-sub">generate in the locked skeleton · save as a project</div>
    </div>
  </div>
  <form class="composer-body" method="POST" action="/op/studio/compose">
    <div class="gen-grid">
      <div class="gen-field">
        <h4>Source finding</h4>
        <select name="source" class="src-btn" style="width:100%;padding:11px 14px;border-radius:9px">${sourceOptions}</select>
      </div>
      <div class="gen-field">
        <h4>Output medium</h4>
        <div class="medium-pills" id="medium-pills">${mediumPills}</div>
      </div>
      <div class="gen-field">
        <h4>Title</h4>
        <input name="title" placeholder="Working title" style="width:100%;padding:10px 13px;border-radius:9px;background:var(--panel);border:1px solid var(--rule-2);color:var(--ink);font-family:var(--serif);font-size:14px" />
      </div>
    </div>
    <div class="gen-go">
      <button type="submit" class="btn btn-amber" ${skeletonLocked ? "" : "disabled"}>${icon("spark")} Generate</button>
      <span class="applied">${skeletonLocked ? `${icon("check")} locked skeleton applied` : "Lock a skeleton above to generate"}</span>
    </div>
  </form>
</div>
<script>
// Light hover→checked sync for the medium pills.
document.querySelectorAll('#medium-pills .mpill input').forEach(r => {
  r.addEventListener('change', () => {
    document.querySelectorAll('#medium-pills .mpill').forEach(p => p.classList.remove('on'));
    if (r.checked) r.closest('.mpill').classList.add('on');
  });
});
</script>`;
}

function projectCard(p: ProjectRow): string {
  const beats = parseJsonOr<string[]>(p.beats_json, []);
  const stages = ["script", "audio", "video", "export"];
  const stageIdx = stages.indexOf(p.stage);
  const stagesHtml = stages
    .map(
      (s, i) => `<div class="pcp-step${i <= stageIdx && p.stage !== "archived" ? " done" : ""}">
  <span class="pcp-dot">${i <= stageIdx ? "✓" : ""}</span>
  <span class="pcp-label">${escapeHtml(s)}</span>
${i < stages.length - 1 ? `<span class="pcp-line${i < stageIdx ? " done" : ""}"></span>` : ""}
</div>`,
    )
    .join("");
  return `<div class="project-card">
  <span class="pc-medium">${escapeHtml(MEDIUM_LABELS[p.medium] ?? p.medium)}</span>
  <div class="pc-body">
    <div class="pc-title">${escapeHtml(p.title)}</div>
    <div class="pc-progress">${stagesHtml}</div>
    <div class="pc-meta">${beats.length} beat${beats.length === 1 ? "" : "s"} · created ${escapeHtml(p.created_at.slice(0, 10))}</div>
  </div>
  <a class="pc-open" href="/op/studio/${escapeAttr(p.id)}">Open →</a>
</div>`;
}

export async function renderStudioScreen(
  env: { DB: D1Database },
  args: { source?: string | undefined } = {},
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const [skeleton, projects, findings] = userId
    ? await Promise.all([
        loadSkeleton(env.DB, userId),
        loadProjects(env.DB, userId),
        loadFindings(env.DB, userId),
      ])
    : [null, [] as ProjectRow[], [] as FindingRow[]];
  const skeletonLocked = !!skeleton?.locked_at;

  const body = `
${skeletonCard(skeleton)}

${composer(findings, skeletonLocked, args.source ?? "")}

<div class="projects-head">
  <div class="ph-title">Projects</div>
  <div class="ph-count">${projects.length}</div>
  <div class="ph-sub">scripts in production</div>
</div>
${
  projects.length
    ? `<div class="project-list">${projects.map(projectCard).join("")}</div>`
    : emptyState({
        iconName: "studio",
        title: "No projects yet.",
        body: "Pick a source finding, choose a medium, and generate. Save a generated script as a project. Audio/Video/Export pipelines land later.",
        action: { href: "/op/synthesis", label: "Find something to write about" },
      })
}
`;

  return renderOpPage({
    title: "Studio",
    sub: "lock reasoning once · generate in any medium",
    body,
    activeNav: "/op/studio",
    width: "wide",
  });
}

// Per-project workspace view. P5 ships the Script tab real; the other
// tabs show "Stage 2/3 — not yet built" empty states per the handoff.
export async function renderProjectWorkspace(
  env: { DB: D1Database },
  projectId: string,
  tab: "script" | "audio" | "video" | "export" = "script",
): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;
  const p = await one<ProjectRow>(
    env.DB,
    `SELECT id, title, medium, stage, beats_json, source_finding_id, created_at, updated_at
       FROM studio_projects WHERE id = ? AND user_id = ?`,
    [projectId, userId],
  );
  if (!p) return null;
  const beats = parseJsonOr<string[]>(p.beats_json, []);

  const tabsHtml = (["script", "audio", "video", "export"] as const)
    .map(
      (t) =>
        `<a class="ws-tab ${t === tab ? "on" : ""}${t === "script" ? " done" : ""}" href="/op/studio/${escapeAttr(p.id)}?tab=${t}">
  <span class="wst-dot">${t === "script" ? "✓" : ""}</span>${escapeHtml(t)}
</a>`,
    )
    .join("");

  const tabBody =
    tab === "script"
      ? `<div class="ws-script">
  <div style="margin-bottom:14px;font-family:var(--mono);font-size:11px;color:var(--mute)">${beats.length} beat${beats.length === 1 ? "" : "s"}</div>
  ${beats
    .map(
      (b, i) => `<div class="beat">
  <span class="bnum">${String(i + 1).padStart(2, "0")}</span>
  <span class="btext">${escapeHtml(b)}</span>
</div>`,
    )
    .join("")}
  <div class="ws-actions" style="margin-top:18px">
    <button class="btn btn-amber" disabled>Make audio → (Stage 2)</button>
  </div>
</div>`
      : tab === "audio"
        ? `<div class="ws-gate">Stage 2 — MediaRecorder + TTS + Web Audio stitching. Not yet wired in P5; the handoff explicitly deferred media production so the launch wasn't blocked on it.</div>`
        : tab === "video"
          ? `<div class="ws-gate">Stage 3 — Pexels API for stock, Kling/fal.ai for generative clips. Not yet wired in P5.</div>`
          : `<div class="ws-gate">Stage 3 — FFmpeg assembly into MP3/MP4. Not yet wired in P5.</div>`;

  const body = `
<div class="ws-head">
  <a class="ws-back" href="/op/studio">← Projects</a>
  <span class="ws-medium">${escapeHtml(MEDIUM_LABELS[p.medium] ?? p.medium)}</span>
  <span class="ws-title">${escapeHtml(p.title)}</span>
</div>
<div class="ws-tabs">${tabsHtml}</div>
${tabBody}
`;

  return renderOpPage({
    title: `Studio · ${p.title}`,
    sub: MEDIUM_LABELS[p.medium] ?? p.medium,
    body,
    activeNav: "/op/studio",
    width: "wide",
  });
}
