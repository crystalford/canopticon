/* CANOPTICON — VISUAL. How the film is expressed, and how it is heard.
 *
 * THE TWO BIGGEST HOLES THE PRODUCT AUDIT FOUND.
 *
 * The compiler has had a real, load-bearing VISUAL LANGUAGE since
 * `construct.ts` was written — five of them, each moving every operator's
 * appetite and setting the representation rung a construction prefers —
 * and it grew a whole narration pipeline. Neither was reachable from the
 * interface. A director could open Studio, see seven surfaces every one of
 * them named after a compiler stage, and change neither how the film looks
 * nor whether it speaks.
 *
 * So this view answers two questions in the director's language:
 *
 *   HOW IS THIS FILM EXPRESSED?   the visual language
 *   HOW IS IT HEARD?              the audio
 *
 * It names no primitive, no chain and no parameter. Everything that
 * belongs to the compiler stays in ENGINE.
 *
 * THE CORRECTION THIS FILE IS ON ITS SECOND VERSION FOR.
 *
 * The first version of this view offered the EIGHT COMPOSITIONAL
 * STRATEGIES as the visual choice. They are the best thing in the
 * repository and they are an EXPERIMENT — `experiments/strategy.ts` is
 * imported by nothing in `src/compile/`, so choosing one changed a
 * variable in this page and nothing else. A control that looks like a
 * decision and is not one is precisely the failure this codebase has been
 * bitten by most often, and shipping it while writing an honesty rule two
 * paragraphs above it was worse than not shipping the view at all.
 *
 * So the picker now offers the FIVE LANGUAGES THE COMPILER ACTUALLY
 * HONOURS, generated from `construct.ts` by `scripts/gen-languages.mjs`
 * so the list cannot drift, and choosing one takes the same rail a curve
 * drag takes: a new IR version, a recompile, and a report of what the
 * change COST. The eight strategies are named at the foot of the section
 * as what they are — a proposal that is not in the pipeline yet.
 *
 * HONESTY RULE, applied strictly here: a control that is not wired says
 * so, on the control, in plain words.
 */

/** What the film currently has by way of a voice. Read from the plan, so
 *  it cannot claim narration the film does not carry. */
function audioState() {
  const film = window.FILM;
  const scenes = (film && film.scenes) || [];
  const withVo = scenes.filter((s) => s.vo && s.vo.url).length;
  return {
    scenes: scenes.length,
    narrated: withVo,
    mode: withVo === 0 ? "none" : withVo === scenes.length ? "full" : "partial",
  };
}

/** Can this page actually reach the compiler? Everything that needs the
 *  Worker is disabled and LABELLED when it cannot. */
function backendReachable() {
  return !(window.STUDIO && window.STUDIO.demo);
}

/** What the last language change cost, in the compiler's own numbers.
 *  Set by the click handler, cleared when the view is rebuilt fresh. */
let VISUAL_NOTE = null;
function visualSay(text, kind) {
  VISUAL_NOTE = text ? { text, kind: kind || "", action: null } : null;
  const el = document.getElementById("visual-note");
  if (el) el.outerHTML = noticeHTML(VISUAL_NOTE, "visual-note");
}


/* ── COLOUR, THE DIRECTOR'S FOUR NUMBERS ──────────────────────────────
 *
 * These are the whole cinematography control today, and they are real:
 * every one of them moves the ground, the ink, the mid tones and the
 * accent together through `resolvePalette`. There is no fifth hidden
 * setting and no per-primitive colour to hunt for.
 *
 * Named looks are shown as coordinates rather than modes — a look reads
 * as "in use" only while the dials still sit where it put them, so
 * nudging one does not leave a preset lit that no longer describes the
 * film. */
const COLOUR_DIALS = [
  ["key", "Key", "dark ground", "paper"],
  ["temperature", "Temperature", "cold", "warm"],
  ["saturation", "Saturation", "monochrome", "saturated"],
  ["contrast", "Contrast", "flat", "hard"],
];

/** A look is "in use" only while the film still sits on its coordinates. */
function LOOK_MATCH(a, b) {
  if (!b) return false;
  return COLOUR_DIALS.every(([k]) => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) < 0.02);
}

/** Show what the colour actually IS. A colour control with no colour on
 *  it is the one kind of control that has no excuse. */
function SWATCH(colour) {
  const p = resolvePalette(colour);
  return [p.bg, p.ink, p.muted, p.accent]
    .map((c) => `<i style="background:${c}"></i>`)
    .join("");
}

