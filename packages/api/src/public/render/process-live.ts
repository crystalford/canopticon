// The library's live layer — the poller that drives the pipeline.
//
// THE BROWSER IS THE SCHEDULER (standing rule 4). `POST /op/process/advance`
// does one bounded step for one document and returns; this presses it again
// while the tab is open and nothing is running when it is closed. The page is
// complete without it: every row's status is server-rendered, and turning
// JavaScript off leaves a page you refresh instead of watch. Operator-only —
// the reader page needs no script (rule 7).
//
// It never starts unless the server says something is waiting
// (`data-lib-active` > 0), so an idle library costs nothing.

export const PROCESS_LIVE_JS = `<script>
(function () {
  var q = document.getElementById("lib-queue");
  if (!q || !(Number(q.getAttribute("data-lib-active")) > 0)) return;
  var STATES = ["lib-st-none", "lib-st-queued", "lib-st-running", "lib-st-done", "lib-st-failed"];
  var failures = 0;

  function paintRow(r) {
    if (!r || !r.piece_id || !r.status) return;
    var cell = document.querySelector('[data-piece="' + r.piece_id + '"]');
    if (!cell) return;
    for (var i = 0; i < STATES.length; i++) cell.classList.remove(STATES[i]);
    cell.classList.add("lib-st-" + r.status.state);
    cell.textContent = r.status.text;
    if (r.note) cell.setAttribute("title", r.note);
  }

  function paintQueue(remaining) {
    q.removeAttribute("hidden");
    q.textContent = remaining > 0
      ? remaining + " waiting \\u00b7 processing while this tab is open"
      : "Done \\u2014 reloading";
  }

  function step() {
    fetch("/op/process/advance", {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (r) {
        failures = 0;
        paintRow(r);
        paintQueue(r.remaining);
        if (r.remaining > 0) {
          // piece_id null with work left means another tab holds the row
          // (its heartbeat is fresh); wait for it to go stale rather than spin.
          setTimeout(step, r.piece_id ? 300 : 5000);
          return;
        }
        // Everything ran. Receipts, findings and the lead passage are
        // server-rendered, so one reload shows them — there is one renderer.
        setTimeout(function () { location.reload(); }, 400);
      })
      .catch(function () {
        failures++;
        if (failures >= 5) {
          q.textContent = "Paused \\u2014 reload to continue";
          return;
        }
        setTimeout(step, 5000);
      });
  }
  step();
})();
</script>`;
