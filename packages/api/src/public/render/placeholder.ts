// Not-found page for the public site.

import { escapeHtml, renderPage } from "../layout";

export function renderNotFound(slug?: string): string {
  const body = `
<section style="margin-bottom:40px">
  <div class="kicker" style="margin-bottom:18px">404 · not found</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.15;letter-spacing:-0.015em;margin:0 0 14px;color:var(--ink)">We don't have a page here.</h1>
  <p style="font-family:var(--serif);font-size:17px;line-height:1.55;color:var(--ink-2);max-width:680px">
    Nothing lives at <code style="font-family:var(--mono);font-size:13.5px;background:var(--paper-2);padding:1.5px 6px;border-radius:4px">${escapeHtml(slug ?? "")}</code>.
    Try the front page, or the navigation above.
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

// Server-error page for the public site. Previously an unhandled exception
// on any route — API or public — fell through to one global JSON error
// handler, so a transient D1 hiccup mid-page-load showed a reader raw
// {"error":{"code":"internal_error",...}} JSON instead of a page. Mirrors
// the app.notFound split (JSON for /v1/*, styled HTML for public) for 500s.
export function renderServerError(traceId: string): string {
  const body = `
<section style="margin-bottom:40px">
  <div class="kicker" style="margin-bottom:18px">500 · something went wrong</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.15;letter-spacing:-0.015em;margin:0 0 14px;color:var(--ink)">That didn't load.</h1>
  <p style="font-family:var(--serif);font-size:17px;line-height:1.55;color:var(--ink-2);max-width:680px">
    Something failed on our end, not yours — usually transient. Reloading the page
    normally works; if a search or a research request timed out mid-flight, the work
    it started keeps going in the background regardless.
  </p>
  <p style="font-family:var(--mono);font-size:12px;color:var(--ink-mute);margin-top:18px">Reference: ${escapeHtml(traceId)}</p>
  <p style="margin-top:24px"><a href="/" class="btn accent">Front page</a></p>
</section>
`;
  return renderPage({
    title: "Something went wrong",
    description: "A temporary error.",
    body,
    activeNav: "/",
    zone: "error",
  });
}
