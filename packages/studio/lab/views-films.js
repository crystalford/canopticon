/* CANOPTICON — LIBRARY. Everything you have made, and the way in.
 *
 * WHAT THE PRODUCT AUDIT FOUND HERE, and what this rewrite answers.
 *
 * 1. THE FRONT DOOR WAS A STATUS LINE. The first thing a person read was
 *    "0 STORED · ONE COMPILER · ONE PALETTE", under a heading that said
 *    FILMS while showing none. Three facts about the architecture and
 *    nothing about what to do.
 *
 * 2. THE WAY IN WAS BELOW THE FOLD AND CALLED SEGMENT. The one action
 *    that matters — put writing in, get a film — sat under the list, and
 *    its button was named after a compiler stage. A person who has never
 *    read this codebase does not want to segment anything.
 *
 * 3. THE EMPTY TEXTAREA WAS THE WHOLE ONBOARDING. Nothing to try, so the
 *    only way to find out what Studio does was to already have an essay
 *    and be willing to gamble it.
 *
 * 4. ERRORS WERE BODY TEXT. "could not reach the compiler — Failed to
 *    fetch" rendered as a grey paragraph with no recovery action and no
 *    statement of what still worked. That is the state a first-time
 *    visitor is MOST likely to hit, and it read like the product was
 *    broken rather than offline.
 *
 * 5. FIVE BUTTONS PER ROW, NAMED FOR THE COMPILER. OPEN · READ 12 ·
 *    NARRATE · KEEP THE LOOK · DELETE. "READ 12" is not a sentence in any
 *    language. Now: one primary action, the rest behind MORE, in verbs
 *    that describe an outcome.
 *
 * The compiler's own documentation — the three steps, the TTS probe, the
 * voice audition — moved out. The probe and the audition belong with the
 * audio decision in VISUAL; the three steps belong in ENGINE, where the
 * machine explains itself to someone who asked.
 */

let PROJECTS = [];
/** The one place a message about the library lives. `{kind, text, action}`
 *  where kind is "" | "working" | "ok" | "problem" — never a bare string
 *  dropped into the page, because that is what produced a raw fetch error
 *  as prose on the front door. */
let FILMS_NOTE = null;
let FILMS_BUSY = false;

function filmsSay(text, kind, action) {
  FILMS_NOTE = text ? { text, kind: kind || "", action: action || null } : null;
  const el = document.getElementById("films-note");
  if (el) el.outerHTML = noticeHTML(FILMS_NOTE, "films-note");
  bindNotice();
}

/** A message the reader can act on. Every one of these says three things:
 *  what happened, what it cost, and what to do next. */
function noticeHTML(note, id) {
  if (!note) return `<div id="${id}" class="notice-slot"></div>`;
  return `<div id="${id}" class="notice ${note.kind}">
    <span class="notice-dot"></span>
    <span class="notice-text">${esc(note.text)}</span>
    ${note.action ? `<button class="btn" data-notice="${esc(note.action.id)}">${esc(note.action.label)}</button>` : ""}
  </div>`;
}

function bindNotice() {
  for (const b of document.querySelectorAll("[data-notice]")) {
    b.onclick = async () => {
      if (b.dataset.notice === "retry") {
        filmsSay("looking for the compiler…", "working");
        await filmsRefresh();
        render();
      }
    };
  }
}

async function filmsRefresh() {
  try {
    PROJECTS = await listProjects();
    if (FILMS_NOTE && FILMS_NOTE.kind === "problem") FILMS_NOTE = null;
  } catch (err) {
    PROJECTS = [];
    // NOT "Failed to fetch". The reader needs to know their work is safe
    // and that there is still something to look at.
    filmsSay(
      `Studio can't reach the compiler right now (${err.message}). Nothing has been lost — ` +
        "stored films are on the server and will be here when it answers. The example film below " +
        "runs entirely in this page and works either way.",
      "problem",
      { id: "retry", label: "TRY AGAIN" },
    );
  }
}

/* THE EXAMPLE ESSAY. Two paragraphs of real prose with a heading, a
 * figure and a turn in it, so pressing one button produces a film that
 * actually demonstrates something rather than a placeholder that
 * demonstrates the button. */
const SAMPLE_ESSAY = `The Nine Rooms

The building has nine numbered rooms and one door. For eleven years the
council recorded it as a single dwelling. Peak occupancy: 41 people.

Nobody who signed the forms had been inside. The inspection that would have
found the partitions was scheduled four times and carried out none. When the
fire came it moved the way fire moves through a corridor, and afterwards the
report described the layout as if it had always been visible.`;