function viewVisual(root) {
  const film = window.FILM;
  const chosen = film.visualLanguage || "documentary";
  const audio = audioState();
  const live = backendReachable();
  const mode =
    (window.APP_VISUAL && window.APP_VISUAL.audio) || (audio.narrated ? "existing" : "none");

  const langCards = LANGUAGES_UI.map((l) => {
    const on = chosen === l.id;
    return `<button class="vcard ${on ? "on" : ""}" data-lang="${l.id}" ${live ? "" : "disabled"}>
      <b>${l.name}</b>
      ${on ? '<span class="tag on">IN USE</span>' : ""}
      <i>${l.feels}</i>
      <p>${l.blurb}</p>
      <u class="vwhy">${l.why}</u>
    </button>`;
  }).join("");

  /* THE FOUR THINGS A FILM CAN DO ABOUT SOUND.
   *
   * "Speak it yourself" is NOT offered. Studio has no recording path —
   * no capture, no upload route, no asset provenance for operator audio —
   * and an option that opens a microphone and loses the take is worse
   * than an absence. It is named in the footnote instead, as missing. */
  const AUDIO_MODES = [
    ["tts", "Have it read aloud", "A synthetic voice speaks each scene once. Recorded, hashed and frozen."],
    ["existing", "Use what is recorded", "The narration already attached to this film."],
    ["none", "No voice", "The film carries itself. Captions do the talking."],
  ];

  root.innerHTML = `
  <div class="vhead">
    <h1>Visual</h1>
    <div class="sub">How this film is expressed, and how it is heard.</div>
  </div>

  ${noticeHTML(VISUAL_NOTE, "visual-note")}

  <section class="vsec">
    <div class="vsech">
      <h2>Visual language</h2>
      <div class="note">${
        live
          ? "Changing this recompiles the film and tells you what it cost. It never spends narration."
          : "The example film is fixed. Open a stored film to change its language."
      }</div>
    </div>
    <div class="vgrid">${langCards}</div>
    <div class="vfoot">
      A language is a CONSTRAINT, not a look: it moves what each operation is
      willing to do and how literally a thing may be drawn, and the sentence still
      decides what gets built. Same essay, same words, same seed — a different
      language is a different film rather than a filter over the same one.
      <br><br>
      The eight compositional strategies — typographic, geometric, diagrammatic,
      signal, material, illustrative, computational, synthesis — are a proposal,
      not a setting. They live in <span class="mono">experiments/strategy.ts</span>,
      nothing in the compiler imports them, and they are deliberately not offered
      here until they are in the pipeline.
    </div>
  </section>

  <section class="vsec">
    <div class="vsech">
      <h2>Cinematography — colour</h2>
      <div class="note">${
        live
          ? "How the film is lit and graded. Four continuous choices, not a filter menu."
          : "The example film is fixed. Open a stored film to change its colour."
      }</div>
    </div>
    <div class="vgrid looks">
      ${LOOKS.map((l) => {
        const on = LOOK_MATCH(l.colour, film.colour);
        return `<button class="vcard look ${on ? "on" : ""}" data-look="${l.id}" ${live ? "" : "disabled"}>
          <span class="swatch">${SWATCH(l.colour)}</span>
          <b>${l.name}</b>
          <p>${l.blurb}</p>
        </button>`;
      }).join("")}
    </div>
    <div class="cdials" id="cdials"></div>
    <div class="vfoot">
      A named look is a POSITION in these four numbers, not a preset — pick one and
      then move a dial and you are still somewhere the system understands. Colour
      belongs to the film; a primitive decides what it draws, never what colour the
      film is.
    </div>
  </section>

  <section class="vsec">
    <div class="vsech">
      <h2>Audio</h2>
      <div class="note">${
        audio.narrated === 0
          ? `No voice yet. ${audio.scenes} scenes.`
          : `${audio.narrated} of ${audio.scenes} scenes have a voice.`
      }</div>
    </div>
    <div class="vrow">
      ${AUDIO_MODES.map(([id, label, help]) => {
        const on = mode === id;
        const blocked = id === "tts" && !live;
        return `<button class="vopt ${on ? "on" : ""} ${blocked ? "off" : ""}" data-audio="${id}"
          ${blocked ? 'disabled title="Needs the compiler. Open a stored film."' : ""}>
          <span class="dot"></span>
          <b>${label}</b>
          <p>${help}</p>
          ${blocked ? "<em>unavailable here — needs the compiler</em>" : ""}
        </button>`;
      }).join("")}
    </div>
    ${
      mode === "tts" && live
        ? `<div class="films-actions">
             <button class="btn primary" id="v-narrate">${
               audio.narrated >= audio.scenes && audio.scenes > 0
                 ? "RE-RECORD EVERY SCENE"
                 : `RECORD ${audio.scenes - audio.narrated} SCENE${audio.scenes - audio.narrated === 1 ? "" : "S"}`
             }</button>
             <span class="mono films-hint">The one step that spends model calls. Each scene is spoken
               once and frozen; after this, re-cutting the film is free. Escape stops it between
               batches and keeps everything already recorded.</span>
           </div>`
        : ""
    }
    <div class="vscenes">
      ${
        audio.scenes
          ? (window.FILM.scenes || [])
              .map(
                (s, i) =>
                  `<i class="${s.vo && s.vo.url ? "has" : ""}" title="${(s.text || "").slice(0, 70).replace(/"/g, "&quot;")}">${i + 1}</i>`,
              )
              .join("")
          : ""
      }
    </div>
    <div class="vfoot">${
      audio.narrated
        ? "Filled marks are scenes that have a recorded voice. Timing comes off the audio, not off character counts."
        : "A film with no audio is a finished film here — captions carry the script and the cut is unaffected."
    }<br><br>
      Speaking it in your own voice is not built. Studio has no capture, no upload
      route and no provenance for operator audio, so it is named here rather than
      offered as a button that would lose the take.
    </div>
  </section>

  <section class="vsec">
    <div class="vsech">
      <h2>The voice</h2>
      <div class="note">Hear the candidates on your own sentence before you commit a film to one of them.</div>
    </div>
    <input id="films-line" class="films-line" type="text"
      placeholder="A line to audition — your own sentence, not a demo reel."
      value="${esc((window.FILM.scenes[0] && window.FILM.scenes[0].text) || "The building is the same. The residents are the same.").slice(0, 140)}">
    <div class="films-actions">
      <button class="btn" id="films-audition" ${live ? "" : "disabled"}>AUDITION THE VOICES</button>
      <button class="btn" id="films-probe" ${live ? "" : "disabled"}>PROBE THE BINDING</button>
      <span class="mono films-hint">${
        live
          ? "Two takes, side by side, no verdict. Stores nothing, spends one call per candidate."
          : "unavailable here — needs the compiler. Open a stored film."
      }</span>
    </div>
    <pre class="mono probe-out" id="probe-out"></pre>
  </section>`;

  /* CHOOSING A LANGUAGE IS AN EDIT, so it takes the edit's rail: written
   * as a new IR version, recompiled against the stored snapshot, and the
   * cost reported. The number that matters is the TTS one — it is
   * structurally zero, which is the whole argument for restyling being
   * free. */
  root.querySelectorAll("[data-lang]").forEach((b) => {
    b.onclick = async () => {
      if (b.disabled || b.dataset.lang === (window.FILM.visualLanguage || "documentary")) return;
      const name = b.dataset.lang;
      visualSay(`recomposing in ${name}…`, "working");
      busy(true, `recomposing the film in ${name}`);
      try {
        const r = await setVisualLanguage(name);
        await loadProject(window.STUDIO.projectId);
        window.__lastRun = dryRun();
        commit(window.__lastRun);
        VISUAL_NOTE = {
          kind: "ok",
          text:
            `Now in ${name}. ${r.cache.misses} of ${r.cache.total} primitives were recomputed, ` +
            `${r.ttsCalls} narration calls spent. Version ${r.irVersion}.`,
          action: null,
        };
        render();
      } catch (err) {
        visualSay(`That did not take — ${err.message}`, "problem");
      } finally {
        busy(false);
      }
    };
  });
  root.querySelectorAll("[data-audio]").forEach((b) => {
    b.onclick = () => {
      if (b.disabled) return;
      window.APP_VISUAL = window.APP_VISUAL || {};
      window.APP_VISUAL.audio = b.dataset.audio;
      viewVisual(root);
    };
  });
  const nar = root.querySelector("#v-narrate");
  if (nar) {
    nar.onclick = async () => {
      // The same batch loop LIBRARY runs, on the same film, reporting into
      // this view's notice. One implementation, two doors.
      await narrateFilm(window.STUDIO.projectId);
      await loadProject(window.STUDIO.projectId);
      window.__lastRun = dryRun();
      commit(window.__lastRun);
      render();
    };
  }
  /* THE DIALS. Rendered after the shell so they can reuse the app's own
   * slider, and debounced into one save per drag — a colour dial dragged
   * across its range would otherwise be forty recompiles. */
  const dialHost = root.querySelector("#cdials");
  if (dialHost) {
    const c = { ...COLOUR_DEFAULT, ...(film.colour || {}) };
    dialHost.innerHTML = COLOUR_DIALS.map(([id, name, lo, hi]) =>
      sliderHTML(id, name, c[id], lo, hi, c[id].toFixed(2)),
    ).join("");
    bindSliders(dialHost, null, (id, v) => {
      if (!live) return;
      c[id] = v;
      // Repaint the dial and the swatches immediately; the film follows
      // when the drag settles.
      film.colour = { ...c };
      applyFilmPalette(c);
      const row = dialHost.querySelector(`[data-sl="${id}"] .slh i`);
      if (row) row.textContent = v.toFixed(2);
      const bars = dialHost.querySelectorAll(`[data-sl="${id}"] .bars s`);
      const f = Math.round(v * bars.length);
      bars.forEach((b, i) => {
        b.className = i < f - 1 ? "f" : i === f - 1 ? "h" : "";
      });
      queueColour(root, c);
    });
  }

  root.querySelectorAll("[data-look]").forEach((b) => {
    b.onclick = async () => {
      if (b.disabled) return;
      const look = LOOKS.find((l) => l.id === b.dataset.look);
      if (!look) return;
      window.FILM.colour = { ...look.colour };
      applyFilmPalette(look.colour);
      await commitColour(root, look.colour, look.name);
    };
  });

  const probe = root.querySelector("#films-probe");
  if (probe) probe.onclick = runProbe;
  const aud = root.querySelector("#films-audition");
  if (aud) aud.onclick = runAudition;
}

let COLOUR_TIMER = null;
function queueColour(root, colour) {
  clearTimeout(COLOUR_TIMER);
  COLOUR_TIMER = setTimeout(() => commitColour(root, colour, null), 700);
}

/** Write the colour, recompile, and say what it cost. Identical rail to a
 *  curve drag and a language change, for the identical reason: it changes
 *  how the film depicts, never what it says, and it can never spend
 *  narration. */
async function commitColour(root, colour, lookName) {
  if (!backendReachable()) return;
  visualSay(lookName ? `grading — ${lookName}…` : "grading…", "working");
  try {
    const r = await setColour(colour);
    await loadProject(window.STUDIO.projectId);
    window.__lastRun = dryRun();
    commit(window.__lastRun);
    VISUAL_NOTE = {
      kind: "ok",
      text:
        `${lookName ? `${lookName}. ` : "Graded. "}` +
        `${r.cache.misses} of ${r.cache.total} primitives recomputed, ${r.ttsCalls} narration calls. ` +
        `Version ${r.irVersion}.`,
      action: null,
    };
    render();
  } catch (err) {
    visualSay(`That grade did not take — ${err.message}`, "problem");
  }
}

/** Run the probe and print what came back, whole.
 *
 *  Deliberately a raw dump rather than a summary. The entire point of this
 *  button is to see the SHAPE — a summary would be one more layer between
 *  a person and the thing that was unverified. */
async function runProbe() {
  const out = document.getElementById("probe-out");
  if (!out) return;
  out.textContent = "asking…";
  try {
    const r = await probeVoice();
    const lines = [];
    for (const s of r.speech || []) {
      lines.push(
        s.ok
          ? `SPEECH  ok    ${s.model}\n        ${s.bytes} bytes ${s.contentType} via ${s.via} · ${s.wallMs}ms\n        first bytes ${(s.firstBytes || []).join(" ")}`
          : `SPEECH  FAIL  ${s.model}\n        ${s.outcome}${s.shape ? `\n        returned ${s.shape}` : ""}`,
      );
    }
    for (const t of r.transcription || []) {
      lines.push(
        t.ok
          ? `TIMING  ok    ${t.model}\n        ${t.words} words, ${t.durationMs}ms measured · ${t.wallMs}ms\n        ${t.shape}`
          : `TIMING  FAIL  ${t.model}\n        ${t.outcome || "no usable timings"}${t.shape ? `\n        returned ${t.shape}` : ""}`,
      );
    }
    lines.push("", r.note || "");
    out.textContent = lines.join("\n");
  } catch (err) {
    out.textContent = `could not reach the compiler — ${err.message}`;
  }
}

/** Speak one line through every candidate and put a player next to each.
 *
 *  Deliberately not a verdict. Two takes, side by side, and the operator
 *  decides — a system that told you which voice was better would be
 *  making a directorial choice on your behalf, which is the one thing
 *  this instrument is built not to do. */
async function runAudition() {
  const out = document.getElementById("probe-out");
  const line = document.getElementById("films-line");
  if (!out) return;
  out.textContent = "speaking…";
  try {
    const r = await auditionVoice(line ? line.value : "");
    out.innerHTML = "";
    for (const take of r.takes || []) {
      const row = document.createElement("div");
      row.className = "take";
      if (!take.ok) {
        row.innerHTML = `<b>${esc(take.model)}</b><span>${esc(take.outcome)}</span>`;
      } else {
        row.innerHTML = `<b>${esc(take.model)}</b>
          <span>${take.bytes} bytes · ${take.contentType} · ${take.wallMs}ms</span>`;
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.src = `data:${take.contentType};base64,${take.audio}`;
        row.appendChild(audio);
      }
      out.appendChild(row);
    }
    if (!(r.takes || []).length) out.textContent = "no candidates answered";
  } catch (err) {
    out.textContent = `could not reach the compiler — ${err.message}`;
  }
}
