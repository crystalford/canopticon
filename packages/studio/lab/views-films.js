/* CANOPTICON — the FILMS view.
 *
 * The first of the five was missing, and its absence is what made the whole
 * thing read as one film permanently sitting there: there was nowhere to
 * see that a second one could exist.
 *
 * Built inside the shell rather than beside it. No new typography, no new
 * palette, no second design — it uses the same `.vhead`, `.sec`, `.k`,
 * `.btn`, `.mono` the other four views use, because the design was never
 * the problem and a parallel surface in a different style was the problem.
 *
 * What it shows about a film is what the compiler actually knows: how many
 * scenes, how many carry a figure the prose printed verbatim, how many have
 * been read by a model and ratified, and when it last compiled. Not a
 * thumbnail — this system's unit is an argument, not a picture.
 */

let PROJECTS = [];
let FILMS_MSG = "";
let FILMS_BUSY = false;

function filmsSay(msg) {
  FILMS_MSG = msg;
  const el = document.getElementById("films-msg");
  if (el) el.textContent = msg;
}

async function filmsRefresh() {
  try {
    PROJECTS = await listProjects();
  } catch (err) {
    PROJECTS = [];
    filmsSay(`could not reach the compiler — ${err.message}`);
  }
}

function viewFilms(el) {
  const cur = window.STUDIO.projectId;
  el.innerHTML = `
  <div class="vhead"><h2>Films</h2>
    <span class="k">${PROJECTS.length} STORED · ONE COMPILER · ONE PALETTE</span></div>
  <div class="pad">
    <div class="sec">
      <span class="k">OPEN</span>
      <div id="films-list">${
        PROJECTS.length === 0
          ? `<p class="empty">Nothing stored yet. Paste an essay below — segmentation is
             deterministic and costs nothing, so there is no reason not to try one.</p>`
          : PROJECTS.map((p) => filmRow(p, cur)).join("")
      }
      <div class="film ${cur ? "" : "on"}" data-open="__demo">
        <div class="film-main">
          <div class="filmtitle">${esc(window.DEMO_FILM.title)} <span class="tag">EXAMPLE</span></div>
          <div class="mono film-meta">${window.DEMO_FILM.scenes.length} scenes · compiled in the page ·
            no project behind it</div>
        </div>
        <div class="film-acts"><button class="btn" data-open="__demo">OPEN</button></div>
      </div>
      </div>
      <p class="mono film-msg" id="films-msg">${esc(FILMS_MSG)}</p>
    </div>

    <div class="sec secline">
      <span class="k">NEW FILM</span>
      <textarea id="films-essay" class="films-essay"
        placeholder="Paste an essay. Headings become acts. Sentences become scenes. Bullets stay whole — splitting &quot;Peak occupancy: 7,000 people&quot; would strip the figure from the thing it is a figure of."></textarea>
      <div class="films-actions">
        <button class="btn primary" id="films-ingest">SEGMENT →</button>
        <span class="mono films-hint">Deterministic. No model sees the essay. Free, and instant.</span>
      </div>
    </div>

    <div class="sec secline">
      <span class="k">THE THREE STEPS</span>
      <div class="mono films-steps">
        <p><b>SEGMENT</b> — acts from the essay's own headings, scenes bound to the prose by
        character offset, quantities lifted out verbatim. Nothing here calls a model.</p>
        <p><b>READ</b> — the one model call in the system. Bounded, resumable, and allowed to
        decline a sentence rather than guess at it. <b>Optional:</b> a film that has never been
        read is complete and watchable — the abstraction curve carries the unread scenes, and any
        scene carrying a figure reaches the data family on the prose alone.</p>
        <p><b>COMPILE</b> — the real composition engine plans every chain and reports what the
        cache did. Structurally 0 TTS calls, which is why dragging a curve is free.</p>
      </div>
    </div>
  </div>`;

  for (const b of el.querySelectorAll("[data-open]")) {
    b.onclick = (e) => {
      e.stopPropagation();
      openFilm(b.dataset.open);
    };
  }
  for (const b of el.querySelectorAll("[data-act]")) {
    b.onclick = (e) => {
      e.stopPropagation();
      filmAction(b.dataset.act, b.dataset.id);
    };
  }
  const ing = document.getElementById("films-ingest");
  if (ing) ing.onclick = filmsIngest;
}

