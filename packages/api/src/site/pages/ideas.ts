// /ideas — every concept the record named and every open problem it stated.
// docs/blackbox/README.md §Ideas; pages/Canopticon Ideas.dc.html. Read from
// the same library rows as everything else, newest first.

import type { LibraryItem } from "../content/store";
import { libraryItems } from "../content/store";
import { esc, pill, shell } from "../layout";
import { kindColours } from "../theme";

function row(r: LibraryItem, last: boolean): string {
  const concept = r.kind === "Concept";
  const pending = /pending/.test(r.stat ?? "");
  const status: [string, string, string] = concept
    ? pending
      ? ["Name check pending", "#f3e9d4", "#6b4e14"]
      : ["No prior use found", "#e3f0e6", "#1f5e36"]
    : ["Open", "#fbe9df", "#8a3a1f"];
  return `<a href="${esc(r.route)}" class="irow${last ? " last" : ""}"><span class="irow-t">${esc(r.title)}</span>${r.dek ? `<span class="irow-d">${esc(r.dek)}</span>` : ""}<span class="irow-m">${pill(r.kind, kindColours(r.kind))}${pill(r.topic, kindColours("Topic"))}<span>${concept ? "Named" : "Added"} ${esc(r.dateLabel ?? "")}</span>${pill(status[0], [status[1], status[2]])}</span></a>`;
}

function block(title: string, kind: string, rows: LibraryItem[]): string {
  return `<div class="ruled-h" style="margin:40px 0 0">${`<h2>${esc(title)}</h2>`}${pill(String(rows.length), kindColours(kind))}</div><div class="ilist">${rows
    .map((r, i) => row(r, i === rows.length - 1))
    .join("")}</div>`;
}

export function renderIdeas(opts: { signedIn?: boolean } = {}): string {
  const all = libraryItems();
  const byDate = (a: LibraryItem, b: LibraryItem) => b.date.localeCompare(a.date);
  const concepts = all.filter((r) => r.kind === "Concept").sort(byDate);
  const problems = all.filter((r) => r.kind === "Open problem").sort(byDate);
  return shell({
    title: "Ideas",
    description:
      "Concepts are patterns that had no name, so the research gave them one; open problems are questions nobody has answered, or things nobody has built.",
    path: "/ideas",
    nav: "library",
    signedIn: opts.signedIn ?? false,
    body: `<div><h1 class="h-page">Ideas</h1></div><p class="lede" style="color:var(--muted)">Concepts are patterns that had no name, so the research gave them one; open problems are questions nobody has answered, or things nobody has built.</p>${block("Concepts", "Concept", concepts)}${block("Open problems", "Open problem", problems)}`,
  });
}