function viewFilms(el) {
  const cur = window.STUDIO.projectId;
  const empty = PROJECTS.length === 0;

  el.innerHTML = `
  <div class="vhead">
    <h1>Library</h1>
    <div class="sub">A film is a piece of writing that has been compiled. Everything you make lives here.</div>
  </div>

  ${noticeHTML(FILMS_NOTE, "films-note")}

  <section class="vsec">
    <div class="vsech">
      <h2>Start a film</h2>
      <div class="note">Paste something you have written. It stays yours — nothing is sent to a model at this step.</div>
    </div>
    <textarea id="films-essay" class="films-essay"
      placeholder="Paste an essay, a piece of reporting, a script.&#10;&#10;Headings become acts. Sentences become scenes. A bulleted line stays whole, because splitting &quot;Peak occupancy: 7,000 people&quot; would strip the number from the thing it is a number of."></textarea>
    <div class="films-actions">
      <button class="btn primary" id="films-ingest">MAKE A FILM</button>
      <button class="btn" id="films-sample">USE THE EXAMPLE ESSAY</button>
      <span class="mono films-hint">Instant, free, and repeatable — the same words always cut the same way.</span>
    </div>
  </section>

  <section class="vsec">
    <div class="vsech">
      <h2>Your films</h2>
      <div class="note">${
        empty
          ? "Nothing here yet."
          : `${PROJECTS.length} film${PROJECTS.length === 1 ? "" : "s"}.`
      }</div>
    </div>
    <div class="vgrid" id="films-list">
      ${PROJECTS.map((p) => filmCard(p, cur)).join("")}
      ${demoCard(cur)}
    </div>
    ${
      empty
        ? `<div class="vfoot">Open the example to see what a compiled film is before you commit any
           of your own writing to it. It runs in this page and needs nothing behind it.</div>`
        : ""
    }
  </section>`;

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
  for (const b of el.querySelectorAll("[data-more]")) {
    b.onclick = (e) => {
      e.stopPropagation();
      const row = document.getElementById(`more-${b.dataset.more}`);
      if (row) row.classList.toggle("open");
    };
  }
  const ing = document.getElementById("films-ingest");
  if (ing) ing.onclick = filmsIngest;
  const samp = document.getElementById("films-sample");
  if (samp) {
    samp.onclick = () => {
      const box = document.getElementById("films-essay");
      box.value = SAMPLE_ESSAY;
      box.focus();
      filmsSay("The example is in the box. Press MAKE A FILM — it takes about a second.", "ok");
    };
  }
  bindNotice();
}

/** What state this film is in, in one sentence a person can act on.
 *  Deliberately ordered by urgency: a film saying the wrong words is a
 *  more important fact than a film being fully narrated. */
function filmState(p) {
  if (p.stale) {
    return {
      kind: "problem",
      text: `${p.stale} scene${p.stale === 1 ? "" : "s"} now say something different from the recording — re-record before you export.`,
    };
  }
  if (p.narrated >= p.scenes && p.scenes > 0) {
    return { kind: "ok", text: "Narrated end to end. Timed off the audio." };
  }
  if (p.narrated > 0) {
    return { kind: "", text: `${p.narrated} of ${p.scenes} scenes have a voice.` };
  }
  return { kind: "", text: "Silent. Watchable as it is; captions carry the script." };
}

function filmCard(p, cur) {
  const st = filmState(p);
  const done = p.narrated >= p.scenes && p.scenes > 0 && !p.stale;
  return `<div class="fcard ${p.projectId === cur ? "on" : ""}">
    <button class="fcard-open" data-open="${esc(p.projectId)}">
      <b>${esc(p.title)}</b>
      <div class="fcard-meta mono">${p.scenes} scenes · ${p.acts} act${p.acts === 1 ? "" : "s"}${
        p.readings > 0 ? ` · ${p.readings} interpreted` : ""
      }</div>
      <div class="fcard-state ${st.kind}">${esc(st.text)}</div>
    </button>
    <div class="fcard-acts">
      <button class="btn primary" data-open="${esc(p.projectId)}">OPEN</button>
      <button class="btn" data-more="${esc(p.projectId)}">MORE</button>
    </div>
    <div class="fcard-more" id="more-${esc(p.projectId)}">
      ${
        done
          ? ""
          : `<button class="btn" data-act="narrate" data-id="${esc(p.projectId)}">${
              p.stale ? "RE-RECORD THE VOICE" : "RECORD THE VOICE"
            }</button>`
      }
      <button class="btn" data-act="read" data-id="${esc(p.projectId)}">INTERPRET 12 SCENES</button>
      <button class="btn" data-act="look" data-id="${esc(p.projectId)}">SAVE THIS LOOK</button>
      <button class="btn danger" data-act="delete" data-id="${esc(p.projectId)}">DELETE</button>
    </div>
  </div>`;
}