function filmRow(p, cur) {
  const read =
    p.readings > 0
      ? `<span class="tag on">${p.readings} READ</span>`
      : `<span class="tag">UNREAD</span>`;
  return `<div class="film ${p.projectId === cur ? "on" : ""}" data-open="${esc(p.projectId)}">
    <div class="film-main">
      <div class="filmtitle">${esc(p.title)}</div>
      <div class="mono film-meta">${p.scenes} scenes · ${p.acts} acts · IR v${p.irVersion} ·
        ${p.lastCompiledAt ? `${p.lastNodes} nodes compiled` : "never compiled"} ${read}</div>
    </div>
    <div class="film-acts">
      <button class="btn" data-open="${esc(p.projectId)}">OPEN</button>
      <button class="btn" data-act="read" data-id="${esc(p.projectId)}">READ 12</button>
      <button class="btn" data-act="delete" data-id="${esc(p.projectId)}">DELETE</button>
    </div>
  </div>`;
}

function esc(s) {
  return String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

async function openFilm(id) {
  if (FILMS_BUSY) return;
  FILMS_BUSY = true;
  try {
    if (id === "__demo") {
      loadDemo();
      filmsSay("built-in example — nothing behind it but this page");
    } else {
      filmsSay("compiling…");
      const film = await loadProject(id);
      filmsSay(`${film.title} — ${film.scenes.length} scenes, ${fmt(film.runtime)}`);
    }
    // A new film means new hashes; the cache view starts from this one.
    window.__lastRun = dryRun();
    commit(window.__lastRun);
    APP.dirty = false;
    APP.sel = window.FILM.scenes[0] ? window.FILM.scenes[0].id : null;
    go("narrative");
  } catch (err) {
    filmsSay(err.message);
  } finally {
    FILMS_BUSY = false;
  }
}

async function filmAction(kind, id) {
  if (FILMS_BUSY) return;
  FILMS_BUSY = true;
  try {
    if (kind === "read") {
      filmsSay("proposing readings — the one model call in the system…");
      const r = await readProject(id, 12);
      filmsSay(
        r.proposed === 0 && r.remaining === 0
          ? "every scene has been read"
          : `${r.proposed} proposed · ${r.declined} declined · ${r.remaining} still unread — ` +
              "declining is a result, not a failure",
      );
    } else if (kind === "delete") {
      const p = PROJECTS.find((x) => x.projectId === id);
      if (!confirm(`Delete "${p ? p.title : id}" and all its versions?`)) return;
      await deleteProject(id);
      if (window.STUDIO.projectId === id) loadDemo();
      filmsSay("deleted");
    }
    await filmsRefresh();
    render();
  } catch (err) {
    filmsSay(err.message);
  } finally {
    FILMS_BUSY = false;
  }
}

async function filmsIngest() {
  const box = document.getElementById("films-essay");
  const essay = box.value.trim();
  if (!essay) return filmsSay("paste an essay first");
  if (FILMS_BUSY) return;
  FILMS_BUSY = true;
  try {
    filmsSay("segmenting…");
    const r = await ingestEssay(essay);
    box.value = "";
    await filmsRefresh();
    // Open it immediately. Segmenting and then being returned to a list is
    // a step that exists only for the machine.
    FILMS_BUSY = false;
    await openFilm(r.projectId);
    filmsSay(
      `${r.title} — ${r.scenes} scenes, ${r.acts} acts, ${r.scenesWithFigures} carrying figures`,
    );
  } catch (err) {
    filmsSay(err.message);
    FILMS_BUSY = false;
  }
}

Object.assign(window, { viewFilms, filmsRefresh, openFilm });
