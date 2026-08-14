/* CANOPTICON — shell.
 *
 * Five actions, and that is the whole vocabulary of the product:
 *   CREATE   make the first version              (start)
 *   DIRECT   say what should change              (the dock)
 *   EDIT     change the argument itself          (the sentence)
 *   EXPLORE  see other readings of a sentence    (alternatives)
 *   RENDER   produce the film
 * Everything else is under the hood, and nobody has to go there.
 */
const PLAY = { t: 0, on: false, last: 0 };
const APP = {
  /* THE FRONT DOOR IS THE LIBRARY, and it is set here rather than
   * corrected after the fetch. This said "start", so the first paint was
   * always the CREATE page and a second paint swapped it for the list —
   * a visible flash of the wrong room on every single visit. Nothing
   * about the library needs the fetch to have landed: it renders its
   * empty state and fills in. */
  view: "films",
  sel: "s01",
  scope: "sentence",
  hood: false,
  hoodTab: "direct",
  editing: null,
  alts: null,
  said: "",
  heard: null,
  dirty: false,
  cost: "",
  eng: "compile",
  labPrim: "particle_seek",
  past: [],
  future: [],
  loops: [],
};

/* Director's verbs. The vocabulary is the director's; each one says what it
 * heard and what it will move. */
const VERBS = [
  { id: "stranger", label: "Stranger", heard: "Raise abstraction — let the material come apart.", d: { abstraction: 0.18, experimentalism: 0.1 } },
  { id: "ground", label: "Ground it", heard: "Lower abstraction — keep it photographable.", d: { abstraction: -0.2, archivalWeight: 0.1 } },
  { id: "quieter", label: "Quieter", heard: "Less motion, less on screen at once.", d: { motionEnergy: -0.18, visualDensity: -0.14 } },
  { id: "louder", label: "Louder", heard: "More motion, more on screen at once.", d: { motionEnergy: 0.18, visualDensity: 0.14 } },
  { id: "human", label: "More human", heard: "Bring a person back into the frame.", d: { humanPresence: 0.2 } },
  { id: "systemic", label: "More systemic", heard: "Pull back to the mechanism.", d: { humanPresence: -0.18, dataWeight: 0.14 } },
  { id: "type", label: "Louder type", heard: "Typography carries more of the argument.", d: { typographicWeight: 0.18 } },
  { id: "hold", label: "Let it breathe", heard: "Give the shot more time before the cut.", dur: 2 },
];
const INTENT_WORDS = [
  [/\b(strange|stranger|weird|unreal|abstract|dissolv|dream|memor)/i, "stranger"],
  [/\b(ground|literal|concrete|document|real|plain|observ)/i, "ground"],
  [/\b(quiet|calm|still|slow|restrain|breath|sparse|gentle)/i, "quieter"],
  [/\b(loud|urgent|fast|frantic|energ|dense|hard|oppress|claustroph)/i, "louder"],
  [/\b(human|person|people|face|body|intimate|warm)/i, "human"],
  [/\b(system|institution|mechanism|structur|scale|enormous|machine|city)/i, "systemic"],
  [/\b(type|typograph|word|text|letter)/i, "type"],
  [/\b(hold|linger|longer|dwell|wait|breathe)/i, "hold"],
];
const readIntent = (t) => {
  const hits = [];
  for (const [re, v] of INTENT_WORDS) if (re.test(t) && !hits.includes(v)) hits.push(v);
  return hits.map((h) => VERBS.find((x) => x.id === h));
};

const MARK = `<svg width="21" height="21" viewBox="0 0 22 22" fill="none" aria-hidden="true">
<path d="M17.55 15.59A8 8 0 1 0 17.55 6.41" stroke="#666f73" stroke-width="1.2" stroke-dasharray="1.4 2.7" stroke-linecap="round"/>
<path d="M14.69 13.58A4.5 4.5 0 1 0 14.69 8.42" stroke="#bdc4c6" stroke-width="1.3" stroke-linecap="round"/>
<circle cx="11" cy="11" r="1.6" fill="#a9c6b0"/></svg>`;

