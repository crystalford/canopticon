// Feed — the front door. Drop research reports; the system digests them.
//
// P0 ships an empty surface with the dropzone shell, the sample tray
// shell, and a placeholder activity log. The auto-ingest digestion
// pipeline lands in P1 — extract_text → recognize_entities → extract_claims
// → embed → detect_chains, with the activity log streaming from
// orchestrator_events.

import { renderOpPage } from "../layout";

export async function renderFeedScreen(_env: { DB: D1Database }): Promise<string> {
  const body = `
<div class="dropzone">
  <div class="dz-ico">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
      <path d="M8 11V3.5M5 6l3-3 3 3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3 11.5v1.5a1 1 0 001 1h8a1 1 0 001-1v-1.5" stroke-linecap="round"/>
    </svg>
  </div>
  <div class="dz-1">Drop research reports here</div>
  <div class="dz-2">PDF · Markdown · plain text</div>
  <div class="dz-3">Upload is authorization. The system extracts entities, drafts claims, detects chains, and the graph grows — no confirmation gate. Claims land as draft until the weighting model judges them citable.</div>
</div>

<div class="tray-label">Queued for ingestion</div>
<div class="tray">
  <div class="tray-card" disabled>
    <div class="tc-top">
      <svg class="tc-doticon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M9 2v3h3" stroke-linejoin="round"/></svg>
      <span class="tc-name">no samples yet</span>
    </div>
    <span class="tc-blurb">Sample documents the operator can drop to see the full digestion flow appear here in P1.</span>
  </div>
</div>
<div class="tray-note">The digestion pipeline (extract → recognize entities → draft claims → embed → detect chains) lands in P1.</div>

<div class="log-head">
  <span class="eyebrow"><span class="livedot"></span>Activity log</span>
  <span class="undo-hint">every action is logged &amp; reversible</span>
</div>
<div class="log">
  <div class="log-row">
    <span class="lago">—</span>
    <span class="ltext"><b>P0 shell:</b> the activity log will stream rows from <span class="mono">orchestrator_events</span> as the digestion pipeline runs (P1).</span>
    <span class="log-tag lt-ingest">setup</span>
  </div>
</div>
`;

  return renderOpPage({
    title: "Feed",
    sub: "drop research reports · digest into the graph",
    body,
    activeNav: "/op",
  });
}
