// THE OG CARD — one 1200×630 image per document, rendered once at
// processing time and stored in R2 (docs/the-record.md §4 step 9, §7 "OG
// image"). The public route `GET /og/<slug>.png` serves the R2 key
// `og/<slug>.png`; that key is the whole contract between this file and the
// route.
//
// The card is plain HTML in the site's look, screenshotted by Cloudflare
// Browser Rendering's REST API. Nothing calls a model. When the renderer is
// not configured the step says so and writes nothing — inert, not
// half-working — and the page falls back to a card-less share, which every
// reader and crawler can still read (rule 7).

import type { Env } from "../../env";
import { one } from "../../lib/d1";

export interface OgPiece {
  title: string;
  kind: string;
  subtitle?: string | null;
  figure?: { figure: string; measures: string } | null;
}

export type OgResult = { ok: true; key: string; bytes: number } | { ok: false; reason: string };

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export const OG_UNCONFIGURED_REASON =
  "Browser Rendering not configured (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN)";

/** The R2 key the card lives at. The public route reads the same key. */
export function ogKey(slug: string): string {
  return `og/${slug}.png`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

const KIND_LABEL: Record<string, string> = {
  essay: "Essay",
  research: "Research",
  document: "Research",
};

/**
 * A self-contained 1200×630 page: dark ground, one red accent, system sans
 * (fonts cannot load inside the renderer, so nothing is fetched). Title
 * large, the kind as an eyebrow, one key figure when the document has one,
 * the wordmark bottom-left and the domain bottom-right.
 */
export function renderOgCard(piece: OgPiece): string {
  const title = clip(piece.title || "Untitled", 140);
  const kind = KIND_LABEL[piece.kind] ?? clip(piece.kind || "Document", 24);
  const long = title.length > 80;
  const subtitle = piece.subtitle ? clip(piece.subtitle, 160) : "";
  const figure = piece.figure?.figure ? piece.figure : null;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; padding: 0; }
  body {
    width: ${OG_WIDTH}px; height: ${OG_HEIGHT}px; overflow: hidden;
    background: #0b0c0d; color: #f2f2f0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    box-sizing: border-box; width: 100%; height: 100%;
    padding: 64px 72px 56px; display: flex; flex-direction: column;
    border-top: 10px solid #e0433c;
  }
  .eyebrow {
    font-size: 24px; font-weight: 600; letter-spacing: 0.14em;
    text-transform: uppercase; color: #e0433c; margin: 0 0 28px;
  }
  .title {
    font-size: ${long ? 52 : 64}px; line-height: 1.12; font-weight: 700;
    letter-spacing: -0.015em; margin: 0; max-width: 1000px;
    display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
  }
  .subtitle {
    font-size: 28px; line-height: 1.35; color: #a7a7a3; margin: 20px 0 0;
    max-width: 1000px; display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden;
  }
  .figure { margin-top: auto; padding-top: 28px; display: flex; align-items: baseline; gap: 20px; }
  .figure .n { font-size: 56px; font-weight: 700; color: #e0433c; letter-spacing: -0.02em; white-space: nowrap; }
  .figure .m { font-size: 26px; color: #c9c9c4; line-height: 1.3; max-width: 760px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .foot {
    margin-top: ${figure ? 28 : "auto"}px; padding-top: 24px;
    border-top: 1px solid #2a2b2d; display: flex; justify-content: space-between;
    align-items: baseline; font-size: 26px;
  }
  .wordmark { font-weight: 700; letter-spacing: -0.02em; }
  .domain { color: #a7a7a3; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 22px; }
</style>
</head>
<body>
<div class="card">
  <p class="eyebrow">${esc(kind)}</p>
  <h1 class="title">${esc(title)}</h1>
  ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ""}
  ${
    figure
      ? `<div class="figure"><span class="n">${esc(clip(figure.figure, 24))}</span><span class="m">${esc(clip(figure.measures, 120))}</span></div>`
      : ""
  }
  <div class="foot"><span class="wordmark">canopticon</span><span class="domain">canopticon.com</span></div>
</div>
</body>
</html>`;
}

/**
 * Load the piece and its first finding, render the card, screenshot it and
 * put the PNG at `og/<slug>.png`. Returns a stated reason instead of
 * throwing when the renderer is unconfigured or answers with an error: an
 * absent card is not a document failure.
 */
export async function generateOgImage(
  env: Env,
  userId: string,
  pieceId: string,
): Promise<OgResult> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    return { ok: false, reason: OG_UNCONFIGURED_REASON };
  }
  const p = await one<{ title: string; subtitle: string | null; kind: string; slug: string }>(
    env.DB,
    "SELECT title, subtitle, kind, slug FROM pieces WHERE id = ? AND user_id = ?",
    [pieceId, userId],
  );
  if (!p) return { ok: false, reason: "piece not found" };
  const finding = await one<{ figure: string; measures: string }>(
    env.DB,
    `SELECT figure, measures FROM aeo_findings
      WHERE piece_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT 1`,
    [pieceId, userId],
  ).catch(() => null);

  const html = renderOgCard({
    title: p.title,
    kind: p.kind,
    subtitle: p.subtitle,
    figure: finding ?? null,
  });

  let res: Response;
  try {
    res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/screenshot`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html,
          viewport: { width: OG_WIDTH, height: OG_HEIGHT },
          screenshotOptions: { type: "png" },
        }),
      },
    );
  } catch (err) {
    return { ok: false, reason: `Browser Rendering unreachable: ${(err as Error).message}` };
  }
  if (!res.ok) return { ok: false, reason: `Browser Rendering returned HTTP ${res.status}` };
  const png = await res.arrayBuffer();
  if (png.byteLength === 0)
    return { ok: false, reason: "Browser Rendering returned an empty image" };
  const key = ogKey(p.slug);
  await env.FILES.put(key, png, { httpMetadata: { contentType: "image/png" } });
  return { ok: true, key, bytes: png.byteLength };
}