/* ── history ────────────────────────────────────────────────────────── */
function snapshot() {
  const f = window.FILM;
  return JSON.stringify({
    identity: f.identity, cps: f.controlPoints.map((c) => c.v), bends: f.bends || {},
    overrides: f.overrides, durs: f.scenes.map((s) => s.dur), texts: f.scenes.map((s) => s.text),
    lang: f.visualLanguage, colour: f.colour, continuity: f.continuity, cut: f.cutScenes || [],
  });
}
function restore(snap) {
  const s = JSON.parse(snap), f = window.FILM;
  f.identity = s.identity;
  s.cps.forEach((v, i) => f.controlPoints[i] && (f.controlPoints[i].v = v));
  f.bends = s.bends;
  f.overrides = s.overrides;
  s.durs.forEach((d, i) => f.scenes[i] && (f.scenes[i].dur = d));
  s.texts.forEach((t, i) => f.scenes[i] && (f.scenes[i].text = t));
  f.visualLanguage = s.lang;
  f.colour = s.colour;
  f.continuity = s.continuity;
  f.cutScenes = s.cut;
  retime();
  if (window.applyFilmPalette) applyFilmPalette();
}
function mark(what) {
  APP.past.push({ snap: snapshot(), what });
  if (APP.past.length > 40) APP.past.shift();
  APP.future = [];
}
function undo() {
  const e = APP.past.pop();
  if (!e) return;
  APP.future.push({ snap: snapshot(), what: e.what });
  restore(e.snap);
  toast("Undid " + e.what);
  changed();
}
function redo() {
  const e = APP.future.pop();
  if (!e) return;
  APP.past.push({ snap: snapshot(), what: e.what });
  restore(e.snap);
  changed();
}
function retime() {
  const f = window.FILM;
  let t = 0;
  const live = f.scenes.filter((s) => !(f.cutScenes || []).includes(s.id));
  const total = live.reduce((a, s) => a + s.dur, 0) || 1;
  f.runtime = total;
  f.scenes.forEach((s) => {
    if ((f.cutScenes || []).includes(s.id)) {
      s.t0 = s.t1 = t;
      s.pos = t / total;
      return;
    }
    s.t0 = t;
    t += s.dur;
    s.t1 = t;
    s.pos = (s.t0 + s.t1) / 2 / total;
  });
}
function changed() {
  APP.dirty = true;
  if (window.RIB) RIB.sig = "";
  window.__lastRun = dryRun();
  const r = window.__lastRun;
  APP.cost = r.miss ? r.miss + " of " + r.total + " rebuilt · nothing re-voiced" : "";
  if (window.FILM_CHAINS) FILM_CHAINS.clear();
  if (window.STUDIO && !window.STUDIO.demo && window.STUDIO.projectId) queueSave();
  render();
}
let SAVE_TIMER = null, SAVING = false;
const queueSave = () => {
  clearTimeout(SAVE_TIMER);
  SAVE_TIMER = setTimeout(saveNow, 700);
};
async function saveNow() {
  if (SAVING || !window.STUDIO || !window.STUDIO.projectId) return;
  SAVING = true;
  try {
    const r = await saveCreativeState();
    await loadProject(window.STUDIO.projectId);
    window.__lastRun = dryRun();
    commit(window.__lastRun);
    APP.dirty = false;
    if (r) APP.cost = (r.cache.misses ? r.cache.misses + " of " + r.cache.total + " moments redrawn" : "nothing to redraw") + (r.ttsCalls ? " · " + r.ttsCalls + " recorded" : "");
    render();
  } catch (e) {
    APP.cost = "not saved — " + e.message;
    renderBar();
  } finally {
    SAVING = false;
  }
}

/* ── loops ──────────────────────────────────────────────────────────── */
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
  APP.alts = null;
  APP.editing = null;
  render();
}
function selectScene(id, seek) {
  APP.sel = id;
  APP.alts = null;
  const s = window.FILM.scenes.find((x) => x.id === id);
  if (s && seek !== false) PLAY.t = s.t0 + 0.01;
  render();
}
const selScene = () => window.FILM.scenes.find((s) => s.id === APP.sel) || window.FILM.scenes[0];

