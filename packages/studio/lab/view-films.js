/* CANOPTICON — the front door.
 *
 * WHAT THIS USED TO BE, AND WHY IT WAS WRONG. Two separate screens: a
 * CREATE page and a FILMS list, with the shell painting CREATE first and
 * then swapping to FILMS once the list came back. So every visit opened
 * on a flash of the wrong page, and the two things a person actually
 * wants on arrival — start one, or open one — were never on screen
 * together. A front door that shows you the wrong room first and then
 * corrects itself is the definition of feeling unfinished.
 *
 * One screen. Paste and go at the top, everything you have made below it.
 * The full set of choices is still there, one click away, for the visit
 * where you care about them — and the writing travels with you when you
 * go, so opening the options never costs you what you had typed.
 */
let LIB = { error: null };

/* ── A FILM BEING MADE ────────────────────────────────────────────────
 *
 * Making a film speaks it, and speaking sixty moments takes minutes. The
 * old flow opened the film immediately and let the voice catch up, which
 * is the whole reason a compiled plan could exist without the clock it
 * was supposed to be timed to. So the film is not opened until it has a
 * voice, and while it is being spoken the library says so and counts.
 *
 * The recording is the server's, not this page's — closing the tab does
 * not stop it and reopening the library picks the count back up. */
const MAKING = { id: null, title: "", narrated: 0, total: 0, timer: null, reason: null };

function stopMaking() {
  if (MAKING.timer) clearInterval(MAKING.timer);
  MAKING.timer = null;
}

function watchMaking() {
  stopMaking();
  if (!MAKING.id) return;
  const tick = async () => {
    let st;
    try {
      st = await narrationStatusOf(MAKING.id);
    } catch {
      return; // A dropped poll is not a failed recording.
    }
    MAKING.narrated = st.narrated ?? 0;
    MAKING.total = st.total ?? 0;
    if (APP.view === "films") render();
    if (st.running) return;
    /* THE JOB CAN DIE HOLDING THE FLAG on a long film. Every chunk was
     * versioned as it landed, so picking it up records only what is
     * still silent. */
    if (st.stalled && MAKING.narrated < MAKING.total) {
      try {
        await narrateFilm(MAKING.id, {});
      } catch {
        // The next tick reports it.
      }
      return;
    }
    stopMaking();
    const id = MAKING.id;
    MAKING.reason = st.reason || null;
    MAKING.id = null;
    if (MAKING.narrated > 0) {
      // Open it now. This is the first compile anyone sees of this film
      // and it is against measured word times, not an estimate.
      try {
        await openFilm(id);
        toast(`Made — spoken in ${MAKING.narrated} moments, and cut to the voice.`);
      } catch {
        await filmsRefresh();
      }
    } else {
      await filmsRefresh();
      render();
      toast(st.reason ? `No voice was recorded — ${st.reason}` : "No voice was recorded");
    }
  };
  MAKING.timer = setInterval(tick, 2500);
  tick();
}

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
  /* WHICH KIND OF NAVIGATION THIS IS.
   *
   * Coming from the library into a film is a real move and has to PUSH,
   * or Back has nothing to go back to and leaves the site — which is what
   * it did. Re-adopting the film you are already in (RENDER writes a new
   * take and re-opens it) is the same place with new contents, so it
   * REPLACES and Back still goes to the library rather than to the
   * previous take of the film you are looking at. */
  const wasInFilm = APP.view === "read";
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
  if (window.syncURL) syncURL(wasInFilm);
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
    if (window.syncURL) syncURL(true);
  } finally {
    busy(false);
  }
}
function useExample() {
  loadDemo();
  adoptFilm();
}

/** A segmented row, the same one the options page uses. Shared rather than
 *  copied: two renderings of one control is how the Lab and the Worker
 *  came to disagree about 57 of 88 scenes. */
const choiceRow = (id, opts, current) =>
  `<div class="segs" data-choice="${id}">${(opts || [])
    .map(
      (o) =>
        `<button data-opt="${esc(o.id)}" class="${current === o.id ? "on" : ""}" title="${esc(o.note || "")}">${esc(o.label)}</button>`,
    )
    .join("")}</div>`;

