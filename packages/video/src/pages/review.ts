// /queue/:id review surface — the one operator touchpoint in the
// pipeline. Shows the LLM-drafted §7b segment with a focused editor
// on the forensic_turn line (the one thing the operator approves),
// the candidate provenance, and the beat structure for context.
// Approve fires the render in waitUntil.

import type { Segment } from "@canopticon/shared/video/segment-schema";
import type { CandidateRow } from "../sourcing/candidates";
import { escapeAttr, escapeHtml, htmlPage } from "./shell";

interface ReviewArgs {
  candidate: CandidateRow;
  segment: Segment;
  usedLlm: boolean;
  message?: string;
  /** Set once a render has actually run for this segment — swaps the
   *  pre-render forensic_turn editor for the finished video + publish
   *  controls. See routes/queue.ts's GET /:id. */
  rendered?: { videoUrl: string | null; published: boolean };
}

export function renderReviewPage(args: ReviewArgs): Response {
  const { candidate, segment, usedLlm, message, rendered } = args;
  const msg = message
    ? `<div class="card" style="background:#fff5e6;border-color:#e3c89a;color:#5c4413;margin-bottom:14px">${escapeHtml(message)}</div>`
    : "";
  const llmTag = usedLlm
    ? `<span class="pill" style="background:#e7f0e6;color:#2f7d52">llm draft</span>`
    : `<span class="pill" style="background:#fff5e6;color:#5c4413">skeleton (no llm)</span>`;

  if (rendered) {
    return renderRenderedView(candidate, segment, llmTag, msg, rendered);
  }

  const beats = segment.beats
    .map(
      (b) => `<div style="border-left:3px solid var(--rule);padding:8px 14px;margin-bottom:8px">
  <div style="font-family:var(--mono);font-size:10.5px;color:var(--ink-3);letter-spacing:.04em">
    ${b.t_in_s}s — ${b.t_out_s}s · <b>${escapeHtml(b.type)}</b>${b.source ? ` · ${escapeHtml(b.source)}` : ""}
  </div>
  ${b.vo ? `<div style="font-family:var(--serif);font-size:13.5px;line-height:1.55;margin-top:4px">${escapeHtml(b.vo)}</div>` : ""}
</div>`,
    )
    .join("");

  const body = `
  <div style="display:flex;gap:14px;align-items:baseline">
    <div class="h1" style="margin:0">Review · ${escapeHtml(segment.title)}</div>
    ${llmTag}
  </div>
  <div class="sub">candidate ${escapeHtml(candidate.id)} · ${escapeHtml(candidate.network)} · ${escapeHtml(candidate.captured_at.slice(0, 16))} · template <b>${escapeHtml(segment.template)}</b></div>

  ${msg}

  <div class="card">
    <div class="k">The forensic turn — the only thing you approve</div>
    <div style="font-family:var(--serif);font-style:italic;font-size:13px;color:var(--ink-3);margin:6px 0 14px">
      The brain wrote this line. Edit it until it reveals the gap; then click Approve &amp; render.
      The renderer fires immediately on approval. Everything else in the segment is locked.
    </div>
    <form method="POST" action="/queue/${escapeAttr(candidate.id)}/approve">
      <textarea
        name="forensic_turn"
        rows="4"
        style="width:100%;font-family:var(--serif);font-size:16px;line-height:1.5;padding:14px;border:2px solid var(--ink);border-radius:8px;background:#fff;color:var(--ink);resize:vertical;box-sizing:border-box"
      >${escapeHtml(segment.forensic_turn.text)}</textarea>
      <div style="margin-top:14px;display:flex;gap:10px">
        <button class="btn" type="submit" name="action" value="approve" style="background:var(--amber);color:var(--ink);font-weight:600">Approve &amp; render →</button>
        <button class="btn" type="submit" name="action" value="save" style="background:#fff;color:var(--ink);border:1px solid var(--rule)">Save draft</button>
        <a class="studio-back" href="/queue" style="margin-left:auto;align-self:center;font-family:var(--mono);font-size:12px;color:var(--ink-3);text-decoration:none">← back to queue</a>
      </div>
    </form>
  </div>

  <div class="card" style="margin-top:18px">
    <div class="k">candidate (read-only)</div>
    <div style="font-family:var(--serif);font-size:14px;margin-top:6px">${escapeHtml(candidate.headline)}</div>
    <div style="font-family:var(--serif);font-style:italic;font-size:13px;color:var(--ink-3);margin-top:6px;line-height:1.55">${escapeHtml(candidate.excerpt.slice(0, 600))}${candidate.excerpt.length > 600 ? "…" : ""}</div>
    <div style="margin-top:8px;font-family:var(--mono);font-size:11px;color:var(--ink-3)">
      <a href="${escapeAttr(candidate.clip_url)}" target="_blank" rel="noopener">${escapeHtml(candidate.clip_url)}</a>
    </div>
  </div>

  <div class="card" style="margin-top:18px">
    <div class="k">beats (read-only) · ${segment.beats.length} beats · ${segment.length_s}s total</div>
    <div style="margin-top:10px">${beats}</div>
  </div>
`;
  return htmlPage({
    title: `Review · ${segment.title.slice(0, 40)}`,
    body,
  });
}

function renderRenderedView(
  candidate: CandidateRow,
  segment: Segment,
  llmTag: string,
  msg: string,
  rendered: { videoUrl: string | null; published: boolean },
): Response {
  const video = rendered.videoUrl
    ? `<video controls src="${escapeAttr(rendered.videoUrl)}" style="width:100%;max-width:640px;border-radius:8px"></video>`
    : `<div class="v empty">render succeeded but the asset key is missing — check /metrics</div>`;

  const publishBlock = rendered.published
    ? `<div class="card" style="margin-top:18px;background:#e7f0e6;border-color:#bcd6b8">
  <div class="k" style="color:#2f7d52">published</div>
  <div style="font-family:var(--serif);font-size:14px;margin-top:4px">Live on canopticon.com's /videos section.</div>
</div>`
    : `<div class="card" style="margin-top:18px">
  <div class="k">Publish to canopticon.com</div>
  <div style="font-family:var(--serif);font-size:13.5px;line-height:1.55;color:var(--ink-3);margin:6px 0 14px">
    Watch the video above first. Publishing puts it on the public /videos section — a separate
    decision from approving the script, same as everything else on this site: nothing goes public
    without the operator explicitly saying so.
  </div>
  <form method="POST" action="/queue/${escapeAttr(candidate.id)}/publish">
    <button class="btn" type="submit" style="background:var(--amber);color:var(--ink);font-weight:600">Publish →</button>
  </form>
</div>`;

  const body = `
  <div style="display:flex;gap:14px;align-items:baseline">
    <div class="h1" style="margin:0">${escapeHtml(segment.title)}</div>
    ${llmTag}
  </div>
  <div class="sub">${escapeHtml(candidate.network)} · rendered · template <b>${escapeHtml(segment.template)}</b> · ${segment.length_s}s</div>

  ${msg}

  <div class="card">
    <div class="k">rendered video</div>
    <div style="margin-top:10px">${video}</div>
  </div>

  ${publishBlock}

  <div style="margin-top:18px">
    <a href="/queue" style="font-family:var(--mono);font-size:12px;color:var(--ink-3);text-decoration:none">← back to queue</a>
  </div>
`;
  return htmlPage({
    title: `Rendered · ${segment.title.slice(0, 40)}`,
    body,
  });
}
