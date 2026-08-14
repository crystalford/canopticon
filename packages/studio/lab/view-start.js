/* CANOPTICON — CREATE.
 *
 * Four understandable choices, then Advanced. The beginner sees a product;
 * the obsessive user gets the whole laboratory.
 *
 * WHAT CHANGED, AND WHY THE OLD VERSION WAS WRONG.
 *
 * "Made of paper / ink / screen / particles / light" is a MATERIAL choice.
 * It is interesting, and it answers a smaller question than the one a
 * person actually has: what kind of visual experience is this. And "Short
 * / Medium / Long" was not a duration control at all — it named nothing
 * and reached nothing.
 *
 * So the decisions are separated, and each reaches a different part of the
 * compiler:
 *
 *     VISUALS     what the picture is made of      → ir.visualApproach
 *     NARRATION   whether there is a voice          → the narrate step
 *     EDITING     whether the film cuts             → ir.continuity
 *     INTENSITY   how hard it pushes                → the identity curves
 *     DURATION    a SOFT target on the edit         → cutRhythm, density
 *
 * The lists are fetched FROM the compiler (`/v1/vocabulary/choices`)
 * rather than written here. Three times now a control has been wrong
 * because a front end offered something the engine could not do; the fix
 * is that the front end stops inventing.
 */
const NEW = {
  text: "",
  approach: "hybrid",
  editing: "cut",
  intensity: "expressive",
  register: "auto",
  duration: 0,
  voice: "None",
  speaker: "angus",
  err: null,
};

/* THE LISTS, AND WHO OWNS THEM.
 *
 * The compiler is authoritative and overwrites these the moment
 * `/v1/vocabulary/choices` answers. They are written out in full here for
 * one reason: the Lab is meant to run as a STATIC PAGE — open
 * `lab/index.html` in a browser, no server — and a page whose front door
 * offers one visual option when it cannot reach a Worker is a broken
 * front door, not a graceful degradation. Measured: with a
 * smallest-honest-set fallback, opening the file gave exactly one visual
 * choice and one editing mode.
 *
 * The duplication is real and is the thing to watch. Two lists of one rule
 * is how the Lab and the Worker came to disagree about 57 of 88 scenes.
 * What keeps this safe is that the server ALWAYS wins when it answers and
 * the ids are the compiler's own enum — a stale label here shows the wrong
 * word, never composes the wrong film. */
let CHOICES = {
  approaches: [
    { id: "text", label: "Text driven", note: "The writing itself is the material — typography, kinetic text, particles, hard cuts." },
    { id: "abstract", label: "Abstract", note: "No attempt to depict the nouns. Geometry, fields, light, motion, spatial relation." },
    { id: "world", label: "World", note: "Persistent objects and spaces that evolve as the narration goes on." },
    { id: "hybrid", label: "Let CANOPTICON decide", note: "The system chooses the visual language from your writing, sentence by sentence." },
  ],
  editing: [
    { id: "oneshot", label: "Continuous", note: "Never cuts. Every change is travelled through." },
    { id: "cut", label: "Scene based", note: "Each moment is its own shot." },
    { id: "hybrid", label: "Mixed", note: "Continuous passages, punctuated where a cut is earned." },
    { id: "montage", label: "Collide", note: "Cuts are the argument. Held apart, never eased." },
  ],
  registers: [
    { id: "auto", label: "Let it decide", note: "Set for a phrase, taken apart for the statement the argument turns on." },
    { id: "editorial", label: "Editorial", note: "Set large and composed. Legibility is the point; the writing does the work." },
    { id: "fiore", label: "Fiore", note: "Violent scale, cropped by the frame, halftone. Each frame is one assertion." },
    { id: "kinetic", label: "Kinetic", note: "Letterforms as points — the words assemble and come apart." },
  ],
  intensity: [
    { id: "restrained", label: "Restrained" },
    { id: "expressive", label: "Expressive" },
    { id: "chaotic", label: "Chaotic" },
  ],
  voices: [
    { id: "angus", label: "Angus", note: "warm, unhurried — the default" },
    { id: "asteria", label: "Asteria", note: "clear and level" },
    { id: "arcas", label: "Arcas", note: "low, close, documentary" },
    { id: "orion", label: "Orion", note: "measured, formal" },
    { id: "luna", label: "Luna", note: "light, quick" },
    { id: "athena", label: "Athena", note: "cool, precise" },
    { id: "zeus", label: "Zeus", note: "heavy, declarative" },
    { id: "hera", label: "Hera", note: "even, reportorial" },
  ],
};

