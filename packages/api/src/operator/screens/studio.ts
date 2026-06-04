// Studio — the production workspace.
//
// P0 ships the workspace shell with placeholder reasoning lock + composer.
// Stage 1 (reasoning lock, composer with source-finding picker + medium
// pills + generate-with-skeleton, projects shelf) lands in P5. Stage 2
// (audio: MediaRecorder + TTS + Web Audio stitching) and Stage 3 (video:
// Pexels / Kling / FFmpeg) are deferred per the handoff's explicit
// recommendation not to block launch on media production.

import { emptyState, renderOpPage } from "../layout";

export async function renderStudioScreen(_env: { DB: D1Database }): Promise<string> {
  const body = `
<div class="studio-setup">
  <div class="setup-head">
    <svg class="sh-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.5" y="7" width="9" height="6.5" rx="1.2"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>
    <div>
      <div class="sh-title">Reasoning lock</div>
      <div class="sh-sub">argument structure that every output inherits</div>
    </div>
    <span class="setup-toggle">P5</span>
  </div>
  <div class="setup-grid">
    <div class="setup-col">
      <h4><span class="num">01</span>Examples you trust (3–7)</h4>
      <div class="ex-drop">Drop the writers you want to sound like</div>
      <div class="skel-extract-note">P5 extracts an argument skeleton from these and locks it.</div>
    </div>
    <div class="setup-col">
      <h4><span class="num">02</span>The skeleton</h4>
      <div class="skel">
        <div class="skel-row"><span class="sn">—</span><span class="stext" style="color:var(--mute);font-style:italic">Beats appear here once you lock a skeleton.</span></div>
      </div>
      <div class="setup-actions">
        <button class="btn btn-amber" disabled>Lock this skeleton</button>
      </div>
    </div>
  </div>
</div>

<div class="composer">
  <div class="composer-head">
    <svg class="ch-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 1.5l1.6 4.4 4.4 1.6-4.4 1.6L8 13.5l-1.6-4.4L2 7.5l4.4-1.6z" stroke-linejoin="round"/></svg>
    <div>
      <div class="ch-title">New script</div>
      <div class="ch-sub">generate in the locked skeleton · save as a project</div>
    </div>
  </div>
  <div class="composer-empty">
    <div class="ce-1">Composer lands in P5.</div>
    <div class="ce-2">Lock a skeleton, pick a finding as source, choose an output medium (X thread / TikTok / Video essay / Podcast / Meme brief / Book chapter), generate.</div>
  </div>
</div>

<div class="projects-head">
  <div class="ph-title">Projects</div>
  <div class="ph-count">0</div>
  <div class="ph-sub">scripts in production</div>
</div>
${emptyState({
  iconName: "studio",
  title: "No projects yet.",
  body: "Save a generated script as a project. Each project carries through Script → Audio → Video → Export and produces real .mp3/.mp4 files. Audio + Video pipelines land later — Stage 1 lands in P5.",
  action: { href: "/op/synthesis", label: "Find something to write about" },
})}
`;

  return renderOpPage({
    title: "Studio",
    sub: "lock reasoning once · generate in any medium",
    body,
    activeNav: "/op/studio",
  });
}
