// Produce: wrap a face's rendered HTML into a self-contained document
// the screenshot endpoint can render to PNG (spec v2.6 Part 27).
//
// A "face" in canopticon is the styled HTML composition (a card, a thread
// post). The site renders that composition inside the public page chrome
// — header, nav, footer. For Produce, we strip the chrome and ship the
// face alone in a minimal HTML doc that the headless browser screenshots
// at a platform-specific viewport.

import type { Viewport } from "./render-png";

export interface ProduceTarget {
  key: string;
  label: string;
  viewport: Viewport;
  filenameSuffix: string;
}

// Platform targets per face kind. Spec Part 27's catalog:
//   card     — X 1200×630 + IG 1080×1080
//   thread   — X post card 1200×675 (one image)
//   carousel — IG/LinkedIn 1080×1350, one image per slide (operator
//              picks slide index from the Studio page)
export const CARD_TARGETS: ProduceTarget[] = [
  { key: "x", label: "X (1200×630)", viewport: { width: 1200, height: 630 }, filenameSuffix: "-x" },
  {
    key: "ig",
    label: "Instagram (1080×1080)",
    viewport: { width: 1080, height: 1080 },
    filenameSuffix: "-ig",
  },
];

export const THREAD_POST_TARGET: ProduceTarget = {
  key: "post",
  label: "X post (1200×675)",
  viewport: { width: 1200, height: 675 },
  filenameSuffix: "-post",
};

export const CAROUSEL_SLIDE_VIEWPORT: Viewport = { width: 1080, height: 1350 };

// CSS variables the face renderers reference. Defined here so the
// stripped-down Produce doc has the same colours and typography as the
// in-site preview. Kept in sync with packages/api/src/public/styles.ts.
const FACE_VARS = `
  :root {
    --ink: #0c0d10;
    --ink-2: #2a2c30;
    --ink-3: #8a867c;
    --paper: #faf6ef;
    --rule: #e7e2d6;
    --serif: ui-serif, Georgia, "Iowan Old Style", "Apple Garamond", serif;
    --mono: ui-monospace, "JetBrains Mono", Menlo, monospace;
  }
  html, body { margin: 0; padding: 0; background: var(--paper); }
  body { display: flex; align-items: center; justify-content: center; }
  .produce-stage { width: 100%; max-width: 1080px; padding: 32px; box-sizing: border-box; }
`;

/** Wrap a face's HTML in a minimal document the screenshot endpoint can
 *  paint without the site chrome. The face already carries its own
 *  scoped styles (.card-face / .thread-face etc.); we add only the CSS
 *  variables and a centred stage. */
export function wrapFaceForProduce(faceHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>canopticon — produce</title>
  <style>${FACE_VARS}</style>
</head>
<body>
  <div class="produce-stage">${faceHtml}</div>
</body>
</html>`;
}

/** Wrap a single carousel slide for screenshot. Different from
 *  wrapFaceForProduce because the slide already prints at a fixed
 *  aspect-ratio; the viewport is 1080×1350 and the stage fills it. */
export function wrapCarouselSlideForProduce(slideHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>canopticon — carousel slide</title>
  <style>
    ${FACE_VARS}
    html, body { height: 100%; }
    body { display: block; }
    .carousel-slide {
      position: absolute; inset: 0; aspect-ratio: auto;
      width: 1080px; height: 1350px;
      box-sizing: border-box;
    }
  </style>
</head>
<body>${slideHtml}</body>
</html>`;
}

/** Email-safe HTML for the newsletter format. No external stylesheets,
 *  no web fonts, inline styles on every block. Renders identically in
 *  Gmail, Outlook, and Apple Mail. */
