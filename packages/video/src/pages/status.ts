// Status page — the operator's Phase 0 cockpit. Shows the latest render
// job (queued / running / succeeded / failed) with timing + cost +
// inline video preview. "Run spike" button POSTs /spike to fire a new
// render against the seeded Carney segment.

import type { RenderJobRow } from "../storage/d1.ts";
import { escapeAttr, escapeHtml, htmlPage } from "./shell.ts";

interface StatusArgs {
  latestJob: RenderJobRow | null;
  videoUrl: string | null;
}

export function renderStatusPage(args: StatusArgs): Response {
  const { latestJob, videoUrl } = args;
  const refresh =
    latestJob && (latestJob.status === "queued" || latestJob.status === "running") ? 3 : undefined;

  const body = latestJob
    ? renderJobCard(latestJob, videoUrl)
    : `<div class="card">
  <div class="k">no spike has been run yet</div>
  <div class="v empty">Click below to render the seeded "It Looks Like Teslas" segment.</div>
</div>`;

  const spikeButton = `<form method="POST" action="/spike" style="margin-top:18px">
  <button class="btn btn-warn" type="submit">Run Phase 0 spike</button>
</form>`;

  const explainer = `<div class="card" style="margin-top:24px">
  <div class="k">phase 0</div>
  <div style="font-family: var(--serif); font-size:14.5px; line-height:1.65; margin-top:4px">
    Single-shot render of the handoff §7 worked example. Targets: walltime ≤ 5 min warm,
    cost ≤ $0.10, all six visual techniques visible. If this fails, the fallback is an
    external GPU renderer with the same segment-JSON contract.
  </div>
</div>`;

  const inner = `
  <div class="h1">Daily forensic video — status</div>
  <div class="sub">phase 0 cockpit · render spike + plumbing only · cron is heartbeat-only until phase 1</div>
  ${body}
  ${spikeButton}
  ${explainer}
`;

  return htmlPage({
    title: "Status",
    body: inner,
    ...(refresh ? { refreshSeconds: refresh } : {}),
  });
}

function renderJobCard(job: RenderJobRow, videoUrl: string | null): string {
  const status = `<span class="pill ${escapeAttr(job.status)}">${escapeHtml(job.status)}</span>`;
  const started = job.started_at ? escapeHtml(job.started_at) : "—";
  const finished = job.finished_at ? escapeHtml(job.finished_at) : "—";
  const walltime = job.walltime_ms ? `${(job.walltime_ms / 1000).toFixed(1)}s` : "—";
  const cost = job.est_cost_cents != null ? `$${(job.est_cost_cents / 100).toFixed(3)}` : "—";

  const error =
    job.status === "failed" && job.error ? `<pre class="err">${escapeHtml(job.error)}</pre>` : "";

  const video =
    job.status === "succeeded" && videoUrl
      ? `<video controls src="${escapeAttr(videoUrl)}"></video>`
      : "";

  // Platform deep-links — Download MP4 + buttons that open each
  // platform's web upload page. The operator drags the downloaded
  // file into the platform's uploader. No OAuth, no auto-publish.
  // Mirrors the Studio Stage F pattern from the publication.
  const publish =
    job.status === "succeeded" && videoUrl
      ? `<div class="row" style="margin-top:14px;flex-wrap:wrap;gap:8px">
  <a class="btn" href="${escapeAttr(videoUrl)}" download style="background:var(--ink);color:var(--paper)">⬇ Download MP4</a>
  <a class="btn" href="https://studio.youtube.com/channel/UC/videos/upload" target="_blank" rel="noopener" style="background:#fff;color:var(--ink);border:1px solid var(--rule)">YouTube Studio →</a>
  <a class="btn" href="https://www.tiktok.com/upload" target="_blank" rel="noopener" style="background:#fff;color:var(--ink);border:1px solid var(--rule)">TikTok upload →</a>
  <a class="btn" href="https://www.instagram.com/" target="_blank" rel="noopener" style="background:#fff;color:var(--ink);border:1px solid var(--rule)">Instagram →</a>
  <a class="btn" href="https://twitter.com/compose/tweet" target="_blank" rel="noopener" style="background:#fff;color:var(--ink);border:1px solid var(--rule)">X compose →</a>
  <a class="btn" href="https://www.linkedin.com/" target="_blank" rel="noopener" style="background:#fff;color:var(--ink);border:1px solid var(--rule)">LinkedIn →</a>
</div>
<div style="font-family:var(--mono);font-size:10.5px;color:var(--ink-3);margin-top:6px">deep-links open each platform's web uploader · drag the downloaded mp4 in · no oauth, no auto-publish</div>`
      : "";

  return `<div class="card">
  <div class="row">
    <div><div class="k">status</div><div class="v">${status}</div></div>
    <div><div class="k">walltime</div><div class="v num">${walltime}</div></div>
    <div><div class="k">est. cost</div><div class="v num">${cost}</div></div>
  </div>
  <div class="row" style="margin-top:14px">
    <div><div class="k">job id</div><div class="v" style="font-family:var(--mono);font-size:13px">${escapeHtml(job.id)}</div></div>
    <div><div class="k">segment</div><div class="v" style="font-family:var(--mono);font-size:13px">${escapeHtml(job.segment_id)}</div></div>
  </div>
  <div class="row" style="margin-top:14px">
    <div><div class="k">started</div><div class="v" style="font-size:13px">${started}</div></div>
    <div><div class="k">finished</div><div class="v" style="font-size:13px">${finished}</div></div>
  </div>
  ${error}
  ${video ? `<div style="margin-top:18px">${video}</div>` : ""}
  ${publish}
</div>`;
}
