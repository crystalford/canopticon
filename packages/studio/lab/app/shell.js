/* Two routes. That is the whole application shell.
 *
 * The old one had four views plus a director's drawer of eight verbs and a
 * trajectory ribbon — an interface built to negotiate with a compiler that
 * was not sure what it was doing. This one makes a film and shows it.
 */

import { viewCreate } from "./view-create.js";
import { viewFilm } from "./view-film.js";

const root = document.querySelector("#app");
const bar = document.querySelector("#bar");

/** THE MARK. Restored verbatim from the design the engine reset dropped
 *  along with the engine — the reset's own PR touched only the compiler,
 *  and this tool's whole front end went with it as an unflagged side
 *  effect. Two concentric arcs and a held point: an aperture closing on
 *  something, which is the whole of what this instrument does. */
const MARK = `<svg width="21" height="21" viewBox="0 0 22 22" fill="none" aria-hidden="true">
<path d="M17.55 15.59A8 8 0 1 0 17.55 6.41" stroke="#666f73" stroke-width="1.2" stroke-dasharray="1.4 2.7" stroke-linecap="round"/>
<path d="M14.69 13.58A4.5 4.5 0 1 0 14.69 8.42" stroke="#bdc4c6" stroke-width="1.3" stroke-linecap="round"/>
<circle cx="11" cy="11" r="1.6" fill="#a9c6b0"/></svg>`;

function go(route) {
  if (location.hash.slice(1) === route) render();
  else location.hash = route;
}

function renderBar(onFilm) {
  bar.innerHTML = `
    <button class="mark" data-go="">${MARK}<b>CANOPTICON</b></button>
    ${onFilm ? '<div class="bardiv"></div><button class="b q sm" data-go="">Your films</button>' : ""}`;
  for (const b of bar.querySelectorAll("[data-go]")) {
    b.addEventListener("click", () => go(b.dataset.go));
  }
}

async function render() {
  const route = location.hash.slice(1);
  const film = route.match(/^film\/(.+)$/);
  renderBar(Boolean(film));
  try {
    if (film) await viewFilm(root, go, film[1]);
    else await viewCreate(root, go);
  } catch (err) {
    // Degrade, flag, continue — a broken film must not be a blank page
    // with nothing to click.
    root.innerHTML = `<h1>That did not work</h1><p class="sub">${String(err.message || err)}</p>
      <div class="actions"><button id="home">Start again</button></div>`;
    root.querySelector("#home").addEventListener("click", () => go(""));
  }
}

window.addEventListener("hashchange", render);
render();