function toast(msg) {
  let host = document.getElementById("toast");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function busy(on, what) {
  let el = document.getElementById("busy");
  if (!on) return void (el && el.remove());
  if (!el) {
    el = document.createElement("div");
    el.id = "busy";
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="busy-box"><i></i>${what || "working"}</div>`;
}
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");

/* ── bar ────────────────────────────────────────────────────────────── */
function renderBar() {
  const f = window.FILM, demo = window.STUDIO && window.STUDIO.demo;
  const onFilm = APP.view === "read";
  document.getElementById("bar").innerHTML = `
  <button class="mark" data-go="films" title="Your films">${MARK}<b>CANOPTICON</b></button>
  ${onFilm ? `<div class="bardiv"></div><div class="btitle">${esc(f.title)}</div>
  <div class="bstate"><i class="dot ${demo ? "" : APP.dirty ? "clay" : "sage"}"></i>${demo ? "example — not saved" : APP.dirty ? "saving" : "saved"}</div>
  ${APP.cost ? `<div class="lab">${esc(APP.cost)}</div>` : ""}` : ""}
  <div class="btools">
    ${/* THE BAR ONLY OFFERS WHAT IS REACHABLE FROM WHERE YOU ARE.
        * Undo and Find both act on the open film and were shown on the
        * library, where they do nothing; "New" pointed at a create page
        * that is now the front door itself. Seven buttons of which three
        * were inert is most of why a phone's bar had nothing useful left
        * in it by the time it ran out of width. */ ""}
    ${/* ON A PHONE THE BAR DROPS TO WHAT THE FILM NEEDS.
        * Seven controls is 856px of buttons on a 390px screen, so RENDER
        * — the button that produces the film — began off the right edge
        * with nothing to say it was there. Undo and Find are
        * keyboard-adjacent power moves, and the backstage page says in
        * its own header that a director should be able to finish a film
        * without ever opening it. `.phone-hide` takes them out below
        * 720px; nothing is removed on a desktop. */ ""}
    ${onFilm ? `<button class="b q sm phone-hide" data-undo ${APP.past.length ? "" : "disabled"}>Undo</button>
    <button class="b q sm phone-hide" data-find>Find <kbd>/</kbd></button>
    <div class="bardiv phone-hide"></div>` : ""}
    <button class="b q sm ${APP.view === "films" ? "on" : ""}" data-go="films">Your films</button>
    ${onFilm ? `<button class="b q sm ${APP.hood ? "on" : ""}" data-hood>Directing</button>` : ""}
    <button class="b q sm phone-hide ${APP.view === "build" ? "on" : ""}" data-go="build">How it was made</button>
    ${/* TWO VERBS, AND THEY MEAN WHAT THEY MEAN IN FILM.
        * RENDER makes the film. EXPORT writes the file. See `renderNow`
        * below for why these used to be three buttons. */ ""}
    ${onFilm ? '<button class="b q sm phone-hide" data-export title="Write the finished film out as a video file">Export</button>' : ""}
    ${onFilm ? '<button class="b pri sm" data-again title="Put the writing through the system as it is now \u2014 a new take, and the voice with it">Render</button>' : ""}
  </div>`;
  const q = (s, fn) => document.querySelectorAll(s).forEach((b) => (b.onclick = () => fn(b)));
  q("[data-go]", (b) => go(b.dataset.go));
  q("[data-undo]", undo);
  q("[data-find]", openFinder);
  q("[data-hood]", () => {
    APP.hood = !APP.hood;
    render();
  });
  q("[data-export]", openRender);
  q("[data-again]", renderNow);
}

/* ── RENDER — MAKE THE FILM, PICTURE AND VOICE ───────────────────
 *
 * THIS WAS THREE BUTTONS AND THEY WERE THE WORST THING IN THE STUDIO.
 *
 *   "Shoot it again"   in the top bar   — composed the picture again
 *   "Add narration"    in the film view — recorded the voice
 *   "Record it again"  next to it       — recorded the voice again
 *
 * Three controls for one intention, in two different places, each doing
 * half a job. A film could be re-shot into a take with no voice, or given
 * a voice for a take that had already moved on, and neither button said
 * so. There is no version of making a film in which the picture and the
 * sound are separate errands.
 *
 * ONE BUTTON. It puts the writing through the system AS IT IS NOW —
 * which is the other half of the point, because the reason to press it is
 * usually to see what the compiler learned since last time. Then it
 * records the voice, ALWAYS, without being asked again.
 *
 * IT IS CHEAP WHEN IT CAN BE. Narration is keyed by the scene’s text and
 * a take never touches the text, so every existing recording is reused
 * and only the silent or stale moments cost TTS. Pressing this on a fully
 * narrated film spends nothing on the voice.
 *
 * Nothing written or approved moves — not the essay, the cuts, the
 * anchors, the ratified readings or the pins. Each take is its own IR
 * version, so Undo is going back a version, and the same take always
 * composes the same film.
 *
 * The verb it does NOT do is export. Writing a video file out is its own
 * act, it is called EXPORT, and it is the button beside this one. */
async function renderNow() {
  if (!window.STUDIO || !window.STUDIO.projectId) {
    return toast("The example film composes in this page \u2014 open one of yours to render it");
  }
  const id = window.STUDIO.projectId;
  busy(true, "making it again");
  try {
    const out = await reshootFilm(id);
    /* THE VOICE, IN THE SAME PRESS.
     *
     * Started BEFORE the reload rather than after, so the recording is
     * already under way by the time the film view mounts and picks up its
     * progress bar. A failure here is reported and does not lose the
     * take: the picture is already written, and telling someone their
     * render failed when it did not is worse than a silent film. */
    let voice = true;
    try {
      await narrateFilm(id, {});
    } catch (e) {
      voice = false;
      toast("The take is made, but the voice would not start \u2014 " + e.message);
    }
    // Re-open so the Preview, the plan and the narration all come from
    // the take that was just written rather than the one before it.
    await loadProject(id);
    adoptFilm();
    if (voice) toast(`${out.how || `Take ${(out.take ?? 0) + 1}`} \u00b7 recording the voice`);
  } catch (e) {
    toast("Could not render it \u2014 " + e.message);
  } finally {
    busy(false);
  }
}

function render() {
  stopLoops();
  renderBar();
  const v = document.getElementById("view");
  ({ start: viewStart, read: viewRead, films: viewFilms, build: viewBuild })[APP.view](v);
  const old = document.getElementById("hood");
  if (old) old.remove();
  if (APP.hood && APP.view === "read") openHood();
}

/* ── shared slider (hood only) ──────────────────────────────────────── */
function sliderHTML(id, name, val, lo, hi, disp) {
  const p = Math.round(val * 100);
  return `<div class="sl" data-sl="${id}"><div class="slh"><span>${name}</span><i>${disp !== undefined ? disp : val.toFixed(2)}</i></div>
  <div class="trk"><div class="fl" style="width:${p}%"></div><div class="kn" style="left:${p}%"></div></div>
  <div class="slends"><span>${lo}</span><span>${hi}</span></div></div>`;
}
function bindSliders(root, set) {
  root.querySelectorAll("[data-sl]").forEach((el) => {
    const id = el.dataset.sl;
    const upd = (e) => {
      const r = el.querySelector(".trk").getBoundingClientRect();
      set(id, clamp((e.clientX - r.left) / r.width, 0, 1));
    };
    el.onpointerdown = (e) => {
      el.setPointerCapture(e.pointerId);
      mark("a control change");
      upd(e);
      el.onpointermove = (ev) => ev.buttons && upd(ev);
      el.onpointerup = () => (el.onpointermove = null);
    };
  });
}

/* ── keyboard ───────────────────────────────────────────────────────── */
function onKey(e) {
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea") {
    if (e.key === "Escape") e.target.blur();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    return e.shiftKey ? redo() : undo();
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === " ") {
    e.preventDefault();
    PLAY.on = !PLAY.on;
    const pp = document.getElementById("pp");
    if (pp) pp.textContent = PLAY.on ? "PAUSE" : "PLAY";
  } else if (e.key === "/") (e.preventDefault(), openFinder());
  else if (e.key === "Escape") {
    if (document.getElementById("finder")) closeFinder();
    else if (APP.alts) {
      APP.alts = null;
      render();
    } else if (APP.hood) {
      APP.hood = false;
      render();
    }
  } else if (e.key === "ArrowDown") (e.preventDefault(), stepScene(1));
  else if (e.key === "ArrowUp") (e.preventDefault(), stepScene(-1));
}
function stepScene(d) {
  const sc = window.FILM.scenes.filter((s) => !(window.FILM.cutScenes || []).includes(s.id));
  const at = Math.max(0, sc.findIndex((s) => s.id === APP.sel));
  const n = sc[Math.min(sc.length - 1, Math.max(0, at + d))];
  if (n) selectScene(n.id);
}

/* ── finder ─────────────────────────────────────────────────────────── */
function openFinder() {
  if (document.getElementById("finder")) return;
  const el = document.createElement("div");
  el.id = "finder";
  el.innerHTML = `<div class="finder-box"><input id="finder-q" placeholder="Find a moment — type something it says" autocomplete="off"><div id="finder-list"></div></div>`;
  document.body.appendChild(el);
  el.onclick = (ev) => ev.target === el && closeFinder();
  const q = document.getElementById("finder-q");
  q.oninput = () => paintFinder(q.value);
  q.onkeydown = (ev) => {
    if (ev.key === "Enter") {
      const f = document.querySelector("#finder-list [data-jump]");
      if (f) jumpTo(f.dataset.jump);
    }
  };
  q.focus();
  paintFinder("");
}
function paintFinder(term) {
  const t = term.trim().toLowerCase();
  const hits = window.FILM.scenes.filter((s) => !t || s.text.toLowerCase().includes(t)).slice(0, 40);
  document.getElementById("finder-list").innerHTML = hits.length
    ? hits.map((s) => `<button class="finder-row" data-jump="${s.id}"><span>${esc(s.text).slice(0, 120)}</span><i>${fmt(s.t0)}</i></button>`).join("")
    : `<p class="finder-empty">Nothing in this film says that.</p>`;
  document.querySelectorAll("#finder-list [data-jump]").forEach((b) => (b.onclick = () => jumpTo(b.dataset.jump)));
}
function jumpTo(id) {
  closeFinder();
  APP.view = "read";
  selectScene(id);
}
const closeFinder = () => {
  const el = document.getElementById("finder");
  if (el) el.remove();
};

window.addEventListener("keydown", onKey);
window.addEventListener("DOMContentLoaded", async () => {
  const f = window.FILM;
  f.bends = f.bends || {};
  f.continuity = f.continuity || "cut";
  f.cutScenes = f.cutScenes || [];
  window.__lastRun = dryRun();
  commit(window.__lastRun);
  APP.sel = f.scenes[0].id;
  /* ONE PAINT, THEN FILL IN.
   *
   * The old boot rendered, awaited the film list, then rendered again as
   * a different view — so the page flashed CREATE before settling on the
   * library. It also used to auto-open the last project from
   * localStorage, which meant the root URL dropped you inside whatever
   * film you last had open, behind a "compiling the film" overlay you
   * did not ask for. The library is the front door; the last film is one
   * click away rather than unavoidable. */
  render();
  await filmsRefresh();
});

Object.assign(window, {
  APP, PLAY, VERBS, MARK, go, render, renderBar, changed, mark, undo, redo, retime, snapshot,
  selectScene, selScene, stepScene, toast, busy, esc, fmt, loop, stopLoops, sliderHTML, bindSliders,
  openFinder, closeFinder, jumpTo, readIntent, saveNow, queueSave, renderNow,
});
