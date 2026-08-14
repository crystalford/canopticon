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
      <div class="cfoot">
        <button class="b pri big" id="create" ${r.words < 12 ? "disabled" : ""}>Make the film</button>
        <button class="b" id="opts">Choose how it looks</button>
        ${/* ONE SENTENCE, NOT A PARAGRAPH. Five lines of small print beside
            * the primary button outweighed it — the eye went to the
            * explanation rather than the thing to press. What is left is
            * the only part a person needs before pressing it. */ ""}
        <p class="note">Cut instantly and free. Spoken aloud, and the film is timed to the voice — <button class="linkish" id="opts2">make it silent</button>.</p>
      </div>
    </div>
    ${NEW.err ? `<div class="notice" style="margin-top:var(--s5)"><i class="dot clay"></i><span>${esc(NEW.err)}</span></div>` : ""}

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

Object.assign(window, { viewFilms, filmsRefresh, openFilm, useExample, adoptFilm });
