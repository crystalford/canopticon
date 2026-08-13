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
  ["overview", "OVERVIEW"],
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

/** A film compiles on open, and an eighty-eight scene investigation takes a
 *  couple of seconds. Without this the window simply stopped responding and
 *  the only signal was that nothing happened — which reads as broken, not
 *  as working. */
function busy(on, what) {
  let el = document.getElementById("busy");
  if (!on) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.id = "busy";
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="busy-box"><i></i>${what || "working"}</div>`;
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
    busy(false);
    SAVING = false;
  }
}

function renderBar() {
  const run = window.__lastRun;
  document.getElementById("bar").innerHTML = `<div class="logo">${MARK}<b>CANOPTICON</b></div>
   <div class="nav">${VIEWS.map(([id, l]) => `<button class="${APP.view === id ? "on" : ""}" data-go="${id}">${l}</button>`).join("")}</div>
   <div class="keyhint" id="keyhint"></div>
   <div class="barstate">
     <span title="${window.FILM.title.replace(/"/g, "&quot;")}">${window.FILM.title.length > 42 ? window.FILM.title.slice(0, 40).toUpperCase() + "…" : window.FILM.title.toUpperCase()}</span>
     ${window.STUDIO && window.STUDIO.demo ? '<span class="tag">EXAMPLE</span>' : ""}
     <span>IR v${window.FILM.irVersion}</span>
     <span class="${APP.dirty ? "dirty" : ""}"><i class="led ${APP.dirty ? "w" : ""}"></i>${APP.dirty ? "DIRTY — " + dirtyCount() + " SCENES" : "COMPILED"}</span>
     ${APP.saveState ? `<span class="savestate">${APP.saveState}</span>` : ""}
     <span>${fmt(window.FILM.runtime)}</span>
   </div>`;
  document.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
  const hint = document.getElementById("keyhint");
  if (hint) {
    hint.innerHTML = KEYS.map(([k, what]) => `<span><kbd>${k}</kbd>${what}</span>`).join("");
  }
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
    overview: viewOverview,
    narrative: viewNarrative,
    editorial: viewEditorial,
    preview: viewPreview,
    compile: viewCompile,
    lab: viewLab,
  })[APP.view](v);
}
/* ── KEYBOARD ─────────────────────────────────────────────────────────
 *
 * There was none. On a nine-scene example that is a preference; on an
 * eighty-eight scene investigation it is the difference between an
 * instrument and a form, because every act of comparison — this scene
 * against the next, this rung against the one below — was a mouse
 * round-trip to a list.
 *
 * Nothing here is a chord. A director's hands are on the arrow keys.
 */
const KEYS = [
  ["1–6", "switch view"],
  ["← →", "previous / next scene"],
  ["space", "play · pause"],
  ["/", "find a scene"],
  ["esc", "films"],
];

function stepScene(delta) {
  const scenes = window.FILM.scenes;
  if (!scenes.length) return;
  const at = Math.max(0, scenes.findIndex((s) => s.id === APP.sel));
  const next = scenes[Math.min(scenes.length - 1, Math.max(0, at + delta))];
  if (!next) return;
  APP.sel = next.id;
  // Moving the selection moves the playhead, so Preview and Editorial agree
  // about which scene is being looked at.
  PLAY.t = next.t0 + 0.01;
  render();
}

function onKey(e) {
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea") {
    if (e.key === "Escape") e.target.blur();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  const viewKey = VIEWS[Number(e.key) - 1];
  if (viewKey) {
    e.preventDefault();
    go(viewKey[0]);
    return;
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    stepScene(1);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    stepScene(-1);
  } else if (e.key === " ") {
    e.preventDefault();
    PLAY.on = !PLAY.on;
    const pp = document.getElementById("pp");
    if (pp) pp.textContent = PLAY.on ? "PAUSE" : "PLAY";
  } else if (e.key === "/") {
    e.preventDefault();
    openFinder();
  } else if (e.key === "Escape") {
    if (document.getElementById("finder")) closeFinder();
    else go("films");
  }
}

/* ── SCENE FINDER ─────────────────────────────────────────────────────
 *
 * Search the film by its own prose. An investigation's scenes are
 * sentences, so the only search term anyone actually has is a phrase they
 * remember reading — "Niagara", "$282", "nothing changed" — and matching
 * on the narration is both the simplest implementation and the only one
 * that fits how a director thinks about their own essay.
 */
function openFinder() {
  if (document.getElementById("finder")) return;
  const el = document.createElement("div");
  el.id = "finder";
  el.innerHTML = `<div class="finder-box">
    <input id="finder-q" placeholder="find a scene — by what it says" autocomplete="off">
    <div id="finder-list"></div>
  </div>`;
  document.body.appendChild(el);
  el.onclick = (e) => {
    if (e.target === el) closeFinder();
  };
  const q = document.getElementById("finder-q");
  q.oninput = () => paintFinder(q.value);
  q.onkeydown = (e) => {
    if (e.key === "Enter") {
      const first = document.querySelector("#finder-list [data-jump]");
      if (first) jumpTo(first.dataset.jump);
    }
  };
  q.focus();
  paintFinder("");
}

function paintFinder(term) {
  const t = term.trim().toLowerCase();
  const hits = window.FILM.scenes
    .filter((s) => !t || s.text.toLowerCase().includes(t) || s.label.toLowerCase().includes(t))
    .slice(0, 40);
  document.getElementById("finder-list").innerHTML = hits.length
    ? hits
        .map(
          (s) => `<button class="finder-row" data-jump="${s.id}">
        <b>${String(s.n).padStart(2, "0")}</b>
        <span>${s.text.replace(/[<>&]/g, "").slice(0, 96)}</span>
        <i>${s.fn.toUpperCase()} · ${fmt(s.t0)}</i></button>`,
        )
        .join("")
    : `<p class="finder-empty">Nothing in this film says that.</p>`;
  for (const b of document.querySelectorAll("#finder-list [data-jump]")) {
    b.onclick = () => jumpTo(b.dataset.jump);
  }
}

function jumpTo(sceneId) {
  const s = window.FILM.scenes.find((x) => x.id === sceneId);
  if (!s) return;
  APP.sel = sceneId;
  PLAY.t = s.t0 + 0.01;
  closeFinder();
  render();
}

function closeFinder() {
  const el = document.getElementById("finder");
  if (el) el.remove();
}

window.addEventListener("keydown", onKey);

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
  busy,
  openFinder,
  jumpTo,
  stepScene,
  KEYS,
  sliderHTML,
  bindSliders,
  fmt,
  loop,
  stopLoops,
  MARK,
});
