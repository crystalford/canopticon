// Live-polling status banner — replaces the old <meta http-equiv="refresh">
// full-page-reload loop that used to drive "Research this" / "Expand this
// file" progress. A meta-refresh reloads the ENTIRE page (nav, styles,
// everything) every 5 seconds regardless of whether anything changed,
// which reads as broken/janky rather than "working" — and it only ever
// showed getExpandStatus's single collapsed line, no detail. This polls a
// small JSON endpoint (operator/routes.ts's GET /op/research-status) via
// fetch() every ~1.5s and updates a milestone checklist in place — no
// navigation, no flash, and enough detail to see which stage it's actually
// on. Vanilla JS, no build step — same pattern as investigations.ts's
// upload-dropzone script. Operator-only surface; not a reading page, so
// this doesn't touch the "no JS required to read" rule.

import { escapeAttr, escapeHtml } from "../layout";

/** `pollUrl` should already be a full, correctly-encoded path+query
 *  (e.g. `/op/research-status?q=${encodeURIComponent(label)}`). */
export function renderLiveStatusBanner(pollUrl: string, initialHeadline: string): string {
  const id = `live-status-${Math.random().toString(36).slice(2, 10)}`;
  return `<aside class="live-status" id="${id}" data-poll-url="${escapeAttr(pollUrl)}" aria-live="polite">
  <div class="live-status-head">
    <span class="live-status-dot"></span>
    <span class="live-status-headline">${escapeHtml(initialHeadline)}</span>
  </div>
  <ul class="live-status-steps"></ul>
  <div class="live-status-review" hidden></div>
</aside>
${LIVE_STATUS_STYLES}
<script>
(function () {
  var root = document.getElementById(${JSON.stringify(id)});
  if (!root) return;
  var url = root.getAttribute("data-poll-url");
  var headlineEl = root.querySelector(".live-status-headline");
  var dotEl = root.querySelector(".live-status-dot");
  var stepsEl = root.querySelector(".live-status-steps");
  var reviewEl = root.querySelector(".live-status-review");
  var MARK = { done: "\\u2713", warn: "!", active: "\\u2026", pending: "\\u00b7" };
  function render(s) {
    headlineEl.textContent = s.headline || "";
    stepsEl.innerHTML = "";
    (s.steps || []).forEach(function (step) {
      var li = document.createElement("li");
      li.className = "live-status-step live-status-step-" + step.state;
      var text = (MARK[step.state] || "\\u00b7") + " " + step.label;
      if (step.detail) text += " \\u2014 " + step.detail;
      li.textContent = text;
      stepsEl.appendChild(li);
    });
    if (s.reviewUrl) {
      reviewEl.hidden = false;
      reviewEl.innerHTML = "";
      var a = document.createElement("a");
      a.href = s.reviewUrl;
      a.textContent = "Review the draft \\u2192";
      reviewEl.appendChild(a);
    }
    var done = !!s.terminal && !s.warn;
    root.classList.toggle("live-status-done", done);
    root.classList.toggle("live-status-warn", !!s.warn);
    dotEl.classList.toggle("live-status-dot-done", done);
    dotEl.classList.toggle("live-status-dot-warn", !!s.warn);
  }
  function poll() {
    fetch(url, { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        render(s);
        if (!s.terminal) setTimeout(poll, 1500);
      })
      .catch(function () { setTimeout(poll, 3000); });
  }
  poll();
})();
</script>`;
}

const LIVE_STATUS_STYLES = `<style>
  .live-status { margin: 0 0 22px; padding: 14px 18px; border: 1px solid var(--accent-bd, #c4d1e3);
    border-radius: 8px; background: var(--accent-bg, #e8ecf3); }
  .live-status-done { background: var(--confirmed-bg, #e7f0e6); border-color: var(--confirmed-bd, #bcd6bd); }
  .live-status-warn { background: var(--correction-bg, #f6e4df); border-color: var(--correction-bd, #e2bdb2); }
  .live-status-head { display: flex; align-items: center; gap: 11px; font-family: var(--serif); font-size: 14.5px; color: var(--ink-2); }
  .live-status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent, #6b8fc4); flex-shrink: 0;
    animation: live-status-pulse 1.4s ease-in-out infinite; }
  .live-status-dot-done, .live-status-dot-warn { animation: none; }
  .live-status-dot-done { background: var(--confirmed, #5a9e5f); }
  .live-status-dot-warn { background: var(--correction, #c4816a); }
  @keyframes live-status-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
  .live-status-steps { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  .live-status-step { font-family: var(--mono); font-size: 12px; color: var(--ink-3); }
  .live-status-step-done { color: var(--ink-2); }
  .live-status-step-active { color: var(--accent); }
  .live-status-step-warn { color: var(--correction, #c4816a); }
  .live-status-review { margin-top: 10px; font-family: var(--mono); font-size: 12.5px; }
  .live-status-review a { color: var(--accent); text-decoration: none; }
  .live-status-review a:hover { text-decoration: underline; }
</style>`;
