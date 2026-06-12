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
//   card    — X (1200×630) and IG (1080×1080)
//   thread  — X post card (1200×675), produced once per post
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

// CSS variables the face renderers reference. Defined here so the
// stripped-down Produce doc has the same colours and typography as the
// in-site preview. Kept in sync with packages/api/src/public/styles.ts.
const FACE_VARS = `
  :root {
    --ink: #0c0d10;
    --paper: #faf6ef;
    --ink-3: #8a867c;
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
