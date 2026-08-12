/* CANOPTICON — the front door.
 *
 * Until now studio.canopticon.com served a page with one essay compiled
 * into it. It made no network calls at all, so there was no list to be on
 * and nothing you did was stored — which is exactly what it looked like:
 * one film, permanently sitting there.
 *
 * This is the surface that makes the database real from a browser. Paste an
 * essay, get a project. It appears in the list with every other one. Open
 * its Preview and watch it.
 *
 * The three-step shape below is the standing rule made visible rather than
 * merely obeyed:
 *
 *   INGEST   deterministic, free, instant. No model sees the essay.
 *   READ     the one model call, bounded, resumable, and it may decline.
 *   RATIFY   the human act. Nothing else can mark a reading approved.
 *
 * A project that has been ingested and never read is a complete, watchable
 * film — the abstraction curve carries the scenes nobody has read, and any
 * scene carrying a figure reaches the data family on the prose alone. That
 * is why READ is a button and not a step you are forced through.
 */

const API = "/v1";
const el = (id) => document.getElementById(id);
let projects = [];
let busy = false;

function say(msg, kind) {
  const s = el("status");
  s.textContent = msg;
  s.className = `status${kind ? ` ${kind}` : ""}`;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

async function api(path, options) {
  const res = await fetch(API + path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`);
  return body;
}

function when(iso) {
  if (!iso) return "never";
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toISOString().slice(0, 10);
}

function render() {
  const list = el("list");
  if (projects.length === 0) {
    list.innerHTML = `<p class="empty">No projects yet. Paste an essay below — segmentation is
      deterministic and costs nothing, so there is no reason not to try one.</p>`;
    return;
  }
  list.innerHTML = projects
    .map(
      (p) => `
    <article class="proj" data-id="${escapeHtml(p.projectId)}">
      <div class="proj-main">
        <h2>${escapeHtml(p.title)}</h2>
        <div class="proj-meta">
          ${p.scenes} scenes · ${p.acts} acts ·
          <span class="${p.readings > 0 ? "read" : "unread"}">${p.readings} read</span> ·
          IR v${p.irVersion} ·
          ${p.lastCompiledAt ? `compiled ${when(p.lastCompiledAt)} (${p.lastNodes} nodes)` : "never compiled"}
        </div>
      </div>
      <div class="proj-actions">
        <a class="btn primary" href="film.html?project=${encodeURIComponent(p.projectId)}">WATCH</a>
        <button class="btn" data-act="read" type="button">READ 12</button>
        <button class="btn" data-act="compile" type="button">COMPILE</button>
        <button class="btn danger" data-act="delete" type="button">DELETE</button>
      </div>
    </article>`,
    )
    .join("");

  for (const node of list.querySelectorAll("[data-act]")) {
    node.onclick = () => act(node.dataset.act, node.closest(".proj").dataset.id);
  }
}

async function refresh() {
  try {
    const body = await api("/projects");
    projects = body.projects;
    render();
  } catch (err) {
    say(`could not reach the compiler — ${err.message}`, "bad");
  }
}

async function act(kind, projectId) {
  if (busy) return;
  busy = true;
  try {
    if (kind === "read") {
      // Bounded per call by the route, and resumable: it always takes the
      // next unread scenes, so pressing it again continues rather than
      // starting over.
      say("proposing readings — the one model call in the system…");
      const r = await api(`/project/${projectId}/read`, {
        method: "POST",
        body: JSON.stringify({ limit: 12 }),
      });
      say(
        r.proposed === 0 && r.remaining === 0
          ? "every scene has been read"
          : `${r.proposed} proposed, ${r.declined} declined, ${r.remaining} still unread — declining is a result, not a failure`,
      );
    } else if (kind === "compile") {
      say("compiling…");
      const r = await api(`/project/${projectId}/compile`, { method: "POST" });
      say(
        `${r.cache.total} nodes · ${r.cache.misses} recomputed · ${r.cache.hits} cached · ` +
          `${r.determinism} · ${r.ttsCalls} TTS calls · ${r.wallMs}ms`,
      );
    } else if (kind === "delete") {
      const p = projects.find((x) => x.projectId === projectId);
      if (!confirm(`Delete "${p ? p.title : projectId}" and all its versions?`)) return;
      await api(`/project/${projectId}`, { method: "DELETE" });
      say("deleted");
    }
    await refresh();
  } catch (err) {
    say(err.message, "bad");
  } finally {
    busy = false;
  }
}

async function ingest() {
  const essay = el("essay").value.trim();
  if (!essay) {
    say("paste an essay first", "bad");
    return;
  }
  if (busy) return;
  busy = true;
  try {
    say("segmenting…");
    const r = await api("/project/ingest", {
      method: "POST",
      body: JSON.stringify({ essay }),
    });
    // The segmenter's own notes, verbatim. It reports what it noticed and
    // could not act on rather than presenting a clean result.
    say(
      `${r.title} — ${r.scenes} scenes, ${r.acts} acts, ${r.scenesWithFigures} carrying figures. ` +
        (r.notes || []).join(" · "),
    );
    el("essay").value = "";
    await refresh();
  } catch (err) {
    say(err.message, "bad");
  } finally {
    busy = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  el("ingest").onclick = ingest;
  refresh();
});
