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
  // Narration is the one thing here that costs money and cannot be undone
  // by dragging a curve, so the row says how much of it exists rather than
  // leaving the operator to press the button and find out.
  const voice =
    p.narrated > 0
      ? `<span class="tag ${p.narrated >= p.scenes ? "on" : ""}">${
          p.narrated >= p.scenes ? "NARRATED" : `${p.narrated}/${p.scenes} VOICED`
        }</span>`
      : `<span class="tag">SILENT</span>`;
  const done = p.narrated >= p.scenes && p.scenes > 0;
  return `<div class="film ${p.projectId === cur ? "on" : ""}" data-open="${esc(p.projectId)}">
    <div class="film-main">
      <div class="filmtitle">${esc(p.title)}</div>
      <div class="mono film-meta">${p.scenes} scenes · ${p.acts} acts · IR v${p.irVersion} ·
        ${p.lastCompiledAt ? `${p.lastNodes} nodes compiled` : "never compiled"} ${read} ${voice}</div>
    </div>
    <div class="film-acts">
      <button class="btn" data-open="${esc(p.projectId)}">OPEN</button>
      <button class="btn" data-act="read" data-id="${esc(p.projectId)}">READ 12</button>
      ${
        done
          ? ""
          : `<button class="btn" data-act="narrate" data-id="${esc(p.projectId)}">NARRATE</button>`
      }
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
      busy(true, "compiling the film");
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
    busy(false);
    FILMS_BUSY = false;
  }
}

async function filmAction(kind, id) {
  if (FILMS_BUSY) return;
  FILMS_BUSY = true;
  try {
    if (kind === "read") {
      filmsSay("proposing readings — the one model call in the system…");
      busy(true, "reading — one model call, bounded");
      const r = await readProject(id, 12);
      filmsSay(
        r.proposed === 0 && r.remaining === 0
          ? "every scene has been read"
          : `${r.proposed} proposed · ${r.declined} declined · ${r.remaining} still unread — ` +
              "declining is a result, not a failure",
      );
    } else if (kind === "narrate") {
      await narrateFilm(id);
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
    busy(false);
    FILMS_BUSY = false;
  }
}

/** RECORD THE VOICE.
 *
 *  The only action in this instrument that spends money, and the only one
 *  that produces something a recompile cannot regenerate — so it says what
 *  it is doing at every step rather than sitting on a spinner.
 *
 *  It runs in batches because a request has a wall clock and an 88-scene
 *  film is 176 model calls. The loop is here, in the client, rather than in
 *  the Worker: a batch that completes is FROZEN and versioned before the
 *  next one starts, so closing the tab halfway leaves a half-narrated film
 *  rather than nothing.
 *
 *  Escape stops it between batches. Nothing already recorded is lost. */
let NARRATE_STOP = false;
async function narrateFilm(id) {
  const project = PROJECTS.find((p) => p.projectId === id);
  const outstanding = project ? project.scenes - project.narrated : 0;
  if (
    outstanding > 0 &&
    !confirm(
      `Record narration for ${outstanding} scene${outstanding === 1 ? "" : "s"}?\n\n` +
        "This is the one step that spends model calls. Each scene is spoken once, " +
        "hashed, stored, and measured — after this, re-cutting the film is free.\n\n" +
        "Press Escape to stop between batches; anything already recorded is kept.",
    )
  ) {
    return;
  }

  NARRATE_STOP = false;
  const onKey = (e) => {
    if (e.key === "Escape") NARRATE_STOP = true;
  };
  addEventListener("keydown", onKey);

  let done = 0;
  let failed = 0;
  let measuredMs = 0;
  try {
    for (;;) {
      busy(true, `recording narration — ${done} done, ${failed ? `${failed} failed, ` : ""}esc to stop`);
      filmsSay(`recording narration… ${done} scene${done === 1 ? "" : "s"} so far`);
      const r = await narrateProject(id, { limit: 6 });
      done += r.narrated;
      failed += r.failed;
      measuredMs += r.narratedMs || 0;

      if (r.narrated === 0) {
        // Nothing came back. Say what the binding actually returned rather
        // than "narration failed" — the shape is the diagnostic.
        const first = (r.scenes || []).find((s) => s.status === "failed");
        const attempt = first && first.attempts && first.attempts[0];
        filmsSay(
          r.remaining === 0
            ? "every scene is narrated"
            : `narration produced nothing — ${
                attempt ? `${attempt.model}: ${attempt.outcome}` : first ? first.reason : "no reason given"
              }`,
        );
        break;
      }
      if (r.remaining === 0) {
        filmsSay(
          `narrated — ${done} scene${done === 1 ? "" : "s"}, ${fmt(measuredMs / 1000)} of speech` +
            (failed ? `, ${failed} failed` : "") +
            " · the film is now timed off the audio, not off character counts",
        );
        break;
      }
      if (NARRATE_STOP) {
        filmsSay(`stopped — ${done} recorded, ${r.remaining} still silent. Nothing was lost.`);
        break;
      }
    }
  } finally {
    removeEventListener("keydown", onKey);
    busy(false);
  }

  // The film in the views is now timed by a different clock, so reload it.
  if (window.STUDIO.projectId === id && done > 0) {
    await loadProject(id);
    window.__lastRun = dryRun();
    commit(window.__lastRun);
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
    busy(true, "segmenting — deterministic, no model");
    const r = await ingestEssay(essay);
    busy(false);
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