function demoCard(cur) {
  return `<div class="fcard ${cur ? "" : "on"}">
    <button class="fcard-open" data-open="__demo">
      <b>${esc(window.DEMO_FILM.title)} <span class="tag">EXAMPLE</span></b>
      <div class="fcard-meta mono">${window.DEMO_FILM.scenes.length} scenes · runs in this page</div>
      <div class="fcard-state">A worked example. Nothing stored behind it, and it works offline.</div>
    </button>
    <div class="fcard-acts"><button class="btn" data-open="__demo">OPEN</button></div>
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
      filmsSay("");
    } else {
      filmsSay("compiling…", "working");
      busy(true, "compiling the film");
      await loadProject(id);
      filmsSay("");
    }
    // A new film means new hashes; the cache view starts from this one.
    window.__lastRun = dryRun();
    commit(window.__lastRun);
    APP.dirty = false;
    APP.sel = window.FILM.scenes[0] ? window.FILM.scenes[0].id : null;
    // THE FILM IS THE CENTRAL OBJECT. Opening one lands on the film, not
    // on a reading view of its prose.
    go("preview");
  } catch (err) {
    filmsSay(`That film would not compile — ${err.message}`, "problem", {
      id: "retry",
      label: "TRY AGAIN",
    });
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
      filmsSay("interpreting — the one model call in the system…", "working");
      busy(true, "interpreting — one model call, bounded");
      const r = await readProject(id, 12);
      filmsSay(
        r.proposed === 0 && r.remaining === 0
          ? "Every scene has been interpreted."
          : `${r.proposed} interpreted · ${r.declined} declined · ${r.remaining} still to go. ` +
              "Declining is a result, not a failure — an unread scene is carried by the film's own curve.",
        "ok",
      );
    } else if (kind === "look") {
      const name = prompt(
        "Name this film's look.\n\nIt captures what the film ACTUALLY did — which operations it " +
          "reached for and how far it drew things — not its chains. Applied to a different essay it " +
          "builds different things in a recognisable way.",
        PROJECTS.find((x) => x.projectId === id)?.title || "this look",
      );
      if (!name) return;
      filmsSay("reading what this film did…", "working");
      const r = await captureLook(id, name);
      filmsSay(`Kept "${name}" — ${r.describes}`, "ok");
    } else if (kind === "narrate") {
      await narrateFilm(id);
    } else if (kind === "delete") {
      const p = PROJECTS.find((x) => x.projectId === id);
      if (!confirm(`Delete "${p ? p.title : id}" and all its versions?`)) return;
      await deleteProject(id);
      if (window.STUDIO.projectId === id) loadDemo();
      filmsSay("Deleted.", "ok");
    }
    await filmsRefresh();
    render();
  } catch (err) {
    filmsSay(`That didn't work — ${err.message}`, "problem", { id: "retry", label: "TRY AGAIN" });
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
  const outstanding = project ? project.scenes - project.narrated + (project.stale || 0) : 0;
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
      filmsSay(`recording narration… ${done} scene${done === 1 ? "" : "s"} so far`, "working");
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
            ? "Every scene is narrated."
            : `Narration produced nothing — ${
                attempt ? `${attempt.model}: ${attempt.outcome}` : first ? first.reason : "no reason given"
              }`,
          r.remaining === 0 ? "ok" : "problem",
        );
        break;
      }
      if (r.remaining === 0) {
        filmsSay(
          `Narrated — ${done} scene${done === 1 ? "" : "s"}, ${fmt(measuredMs / 1000)} of speech` +
            (failed ? `, ${failed} failed` : "") +
            ". The film is now timed off the audio, not off character counts.",
          "ok",
        );
        break;
      }
      if (NARRATE_STOP) {
        filmsSay(`Stopped — ${done} recorded, ${r.remaining} still silent. Nothing was lost.`, "ok");
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
  if (!essay) {
    return filmsSay("There's nothing in the box yet. Paste some writing, or use the example.", "problem");
  }
  if (FILMS_BUSY) return;
  FILMS_BUSY = true;
  try {
    filmsSay("reading your writing — deterministic, no model…", "working");
    busy(true, "cutting the essay into scenes");
    const r = await ingestEssay(essay);
    busy(false);
    box.value = "";
    await filmsRefresh();
    // Open it immediately. Making a film and then being returned to a list
    // is a step that exists only for the machine.
    FILMS_BUSY = false;
    await openFilm(r.projectId);
    filmsSay(
      `${r.title} — ${r.scenes} scenes across ${r.acts} act${r.acts === 1 ? "" : "s"}, ` +
        `${r.scenesWithFigures} of them carrying a number lifted straight from your words.`,
      "ok",
    );
  } catch (err) {
    filmsSay(
      `Studio couldn't take that in — ${err.message}. Your writing is still in the box.`,
      "problem",
      { id: "retry", label: "TRY AGAIN" },
    );
    FILMS_BUSY = false;
  }
}

Object.assign(window, { viewFilms, filmsRefresh, openFilm, noticeHTML, esc });