/** THE EIGHT LOOKS, SHOWING THEIR OWN COLOUR.
 *
 *  Each swatch is painted by `resolvePalette` from that look's own four
 *  numbers — the same function the renderer uses — so what you see on the
 *  button is the ground and accent the film will actually have. A hand-
 *  written hex here would be a second opinion about colour, which is the
 *  one thing `resolvePalette` exists to prevent (standing rule 9).
 *
 *  Matched by coordinates rather than by a stored id, so nudging a film's
 *  colour later moves it OFF a named look honestly instead of leaving a
 *  name attached to numbers that have drifted from it. */
function lookRow(colour) {
  const looks = window.LOOKS || [];
  const cur = colour || (window.COLOUR_DEFAULT ?? {});
  return `<div class="segs looks" data-choice="look">${looks
    .map((l) => {
      const p = window.resolvePalette ? resolvePalette(l.colour) : null;
      const on =
        Math.abs((cur.key ?? 0) - l.colour.key) < 0.03 &&
        Math.abs((cur.temperature ?? 0) - l.colour.temperature) < 0.06;
      /* GROUND AND ACCENT, SIDE BY SIDE. An inset ring put the accent
       * around the whole chip and the ground was a dot in the middle of
       * it — which made every look read as its accent. The split shows
       * what the frame is mostly made of, and what marks the thing that
       * matters in it, in their real proportion. */
      const chip = p
        ? `<i class="swatch" style="background:linear-gradient(105deg,${p.bg} 0 66%,${p.accent} 66% 100%);border-color:${p.dim}"></i>`
        : "";
      return `<button data-opt="${esc(l.id)}" class="${on ? "on" : ""}" title="${esc(l.blurb)}">${chip}${esc(l.name)}</button>`;
    })
    .join("")}</div>`;
}

/** HOW MUCH COLOUR, as a choice rather than a slider.
 *
 *  IT USED TO MOVE HALF OF WHAT IT PROMISED, and that is the whole reason
 *  every film came out muted. There are TWO numbers that decide how
 *  colourful a frame is — `saturation`, how intense one colour is, and
 *  `spread`, how many there are — and this row wrote only `spread`. So
 *  "Full spectrum" gave you the entire hue wheel still at the default
 *  saturation: many muted colours instead of one. And "Black and white"
 *  did not move saturation at all, so it was never black and white.
 *
 *  Each mode now carries both numbers, and they are the mode. The row
 *  sits BESIDE the look rather than inside it: a look is a whole grade,
 *  and how much colour the film carries is a separate question a director
 *  asks about any of them. */
const COLOURS = [
  {
    id: "mono",
    label: "Black and white",
    saturation: 0,
    spread: 0,
    note: "No colour at all. Key and contrast still decide the tonal world; the form does the rest.",
  },
  {
    id: "muted",
    label: "Muted",
    saturation: 0.34,
    spread: 0.22,
    note: "A close harmony — colour you notice rather than see. What every film used to be by default.",
  },
  {
    id: "colour",
    label: "Colour",
    saturation: 0.85,
    spread: 0.6,
    note: "Saturated, and a wide scheme — still recognisably one film.",
  },
  {
    id: "spectrum",
    label: "Full spectrum",
    saturation: 1,
    spread: 1,
    note: "The whole wheel at full intensity. Ask for this on purpose.",
  },
];

/** Which mode a film's numbers are closest to.
 *
 *  Matched on BOTH numbers now — a mode is a pair, so a look declaring
 *  saturation 0.9 / spread 0.55 should light "Colour" rather than whatever
 *  its spread alone happened to be nearest. Distance is euclidean and
 *  unweighted, which is the honest default when neither axis is more the
 *  point than the other. */
function nearestColour(colour) {
  const c = { ...(window.COLOUR_DEFAULT || {}), ...(colour || {}) };
  const s = c.saturation ?? 0.34;
  const sp = c.spread ?? 0.22;
  const away = (m) => (m.saturation - s) ** 2 + (m.spread - sp) ** 2;
  return COLOURS.reduce((a, b) => (away(b) < away(a) ? b : a));
}

function colourRow(colour) {
  const on = nearestColour(colour);
  return `<div class="segs" data-choice="colour">${COLOURS.map(
    (c) =>
      `<button data-opt="${c.id}" class="${on.id === c.id ? "on" : ""}" title="${esc(c.note)}">${esc(c.label)}</button>`,
  ).join("")}</div>`;
}

