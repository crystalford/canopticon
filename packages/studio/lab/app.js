/* CANOPTICON — shell, router, shared UI. */
const MARK = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
<path d="M17.55 15.59A8 8 0 1 0 17.55 6.41" stroke="#626a71" stroke-width="1.2" stroke-dasharray="1.4 2.7" stroke-linecap="round"/>
<path d="M14.69 13.58A4.5 4.5 0 1 0 14.69 8.42" stroke="#eef1f3" stroke-width="1.3" stroke-linecap="round"/>
<circle cx="11" cy="11" r="1.6" fill="#d8624a"/></svg>`;

const VIEWS = [
  ["films", "FILMS"],
  ["narrative", "NARRATIVE"],
  ["editorial", "EDITORIAL"],
  ["preview", "PREVIEW"],
  ["compile", "COMPILE"],
  ["lab", "LAB"],
];
const APP = { view: "films", dirty: false, saveState: "", sel: "s07", labPrim: "particle_seek", loops: [] };

function stopLoops() {
  APP.loops.forEach((t) => (t.alive = false));
  APP.loops = [];
}
function loop(fn) {
  const tok = { alive: true };
  APP.loops.push(tok);
  const t0 = performance.now();
  const step = (now) => {
    if (!tok.alive) return;
    fn((now - t0) / 1000);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function go(v) {
  APP.view = v;
  stopLoops();
  render();
}
/* THE EDIT ACTUALLY SAVES.
 *
 * Dragging a curve used to mutate the in-memory film and light a DIRTY
 * lamp, and that was all — nothing was written, so the system's central
 * claim (re-style a film for free, and only recompute what moved) was a
 * demonstration of itself.
 *
 * Now an edit debounces into a new IR version and a recompile, and the bar
 * reports what the edit COST: how many primitives had to be recomputed out
 * of how many, with zero TTS calls, which is the number that makes the
 * argument. The example has nothing behind it and stays local.
 */
let SAVE_TIMER = null;
let SAVING = false;
function markDirty() {
  APP.dirty = true;
  renderBar();
  if (!window.STUDIO || window.STUDIO.demo || !window.STUDIO.projectId) return;
  clearTimeout(SAVE_TIMER);
  // Long enough that a drag is one save, short enough to feel immediate.
  SAVE_TIMER = setTimeout(saveNow, 600);
}

async function saveNow() {
  if (SAVING || !window.STUDIO.projectId) return;
  SAVING = true;
  APP.saveState = "saving";
  renderBar();
  try {
    const r = await saveCreativeState();
    // Reload so the views show what the COMPILER made of the edit rather
    // than what the browser hoped it would make of it.
    await loadProject(window.STUDIO.projectId);
    window.__lastRun = dryRun();
    commit(window.__lastRun);
    APP.dirty = false;
    APP.saveState = r
      ? `v${r.irVersion} · ${r.cache.misses}/${r.cache.total} recomputed · ${r.ttsCalls} TTS`
      : "saved";
    render();
  } catch (err) {
    APP.saveState = `not saved — ${err.message}`;
    renderBar();
  } finally {
    SAVING = false;
  }
}

function renderBar() {
  const run = window.__lastRun;
  document.getElementById("bar").innerHTML = `<div class="logo">${MARK}<b>CANOPTICON</b></div>
   <div class="nav">${VIEWS.map(([id, l]) => `<button class="${APP.view === id ? "on" : ""}" data-go="${id}">${l}</button>`).join("")}</div>
   <div class="barstate">
     <span title="${window.FILM.title.replace(/"/g, "&quot;")}">${window.FILM.title.length > 42 ? window.FILM.title.slice(0, 40).toUpperCase() + "…" : window.FILM.title.toUpperCase()}</span>
     ${window.STUDIO && window.STUDIO.demo ? '<span class="tag">EXAMPLE</span>' : ""}
     <span>IR v${window.FILM.irVersion}</span>
     <span class="${APP.dirty ? "dirty" : ""}"><i class="led ${APP.dirty ? "w" : ""}"></i>${APP.dirty ? "DIRTY — " + dirtyCount() + " SCENES" : "COMPILED"}</span>
     ${APP.saveState ? `<span class="savestate">${APP.saveState}</span>` : ""}
     <span>${fmt(window.FILM.runtime)}</span>
   </div>`;
  document.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
}
function dirtyCount() {
  const r = dryRun();
  return r.comps.filter((c) => c.misses > 0).length;
}
function fmt(s) {
  const m = Math.floor(s / 60);
  return m + ":" + String(Math.round(s % 60)).padStart(2, "0");
}

/* shared: slider control */
function sliderHTML(id, name, val, lo, hi, disp) {
  const n = 20,
    f = Math.round(val * n);
  let b = "";
  for (let i = 0; i < n; i++) b += `<s class="${i < f - 1 ? "f" : i === f - 1 ? "h" : ""}"></s>`;
  return `<div class="sl" data-sl="${id}"><div class="slh"><span>${name}</span><i>${disp !== undefined ? disp : val.toFixed(2)}</i></div>
  <div class="bars">${b}</div><div class="ends"><span>${lo}</span><span>${hi}</span></div></div>`;
}
function bindSliders(root, get, set) {
  root.querySelectorAll("[data-sl]").forEach((el) => {
    const id = el.dataset.sl;
    const upd = (e) => {
      const r = el.querySelector(".bars").getBoundingClientRect();
      set(id, clamp((e.clientX - r.left) / r.width, 0, 1));
    };
    el.onpointerdown = (e) => {
      el.setPointerCapture(e.pointerId);
      upd(e);
      el.onpointermove = (ev) => {
        if (ev.buttons) upd(ev);
      };
      el.onpointerup = () => {
        el.onpointermove = null;
      };
    };
  });
}

function render() {
  renderBar();
  const v = document.getElementById("view");
  ({
    films: viewFilms,
    narrative: viewNarrative,
    editorial: viewEditorial,
    preview: viewPreview,
    compile: viewCompile,
    lab: viewLab,
  })[APP.view](v);
}
window.addEventListener("DOMContentLoaded", async () => {
  window.__lastRun = dryRun();
  commit(window.__lastRun);
  render();
  // The list, and then the film you were last looking at. Reopening on the
  // example every time is what made this feel like it had no memory.
  await filmsRefresh();
  const last = lastProjectId();
  if (last && PROJECTS.some((p) => p.projectId === last)) {
    await openFilm(last);
  } else {
    render();
  }
});
function M(o) {
  return Object.entries(o)
    .map(([k, v]) => `<div class="mrow"><span>${k}</span><i>${v}</i></div>`)
    .join("");
}
Object.assign(window, {
  APP,
  M,
  go,
  render,
  renderBar,
  markDirty,
  saveNow,
  sliderHTML,
  bindSliders,
  fmt,
  loop,
  stopLoops,
  MARK,
});