export function renderNewsletterHtml(args: {
  slug: string;
  thesis: string;
  bodyMd: string;
  bodyHtml: string;
  signedBy: string | null;
  signedAt: string | null;
}): string {
  const { slug, thesis, bodyHtml, signedBy, signedAt } = args;
  const date = signedAt ? new Date(signedAt).toISOString().slice(0, 10) : "";
  const signature = signedBy ?? "the operator";
  // Inline styles ONLY. Email clients strip <style> in head; everything
  // load-bearing must live on the element.
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtmlAttr(thesis)}</title>
</head>
<body style="margin:0;padding:0;background:#faf6ef;font-family:Georgia,serif;color:#0c0d10;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#faf6ef;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="background:#fff;border:1px solid #e7e2d6;border-radius:8px;">
        <tr><td style="padding:32px 36px;">
          <div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#8a867c;letter-spacing:.05em;margin-bottom:12px;">CANOPTICON · ${escapeHtmlAttr(date)}</div>
          <h1 style="font-family:Georgia,serif;font-size:28px;line-height:1.25;font-weight:600;margin:0 0 18px;color:#0c0d10;">${escapeHtmlAttr(thesis)}</h1>
          <div style="font-family:Georgia,serif;font-size:16px;line-height:1.65;color:#2a2c30;">${bodyHtml}</div>
          <div style="margin-top:36px;padding-top:18px;border-top:1px solid #e7e2d6;font-family:Georgia,serif;font-style:italic;font-size:14px;color:#0c0d10;">— ${escapeHtmlAttr(signature)}</div>
          <div style="margin-top:14px;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#8a867c;"><a href="https://canopticon.com/s/${escapeHtmlAttr(slug)}?mode=signed" style="color:#8a867c;text-decoration:none;border-bottom:1px solid #8a867c;">read at canopticon.com/s/${escapeHtmlAttr(slug)}</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Plain-text version of the newsletter for the multipart/alternative
 *  email body. Strips HTML; keeps the receipts inline. */
export function renderNewsletterPlainText(args: {
  slug: string;
  thesis: string;
  bodyMd: string;
  signedBy: string | null;
  signedAt: string | null;
}): string {
  const { slug, thesis, bodyMd, signedBy, signedAt } = args;
  const date = signedAt ? new Date(signedAt).toISOString().slice(0, 10) : "";
  const signature = signedBy ?? "the operator";
  return `CANOPTICON · ${date}

${thesis}

${bodyMd.trim()}

— ${signature}

Read at https://canopticon.com/s/${slug}?mode=signed
`;
}

/** Long-form export: the chapter face's markdown body, plus a YAML-ish
 *  front-matter the operator can pipe straight into static-site
 *  generators or Substack/Ghost importers. */
export function renderLongFormMarkdown(args: {
  slug: string;
  thesis: string;
  bodyMd: string;
  signedBy: string | null;
  signedAt: string | null;
  chapterMd: string | null;
}): string {
  const { slug, thesis, bodyMd, signedBy, signedAt, chapterMd } = args;
  const front = [
    "---",
    `title: ${JSON.stringify(thesis)}`,
    `slug: ${slug}`,
    `signed_by: ${signedBy ?? "the operator"}`,
    signedAt ? `signed_at: ${signedAt}` : null,
    `source: https://canopticon.com/s/${slug}?mode=signed`,
    "---",
    "",
  ]
    .filter(Boolean)
    .join("\n");
  const body = chapterMd
    ? `${bodyMd.trim()}\n\n## Chapter outline\n\n${chapterMd.trim()}`
    : bodyMd.trim();
  return `${front}${body}\n`;
}

export interface PaperSection {
  label: string;
  slug: string;
  thesis: string;
  bodyMd: string;
  signedBy: string | null;
  signedAt: string | null;
}

export interface PaperReference {
  index: number;
  pieceTitle: string;
  pieceSlug: string | null;
}

/** Paper export: composes N already-signed pages into one long-form
 *  document — abstract (the theses, verbatim), a numbered section per
 *  subject (the already-approved body_md, untouched), and a compiled
 *  bibliography built from every page's page_claims. Nothing here is
 *  drafted or reworded — this is Studio's reshape principle applied to
 *  more than one page at once: recomposition of already-approved
 *  content, not new authorship. */
export function renderPaperMarkdown(args: {
  title: string;
  sections: PaperSection[];
  references: PaperReference[];
}): string {
  const { title, sections, references } = args;
  const abstract = sections
    .map((s) => s.thesis.trim())
    .filter(Boolean)
    .join("\n\n");
  const body = sections
    .map((s, i) => {
      const byline = [s.signedBy, s.signedAt ? s.signedAt.slice(0, 10) : null]
        .filter(Boolean)
        .join(" — ");
      return `## ${i + 1}. ${s.label}\n\n${byline ? `*${byline}*\n\n` : ""}${s.bodyMd.trim()}`;
    })
    .join("\n\n---\n\n");
  const refs = references.length
    ? `\n\n## Sources\n\n${references
        .map(
          (r) =>
            `${r.index}. ${r.pieceTitle}${r.pieceSlug ? ` — https://canopticon.com/library/${r.pieceSlug}` : ""}`,
        )
        .join("\n")}`
    : "";
  const subjectCount = sections.length;
  return `# ${title}

*Compiled from ${subjectCount} signed subject${subjectCount === 1 ? "" : "s"} on file · canopticon.com*

## Abstract

${abstract}

${body}${refs}
`;
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