function viewFilms(root) {
  const ps = window.PROJECTS || [];
  const r = readWriting(NEW.text);
  root.innerHTML = `<div class="page"><div class="wrap">
    ${/* NO EYEBROW HERE. It said "Canopticon", two inches below a bar that
        * already says CANOPTICON — a label repeating the wordmark next to
        * it, which is the kind of thing that makes a page feel like a
        * template rather than a product. */ ""}
    <div class="head"><span class="col"><h1>Make a film out of something you wrote</h1>
      <p class="sub">It reads your writing, finds the moments the argument turns on, and composes a shot for every sentence. Then you direct what it made.</p></span>
      ${ps.length ? `<span class="meta">${ps.length} film${ps.length === 1 ? "" : "s"}</span>` : ""}</div>

    <div class="panel composer">
      <div class="cwrite">
        <div class="clab"><span class="key">Your writing</span><span class="creads" id="creads">${readLine(r)}</span></div>
        <textarea class="ask" id="ask" placeholder="An essay, a script, a transcript, a piece of reporting.">${esc(NEW.text)}</textarea>
      </div>
      ${/* THE TWO CHOICES THAT CHANGE THE FILM MOST, ON THE SCREEN WHERE A
          * FILM IS MADE.
          *
          * Rebuilding this as a bare paste box moved both behind a button,
          * which is why "there aren't even any selections any more" — a
          * text-only film went from one click to three. And the LOOK had
          * never been here at all: eight named looks, coherent and
          * implemented, reachable only from a row buried in the Directing
          * drawer, so in practice every film ever made used the default
          * ground. Everything else the options page offers is a refinement
          * and stays one click away; these two are what the film IS. */ ""}
      ${/* THE WHOLE PANEL, ON THE PAGE WHERE A FILM IS MADE.
          *
          * Reported twice, three days apart: "there aren't even any
          * selections any more" and "I still don't know what the control
          * panel is". Both times the settings existed — behind a button.
          * A control a person cannot find is a control they do not have,
          * and being right about where it lives is not the same as it
          * being findable.
          *
          * Six rows, all on screen. `More options` keeps what genuinely
          * is detail: which voice, and how the type is set. */ ""}
      <div class="cchoices">
        <div class="crow"><span class="clabel">Made of</span>${choiceRow("approach", CHOICES.approaches, NEW.approach)}</div>
        <div class="crow"><span class="clabel">Look</span>${lookRow(NEW.colour)}</div>
        <div class="crow"><span class="clabel">Colour</span>${colourRow(NEW.colour)}</div>
        <div class="crow"><span class="clabel">Length</span>
          <div class="segs" data-choice="duration">${DURATIONS.map(([l, v]) => `<button data-opt="${v}" class="${NEW.duration === v ? "on" : ""}">${l}</button>`).join("")}</div></div>
        <div class="crow"><span class="clabel">Editing</span>${choiceRow("editing", CHOICES.editing, NEW.editing)}</div>
        <div class="crow"><span class="clabel">Intensity</span>${choiceRow("intensity", CHOICES.intensity, NEW.intensity)}</div>
      </div>
      <div class="cfoot">
        <button class="b pri big" id="create" ${r.words < 12 ? "disabled" : ""}>Make the film</button>
        <button class="b" id="opts">More options</button>
        ${/* ONE SENTENCE, NOT A PARAGRAPH. Five lines of small print beside
            * the primary button outweighed it — the eye went to the
            * explanation rather than the thing to press. What is left is
            * the only part a person needs before pressing it. */ ""}
        <p class="note">Cut instantly and free. Spoken aloud, and the film is timed to the voice — <button class="linkish" id="opts2">make it silent</button>.</p>
      </div>
    </div>
    ${NEW.err ? `<div class="notice" style="margin-top:var(--s5)"><i class="dot clay"></i><span>${esc(NEW.err)}</span></div>` : ""}
    ${
      MAKING.id
        ? `<div class="making"><div class="makinghead"><span class="key">Making “${esc(MAKING.title)}”</span><span class="m">${MAKING.total ? `${MAKING.narrated} of ${MAKING.total} moments spoken` : "starting the voice"}</span></div>
           <div class="sndbar"><div class="sndfill" style="width:${MAKING.total ? Math.round((MAKING.narrated / MAKING.total) * 100) : 0}%"></div></div>
           <p class="note">A film is cut to its voice, so it is spoken before it is composed. This is the only step that costs anything. It carries on if you leave — come back and it will be here.</p></div>`
        : ""
    }

    ${
      LIB.error
        ? `<div class="notice" style="margin-top:var(--s5)"><i class="dot clay"></i><span>Can't reach the compiler — ${esc(LIB.error)}. Anything you have made is safe on the server. The example film runs entirely in this page.<br><button class="b sm" id="retry" style="margin-top:10px">Try again</button></span></div>`
        : ""
    }

    ${
      ps.length
        ? `<div class="libhead"><span class="key">Yours</span><button class="b q sm" id="ex">Open the example</button></div>
           <div class="filmlist">${ps
             .map(
               (p) => `<span class="filmrow"><button class="filmopen" data-open="${p.projectId}">
          <span><b>${esc(p.title || "Untitled")}</b><p>${p.acts ? `${p.acts} part${p.acts === 1 ? "" : "s"}` : "Not yet cut"}${p.stale ? ` · ${p.stale} to re-record` : ""}</p></span>
          <span class="m">${p.scenes ?? "—"} moments</span>
          <span class="m">${p.narrated ? (p.narrated >= (p.scenes || 0) ? "narrated" : `${p.narrated}/${p.scenes} voiced`) : "silent"}</span></button><button class="b q sm filmdel" data-del="${p.projectId}" title="Delete this film" aria-label="Delete ${esc(p.title || "Untitled")}">Delete</button></span>`,
             )
             .join("")}</div>`
        : `<div class="empty"><h2 style="margin-bottom:8px">You haven't made one yet</h2><p class="note">Paste something above, or <button class="linkish" id="ex">open the example film</button> — an investigation you can direct straight away.</p></div>`
    }
  </div></div>`;

  const on = (id, fn) => {
    const el = root.querySelector(id);
    if (el) el.onclick = fn;
  };
  /* THE WRITING IS SHARED WITH THE FULL CREATE PAGE. Both surfaces read
   * and write the same `NEW.text`, so "Choose how it looks" carries what
   * you typed with you instead of asking for it twice. */
  const ta = root.querySelector("#ask");
  if (ta) {
    ta.oninput = () => {
      NEW.text = ta.value;
      const x = readWriting(NEW.text);
      root.querySelector("#creads").textContent = readLine(x);
      root.querySelector("#create").disabled = x.words < 12;
    };
  }
  /* Both rows write to the SAME `NEW` the options page uses, so a choice
   * made here survives opening More options and vice versa. */
  root.querySelectorAll("[data-choice]").forEach((row) =>
    row.querySelectorAll("[data-opt]").forEach((b) => {
      b.onclick = () => {
        if (row.dataset.choice === "look") {
          const l = (window.LOOKS || []).find((x) => x.id === b.dataset.opt);
          // The look brings its own spread; an explicit Colour choice
          // made afterwards wins, because it is the more specific ask.
          if (l) NEW.colour = { ...l.colour };
        } else if (row.dataset.choice === "colour") {
          // BOTH numbers, because both are the mode — see COLOURS. Writing
          // only `spread` here is what made "Full spectrum" a wheel of
          // muted colours and "Black and white" a colour film.
          const m = COLOURS.find((x) => x.id === b.dataset.opt);
          if (m)
            NEW.colour = {
              ...(NEW.colour || window.COLOUR_DEFAULT || {}),
              saturation: m.saturation,
              spread: m.spread,
            };
        } else if (row.dataset.choice === "duration") {
          NEW.duration = Number(b.dataset.opt);
        } else {
          NEW[row.dataset.choice] = b.dataset.opt;
        }
        render();
      };
    }),
  );
  on("#create", () => create());
  on("#opts", () => go("start"));
  on("#opts2", () => go("start"));
  on("#ex", useExample);
  on("#retry", filmsRefresh);
  root.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openFilm(b.dataset.open)));
  /* DELETE. The library grew monotonically — no delete, no rename, no way
   * to get rid of a test film. `deleteProject` has existed in the bridge
   * since it was written and was called from nowhere. */
  root.querySelectorAll("[data-del]").forEach(
    (b) =>
      (b.onclick = async (e) => {
        e.stopPropagation();
        const row = b.closest(".filmrow");
        const name = row ? (row.querySelector("b") || {}).textContent : "this film";
        if (!confirm(`Delete “${name}”? The writing, the plan and any recorded voice go with it.`))
          return;
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
      }),
  );
}

Object.assign(window, { viewFilms, filmsRefresh, openFilm, useExample, adoptFilm, watchMaking, MAKING });
