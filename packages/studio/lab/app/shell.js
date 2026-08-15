/* Two routes. That is the whole application shell.
 *
 * The old one had four views plus a director's drawer of eight verbs and a
 * trajectory ribbon — an interface built to negotiate with a compiler that
 * was not sure what it was doing. This one makes a film and shows it.
 */

import { viewCreate } from "./view-create.js";
import { viewFilm } from "./view-film.js";

const root = document.querySelector("#app");

function go(route) {
  if (location.hash.slice(1) === route) render();
  else location.hash = route;
}

async function render() {
  const route = location.hash.slice(1);
  const film = route.match(/^film\/(.+)$/);
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
