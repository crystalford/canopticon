// The workspace's live layer.
//
// Deliberately separate from research-workspace.ts, which renders the same
// panels on the server. That separation is the contract: the page is COMPLETE
// at load — every source found so far, the whole plan, the next action — and
// this only keeps it current. Turn JavaScript off and the workspace still
// works; you refresh instead of watching.
//
// It replaces innerHTML per panel rather than rebuilding the page, so a source
// list the operator is reading does not jump, and it re-uses the server's own
// markup by asking for it: the status endpoint returns data, and the same
// render functions run here in string form. There is one renderer, not two.

export const RESEARCH_LIVE_JS = `<script>
(function () {
  var root = document.querySelector(".rw");
  if (!root) return;
  var url = root.getAttribute("data-poll-url");
  var at = function (k) { return root.querySelector('[data-rw="' + k + '"]'); };
  var esc = function (t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  function state(s) {
    var cls = s.warn ? "warn" : s.terminal ? "rest" : "run";
    return '<span class="rw-dot rw-dot-' + cls + '"></span>' +
      '<span class="rw-headline">' + esc(s.headline || "") + "</span>";
  }

  function plan(s) {
    var p = s.plan || [];
    if (!p.length) return '<li class="rw-step rw-step-running">Opening search</li>';
    return p.map(function (q) {
      return '<li class="rw-step rw-step-' + esc(q.state) + '">' +
        '<span class="rw-mark"></span>' +
        '<span class="rw-step-q">' + esc(q.query) + "</span>" +
        (q.opening ? '<span class="rw-tag">your question</span>' : "") +
        "</li>";
    }).join("");
  }

  function sources(s) {
    var list = s.sources || [];
    if (!list.length) {
      return '<li class="rw-empty">Nothing read yet. Sources appear here as they are fetched.</li>';
    }
    return list.map(function (x) {
      var meta = esc(x.domain) +
        (x.chars ? " \\u00b7 " + Math.round(x.chars / 1000) + "k" : "") +
        (x.state === "duplicate" ? " \\u00b7 already held" : "") +
        (x.state === "rejected" ? " \\u00b7 rejected \\u2014 " + esc(x.reason || "unusable") : "");
      return '<li class="rw-src rw-src-' + esc(x.state) + '">' +
        '<a href="' + esc(x.url) + '" rel="nofollow noopener" target="_blank">' +
        esc(x.title) + "</a>" +
        '<span class="rw-src-meta">' + meta + "</span></li>";
    }).join("");
  }

  function metrics(s) {
    var kept = (s.sources || []).filter(function (x) { return x.state === "banked"; }).length;
    var rejected = (s.sources || []).filter(function (x) { return x.state === "rejected"; }).length;
    var w = s.writer === "anthropic" ? "Claude" : s.writer === "workers_ai" ? "Workers AI" : "default";
    return '<div class="rw-metric"><dt>Sources kept</dt><dd>' + kept + "</dd></div>" +
      '<div class="rw-metric"><dt>Rejected</dt><dd>' + rejected + "</dd></div>" +
      '<div class="rw-metric rw-metric-writer"><dt>Writer</dt><dd>' + esc(w) + "</dd></div>";
  }

  function actions(s) {
    var review = (s.draft && s.draft.reviewUrl) || s.reviewUrl;
    if (review) {
      return '<a class="rw-btn rw-btn-primary" href="' + esc(review) + '">Read the draft \\u2192</a>';
    }
    if (s.action && s.action.postTo) {
      return '<form method="POST" action="' + esc(s.action.postTo) + '">' +
        (s.action.returnTo
          ? '<input type="hidden" name="return_to" value="' + esc(s.action.returnTo) + '" />'
          : "") +
        '<button type="submit" class="rw-btn rw-btn-primary">' + esc(s.action.label) +
        "</button></form>";
    }
    return '<div class="rw-working">Working\\u2026</div>';
  }

  function paint(s) {
    var set = function (k, html) { var el = at(k); if (el) el.innerHTML = html; };
    set("state", state(s));
    set("plan", plan(s));
    set("sources", sources(s));
    set("metrics", metrics(s));
    set("actions", actions(s));
    var pc = at("plan-count"); if (pc) pc.textContent = String((s.plan || []).length);
    var sc = at("src-count"); if (sc) sc.textContent = String((s.sources || []).length);
  }

  // THE BROWSER IS THE SCHEDULER. A research run is four model-heavy steps and
  // each must be its own Worker execution or it exceeds Cloudflare's ceiling.
  // Standing rule 4 forbids a cron and is right to: an idle site should cost
  // nothing. But a person who started this run and is watching it IS the
  // attendance the rule means, so the page takes the next step for them.
  // Close the tab and it stops. The button stays on screen either way.
  var autoLeft = 6;
  var lastAuto = "";
  function poll() {
    fetch(url, { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        paint(s);
        var act = s.action;
        if (act && act.auto && autoLeft > 0 && lastAuto !== act.label) {
          autoLeft--;
          lastAuto = act.label;
          var body = new URLSearchParams();
          body.set("no_redirect", "1");
          fetch(act.postTo, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          }).catch(function () {}).then(function () { setTimeout(poll, 700); });
          return;
        }
        // A finished run stops polling. A waiting one does too — it cannot
        // change without a press, and the press is on screen.
        if (!s.terminal) setTimeout(poll, 1400);
      })
      .catch(function () { setTimeout(poll, 3000); });
  }
  poll();
})();
</script>`;
