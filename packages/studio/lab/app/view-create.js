/* THE CREATE PAGE.
 *
 * Essay. Voice. Pace, chaos, density. Generate.
 *
 * That is the whole interface, and the restraint is the point. The old
 * front door offered Made-of / Look / Type / Editing / Intensity — six
 * pickers exposing the compiler's own uncertainty and asking the writer to
 * resolve it. Steering belongs in language later ("make the middle more
 * aggressive"), not in a panel of enum dropdowns.
 */

import { api } from "./api.js";

const DIALS = [
  { key: "pace", low: "Slow", high: "Fast", note: "how often the film changes its mind" },
  { key: "chaos", low: "Controlled", high: "Wild", note: "how far it departs from a clean grid" },
  { key: "density", low: "Sparse", high: "Dense", note: "how much is on screen at once" },
];

export async function viewCreate(root, go) {
  root.innerHTML = `
    <h1>Canopticon Studio</h1>
    <p class="sub">Paste an essay. Get a film.</p>
    <label for="essay">The writing</label>
    <textarea id="essay" placeholder="Paste an essay — 150 to 300 words makes a minute."></textarea>
    <p class="note" id="count"></p>
    <div class="row">
      <div class="dial">
        <label for="voice">Narration</label>
        <select id="voice"><option value="">None — silent</option></select>
      </div>
      ${DIALS.map(
        (d) => `<div class="dial">
        <label for="${d.key}">${d.key}</label>
        <input type="range" id="${d.key}" min="0" max="100" value="50">
        <div class="ends"><span>${d.low}</span><span>${d.high}</span></div>
        <p class="note">${d.note}</p>
      </div>`,
      ).join("")}
    </div>
    <div class="actions">
      <button id="go">Generate film</button>
      <span class="note" id="status"></span>
    </div>
    <div class="films" id="films"></div>`;

  const $ = (id) => root.querySelector(`#${id}`);
  const essay = $("essay");
  const status = $("status");

  const recount = () => {
    const words = essay.value.trim().split(/\s+/).filter(Boolean).length;
    // The same 150wpm the estimator uses. One number, one meaning.
    $("count").textContent = words
      ? `${words} words — about ${Math.round((words / 150) * 60)} seconds spoken`
      : "";
  };
  essay.addEventListener("input", recount);

  api
    .voices()
    .then((r) => {
      for (const v of r.voices ?? []) {
        const o = document.createElement("option");
        o.value = v.id;
        o.textContent = `${v.label} — ${v.note}`;
        $("voice").append(o);
      }
    })
    .catch(() => {
      // Not fatal: a silent film is a first-class outcome, not a failure.
      status.textContent = "voices unavailable — a silent film still works";
    });

  api
    .films()
    .then((r) => {
      if (!r.films?.length) return;
      $("films").innerHTML =
        `<label>Made already</label>${r.films
          .map(
            (f) =>
              `<div class="film" data-id="${f.id}"><span>${escape(f.title)}</span><span class="note">${f.created_at.slice(0, 10)}</span></div>`,
          )
          .join("")}`;
      for (const el of $("films").querySelectorAll(".film")) {
        el.addEventListener("click", () => go(`film/${el.dataset.id}`));
      }
    })
    .catch(() => undefined);

  $("go").addEventListener("click", async () => {
    if (essay.value.trim().length < 40) {
      status.textContent = "an essay is a paragraph or more";
      return;
    }
    $("go").disabled = true;
    status.textContent = "reading the essay…";
    try {
      const made = await api.create({
        essay: essay.value,
        voice: $("voice").value || null,
        settings: {
          pace: Number($("pace").value) / 100,
          chaos: Number($("chaos").value) / 100,
          density: Number($("density").value) / 100,
        },
      });
      if ($("voice").value) {
        status.textContent = `${made.beats} beats · speaking ${made.spans} spans…`;
        await api.narrate(made.filmId, $("voice").value).catch(() => undefined);
      }
      go(`film/${made.filmId}`);
    } catch (err) {
      status.textContent = err.message;
      $("go").disabled = false;
    }
  });

  recount();
}

const escape = (s) => String(s).replace(/[<>&]/g, (c) => `&#${c.charCodeAt(0)};`);
