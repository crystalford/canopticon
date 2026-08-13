/* CANOPTICON — VISUAL. How the film is expressed, and how it is heard.
 *
 * THE TWO BIGGEST HOLES THE PRODUCT AUDIT FOUND.
 *
 * The compiler grew eight compositional strategies and a whole narration
 * pipeline. Neither was reachable from the interface. A director opening
 * Studio could see FILMS, NARRATIVE, EDITORIAL, PREVIEW, OVERVIEW, COMPILE
 * and LAB — seven surfaces, every one of them named after a stage of the
 * compiler — and could not choose how the film should look or whether it
 * should speak.
 *
 * So this view answers two questions in the director's language:
 *
 *   HOW IS THIS FILM EXPRESSED?   the visual approach
 *   HOW IS IT HEARD?              the audio
 *
 * It names no primitive, no chain and no parameter. Everything that
 * belongs to the compiler stays in ENGINE.
 *
 * HONESTY RULE, applied strictly here: a control that is not wired says
 * so, on the control, in plain words. This project has been bitten
 * repeatedly by surfaces that looked finished and did nothing, and an
 * audio button that silently fails is worse than one that says it cannot
 * run yet.
 */

/** What the system reckons this writing wants, before the director says
 *  anything. AUTO is the default because a director should get a film
 *  first and an opinion second. */
function suggestedStrategy() {
  const film = window.FILM;
  if (!film || !film.scenes) return "TYPOGRAPHIC";
  const text = film.scenes.map((s) => s.text || "").join(" ");
  const figures = (text.match(/\b\d[\d,.]*\b/g) || []).length;
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  // Read off the prose, not off a preference: dense arithmetic wants a
  // diagram, a document-heavy register wants paper, and everything else
  // is carried by its own words.
  if (figures / words > 0.02) return "DIAGRAMMATIC";
  if (/\b(record|document|file|register|contract|archive|report)\b/i.test(text)) return "MATERIAL";
  if (/\b(system|network|pattern|data|machine|algorithm)\b/i.test(text)) return "COMPUTATIONAL";
  return "TYPOGRAPHIC";
}

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

function viewVisual(root) {
  const chosen = (window.APP_VISUAL && window.APP_VISUAL.strategy) || "auto";
  const suggested = suggestedStrategy();
  const audio = audioState();
  const live = backendReachable();
  const mode = (window.APP_VISUAL && window.APP_VISUAL.audio) || (audio.narrated ? "existing" : "none");

  const strategyCards = STRATEGIES_UI.map((s) => {
    const on = chosen === s.id;
    const isSuggested = chosen === "auto" && s.id === suggested;
    return `<button class="vcard ${on ? "on" : ""} ${isSuggested ? "sug" : ""}" data-strategy="${s.id}">
      <b>${s.name}</b>
      ${isSuggested ? '<span class="tag">SUGGESTED</span>' : ""}
      <i>${s.feels}</i>
      <p>${s.argument}</p>
    </button>`;
  }).join("");

  const AUDIO_MODES = [
    ["record", "Record", "Speak it yourself, scene by scene."],
    ["tts", "Text to speech", "A synthetic voice reads the script."],
    ["existing", "Use existing audio", "Narration already attached to this film."],
    ["none", "No audio", "The film carries itself. Captions do the talking."],
  ];

  root.innerHTML = `
  <div class="vhead">
    <h1>Visual</h1>
    <div class="sub">How this film is expressed, and how it is heard.</div>
  </div>

  <section class="vsec">
    <div class="vsech">
      <h2>Visual approach</h2>
      <div class="note">${
        chosen === "auto"
          ? `Choosing for you: <b>${(STRATEGIES_UI.find((s) => s.id === suggested) || {}).name || suggested}</b> — read off the writing itself.`
          : "You have chosen this. Return to Auto to let the writing decide."
      }</div>
    </div>
    <div class="vgrid">
      <button class="vcard ${chosen === "auto" ? "on" : ""}" data-strategy="auto">
        <b>Auto</b>
        <i>let the writing decide</i>
        <p>The system reads the essay and picks an approach. You can always override it.</p>
      </button>
      ${strategyCards}
    </div>
    <div class="vfoot">
      Same essay, same words, same seed — a different approach is a different film,
      not a filter over the same one.
    </div>
  </section>

  <section class="vsec">
    <div class="vsech">
      <h2>Audio</h2>
      <div class="note">${
        audio.narrated === 0
          ? `No narration yet. ${audio.scenes} scenes.`
          : `${audio.narrated} of ${audio.scenes} scenes narrated.`
      }</div>
    </div>
    <div class="vrow">
      ${AUDIO_MODES.map(([id, label, help]) => {
        const on = mode === id;
        const needsBackend = id === "tts" || id === "record";
        const blocked = needsBackend && !live;
        return `<button class="vopt ${on ? "on" : ""} ${blocked ? "off" : ""}" data-audio="${id}"
          ${blocked ? 'disabled title="Needs the compiler. Open a stored film."' : ""}>
          <span class="dot"></span>
          <b>${label}</b>
          <p>${help}</p>
          ${blocked ? '<em>unavailable here — needs the compiler</em>' : ""}
        </button>`;
      }).join("")}
    </div>
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
    }</div>
  </section>`;

  root.querySelectorAll("[data-strategy]").forEach((b) => {
    b.onclick = () => {
      window.APP_VISUAL = window.APP_VISUAL || {};
      window.APP_VISUAL.strategy = b.dataset.strategy;
      viewVisual(root);
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
}
