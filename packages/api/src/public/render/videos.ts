// Videos — the public surface for what the video Worker
// (packages/video) has published. Two content pipelines feed the same
// list: reading-sourced essays (drafted from a signed reading's
// verified facts — see the "Produce video essay" action on a signed
// File) and the daily GDELT news-clip radar, which predates it and
// runs independently. Both only ever appear here once the operator has
// explicitly published them — rendering succeeding is not the same as
// approved for public display; see routes/from-reading.ts and
// routes/public.ts on the video Worker for that gate.
//
// This page is a thin client over the video Worker's own public API —
// packages/api has no video data of its own; VIDEO_BASE is a separate
// Cloudflare Worker with its own D1 and R2. Without VIDEO_BASE
// configured, this shows an honest empty state, not an error.

import type { PublicEnv } from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";
import { emptyState } from "./components";

interface PublicSegment {
  id: string;
  title: string;
  source_kind: string;
  subject_slug: string | null;
  template: string;
  published_at: string;
  length_s: number;
  variant: string;
  watch_url: string | null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export async function renderVideosPage(env: PublicEnv): Promise<string> {
  let segments: PublicSegment[] = [];
  if (env.VIDEO_BASE) {
    try {
      const res = await fetch(`${env.VIDEO_BASE}/public/segments`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as { segments?: PublicSegment[] };
        segments = data.segments ?? [];
      }
    } catch {
      segments = [];
    }
  }

  const rows = segments
    .map((s) => {
      const subjectLink =
        s.source_kind === "reading" && s.subject_slug
          ? `<a href="/s/${escapeAttr(s.subject_slug)}">see the File →</a>`
          : "";
      const kindLabel = s.source_kind === "reading" ? "from a signed reading" : "daily radar";
      return `<div class="video-row">
  <div class="video-row-head">
    <span class="video-kind">${escapeHtml(kindLabel)}</span>
    <span class="video-meta">${escapeHtml(formatDuration(s.length_s))} <span class="sep">·</span> ${escapeHtml(s.variant)} <span class="sep">·</span> published ${escapeHtml(formatRelative(s.published_at))}</span>
  </div>
  <div class="video-title">${escapeHtml(s.title)}</div>
  ${
    s.watch_url
      ? `<video controls preload="none" class="video-player" src="${escapeAttr(s.watch_url)}"></video>`
      : `<div class="video-missing">asset unavailable</div>`
  }
  ${subjectLink ? `<div class="video-link">${subjectLink}</div>` : ""}
</div>`;
    })
    .join("");

  const body = `
<section class="watch-masthead">
  <div class="kicker"><span class="live"></span> Videos</div>
  <h1 class="watch-h1">Video essays, made the same way everything else here is.</h1>
  <p class="watch-lede">
    Short and long-form essays drafted from Canopticon's own verified facts — the same
    firewall, the same operator sign-off, just in a different shape. Alongside them, a
    separate daily-radar pipeline turns today's news clips into short forensic segments.
    Nothing here was auto-published: every video was rendered, watched, and explicitly
    published by the operator.
  </p>
</section>

<section class="watch-list-section">
  ${
    segments.length
      ? `<div class="sec-h"><span class="label">Published</span><span class="coord">${segments.length} VIDEO${segments.length === 1 ? "" : "S"}</span></div>
  <div class="video-list">${rows}</div>`
      : emptyState(
          env.VIDEO_BASE
            ? "Nothing published yet. Video essays are drafted from signed readings via the 'Produce video essay' action on a File — the operator reviews and renders before anything appears here."
            : "The video Worker isn't configured on this deployment yet.",
        )
  }
</section>
`;

  return renderPage({
    title: "Videos · canopticon",
    description:
      "Video essays drafted from Canopticon's verified facts, plus the daily news-clip radar.",
    body: `${body}
<style>
  .video-list { display: flex; flex-direction: column; gap: 1px; background: var(--rule); border: 1px solid var(--rule); border-radius: var(--r-lg); overflow: hidden; }
  .video-row { background: var(--surface); padding: 18px; }
  .video-row-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
  .video-kind { font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent-2); }
  .video-meta { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); }
  .video-title { font-family: var(--serif); font-size: 17px; color: var(--ink); margin-bottom: 10px; }
  .video-player { width: 100%; max-width: 480px; border-radius: 8px; background: #000; }
  .video-missing { font-family: var(--mono); font-size: 12px; color: var(--ink-mute); font-style: italic; }
  .video-link { margin-top: 8px; font-family: var(--mono); font-size: 11.5px; }
  .video-link a { color: var(--accent-2); text-decoration: none; }
  .video-link a:hover { text-decoration: underline; }
</style>`,
    activeNav: "/videos",
    zone: "videos",
  });
}
