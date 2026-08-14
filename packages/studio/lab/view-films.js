/* CANOPTICON — your films. A list, and nothing else. */
let LIB = { error: null };

async function filmsRefresh() {
  try {
    window.PROJECTS = await listProjects();
    LIB.error = null;
  } catch (e) {
    window.PROJECTS = window.PROJECTS || [];
    LIB.error = e.message;
  }
  if (APP.view === "films") render();
}

function adoptFilm() {
  const f = window.FILM;
  f.bends = f.bends || {};
  f.continuity = f.continuity || "cut";
  f.cutScenes = f.cutScenes || [];
  APP.sel = f.scenes[0].id;
  APP.past = [];
  APP.future = [];
  APP.dirty = false;
  APP.cost = "";
  APP.heard = null;
  APP.said = "";
  APP.alts = null;
  PLAY.t = 0;
  PLAY.on = false;
  window.__lastRun = dryRun();
  commit(window.__lastRun);
  if (window.FILM_CHAINS) FILM_CHAINS.clear();
  APP.view = "read";
  render();
}

async function openFilm(id) {
  busy(true, "compiling the film");
  try {
    await loadProject(id);
    adoptFilm();
  } catch (e) {
    LIB.error = e.message;
    APP.view = "films";
    render();
  } finally {
    busy(false);
  }
}
function useExample() {
  loadDemo();
  adoptFilm();
}

function viewFilms(root) {
  const ps = window.PROJECTS || [];
  root.innerHTML = `<div class="page"><div class="wrap">
    <div class="head"><span class="col"><span class="eyebrow">Library</span><h1>Films</h1><p class="sub">Every film is a piece of writing that has been compiled. Open one to direct it.</p></span><span class="meta">${ps.length} stored</span></div>
    ${LIB.error ? `<div class="notice"><i class="dot clay"></i><span>Can't reach the compiler — ${esc(LIB.error)}. Stored films are safe on the server. The example film runs entirely in this page.<br><button class="b sm" id="retry" style="margin-top:10px">Try again</button></span></div>` : ""}
    <div style="display:flex;gap:8px;margin-bottom:var(--s6)">
      <button class="b pri" id="new">Make a film</button>
      <button class="b" id="ex">Open the example</button>
    </div>
    ${ps.length
      ? `<span class="key">Yours · ${ps.length}</span><div class="filmlist">${ps.map((p) => `<span class="filmrow"><button class="filmopen" data-open="${p.projectId}">
          <span><b>${esc(p.title || "Untitled")}</b><p>${p.acts ? `${p.acts} part${p.acts === 1 ? "" : "s"}` : "Not yet cut"}${p.stale ? ` · ${p.stale} to re-record` : ""}</p></span>
          <span class="m">${p.scenes ?? "—"} moments</span>
          <span class="m">${p.narrated ? (p.narrated >= (p.scenes || 0) ? "narrated" : `${p.narrated}/${p.scenes} voiced`) : "silent"}</span></button><button class="b q sm filmdel" data-del="${p.projectId}" title="Delete this film">Delete</button></span>`).join("")}</div>`
      : `<div class="empty"><h2 style="margin-bottom:8px">Nothing here yet</h2><p class="note">Make one from something you have already written. CANOPTICON reads it, cuts it into moments, and composes a shot for every sentence — then you direct what it made.</p></div>`}
  </div></div>`;
  const on = (id, fn) => {
    const el = root.querySelector(id);
    if (el) el.onclick = fn;
  };
  on("#new", () => go("start"));
  on("#ex", useExample);
  on("#retry", filmsRefresh);
  root.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openFilm(b.dataset.open)));
  /* DELETE. The library grew monotonically — no delete, no rename, no way
   * to get rid of a test film. `deleteProject` has existed in the bridge
   * since it was written and was called from nowhere. */
  root.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    const row = b.closest(".filmrow");
    const name = row ? (row.querySelector("b") || {}).textContent : "this film";
    if (!confirm(`Delete “${name}”? The writing, the plan and any recorded voice go with it.`)) return;
    b.disabled = true;
    try {
      await deleteProject(b.dataset.del);
      if (window.STUDIO && window.STUDIO.projectId === b.dataset.del) loadDemo();
      await filmsRefresh();
      render();
      toast("Deleted");
    } catch (err) {
      b.disabled = false;
      toast("Could not delete — " + err.message);
    }
  }));
}

Object.assign(window, { viewFilms, filmsRefresh, openFilm, useExample, adoptFilm });
