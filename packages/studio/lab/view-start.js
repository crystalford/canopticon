/* CANOPTICON — CREATE.
 *
 * One question, one sheet. The writing area, the four choices and the action
 * are one composed object rather than loose text on a ground — the previous
 * version put a 52px question above a frameless field and read as unfinished.
 */
const NEW = { text: "", length: "Medium", made: "let it decide", structure: "let it decide", voice: "None", err: null };
/* Asked as questions a writer can answer, not as nouns from a video editor.
 * "one shot" and "montage" are terminology; "never cut" and "collide ideas"
 * are decisions. The terminology still exists — it appears once the film does,
 * under the hood, where it is the honest name for what happened. */
const CHOICES = [
  ["length", "How long", ["Short", "Medium", "Long"]],
  ["made", "Made of", ["paper", "ink", "screen", "particles", "light", "let it decide"]],
  ["structure", "How it moves", ["let it decide", "cut between ideas", "never cut", "collide ideas"]],
  ["voice", "Spoken by", ["Synthesised", "None"]],
];
const STRUCTURE_MODE = { "cut between ideas": "cut", "never cut": "oneshot", "collide ideas": "montage" };
const MADE_LANG = { paper: "documentary", ink: "technical", screen: "pixel", particles: "surreal", light: "kinetic" };

function readWriting(t) {
  const text = (t || "").trim();
  if (!text) return { words: 0, moments: 0, secs: 0 };
  const words = text.split(/\s+/).filter(Boolean).length;
  const moments = (text.match(/[^.!?]+[.!?]+["”')\]]?(\s|$)/g) || [text]).length;
  return { words, moments, secs: (words / 150) * 60 };
}
const readLine = (r) => (r.words ? r.words + " words · " + r.moments + " moments · " + fmt(r.secs) + " spoken" : "nothing yet");

function viewStart(root) {
  const r = readWriting(NEW.text);
  root.innerHTML = `<div class="start"><div class="startwrap">
    <div class="head"><span class="col"><span class="eyebrow">Create</span><h1>What are you making?</h1>
      <p class="sub">Paste something you have written. CANOPTICON reads it, cuts it into moments and composes a shot for every sentence — then you direct what it made.</p></span></div>

    <div class="panel composer">
      <div class="cwrite">
        <div class="clab"><span class="key">Your writing</span><span class="creads" id="creads">${readLine(r)}</span></div>
        <textarea class="ask" id="ask" placeholder="An essay, a script, a transcript, a piece of reporting.">${esc(NEW.text)}</textarea>
      </div>
      <div class="cchoices">
        ${CHOICES.map(([id, label, opts]) => `<div class="crow"><span class="clabel">${label}</span>
          <div class="segs" data-choice="${id}">${opts.map((o) => `<button data-opt="${esc(o)}" class="${NEW[id] === o ? "on" : ""}">${o}</button>`).join("")}</div></div>`).join("")}
      </div>
      <div class="cfoot">
        <button class="b pri big" id="create" ${r.words < 12 ? "disabled" : ""}>Create the film</button>
        <p class="note">Nothing is sent to a model to cut your writing, and no voice is bought. The cut is instant, free and repeatable — the same words always cut the same way.</p>
      </div>
    </div>

    ${NEW.err ? `<div class="notice" style="margin-top:var(--s5)"><i class="dot clay"></i><span>${esc(NEW.err)}</span></div>` : ""}
    <p class="note startalt">Rather see a finished one? <button id="ex">Open the example film</button> — a four-minute investigation you can direct straight away.</p>
  </div></div>`;

  const ta = root.querySelector("#ask");
  ta.oninput = () => {
    NEW.text = ta.value;
    const x = readWriting(NEW.text);
    root.querySelector("#creads").textContent = readLine(x);
    const b = root.querySelector("#create");
    b.disabled = x.words < 12;
  };
  root.querySelectorAll("[data-choice]").forEach((row) => {
    row.querySelectorAll("[data-opt]").forEach((b) => (b.onclick = () => {
      NEW[row.dataset.choice] = b.dataset.opt;
      row.querySelectorAll("[data-opt]").forEach((x) => x.classList.toggle("on", x === b));
    }));
  });
  root.querySelector("#ex").onclick = useExample;
  root.querySelector("#create").onclick = () => create();
  ta.focus();
}

async function create() {
  NEW.err = null;
  busy(true, "reading it, cutting it into moments");
  try {
    const r = await ingestEssay(NEW.text.trim());
    await filmsRefresh();
    await loadProject(r.projectId);
    applyChoices();
    adoptFilm();
    toast("Made — " + liveScenes().length + " moments");
    /* THE VOICE THE PERSON ASKED FOR.
     *
     * `NEW.voice` was captured on this screen and read by nothing: create
     * applied the language and the continuity and dropped the answer to
     * the one question a video ESSAY actually turns on. A control that
     * cannot act is worse than no control, because it tells you the
     * question has been settled.
     *
     * Recording is a separate, deliberate, chargeable step and stays one —
     * it is the only thing here that spends model calls, and its output is
     * frozen and hashed as an input artifact. What changes is that
     * choosing it on the front door now starts it, with a bar, instead of
     * leaving it to be discovered three buttons deep in the library. */
    if (NEW.voice === "Synthesised") await narrateNow(r.projectId);
  } catch (e) {
    busy(false);
    NEW.err = "Couldn't reach the compiler (" + e.message + "). Your writing is safe in this page — try again, or open the example film and direct that.";
    render();
  } finally {
    busy(false);
  }
}

/** Record the narration, reporting real progress.
 *
 *  `narrateProject` returns `remaining`, so this is a determinate bar
 *  rather than a spinner: the count is the compiler's, not a guess. The
 *  film is reloaded afterwards because the plan is what carries the audio,
 *  and it is fetched once when a film opens — narrate a film you already
 *  have open without this and the Preview stays silent. */
async function narrateNow(projectId, onProgress) {
  let done = 0;
  let failed = 0;
  let ms = 0;
  try {
    for (;;) {
      const total = liveScenes().length || 1;
      // Create shows a busy overlay; the editing area draws its own bar.
      // Same runner either way — the caller decides how it is reported.
      if (onProgress) onProgress({ done, failed, total, ms });
      else busy(true, `recording the voice — ${done} of ${total}${failed ? `, ${failed} failed` : ""}`);
      const r = await narrateProject(projectId, { limit: 6 });
      done += r.narrated;
      failed += r.failed;
      ms += r.narratedMs || 0;
      if (onProgress) onProgress({ done, failed, total, ms });
      if (r.narrated === 0 || r.remaining === 0) break;
    }
    if (done > 0) {
      await loadProject(projectId);
      adoptFilm();
    }
    toast(
      done > 0
        ? `Voiced — ${done} moment${done === 1 ? "" : "s"}, ${fmt(ms / 1000)} of speech`
        : "No voice was recorded — the film is silent",
    );
  } catch (e) {
    // Degrade, flag, continue: the film exists and is watchable silent.
    toast("The film is made, but the voice failed — " + e.message);
  } finally {
    busy(false);
  }
}

function applyChoices() {
  const f = window.FILM;
  if (MADE_LANG[NEW.made]) f.visualLanguage = MADE_LANG[NEW.made];
  f.continuity = STRUCTURE_MODE[NEW.structure] || f.continuity || "cut";
}

Object.assign(window, { viewStart, readWriting, applyChoices, narrateNow, NEW });
