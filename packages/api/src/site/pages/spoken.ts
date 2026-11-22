// SPOKEN — a paper decanted into cards of about a minute, to be read aloud
// (content/spoken/<paper>.md). Each card names the passage it compresses,
// checked word for word against the paper at build, and links to it on the
// same page (#q=, found by site.js; without script the link still lands on
// the page). Each carries its caveat: what the shortening leaves out, so a
// minute of it never travels without the reason it was true.

import type { SpokenCard } from "../content/store";
import { esc } from "../layout";
import { inline, passageHref } from "../md";

/** "#q=…:~:text=…" for a passage on the page it is read on. */
function hereHref(passage: string): string {
  const full = passageHref("x", passage);
  return full.slice(full.indexOf("#"));
}

function duration(seconds: number): string {
  if (seconds < 50) return `about ${Math.max(10, Math.round(seconds / 10) * 10)} seconds aloud`;
  if (seconds < 75) return "about a minute aloud";
  return `about ${Math.round(seconds / 30) / 2} minutes aloud`;
}

export function spokenSection(cards: SpokenCard[]): string {
  if (!cards.length) return "";
  const items = cards
    .map(
      (c, i) => `<li class="spoken-card" id="spoken-${i + 1}">
  <div class="spoken-meta"><span>${i + 1} of ${cards.length}</span><span>${duration(c.seconds)}</span></div>
  <h3>${esc(c.title)}</h3>
  ${c.paras.map((p) => `<p>${inline(p)}</p>`).join("\n  ")}
  <dl class="spoken-src">
    <div><dt>Shortens</dt><dd><a href="${hereHref(c.from)}">“${esc(c.from)}”</a></dd></div>${
      c.caveat ? `\n    <div><dt>Leaves out</dt><dd>${inline(c.caveat)}</dd></div>` : ""
    }
  </dl>
</li>`,
    )
    .join("\n");
  return `<section class="spoken" id="spoken" aria-labelledby="spoken-h">
<h2 id="spoken-h">Spoken</h2>
<p class="spoken-intro">The paper in ${cards.length} pieces of about a minute each, written to be read aloud. Each names the passage it shortens and what the shortening leaves out.</p>
<ol class="spoken-list">
${items}
</ol>
</section>`;
}

/** Place the cards after a hand-built paper's argument, before its back
 *  matter (the series list or the references); at the end if it has none. */
export function withSpoken(body: string, cards: SpokenCard[]): string {
  const section = spokenSection(cards);
  if (!section) return body;
  const at = body.search(/<h2 id="s-\d+"[^>]*>(?:The papers in the series|References)/);
  if (at >= 0) return body.slice(0, at) + section + body.slice(at);
  const end = body.indexOf("</article>");
  return end >= 0 ? body.slice(0, end) + section + body.slice(end) : body + section;
}
