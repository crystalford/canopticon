// Not-found page for the public site.

import { escapeHtml, renderPage } from "../layout";

export function renderNotFound(slug?: string): string {
  const body = `
<section style="margin-bottom:40px">
  <div class="kicker" style="margin-bottom:18px">404 · not found</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.15;letter-spacing:-0.015em;margin:0 0 14px;color:var(--ink)">We don't have a page here.</h1>
  <p style="font-family:var(--serif);font-size:17px;line-height:1.55;color:var(--ink-2);max-width:680px">
    Nothing lives at <code style="font-family:var(--mono);font-size:13.5px;background:var(--paper-2);padding:1.5px 6px;border-radius:4px">${escapeHtml(slug ?? "")}</code>.
    Try the front page or jump into the record from the navigation above.
  </p>
  <p style="margin-top:24px"><a href="/" class="btn accent">Front page</a></p>
</section>
`;
  return renderPage({
    title: "Not found",
    description: "Page not found.",
    body,
    activeNav: "/",
    zone: "404",
  });
}