/** A soft target. It never drops a sentence — see `paceFor` on the ingest
 *  route. The film is as long as the writing; the target shapes the edit. */
const DURATIONS = [
  ["Use my writing", 0],
  ["30 sec", 30],
  ["1 min", 60],
  ["3 min", 180],
  ["5 min", 300],
  ["10 min+", 600],
];

function readWriting(t) {
  const text = (t || "").trim();
  if (!text) return { words: 0, moments: 0, secs: 0 };
  const words = text.split(/\s+/).filter(Boolean).length;
  const moments = (text.match(/[^.!?]+[.!?]+["”')\]]?(\s|$)/g) || [text]).length;
  // 150 wpm is documentary pace and is the SAME number the ingest route
  // uses to turn a duration target into an edit. One number, one meaning.
  return { words, moments, secs: (words / 150) * 60 };
}
const readLine = (r) =>
  r.words ? `${r.words} words · ${r.moments} moments · ${fmt(r.secs)} spoken` : "nothing yet";

/** What a duration target will actually do, said BEFORE it is chosen.
 *
 *  A target that cannot be honoured should say what it can do rather than
 *  imply it will trim the writing. Nothing here deletes a sentence: that
 *  is the operator's decision, not the compiler's. */
function durationNote(r) {
  if (!NEW.duration) return "The film is as long as your writing.";
  if (!r.words) return "A target shapes the edit — it never drops a sentence.";
  const ratio = r.secs / NEW.duration;
  if (ratio > 1.15)
    return `Your writing runs ${fmt(r.secs)}. Nothing is cut from it — the film is edited as if it were ${fmt(NEW.duration)}: faster, denser, less room per idea.`;
  if (ratio < 0.85)
    return `Your writing runs ${fmt(r.secs)}, under the target. The film opens out — slower, more room, fewer cuts.`;
  return `Your writing already runs about ${fmt(r.secs)}.`;
}

function viewStart(root) {
  const r = readWriting(NEW.text);
  const seg = (id, opts, current) =>
    `<div class="segs" data-choice="${id}">${opts
      .map(
        (o) =>
          `<button data-opt="${esc(o.id)}" class="${current === o.id ? "on" : ""}" title="${esc(o.note || "")}">${esc(o.label)}</button>`,
      )
      .join("")}</div>`;
  const chosen = CHOICES.approaches.find((a) => a.id === NEW.approach);
  const chosenEdit = CHOICES.editing.find((a) => a.id === NEW.editing);

  root.innerHTML = `<div class="start"><div class="startwrap">
    <div class="head"><span class="col"><span class="eyebrow">Create</span><h1>What are you making?</h1>
      <p class="sub">Paste something you have written. CANOPTICON reads it, finds the moments the argument turns on, and composes a film against your own voice — then you direct what it made.</p></span></div>

    <div class="panel composer">
      <div class="cwrite">
        <div class="clab"><span class="key">Your writing</span><span class="creads" id="creads">${readLine(r)}</span></div>
        <textarea class="ask" id="ask" placeholder="An essay, a script, a transcript, a piece of reporting.">${esc(NEW.text)}</textarea>
      </div>
      <div class="cchoices">
        <div class="crow"><span class="clabel">Visuals</span>${seg("approach", CHOICES.approaches, NEW.approach)}</div>
        ${chosen?.note ? `<p class="note choicenote">${esc(chosen.note)}</p>` : ""}
        ${
          /* CONTEXTUAL, not a fifth top-level question. The register only
           * means anything once the words are the material, so it appears
           * when — and only when — Text driven is the answer above it. */
          NEW.approach === "text"
            ? `<div class="crow"><span class="clabel">Type</span>${seg("register", CHOICES.registers || [], NEW.register)}</div>
               ${(CHOICES.registers || []).find((r) => r.id === NEW.register)?.note ? `<p class="note choicenote">${esc((CHOICES.registers || []).find((r) => r.id === NEW.register).note)}</p>` : ""}`
            : ""
        }

        <div class="crow"><span class="clabel">Narration</span>${seg(
          "voice",
          [
            { id: "None", label: "None", note: "A silent film. Nothing is spent." },
            { id: "Synthesised", label: "Synthesised", note: "Recorded once, frozen, and the film is timed to it." },
          ],
          NEW.voice,
        )}</div>
        ${NEW.voice === "Synthesised" ? `<div class="crow"><span class="clabel">Voice</span>${seg("speaker", CHOICES.voices, NEW.speaker)}</div>` : ""}

        <div class="crow"><span class="clabel">Editing</span>${seg("editing", CHOICES.editing, NEW.editing)}</div>
        ${chosenEdit?.note ? `<p class="note choicenote">${esc(chosenEdit.note)}</p>` : ""}

        <div class="crow"><span class="clabel">Intensity</span>${seg("intensity", CHOICES.intensity, NEW.intensity)}</div>

        <div class="crow"><span class="clabel">Duration</span>
          <div class="segs" data-choice="duration">${DURATIONS.map(([l, v]) => `<button data-opt="${v}" class="${NEW.duration === v ? "on" : ""}">${l}</button>`).join("")}</div></div>
        <p class="note choicenote" id="durnote">${esc(durationNote(r))}</p>
      </div>
      <div class="cfoot">
        <button class="b pri big" id="create" ${r.words < 12 ? "disabled" : ""}>Create the film</button>
        <p class="note">${
          NEW.voice === "Synthesised"
            ? "The cut is instant, free and repeatable. The voice is recorded once, frozen and hashed — the only step that spends anything, and it is what the film is then timed to."
            : "Nothing is sent to a model to cut your writing, and no voice is bought. The same words always cut the same way."
        }</p>
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
    root.querySelector("#durnote").textContent = durationNote(x);
    root.querySelector("#create").disabled = x.words < 12;
  };
  root.querySelectorAll("[data-choice]").forEach((row) =>
    row.querySelectorAll("[data-opt]").forEach((b) => {
      b.onclick = () => {
        const k = row.dataset.choice;
        NEW[k] = k === "duration" ? +b.dataset.opt : b.dataset.opt;
        // Repainted rather than toggled: choosing Synthesised reveals the
        // voice row, and every choice carries a line saying what it means.
        render();
      };
    }),
  );
  root.querySelector("#ex").onclick = useExample;
  root.querySelector("#create").onclick = () => create();
  ta.focus();
  loadChoices();
}

/** The lists, from the compiler. Called once; a failure leaves the
 *  fallbacks in place rather than emptying the page. */
let choicesLoaded = false;
async function loadChoices() {
  if (choicesLoaded) return;
  choicesLoaded = true;
  try {
    const c = await api("/vocabulary/choices");
    if (c?.approaches?.length) {
      CHOICES = c;
      render();
    }
  } catch {
    // Offline, or an older Worker. The fallbacks still make a film.
  }
}

async function create() {
  NEW.err = null;
  busy(true, "reading it, finding what the argument turns on");
  try {
    /* THE CHOICES TRAVEL WITH THE ESSAY. Every one is a field the compiler
     * reads: the approach weights which reading of a sentence wins, the
     * editing decides whether the film may cut, the intensity moves three
     * curves, and the duration shapes the edit without touching a word. */
    const r = await ingestEssay(NEW.text.trim(), {
      visualApproach: NEW.approach,
      ...(NEW.approach === "text" ? { typeRegister: NEW.register } : {}),
      continuity: NEW.editing,
      intensity: NEW.intensity,
      ...(NEW.duration ? { durationTargetSec: NEW.duration } : {}),
    });
    await filmsRefresh();
    await loadProject(r.projectId);
    adoptFilm();
    toast(`Made — ${liveScenes().length} moments`);
    /* THE VOICE, WHEN IT WAS ASKED FOR.
     *
     * A separate, deliberate, chargeable step and it stays one — the only
     * thing here that spends model calls, and its output is frozen and
     * hashed as an input artifact. What changed is that choosing it on the
     * front door starts it, with a bar, instead of leaving it to be found
     * three buttons deep in the library. */
    if (NEW.voice === "Synthesised") await narrateNow(r.projectId, null, NEW.speaker);
  } catch (e) {
    busy(false);
    NEW.err = `Couldn't reach the compiler (${e.message}). Your writing is safe in this page — try again, or open the example film and direct that.`;
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
async function narrateNow(projectId, onProgress, speaker) {
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
      const r = await narrateProject(projectId, {
        limit: 6,
        ...(speaker ? { voice: speaker } : {}),
      });
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
    toast(`The film is made, but the voice failed — ${e.message}`);
  } finally {
    busy(false);
  }
}

Object.assign(window, { viewStart, readWriting, narrateNow, NEW });
